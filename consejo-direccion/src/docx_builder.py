"""
Construye el DOCX final del informe con todos los estilos visuales de Polarier aplicados.
Lee los valores exactos desde config/layout_rules.yaml.
"""

from pathlib import Path
from typing import List, Dict, Optional, Tuple
import re
import json

try:
    from docx import Document
    from docx.shared import Pt, Cm, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False

from utils import load_yaml


LAYOUT_RULES_PATH = Path("config/layout_rules.yaml")
TEMPLATE_PATH = Path("templates/consejo_direccion_template.docx")
OUTPUT_DIR = Path("data/output")
PROCESSED_DIR = Path("data/processed")

# Colores corporativos (fallback si no carga el YAML)
COLOR_HEADING = "DD990D"
COLOR_TEXT_OK = "006100"
COLOR_TEXT_ERROR = "9C0006"
COLOR_TEXT_CRITICAL = "FF0000"
COLOR_TABLE_HEADER = "F4BC46"
COLOR_TABLE_SUBHEADER = "C9D0EF"
COLOR_TABLE_TOTAL = "A6A6A6"
COLOR_TABLE_ALT = "E2EDFD"


def _align_map():
    """Devuelve el mapa de alineaciones — solo llamar cuando python-docx está disponible."""
    return {
        "center": WD_ALIGN_PARAGRAPH.CENTER,
        "left": WD_ALIGN_PARAGRAPH.LEFT,
        "right": WD_ALIGN_PARAGRAPH.RIGHT,
        "justify": WD_ALIGN_PARAGRAPH.JUSTIFY,
    }


# ─────────────────────────────────────────────────────────
# Helpers de formato XML (python-docx bajo nivel)
# ─────────────────────────────────────────────────────────

def _set_cell_bg(cell, hex_color: str):
    """Aplica color de fondo a una celda de tabla."""
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color.lstrip("#"))
    tcPr.append(shd)


def _set_run_color(run, hex_color: str):
    """Aplica color de texto a un run."""
    run.font.color.rgb = RGBColor.from_string(hex_color.lstrip("#"))


def _set_cell_borders(cell, color_hex: str = "000000", size_pt: float = 0.5):
    """Aplica bordes a todas las aristas de una celda."""
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = OxmlElement("w:tcBorders")
    size_eighth_pt = int(size_pt * 8)
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        border = OxmlElement(f"w:{side}")
        border.set(qn("w:val"), "single")
        border.set(qn("w:sz"), str(size_eighth_pt))
        border.set(qn("w:space"), "0")
        border.set(qn("w:color"), color_hex.lstrip("#"))
        tcBorders.append(border)
    tcPr.append(tcBorders)


def _add_page_number_to_footer(paragraph):
    """Inserta campo de numeración automática de páginas en un párrafo."""
    run = paragraph.add_run("Página | ")
    fldChar1 = OxmlElement("w:fldChar")
    fldChar1.set(qn("w:fldCharType"), "begin")
    instrText = OxmlElement("w:instrText")
    instrText.text = "PAGE"
    fldChar2 = OxmlElement("w:fldChar")
    fldChar2.set(qn("w:fldCharType"), "end")
    run._r.append(fldChar1)
    run._r.append(instrText)
    run._r.append(fldChar2)


# ─────────────────────────────────────────────────────────
# Carga de reglas de diseño
# ─────────────────────────────────────────────────────────

class LayoutRules:
    """Wrapper de acceso a config/layout_rules.yaml con fallbacks seguros."""

    def __init__(self, path: Path = LAYOUT_RULES_PATH):
        self._data = load_yaml(path)
        if not self._data:
            print(f"[WARN] No se pudo cargar {path}. Usando valores de diseño por defecto.")
            self._data = {}

    @property
    def font(self) -> str:
        return self._data.get("typography", {}).get("primary_font", "Arial")

    @property
    def fallback_font(self) -> str:
        return self._data.get("typography", {}).get("fallback_fonts", ["Arial"])[0]

    @property
    def margins(self) -> dict:
        return self._data.get("page", {}).get("margins", {
            "top_cm": 3.00, "bottom_cm": 2.50,
            "left_cm": 2.20, "right_cm": 1.50,
        })

    @property
    def heading_color(self) -> str:
        return self._data.get("colors", {}).get("text_heading", "#DD990D").lstrip("#")

    @property
    def table_header_color(self) -> str:
        return self._data.get("colors", {}).get("table_header_primary", "#F4BC46").lstrip("#")

    @property
    def table_subheader_color(self) -> str:
        return self._data.get("colors", {}).get("table_header_secondary", "#C9D0EF").lstrip("#")

    @property
    def table_total_color(self) -> str:
        return self._data.get("colors", {}).get("table_separator", "#A6A6A6").lstrip("#")

    def heading_size(self, level: int) -> Optional[float]:
        default = {1: 20.0, 2: 16.0, 3: 14.0, 4: 12.0, 5: 11.0, 6: 10.0}
        for h in self._data.get("heading_styles", []):
            if h.get("level") == level and h.get("size_pt"):
                return float(h["size_pt"])
        return default.get(level, 12.0)

    def heading_space_before(self, level: int) -> float:
        default = {1: 18.0, 2: 8.0, 3: 8.0, 4: 4.0, 5: 4.0}
        for h in self._data.get("heading_styles", []):
            if h.get("level") == level:
                return float(h.get("space_before_pt", default.get(level, 4.0)))
        return default.get(level, 4.0)


# ─────────────────────────────────────────────────────────
# Template base
# ─────────────────────────────────────────────────────────

def _font_exists(name: str) -> bool:
    """Verifica si una fuente está disponible en el sistema (Windows/Linux/Mac)."""
    try:
        import ctypes
        # En Windows: intentar crear la fuente con GDI
        if hasattr(ctypes, "windll"):
            lf = ctypes.create_string_buffer(b"\x00" * 60)
            lf[:len(name.encode())] = name.encode()
            font = ctypes.windll.gdi32.CreateFontIndirectA(lf)
            if font:
                ctypes.windll.gdi32.DeleteObject(font)
                return True
            return False
    except Exception:
        pass
    return False


def _best_font(primary: str, fallback: str) -> str:
    """Devuelve la fuente principal si está instalada, si no el fallback."""
    return primary if _font_exists(primary) else fallback


def _apply_style_font(style, font_name: str, size_pt: float, bold: bool = False,
                       color_hex: Optional[str] = None, space_before: float = 0.0,
                       space_after: float = 0.0, alignment=None):
    """Aplica propiedades completas a un estilo de python-docx."""
    style.font.name = font_name
    style.font.size = Pt(size_pt)
    style.font.bold = bold
    if color_hex:
        style.font.color.rgb = RGBColor.from_string(color_hex.lstrip("#"))
    if space_before:
        style.paragraph_format.space_before = Pt(space_before)
    if space_after:
        style.paragraph_format.space_after = Pt(space_after)
    if alignment is not None:
        style.paragraph_format.alignment = alignment


def build_base_template(output_path: Path = TEMPLATE_PATH) -> Path:
    """
    Crea templates/consejo_direccion_template.docx con todos los estilos
    corporativos de Polarier. Lee cada valor desde config/layout_rules.yaml.

    Aplica:
    - Márgenes A4 exactos
    - Estilos de heading H1–H9 con colores y espaciados
    - Estilo Normal, P1_Texto, Datos 9pt, Datos 8pt
    - Encabezado con texto de plantilla (logo = ajuste manual)
    - Pie de página con numeración automática
    - Tabla de demostración con la paleta completa
    - Marcadores [requiere ajuste manual] donde aplica
    """
    if not DOCX_AVAILABLE:
        raise ImportError("python-docx no instalado. Ejecutar: pip install python-docx")

    rules = LayoutRules()
    font_name = _best_font(rules.font, rules.fallback_font)
    font_used_note = (
        f"[requiere ajuste manual: fuente '{rules.font}' no instalada — usando '{font_name}']"
        if font_name != rules.font else rules.font
    )

    doc = Document()

    # ═══════════════════════════════════════════════════════
    # 1. PÁGINA — márgenes y tamaño A4
    # ═══════════════════════════════════════════════════════
    sec = doc.sections[0]
    sec.page_width  = Cm(21.59)
    sec.page_height = Cm(27.94)
    m = rules.margins
    sec.top_margin    = Cm(m["top_cm"])
    sec.bottom_margin = Cm(m["bottom_cm"])
    sec.left_margin   = Cm(m["left_cm"])
    sec.right_margin  = Cm(m["right_cm"])

    # ═══════════════════════════════════════════════════════
    # 2. ESTILOS DE PÁRRAFO
    # ═══════════════════════════════════════════════════════

    # Normal (base)
    normal = doc.styles["Normal"]
    normal.font.name = font_name
    normal.font.size = Pt(12)
    normal.paragraph_format.space_before = Pt(5)
    normal.paragraph_format.space_after  = Pt(5)

    # P1_Texto — cuerpo narrativo
    try:
        p1 = doc.styles["P1_Texto"]
    except KeyError:
        from docx.enum.style import WD_STYLE_TYPE
        p1 = doc.styles.add_style("P1_Texto", WD_STYLE_TYPE.PARAGRAPH)
    _apply_style_font(p1, font_name, 12.0, bold=False, color_hex="#000000",
                      space_before=12.0, space_after=12.0,
                      alignment=WD_ALIGN_PARAGRAPH.JUSTIFY)

    # Datos 9pt — tablas estándar
    try:
        d9 = doc.styles["Datos 9pt"]
    except KeyError:
        from docx.enum.style import WD_STYLE_TYPE
        d9 = doc.styles.add_style("Datos 9pt", WD_STYLE_TYPE.PARAGRAPH)
    _apply_style_font(d9, font_name, 9.0, bold=False, color_hex="#000000",
                      space_before=0.0, space_after=0.0,
                      alignment=WD_ALIGN_PARAGRAPH.CENTER)

    # Datos 8pt — tablas compactas
    try:
        d8 = doc.styles["Datos 8pt"]
    except KeyError:
        from docx.enum.style import WD_STYLE_TYPE
        d8 = doc.styles.add_style("Datos 8pt", WD_STYLE_TYPE.PARAGRAPH)
    _apply_style_font(d8, font_name, 8.0, bold=False, color_hex="#000000",
                      space_before=0.0, space_after=0.0,
                      alignment=WD_ALIGN_PARAGRAPH.CENTER)

    # ═══════════════════════════════════════════════════════
    # 3. ESTILOS DE HEADING H1–H9
    # ═══════════════════════════════════════════════════════
    heading_defs = {
        1: (rules.heading_size(1), True,  rules.heading_space_before(1), 4.0, rules.heading_color),
        2: (rules.heading_size(2), True,  rules.heading_space_before(2), 4.0, rules.heading_color),
        3: (rules.heading_size(3), True,  rules.heading_space_before(3), 4.0, rules.heading_color),
        4: (12.0, True,  4.0, 2.0, rules.heading_color),
        5: (11.0, True,  4.0, 2.0, rules.heading_color),
        6: (10.0, False, 2.0, 0.0, "595959"),
        7: (10.0, False, 2.0, 0.0, "595959"),
        8: (10.0, False, 0.0, 0.0, "272727"),
        9: (10.0, False, 0.0, 0.0, "272727"),
    }
    for level, (size, bold, sp_before, sp_after, color) in heading_defs.items():
        sname = f"Heading {level}"
        try:
            st = doc.styles[sname]
        except KeyError:
            from docx.enum.style import WD_STYLE_TYPE
            st = doc.styles.add_style(sname, WD_STYLE_TYPE.PARAGRAPH)
        _apply_style_font(st, font_name, size, bold=bold, color_hex=color,
                          space_before=sp_before, space_after=sp_after,
                          alignment=WD_ALIGN_PARAGRAPH.LEFT)

    # ═══════════════════════════════════════════════════════
    # 4. ENCABEZADO DE PÁGINA
    # ═══════════════════════════════════════════════════════
    header = sec.header
    # Limpiar párrafos existentes
    for p in header.paragraphs:
        for run in p.runs:
            run.clear()

    hdr_para = header.paragraphs[0]
    hdr_para.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # Línea 1: marcador de logo + texto de informe
    run_logo = hdr_para.add_run("[requiere ajuste manual: INSERTAR LOGO POLARIER PNG]")
    run_logo.font.name = font_name
    run_logo.font.size = Pt(7)
    run_logo.font.color.rgb = RGBColor(0xBB, 0xBB, 0xBB)  # gris claro para el marcador

    hdr_para.add_run("\n")

    run_title = hdr_para.add_run("Informe consolidado {MES} {AÑO}")
    run_title.font.name = font_name
    run_title.font.size = Pt(9)
    run_title.font.bold = True

    hdr_para.add_run("\n")

    run_polos = hdr_para.add_run("La Habana | Varadero | Caibarién | Cayo Coco | Cayo Cruz | Holguín")
    run_polos.font.name = font_name
    run_polos.font.size = Pt(9)

    # Línea separadora debajo del encabezado
    _add_header_border(hdr_para)

    # ═══════════════════════════════════════════════════════
    # 5. PIE DE PÁGINA — "Página | N"
    # ═══════════════════════════════════════════════════════
    footer = sec.footer
    for p in footer.paragraphs:
        for run in p.runs:
            run.clear()
    footer_para = footer.paragraphs[0]
    footer_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    _add_page_number_to_footer(footer_para)
    if footer_para.runs:
        footer_para.runs[0].font.name = font_name
        footer_para.runs[0].font.size = Pt(9)

    # ═══════════════════════════════════════════════════════
    # 6. CONTENIDO DE DEMOSTRACIÓN
    # ═══════════════════════════════════════════════════════
    # Título del template
    p = doc.add_heading("PLANTILLA BASE — CONSEJO DE DIRECCIÓN POLARIER", level=1)
    _apply_heading_format(p, 1, rules)
    for run in p.runs:
        run.font.name = font_name

    # Nota de uso
    note = doc.add_paragraph()
    note.style = "Normal"
    r = note.add_run(
        "Este documento es la plantilla base reutilizable del sistema. "
        "Para generar un informe mensual, ejecutar:\n"
        "    python src/main.py generate --month YYYY-MM\n"
        "    python src/main.py build-docx --month YYYY-MM"
    )
    r.font.name = font_name
    r.font.size = Pt(10)
    r.font.color.rgb = RGBColor(0x59, 0x59, 0x59)

    doc.add_paragraph()

    # Muestra de paleta de colores en tabla
    p2 = doc.add_heading("PALETA DE COLORES CORPORATIVOS", level=2)
    _apply_heading_format(p2, 2, rules)
    for run in p2.runs:
        run.font.name = font_name

    palette_headers = ["Elemento", "Color hex", "Uso"]
    palette_rows = [
        ["Encabezados H1–H3",       f"#{rules.heading_color}",       "Títulos de sección"],
        ["Encabezado tabla (fila 1)", f"#{rules.table_header_color}", "Primera fila de toda tabla"],
        ["Subencabezado tabla",       f"#{rules.table_subheader_color}", "Fila de subencabezado"],
        ["Total / Subtotal tabla",    f"#{rules.table_total_color}",  "Fila de totales"],
        ["Valor positivo (texto)",    "#006100",                      "Cumplimiento del plan"],
        ["Valor negativo (texto)",    "#9C0006",                      "Incumplimiento del plan"],
        ["Alerta crítica (texto)",    "#FF0000",                      "Dato crítico urgente"],
        ["Cuerpo narrativo",          "#000000",                      "Párrafos de análisis"],
    ]
    palette_table = doc.add_table(rows=len(palette_rows) + 1, cols=3)
    palette_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    _fill_demo_table(palette_table, palette_headers, palette_rows, rules, font_name)

    doc.add_paragraph()

    # Muestra de tabla de datos con todos los tipos de fila
    p3 = doc.add_heading("ESTRUCTURA DE TABLA DE DATOS (modelo)", level=2)
    _apply_heading_format(p3, 2, rules)
    for run in p3.runs:
        run.font.name = font_name

    add_styled_table(
        doc,
        headers=["Polo", "Plan", "Real", "Desv. %"],
        subheaders=["(subencabezado)", "(CUP)", "(CUP)", "(%)"],
        rows=[
            ["La Habana",  "1.000",  "1.050",  "+5,0%"],
            ["Varadero",   "2.000",  "1.800",  "-10,0%"],
            ["Caibarién",  "500",    "500",    "0,0%"],
            ["Cayo Coco",  "800",    "850",    "+6,3%"],
            ["Cayo Cruz",  "600",    "580",    "-3,3%"],
            ["Holguín",    "700",    "710",    "+1,4%"],
        ],
        totals_row=["Consolidado", "5.600", "5.490", "-2,0%"],
    )

    doc.add_paragraph()

    # Muestra de heading H3 (subsección)
    p4 = doc.add_heading("Ejemplo de subsección (H3)", level=3)
    _apply_heading_format(p4, 3, rules)
    for run in p4.runs:
        run.font.name = font_name

    body = doc.add_paragraph(
        "Este es un ejemplo del estilo P1_Texto usado en los párrafos narrativos del informe. "
        "El análisis de cada sección sigue la estructura: contexto → datos → análisis → conclusión. "
        "Las cifras mencionadas en el texto deben coincidir exactamente con los valores de las tablas."
    )
    body.style = "Normal"
    for run in body.runs:
        run.font.name = font_name
        run.font.size = Pt(12)

    doc.add_paragraph()

    # Nota de ajustes manuales
    p5 = doc.add_heading("AJUSTES MANUALES REQUERIDOS", level=2)
    _apply_heading_format(p5, 2, rules)
    for run in p5.runs:
        run.font.name = font_name

    ajustes = [
        ("Logo Polarier PNG",
         "Insertar la imagen PNG del logo (~29.6 KB) en el encabezado, posición izquierda. "
         "El marcador de texto gris en el encabezado indica el espacio reservado."),
        (f"Fuente '{rules.font}'",
         f"{'INSTALADA en este sistema.' if font_name == rules.font else f'NO instalada — se usa {font_name} como fallback. Instalar Agfa Rotis Sans Serif y regenerar la plantilla.'} "),
        ("Estilos H4–H9",
         "Los tamaños H4–H9 usan valores por defecto (12pt, 11pt, 10pt). "
         "Verificar contra documentos históricos si se usan estos niveles."),
    ]
    for titulo, desc in ajustes:
        ap = doc.add_paragraph()
        ap.style = "Normal"
        r_t = ap.add_run(f"• {titulo}: ")
        r_t.font.bold = True
        r_t.font.name = font_name
        r_t.font.size = Pt(11)
        r_d = ap.add_run(desc)
        r_d.font.name = font_name
        r_d.font.size = Pt(11)

    # ═══════════════════════════════════════════════════════
    # 7. GUARDAR
    # ═══════════════════════════════════════════════════════
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(output_path))

    return output_path, font_name, font_used_note


def _fill_demo_table(table, headers, rows, rules: LayoutRules, font_name: str):
    """Rellena una tabla de demostración con estilos Polarier."""
    # Encabezado
    hrow = table.rows[0]
    for ci, hdr in enumerate(headers):
        cell = hrow.cells[ci]
        _set_cell_bg(cell, rules.table_header_color)
        _set_cell_borders(cell)
        para = cell.paragraphs[0]
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = para.add_run(str(hdr))
        run.font.name = font_name
        run.font.size = Pt(9)
        run.font.bold = True
    # Datos
    for ri, row_data in enumerate(rows):
        drow = table.rows[ri + 1]
        for ci, val in enumerate(row_data):
            cell = drow.cells[ci]
            _set_cell_borders(cell)
            para = cell.paragraphs[0]
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = para.add_run(str(val))
            run.font.name = font_name
            run.font.size = Pt(9)
            # Color de fondo para la fila de muestra de colores (col 1 = hex del color)
            if len(row_data) >= 2 and ci == 1 and str(val).startswith("#"):
                hex_val = str(val).lstrip("#")
                if len(hex_val) == 6:
                    try:
                        _set_cell_bg(cell, hex_val)
                    except Exception:
                        pass


def _add_header_border(paragraph):
    """Añade línea separadora inferior al párrafo del encabezado."""
    try:
        pPr = paragraph._p.get_or_add_pPr()
        pBdr = OxmlElement("w:pBdr")
        bottom = OxmlElement("w:bottom")
        bottom.set(qn("w:val"), "single")
        bottom.set(qn("w:sz"), "4")
        bottom.set(qn("w:space"), "1")
        bottom.set(qn("w:color"), "DD990D")  # línea naranja corporativa
        pBdr.append(bottom)
        pPr.append(pBdr)
    except Exception:
        pass


# ─────────────────────────────────────────────────────────
# Constructor de tabla con estilos Polarier
# ─────────────────────────────────────────────────────────

def add_styled_table(
    doc: "Document",
    headers: List[str],
    rows: List[List[str]],
    totals_row: Optional[List[str]] = None,
    subheaders: Optional[List[str]] = None,
    compact: bool = False,
) -> "Table":
    """
    Inserta una tabla con los estilos exactos de Polarier.

    headers      — primera fila: fondo #F4BC46, negrita
    subheaders   — segunda fila opcional: fondo #C9D0EF
    rows         — filas de datos: fondo #FFFFFF
    totals_row   — fila final opcional: fondo #A6A6A6, negrita
    compact      — usa 8pt en lugar de 9pt
    """
    if not DOCX_AVAILABLE:
        raise ImportError("python-docx no instalado.")

    rules = LayoutRules()
    font_name = rules.fallback_font
    font_size = Pt(8) if compact else Pt(9)

    all_rows = [headers]
    if subheaders:
        all_rows.append(subheaders)
    all_rows.extend(rows)
    if totals_row:
        all_rows.append(totals_row)

    num_cols = len(headers)
    table = doc.add_table(rows=len(all_rows), cols=num_cols)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER

    for row_idx, row_data in enumerate(all_rows):
        row = table.rows[row_idx]
        is_header = row_idx == 0
        is_subheader = (subheaders is not None) and row_idx == 1
        is_total = totals_row is not None and row_idx == len(all_rows) - 1

        for col_idx, cell_text in enumerate(row_data):
            if col_idx >= num_cols:
                break
            cell = row.cells[col_idx]

            # Fondo de celda
            if is_header:
                _set_cell_bg(cell, rules.table_header_color)
            elif is_subheader:
                _set_cell_bg(cell, rules.table_subheader_color)
            elif is_total:
                _set_cell_bg(cell, rules.table_total_color)

            # Bordes
            _set_cell_borders(cell)

            # Texto
            para = cell.paragraphs[0]
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = para.add_run(str(cell_text))
            run.font.name = font_name
            run.font.size = font_size
            run.font.bold = is_header or is_total

            # Color semántico en celdas de datos
            if not is_header and not is_subheader and not is_total:
                _apply_semantic_color(run, str(cell_text))

    return table


def _apply_semantic_color(run, text: str):
    """
    Aplica color semántico a un run de texto de tabla:
    - Positivo (%) → verde #006100
    - Negativo → rojo #9C0006
    - Crítico (marcado con !) → rojo #FF0000
    """
    text_stripped = text.strip()
    if text_stripped.startswith("!"):
        run.font.color.rgb = RGBColor.from_string(COLOR_TEXT_CRITICAL)
    elif text_stripped.startswith("-") or (
        "%" in text_stripped and _extract_numeric(text_stripped) < 0
    ):
        run.font.color.rgb = RGBColor.from_string(COLOR_TEXT_ERROR)
    elif "%" in text_stripped and _extract_numeric(text_stripped) > 100:
        run.font.color.rgb = RGBColor.from_string(COLOR_TEXT_OK)


def _extract_numeric(text: str) -> float:
    """Extrae el primer número de un texto."""
    match = re.search(r"-?\d+(?:[.,]\d+)?", text)
    if match:
        try:
            return float(match.group().replace(",", "."))
        except ValueError:
            pass
    return 0.0


# ─────────────────────────────────────────────────────────
# Constructor del DOCX final
# ─────────────────────────────────────────────────────────

def build_report_docx(
    report_md_path: Path,
    month: str,
    table_data: Optional[List[Dict]] = None,
) -> Path:
    """
    Genera el DOCX final del informe a partir del Markdown aprobado.
    Aplica todos los estilos de config/layout_rules.yaml.
    """
    if not DOCX_AVAILABLE:
        raise ImportError("python-docx no instalado. Ejecutar: pip install python-docx")

    if not TEMPLATE_PATH.exists():
        print("[INFO] Template no existe. Generando template base...")
        build_base_template()

    doc = Document(str(TEMPLATE_PATH))
    rules = LayoutRules()

    report_text = report_md_path.read_text(encoding="utf-8")
    lines = report_text.splitlines()

    for line in lines:
        if line.startswith("# "):
            p = doc.add_heading(line[2:].strip(), level=1)
            _apply_heading_format(p, 1, rules)
        elif line.startswith("## "):
            p = doc.add_heading(line[3:].strip(), level=2)
            _apply_heading_format(p, 2, rules)
        elif line.startswith("### "):
            p = doc.add_heading(line[4:].strip(), level=3)
            _apply_heading_format(p, 3, rules)
        elif line.startswith("<!--") or line.startswith(">"):
            pass  # omitir comentarios HTML y citas de instrucciones
        elif line.strip() == "---":
            doc.add_paragraph()
        elif line.strip():
            p = doc.add_paragraph(line.strip())
            p.style = "Normal"
            for run in p.runs:
                run.font.name = rules.fallback_font
                run.font.size = Pt(12)
        else:
            doc.add_paragraph()

    _update_header(doc, month)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    month_slug = month.replace("-", "")
    out_path = OUTPUT_DIR / f"informe_{month_slug}.docx"
    doc.save(str(out_path))
    print(f"[OK] DOCX generado: {out_path}")
    return out_path


def _apply_heading_format(paragraph, level: int, rules: LayoutRules):
    """Refuerza el formato de un heading ya añadido al documento."""
    for run in paragraph.runs:
        run.font.name = rules.fallback_font
        run.font.color.rgb = RGBColor.from_string(rules.heading_color)
        size = rules.heading_size(level)
        if size:
            run.font.size = Pt(size)


def _update_header(doc: "Document", month: str):
    """Actualiza el texto del encabezado con el mes del informe."""
    for section in doc.sections:
        try:
            for para in section.header.paragraphs:
                for run in para.runs:
                    if "{MES}" in run.text or "{AÑO}" in run.text:
                        parts = month.split("-")
                        mes_num = int(parts[1]) if len(parts) > 1 else 0
                        meses = ["", "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
                                  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"]
                        mes_str = meses[mes_num] if 1 <= mes_num <= 12 else parts[1]
                        anio_str = parts[0] if parts else ""
                        run.text = run.text.replace("{MES}", mes_str).replace("{AÑO}", anio_str)
        except Exception:
            pass


# ─────────────────────────────────────────────────────────
# Auditoría visual
# ─────────────────────────────────────────────────────────

def audit_visual(docx_path: Path, month: str) -> Tuple[bool, List[Dict]]:
    """
    Verifica que el DOCX generado cumple las reglas visuales de Polarier.
    Devuelve (passed: bool, issues: List[Dict]).
    """
    if not DOCX_AVAILABLE or not docx_path.exists():
        return False, [{"type": "file_missing", "severity": "error",
                        "description": f"DOCX no encontrado: {docx_path}"}]

    issues = []
    doc = Document(str(docx_path))
    rules = LayoutRules()

    # Verificar márgenes
    try:
        section = doc.sections[0]
        EMU_PER_CM = 360000
        m = rules.margins
        for attr, expected in [
            ("top_margin", m["top_cm"]),
            ("bottom_margin", m["bottom_cm"]),
            ("left_margin", m["left_cm"]),
            ("right_margin", m["right_cm"]),
        ]:
            actual = getattr(section, attr) / EMU_PER_CM
            if abs(actual - expected) > 0.05:
                issues.append({
                    "type": "margin_mismatch",
                    "severity": "advertencia",
                    "description": f"Margen {attr}: esperado {expected} cm, encontrado {round(actual, 2)} cm",
                })
    except Exception:
        pass

    # Verificar color de headings
    heading_color_expected = rules.heading_color.upper()
    for para in doc.paragraphs:
        if para.style.name.startswith("Heading"):
            for run in para.runs:
                try:
                    actual_color = str(run.font.color.rgb).upper() if run.font.color.rgb else None
                    if actual_color and actual_color != heading_color_expected:
                        issues.append({
                            "type": "heading_color_mismatch",
                            "severity": "advertencia",
                            "description": f"Heading con color {actual_color} en lugar de #{heading_color_expected}: '{para.text[:40]}'",
                        })
                        break
                except Exception:
                    pass

    # Verificar tablas
    for i, table in enumerate(doc.tables):
        if table.rows:
            first_row = table.rows[0]
            for cell in first_row.cells:
                bg = _get_cell_bg(cell)
                expected = rules.table_header_color.upper()
                if bg and bg.upper() != expected:
                    issues.append({
                        "type": "table_header_color_mismatch",
                        "severity": "advertencia",
                        "description": f"Tabla {i+1}: encabezado con color #{bg} en lugar de #{expected}",
                    })
                    break

    passed = not any(i["severity"] == "error" for i in issues)

    # Guardar auditoría
    audit_data = {
        "month": month,
        "docx_path": str(docx_path),
        "passed": passed,
        "issues": issues,
        "manual_adjustments_required": [
            "Verificar logo Polarier PNG en encabezado",
            "Verificar fuente Agfa Rotis Sans Serif (o aprobar fallback Arial)",
        ],
    }
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    month_slug = month.replace("-", "")
    audit_path = PROCESSED_DIR / f"visual_audit_{month_slug}.json"
    with open(audit_path, "w", encoding="utf-8") as f:
        json.dump(audit_data, f, ensure_ascii=False, indent=2)
    print(f"[OK] Auditoría visual guardada: {audit_path}")

    return passed, issues


def _get_cell_bg(cell) -> Optional[str]:
    """Lee el color de fondo de una celda."""
    try:
        shd = cell._tc.find(qn("w:shd"))
        if shd is not None:
            fill = shd.get(qn("w:fill"))
            if fill and fill != "auto":
                return fill.upper()
    except Exception:
        pass
    return None

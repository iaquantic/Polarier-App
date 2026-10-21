"""
[DESACTIVADO — no usar en flujo activo de generación mensual]

Este módulo extrae elementos de diseño visual de los DOCX y PDF históricos.
Fue usado para construir config/layout_rules.yaml en la fase de discovery inicial.

A partir del cambio de arquitectura (2026-05), el sistema usa plantilla maestra DOCX
(templates/master/consejo_direccion_master.docx) en lugar de generación dinámica de estilos.
layout_rules.yaml ahora contiene solo 4 claves de control del flujo de clonado.

Este módulo se conserva como referencia histórica. No importar desde main.py ni agentes.
"""

from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from collections import Counter
import re

try:
    from docx import Document as DocxDocument
    from docx.shared import Pt, Cm, RGBColor
    from docx.oxml.ns import qn
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False

try:
    import fitz  # PyMuPDF
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False


# ─────────────────────────────────────────────────────────
# Estructuras de datos
# ─────────────────────────────────────────────────────────

@dataclass
class PageConfig:
    width_cm: float
    height_cm: float
    margin_top_cm: float
    margin_bottom_cm: float
    margin_left_cm: float
    margin_right_cm: float


@dataclass
class FontUsage:
    font_name: str
    size_pt: float
    color_hex: str
    bold: bool
    count: int


@dataclass
class TableCellStyle:
    background_hex: Optional[str]
    text_color_hex: str
    bold: bool
    font_size_pt: float
    alignment: str


@dataclass
class HeadingStyle:
    level: int
    name: str
    font: str
    size_pt: Optional[float]
    color_hex: str
    bold: bool
    space_before_pt: float
    space_after_pt: float


@dataclass
class DocxLayoutResult:
    source_file: str
    page_config: Optional[PageConfig] = None
    font_usage: List[FontUsage] = field(default_factory=list)
    heading_styles: List[HeadingStyle] = field(default_factory=list)
    table_cell_colors: Dict[str, int] = field(default_factory=dict)
    header_text: str = ""
    footer_text: str = ""
    table_count: int = 0
    alignment_counts: Dict[str, int] = field(default_factory=dict)


@dataclass
class PdfLayoutResult:
    source_file: str
    page_width_pt: float = 0.0
    page_height_pt: float = 0.0
    text_colors: Dict[str, int] = field(default_factory=dict)
    background_colors: Dict[str, int] = field(default_factory=dict)
    font_sizes: Dict[float, int] = field(default_factory=dict)


# ─────────────────────────────────────────────────────────
# Extracción desde DOCX
# ─────────────────────────────────────────────────────────

def _rgb_to_hex(r: int, g: int, b: int) -> str:
    return f"#{r:02X}{g:02X}{b:02X}"


def _element_color_hex(element) -> Optional[str]:
    """Extrae color de un elemento XML de python-docx como hex string."""
    try:
        color_elem = element.find(qn("w:color"))
        if color_elem is not None:
            val = color_elem.get(qn("w:val"))
            if val and val != "auto" and len(val) == 6:
                return f"#{val.upper()}"
    except Exception:
        pass
    return None


def _cell_bg_hex(cell) -> Optional[str]:
    """Extrae el color de fondo de una celda de tabla."""
    try:
        shd = cell._tc.find(qn("w:shd"))
        if shd is not None:
            fill = shd.get(qn("w:fill"))
            if fill and fill != "auto" and len(fill) == 6:
                return f"#{fill.upper()}"
    except Exception:
        pass
    return None


def extract_docx_layout(docx_path: Path) -> DocxLayoutResult:
    """Extrae todos los elementos de diseño visual de un DOCX."""
    if not DOCX_AVAILABLE:
        raise ImportError("python-docx no instalado. Ejecutar: pip install python-docx")

    doc = DocxDocument(str(docx_path))
    result = DocxLayoutResult(source_file=docx_path.name)

    # ── Configuración de página ──────────────────────────────
    try:
        section = doc.sections[0]
        EMU_PER_CM = 360000
        result.page_config = PageConfig(
            width_cm=section.page_width / EMU_PER_CM,
            height_cm=section.page_height / EMU_PER_CM,
            margin_top_cm=section.top_margin / EMU_PER_CM,
            margin_bottom_cm=section.bottom_margin / EMU_PER_CM,
            margin_left_cm=section.left_margin / EMU_PER_CM,
            margin_right_cm=section.right_margin / EMU_PER_CM,
        )
    except Exception:
        pass

    # ── Estilos de encabezado ────────────────────────────────
    for style in doc.styles:
        if style.type.name == "PARAGRAPH" and style.name.lower().startswith("heading"):
            try:
                level_match = re.search(r"\d+", style.name)
                level = int(level_match.group()) if level_match else 0
                font = style.font
                color_hex = "#000000"
                if font.color and font.color.rgb:
                    r, g, b = font.color.rgb
                    color_hex = _rgb_to_hex(r, g, b)
                size_pt = float(font.size.pt) if font.size else None
                space_before = 0.0
                space_after = 0.0
                if style.paragraph_format.space_before:
                    space_before = style.paragraph_format.space_before.pt
                if style.paragraph_format.space_after:
                    space_after = style.paragraph_format.space_after.pt

                result.heading_styles.append(HeadingStyle(
                    level=level,
                    name=style.name,
                    font=font.name or "Agfa Rotis Sans Serif",
                    size_pt=size_pt,
                    color_hex=color_hex,
                    bold=bool(font.bold),
                    space_before_pt=space_before,
                    space_after_pt=space_after,
                ))
            except Exception:
                pass

    # ── Uso de fuentes y colores en runs ────────────────────
    font_counter: Counter = Counter()
    color_counter: Counter = Counter()
    align_counter: Counter = Counter()

    for para in doc.paragraphs:
        align = para.alignment.name if para.alignment else "LEFT"
        align_counter[align] += 1
        for run in para.runs:
            fname = run.font.name or "unknown"
            fsize = run.font.size.pt if run.font.size else 0.0
            fbold = bool(run.font.bold)
            fcolor = "#000000"
            if run.font.color and run.font.color.type:
                try:
                    r, g, b = run.font.color.rgb
                    fcolor = _rgb_to_hex(r, g, b)
                except Exception:
                    pass
            key = (fname, round(fsize, 1), fcolor, fbold)
            font_counter[key] += 1
            color_counter[fcolor] += 1

    result.font_usage = [
        FontUsage(
            font_name=k[0], size_pt=k[1], color_hex=k[2], bold=k[3], count=v
        )
        for k, v in font_counter.most_common(20)
    ]
    result.alignment_counts = dict(align_counter)

    # ── Colores de celdas de tabla ────────────────────────────
    cell_color_counter: Counter = Counter()
    for table in doc.tables:
        result.table_count += 1
        for row in table.rows:
            for cell in row.cells:
                bg = _cell_bg_hex(cell)
                if bg:
                    cell_color_counter[bg] += 1

    result.table_cell_colors = dict(cell_color_counter.most_common(10))

    # ── Encabezado y pie de página ────────────────────────────
    try:
        for section in doc.sections:
            if section.header:
                texts = [p.text for p in section.header.paragraphs if p.text.strip()]
                result.header_text = " | ".join(texts)
            if section.footer:
                texts = [p.text for p in section.footer.paragraphs if p.text.strip()]
                result.footer_text = " | ".join(texts)
    except Exception:
        pass

    return result


# ─────────────────────────────────────────────────────────
# Extracción desde PDF
# ─────────────────────────────────────────────────────────

def extract_pdf_layout(pdf_path: Path) -> PdfLayoutResult:
    """Extrae colores, tamaños de fuente y dimensiones de página de un PDF."""
    if not PDF_AVAILABLE:
        raise ImportError("PyMuPDF no instalado. Ejecutar: pip install pymupdf")

    doc = fitz.open(str(pdf_path))
    result = PdfLayoutResult(source_file=pdf_path.name)

    if doc.page_count > 0:
        page = doc[0]
        result.page_width_pt = page.rect.width
        result.page_height_pt = page.rect.height

    text_color_counter: Counter = Counter()
    bg_color_counter: Counter = Counter()
    font_size_counter: Counter = Counter()

    for page in doc:
        # Colores de texto y tamaños de fuente
        blocks = page.get_text("dict")["blocks"]
        for block in blocks:
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    size = round(span.get("size", 0), 1)
                    color_int = span.get("color", 0)
                    r = (color_int >> 16) & 0xFF
                    g = (color_int >> 8) & 0xFF
                    b = color_int & 0xFF
                    color_hex = _rgb_to_hex(r, g, b)
                    if span.get("text", "").strip():
                        text_color_counter[color_hex] += 1
                        font_size_counter[size] += 1

        # Colores de fondo de rectángulos (tablas)
        drawings = page.get_drawings()
        for d in drawings:
            fill = d.get("fill")
            if fill and fill != (1.0, 1.0, 1.0):
                try:
                    r, g, b = int(fill[0] * 255), int(fill[1] * 255), int(fill[2] * 255)
                    bg_color_counter[_rgb_to_hex(r, g, b)] += 1
                except Exception:
                    pass

    doc.close()
    result.text_colors = dict(text_color_counter.most_common(10))
    result.background_colors = dict(bg_color_counter.most_common(10))
    result.font_sizes = dict(font_size_counter.most_common(10))

    return result


# ─────────────────────────────────────────────────────────
# Síntesis en layout_rules.yaml
# ─────────────────────────────────────────────────────────

def synthesize_layout_rules(
    docx_results: List[DocxLayoutResult],
    pdf_results: List[PdfLayoutResult],
) -> dict:
    """
    Combina los resultados de extracción de múltiples documentos
    y produce el dict que se guardará en config/layout_rules.yaml.
    """
    from datetime import date

    if not docx_results:
        return {}

    primary = docx_results[0]
    pc = primary.page_config

    # Fuente más usada
    all_fonts: Counter = Counter()
    for r in docx_results:
        for fu in r.font_usage:
            all_fonts[fu.font_name] += fu.count
    dominant_font = all_fonts.most_common(1)[0][0] if all_fonts else "Agfa Rotis Sans Serif"

    # Colores de celdas consolidados
    all_cell_colors: Counter = Counter()
    for r in docx_results:
        for color, count in r.table_cell_colors.items():
            all_cell_colors[color] += count

    # Headings del primero (más fiable)
    headings_list = []
    for h in sorted(primary.heading_styles, key=lambda x: x.level):
        headings_list.append({
            "level": h.level,
            "name": h.name,
            "font": h.font or dominant_font,
            "size_pt": h.size_pt,
            "color": h.color_hex,
            "bold": h.bold,
            "space_before_pt": h.space_before_pt,
            "space_after_pt": h.space_after_pt,
            "alignment": "left",
        })

    return {
        "metadata": {
            "extracted_from": [r.source_file for r in docx_results],
            "extraction_date": date.today().isoformat(),
        },
        "page": {
            "size": "A4",
            "width_cm": round(pc.width_cm, 2) if pc else 21.59,
            "height_cm": round(pc.height_cm, 2) if pc else 27.94,
            "margins": {
                "top_cm": round(pc.margin_top_cm, 2) if pc else 3.00,
                "bottom_cm": round(pc.margin_bottom_cm, 2) if pc else 2.50,
                "left_cm": round(pc.margin_left_cm, 2) if pc else 2.20,
                "right_cm": round(pc.margin_right_cm, 2) if pc else 1.50,
            },
        },
        "typography": {
            "primary_font": dominant_font,
            "fallback_fonts": ["Arial", "Calibri"],
        },
        "heading_styles": headings_list,
        "colors": {
            "text_primary": "#000000",
            "text_heading": "#DD990D",
            "text_error": "#9C0006",
            "text_ok": "#006100",
            "text_highlight": "#FF0000",
            "table_header_primary": "#F4BC46",
            "table_header_secondary": "#C9D0EF",
            "table_separator": "#A6A6A6",
            "table_body": "#FFFFFF",
        },
        "header_footer": {
            "header": {
                "content_template": "Informe consolidado {MES} {AÑO}",
                "text": primary.header_text,
                "font_size_pt": 9.0,
                "alignment": "center",
                "has_logo": True,
            },
            "footer": {
                "content_template": "Página | {numero_pagina}",
                "text": primary.footer_text,
                "font_size_pt": 9.0,
                "alignment": "center",
            },
        },
        "tables": {
            "count_per_report": max(r.table_count for r in docx_results) if docx_results else 40,
            "font": dominant_font,
            "font_size_pt": 9.0,
            "cell_colors_found": dict(all_cell_colors.most_common(6)),
        },
    }

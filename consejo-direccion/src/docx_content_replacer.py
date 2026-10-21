"""
Reemplaza contenido textual en el DOCX de salida preservando el formato original.

Jerarquía de marcadores (aplicados en este orden):

  1. Metadatos simples  {MES}, {AÑO}
     Dentro de un run de texto. Reemplazo directo preservando formato del run.

  2. Marcadores granulares de análisis  {ANALISIS_*}
     El marcador ocupa un párrafo completo. Se reemplaza por uno o varios
     párrafos de texto narrativo, preservando el estilo del párrafo marcador.
     Si no hay texto disponible, se inserta el fallback del marker_mapping.

  3. Marcadores de sección  {SECCION_*}
     FALLBACK: solo se usan si no existen marcadores granulares para esa sección
     en la plantilla. Reemplazan un párrafo completo por un bloque que puede
     contener textos + tablas.

Regla absoluta: nunca se tocan estilos, fuentes, colores, bordes ni anchos.
Solo se modifica texto y se insertan/eliminan nodos XML del párrafo marcador.
"""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Dict, List, Optional

import yaml
from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph


MARKER_MAPPING_PATH = Path("config/marker_mapping.yaml")
DEFAULT_ANALYSIS_FALLBACK = "[análisis no disponible — requiere revisión]"

# ─────────────────────────────────────────────────────────────────
# Marcadores de sección (fallback)
# ─────────────────────────────────────────────────────────────────

SECTION_PLACEHOLDERS = {
    "economia":           "{SECCION_ECONOMIA}",
    "produccion":         "{SECCION_PRODUCCION}",
    "lenceria":           "{SECCION_LENCERIA}",
    "servicios_tecnicos": "{SECCION_SERVICIOS_TECNICOS}",
    "transporte":         "{SECCION_TRANSPORTE}",
    "calidad":            "{SECCION_CALIDAD}",
    "rrhh":               "{SECCION_RRHH}",
    "valoracion":         "{SECCION_VALORACION}",
    "riesgos":            "{SECCION_RIESGOS}",
    "conclusiones":       "{SECCION_CONCLUSIONES}",
}

ALL_SECTION_MARKERS = set(SECTION_PLACEHOLDERS.values())

PLACEHOLDER_MES = "{MES}"
PLACEHOLDER_AÑO = "{AÑO}"


# ─────────────────────────────────────────────────────────────────
# Carga del mapa de marcadores de análisis
# ─────────────────────────────────────────────────────────────────

def _load_analysis_markers() -> Dict[str, dict]:
    """
    Retorna {marcador → entry} para todos los marcadores tipo "analisis"
    de config/marker_mapping.yaml.
    """
    if not MARKER_MAPPING_PATH.exists():
        return {}
    with open(MARKER_MAPPING_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}

    result: Dict[str, dict] = {}
    for section_key, section_data in data.items():
        if not isinstance(section_data, dict) or "markers" not in section_data:
            continue
        for entry in section_data["markers"]:
            if entry.get("type") == "analisis":
                result[entry["marker"]] = entry
    return result


# ─────────────────────────────────────────────────────────────────
# SectionBlock — representa el contenido completo de una sección
# (usado por el fallback {SECCION_*})
# ─────────────────────────────────────────────────────────────────

class SectionBlock:
    """
    Bloque de contenido mixto (textos + tablas) para marcadores {SECCION_*}.

    items = [
        ("text",  "Análisis del período..."),
        ("table", {"rows": [...], "header_rows": 1}),
    ]
    El orden en items determina el orden de inserción.
    """

    def __init__(self):
        self.items: List[tuple] = []

    def add_text(self, text: str) -> "SectionBlock":
        if text and text.strip():
            self.items.append(("text", text.strip()))
        return self

    def add_table(self, rows: List[List[str]], header_rows: int = 1) -> "SectionBlock":
        if rows:
            self.items.append(("table", {"rows": rows, "header_rows": header_rows}))
        return self

    def add_texts(self, texts: List[str]) -> "SectionBlock":
        for t in texts:
            self.add_text(t)
        return self

    def add_tables(self, tables: List[List[List[str]]], header_rows: int = 1) -> "SectionBlock":
        for t in tables:
            self.add_table(t, header_rows)
        return self

    @property
    def is_empty(self) -> bool:
        return not self.items


# ─────────────────────────────────────────────────────────────────
# Utilidades de párrafo
# ─────────────────────────────────────────────────────────────────

def _paragraph_full_text(paragraph: Paragraph) -> str:
    return "".join(r.text or "" for r in paragraph.runs)


def _get_paragraph_style(p_elem) -> Optional[str]:
    pPr = p_elem.find(qn("w:pPr"))
    if pPr is not None:
        pStyle = pPr.find(qn("w:pStyle"))
        if pStyle is not None:
            return pStyle.get(qn("w:val"))
    return None


def _replace_in_paragraph_simple(paragraph: Paragraph, replacements: Dict[str, str]) -> int:
    """Reemplaza marcadores simples run a run, maneja marcadores partidos."""
    changes = 0
    for run in paragraph.runs:
        for old, new in replacements.items():
            if old in (run.text or ""):
                run.text = run.text.replace(old, new)
                changes += 1

    full_text = _paragraph_full_text(paragraph)
    if any(old in full_text for old in replacements):
        rebuilt = full_text
        for old, new in replacements.items():
            rebuilt = rebuilt.replace(old, new)
        if rebuilt != full_text and paragraph.runs:
            paragraph.runs[0].text = rebuilt
            for run in paragraph.runs[1:]:
                run.text = ""
            changes += 1

    return changes


def _replace_in_table_simple(table, replacements: Dict[str, str]) -> int:
    changes = 0
    for row in table.rows:
        for cell in row.cells:
            for paragraph in cell.paragraphs:
                changes += _replace_in_paragraph_simple(paragraph, replacements)
    return changes


def _replace_in_header_footer(document: Document, replacements: Dict[str, str]) -> int:
    """Reemplaza en headers/footers incluyendo cuadros de texto anidados (w:txbxContent)."""
    changes = 0
    W_T = qn("w:t")
    for section in document.sections:
        for hf in (section.header, section.footer):
            if hf is None:
                continue
            # Iterar todos los w:t del elemento raíz del header/footer,
            # capturando también los que están dentro de w:txbxContent (cuadros de texto).
            for t_elem in hf._element.iter(W_T):
                if not t_elem.text:
                    continue
                new_text = t_elem.text
                for old, new in replacements.items():
                    if old in new_text:
                        new_text = new_text.replace(old, new)
                if new_text != t_elem.text:
                    t_elem.text = new_text
                    changes += 1
    return changes


# ─────────────────────────────────────────────────────────────────
# Construcción de elementos XML
# ─────────────────────────────────────────────────────────────────

def _make_paragraph_xml(text: str, style_name: Optional[str] = None):
    p = OxmlElement("w:p")
    if style_name:
        pPr = OxmlElement("w:pPr")
        pStyle = OxmlElement("w:pStyle")
        pStyle.set(qn("w:val"), style_name)
        pPr.append(pStyle)
        p.append(pPr)
    r = OxmlElement("w:r")
    t = OxmlElement("w:t")
    t.text = text
    if text.startswith(" ") or text.endswith(" "):
        t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    r.append(t)
    p.append(r)
    return p


def _make_table_xml(rows: List[List[str]]):
    tbl = OxmlElement("w:tbl")
    tblPr = OxmlElement("w:tblPr")
    tblStyle = OxmlElement("w:tblStyle")
    tblStyle.set(qn("w:val"), "TableGrid")
    tblPr.append(tblStyle)
    tblW = OxmlElement("w:tblW")
    tblW.set(qn("w:w"), "0")
    tblW.set(qn("w:type"), "auto")
    tblPr.append(tblW)
    tbl.append(tblPr)
    for row_data in rows:
        tr = OxmlElement("w:tr")
        for cell_text in row_data:
            tc = OxmlElement("w:tc")
            p = _make_paragraph_xml(str(cell_text))
            tc.append(p)
            tr.append(tc)
        tbl.append(tr)
    return tbl


# ─────────────────────────────────────────────────────────────────
# Detección de marcadores de párrafo completo
# ─────────────────────────────────────────────────────────────────

def _detect_paragraph_marker(paragraph: Paragraph, known_markers: set) -> Optional[str]:
    """
    Retorna el marcador si el párrafo completo (sin espacios extra) es exactamente
    un marcador conocido. Acepta {ANALISIS_*} y {SECCION_*}.
    """
    text = _paragraph_full_text(paragraph).strip()
    if text in known_markers:
        return text
    # También acepta marcadores {ANALISIS_*} no registrados
    if (text.startswith("{ANALISIS_") or text.startswith("{SECCION_")) and text.endswith("}"):
        return text
    return None


# ─────────────────────────────────────────────────────────────────
# Reemplazo de marcadores {ANALISIS_*}
# ─────────────────────────────────────────────────────────────────

def replace_analysis_markers(
    docx_path: Path,
    analysis_texts: Dict[str, str],
) -> dict:
    """
    Busca marcadores {ANALISIS_*} en el documento y los reemplaza por el
    texto de análisis correspondiente.

    El marcador debe ocupar un párrafo completo. Se elimina y se insertan
    uno o varios párrafos con el texto, preservando el estilo del marcador.

    Si analysis_texts no contiene el marcador, se inserta el fallback del
    marker_mapping (o el fallback por defecto).

    Args:
        docx_path:      Ruta al DOCX clonado.
        analysis_texts: Mapa {marcador → texto}.
                        Ej: {"{ANALISIS_INGRESOS}": "En el período...", ...}
                        El texto puede contener saltos de línea (\n) para
                        generar múltiples párrafos.

    Returns:
        {
          "replaced":   N,  # marcadores reemplazados con texto real
          "fallback":   M,  # marcadores reemplazados con texto de fallback
          "not_found":  [...],  # marcadores en analysis_texts sin match en doc
          "unreplaced": [...],  # marcadores {ANALISIS_*} en doc sin texto
        }
    """
    marker_mapping = _load_analysis_markers()
    known_markers = set(marker_mapping.keys()) | set(analysis_texts.keys())

    doc = Document(str(docx_path))
    body = doc.element.body
    paragraphs_snapshot = list(body.iter(qn("w:p")))

    replaced = 0
    fallback_count = 0
    found_in_doc: set = set()

    for p_elem in paragraphs_snapshot:
        para = Paragraph(p_elem, doc)
        marker = _detect_paragraph_marker(para, known_markers)
        if not marker:
            continue
        # Solo procesar marcadores {ANALISIS_*} en esta función
        if not (marker.startswith("{ANALISIS_") and marker.endswith("}")):
            continue

        found_in_doc.add(marker)
        parent = p_elem.getparent()
        if parent is None:
            continue

        style_val = _get_paragraph_style(p_elem)

        if marker in analysis_texts and analysis_texts[marker]:
            raw_text = analysis_texts[marker]
            # Soportar texto con saltos de línea → múltiples párrafos
            lines = [l for l in raw_text.split("\n") if l.strip()]
            # Insertar en orden inverso (addnext inserta justo después del marcador)
            for line in reversed(lines):
                new_p = _make_paragraph_xml(line, style_name=style_val)
                p_elem.addnext(new_p)
            parent.remove(p_elem)
            replaced += 1
        else:
            fallback_text = (
                marker_mapping.get(marker, {}).get("fallback")
                or DEFAULT_ANALYSIS_FALLBACK
            )
            fallback_p = _make_paragraph_xml(fallback_text, style_name=style_val)
            p_elem.addnext(fallback_p)
            parent.remove(p_elem)
            fallback_count += 1

    doc.save(str(docx_path))

    not_found = [m for m in analysis_texts if m not in found_in_doc]
    unreplaced = [m for m in found_in_doc if m not in analysis_texts or not analysis_texts[m]]

    return {
        "replaced": replaced,
        "fallback": fallback_count,
        "not_found": not_found,
        "unreplaced": unreplaced,
    }


# ─────────────────────────────────────────────────────────────────
# Reemplazo de marcadores {SECCION_*} — fallback
# ─────────────────────────────────────────────────────────────────

def _insert_block_after_paragraph(
    marker_paragraph: Paragraph,
    block: SectionBlock,
    placeholder_style: Optional[str],
) -> None:
    marker_p = marker_paragraph._p
    parent = marker_p.getparent()
    if parent is None:
        return
    for item_type, item_data in reversed(block.items):
        if item_type == "text":
            new_p = _make_paragraph_xml(str(item_data), style_name=placeholder_style)
            marker_p.addnext(new_p)
        elif item_type == "table":
            new_tbl = _make_table_xml(item_data["rows"])
            marker_p.addnext(new_tbl)
    parent.remove(marker_p)


def replace_section_blocks(
    docx_path: Path,
    section_blocks: Dict[str, SectionBlock],
) -> dict:
    """
    Reemplaza marcadores {SECCION_*} por bloques completos (textos + tablas).

    FALLBACK: solo se debe invocar para secciones cuya plantilla no tiene
    marcadores granulares {TABLA_*} / {ANALISIS_*}.

    Returns:
        {"replaced": N, "not_found": [...]}
    """
    doc = Document(str(docx_path))
    body = doc.element.body
    paragraphs_snapshot = list(body.iter(qn("w:p")))
    replaced = 0
    found_markers: set = set()

    for p_elem in paragraphs_snapshot:
        para = Paragraph(p_elem, doc)
        text = _paragraph_full_text(para).strip()
        if text not in ALL_SECTION_MARKERS or text not in section_blocks:
            continue
        block = section_blocks[text]
        if block.is_empty:
            continue
        style_val = _get_paragraph_style(p_elem)
        _insert_block_after_paragraph(para, block, placeholder_style=style_val)
        found_markers.add(text)
        replaced += 1

    doc.save(str(docx_path))
    not_found = [m for m in section_blocks if m not in found_markers]
    return {"replaced": replaced, "not_found": not_found}


# ─────────────────────────────────────────────────────────────────
# API pública principal
# ─────────────────────────────────────────────────────────────────

def replace_metadata(docx_path: Path, mes: str, año: str) -> int:
    """Reemplaza {MES} y {AÑO} en todo el documento preservando el formato de los runs."""
    return replace_simple(docx_path, {
        PLACEHOLDER_MES: mes.upper(),
        PLACEHOLDER_AÑO: str(año),
    })


def replace_simple(docx_path: Path, replacements: Dict[str, str]) -> int:
    """
    Reemplaza marcadores simples en todo el documento (cuerpo, tablas, encabezado, pie).
    Solo para marcadores que están dentro de runs de texto, no en párrafos completos.
    """
    doc = Document(str(docx_path))
    total = 0
    for paragraph in doc.paragraphs:
        total += _replace_in_paragraph_simple(paragraph, replacements)
    for table in doc.tables:
        total += _replace_in_table_simple(table, replacements)
    total += _replace_in_header_footer(doc, replacements)
    doc.save(str(docx_path))
    return total


def build_section_blocks_from_dict(
    sections_data: Dict[str, dict],
) -> Dict[str, SectionBlock]:
    """
    Construye {marcador_SECCION → SectionBlock} desde un dict de datos.

    Formato:
      {"economia": {"texts": [...], "tables": [[...], ...]}, ...}
    o usando el marcador completo como clave:
      {"{SECCION_ECONOMIA}": {...}}
    """
    result: Dict[str, SectionBlock] = {}
    for key, data in sections_data.items():
        if key.startswith("{") and key in ALL_SECTION_MARKERS:
            marker = key
        elif key.lower() in SECTION_PLACEHOLDERS:
            marker = SECTION_PLACEHOLDERS[key.lower()]
        else:
            continue

        block = SectionBlock()
        texts = data.get("texts") or []
        tables = data.get("tables") or []
        order = data.get("order")

        if order:
            text_list = texts if isinstance(texts, list) else [texts]
            table_list = tables if isinstance(tables, list) else [tables]
            for item_type, idx in order:
                if item_type == "text" and idx < len(text_list):
                    block.add_text(text_list[idx])
                elif item_type == "table" and idx < len(table_list):
                    block.add_table(table_list[idx])
        else:
            if isinstance(texts, str):
                block.add_text(texts)
            else:
                block.add_texts(texts)
            if tables:
                block.add_tables(tables)

        result[marker] = block

    return result

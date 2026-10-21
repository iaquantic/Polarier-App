"""
Reemplaza marcadores {TABLA_*} en el DOCX clonado insertando tablas de datos reales.

Estrategia:
  - La tabla se copia como XML completo desde el DOCX de origen (preserva 100% el
    formato: fuente, colores, bordes, anchos de columna, estilos de celda).
  - Si no se dispone del XML original, se usa fill_table() sobre una tabla nueva
    (modo degradado, solo texto).

Reglas:
  - Nunca se recrean tablas desde cero cuando hay XML disponible.
  - El marcador {TABLA_*} debe ocupar un párrafo completo en la plantilla.
  - Si no hay datos para un marcador: se inserta el texto de fallback.
"""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Dict, List, Optional

import yaml
from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.table import Table, _Row
from docx.text.paragraph import Paragraph


MARKER_MAPPING_PATH = Path("config/marker_mapping.yaml")
DEFAULT_TABLE_FALLBACK = "[tabla no disponible — requiere revisión]"


# ─────────────────────────────────────────────────────────────────
# Carga del mapa de marcadores
# ─────────────────────────────────────────────────────────────────

def _load_table_markers() -> Dict[str, dict]:
    if not MARKER_MAPPING_PATH.exists():
        return {}
    with open(MARKER_MAPPING_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    result: Dict[str, dict] = {}
    for section_key, section_data in data.items():
        if not isinstance(section_data, dict) or "markers" not in section_data:
            continue
        for entry in section_data["markers"]:
            if entry.get("type") == "tabla":
                result[entry["marker"]] = entry
    return result


# ─────────────────────────────────────────────────────────────────
# Utilidades de celda (modo degradado)
# ─────────────────────────────────────────────────────────────────

def _cell_text(cell) -> str:
    return "".join(p.text for p in cell.paragraphs)


def _set_cell_text(cell, text: str) -> None:
    """Sobreescribe el texto de una celda preservando el formato del primer run."""
    for paragraph in cell.paragraphs:
        if not paragraph.runs:
            paragraph.add_run(text)
            return
        paragraph.runs[0].text = text
        for run in paragraph.runs[1:]:
            run.text = ""
        return
    cell.add_paragraph(text)


def _duplicate_row(table: Table, source_row_idx: int) -> _Row:
    source_row = table.rows[source_row_idx]
    new_tr = deepcopy(source_row._tr)
    table._tbl.append(new_tr)
    return table.rows[-1]


def _make_fallback_paragraph_xml(text: str, style_name: Optional[str] = None) -> object:
    p = OxmlElement("w:p")
    if style_name:
        pPr = OxmlElement("w:pPr")
        pStyle = OxmlElement("w:pStyle")
        pStyle.set(qn("w:val"), style_name)
        pPr.append(pStyle)
        p.append(pPr)
    r = OxmlElement("w:r")
    t_el = OxmlElement("w:t")
    t_el.text = text
    r.append(t_el)
    p.append(r)
    return p


# ─────────────────────────────────────────────────────────────────
# Relleno de tabla existente (modo degradado: solo texto, sin XML original)
# ─────────────────────────────────────────────────────────────────

def fill_table(
    table: Table,
    data_rows: List[List[str]],
    header_rows: int = 1,
) -> None:
    """
    Rellena una tabla existente con datos, preservando el formato de celda.
    Solo modifica el texto, nunca los estilos.
    """
    existing_data_rows = len(table.rows) - header_rows
    needed = len(data_rows)
    last_template_data_idx = len(table.rows) - 1

    if needed > existing_data_rows and existing_data_rows > 0:
        for _ in range(needed - existing_data_rows):
            _duplicate_row(table, last_template_data_idx)

    for row_idx, row_data in enumerate(data_rows):
        table_row_idx = header_rows + row_idx
        if table_row_idx >= len(table.rows):
            break
        row = table.rows[table_row_idx]
        for col_idx, value in enumerate(row_data):
            if col_idx >= len(row.cells):
                break
            _set_cell_text(row.cells[col_idx], str(value))

    for spare_idx in range(needed, existing_data_rows):
        table_row_idx = header_rows + spare_idx
        if table_row_idx >= len(table.rows):
            break
        for cell in table.rows[table_row_idx].cells:
            _set_cell_text(cell, "")


# ─────────────────────────────────────────────────────────────────
# Detección de marcadores
# ─────────────────────────────────────────────────────────────────

def _is_table_marker(paragraph: Paragraph, known_markers: set) -> Optional[str]:
    text = "".join(r.text or "" for r in paragraph.runs).strip()
    if text in known_markers:
        return text
    if text.startswith("{TABLA_") and text.endswith("}"):
        return text
    return None


def _get_paragraph_style(p_elem) -> Optional[str]:
    pPr = p_elem.find(qn("w:pPr"))
    if pPr is not None:
        pStyle = pPr.find(qn("w:pStyle"))
        if pStyle is not None:
            return pStyle.get(qn("w:val"))
    return None


# ─────────────────────────────────────────────────────────────────
# API principal: reemplazo con XML completo de tabla original
# ─────────────────────────────────────────────────────────────────

def replace_table_markers(
    docx_path: Path,
    table_data: Dict[str, List[List[str]]],
    header_rows: int = 1,
    source_xml_map: Optional[Dict[str, object]] = None,
) -> dict:
    """
    Reemplaza marcadores {TABLA_*} en el DOCX clonado.

    Modos de inserción (por prioridad):
      1. Si source_xml_map contiene el marcador: inserta el elemento <w:tbl> XML
         completo copiado del DOCX de origen — preserva 100% el formato original.
      2. Si solo hay table_data: construye una tabla nueva desde las filas de texto
         (modo degradado, sin formato).
      3. Sin datos: inserta texto de fallback.

    Args:
        docx_path:       Ruta al DOCX clonado (se modifica en lugar).
        table_data:      Mapa {marcador → filas}. Solo se usa en modo degradado.
        header_rows:     Filas de encabezado en modo degradado.
        source_xml_map:  Mapa {marcador → elemento <w:tbl> XML} del DOCX de origen.
                         Cuando está presente, este modo tiene prioridad absoluta.
    """
    marker_mapping = _load_table_markers()
    known_markers = set(marker_mapping.keys()) | set(table_data.keys())
    if source_xml_map:
        known_markers |= set(source_xml_map.keys())

    doc = Document(str(docx_path))
    body = doc.element.body

    replaced = 0
    fallback_count = 0
    found_in_doc: set = set()

    paragraphs_snapshot = list(body.iter(qn("w:p")))

    for p_elem in paragraphs_snapshot:
        para = Paragraph(p_elem, doc)
        marker = _is_table_marker(para, known_markers)
        if not marker:
            continue

        found_in_doc.add(marker)
        parent = p_elem.getparent()
        if parent is None:
            continue

        style_val = _get_paragraph_style(p_elem)

        # Modo 1: insertar XML original completo
        if source_xml_map and marker in source_xml_map and source_xml_map[marker] is not None:
            tbl_xml = deepcopy(source_xml_map[marker])
            p_elem.addnext(tbl_xml)
            parent.remove(p_elem)
            replaced += 1

        # Modo 2: construir tabla desde filas de texto (degradado)
        elif marker in table_data and table_data[marker]:
            rows = table_data[marker]
            new_tbl = _make_table_from_rows(rows)
            p_elem.addnext(new_tbl)
            parent.remove(p_elem)
            replaced += 1

        # Modo 3: fallback
        else:
            fallback_text = (
                marker_mapping.get(marker, {}).get("fallback")
                or DEFAULT_TABLE_FALLBACK
            )
            fallback_p = _make_fallback_paragraph_xml(fallback_text, style_name=style_val)
            p_elem.addnext(fallback_p)
            parent.remove(p_elem)
            fallback_count += 1

    doc.save(str(docx_path))

    not_found = [m for m in table_data if m not in found_in_doc]
    if source_xml_map:
        not_found += [m for m in source_xml_map if m not in found_in_doc and m not in not_found]
    unreplaced = [m for m in found_in_doc if
                  (not source_xml_map or marker not in source_xml_map) and
                  (m not in table_data or not table_data[m])]

    return {
        "replaced": replaced,
        "fallback": fallback_count,
        "not_found": not_found,
        "unreplaced": unreplaced,
    }


def _make_table_from_rows(rows: List[List[str]]) -> object:
    """
    Construye un <w:tbl> básico desde filas de texto.
    Modo degradado: sin colores ni formato, solo texto.
    """
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

    # tblGrid es obligatorio para que python-docx pueda leer la tabla sin error
    if rows:
        tblGrid = OxmlElement("w:tblGrid")
        for _ in rows[0]:
            gridCol = OxmlElement("w:gridCol")
            gridCol.set(qn("w:w"), "1800")
            tblGrid.append(gridCol)
        tbl.append(tblGrid)

    for row_data in rows:
        tr = OxmlElement("w:tr")
        for cell_text in row_data:
            tc = OxmlElement("w:tc")
            p = OxmlElement("w:p")
            r = OxmlElement("w:r")
            t_el = OxmlElement("w:t")
            t_el.text = str(cell_text)
            if str(cell_text).startswith(" ") or str(cell_text).endswith(" "):
                t_el.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
            r.append(t_el)
            p.append(r)
            tc.append(p)
            tr.append(tc)
        tbl.append(tr)
    return tbl


# ─────────────────────────────────────────────────────────────────
# Extracción de XML de tablas desde el DOCX de origen
# ─────────────────────────────────────────────────────────────────

def extract_table_xml_map(
    source_docx_path: Path,
    subtitle_to_marker: Dict[str, str],
) -> Dict[str, object]:
    """
    Lee el DOCX de origen (el DOCX mensual de entrada) y extrae el elemento
    XML completo (<w:tbl>) de cada tabla, indexado por marcador.

    Args:
        source_docx_path:   Ruta al DOCX mensual (Informe MARZO tablas.docx).
        subtitle_to_marker: Mapa {subtítulo de tabla → marcador}, ej:
                            {"Comportamiento de los ingresos": "{TABLA_INGRESOS}"}

    Returns:
        Mapa {marcador → elemento <w:tbl> XML (deepcopy listo para insertar)}.
    """
    from monthly_docx_ingestion import ingest_monthly_docx

    result_map: Dict[str, object] = {}
    doc = Document(str(source_docx_path))
    ingestion = ingest_monthly_docx(source_docx_path)

    body = doc.element.body
    children = list(body)

    # Construir mapa rápido: posición ordinal de tabla → elemento XML
    table_elems = [c for c in children if c.tag.endswith("}tbl")]

    # Mapear por posición: ExtractedTable.position_index → XML element
    position_to_xml: Dict[int, object] = {}
    valid_count = 0
    for child in children:
        if child.tag.endswith("}tbl"):
            position_to_xml[valid_count] = child
            valid_count += 1

    used_markers: set = set()
    for et in ingestion.tables:
        subtitle = (et.subtitle or "").strip()
        marker = subtitle_to_marker.get(subtitle)
        if marker and marker not in used_markers:
            xml_elem = position_to_xml.get(et.position_index)
            if xml_elem is not None:
                result_map[marker] = deepcopy(xml_elem)
                used_markers.add(marker)

    return result_map


# ─────────────────────────────────────────────────────────────────
# API auxiliar: rellenar tablas existentes (sin marcador)
# ─────────────────────────────────────────────────────────────────

def fill_tables_in_document(
    docx_path: Path,
    table_data_map: dict,
    header_rows: int = 1,
) -> dict:
    doc = Document(str(docx_path))
    filled = 0
    unmatched = 0

    for table_idx, table in enumerate(doc.tables):
        if table_idx in table_data_map:
            fill_table(table, table_data_map[table_idx], header_rows)
            filled += 1
        else:
            if table.rows and table.rows[0].cells:
                header_text = _cell_text(table.rows[0].cells[0]).strip()
                if header_text in table_data_map:
                    fill_table(table, table_data_map[header_text], header_rows)
                    filled += 1
                    continue
            if len(table.rows) > 1 and table.rows[1].cells:
                _set_cell_text(table.rows[1].cells[0], "[requiere revisión]")
            unmatched += 1

    doc.save(str(docx_path))
    return {"filled": filled, "unmatched": unmatched, "total": len(doc.tables)}

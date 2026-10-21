"""
Construye el informe mensual insertando tabla + análisis por cada subsección
que tenga datos en el DOCX de entrada, eliminando las subsecciones vacías.

Estrategia:
  1. Clonar la plantilla maestra.
  2. Reemplazar metadatos ({MES}, {AÑO}).
  3. Recorrer el cuerpo de la plantilla clonada en orden.
     - Para cada par (H3_heading + {TABLA_*} + {ANALISIS_*}):
         a) Si hay tabla real del DOCX de entrada para ese subtítulo:
              - Reemplazar {TABLA_*} con el XML completo copiado del origen.
              - Reemplazar {ANALISIS_*} con el texto generado.
         b) Si NO hay tabla real:
              - Eliminar el H3 heading, el marcador {TABLA_*} y el {ANALISIS_*}.
              - La subsección desaparece completamente del informe.
  4. Para {SECCION_VALORACION}, {SECCION_RIESGOS}, {SECCION_CONCLUSIONES}:
     insertar texto siempre (no dependen de tabla).
  5. Guardar.

Este módulo NO usa marker_mapping.yaml para decidir qué incluir — usa
directamente las tablas disponibles en el DOCX de entrada del mes.
"""

from __future__ import annotations

import re
from copy import deepcopy
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph


# ─── Estilos de heading ──────────────────────────────────────────
_MAIN_SECTION_STYLES = {
    "h1_tema", "heading 1", "título 1", "encabezado 1",
}
_SUBSECTION_STYLES = {
    "h3_encabezado_justificado", "heading 2", "heading 3",
    "título 2", "título 3", "encabezado 2", "encabezado 3",
    "h2_título", "h2_titulo",
}

_MARKER_RE = re.compile(r"^\{([A-Z_0-9]+)\}$")


def _style_lower(para: Paragraph) -> str:
    return (para.style.name or "").lower()


def _is_main_heading(para: Paragraph) -> bool:
    return _style_lower(para) in _MAIN_SECTION_STYLES


def _is_sub_heading(para: Paragraph) -> bool:
    return _style_lower(para) in _SUBSECTION_STYLES


def _marker_name(para: Paragraph) -> Optional[str]:
    """Retorna el nombre del marcador si el párrafo es solo {MARKER}, o None."""
    text = "".join(r.text or "" for r in para.runs).strip()
    if not text:
        text = para.text.strip()
    m = _MARKER_RE.match(text)
    return m.group(1) if m else None


def _insert_xml_after(anchor_elem, new_elem) -> None:
    """Inserta new_elem inmediatamente después de anchor_elem en su parent."""
    anchor_elem.addnext(new_elem)


def _remove_elem(elem) -> None:
    parent = elem.getparent()
    if parent is not None:
        parent.remove(elem)


def _make_bold_rPr(orig_rPr) -> object:
    """Devuelve una copia de orig_rPr con <w:b/> y <w:bCs/> añadidos."""
    rPr = deepcopy(orig_rPr) if orig_rPr is not None else OxmlElement("w:rPr")
    # Eliminar elementos b/bCs existentes para evitar duplicados
    for tag in (qn("w:b"), qn("w:bCs")):
        existing = rPr.find(tag)
        if existing is not None:
            rPr.remove(existing)
    b = OxmlElement("w:b")
    bCs = OxmlElement("w:bCs")
    rPr.insert(0, bCs)
    rPr.insert(0, b)
    return rPr


def _make_run(text: str, rPr, bold: bool) -> object:
    """Crea un <w:r> con el texto dado, aplicando negrita si bold=True."""
    r = OxmlElement("w:r")
    if bold:
        r.append(_make_bold_rPr(rPr))
    elif rPr is not None:
        r.append(deepcopy(rPr))
    t = OxmlElement("w:t")
    t.text = text
    if text.startswith(" ") or text.endswith(" "):
        t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    r.append(t)
    return r


def _append_inline_text(new_p: object, line: str, orig_rPr) -> None:
    """
    Analiza `line` buscando segmentos **negrita** y crea runs alternos
    (normal / bold) dentro de new_p.
    """
    parts = re.split(r"(\*\*[^*]+\*\*)", line)
    for part in parts:
        if part.startswith("**") and part.endswith("**"):
            text = part[2:-2]
            new_p.append(_make_run(text, orig_rPr, bold=True))
        elif part:
            new_p.append(_make_run(part, orig_rPr, bold=False))


_BULLET_NUM_ID = "35"  # numId del bullet estándar en la plantilla maestra
_BULLET_ILVL = "0"


def _make_bullet_paragraph(line: str, orig_rPr) -> object:
    """
    Crea un <w:p> con viñeta (bullet) usando el estilo P2_Párrafo lista
    y la definición de numeración numId=35 de la plantilla maestra.
    Admite **negrita** inline en el texto.
    """
    new_p = OxmlElement("w:p")
    pPr = OxmlElement("w:pPr")

    # Estilo P2_Párrafo lista
    pStyle = OxmlElement("w:pStyle")
    pStyle.set(qn("w:val"), "P2_Prrafoslista")
    pPr.append(pStyle)

    # Numeración (bullet)
    numPr = OxmlElement("w:numPr")
    ilvl = OxmlElement("w:ilvl")
    ilvl.set(qn("w:val"), _BULLET_ILVL)
    numId_elem = OxmlElement("w:numId")
    numId_elem.set(qn("w:val"), _BULLET_NUM_ID)
    numPr.append(ilvl)
    numPr.append(numId_elem)
    pPr.append(numPr)

    # Justificado
    jc = OxmlElement("w:jc")
    jc.set(qn("w:val"), "both")
    pPr.append(jc)

    new_p.append(pPr)
    _append_inline_text(new_p, line, orig_rPr)
    return new_p


def _make_analysis_paragraphs(text: str, style_elem) -> List:
    """
    Divide el texto de análisis en párrafos por línea en blanco y crea
    elementos <w:p> copiando el estilo del párrafo marcador original.

    Formatos soportados:
      - Texto normal → párrafo P1_Texto copiando estilo del marcador
      - **negrita** inline → runs con w:b
      - Líneas que comienzan con "- " → párrafo bullet (P2_Párrafo lista, numId=35)
    """
    paragraphs = []
    blocks = [b.strip() for b in text.split("\n\n") if b.strip()]
    if not blocks:
        blocks = [text.strip()] if text.strip() else ["[análisis no disponible]"]

    orig_pPr = style_elem.find(qn("w:pPr"))
    orig_rPr = None
    orig_runs = style_elem.findall(qn("w:r"))
    if orig_runs:
        orig_rPr = orig_runs[0].find(qn("w:rPr"))

    for block in blocks:
        lines = block.split("\n")
        # Si todas las líneas del bloque son bullets, crear un párrafo por línea
        if all(ln.startswith("- ") for ln in lines if ln.strip()):
            for line in lines:
                if line.strip():
                    paragraphs.append(_make_bullet_paragraph(line[2:], orig_rPr))
        else:
            # Párrafo normal (puede mezclar líneas con saltos internos)
            new_p = OxmlElement("w:p")
            if orig_pPr is not None:
                new_p.append(deepcopy(orig_pPr))
            for li, line in enumerate(lines):
                _append_inline_text(new_p, line, orig_rPr)
                if li < len(lines) - 1:
                    br_r = OxmlElement("w:r")
                    br = OxmlElement("w:br")
                    br_r.append(br)
                    new_p.append(br_r)
            paragraphs.append(new_p)
    return paragraphs


# ─────────────────────────────────────────────────────────────────
# Control de paginación de tablas

_MAX_ROWS_FOR_CANT_SPLIT = 40  # tablas con más filas pueden ocupar varias páginas


def _apply_cant_split(tbl_xml) -> None:
    """
    Añade <w:cantSplit/> en el <w:trPr> de cada fila de la tabla para que
    Word no corte una fila a mitad de página.

    Para tablas pequeñas (≤ MAX_ROWS_FOR_CANT_SPLIT filas) también añade
    <w:keepNext/> en el <w:pPr> de los párrafos dentro de cada celda,
    lo que hace que Word intente mantener la tabla entera en una sola página
    antes de iniciar un salto. Si la tabla es muy grande se aplica solo
    cantSplit (evita cortes de fila, pero permite salto de página entre filas).
    """
    rows = tbl_xml.findall(qn("w:tr"))
    small_table = len(rows) <= _MAX_ROWS_FOR_CANT_SPLIT

    for tr in rows:
        # Asegurar <w:trPr> existe
        trPr = tr.find(qn("w:trPr"))
        if trPr is None:
            trPr = OxmlElement("w:trPr")
            tr.insert(0, trPr)

        # Añadir cantSplit si no existe
        if trPr.find(qn("w:cantSplit")) is None:
            cant = OxmlElement("w:cantSplit")
            trPr.append(cant)

        # Para tablas pequeñas: keepNext en cada párrafo de celda
        if small_table:
            for tc in tr.findall(qn("w:tc")):
                for p in tc.findall(qn("w:p")):
                    pPr = p.find(qn("w:pPr"))
                    if pPr is None:
                        pPr = OxmlElement("w:pPr")
                        p.insert(0, pPr)
                    if pPr.find(qn("w:keepNext")) is None:
                        kn = OxmlElement("w:keepNext")
                        pPr.append(kn)


# ─────────────────────────────────────────────────────────────────
# Limpieza de párrafos vacíos
# ─────────────────────────────────────────────────────────────────


def _remove_empty_normal_paragraphs(body) -> None:
    """
    Elimina párrafos vacíos de estilo Normal que actúan como separadores
    visuales en la plantilla pero son innecesarios en el output final,
    ya que los estilos P1_Texto y H3 tienen su propio spacing configurado.
    Solo se eliminan si están completamente vacíos (sin texto real).
    """
    W_T = qn("w:t")
    W_PPR = qn("w:pPr")
    W_PSTYLE = qn("w:pStyle")

    to_remove = []
    for child in list(body):
        if child.tag.split("}")[-1] != "p":
            continue
        pPr = child.find(W_PPR)
        style_val = None
        if pPr is not None:
            pStyle = pPr.find(W_PSTYLE)
            if pStyle is not None:
                style_val = pStyle.get(qn("w:val"), "")
        # Solo eliminar párrafos sin estilo explícito (Normal por defecto)
        if style_val and style_val.lower() not in ("normal", ""):
            continue
        has_text = any(t.text and t.text.strip() for t in child.iter(W_T))
        if not has_text:
            to_remove.append(child)

    for elem in to_remove:
        parent = elem.getparent()
        if parent is not None:
            parent.remove(elem)


# ─────────────────────────────────────────────────────────────────
# API pública
# ─────────────────────────────────────────────────────────────────

def build_report(
    output_path: Path,
    source_xml_map: Dict[str, object],
    analysis_texts: Dict[str, str],
    section_texts: Dict[str, str],
) -> dict:
    """
    Recorre el DOCX clonado (output_path) y reemplaza todos los marcadores:

    - {TABLA_*}    → XML completo de la tabla original (source_xml_map)
                     Si no hay tabla: elimina el heading + marcadores de esa subsección.
    - {ANALISIS_*} → texto del análisis (analysis_texts)
                     Si no hay texto: párrafo de fallback.
    - {SECCION_*}  → texto de sección narrativa (section_texts), siempre presente.

    Args:
        output_path:    DOCX clonado a modificar in-place.
        source_xml_map: {marcador_tabla → elemento <w:tbl> XML deepcopy}
                        Ej: {"TABLA_INGRESOS": <Element w:tbl>}
        analysis_texts: {marcador_analisis → texto}
                        Ej: {"ANALISIS_INGRESOS": "En el período..."}
        section_texts:  {marcador_seccion → texto}
                        Ej: {"SECCION_VALORACION": "..."}

    Returns:
        {"tables_inserted": N, "tables_removed": M, "analyses_inserted": K}
    """
    doc = Document(str(output_path))
    body = doc.element.body
    para_map = {p._element: p for p in doc.paragraphs}

    children = list(body)
    tables_inserted = 0
    tables_removed = 0
    analyses_inserted = 0

    # ── Fase 1: identificar grupos (heading + marcadores) ──────────
    # Construimos una lista de "acciones" antes de modificar el DOM.

    # Snapshot de párrafos con sus índices en body
    elem_list = list(body)

    i = 0
    while i < len(elem_list):
        elem = elem_list[i]
        tag = elem.tag.split("}")[-1]

        if tag != "p":
            i += 1
            continue

        para = para_map.get(elem)
        if para is None:
            i += 1
            continue

        marker = _marker_name(para)
        if marker is None:
            i += 1
            continue

        # ── Marcador de tabla ─────────────────────────────────────
        if marker.startswith("TABLA_"):
            marker_key = marker  # e.g. "TABLA_INGRESOS"
            xml_value = source_xml_map.get(marker_key)
            has_table = xml_value is not None

            if has_table:
                # xml_value puede ser un elemento único o una lista de elementos
                if isinstance(xml_value, list):
                    xml_elems = [deepcopy(x) for x in xml_value]
                else:
                    xml_elems = [deepcopy(xml_value)]
                # Insertar todos los elementos después del marcador (en orden)
                anchor = elem
                for tbl_xml in xml_elems:
                    _apply_cant_split(tbl_xml)
                    anchor.addnext(tbl_xml)
                    anchor = tbl_xml
                _remove_elem(elem)
                tables_inserted += len(xml_elems)
            else:
                # Sin tabla: eliminar heading anterior + este marcador + siguiente ANALISIS
                # Buscar el heading H3 que precede a este marcador
                _remove_marker_subsection(elem, elem_list, i, para_map)
                tables_removed += 1

            # Reconstruir lista después de modificaciones
            elem_list = list(body)
            i = 0  # reiniciar — más seguro que intentar recalcular índice
            continue

        # ── Marcador de análisis ──────────────────────────────────
        if marker.startswith("ANALISIS_"):
            text = analysis_texts.get(marker, "")
            if text.strip():
                paras = _make_analysis_paragraphs(text, elem)
                anchor = elem
                for new_p in reversed(paras):
                    anchor.addnext(new_p)
                _remove_elem(elem)
                analyses_inserted += 1
            else:
                # Sin análisis y sin tabla correspondiente: eliminar H3 + este marcador
                _remove_marker_subsection(elem, elem_list, i, para_map)
                tables_removed += 1

            elem_list = list(body)
            i = 0
            continue

        # ── Marcador de sección narrativa o intro ────────────────
        if marker.startswith("SECCION_") or marker.startswith("INTRO_"):
            text = section_texts.get(marker, "")
            if text.strip():
                paras = _make_analysis_paragraphs(text, elem)
                anchor = elem
                for new_p in reversed(paras):
                    anchor.addnext(new_p)
                _remove_elem(elem)
            else:
                import sys
                print(f"   [AVISO] Sin texto para {{{marker}}} — se eliminará del informe", file=sys.stderr)
                _remove_elem(elem)

            elem_list = list(body)
            i = 0
            continue

        i += 1

    _remove_empty_normal_paragraphs(body)

    doc.save(str(output_path))
    return {
        "tables_inserted": tables_inserted,
        "tables_removed": tables_removed,
        "analyses_inserted": analyses_inserted,
    }


def _remove_marker_subsection(
    tabla_marker_elem,
    elem_list: List,
    marker_idx: int,
    para_map: Dict,
) -> None:
    """
    Cuando no hay tabla para un marcador, elimina:
      - El H3 heading que precede al marcador (si lo hay)
      - El propio marcador {TABLA_*}
      - El marcador {ANALISIS_*} inmediatamente siguiente (si lo hay)
    """
    body = tabla_marker_elem.getparent()
    if body is None:
        return

    # Buscar hacia atrás el H3 heading inmediatamente anterior
    prev = tabla_marker_elem.getprevious()
    while prev is not None:
        tag = prev.tag.split("}")[-1]
        if tag == "p":
            para = para_map.get(prev)
            if para and _is_sub_heading(para):
                _remove_elem(prev)
                break
            # Si encontramos otro párrafo no heading, parar
            if para and para.text.strip():
                break
        prev = prev.getprevious() if prev is not None else None

    # Buscar hacia adelante el {ANALISIS_*} inmediatamente siguiente
    nxt = tabla_marker_elem.getnext()
    while nxt is not None:
        tag = nxt.tag.split("}")[-1]
        if tag == "p":
            para = para_map.get(nxt)
            if para:
                m = _marker_name(para)
                if m and m.startswith("ANALISIS_"):
                    _remove_elem(nxt)
                    break
            # Párrafo no marcador: parar
            break
        elif tag == "tbl":
            break
        nxt = nxt.getnext()

    # Eliminar el marcador de tabla
    _remove_elem(tabla_marker_elem)

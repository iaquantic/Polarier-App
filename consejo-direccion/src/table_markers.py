"""
Asigna cada tabla del DOCX de entrada a su marcador {TABLA_*} de la plantilla
maestra, reconociéndola por su título y no por su posición.

Las reglas están en config/table_markers.yaml (ver la cabecera de ese fichero
para el orden de señales: título → encabezado → continuación).

Nunca coloca una tabla a ciegas: si no se reconoce, o casa con más de un
marcador, se registra como error y el llamador debe detenerse.
"""

from __future__ import annotations

import re
import unicodedata
from copy import deepcopy
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

import yaml
from docx.table import Table
from docx.text.paragraph import Paragraph

from monthly_docx_ingestion import _HEADING_STYLES


RULES_PATH = Path("config/table_markers.yaml")


# ─────────────────────────────────────────────────────────────────
# Estructuras
# ─────────────────────────────────────────────────────────────────

@dataclass
class TableInfo:
    """Lo que se sabe de una tabla del DOCX de entrada para reconocerla."""
    position: int                 # índice ordinal de la tabla en el documento (0-based)
    caption: str                  # texto de su primera fila (celdas combinadas una sola vez)
    headings: List[str] = field(default_factory=list)  # títulos de sección entre la tabla anterior y esta
    text_before: bool = False     # hay algún párrafo con texto entre la tabla anterior y esta
    xml: object = None            # elemento <w:tbl> original


@dataclass
class Rule:
    marker: str
    titulo: List[re.Pattern] = field(default_factory=list)
    encabezado: List[re.Pattern] = field(default_factory=list)


@dataclass
class Assignment:
    position: int
    marker: str
    how: str          # "título" | "encabezado" | "continuación"
    caption: str


@dataclass
class ClassificationResult:
    assignments: List[Assignment] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors

    def marker_to_xml(self, tables: List[TableInfo]) -> Dict[str, list]:
        """{marcador → [<w:tbl>, ...]} en el orden del DOCX de entrada."""
        by_position = {t.position: t for t in tables}
        result: Dict[str, list] = {}
        for a in self.assignments:
            result.setdefault(a.marker, []).append(deepcopy(by_position[a.position].xml))
        return result


# ─────────────────────────────────────────────────────────────────
# Lectura
# ─────────────────────────────────────────────────────────────────

def normalize(text: str) -> str:
    """Minúsculas, sin tildes y con los espacios colapsados."""
    decomposed = unicodedata.normalize("NFKD", text or "")
    no_accents = "".join(c for c in decomposed if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", no_accents).strip().lower()


def load_rules(path: Optional[Path] = None) -> List[Rule]:
    with open(path or RULES_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    rules = []
    for entry in data.get("markers", []):
        rules.append(Rule(
            marker=entry["marker"],
            titulo=[re.compile(p) for p in entry.get("titulo", [])],
            encabezado=[re.compile(p) for p in entry.get("encabezado", [])],
        ))
    return rules


def _caption(table: Table) -> str:
    if not table.rows:
        return ""
    # Una celda combinada horizontalmente aparece repetida en row.cells
    cells = dict.fromkeys(c.text.strip() for c in table.rows[0].cells)
    return " | ".join(c for c in cells if c)


def describe_tables(doc) -> List[TableInfo]:
    """Recorre el cuerpo del DOCX en orden y describe cada tabla de primer nivel."""
    tables: List[TableInfo] = []
    headings: List[str] = []
    text_before = False
    for child in doc.element.body:
        tag = child.tag.split("}")[-1]
        if tag == "p":
            para = Paragraph(child, doc)
            text = para.text.strip()
            if not text:
                continue
            text_before = True
            if (para.style.name or "").lower() in _HEADING_STYLES:
                headings.append(text)
        elif tag == "tbl":
            tables.append(TableInfo(
                position=len(tables),
                caption=_caption(Table(child, doc)),
                headings=headings,
                text_before=text_before,
                xml=child,
            ))
            headings = []
            text_before = False
    return tables


# ─────────────────────────────────────────────────────────────────
# Clasificación
# ─────────────────────────────────────────────────────────────────

def _matching_markers(texts: List[str], rules: List[Rule], attr: str) -> List[str]:
    normalized = [normalize(t) for t in texts]
    found = []
    for rule in rules:
        patterns = getattr(rule, attr)
        if any(p.search(t) for p in patterns for t in normalized):
            if rule.marker not in found:
                found.append(rule.marker)
    return found


def _describe(table: TableInfo) -> str:
    caption = table.caption[:80] or "(primera fila vacía)"
    heading = f" — bajo «{table.headings[-1][:60]}»" if table.headings else ""
    return f"tabla {table.position}: «{caption}»{heading}"


def classify_tables(tables: List[TableInfo], rules: List[Rule]) -> ClassificationResult:
    result = ClassificationResult()
    previous: Optional[Assignment] = None

    for table in tables:
        assignment = None

        by_title = _matching_markers([table.caption], rules, "titulo")
        if len(by_title) > 1:
            result.errors.append(f"{_describe(table)} casa con varios marcadores por su título: {', '.join(by_title)}")
        elif by_title:
            assignment = Assignment(table.position, by_title[0], "título", table.caption)
        else:
            by_heading = _matching_markers(table.headings, rules, "encabezado")
            if len(by_heading) > 1:
                result.errors.append(f"{_describe(table)} casa con varios marcadores por su encabezado: {', '.join(by_heading)}")
            elif by_heading:
                assignment = Assignment(table.position, by_heading[0], "encabezado", table.caption)
            elif previous is not None and previous.position == table.position - 1 and not table.text_before:
                assignment = Assignment(table.position, previous.marker, "continuación", table.caption)
            else:
                result.errors.append(f"{_describe(table)} no se reconoce")

        if assignment:
            result.assignments.append(assignment)
        previous = assignment

    return result


def template_table_markers(doc) -> set:
    """Marcadores {TABLA_*} presentes en la plantilla maestra."""
    found = set()
    for para in doc.paragraphs:
        found.update(re.findall(r"\{(TABLA_[A-Z_]+)\}", para.text))
    return found

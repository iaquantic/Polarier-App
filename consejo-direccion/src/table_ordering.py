"""
Ordenación de tablas clasificadas según la estructura histórica aprendida.

El orden canónico se lee desde config/report_sections.yaml, que fue generado
por el pipeline de descubrimiento (python src/main.py discover).
Si el archivo no existe, se aplica un orden por defecto basado en los
patrones habituales de los informes Polarier.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from table_classifier import ClassifiedTable


# Orden por defecto cuando report_sections.yaml no está disponible.
# Refleja la secuencia habitual de los informes históricos de Polarier.
DEFAULT_SECTION_ORDER = [
    "economia",
    "produccion",
    "lavanderia",
    "lenceria",
    "personal",
    "mantenimiento",
    "energia",
    "comercial",
    "calidad",
    "inversiones",
    "desconocida",
]


def load_section_order() -> List[str]:
    """
    Lee el orden de secciones desde config/report_sections.yaml.
    Retorna DEFAULT_SECTION_ORDER si el archivo no existe o está vacío.
    """
    sections_path = Path("config/report_sections.yaml")
    if not sections_path.exists():
        return DEFAULT_SECTION_ORDER

    try:
        import yaml
        with open(sections_path, encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        sections = data.get("sections", [])
        if not sections:
            return DEFAULT_SECTION_ORDER
        # Las secciones pueden tener campos 'id', 'category', o 'title'
        order = []
        for s in sections:
            key = s.get("category") or s.get("id") or s.get("title", "")
            if key:
                order.append(key.lower())
        return order if order else DEFAULT_SECTION_ORDER
    except Exception:
        return DEFAULT_SECTION_ORDER


def sort_classified_tables(
    classified: List[ClassifiedTable],
    section_order: Optional[List[str]] = None,
) -> List[ClassifiedTable]:
    """
    Ordena las tablas según el orden de secciones histórico.
    Tablas de la misma categoría mantienen su orden relativo original.
    """
    order = section_order if section_order is not None else load_section_order()
    order_index = {cat: idx for idx, cat in enumerate(order)}
    unknown_idx = len(order)  # Las desconocidas van al final

    def sort_key(ct: ClassifiedTable) -> tuple:
        pos = order_index.get(ct.category, unknown_idx)
        return (pos, ct.raw.source_file, ct.raw.table_index)

    return sorted(classified, key=sort_key)


def group_and_sort(classified: List[ClassifiedTable]) -> List[tuple]:
    """
    Retorna lista de (category, [ClassifiedTable]) en el orden histórico.
    Útil para activar los agentes en secuencia.
    """
    order = load_section_order()
    from table_classifier import group_by_category
    groups = group_by_category(classified)

    result = []
    seen = set()
    for cat in order:
        if cat in groups:
            result.append((cat, groups[cat]))
            seen.add(cat)
    # Categorías que no estaban en el orden histórico van al final
    for cat, tables in groups.items():
        if cat not in seen:
            result.append((cat, tables))

    return result

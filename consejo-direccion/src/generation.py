"""Funciones de generación de texto para secciones del informe."""

from typing import Dict, List, Optional


def format_section(title: str, content: str, agent_id: str = "") -> str:
    """Envuelve el contenido de una sección con su cabecera y metadatos."""
    header = f"## {title}\n"
    meta = f"<!-- generated_by: {agent_id} -->\n\n" if agent_id else ""
    return header + meta + content.strip() + "\n"


def mark_missing_data(metric_name: str) -> str:
    """Genera el marcador estándar para datos no disponibles."""
    return f"[dato no disponible: {metric_name}]"


def mark_pending_review(reason: str) -> str:
    """Genera el marcador estándar para datos que requieren revisión."""
    return f"[requiere revisión: {reason}]"


def format_comparison(
    label: str,
    planned: Optional[float],
    actual: Optional[float],
    unit: str = "",
) -> str:
    """
    Genera texto estándar de comparación plan vs real.
    Usa marcadores de dato ausente si algún valor no está disponible.
    """
    planned_str = f"{planned:,.2f} {unit}".strip() if planned is not None else mark_missing_data("plan")
    actual_str = f"{actual:,.2f} {unit}".strip() if actual is not None else mark_missing_data("real")

    if planned is not None and actual is not None:
        deviation = actual - planned
        pct = (deviation / planned * 100) if planned != 0 else 0
        sign = "+" if deviation >= 0 else ""
        deviation_str = f"{sign}{deviation:,.2f} {unit} ({sign}{pct:.1f}%)".strip()
        return f"{label}: Plan {planned_str} | Real {actual_str} | Desviación {deviation_str}"

    return f"{label}: Plan {planned_str} | Real {actual_str}"


def format_ranking(items: List[Dict], value_key: str, label_key: str, unit: str = "") -> str:
    """
    Genera texto de ranking ordenado de mayor a menor.
    Cada elemento debe tener label_key y value_key.
    """
    if not items:
        return mark_missing_data("datos de ranking")

    sorted_items = sorted(items, key=lambda x: x.get(value_key, 0), reverse=True)
    lines = []
    for i, item in enumerate(sorted_items, start=1):
        label = item.get(label_key, f"Item {i}")
        value = item.get(value_key)
        value_str = f"{value:,.2f} {unit}".strip() if value is not None else mark_missing_data(value_key)
        lines.append(f"{i}. {label}: {value_str}")
    return "\n".join(lines)


def assemble_report(sections: List[Dict]) -> str:
    """
    Ensambla el informe completo desde una lista de secciones ya redactadas.
    sections: [{"title": str, "content": str, "agent_id": str}]
    """
    parts = []
    for section in sections:
        parts.append(
            format_section(
                section["title"],
                section["content"],
                section.get("agent_id", ""),
            )
        )
    return "\n".join(parts)

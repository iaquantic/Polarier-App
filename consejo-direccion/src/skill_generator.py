"""Genera y actualiza skills reutilizables desde patrones y reglas descubiertos."""

from pathlib import Path
from typing import List, Dict

from structure_discovery import DiscoveredPattern
from docx_comments import ReviewComment


SKILLS_DIR = Path("skills")


def enrich_skill_with_patterns(
    skill_id: str,
    patterns: List[DiscoveredPattern],
) -> str:
    """Genera sección de patrones para insertar en un SKILL.md existente."""
    if not patterns:
        return ""
    lines = ["\n## Patrones detectados en documentos históricos\n"]
    for p in patterns:
        lines.append(f"### {p.name}")
        lines.append(f"- Frecuencia: {p.frequency}")
        lines.append(f"- Descripción: {p.description}\n")
    return "\n".join(lines)


def enrich_skill_with_rules(
    skill_id: str,
    rules: List[ReviewComment],
) -> str:
    """Genera sección de reglas para insertar en un SKILL.md existente."""
    if not rules:
        return ""
    lines = ["\n## Reglas extraídas de revisiones históricas\n"]
    for rule in rules:
        rule_id = rule.rule_id or "RULE-???"
        lines.append(f"### {rule_id} — {rule.category.upper()} [{rule.severity}]")
        lines.append(f"**Regla:** {rule.text}")
        lines.append(f"**Fuente:** {rule.source_file}\n")
    return "\n".join(lines)


def update_skill_file(skill_path: Path, additional_content: str):
    """Añade contenido generado a un SKILL.md existente si no está ya incluido."""
    if not skill_path.exists():
        print(f"[WARN] Skill no encontrada: {skill_path}")
        return
    current = skill_path.read_text(encoding="utf-8")
    if "## Patrones detectados" in current or "## Reglas extraídas" in current:
        return
    skill_path.write_text(current + additional_content, encoding="utf-8")
    print(f"[OK] Skill enriquecida: {skill_path}")


def build_all_skills(
    patterns: List[DiscoveredPattern],
    rules: List[ReviewComment],
):
    """Enriquece todos los SKILL.md base con patrones y reglas descubiertos."""
    pattern_content = enrich_skill_with_patterns("global", patterns)
    rule_content = enrich_skill_with_rules("global", rules)

    skill_ids_for_patterns = [
        "business-analysis-patterns",
        "pdf-final-report-analysis",
        "document-structure-mining",
    ]
    skill_ids_for_rules = [
        "rule-inference-from-revisions",
        "docx-comment-extraction",
        "evidence-validation",
    ]

    for skill_id in skill_ids_for_patterns:
        path = SKILLS_DIR / skill_id / "SKILL.md"
        if pattern_content:
            update_skill_file(path, pattern_content)

    for skill_id in skill_ids_for_rules:
        path = SKILLS_DIR / skill_id / "SKILL.md"
        if rule_content:
            update_skill_file(path, rule_content)

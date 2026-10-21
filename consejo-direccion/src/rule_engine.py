"""Almacena, carga y aplica las reglas extraídas de los comentarios de revisión."""

from pathlib import Path
from typing import List, Dict, Optional
import yaml

from docx_comments import ReviewComment


RULES_FILE = Path("config/review_rules.yaml")


def comments_to_rules(comments: List[ReviewComment]) -> List[Dict]:
    """Convierte una lista de ReviewComment en dicts para el YAML de reglas."""
    rules = []
    for comment in comments:
        rules.append({
            "id": comment.rule_id or "RULE-???",
            "category": comment.category,
            "severity": comment.severity,
            "description": f"[Inferir descripción positiva] Basado en: {comment.text[:120]}",
            "source": comment.source_file,
            "comment": comment.text,
            "section": "global",
            "examples": {
                "wrong": "",
                "correct": "",
            },
        })
    return rules


def save_rules(rules: List[Dict], path: Path = RULES_FILE):
    """Guarda las reglas en el archivo YAML."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        yaml.dump({"rules": rules}, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    print(f"[OK] {len(rules)} reglas guardadas en {path}")


def load_rules(path: Path = RULES_FILE) -> List[Dict]:
    """Carga las reglas desde el archivo YAML."""
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data.get("rules", []) if data else []


def get_rules_for_section(section_id: str, path: Path = RULES_FILE) -> List[Dict]:
    """Filtra reglas aplicables a una sección específica o globales."""
    all_rules = load_rules(path)
    return [
        r for r in all_rules
        if r.get("section") == "global" or r.get("section") == section_id
    ]


def check_text_against_rules(text: str, rules: List[Dict]) -> List[Dict]:
    """
    Comprueba un fragmento de texto contra las reglas cargadas.
    Devuelve lista de violaciones detectadas (basadas en palabras clave del comentario).
    """
    violations = []
    text_lower = text.lower()
    for rule in rules:
        comment = rule.get("comment", "").lower()
        # Detección básica: si alguna palabra clave del comentario aparece en el texto
        keywords = [w for w in comment.split() if len(w) > 5]
        matched = [k for k in keywords[:5] if k in text_lower]
        if len(matched) >= 2:
            violations.append({
                "rule_id": rule.get("id"),
                "severity": rule.get("severity"),
                "description": rule.get("description"),
                "matched_keywords": matched,
            })
    return violations

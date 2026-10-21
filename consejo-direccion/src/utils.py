"""Utilidades compartidas del sistema."""

from pathlib import Path
from typing import Any, Dict
import yaml
import json
from datetime import datetime


def load_yaml(path: Path) -> Dict:
    """Carga un archivo YAML de forma segura."""
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data or {}


def save_yaml(data: Dict, path: Path, comment: str = ""):
    """Guarda un diccionario como YAML con comentario de cabecera opcional."""
    path.parent.mkdir(parents=True, exist_ok=True)
    header = f"# {comment}\n" if comment else ""
    with open(path, "w", encoding="utf-8") as f:
        if header:
            f.write(header)
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)


def load_json(path: Path) -> Any:
    """Carga un archivo JSON de forma segura."""
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(data: Any, path: Path):
    """Guarda datos como JSON formateado."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def timestamp_now() -> str:
    """Devuelve timestamp ISO 8601 actual."""
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%S")


def slugify(text: str) -> str:
    """Convierte texto a slug snake_case."""
    import re
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", "_", text)
    return text[:60]


def print_section(title: str, items: list):
    """Imprime una sección con título en consola."""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")
    for item in items:
        print(f"  • {item}")

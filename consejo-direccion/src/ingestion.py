"""Carga la tabla mensual de entrada para la generación del informe."""

from pathlib import Path
from typing import Dict, List, Optional
import csv
import json


INPUT_DIR = Path("data/input/mes_actual")
PROCESSED_DIR = Path("data/processed")


def find_input_table(input_dir: Path = INPUT_DIR) -> Optional[Path]:
    """Localiza la tabla mensual de entrada (CSV o JSON)."""
    if not input_dir.exists():
        return None
    for ext in ("*.csv", "*.json", "*.tsv"):
        files = list(input_dir.glob(ext))
        if files:
            return files[0]
    return None


def load_csv_table(path: Path) -> List[Dict]:
    """Carga una tabla CSV y devuelve lista de dicts (una fila = un dict)."""
    rows = []
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(dict(row))
    return rows


def load_json_table(path: Path) -> List[Dict]:
    """Carga una tabla JSON."""
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "data" in data:
        return data["data"]
    raise ValueError(f"Formato JSON no reconocido en {path.name}")


def load_input_table(path: Optional[Path] = None) -> List[Dict]:
    """Carga la tabla de entrada según su formato."""
    if path is None:
        path = find_input_table()
    if path is None:
        raise FileNotFoundError(
            "No se encontró tabla de entrada en data/input/mes_actual/. "
            "Colocar un archivo .csv o .json antes de generar el informe."
        )
    if path.suffix.lower() == ".csv":
        return load_csv_table(path)
    if path.suffix.lower() == ".json":
        return load_json_table(path)
    raise ValueError(f"Formato no soportado: {path.suffix}")


def table_to_numeric_dict(rows: List[Dict]) -> Dict[str, float]:
    """
    Extrae todos los valores numéricos de la tabla para validación.
    Útil para que validation.py compruebe coherencia numérica.
    """
    numeric = {}
    for row in rows:
        for key, value in row.items():
            try:
                clean = str(value).replace(",", ".").replace(" ", "")
                numeric[f"{key}:{value}"] = float(clean)
            except (ValueError, TypeError):
                pass
    return numeric


def save_processed_table(rows: List[Dict], month: str):
    """Guarda la tabla procesada en data/processed/ para referencia del informe."""
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    out_path = PROCESSED_DIR / f"table_{month}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    print(f"[OK] Tabla procesada guardada: {out_path}")
    return out_path

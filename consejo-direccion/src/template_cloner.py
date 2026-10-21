"""
Clona la plantilla maestra DOCX al archivo de salida mensual.

NO modifica estilos ni estructura. Solo copia el archivo master
al destino correcto con el nombre del mes y año indicados.
"""

from __future__ import annotations

from pathlib import Path
import shutil


MASTER_PATH = Path("templates/master/consejo_direccion_master.docx")
OUTPUT_DIR = Path("data/output")


def clone_master(mes: str, año: str) -> Path:
    """
    Copia la plantilla maestra al archivo de salida para el período dado.

    Args:
        mes:  Nombre del mes en español, e.g. "ENERO", "FEBRERO".
        año:  Año de cuatro dígitos, e.g. "2026".

    Returns:
        Ruta al archivo de salida creado.

    Raises:
        FileNotFoundError: Si la plantilla maestra no existe.
    """
    if not MASTER_PATH.exists():
        raise FileNotFoundError(
            f"Plantilla maestra no encontrada: {MASTER_PATH}\n"
            "Coloque el archivo DOCX aprobado en templates/master/consejo_direccion_master.docx"
        )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    output_name = f"consejo_direccion_{mes.upper()}_{año}.docx"
    output_path = OUTPUT_DIR / output_name

    shutil.copy2(str(MASTER_PATH), str(output_path))
    return output_path


def verify_master() -> bool:
    """Retorna True si la plantilla maestra existe y es legible."""
    return MASTER_PATH.exists() and MASTER_PATH.is_file()


def master_info() -> dict:
    """Devuelve metadatos básicos de la plantilla maestra."""
    if not verify_master():
        return {"exists": False, "path": str(MASTER_PATH)}
    stat = MASTER_PATH.stat()
    return {
        "exists": True,
        "path": str(MASTER_PATH),
        "size_kb": round(stat.st_size / 1024, 1),
    }

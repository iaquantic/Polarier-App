"""
[MODO SECUNDARIO — COMPATIBILIDAD]

Este módulo fue el método principal de ingesta hasta mayo 2026.
A partir de la versión 1.1, el método principal es monthly_docx_ingestion.py,
que recibe un único DOCX mensual con todas las tablas + context_notes.

Este módulo se conserva para compatibilidad con flujos que aún entreguen
archivos múltiples (Excel, CSV, PDF separados). No se usa en el flujo
mensual estándar. No modificar ni eliminar sin revisar monthly_docx_ingestion.py.

Ingesta de archivos mensuales desde data/input/mes_actual/.

Detecta todos los archivos del período, determina su formato y los entrega
a los extractores correspondientes. No interpreta contenido — solo descubre
y cataloga qué archivos están disponibles.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional


SUPPORTED_EXTENSIONS = {
    ".xlsx": "excel",
    ".xls":  "excel",
    ".csv":  "csv",
    ".docx": "docx",
    ".pdf":  "pdf",
    ".ods":  "ods",
}

INPUT_DIR = Path("data/input/mes_actual")


@dataclass
class IngestedFile:
    path: Path
    filename: str
    extension: str
    format_type: str
    size_bytes: int

    @property
    def stem(self) -> str:
        return self.path.stem


@dataclass
class IngestionResult:
    files: List[IngestedFile] = field(default_factory=list)
    unsupported: List[Path] = field(default_factory=list)
    input_dir: Path = INPUT_DIR

    @property
    def total(self) -> int:
        return len(self.files)

    @property
    def by_format(self) -> dict:
        result: dict = {}
        for f in self.files:
            result.setdefault(f.format_type, []).append(f)
        return result

    def summary(self) -> str:
        lines = [f"Directorio: {self.input_dir}", f"Archivos detectados: {self.total}"]
        for fmt, files in self.by_format.items():
            lines.append(f"  {fmt}: {len(files)} archivo(s)")
        if self.unsupported:
            lines.append(f"  Sin soporte: {len(self.unsupported)} archivo(s)")
        return "\n".join(lines)


def detect_monthly_files(input_dir: Optional[Path] = None) -> IngestionResult:
    """Detecta todos los archivos en el directorio de ingesta mensual."""
    directory = Path(input_dir) if input_dir else INPUT_DIR
    result = IngestionResult(input_dir=directory)

    if not directory.exists():
        return result

    for entry in sorted(directory.iterdir()):
        if not entry.is_file():
            continue
        ext = entry.suffix.lower()
        if ext in SUPPORTED_EXTENSIONS:
            result.files.append(IngestedFile(
                path=entry,
                filename=entry.name,
                extension=ext,
                format_type=SUPPORTED_EXTENSIONS[ext],
                size_bytes=entry.stat().st_size,
            ))
        else:
            result.unsupported.append(entry)

    return result


def validate_ingestion(result: IngestionResult) -> List[str]:
    """Devuelve lista de advertencias sobre la ingesta. Lista vacía = OK."""
    warnings = []
    if result.total == 0:
        warnings.append(
            f"No se encontraron archivos en {result.input_dir}. "
            "Colocar los archivos mensuales antes de ejecutar la generación."
        )
    for path in result.unsupported:
        warnings.append(
            f"Formato no soportado ignorado: {path.name}  "
            f"(soportados: {', '.join(SUPPORTED_EXTENSIONS)})"
        )
    return warnings

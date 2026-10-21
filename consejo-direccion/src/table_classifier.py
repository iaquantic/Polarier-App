"""
Clasificación de tablas por tipo de contenido y sección del informe.

Usa señales de los encabezados, métricas y palabras clave para determinar
a qué categoría temática pertenece cada RawTable. No inventa — si no hay
señal suficiente, asigna category="desconocida" y confidence=0.0.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from table_extractor import RawTable


# ─── SEÑALES POR CATEGORÍA ───────────────────────────────────────────────────
# Palabras clave en encabezados o títulos que identifican el tipo de tabla.
# Las listas son aditivas: más coincidencias = mayor confianza.

CATEGORY_SIGNALS: dict = {
    "economia": [
        "ingreso", "ingresos", "gasto", "gastos", "costo", "costos", "utilidad",
        "resultado", "plan", "real", "desviaci", "financier", "presupuest",
        "monto", "valor", "importe", "beneficio", "margen", "rentabilidad",
        "facturaci", "cobro", "pago", "deuda", "liquidez",
    ],
    "produccion": [
        "kg", "kilogram", "produccion", "producción", "lavado", "servicio",
        "proceso", "volumen", "capacidad", "rendimiento", "eficiencia",
        "tonelada", "unidad", "piezas", "lotes", "ciclos",
    ],
    "lavanderia": [
        "lavanderia", "lavandería", "instalaci", "cliente", "contrato",
        "hotel", "hospital", "centro", "entidad",
    ],
    "personal": [
        "trabajador", "empleado", "plantilla", "salario", "nomina", "nómina",
        "ausencia", "vacacion", "licencia", "cargo", "plaza", "fuerza",
        "capacitaci", "formaci",
    ],
    "mantenimiento": [
        "mantenimiento", "avería", "averia", "equipo", "maquina", "máquina",
        "reparaci", "fallo", "interrupci", "disponibilidad", "taller",
    ],
    "energia": [
        "energía", "energia", "electricidad", "kwh", "combustible", "gas",
        "vapor", "agua", "consumo energétic", "portador",
    ],
    "lenceria": [
        "lencería", "lenceria", "ropa", "prenda", "textil", "piezas",
        "devolución", "devolucion", "despacho", "entrega", "recepci",
    ],
    "comercial": [
        "comercial", "venta", "cliente", "contrato", "factura", "tarifa",
        "precio", "oferta", "demanda", "mercado",
    ],
    "calidad": [
        "calidad", "reclamaci", "queja", "indicador", "norma", "estandar",
        "estándar", "iso", "control", "inspecci",
    ],
    "inversiones": [
        "inversi", "proyecto", "obra", "adquisici", "capital", "activo",
        "infraestructura", "modernizaci",
    ],
}


@dataclass
class ClassifiedTable:
    raw: RawTable
    category: str
    confidence: float
    matched_signals: List[str]
    section_hint: str = ""

    @property
    def is_classified(self) -> bool:
        return self.category != "desconocida" and self.confidence > 0.0

    @property
    def review_label(self) -> str:
        """Etiqueta RULE-012: texto estándar para tablas no clasificadas."""
        if self.is_classified:
            return ""
        src = self.raw.source_file
        hdr = self.raw.header_text()[:60]
        return f"tabla no clasificada - requiere revisión | origen: {src} | encabezados: {hdr}"


def _normalize(text: str) -> str:
    return text.lower().strip()


def _score_text(text: str, signals: List[str]) -> tuple[int, List[str]]:
    norm = _normalize(text)
    matched = [s for s in signals if s in norm]
    return len(matched), matched


def classify_table(table: RawTable) -> ClassifiedTable:
    """
    Clasifica una tabla usando señales por prioridad:
      1. Título documental (raw_title / sheet_or_page) — peso x3
      2. Posición en el documento (sheet_or_page)
      3. Encabezados de columna de la tabla

    Cuando la tabla viene del DOCX mensual, raw_title contiene el título
    y subtítulo del bloque, que es la señal más fiable.
    """
    # Ponderación: el título documental cuenta triple frente a los encabezados
    candidate_text = " ".join([
        table.raw_title * 3 if table.raw_title else "",
        table.sheet_or_page * 2 if table.sheet_or_page else "",
        table.header_text(),
    ])

    best_category = "desconocida"
    best_score = 0
    best_matched: List[str] = []

    for category, signals in CATEGORY_SIGNALS.items():
        score, matched = _score_text(candidate_text, signals)
        if score > best_score:
            best_score = score
            best_category = category
            best_matched = matched

    # Confianza: proporción de señales encontradas respecto al máximo posible
    max_signals = max(len(s) for s in CATEGORY_SIGNALS.values())
    confidence = round(min(best_score / max(max_signals * 0.3, 1), 1.0), 2)

    if best_score == 0:
        best_category = "desconocida"
        confidence = 0.0

    return ClassifiedTable(
        raw=table,
        category=best_category,
        confidence=confidence,
        matched_signals=best_matched,
    )


def classify_all_tables(tables: List[RawTable]) -> List[ClassifiedTable]:
    """Clasifica una lista de tablas."""
    return [classify_table(t) for t in tables]


def load_classification_rules() -> dict:
    """
    Carga reglas de clasificación adicionales desde config/table_classification.yaml.
    Si el archivo no existe, retorna dict vacío (las señales por defecto siguen activas).
    """
    from pathlib import Path
    import yaml
    path = Path("config/table_classification.yaml")
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def group_by_category(classified: List[ClassifiedTable]) -> dict:
    """Agrupa tablas clasificadas por categoría."""
    groups: dict = {}
    for ct in classified:
        groups.setdefault(ct.category, []).append(ct)
    return groups

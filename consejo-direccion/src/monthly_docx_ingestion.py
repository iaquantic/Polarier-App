"""
Ingesta del DOCX mensual único desde data/input/mes_actual/.

El DOCX mensual contiene todas las tablas del período en el orden del informe,
junto con títulos, subtítulos, precisiones, especificaciones y notas operativas
que contextualizan cada tabla.

Este módulo extrae y estructura ese contenido manteniendo la posición documental
de cada elemento: el texto inmediatamente anterior a una tabla es su contexto.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Dict, Any

import yaml

try:
    from docx import Document
    from docx.table import Table as DocxTable
    from docx.text.paragraph import Paragraph
except ImportError:
    raise ImportError("python-docx requerido: pip install python-docx")

try:
    import pandas as pd
except ImportError:
    raise ImportError("pandas requerido: pip install pandas")


INPUT_DIR = Path("data/input/mes_actual")

# Patrones de encabezado que indican texto contextual (no narrativo del informe)
_CONTEXT_HEADERS = re.compile(
    r"^\s*(precisiones?|especificaciones?|elementos?\s+a\s+especificar|"
    r"notas?|comentarios?|observaciones?|análisis|aclaraciones?|"
    r"consideraciones?|aspectos?\s+a\s+considerar)\s*[:\-]?\s*$",
    re.IGNORECASE,
)

# Estilos de Word que indican título/subtítulo estructural
# Incluye estilos estándar de Word Y los estilos personalizados del DOCX Polarier
_HEADING_STYLES = {
    # Estilos estándar Word
    "heading 1", "heading 2", "heading 3", "heading 4",
    "título 1", "título 2", "título 3", "título 4",
    "encabezado 1", "encabezado 2", "encabezado 3", "encabezado 4",
    # Estilos personalizados Polarier
    "h1_tema",                    # sección principal del informe (ej. "CUMPLIMIENTO DEL PLAN…")
    "h2_título", "h2_titulo",     # título de subsección nivel 2
    "h3_encabezado_justificado",  # subsección de tabla (ej. "Comportamiento de los ingresos")
}

# Estilos que marcan sección principal (resetean title y subtitle)
_MAIN_SECTION_STYLES = {
    "heading 1", "título 1", "encabezado 1",
    "h1_tema",
}

# Estilos que marcan subsección (actualizan subtitle, detienen contexto post-tabla)
_SUBSECTION_STYLES = {
    "heading 2", "heading 3", "heading 4",
    "título 2", "título 3", "título 4",
    "encabezado 2", "encabezado 3", "encabezado 4",
    "h2_título", "h2_titulo",
    "h3_encabezado_justificado",
}

# Estilos que son siempre contexto/notas (nunca títulos)
_CONTEXT_STYLES = {"list paragraph"}

# Textos que son artefactos de formularios Word — ignorar completamente
_FORM_ARTIFACTS = re.compile(
    r"^\s*(principio\s+del\s+formulario|final\s+del\s+formulario)\s*$",
    re.IGNORECASE,
)


# ─────────────────────────────────────────────────────────────────
# Estructuras de datos
# ─────────────────────────────────────────────────────────────────

@dataclass
class ContextNote:
    """Texto contextual asociado a una tabla: precisiones, notas, especificaciones."""
    text: str
    note_type: str          # "precision" | "especificacion" | "nota" | "comentario" | "parrafo"
    position_before: bool   # True = párrafo antes de la tabla, False = después
    raw_header: str = ""    # Encabezado de sección que introdujo esta nota (si aplica)

    def is_causal(self) -> bool:
        """Indica si la nota explica una causa (sobregiro, cierre, distorsión...)."""
        causal_keywords = [
            "sobregiro", "cierre", "cerrada", "cerrado", "error contable",
            "distorsión", "distorsion", "extraordinari", "energético", "energetico",
            "caída", "caida", "baja ocupación", "baja ocupacion", "temporada",
            "mantenimiento", "avería", "averia", "interrupción", "interrupcion",
            "ajuste", "corrección", "correccion", "diferencia",
        ]
        text_lower = self.text.lower()
        return any(kw in text_lower for kw in causal_keywords)

    def contradicts_table(self) -> bool:
        """Heurística simple: nota que menciona valores numéricos distintos puede contradecir."""
        # Se evalúa en validation.py con acceso al dataframe real
        return False


@dataclass
class ExtractedTable:
    """
    Tabla extraída del DOCX mensual con todo su contexto documental.

    Estructura normalizada que unifica tabla + posición + contexto
    para entregarla al clasificador y luego al agente correspondiente.
    """
    table_id: str                          # "tabla_001", "tabla_002", ...
    section: str                           # Sección inferida (puede ser "" si no clasificada)
    title: str                             # Título inmediatamente antes de la tabla
    subtitle: str                          # Subtítulo del bloque (si aplica)
    marker_tabla: str                      # "{TABLA_*}" asignado, vacío hasta clasificación
    marker_analisis: str                   # "{ANALISIS_*}" asignado, vacío hasta clasificación
    position_index: int                    # Posición ordinal en el documento (0-based)
    dataframe: Any                         # pd.DataFrame con los datos
    context_notes: List[ContextNote] = field(default_factory=list)
    source_docx: str = ""                  # Nombre del archivo DOCX origen

    @property
    def has_context(self) -> bool:
        return bool(self.context_notes)

    @property
    def causal_notes(self) -> List[ContextNote]:
        """Notas que explican causas de desviación, cierre o distorsión."""
        return [n for n in self.context_notes if n.is_causal()]

    @property
    def all_context_text(self) -> str:
        """Concatenación de todas las notas para enviar al agente."""
        return "\n".join(f"[{n.note_type.upper()}] {n.text}" for n in self.context_notes)

    def header_signals(self) -> str:
        """Texto combinado de título + subtítulo para clasificación."""
        return f"{self.title} {self.subtitle}".strip()


@dataclass
class DocxIngestionResult:
    tables: List[ExtractedTable] = field(default_factory=list)
    source_path: Path = Path()
    warnings: List[str] = field(default_factory=list)

    @property
    def total_tables(self) -> int:
        return len(self.tables)

    def summary(self) -> str:
        lines = [
            f"Archivo: {self.source_path.name}",
            f"Tablas extraídas: {self.total_tables}",
        ]
        tables_with_context = sum(1 for t in self.tables if t.has_context)
        lines.append(f"Tablas con notas de contexto: {tables_with_context}")
        if self.warnings:
            lines.append(f"Advertencias: {len(self.warnings)}")
            for w in self.warnings:
                lines.append(f"  - {w}")
        return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────
# Extracción
# ─────────────────────────────────────────────────────────────────

def detect_monthly_docx(input_dir: Optional[Path] = None) -> Optional[Path]:
    """
    Busca el DOCX mensual en data/input/mes_actual/.
    Retorna la ruta del primer .docx encontrado, o None si no hay ninguno.
    """
    directory = Path(input_dir) if input_dir else INPUT_DIR
    if not directory.exists():
        return None
    candidates = sorted(directory.glob("*.docx"))
    return candidates[0] if candidates else None


def _is_heading(paragraph: Paragraph) -> bool:
    style_name = (paragraph.style.name or "").lower()
    return style_name in _HEADING_STYLES


def _is_main_section(paragraph: Paragraph) -> bool:
    """True para estilos de sección principal (H1_Tema, Heading 1…)."""
    style_name = (paragraph.style.name or "").lower()
    return style_name in _MAIN_SECTION_STYLES


def _is_subsection(paragraph: Paragraph) -> bool:
    """True para estilos de subsección (H3_Encabezado_Justificado, Heading 2/3…)."""
    style_name = (paragraph.style.name or "").lower()
    return style_name in _SUBSECTION_STYLES


def _is_context_style(paragraph: Paragraph) -> bool:
    """True para estilos que siempre son notas de contexto (List Paragraph…)."""
    style_name = (paragraph.style.name or "").lower()
    return style_name in _CONTEXT_STYLES


def _is_context_header(text: str) -> bool:
    """Detecta encabezados de bloque contextual como 'Precisiones:', 'Notas:', etc."""
    # Coincide tanto si el texto ES solo el encabezado como si EMPIEZA con él seguido de ':'
    stripped = text.strip()
    return bool(_CONTEXT_HEADERS.match(stripped)) or bool(
        re.match(
            r"^(precisiones?|especificaciones?|notas?|comentarios?|observaciones?|"
            r"análisis|analisis|aclaraciones?|elementos?\s+a\s+especificar)"
            r"\s*[:\-]",
            stripped,
            re.IGNORECASE,
        )
    )


def _classify_note_type(text: str, header: str) -> str:
    h = header.lower()
    if "precis" in h:
        return "precision"
    if "especif" in h or "element" in h:
        return "especificacion"
    if "nota" in h:
        return "nota"
    if "comentar" in h:
        return "comentario"
    if "observ" in h:
        return "observacion"
    if "análisis" in h or "analisis" in h:
        return "analisis"
    if "aclarac" in h or "consider" in h:
        return "aclaracion"
    return "parrafo"


def _table_to_dataframe(docx_table: DocxTable) -> "pd.DataFrame":
    """Convierte una docx.Table a DataFrame usando la primera fila como encabezado."""
    rows = []
    for row in docx_table.rows:
        rows.append([cell.text.strip() for cell in row.cells])

    if not rows:
        return pd.DataFrame()

    # Deduplicar columnas si hay celdas combinadas horizontalmente
    header = rows[0]
    seen: Dict[str, int] = {}
    clean_header = []
    for col in header:
        if col in seen:
            seen[col] += 1
            clean_header.append(f"{col}_{seen[col]}")
        else:
            seen[col] = 0
            clean_header.append(col)

    data_rows = rows[1:] if len(rows) > 1 else []
    # Normalizar longitud de filas
    ncols = len(clean_header)
    normalized = [row[:ncols] + [""] * max(0, ncols - len(row)) for row in data_rows]

    return pd.DataFrame(normalized, columns=clean_header)


def ingest_monthly_docx(docx_path: Path) -> DocxIngestionResult:
    """
    Extrae tablas y contexto del DOCX mensual.

    Recorre el documento párrafo a párrafo y tabla a tabla (en el orden XML
    real del documento) manteniendo la posición de cada elemento.

    Para cada tabla:
      - Asocia el título/subtítulo más reciente como title/subtitle.
      - Asocia los párrafos de contexto (precisiones, notas, etc.) del bloque
        inmediatamente anterior y posterior.
    """
    result = DocxIngestionResult(source_path=docx_path)
    doc = Document(str(docx_path))

    # Recorrer el cuerpo del documento en orden real (mezcla párrafos y tablas)
    body = doc.element.body
    children = list(body)

    current_title = ""
    current_subtitle = ""
    pending_context: List[ContextNote] = []   # contexto acumulado antes de la próxima tabla
    current_context_header = ""               # encabezado de sección contextual activo
    in_context_block = False                  # estamos dentro de un bloque de notas
    table_index = 0

    # Mapeo rápido: elemento XML → objeto python-docx
    para_map = {p._element: p for p in doc.paragraphs}
    table_map = {t._element: t for t in doc.tables}

    i = 0
    while i < len(children):
        child = children[i]

        # ── PÁRRAFO ──
        if child.tag.endswith("}p"):
            para = para_map.get(child)
            if para is None:
                i += 1
                continue

            text = para.text.strip()
            if not text:
                i += 1
                continue

            # ── Artefactos de formularios Word — ignorar ──
            if _FORM_ARTIFACTS.match(text):
                i += 1
                continue

            # ── Sección principal (H1_Tema, Heading 1…) ──
            if _is_main_section(para):
                in_context_block = False
                current_context_header = ""
                pending_context = []          # nueva sección principal cancela notas huérfanas
                current_title = text
                current_subtitle = ""
                i += 1
                continue

            # ── Subsección (H3_Encabezado_Justificado, Heading 2/3…) ──
            if _is_subsection(para):
                in_context_block = False
                current_context_header = ""
                current_subtitle = text
                i += 1
                continue

            # ── Estilos que son siempre notas (List Paragraph…) ──
            if _is_context_style(para):
                note = ContextNote(
                    text=text,
                    note_type=_classify_note_type(text, current_context_header),
                    position_before=True,
                    raw_header=current_context_header,
                )
                pending_context.append(note)
                i += 1
                continue

            # ── Encabezado de bloque contextual ("Precisiones:", "Notas:", etc.) ──
            if _is_context_header(text):
                in_context_block = True
                # Extraer el encabezado (todo hasta el primer ':' o '-')
                current_context_header = re.split(r"[:\-]", text)[0].strip()
                # Si el párrafo tiene contenido después del encabezado, capturarlo como nota
                rest = text[len(current_context_header):].lstrip(":- \n").strip()
                if rest:
                    note = ContextNote(
                        text=rest,
                        note_type=_classify_note_type(rest, current_context_header),
                        position_before=True,
                        raw_header=current_context_header,
                    )
                    pending_context.append(note)
                i += 1
                continue

            # ── Párrafo dentro de un bloque contextual → es una nota ──
            if in_context_block:
                note = ContextNote(
                    text=text,
                    note_type=_classify_note_type(text, current_context_header),
                    position_before=True,
                    raw_header=current_context_header,
                )
                pending_context.append(note)
                i += 1
                continue

            # ── Normal (Web) — artefacto o subtítulo informal ──
            # En el DOCX Polarier aparece como contenedor de subtítulos de sección
            # sin estilo H3. Si el texto parece un título (sin punto al final, < 80 chars)
            # lo tratamos como subtítulo; si tiene contenido sustancial, como nota.
            style_name = (para.style.name or "").lower()
            if style_name == "normal (web)":
                looks_like_title = len(text) < 80 and not text.endswith(".")
                if looks_like_title:
                    current_subtitle = text
                    in_context_block = False
                    current_context_header = ""
                else:
                    note = ContextNote(
                        text=text,
                        note_type=_classify_note_type(text, current_context_header),
                        position_before=True,
                        raw_header=current_context_header,
                    )
                    pending_context.append(note)
                i += 1
                continue

            # ── Párrafo de estilo P1_Texto / Normal fuera de contexto ──
            # En el DOCX Polarier, P1_Texto es el índice del orden del día (inicio del doc).
            # Después de la primera sección principal, son notas analíticas o aclaraciones.
            if style_name in ("normal", "p1_texto") and current_title:
                # Considerarlo nota de contexto si tiene sustancia (no es solo un label corto)
                if len(text) > 20:
                    note = ContextNote(
                        text=text,
                        note_type=_classify_note_type(text, current_context_header),
                        position_before=True,
                        raw_header=current_context_header,
                    )
                    pending_context.append(note)
                else:
                    # Texto muy corto de estilo Normal: puede ser subtítulo informal
                    current_subtitle = text
            i += 1
            continue

        # ── TABLA ──
        if child.tag.endswith("}tbl"):
            docx_table = table_map.get(child)
            if docx_table is None:
                i += 1
                continue

            df = _table_to_dataframe(docx_table)
            if df.empty:
                result.warnings.append(
                    f"Tabla vacía en posición {table_index} ignorada."
                )
                i += 1
                continue

            table_id = f"tabla_{table_index:03d}"

            # Recoger párrafos posteriores inmediatos como contexto "after"
            # Nos detenemos ante: otra tabla, un heading estructural, o un párrafo
            # que claramente es el subtítulo de la siguiente tabla (subsección).
            after_context: List[ContextNote] = []
            j = i + 1
            while j < len(children) and children[j].tag.endswith("}p"):
                post_para = para_map.get(children[j])
                if post_para is None:
                    break
                post_text = post_para.text.strip()
                if not post_text:
                    j += 1
                    continue
                # Ignorar artefactos de formularios Word
                if _FORM_ARTIFACTS.match(post_text):
                    j += 1
                    continue
                # Parar ante cualquier heading (sección principal o subsección)
                if _is_heading(post_para):
                    break
                post_style = (post_para.style.name or "").lower()
                # Parar si el siguiente párrafo es un subtítulo de tabla (P1_Texto)
                if post_style == "p1_texto":
                    break
                # Normal (Web) con texto corto sin punto = subtítulo de próxima tabla, parar
                if post_style == "normal (web)" and len(post_text) < 80 and not post_text.endswith("."):
                    break
                # Capturar si es estilo de contexto explícito (List Paragraph)
                if _is_context_style(post_para):
                    note = ContextNote(
                        text=post_text,
                        note_type=_classify_note_type(post_text, current_context_header),
                        position_before=False,
                        raw_header=current_context_header,
                    )
                    after_context.append(note)
                    j += 1
                    continue
                # Capturar si es un encabezado de bloque contextual o estamos en uno
                if _is_context_header(post_text):
                    current_context_header = re.split(r"[:\-]", post_text)[0].strip()
                    rest = post_text[len(current_context_header):].lstrip(":- \n").strip()
                    if rest:
                        note = ContextNote(
                            text=rest,
                            note_type=_classify_note_type(rest, current_context_header),
                            position_before=False,
                            raw_header=current_context_header,
                        )
                        after_context.append(note)
                    j += 1
                    continue
                # Párrafo Normal con sustancia — capturar si tiene más de 20 chars
                if post_style in ("normal",) and len(post_text) > 20:
                    note = ContextNote(
                        text=post_text,
                        note_type=_classify_note_type(post_text, current_context_header),
                        position_before=False,
                        raw_header=current_context_header,
                    )
                    after_context.append(note)
                    j += 1
                    continue
                # Cualquier otro párrafo corto: podría ser subtítulo de la próxima tabla, parar
                break

            all_context = pending_context + after_context

            extracted = ExtractedTable(
                table_id=table_id,
                section="",           # se asigna en clasificación
                title=current_title,
                subtitle=current_subtitle,
                marker_tabla="",      # se asigna en mapeo
                marker_analisis="",   # se asigna en mapeo
                position_index=table_index,
                dataframe=df,
                context_notes=all_context,
                source_docx=docx_path.name,
            )
            result.tables.append(extracted)

            # Reiniciar estado para la siguiente tabla
            pending_context = []
            in_context_block = False
            current_context_header = ""
            # Preservar title/subtitle hasta que aparezca un nuevo heading
            table_index += 1
            i = j  # saltar los párrafos post-tabla ya procesados
            continue

        i += 1

    if result.total_tables == 0:
        result.warnings.append(
            f"No se encontraron tablas en {docx_path.name}. "
            "Verificar que el archivo contiene tablas Word (no imágenes)."
        )

    return result


def load_monthly_docx(input_dir: Optional[Path] = None) -> DocxIngestionResult:
    """
    Punto de entrada principal: detecta y extrae el DOCX mensual.
    Detiene si no hay ningún DOCX en el directorio.
    """
    docx_path = detect_monthly_docx(input_dir)
    if docx_path is None:
        result = DocxIngestionResult(source_path=Path(input_dir or INPUT_DIR))
        result.warnings.append(
            f"No se encontró ningún archivo .docx en {input_dir or INPUT_DIR}. "
            "Colocar el DOCX mensual antes de ejecutar la generación."
        )
        return result
    return ingest_monthly_docx(docx_path)


# ─────────────────────────────────────────────────────────────────
# Conversión a RawTable (compatibilidad con table_classifier.py)
# ─────────────────────────────────────────────────────────────────

def to_raw_tables(ingestion: DocxIngestionResult) -> list:
    """
    Convierte ExtractedTable → RawTable para compatibilidad con
    table_classifier.py y section_mapper.py existentes.

    El título documental se inyecta como raw_title para mejorar la
    clasificación respecto a la señal de encabezados de columna.
    """
    from table_extractor import RawTable
    raw_tables = []
    for et in ingestion.tables:
        headers = list(et.dataframe.columns) if not et.dataframe.empty else []
        rows = et.dataframe.values.tolist() if not et.dataframe.empty else []
        rt = RawTable(
            raw_title=et.header_signals(),
            sheet_or_page=et.title or et.subtitle,
            headers=headers,
            rows=rows,
            source_file=et.source_docx,
        )
        # Adjuntar referencia a la ExtractedTable original para recuperar context_notes
        rt._extracted = et  # type: ignore[attr-defined]
        raw_tables.append(rt)
    return raw_tables

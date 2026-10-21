"""
Valida evidencia, coherencia, totales y rankings en el informe generado.

También incluye validación post-generación de marcadores en el DOCX de salida:
  - validate_no_markers_remain() — verifica que no queden {MARCADORES} sin reemplazar
  - scan_master_markers()        — detecta qué marcadores existen en la plantilla maestra
"""

from __future__ import annotations

import re
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Tuple

import yaml


# ─────────────────────────────────────────────────────────────────
# Constantes para validación de marcadores DOCX
# ─────────────────────────────────────────────────────────────────

_MARKER_PATTERN = re.compile(r"\{[A-Z][A-Z0-9_]+\}")
_METADATA_MARKERS = {"{MES}", "{AÑO}"}
_MARKER_MAPPING_PATH = Path("config/marker_mapping.yaml")
_VALIDATION_LOG_PATH = Path("data/processed/design_validation_log.txt")


class ValidationError(Exception):
    pass


class ValidationWarning(Exception):
    pass


def validate_no_invented_data(text: str) -> List[Dict]:
    """
    Detecta expresiones que indican datos estimados o inventados.
    Devuelve lista de advertencias.
    """
    forbidden_patterns = [
        (r"\baproximadamente\b", "Expresión de estimación: 'aproximadamente'"),
        (r"\bse estima\b", "Expresión de estimación: 'se estima'"),
        (r"\bpodría ser\b", "Expresión de incertidumbre: 'podría ser'"),
        (r"\ben torno a\b", "Expresión de estimación: 'en torno a'"),
        (r"\bsuponiendo que\b", "Expresión de suposición: 'suponiendo que'"),
        (r"\bprobablemente\b", "Expresión de incertidumbre: 'probablemente'"),
    ]
    warnings = []
    for pattern, description in forbidden_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            warnings.append({
                "type": "invented_data_risk",
                "severity": "error",
                "description": description,
                "occurrences": len(matches),
            })
    return warnings


def validate_numeric_consistency(
    text: str,
    table_data: Dict[str, float],
) -> List[Dict]:
    """
    Extrae números del texto e intenta verificar que coinciden con la tabla.
    Devuelve inconsistencias detectadas.
    """
    issues = []
    numbers_in_text = re.findall(r"\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?\b", text)

    for raw_num in numbers_in_text:
        normalized = float(raw_num.replace(",", ".").replace(".", "").replace(",", "."))
        found_in_table = any(
            abs(v - normalized) < 0.01 for v in table_data.values()
        )
        if not found_in_table and normalized > 100:
            issues.append({
                "type": "number_not_in_table",
                "severity": "advertencia",
                "value": raw_num,
                "description": f"El valor {raw_num} aparece en el texto pero no en la tabla.",
            })
    return issues


def validate_required_markers(text: str) -> List[Dict]:
    """Verifica que los marcadores de datos ausentes estén bien formados."""
    issues = []
    incomplete_markers = re.findall(r"\[(?!dato no disponible|requiere revisión)[^\]]+\]", text)
    for marker in incomplete_markers:
        issues.append({
            "type": "unknown_marker",
            "severity": "advertencia",
            "description": f"Marcador desconocido en el texto: {marker}",
        })
    return issues


def validate_evidence_present(section_text: str, required_metrics: List[str]) -> List[Dict]:
    """
    Verifica que las métricas requeridas para una sección aparecen en el texto
    o están marcadas como no disponibles.
    """
    issues = []
    text_lower = section_text.lower()
    for metric in required_metrics:
        metric_lower = metric.lower()
        if metric_lower not in text_lower and "[dato no disponible]" not in section_text:
            issues.append({
                "type": "missing_evidence",
                "severity": "error",
                "description": f"Métrica requerida no encontrada ni marcada como ausente: '{metric}'",
            })
    return issues


def run_full_validation(
    report_text: str,
    table_data: Optional[Dict] = None,
    required_metrics: Optional[List[str]] = None,
) -> Tuple[bool, List[Dict]]:
    """
    Ejecuta todas las validaciones sobre el informe generado.
    Devuelve (passed: bool, issues: List[Dict]).
    El informe falla si hay algún issue de severity == 'error'.
    """
    all_issues = []

    all_issues.extend(validate_no_invented_data(report_text))

    if table_data:
        all_issues.extend(validate_numeric_consistency(report_text, table_data))

    all_issues.extend(validate_required_markers(report_text))

    if required_metrics:
        all_issues.extend(validate_evidence_present(report_text, required_metrics))

    has_errors = any(i["severity"] == "error" for i in all_issues)
    passed = not has_errors

    return passed, all_issues


def format_validation_report(passed: bool, issues: List[Dict]) -> str:
    """Formatea el resultado de la validación para mostrar en consola."""
    lines = []
    status = "APROBADO" if passed else "BLOQUEADO"
    lines.append(f"\n=== VALIDACIÓN DEL INFORME: {status} ===\n")

    if not issues:
        lines.append("Sin problemas detectados.")
        return "\n".join(lines)

    errors = [i for i in issues if i["severity"] == "error"]
    warnings = [i for i in issues if i["severity"] == "advertencia"]

    if errors:
        lines.append(f"ERRORES ({len(errors)}):")
        for e in errors:
            lines.append(f"  [ERROR] {e['description']}")

    if warnings:
        lines.append(f"\nADVERTENCIAS ({len(warnings)}):")
        for w in warnings:
            lines.append(f"  [WARN]  {w['description']}")

    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────
# Validación de marcadores en el DOCX de salida
# ─────────────────────────────────────────────────────────────────

def _extract_all_text_from_docx(docx_path: Path) -> str:
    """Extrae todo el texto del DOCX leyendo el XML directamente."""
    NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    texts = []
    with zipfile.ZipFile(str(docx_path)) as z:
        for name in z.namelist():
            if not (name.startswith("word/") and name.endswith(".xml")):
                continue
            with z.open(name) as f:
                try:
                    tree = ET.parse(f)
                    for t_elem in tree.findall(f".//{{{NS}}}t"):
                        if t_elem.text:
                            texts.append(t_elem.text)
                except ET.ParseError:
                    continue
    return " ".join(texts)


def _is_optional_marker(marker: str, mapping: dict) -> bool:
    for section_data in mapping.values():
        if not isinstance(section_data, dict) or "markers" not in section_data:
            continue
        for entry in section_data["markers"]:
            if entry.get("marker") == marker and entry.get("optional"):
                return True
    return False


def _classify_marker(marker: str) -> str:
    if marker in _METADATA_MARKERS:
        return "metadata"
    if marker.startswith("{TABLA_"):
        return "tabla"
    if marker.startswith("{ANALISIS_"):
        return "analisis"
    if marker.startswith("{SECCION_"):
        return "seccion_fallback"
    return "desconocido"


def find_unreplaced_markers(docx_path: Path) -> List[str]:
    """
    Escanea el DOCX y retorna los marcadores {*} que quedaron sin reemplazar.
    Deduplicados, preservando el orden de aparición.
    """
    if not docx_path.exists():
        return [f"[ERROR: archivo no encontrado: {docx_path}]"]

    full_text = _extract_all_text_from_docx(docx_path)
    found = _MARKER_PATTERN.findall(full_text)
    seen: set = set()
    unique = []
    for m in found:
        if m not in seen:
            seen.add(m)
            unique.append(m)
    return unique


def validate_no_markers_remain(
    docx_path: Path,
    log_path: Optional[Path] = None,
) -> List[Dict]:
    """
    Verifica que no queden marcadores {*} sin reemplazar en el DOCX de salida.

    Clasifica cada marcador residual por tipo y severidad:
      - metadata / tabla / analisis / seccion_fallback → ERROR
      - marcador marcado como optional en marker_mapping.yaml → WARNING

    Registra los resultados en data/processed/design_validation_log.txt.

    Returns:
        Lista de issues [{"marker", "type", "severity"}].
        Lista vacía = validación superada.
    """
    unreplaced = find_unreplaced_markers(docx_path)
    target_log = log_path or _VALIDATION_LOG_PATH

    if not unreplaced:
        _write_marker_log(target_log, docx_path, [])
        return []

    mapping: dict = {}
    if _MARKER_MAPPING_PATH.exists():
        with open(_MARKER_MAPPING_PATH, encoding="utf-8") as f:
            mapping = yaml.safe_load(f) or {}

    issues = []
    for marker in unreplaced:
        severity = "WARNING" if _is_optional_marker(marker, mapping) else "ERROR"
        issues.append({
            "marker": marker,
            "type": _classify_marker(marker),
            "severity": severity,
        })

    _write_marker_log(target_log, docx_path, issues)
    return issues


def _write_marker_log(log_path: Path, docx_path: Path, issues: List[Dict]) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = [
        f"=== Validación de marcadores: {docx_path.name} — {timestamp} ===",
        f"Marcadores sin reemplazar: {len(issues)}",
        "",
    ]
    if not issues:
        lines.append("OK — todos los marcadores fueron reemplazados.")
    else:
        for issue in issues:
            lines.append(f"  [{issue['severity']}] {issue['marker']}  (tipo: {issue['type']})")
    lines.append("")
    with open(log_path, "a", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def print_marker_validation_report(issues: List[Dict]) -> None:
    """Imprime el reporte de validación de marcadores en consola."""
    if not issues:
        print("[OK] Validación de marcadores: todos reemplazados.")
        return
    errors = [i for i in issues if i["severity"] == "ERROR"]
    warnings = [i for i in issues if i["severity"] == "WARNING"]
    print(f"\n[VALIDACIÓN MARCADORES] {len(issues)} sin reemplazar:")
    for i in errors:
        print(f"  [ERROR]   {i['marker']}  ({i['type']})")
    for i in warnings:
        print(f"  [WARNING] {i['marker']}  ({i['type']})")
    if errors:
        print(f"\n  → {len(errors)} error(es) requieren atención.")


# ─────────────────────────────────────────────────────────────────
# Validaciones del nuevo flujo DOCX mensual
# ─────────────────────────────────────────────────────────────────

def validate_all_tables_classified(assignments: List[Dict]) -> List[Dict]:
    """
    Verifica que todas las tablas extraídas del DOCX mensual fueron clasificadas
    y asignadas a una sección. Retorna issues para las tablas sin clasificar.
    """
    issues = []
    for assignment in assignments:
        if assignment.get("section_id") == "sin_seccion":
            for table in assignment.get("tables", []):
                table_id = getattr(getattr(table, "raw", None), "_extracted", None)
                tid = table_id.table_id if table_id else "desconocida"
                issues.append({
                    "type": "tabla_no_clasificada",
                    "severity": "error",
                    "table_id": tid,
                    "description": f"tabla no clasificada - requiere revisión | tabla_id: {tid}",
                })
    return issues


def validate_context_vs_table(
    context_text: str,
    table_values: List[float],
    table_id: str = "",
) -> List[Dict]:
    """
    Detecta posibles contradicciones entre una nota de contexto y los valores
    de la tabla. Compara números mencionados en la nota con los valores reales.

    Heurística: si la nota menciona un número que difiere en más del 20% de
    todos los valores de la tabla, puede ser una contradicción.
    """
    issues = []
    numbers_in_context = re.findall(r"\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?\b", context_text)
    for raw_num in numbers_in_context:
        try:
            val = float(raw_num.replace(".", "").replace(",", "."))
        except ValueError:
            continue
        if val < 1:
            continue
        # Verificar si este número está cerca de algún valor de la tabla
        close_to_any = any(abs(tv - val) / max(abs(tv), 1) < 0.20 for tv in table_values if tv != 0)
        if not close_to_any and table_values:
            issues.append({
                "type": "contradiccion_contexto_tabla",
                "severity": "advertencia",
                "table_id": table_id,
                "value_in_context": raw_num,
                "description": (
                    f"contradicción entre precisión y tabla - requiere revisión | "
                    f"valor en nota: {raw_num} | tabla_id: {table_id}"
                ),
            })
    return issues


def validate_analysis_evidence_source(
    analysis_text: str,
    table_values: List[float],
    context_notes_texts: List[str],
    section_id: str = "",
) -> List[Dict]:
    """
    Valida que las afirmaciones causales del análisis tengan respaldo en datos
    (tabla) o en precisiones (context_notes). Si una causa aparece en el análisis
    pero no en ninguno de los dos, se marca como 'causa inferida'.
    """
    issues = []
    causal_patterns = [
        r"\bdebido\s+a\b", r"\bcomo\s+consecuencia\b", r"\batribuible\s+a\b",
        r"\bmotivado\s+por\b", r"\bderivado\s+de\b", r"\bpor\s+causa\s+de\b",
        r"\boriginado\s+por\b",
    ]
    combined_context = " ".join(context_notes_texts).lower()
    numbers_in_table = {str(int(v)) for v in table_values if v > 0}

    for pattern in causal_patterns:
        # Buscar frases causales en el análisis
        matches = re.finditer(pattern + r"\s+(.{10,80})", analysis_text, re.IGNORECASE)
        for m in matches:
            cause_fragment = m.group(1).lower().strip()
            # ¿Está esta causa en las notas de contexto o tiene respaldo numérico?
            in_context = any(word in combined_context for word in cause_fragment.split()[:4])
            has_numeric_support = any(n in cause_fragment for n in numbers_in_table)
            if not in_context and not has_numeric_support:
                issues.append({
                    "type": "causa_inferida",
                    "severity": "advertencia",
                    "section_id": section_id,
                    "fragment": cause_fragment[:80],
                    "description": (
                        f"causa inferida - requiere revisión | "
                        f"sección: {section_id} | causa: \"{cause_fragment[:60]}...\""
                    ),
                })
    return issues


def validate_docx_ingestion_result(ingestion_result) -> Tuple[bool, List[Dict]]:
    """
    Valida el resultado de la ingesta del DOCX mensual:
      1. El archivo fue encontrado y contiene tablas.
      2. Todas las tablas tienen título o subtítulo identificable.
      3. Las notas de contexto están bien formadas (no vacías).

    Retorna (passed, issues).
    """
    issues = []

    if ingestion_result.total_tables == 0:
        issues.append({
            "type": "sin_tablas",
            "severity": "error",
            "description": "El DOCX mensual no contiene tablas extraíbles. Verificar el archivo.",
        })
        return False, issues

    for table in ingestion_result.tables:
        if not table.title and not table.subtitle:
            issues.append({
                "type": "tabla_sin_titulo",
                "severity": "advertencia",
                "table_id": table.table_id,
                "description": (
                    f"Tabla {table.table_id} no tiene título ni subtítulo identificable. "
                    "La clasificación puede ser menos precisa."
                ),
            })
        for note in table.context_notes:
            if not note.text.strip():
                issues.append({
                    "type": "nota_vacia",
                    "severity": "advertencia",
                    "table_id": table.table_id,
                    "description": f"Nota de contexto vacía en tabla {table.table_id}.",
                })

    has_errors = any(i["severity"] == "error" for i in issues)
    return not has_errors, issues


def scan_master_markers(master_path: Path) -> Dict[str, List[str]]:
    """
    Escanea la plantilla maestra y clasifica los marcadores encontrados.

    Usado por el orquestador (Fase 7) para decidir qué función de reemplazo usar.

    Returns:
        {
          "tabla":    ["{TABLA_INGRESOS}", ...],
          "analisis": ["{ANALISIS_INGRESOS}", ...],
          "seccion":  ["{SECCION_ECONOMIA}", ...],
          "metadata": ["{MES}", "{AÑO}"],
          "otros":    [...],
        }
    """
    all_markers = find_unreplaced_markers(master_path)
    result: Dict[str, List[str]] = {
        "tabla": [], "analisis": [], "seccion": [], "metadata": [], "otros": []
    }
    for marker in all_markers:
        t = _classify_marker(marker)
        if t == "tabla":
            result["tabla"].append(marker)
        elif t == "analisis":
            result["analisis"].append(marker)
        elif t == "seccion_fallback":
            result["seccion"].append(marker)
        elif t == "metadata":
            result["metadata"].append(marker)
        else:
            result["otros"].append(marker)
    return result

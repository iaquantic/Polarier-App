"""Orquestador principal: coordina agentes para generar el informe mensual."""

from pathlib import Path
from typing import List, Dict, Optional
import yaml

from document_loader import load_all_historical
from ingestion import load_input_table, table_to_numeric_dict, save_processed_table
from rule_engine import load_rules
from validation import run_full_validation, format_validation_report


CONFIG_DIR = Path("config")
OUTPUT_DIR = Path("data/output")
ACTIVE_AGENTS_DIR = Path("agents/active")


def load_active_agents() -> List[Dict]:
    """Carga los agentes activos desde agents/active/."""
    agents = []
    if not ACTIVE_AGENTS_DIR.exists():
        return agents
    for md_file in sorted(ACTIVE_AGENTS_DIR.glob("*.md")):
        agents.append({
            "id": md_file.stem,
            "path": str(md_file),
            "content": md_file.read_text(encoding="utf-8"),
        })
    return agents


def load_report_sections() -> List[Dict]:
    """Carga las secciones del informe desde config/report_sections.yaml."""
    sections_file = CONFIG_DIR / "report_sections.yaml"
    if not sections_file.exists():
        return []
    with open(sections_file, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data.get("sections", []) if data else []


def generate_report_skeleton(sections: List[Dict], month: str) -> str:
    """Genera el esqueleto del informe con marcadores para cada sección."""
    lines = [
        f"# Informe de Consejo de Dirección — {month}",
        "",
        "> Generado por el sistema multiagente de Polarier.",
        "> Todas las cifras deben estar respaldadas por la tabla de datos del mes.",
        "",
    ]
    for section in sections:
        title = section.get("title", "Sección sin título")
        agent_id = section.get("agent_id", "[agente no asignado]")
        lines.extend([
            f"## {title}",
            "",
            f"<!-- AGENTE: {agent_id} -->",
            f"<!-- ESTADO: pendiente -->",
            "",
            "[Contenido pendiente de generación por agente especializado]",
            "",
        ])
    return "\n".join(lines)


def run_generation_pipeline(month: str, dry_run: bool = False) -> str:
    """
    Ejecuta el pipeline completo de generación para un mes dado.
    En dry_run solo produce el esqueleto sin llamar a los agentes.
    """
    print(f"\n[INFO] Iniciando generación para el mes: {month}")

    table_rows = load_input_table()
    save_processed_table(table_rows, month)
    table_numeric = table_to_numeric_dict(table_rows)

    sections = load_report_sections()
    if not sections:
        print("[WARN] No hay secciones definidas. Ejecutar primero: python src/main.py discover")

    rules = load_rules()
    active_agents = load_active_agents()

    print(f"[INFO] Secciones: {len(sections)} | Reglas: {len(rules)} | Agentes activos: {len(active_agents)}")

    report_text = generate_report_skeleton(sections, month)

    if not dry_run:
        print("[INFO] Modo completo: los agentes deben completar cada sección manualmente.")
        print("[INFO] Ver prompts/05_monthly_report_run.md para instrucciones.")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    month_slug = month.replace("-", "")
    out_path = OUTPUT_DIR / f"informe_{month_slug}.md"
    out_path.write_text(report_text, encoding="utf-8")
    print(f"[OK] Esqueleto del informe guardado: {out_path}")

    return str(out_path)


def run_audit_pipeline(month: str) -> bool:
    """Ejecuta la auditoría del informe generado para un mes dado."""
    month_slug = month.replace("-", "")
    report_path = OUTPUT_DIR / f"informe_{month_slug}.md"

    if not report_path.exists():
        print(f"[ERROR] Informe no encontrado: {report_path}")
        return False

    report_text = report_path.read_text(encoding="utf-8")
    passed, issues = run_full_validation(report_text)
    print(format_validation_report(passed, issues))
    return passed

"""
Punto de entrada principal del sistema multiagente de Consejo de Dirección de Polarier.

Comandos disponibles:
  discover        — Analiza documentos históricos e infiere secciones, patrones y agentes
  extract-rules   — Extrae reglas de revisión de los DOCX históricos
  build-skills    — Enriquece los SKILL.md base con patrones y reglas descubiertos
  clone-template  — Clona la plantilla maestra al destino mensual (templates/master/)
  generate        — Genera el informe mensual completo en DOCX (requiere archivos en input/)
  build-docx      — Clona master, inserta análisis y tablas → DOCX final
  audit           — Valida el informe generado para un mes dado
  status          — Muestra el estado actual del sistema

Uso:
  python src/main.py discover
  python src/main.py extract-rules
  python src/main.py build-skills
  python src/main.py clone-template --mes ENERO --año 2026
  python src/main.py generate --month 2026-05
  python src/main.py build-docx --mes ENERO --año 2026
  python src/main.py audit --month 2026-05
  python src/main.py status

NOTA: Los comandos extract-layout y build-template han sido desactivados.
El diseño del documento proviene exclusivamente de templates/master/consejo_direccion_master.docx.
"""

import sys
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from document_loader import load_all_historical, validate_historical_dirs
from utils import load_yaml, save_yaml, print_section, timestamp_now


CONFIG_DIR = Path("config")

# Mapa de meses YYYY-MM → nombre en español
_MES_NOMBRES = {
    "01": "ENERO", "02": "FEBRERO", "03": "MARZO", "04": "ABRIL",
    "05": "MAYO", "06": "JUNIO", "07": "JULIO", "08": "AGOSTO",
    "09": "SEPTIEMBRE", "10": "OCTUBRE", "11": "NOVIEMBRE", "12": "DICIEMBRE",
}


def _parse_month(month: str) -> tuple[str, str]:
    """Convierte YYYY-MM → (nombre_mes, año). Ej: '2026-05' → ('MAYO', '2026')."""
    try:
        año, mes_num = month.split("-")
        return _MES_NOMBRES.get(mes_num, mes_num), año
    except ValueError:
        return month.upper(), ""


def cmd_discover():
    """Analiza documentos históricos e infiere secciones, patrones y agentes."""
    print("\n[INFO] Iniciando descubrimiento documental...")

    docs = load_all_historical()
    print(f"[INFO] Documentos encontrados:")
    print(f"  DOCX borradores: {docs['summary']['drafts_count']}")
    print(f"  PDF finales:     {docs['summary']['finals_count']}")

    if docs["summary"]["finals_count"] == 0:
        print("[WARN] No hay PDF finales en data/historical/final_pdfs/")
        print("[WARN] Copiar los PDF aprobados antes de continuar.")
    if docs["summary"]["drafts_count"] == 0:
        print("[WARN] No hay DOCX borradores en data/historical/drafts_docx/")
        print("[WARN] Copiar los DOCX revisados antes de continuar.")

    if docs["total"] == 0:
        print("[ERROR] No hay documentos históricos. Abortar.")
        return

    try:
        from pdf_analyzer import analyze_all_pdfs
        from structure_discovery import discover_sections, discover_patterns, sections_to_yaml_dict, patterns_to_yaml_dict
        from agent_generator import generate_all_agents, agents_to_yaml_dict

        pdf_results = analyze_all_pdfs([d.path for d in docs["finals"]])

        sections = discover_sections(pdf_results)
        patterns = discover_patterns(pdf_results)

        save_yaml(
            sections_to_yaml_dict(sections),
            CONFIG_DIR / "report_sections.yaml",
            comment="report_sections.yaml — generado automáticamente",
        )
        save_yaml(
            patterns_to_yaml_dict(patterns),
            CONFIG_DIR / "analysis_patterns.yaml",
            comment="analysis_patterns.yaml — generado automáticamente",
        )

        agents = generate_all_agents(sections)
        save_yaml(
            agents_to_yaml_dict(agents),
            CONFIG_DIR / "discovered_agents.yaml",
            comment="discovered_agents.yaml — generado automáticamente",
        )

        print_section("Secciones descubiertas", [s.title for s in sections])
        print_section("Patrones detectados", [p.name for p in patterns])
        print_section("Agentes generados", [a["name"] for a in agents])

    except ImportError as e:
        print(f"[WARN] Dependencia no disponible: {e}")
        print("[INFO] Instalar con: pip install pymupdf python-docx pyyaml")


def cmd_extract_rules():
    """Extrae reglas de revisión de los DOCX históricos."""
    print("\n[INFO] Extrayendo reglas de revisión...")

    docs = load_all_historical()
    if docs["summary"]["drafts_count"] == 0:
        print("[WARN] No hay DOCX borradores disponibles.")
        return

    try:
        from docx_comments import extract_all_comments, assign_rule_ids
        from rule_engine import comments_to_rules, save_rules

        comments = extract_all_comments([d.path for d in docs["drafts"]])
        comments = assign_rule_ids(comments)
        rules = comments_to_rules(comments)
        save_rules(rules)

        print_section(f"Reglas extraídas ({len(rules)})", [
            f"{r['id']} [{r['severity']}] {r['category']}: {r['comment'][:60]}..."
            for r in rules
        ])

    except ImportError as e:
        print(f"[WARN] Dependencia no disponible: {e}")
        print("[INFO] Instalar con: pip install python-docx")


def cmd_build_skills():
    """Enriquece los SKILL.md base con patrones y reglas descubiertos."""
    print("\n[INFO] Construyendo skills...")

    try:
        from skill_generator import build_all_skills
        from structure_discovery import discover_patterns
        from pdf_analyzer import analyze_all_pdfs
        from rule_engine import load_rules
        from docx_comments import ReviewComment

        docs = load_all_historical()
        pdf_results = analyze_all_pdfs([d.path for d in docs["finals"]])
        patterns = discover_patterns(pdf_results)

        rules_data = load_rules()
        rules_as_comments = []
        for r in rules_data:
            rc = ReviewComment(
                source_file=r.get("source", ""),
                author=None,
                text=r.get("comment", ""),
                paragraph_context="",
                severity=r.get("severity", "advertencia"),
                category=r.get("category", "redaccion"),
                rule_id=r.get("id"),
            )
            rules_as_comments.append(rc)

        build_all_skills(patterns, rules_as_comments)
        print("[OK] Skills actualizadas.")

    except ImportError as e:
        print(f"[WARN] Dependencia no disponible: {e}")


def cmd_clone_template(mes: str, año: str):
    """Clona la plantilla maestra al destino mensual sin modificar diseño."""
    print(f"\n[INFO] Clonando plantilla maestra para {mes} {año}...")
    try:
        from template_cloner import clone_master, verify_master, master_info
        info = master_info()
        if not info["exists"]:
            print(f"[ERROR] Plantilla maestra no encontrada: {info['path']}")
            print("[ERROR] Coloque el DOCX aprobado en templates/master/consejo_direccion_master.docx")
            return
        print(f"[INFO] Plantilla maestra: {info['path']} ({info['size_kb']} KB)")
        out_path = clone_master(mes=mes, año=año)
        print(f"[OK] Clonado en: {out_path}")
    except ImportError as e:
        print(f"[WARN] Dependencia no disponible: {e}")
        print("[INFO] Instalar con: pip install python-docx")


def cmd_generate(month: str):
    """Genera el informe mensual a partir de múltiples archivos en data/input/mes_actual/."""
    print(f"\n[INFO] Iniciando generación para el mes: {month}")
    mes, año = _parse_month(month)

    # Fase 1 — Ingesta
    try:
        from monthly_file_ingestion import detect_monthly_files, validate_ingestion
        ingestion = detect_monthly_files()
        warnings = validate_ingestion(ingestion)
        for w in warnings:
            print(f"[WARN] {w}")
        if ingestion.total == 0:
            print("[ERROR] No hay archivos en data/input/mes_actual/. Abortar.")
            return
        print(f"[INFO] Archivos detectados: {ingestion.total}")
        for fmt, files in ingestion.by_format.items():
            print(f"  {fmt}: {len(files)} archivo(s)")
    except ImportError as e:
        print(f"[WARN] Módulo de ingesta no disponible: {e}")
        ingestion = None

    # Fase 2 — Extracción de tablas
    if ingestion:
        try:
            from table_extractor import extract_all_tables
            paths = [f.path for f in ingestion.files]
            raw_tables = extract_all_tables(paths)
            print(f"[INFO] Tablas extraídas: {len(raw_tables)}")
        except ImportError as e:
            print(f"[WARN] Módulo de extracción no disponible: {e}")
            raw_tables = []
    else:
        raw_tables = []

    # Fase 3+4 — Clasificación y ordenación
    if raw_tables:
        try:
            from table_classifier import classify_all_tables
            from table_ordering import sort_classified_tables
            classified = classify_all_tables(raw_tables)
            classified = sort_classified_tables(classified)
            known = sum(1 for c in classified if c.category != "desconocida")
            print(f"[INFO] Tablas clasificadas: {known}/{len(classified)} con categoría conocida")
        except ImportError as e:
            print(f"[WARN] Módulo de clasificación no disponible: {e}")
            classified = []
    else:
        classified = []

    # Fase 5 — Mapeo a secciones
    if classified:
        try:
            from section_mapper import map_tables_to_sections, print_section_map
            assignments = map_tables_to_sections(classified)
            print_section_map(assignments)
        except ImportError as e:
            print(f"[WARN] Módulo de mapeo no disponible: {e}")

    # Fase 6-9 — Pipeline de generación (orquestador) + DOCX final
    try:
        from orchestrator import run_generation_pipeline
        run_generation_pipeline(month)
    except ImportError as e:
        print(f"[WARN] Orquestador no disponible: {e}")
        return

    # Fase final — Clonar plantilla y construir DOCX
    cmd_build_docx(mes=mes, año=año)


def cmd_build_docx(mes: str, año: str):
    """Clona la plantilla maestra, inserta análisis y tablas → DOCX final."""
    print(f"\n[INFO] Generando DOCX para {mes} {año}...")

    try:
        from template_cloner import clone_master, verify_master, master_info
    except ImportError as e:
        print(f"[WARN] template_cloner no disponible: {e}")
        return

    info = master_info()
    if not info["exists"]:
        print(f"[ERROR] Plantilla maestra no encontrada: {info['path']}")
        print("[ERROR] Coloque el DOCX aprobado en templates/master/consejo_direccion_master.docx")
        return

    # Paso 1: clonar master
    try:
        out_path = clone_master(mes=mes, año=año)
        print(f"[OK] Plantilla clonada: {out_path}")
    except FileNotFoundError as e:
        print(f"[ERROR] {e}")
        return

    # Paso 2: reemplazar metadatos de período
    try:
        from docx_content_replacer import replace_metadata
        n = replace_metadata(out_path, mes=mes, año=año)
        print(f"[OK] Metadatos de período reemplazados ({n} sustituciones)")
    except ImportError as e:
        print(f"[WARN] docx_content_replacer no disponible: {e}")

    # Paso 3 (prioridad alta): reemplazar marcadores granulares {TABLA_*}
    # Archivo: data/processed/table_markers_{mes}_{año}.yaml
    # Formato: {"{TABLA_INGRESOS}": [["col1","col2"], ["v1","v2"]], ...}
    table_markers_path = Path(f"data/processed/table_markers_{mes.lower()}_{año}.yaml")
    if table_markers_path.exists():
        try:
            from docx_table_replacer import replace_table_markers
            tdata = load_yaml(table_markers_path)
            result = replace_table_markers(out_path, tdata)
            print(f"[OK] Marcadores {{TABLA_*}} reemplazados: {result['replaced']} "
                  f"(fallback: {result['fallback']}, sin match en doc: {len(result['not_found'])})")
        except ImportError as e:
            print(f"[WARN] docx_table_replacer no disponible: {e}")
    else:
        print(f"[INFO] Sin datos granulares de tabla ({table_markers_path.name})")

    # Paso 4 (prioridad alta): reemplazar marcadores granulares {ANALISIS_*}
    # Archivo: data/processed/analysis_markers_{mes}_{año}.yaml
    # Formato: {"{ANALISIS_INGRESOS}": "Texto del análisis...", ...}
    analysis_markers_path = Path(f"data/processed/analysis_markers_{mes.lower()}_{año}.yaml")
    if analysis_markers_path.exists():
        try:
            from docx_content_replacer import replace_analysis_markers
            adata = load_yaml(analysis_markers_path)
            result = replace_analysis_markers(out_path, adata)
            print(f"[OK] Marcadores {{ANALISIS_*}} reemplazados: {result['replaced']} "
                  f"(fallback: {result['fallback']}, sin match en doc: {len(result['not_found'])})")
        except ImportError as e:
            print(f"[WARN] docx_content_replacer no disponible: {e}")
    else:
        print(f"[INFO] Sin datos granulares de análisis ({analysis_markers_path.name})")

    # Paso 5 (fallback): marcadores de sección {SECCION_*}
    # Solo para secciones sin cobertura granular.
    # Archivo: data/processed/sections_{mes}_{año}.yaml
    # Formato: {"economia": {"texts": [...], "tables": [...]}, ...}
    sections_path = Path(f"data/processed/sections_{mes.lower()}_{año}.yaml")
    if sections_path.exists():
        try:
            from docx_content_replacer import replace_section_blocks, build_section_blocks_from_dict
            sdata = load_yaml(sections_path)
            blocks = build_section_blocks_from_dict(sdata)
            result = replace_section_blocks(out_path, blocks)
            not_found_str = ", ".join(result["not_found"]) if result["not_found"] else "ninguno"
            print(f"[OK] Fallback {{SECCION_*}} insertados: {result['replaced']} "
                  f"(no encontrados: {not_found_str})")
        except ImportError as e:
            print(f"[WARN] docx_content_replacer no disponible: {e}")

    # Paso 6: validación — ningún marcador debe quedar sin reemplazar
    try:
        from validation import validate_no_markers_remain, print_marker_validation_report
        issues = validate_no_markers_remain(out_path)
        print_marker_validation_report(issues)
    except ImportError as e:
        print(f"[WARN] validation no disponible: {e}")

    print(f"\n[OK] Documento final: {out_path}")
    print("[INFO] Siguiente paso: python src/main.py audit --month ...")


def cmd_audit(month: str):
    """Valida el informe generado para un mes dado."""
    try:
        from orchestrator import run_audit_pipeline
        passed = run_audit_pipeline(month)
        sys.exit(0 if passed else 1)
    except ImportError as e:
        print(f"[WARN] Dependencia no disponible: {e}")


def cmd_status():
    """Muestra el estado actual del sistema."""
    print("\n=== Estado del sistema Polarier — Consejo de Dirección ===\n")

    dirs = validate_historical_dirs()
    print(f"Directorio DOCX borradores: {'OK' if dirs['drafts_dir_exists'] else 'FALTA'} — {dirs['drafts_dir_path']}")
    print(f"Directorio PDF finales:     {'OK' if dirs['finals_dir_exists'] else 'FALTA'} — {dirs['finals_dir_path']}")

    docs = load_all_historical()
    print(f"\nDocumentos históricos:")
    print(f"  DOCX: {docs['summary']['drafts_count']} archivos")
    print(f"  PDF:  {docs['summary']['finals_count']} archivos")

    for key, filename in [
        ("Secciones", "report_sections.yaml"),
        ("Agentes", "discovered_agents.yaml"),
        ("Reglas", "review_rules.yaml"),
        ("Patrones", "analysis_patterns.yaml"),
    ]:
        path = CONFIG_DIR / filename
        if path.exists():
            data = load_yaml(path)
            main_key = list(data.keys())[0] if data else None
            count = len(data.get(main_key, [])) if main_key else 0
            print(f"  {key}: {count} registros")
        else:
            print(f"  {key}: archivo no generado aún")

    active_agents = list(Path("agents/active").glob("*.md")) if Path("agents/active").exists() else []
    print(f"\nAgentes activos: {len(active_agents)}")

    output_docx = list(Path("data/output").glob("*.docx")) if Path("data/output").exists() else []
    print(f"Informes DOCX generados: {len(output_docx)}")

    # Estado de la plantilla maestra
    master = Path("templates/master/consejo_direccion_master.docx")
    layout_rules = Path("config/layout_rules.yaml")
    print(f"\nDiseño documental:")
    if master.exists():
        size_kb = round(master.stat().st_size / 1024, 1)
        print(f"  Plantilla maestra: OK — {master} ({size_kb} KB)")
    else:
        print(f"  Plantilla maestra: FALTA — colocar en {master}")
    print(f"  layout_rules.yaml: {'OK' if layout_rules.exists() else 'FALTA'}")


def main():
    parser = argparse.ArgumentParser(
        description="Sistema multiagente Polarier — Consejo de Dirección"
    )
    subparsers = parser.add_subparsers(dest="command")

    subparsers.add_parser("discover", help="Analizar documentos históricos")
    subparsers.add_parser("extract-rules", help="Extraer reglas de revisión")
    subparsers.add_parser("build-skills", help="Construir skills")

    clone_parser = subparsers.add_parser("clone-template", help="Clonar plantilla maestra al destino mensual")
    clone_parser.add_argument("--mes", required=True, help="Nombre del mes, e.g. ENERO")
    clone_parser.add_argument("--año", required=True, help="Año, e.g. 2026")

    gen_parser = subparsers.add_parser("generate", help="Generar informe mensual completo (DOCX)")
    gen_parser.add_argument("--month", required=True, help="Mes a generar (YYYY-MM)")

    docx_parser = subparsers.add_parser("build-docx", help="Clonar master + insertar análisis + tablas → DOCX")
    docx_parser.add_argument("--mes", required=True, help="Nombre del mes, e.g. ENERO")
    docx_parser.add_argument("--año", required=True, help="Año, e.g. 2026")

    audit_parser = subparsers.add_parser("audit", help="Auditar informe generado")
    audit_parser.add_argument("--month", required=True, help="Mes a auditar (YYYY-MM)")

    subparsers.add_parser("status", help="Estado del sistema")

    args = parser.parse_args()

    if args.command == "discover":
        cmd_discover()
    elif args.command == "extract-rules":
        cmd_extract_rules()
    elif args.command == "build-skills":
        cmd_build_skills()
    elif args.command == "clone-template":
        cmd_clone_template(args.mes, args.año)
    elif args.command == "generate":
        cmd_generate(args.month)
    elif args.command == "build-docx":
        cmd_build_docx(args.mes, args.año)
    elif args.command == "audit":
        cmd_audit(args.month)
    elif args.command == "status":
        cmd_status()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

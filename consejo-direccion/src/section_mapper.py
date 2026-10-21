"""
Mapeo de tablas clasificadas → secciones del informe → agentes responsables.

Lee config/report_sections.yaml y config/discovered_agents.yaml para
construir el mapa completo: qué tablas van a qué sección, y qué agente
genera el análisis de esa sección.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Dict, Any

from table_classifier import ClassifiedTable


@dataclass
class SectionAssignment:
    section_id: str
    section_title: str
    category: str
    agent_id: str
    tables: List[ClassifiedTable] = field(default_factory=list)
    agent_file: Optional[Path] = None

    @property
    def table_count(self) -> int:
        return len(self.tables)

    @property
    def has_agent(self) -> bool:
        return bool(self.agent_id) and self.agent_id != "sin_asignar"

    def collect_context_notes(self) -> List[Dict]:
        """
        Recopila todas las context_notes de las tablas asignadas a esta sección,
        ordenadas por posición documental.

        Retorna lista de dicts con:
          table_id, note_type, text, position_before, raw_header, is_causal
        """
        notes = []
        for ct in self.tables:
            extracted = getattr(ct.raw, "_extracted", None)
            if extracted is None:
                continue
            for note in extracted.context_notes:
                notes.append({
                    "table_id": extracted.table_id,
                    "table_title": extracted.title,
                    "note_type": note.note_type,
                    "text": note.text,
                    "position_before": note.position_before,
                    "raw_header": note.raw_header,
                    "is_causal": note.is_causal(),
                })
        return notes

    def context_summary_for_agent(self) -> str:
        """
        Genera el bloque de contexto que se envía al agente junto con las tablas.
        Formato legible: sección → tabla → nota.
        """
        notes = self.collect_context_notes()
        if not notes:
            return ""
        lines = ["=== NOTAS DE CONTEXTO DEL DOCX MENSUAL ===\n"]
        current_table = None
        for n in notes:
            if n["table_id"] != current_table:
                current_table = n["table_id"]
                lines.append(f"\n[Tabla: {n['table_id']} — {n['table_title']}]")
            tag = f"[{n['note_type'].upper()}]"
            if n["is_causal"]:
                tag += " [CAUSAL]"
            lines.append(f"  {tag} {n['text']}")
        lines.append("\n=== FIN DE NOTAS DE CONTEXTO ===")
        return "\n".join(lines)


def _load_sections() -> List[dict]:
    path = Path("config/report_sections.yaml")
    if not path.exists():
        return []
    import yaml
    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return data.get("sections", [])


def _load_agents() -> Dict[str, dict]:
    """Retorna mapa category → agente desde discovered_agents.yaml."""
    path = Path("config/discovered_agents.yaml")
    if not path.exists():
        return {}
    import yaml
    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    agents = data.get("agents", [])
    mapping: Dict[str, dict] = {}
    for agent in agents:
        if agent.get("status") not in ("active", "approved"):
            continue
        for section_ref in agent.get("sections", []):
            key = str(section_ref).lower()
            mapping[key] = agent
    return mapping


def _resolve_agent_file(agent_id: str) -> Optional[Path]:
    """Busca el archivo .md del agente en agents/ y agents/active/."""
    for search_dir in (Path("agents/active"), Path("agents")):
        for candidate in (
            search_dir / f"{agent_id}.md",
            search_dir / f"{agent_id}_agent.md",
        ):
            if candidate.exists():
                return candidate
    return None


def map_tables_to_sections(
    classified: List[ClassifiedTable],
) -> List[SectionAssignment]:
    """
    Asigna cada tabla clasificada a su sección e identifica el agente responsable.

    Si report_sections.yaml no existe, crea una asignación por categoría
    directamente (modo de respaldo).
    """
    sections_config = _load_sections()
    agent_map = _load_agents()

    if sections_config:
        return _map_from_config(classified, sections_config, agent_map)
    else:
        return _map_from_categories(classified, agent_map)


def _map_from_config(
    classified: List[ClassifiedTable],
    sections_config: List[dict],
    agent_map: Dict[str, dict],
) -> List[SectionAssignment]:
    assignments: List[SectionAssignment] = []

    for section in sections_config:
        section_id = section.get("id", "")
        section_title = section.get("title", section_id)
        category = (section.get("category") or section_id).lower()

        # Buscar agente para esta sección
        agent = agent_map.get(section_id) or agent_map.get(category) or {}
        agent_id = agent.get("id", "sin_asignar")
        agent_file = _resolve_agent_file(agent_id) if agent_id != "sin_asignar" else None

        # Tablas que corresponden a esta sección
        section_tables = [ct for ct in classified if ct.category == category]

        assignments.append(SectionAssignment(
            section_id=section_id,
            section_title=section_title,
            category=category,
            agent_id=agent_id,
            tables=section_tables,
            agent_file=agent_file,
        ))

    # Tablas sin sección asignada — RULE-012: nunca ignorar, siempre registrar
    assigned_categories = {a.category for a in assignments}
    orphans = [ct for ct in classified if ct.category not in assigned_categories]
    if orphans:
        assignments.append(SectionAssignment(
            section_id="sin_seccion",
            section_title="tabla no clasificada - requiere revisión",
            category="desconocida",
            agent_id="sin_asignar",
            tables=orphans,
        ))

    return assignments


def _map_from_categories(
    classified: List[ClassifiedTable],
    agent_map: Dict[str, dict],
) -> List[SectionAssignment]:
    """Modo de respaldo: una sección por categoría detectada."""
    from table_classifier import group_by_category
    groups = group_by_category(classified)
    assignments = []

    for category, tables in groups.items():
        agent = agent_map.get(category, {})
        agent_id = agent.get("id", "sin_asignar")
        agent_file = _resolve_agent_file(agent_id) if agent_id != "sin_asignar" else None
        assignments.append(SectionAssignment(
            section_id=category,
            section_title=category.capitalize(),
            category=category,
            agent_id=agent_id,
            tables=tables,
            agent_file=agent_file,
        ))

    return assignments


def print_section_map(assignments: List[SectionAssignment]) -> None:
    """Imprime el mapa de secciones para revisión del usuario."""
    print("\n=== Mapa de secciones → tablas → agentes ===\n")
    for a in assignments:
        agent_status = a.agent_id if a.has_agent else "[sin agente asignado]"
        print(f"  [{a.section_id}] {a.section_title}")
        print(f"    Categoría : {a.category}")
        print(f"    Agente    : {agent_status}")
        print(f"    Tablas    : {a.table_count}")
        for ct in a.tables:
            src = ct.raw.source_file
            hdr = ct.raw.header_text()[:60]
            conf = ct.confidence
            print(f"      - {src} | {hdr}... (conf={conf})")
        print()

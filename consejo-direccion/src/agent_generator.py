"""Genera definiciones de agentes especializados desde secciones inferidas."""

from pathlib import Path
from typing import List, Dict
import re

from structure_discovery import DiscoveredSection


AGENTS_DIR = Path("agents")
TEMPLATE_PATH = AGENTS_DIR / "_agent_template.md"


def _section_to_agent_id(title: str) -> str:
    """Convierte un título de sección en un ID de agente snake_case."""
    slug = title.lower()
    slug = re.sub(r"[^\w\s]", "", slug)
    slug = re.sub(r"\s+", "_", slug.strip())
    return f"agent_{slug[:40]}"


def generate_agent_definition(
    section: DiscoveredSection,
    all_sections: List[DiscoveredSection],
) -> str:
    """Genera el contenido Markdown de un agente especializado."""
    agent_id = _section_to_agent_id(section.title)
    return f"""# Agente: {section.title}

## Identificador
`{agent_id}`

## Estado
`pending_review`

## Descripción
Agente especializado en analizar y redactar la sección **"{section.title}"** del informe mensual de Consejo de Dirección de Polarier.

Inferido automáticamente desde {section.frequency} documento(s) histórico(s):
{chr(10).join(f"- {doc}" for doc in section.source_documents)}

## Secciones asignadas
- {section.title}

## Responsabilidades
- Leer los datos relevantes de la tabla mensual de entrada.
- Verificar que los datos necesarios están disponibles antes de redactar.
- Aplicar los patrones de análisis detectados en los PDF finales.
- Cumplir todas las reglas de revisión aplicables a esta sección.
- Producir texto con tono formal ejecutivo.
- Marcar como `[dato no disponible]` cualquier métrica ausente.

## Métricas y KPIs esperados
*(Por descubrir tras análisis documental — completar tras ejecutar `python src/main.py discover`)*

## Reglas aplicables
*(Por asignar tras ejecutar `python src/main.py extract-rules`)*

## Patrones de análisis
*(Por asignar tras ejecutar `python src/main.py discover`)*

## Fuentes de datos esperadas
*(Columnas de la tabla mensual — por descubrir)*

## Restricciones
- No inventar cifras ni estimaciones.
- No mencionar comparaciones sin columna de referencia en la tabla.
- Respetar los títulos de sección exactos de los PDF aprobados.
- Si falta un dato crítico, detener la generación y notificar al orquestador.

## Output esperado
Texto narrativo en Markdown listo para insertar en la sección correspondiente del informe.
"""


def generate_all_agents(sections: List[DiscoveredSection]) -> List[Dict]:
    """Genera archivos de agente para cada sección descubierta."""
    AGENTS_DIR.mkdir(exist_ok=True)
    generated = []

    for section in sections:
        agent_id = _section_to_agent_id(section.title)
        agent_path = AGENTS_DIR / f"{agent_id}.md"
        content = generate_agent_definition(section, sections)

        agent_path.write_text(content, encoding="utf-8")
        generated.append({
            "id": agent_id,
            "name": section.title,
            "path": str(agent_path),
            "status": "pending_review",
        })
        print(f"[OK] Agente generado: {agent_path}")

    return generated


def agents_to_yaml_dict(agents: List[Dict]) -> dict:
    return {
        "agents": [
            {
                "id": a["id"],
                "name": a["name"],
                "description": f"Agente para sección: {a['name']}",
                "sections": [a["name"]],
                "metrics": [],
                "rules_applied": [],
                "patterns_applied": [],
                "source_documents": [],
                "status": "pending_review",
                "created_at": None,
                "approved_at": None,
            }
            for a in agents
        ]
    }

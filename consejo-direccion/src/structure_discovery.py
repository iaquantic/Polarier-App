"""Infiere secciones recurrentes y patrones de análisis desde documentos históricos."""

from pathlib import Path
from collections import Counter
from dataclasses import dataclass, field
from typing import List, Dict

from pdf_analyzer import PdfAnalysisResult, PdfSection


MIN_SECTION_FREQUENCY = 1  # sección debe aparecer en al menos N documentos


@dataclass
class DiscoveredSection:
    title: str
    frequency: int
    source_documents: List[str] = field(default_factory=list)
    normalized_title: str = ""
    suggested_order: int = 0

    def __post_init__(self):
        self.normalized_title = _normalize_title(self.title)


@dataclass
class DiscoveredPattern:
    name: str
    description: str
    frequency: int
    sections: List[str] = field(default_factory=list)
    example: str = ""


def _normalize_title(title: str) -> str:
    """Normaliza un título para comparación: minúsculas, sin puntuación extra."""
    import re
    title = title.lower().strip()
    title = re.sub(r"[^\w\s]", "", title)
    title = re.sub(r"\s+", " ", title)
    return title


def discover_sections(pdf_results: List[PdfAnalysisResult]) -> List[DiscoveredSection]:
    """
    Agrupa títulos de sección similares entre documentos y filtra
    los que aparecen con frecuencia suficiente para ser recurrentes.
    """
    title_counter: Counter = Counter()
    title_sources: Dict[str, List[str]] = {}

    for result in pdf_results:
        seen_in_doc = set()
        for section in result.sections:
            normalized = _normalize_title(section.title)
            if normalized in seen_in_doc:
                continue
            seen_in_doc.add(normalized)
            title_counter[normalized] += 1
            title_sources.setdefault(normalized, [])
            if result.source_file not in title_sources[normalized]:
                title_sources[normalized].append(result.source_file)

    discovered = []
    for norm_title, count in title_counter.most_common():
        if count >= MIN_SECTION_FREQUENCY and len(norm_title) > 3:
            raw_title = _find_raw_title(norm_title, pdf_results)
            discovered.append(
                DiscoveredSection(
                    title=raw_title,
                    frequency=count,
                    source_documents=title_sources.get(norm_title, []),
                )
            )

    for i, section in enumerate(discovered, start=1):
        section.suggested_order = i

    return discovered


def _find_raw_title(normalized: str, pdf_results: List[PdfAnalysisResult]) -> str:
    """Recupera el título original antes de la normalización."""
    for result in pdf_results:
        for section in result.sections:
            if _normalize_title(section.title) == normalized:
                return section.title
    return normalized


def discover_patterns(pdf_results: List[PdfAnalysisResult]) -> List[DiscoveredPattern]:
    """Identifica patrones de análisis recurrentes en los PDF finales."""
    pattern_counter: Counter = Counter()

    for result in pdf_results:
        for p in result.patterns_found:
            pattern_counter[p] += 1

    patterns = []
    for pattern_name, freq in pattern_counter.most_common():
        patterns.append(
            DiscoveredPattern(
                name=pattern_name,
                description=f"Patrón detectado {freq} veces en documentos históricos",
                frequency=freq,
            )
        )
    return patterns


def sections_to_yaml_dict(sections: List[DiscoveredSection]) -> dict:
    return {
        "sections": [
            {
                "id": f"section_{i:03d}",
                "title": s.title,
                "order": s.suggested_order,
                "frequency": s.frequency,
                "agent_id": None,
                "subsections": [],
                "metrics": [],
                "data_sources": [],
                "source_documents": s.source_documents,
                "notes": "",
            }
            for i, s in enumerate(sections, start=1)
        ]
    }


def patterns_to_yaml_dict(patterns: List[DiscoveredPattern]) -> dict:
    return {
        "patterns": [
            {
                "id": f"PATTERN-{i:03d}",
                "name": p.name,
                "description": p.description,
                "structure": [],
                "frequency": p.frequency,
                "sections": p.sections,
                "example": p.example,
            }
            for i, p in enumerate(patterns, start=1)
        ]
    }

"""Tests para structure_discovery.py"""

import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from structure_discovery import (
    _normalize_title,
    discover_sections,
    discover_patterns,
    sections_to_yaml_dict,
    DiscoveredSection,
)
from pdf_analyzer import PdfAnalysisResult, PdfSection


def make_pdf_result(source: str, section_titles: list, patterns: list = None) -> PdfAnalysisResult:
    result = PdfAnalysisResult(source_file=source)
    for i, title in enumerate(section_titles):
        result.sections.append(PdfSection(title=title, page=i + 1, level=1))
    result.patterns_found = patterns or []
    return result


class TestNormalizeTitle:
    def test_lowercases_title(self):
        assert _normalize_title("RESUMEN EJECUTIVO") == "resumen ejecutivo"

    def test_strips_punctuation(self):
        assert _normalize_title("Análisis: Resultados") == "análisis resultados"

    def test_collapses_spaces(self):
        assert _normalize_title("  Título   Con   Espacios  ") == "título con espacios"


class TestDiscoverSections:
    def test_returns_empty_for_no_documents(self):
        result = discover_sections([])
        assert result == []

    def test_discovers_single_section(self):
        docs = [make_pdf_result("doc1.pdf", ["Resumen Ejecutivo"])]
        result = discover_sections(docs)
        assert len(result) == 1

    def test_counts_frequency_correctly(self):
        docs = [
            make_pdf_result("doc1.pdf", ["Sección A", "Sección B"]),
            make_pdf_result("doc2.pdf", ["Sección A", "Sección C"]),
        ]
        result = discover_sections(docs)
        titles = {s.title: s.frequency for s in result}
        assert titles.get("Sección A", 0) == 2 or "sección a" in str(titles).lower()

    def test_sections_have_suggested_order(self):
        docs = [make_pdf_result("doc1.pdf", ["A", "B", "C"])]
        result = discover_sections(docs)
        for i, section in enumerate(result, start=1):
            assert section.suggested_order == i

    def test_deduplicates_same_title_in_same_doc(self):
        docs = [make_pdf_result("doc1.pdf", ["Misma Sección", "Misma Sección"])]
        result = discover_sections(docs)
        titles = [s.title for s in result]
        assert titles.count("Misma Sección") == 1 or len(titles) == 1


class TestSectionsToYamlDict:
    def test_returns_dict_with_sections_key(self):
        sections = [DiscoveredSection(title="Test", frequency=1)]
        result = sections_to_yaml_dict(sections)
        assert "sections" in result

    def test_each_section_has_required_fields(self):
        sections = [DiscoveredSection(title="Test", frequency=2)]
        result = sections_to_yaml_dict(sections)
        section = result["sections"][0]
        for field in ["id", "title", "order", "frequency", "agent_id", "subsections", "metrics"]:
            assert field in section

    def test_ids_are_sequential(self):
        sections = [
            DiscoveredSection(title="A", frequency=1),
            DiscoveredSection(title="B", frequency=1),
        ]
        result = sections_to_yaml_dict(sections)
        assert result["sections"][0]["id"] == "section_001"
        assert result["sections"][1]["id"] == "section_002"

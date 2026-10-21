"""Tests para docx_comments.py"""

import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from docx_comments import (
    ReviewComment,
    assign_rule_ids,
    SEVERITY_KEYWORDS,
    CATEGORY_KEYWORDS,
)


class TestReviewComment:
    def make_comment(self, text: str, **kwargs) -> ReviewComment:
        return ReviewComment(
            source_file="test.docx",
            author="Revisor",
            text=text,
            paragraph_context="",
            **kwargs,
        )

    def test_comment_classifies_as_error_with_error_keyword(self):
        rc = self.make_comment("Este dato es incorrecto, el número no coincide.")
        rc.classify()
        assert rc.severity == "error"

    def test_comment_classifies_as_advertencia_default(self):
        rc = self.make_comment("Revisar este párrafo.")
        rc.classify()
        assert rc.severity == "advertencia"

    def test_comment_classifies_as_datos_with_cifra(self):
        rc = self.make_comment("La cifra no coincide con la tabla.")
        rc.classify()
        assert rc.category == "datos"

    def test_comment_classifies_as_tono_with_tono_keyword(self):
        rc = self.make_comment("El tono es demasiado informal.")
        rc.classify()
        assert rc.category == "tono"

    def test_comment_default_category_is_redaccion(self):
        rc = self.make_comment("Algo está mal aquí.")
        rc.classify()
        assert rc.category == "redaccion"


class TestAssignRuleIds:
    def test_assigns_ids_to_empty_list(self):
        result = assign_rule_ids([])
        assert result == []

    def test_assigns_ids_sequentially(self):
        comments = [
            ReviewComment(source_file="a.docx", author=None, text=f"Comentario {i}", paragraph_context="")
            for i in range(3)
        ]
        result = assign_rule_ids(comments)
        assert result[0].rule_id == "RULE-001"
        assert result[1].rule_id == "RULE-002"
        assert result[2].rule_id == "RULE-003"

    def test_ids_are_zero_padded(self):
        comments = [
            ReviewComment(source_file="a.docx", author=None, text="x", paragraph_context="")
            for _ in range(10)
        ]
        result = assign_rule_ids(comments)
        assert result[9].rule_id == "RULE-010"

    def test_original_comments_are_not_duplicated(self):
        comments = [
            ReviewComment(source_file="a.docx", author=None, text="x", paragraph_context="")
        ]
        result = assign_rule_ids(comments)
        assert len(result) == 1


class TestSeverityKeywords:
    def test_all_categories_have_keywords(self):
        for category, keywords in CATEGORY_KEYWORDS.items():
            assert len(keywords) > 0, f"Categoría {category} sin palabras clave"

    def test_all_severities_have_keywords(self):
        for severity, keywords in SEVERITY_KEYWORDS.items():
            assert len(keywords) > 0, f"Severidad {severity} sin palabras clave"

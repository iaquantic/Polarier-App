"""Tests para document_loader.py"""

import sys
import os
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from document_loader import (
    validate_historical_dirs,
    find_draft_docx,
    find_final_pdfs,
    load_all_historical,
    DRAFTS_DIR,
    FINALS_DIR,
)


class TestDirectoryValidation:
    def test_drafts_dir_path_is_correct(self):
        assert Path("data/historical/drafts_docx") == DRAFTS_DIR

    def test_finals_dir_path_is_correct(self):
        assert Path("data/historical/final_pdfs") == FINALS_DIR

    def test_validate_returns_dict_with_expected_keys(self):
        result = validate_historical_dirs()
        assert "drafts_dir_exists" in result
        assert "finals_dir_exists" in result
        assert "drafts_dir_path" in result
        assert "finals_dir_path" in result

    def test_dirs_exist_after_setup(self):
        result = validate_historical_dirs()
        assert result["drafts_dir_exists"] is True, (
            f"Falta el directorio: {result['drafts_dir_path']}"
        )
        assert result["finals_dir_exists"] is True, (
            f"Falta el directorio: {result['finals_dir_path']}"
        )


class TestDocumentDetection:
    def test_find_docx_returns_list(self):
        result = find_draft_docx()
        assert isinstance(result, list)

    def test_find_pdfs_returns_list(self):
        result = find_final_pdfs()
        assert isinstance(result, list)

    def test_docx_items_have_correct_type(self):
        result = find_draft_docx()
        for doc in result:
            assert doc.doc_type == "draft_docx"
            assert doc.path.suffix.lower() == ".docx"

    def test_pdf_items_have_correct_type(self):
        result = find_final_pdfs()
        for doc in result:
            assert doc.doc_type == "final_pdf"
            assert doc.path.suffix.lower() == ".pdf"

    def test_load_all_historical_returns_expected_structure(self):
        result = load_all_historical()
        assert "drafts" in result
        assert "finals" in result
        assert "total" in result
        assert "summary" in result
        assert isinstance(result["drafts"], list)
        assert isinstance(result["finals"], list)
        assert isinstance(result["total"], int)

    def test_total_equals_sum_of_drafts_and_finals(self):
        result = load_all_historical()
        assert result["total"] == len(result["drafts"]) + len(result["finals"])

    def test_nonexistent_dir_returns_empty_list(self):
        result = find_draft_docx(Path("no/existe"))
        assert result == []

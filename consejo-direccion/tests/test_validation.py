"""Tests para validation.py"""

import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from validation import (
    validate_no_invented_data,
    validate_required_markers,
    validate_evidence_present,
    run_full_validation,
    format_validation_report,
)


class TestNoInventedData:
    def test_clean_text_returns_no_warnings(self):
        text = "La producción registró 1.234 kg durante el mes."
        result = validate_no_invented_data(text)
        assert result == []

    def test_aproximadamente_is_flagged(self):
        text = "Se produjeron aproximadamente 1.000 kg."
        result = validate_no_invented_data(text)
        assert len(result) > 0
        assert result[0]["severity"] == "error"

    def test_se_estima_is_flagged(self):
        text = "Se estima que el total fue de 500 unidades."
        result = validate_no_invented_data(text)
        assert len(result) > 0

    def test_probablemente_is_flagged(self):
        text = "Probablemente el plan no se cumplió."
        result = validate_no_invented_data(text)
        assert len(result) > 0

    def test_podria_ser_is_flagged(self):
        text = "Podría ser que la producción aumente."
        result = validate_no_invented_data(text)
        assert len(result) > 0


class TestRequiredMarkers:
    def test_valid_marker_not_flagged(self):
        text = "El dato de producción es [dato no disponible: produccion_kg]."
        result = validate_required_markers(text)
        assert result == []

    def test_valid_review_marker_not_flagged(self):
        text = "El valor [requiere revisión: cifra contradictoria] no fue confirmado."
        result = validate_required_markers(text)
        assert result == []

    def test_unknown_marker_is_flagged(self):
        text = "El dato [PENDIENTE] no está listo."
        result = validate_required_markers(text)
        assert len(result) > 0


class TestEvidencePresent:
    def test_present_metric_passes(self):
        text = "La producción total fue de 1.234 kg. El plan fue de 1.300 kg."
        result = validate_evidence_present(text, ["producción", "plan"])
        assert result == []

    def test_missing_metric_without_marker_fails(self):
        text = "Solo se habla de producción aquí."
        result = validate_evidence_present(text, ["plan"])
        assert len(result) > 0
        assert result[0]["severity"] == "error"

    def test_missing_metric_with_marker_passes(self):
        text = "La producción fue de 500 kg. [dato no disponible: plan]"
        result = validate_evidence_present(text, ["plan"])
        # El texto contiene el marcador, no debe fallar
        assert result == []


class TestRunFullValidation:
    def test_clean_report_passes(self):
        text = "La producción registró 1.234 kg durante el mes. El plan fue de 1.300 kg."
        passed, issues = run_full_validation(text)
        assert passed is True

    def test_report_with_invented_data_fails(self):
        text = "Se estima que la producción fue aproximadamente 1.000 kg."
        passed, issues = run_full_validation(text)
        assert passed is False
        error_types = [i["type"] for i in issues if i["severity"] == "error"]
        assert "invented_data_risk" in error_types

    def test_format_report_blocked(self):
        issues = [{"severity": "error", "description": "Dato inventado detectado."}]
        report = format_validation_report(False, issues)
        assert "BLOQUEADO" in report
        assert "Dato inventado" in report

    def test_format_report_approved(self):
        report = format_validation_report(True, [])
        assert "APROBADO" in report

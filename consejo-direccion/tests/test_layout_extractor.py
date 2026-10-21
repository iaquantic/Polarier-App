"""Tests para layout_extractor.py y docx_builder.py"""

import sys
import tempfile
import json
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


class TestLayoutRulesYaml:
    """Verifica que config/layout_rules.yaml existe y contiene los valores correctos."""

    RULES_PATH = Path("config/layout_rules.yaml")

    def test_layout_rules_file_exists(self):
        assert self.RULES_PATH.exists(), (
            "config/layout_rules.yaml no existe. "
            "Ejecutar: python src/main.py extract-layout"
        )

    def test_layout_rules_loads_as_yaml(self):
        import yaml
        with open(self.RULES_PATH, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        assert data is not None
        assert isinstance(data, dict)

    def test_layout_rules_has_page_section(self):
        import yaml
        with open(self.RULES_PATH, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        assert "page" in data, "Falta sección 'page' en layout_rules.yaml"

    def test_layout_rules_has_colors_section(self):
        import yaml
        with open(self.RULES_PATH, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        assert "colors" in data, "Falta sección 'colors' en layout_rules.yaml"

    def test_layout_rules_has_typography_section(self):
        import yaml
        with open(self.RULES_PATH, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        assert "typography" in data, "Falta sección 'typography' en layout_rules.yaml"

    def test_page_margins_are_correct(self):
        import yaml
        with open(self.RULES_PATH, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        margins = data.get("page", {}).get("margins", {})
        assert abs(margins.get("top_cm", 0) - 3.00) < 0.1, "Margen superior incorrecto"
        assert abs(margins.get("bottom_cm", 0) - 2.50) < 0.1, "Margen inferior incorrecto"
        assert abs(margins.get("left_cm", 0) - 2.20) < 0.1, "Margen izquierdo incorrecto"
        assert abs(margins.get("right_cm", 0) - 1.50) < 0.1, "Margen derecho incorrecto"

    def test_heading_color_is_corporate_orange(self):
        import yaml
        with open(self.RULES_PATH, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        heading_color = data.get("colors", {}).get("text_heading", "")
        assert heading_color.upper() == "#DD990D", (
            f"Color de encabezado incorrecto: {heading_color}. Debe ser #DD990D"
        )

    def test_table_header_color_is_corporate_yellow(self):
        import yaml
        with open(self.RULES_PATH, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        table_color = data.get("colors", {}).get("table_header_primary", "")
        assert table_color.upper() == "#F4BC46", (
            f"Color de encabezado de tabla incorrecto: {table_color}. Debe ser #F4BC46"
        )

    def test_heading_styles_defined(self):
        import yaml
        with open(self.RULES_PATH, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        heading_styles = data.get("heading_styles", [])
        assert len(heading_styles) >= 3, "Deben estar definidos al menos H1, H2 y H3"

    def test_h1_size_is_20pt(self):
        import yaml
        with open(self.RULES_PATH, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        for h in data.get("heading_styles", []):
            if h.get("level") == 1:
                assert h.get("size_pt") == 20.0, f"H1 debe ser 20pt, encontrado: {h.get('size_pt')}"
                return
        pytest.skip("H1 no definido en heading_styles")

    def test_h2_size_is_16pt(self):
        import yaml
        with open(self.RULES_PATH, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        for h in data.get("heading_styles", []):
            if h.get("level") == 2:
                assert h.get("size_pt") == 16.0, f"H2 debe ser 16pt, encontrado: {h.get('size_pt')}"
                return
        pytest.skip("H2 no definido en heading_styles")

    def test_h3_size_is_14pt(self):
        import yaml
        with open(self.RULES_PATH, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        for h in data.get("heading_styles", []):
            if h.get("level") == 3:
                assert h.get("size_pt") == 14.0, f"H3 debe ser 14pt, encontrado: {h.get('size_pt')}"
                return
        pytest.skip("H3 no definido en heading_styles")

    def test_header_footer_section_exists(self):
        import yaml
        with open(self.RULES_PATH, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        assert "header_footer" in data, "Falta sección 'header_footer' en layout_rules.yaml"


class TestDocxBuilderLayoutRules:
    """Tests de LayoutRules — no requieren python-docx instalado."""

    def test_layout_rules_loads_without_error(self):
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        try:
            from docx_builder import LayoutRules
            rules = LayoutRules()
            assert rules.font is not None
        except ImportError:
            pytest.skip("python-docx no disponible")

    def test_layout_rules_heading_color_correct(self):
        try:
            from docx_builder import LayoutRules
            rules = LayoutRules()
            assert rules.heading_color.upper() == "DD990D"
        except ImportError:
            pytest.skip("python-docx no disponible")

    def test_layout_rules_table_header_color_correct(self):
        try:
            from docx_builder import LayoutRules
            rules = LayoutRules()
            assert rules.table_header_color.upper() == "F4BC46"
        except ImportError:
            pytest.skip("python-docx no disponible")

    def test_layout_rules_margins_within_tolerance(self):
        try:
            from docx_builder import LayoutRules
            rules = LayoutRules()
            m = rules.margins
            assert abs(m["top_cm"] - 3.00) < 0.1
            assert abs(m["bottom_cm"] - 2.50) < 0.1
            assert abs(m["left_cm"] - 2.20) < 0.1
            assert abs(m["right_cm"] - 1.50) < 0.1
        except ImportError:
            pytest.skip("python-docx no disponible")

    def test_heading_sizes_are_correct(self):
        try:
            from docx_builder import LayoutRules
            rules = LayoutRules()
            assert rules.heading_size(1) == 20.0
            assert rules.heading_size(2) == 16.0
            assert rules.heading_size(3) == 14.0
        except ImportError:
            pytest.skip("python-docx no disponible")


class TestDocxBuilderHelpers:
    """Tests de las funciones helper que no requieren un documento real."""

    def test_extract_numeric_positive(self):
        try:
            from docx_builder import _extract_numeric
            assert _extract_numeric("105%") == 105.0
        except ImportError:
            pytest.skip("python-docx no disponible")

    def test_extract_numeric_negative(self):
        try:
            from docx_builder import _extract_numeric
            assert _extract_numeric("-15.5") == -15.5
        except ImportError:
            pytest.skip("python-docx no disponible")

    def test_extract_numeric_no_number(self):
        try:
            from docx_builder import _extract_numeric
            assert _extract_numeric("sin datos") == 0.0
        except ImportError:
            pytest.skip("python-docx no disponible")


class TestLayoutExtractorHelpers:
    """Tests de funciones helper de layout_extractor que no requieren documentos."""

    def test_rgb_to_hex(self):
        try:
            from layout_extractor import _rgb_to_hex
            assert _rgb_to_hex(221, 153, 13) == "#DD990D"
            assert _rgb_to_hex(0, 0, 0) == "#000000"
            assert _rgb_to_hex(255, 255, 255) == "#FFFFFF"
        except ImportError:
            pytest.skip("layout_extractor no disponible")

    def test_synthesize_layout_rules_empty_input(self):
        try:
            from layout_extractor import synthesize_layout_rules
            result = synthesize_layout_rules([], [])
            assert result == {}
        except ImportError:
            pytest.skip("layout_extractor no disponible")

    def test_synthesize_layout_rules_returns_dict(self):
        try:
            from layout_extractor import synthesize_layout_rules, DocxLayoutResult, PageConfig
            mock_result = DocxLayoutResult(source_file="test.docx")
            mock_result.page_config = PageConfig(
                width_cm=21.59, height_cm=27.94,
                margin_top_cm=3.0, margin_bottom_cm=2.5,
                margin_left_cm=2.2, margin_right_cm=1.5,
            )
            result = synthesize_layout_rules([mock_result], [])
            assert isinstance(result, dict)
            assert "page" in result
            assert "colors" in result
        except ImportError:
            pytest.skip("layout_extractor no disponible")


class TestStyleReferenceFile:
    """Verifica que el archivo de referencia visual existe y tiene el contenido esperado."""

    STYLE_REF = Path("templates/document_style_reference.md")

    def test_style_reference_exists(self):
        assert self.STYLE_REF.exists(), "templates/document_style_reference.md no existe"

    def test_style_reference_contains_color_palette(self):
        content = self.STYLE_REF.read_text(encoding="utf-8")
        assert "#DD990D" in content, "Falta el color corporativo #DD990D"
        assert "#F4BC46" in content, "Falta el color de tabla #F4BC46"
        assert "#006100" in content, "Falta el color positivo #006100"
        assert "#9C0006" in content, "Falta el color negativo #9C0006"

    def test_style_reference_contains_margins(self):
        content = self.STYLE_REF.read_text(encoding="utf-8")
        assert "3.00" in content, "Falta el margen superior (3.00 cm)"
        assert "2.50" in content, "Falta el margen inferior (2.50 cm)"
        assert "2.20" in content, "Falta el margen izquierdo (2.20 cm)"
        assert "1.50" in content, "Falta el margen derecho (1.50 cm)"

    def test_style_reference_contains_checklist(self):
        content = self.STYLE_REF.read_text(encoding="utf-8")
        assert "Checklist" in content or "checklist" in content, (
            "Falta el checklist visual en document_style_reference.md"
        )

    def test_style_reference_contains_font(self):
        content = self.STYLE_REF.read_text(encoding="utf-8")
        assert "Agfa Rotis" in content, "Falta la fuente corporativa Agfa Rotis Sans Serif"

    def test_style_reference_mentions_manual_adjustments(self):
        content = self.STYLE_REF.read_text(encoding="utf-8")
        assert "manual" in content.lower(), (
            "Falta la sección de ajustes manuales requeridos"
        )


class TestSkillFileExists:
    """Verifica que el SKILL.md de layout replication existe y tiene estructura correcta."""

    SKILL_PATH = Path("skills/document-layout-replication/SKILL.md")

    def test_skill_file_exists(self):
        assert self.SKILL_PATH.exists(), (
            "skills/document-layout-replication/SKILL.md no existe"
        )

    def test_skill_has_identifier(self):
        content = self.SKILL_PATH.read_text(encoding="utf-8")
        assert "document-layout-replication" in content

    def test_skill_references_layout_rules(self):
        content = self.SKILL_PATH.read_text(encoding="utf-8")
        assert "layout_rules.yaml" in content

    def test_skill_has_color_values(self):
        content = self.SKILL_PATH.read_text(encoding="utf-8")
        assert "#DD990D" in content
        assert "#F4BC46" in content

    def test_skill_has_process_steps(self):
        content = self.SKILL_PATH.read_text(encoding="utf-8")
        assert "Paso 1" in content or "paso 1" in content.lower()

    def test_skill_mentions_manual_adjustments(self):
        content = self.SKILL_PATH.read_text(encoding="utf-8")
        assert "ajuste manual" in content.lower() or "requiere ajuste" in content.lower()

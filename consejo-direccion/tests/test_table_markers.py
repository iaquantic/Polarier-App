"""Tests para table_markers.py y config/table_markers.yaml"""

import re
import sys
from pathlib import Path
import pytest

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "src"))

from docx import Document

from table_markers import (
    TableInfo,
    Rule,
    normalize,
    load_rules,
    classify_tables,
    describe_tables,
    template_table_markers,
)


RULES = load_rules(ROOT / "config" / "table_markers.yaml")


def _t(position, caption="", headings=None, text_before=True, xml=None):
    return TableInfo(position, caption, headings or [], text_before, xml)


def _markers(tables, rules=RULES):
    result = classify_tables(tables, rules)
    return [a.marker for a in result.assignments], result


class TestNormalize:
    def test_quita_tildes_y_mayusculas(self):
        assert normalize("Consumo por kg lavados - Diésel") == "consumo por kg lavados - diesel"

    def test_colapsa_espacios(self):
        assert normalize("  LENCERÍA \n  EN   USO ") == "lenceria en uso"


class TestClasificacion:
    def test_por_titulo(self):
        markers, result = _markers([_t(0, "Cumplimiento del plan de Ingresos")])
        assert result.ok
        assert markers == ["TABLA_INGRESOS"]
        assert result.assignments[0].how == "título"

    def test_el_orden_no_importa(self):
        markers, result = _markers([
            _t(0, "SALARIO MEDIO"),
            _t(1, "Cumplimiento del plan de Ingresos"),
        ])
        assert result.ok
        assert markers == ["TABLA_SALARIO", "TABLA_INGRESOS"]

    def test_por_encabezado_si_el_titulo_no_dice_nada(self):
        markers, result = _markers([
            _t(0, "Descripción | Plan mensual | Real mensual | % de Cumplimiento",
               headings=["ESTADO DEL TRANSPORTE", "Estado de ejecución del presupuesto del transporte"]),
        ])
        assert result.ok
        assert markers == ["TABLA_PRESUPUESTO_TRANSPORTE"]
        assert result.assignments[0].how == "encabezado"

    def test_el_titulo_manda_sobre_el_encabezado(self):
        # Costos y Gastos comparten encabezado; cada una se reconoce por su título
        markers, _ = _markers([
            _t(0, "Cumplimiento del plan de Gastos",
               headings=["Relación entre los gastos y la ocupación"]),
        ])
        assert markers == ["TABLA_GASTOS"]

    def test_continuacion_de_una_tabla_partida(self):
        markers, result = _markers([
            _t(0, "INYECCIONES DE LENCERÍA"),
            _t(1, "Sábana Personal | 10 | 20 | 30", text_before=False),
        ])
        assert result.ok
        assert markers == ["TABLA_INYECCIONES", "TABLA_INYECCIONES"]
        assert result.assignments[1].how == "continuación"

    def test_no_es_continuacion_si_hay_texto_entre_medias(self):
        _, result = _markers([
            _t(0, "INYECCIONES DE LENCERÍA"),
            _t(1, "Sábana Personal | 10 | 20 | 30", text_before=True),
        ])
        assert not result.ok
        assert "tabla 1" in result.errors[0]
        assert "no se reconoce" in result.errors[0]

    def test_no_es_continuacion_de_una_tabla_no_reconocida(self):
        _, result = _markers([
            _t(0, "Tabla desconocida"),
            _t(1, "Otra | sin | título", text_before=False),
        ])
        assert len(result.errors) == 2

    def test_tabla_desconocida_es_error(self):
        _, result = _markers([_t(0, "Algo que nadie ha visto nunca", headings=["Sección nueva"])])
        assert not result.ok
        assert "Algo que nadie ha visto nunca" in result.errors[0]
        assert "Sección nueva" in result.errors[0]

    def test_ambiguedad_es_error(self):
        rules = [
            Rule("TABLA_A", titulo=[re.compile("ingresos")]),
            Rule("TABLA_B", titulo=[re.compile("plan de")]),
        ]
        _, result = _markers([_t(0, "Cumplimiento del plan de Ingresos")], rules)
        assert not result.ok
        assert "TABLA_A" in result.errors[0] and "TABLA_B" in result.errors[0]

    def test_varias_tablas_al_mismo_marcador_en_orden(self):
        tables = [
            _t(0, "Estadísticas Satisfacción Cliente 2026", xml="t0"),
            _t(1, "Estadísticas Satisfacción Cliente 2025", xml="t1"),
            _t(2, "CRECIMIENTO 2026/2025 | 100.00 | 100.00", xml="t2"),
        ]
        result = classify_tables(tables, RULES)
        assert result.ok
        assert result.marker_to_xml(tables) == {"TABLA_SATISFACCION": ["t0", "t1", "t2"]}


class TestReglas:
    def test_todos_los_marcadores_existen_en_la_plantilla(self):
        master = ROOT / "templates" / "master" / "consejo_direccion_master.docx"
        in_template = template_table_markers(Document(str(master)))
        missing = {r.marker for r in RULES} - in_template
        assert not missing, f"Marcadores de table_markers.yaml ausentes en la plantilla: {missing}"

    def test_cada_marcador_aparece_una_sola_vez(self):
        markers = [r.marker for r in RULES]
        assert len(markers) == len(set(markers))


# ─── Contra los DOCX reales ──────────────────────────────────────
# Lo que debe salir de cada uno, comprobado tabla por tabla contra su título.

MENSUAL_SIN_ARRIBOS = [
    "TABLA_INGRESOS", "TABLA_OCUPACION", "TABLA_PRESUPUESTO_GASTOS", "TABLA_COSTOS",
    "TABLA_GASTOS", "TABLA_RELACION_GASTOS_OCUPACION", "TABLA_UTILIDADES",
    "TABLA_COSTO_POR_PESO", "TABLA_INGRESO_TURISTA_DIA", "TABLA_PRECIO_KG",
    "TABLA_CXC", "TABLA_CXP", "TABLA_KG_LAVADOS", "TABLA_KG_TURISTA_DIA",
    "TABLA_CONSUMO_QUIMICOS", "TABLA_MONTAS_HABITACION", "TABLA_MONTAS_CLIENTE",
    "TABLA_LENCERIA_USO", "TABLA_LENCERIA_NUEVA", "TABLA_RECHAZO", "TABLA_MAL_USO",
    "TABLA_DESMANCHE", "TABLA_RETIRO", "TABLA_INYECCIONES", "TABLA_INYECCIONES",
    "TABLA_INVENTARIOS", "TABLA_FALTANTES", "TABLA_DIESEL", "TABLA_ELECTRICIDAD",
    "TABLA_AGUA", "TABLA_CDT", "TABLA_CDO", "TABLA_PRESUPUESTO_TRANSPORTE",
    "TABLA_DISPONIBILIDAD_VEHICULOS", "TABLA_SATISFACCION", "TABLA_SATISFACCION",
    "TABLA_SATISFACCION", "TABLA_SALARIO", "TABLA_TRABAJADORES", "TABLA_VACANTES",
]

REAL_DOCS = {
    # DOCX de entrada reales
    "data/input/procesados_anteriores/Informe junio tablas.docx": MENSUAL_SIN_ARRIBOS,
    "data/input/mes_actual/Informe II Trimestre 2026 tablas.docx": MENSUAL_SIN_ARRIBOS,
    # Borradores históricos: mismas tablas, con variantes que los de entrada no traen
    "data/historical/drafts_docx/informe_202501_draft.docx": (
        MENSUAL_SIN_ARRIBOS[:15] + ["TABLA_ARRIBOS"] + MENSUAL_SIN_ARRIBOS[15:]
    ),
    "data/historical/drafts_docx/informe_202412_draft.docx": (
        MENSUAL_SIN_ARRIBOS[:24]                    # inyecciones en una sola tabla
        + MENSUAL_SIN_ARRIBOS[25:]
        + ["TABLA_MANDO_EXTRANJERO"]
    ),
}


@pytest.mark.parametrize("rel_path", list(REAL_DOCS))
def test_docx_real(rel_path):
    path = ROOT / rel_path
    if not path.exists():
        pytest.skip(f"{rel_path} no está disponible")
    tables = describe_tables(Document(str(path)))
    markers, result = _markers(tables)
    assert result.errors == []
    assert markers == REAL_DOCS[rel_path]

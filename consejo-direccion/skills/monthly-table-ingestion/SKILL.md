# SKILL: monthly-table-ingestion

## Identificador
`monthly-table-ingestion`

## Propósito
Transformar múltiples archivos mensuales heterogéneos en un conjunto de tablas estructuradas, clasificadas y ordenadas, listas para ser procesadas por los agentes especializados del Consejo de Dirección.

Esta skill es la puerta de entrada al pipeline mensual. Su output determina qué secciones se generan, en qué orden y con qué datos.

---

## Entradas

- Directorio: `data/input/mes_actual/`
- Formatos soportados: `.xlsx`, `.xls`, `.csv`, `.docx`, `.pdf`, `.ods`
- Cantidad de archivos: variable (uno o varios por período)
- Configuración de referencia: `config/report_sections.yaml`, `config/table_classification.yaml`

## Salidas

- Lista de `ClassifiedTable`: tablas con categoría, confianza y origen
- Lista de `SectionAssignment`: mapa sección → tablas → agente responsable
- Resumen de ingesta: archivos procesados, tablas encontradas, tablas sin clasificar
- Advertencias: archivos sin soporte, tablas vacías, secciones sin agente

---

## Módulos Python implicados

| Módulo | Responsabilidad |
|---|---|
| `src/monthly_file_ingestion.py` | Detectar archivos en `data/input/mes_actual/` |
| `src/table_extractor.py` | Extraer tablas y estandarizar a `RawTable` |
| `src/table_classifier.py` | Clasificar tablas por categoría temática |
| `src/table_ordering.py` | Ordenar tablas según estructura histórica |
| `src/section_mapper.py` | Mapear tablas → secciones → agentes |

---

## Procedimiento

### Paso 1 — Detectar archivos

```python
from monthly_file_ingestion import detect_monthly_files, validate_ingestion
result = detect_monthly_files()
warnings = validate_ingestion(result)
```

- Si no hay archivos: detener y notificar al usuario.
- Si hay formatos no soportados: registrar advertencia, no detener.

### Paso 2 — Extraer tablas

```python
from table_extractor import extract_all_tables
paths = [f.path for f in result.files]
raw_tables = extract_all_tables(paths)
```

- Cada archivo puede contener una o múltiples tablas.
- Las tablas vacías (sin filas o sin encabezados) se descartan.
- Los errores por archivo individual se registran sin detener el pipeline.

### Paso 3 — Clasificar tablas

```python
from table_classifier import classify_all_tables
classified = classify_all_tables(raw_tables)
```

- La clasificación usa señales de encabezados, nombres de hoja y títulos.
- Tablas sin señal suficiente → `category="desconocida"`, `confidence=0.0`.
- No se asume ni inventa la categoría de una tabla.

### Paso 4 — Ordenar tablas

```python
from table_ordering import sort_classified_tables
sorted_tables = sort_classified_tables(classified)
```

- El orden sigue `config/report_sections.yaml` (generado en el discovery).
- Si no existe el archivo, se aplica el orden por defecto de Polarier:
  `economía → producción → lavanderías → lencería → personal → mantenimiento → energía → comercial → calidad → inversiones`.

### Paso 5 — Agrupar por sección y asignar agentes

```python
from section_mapper import map_tables_to_sections, print_section_map
assignments = map_tables_to_sections(sorted_tables)
print_section_map(assignments)
```

- Cada sección recibe las tablas que le corresponden.
- El agente asignado a cada sección es el definido en `config/discovered_agents.yaml`.
- Si una sección no tiene agente activo: marcar como `[sin agente — requiere revisión]`.

---

## Restricciones absolutas

- **No perder tablas**: toda tabla extraída debe aparecer en alguna sección o en "sin sección asignada". Nunca descartar silenciosamente.
- **No mezclar secciones**: una tabla pertenece exactamente a una sección. No duplicar.
- **No asumir datos**: si una tabla tiene encabezados ambiguos, asignar `category="desconocida"` y documentarlo. No forzar una categoría.
- **No modificar datos**: la extracción es de solo lectura. Los valores de las celdas no se alteran, redondean ni normalizan más allá de quitar espacios en blanco.
- **Fidelidad al orden histórico**: el orden de las secciones viene de los documentos aprobados, no de preferencias del agente ni del orden de los archivos de entrada.

---

## Indicadores de calidad

| Indicador | Valor esperado |
|---|---|
| Tablas con categoría conocida | ≥ 80% |
| Tablas con `confidence > 0.5` | ≥ 70% |
| Secciones sin tablas asignadas | 0 (idealmente) |
| Archivos procesados / archivos detectados | 100% |

Si los indicadores no se cumplen, registrar en `data/processed/ingestion_warnings_YYYYMM.json` antes de continuar.

---

## Integración con el orquestador

El orquestador invoca esta skill como **primer paso** del pipeline mensual, antes de activar ningún agente de análisis. Los `SectionAssignment` resultantes son el único input que los agentes especializados reciben para saber qué tablas analizar.

# Agente: Orquestador

## Identificador
`orchestrator`

## Estado
`active`

## Descripción
Agente coordinador del sistema. Gestiona el flujo completo de generación del informe mensual: coordina la ingesta del DOCX mensual único, la extracción de tablas y context_notes, la clasificación y mapeo a secciones, la secuencia de agentes especializados, el reemplazo de marcadores en el DOCX maestro clonado, las validaciones globales y la entrega del informe final solo cuando pasa la auditoría.

---

## Flujo de ejecución

### Fase 1 — Ingesta del DOCX mensual
1. Detectar el DOCX mensual en `data/input/mes_actual/` mediante `monthly_docx_ingestion.load_monthly_docx()`.
2. El archivo esperado tiene la forma: `Informe MES tablas.docx` (ej. `Informe MAYO tablas.docx`).
3. Validar el resultado con `validation.validate_docx_ingestion_result()`.
4. Registrar advertencias si el DOCX no contiene tablas, tablas sin título, o notas vacías.
5. **Detener si no se encuentra ningún DOCX en el directorio.**

### Fase 2 — Extracción de tablas y context_notes
1. El DOCX mensual contiene en un único documento todas las tablas del período, junto con títulos, subtítulos, precisiones, especificaciones y notas operativas.
2. `monthly_docx_ingestion.ingest_monthly_docx()` recorre el cuerpo del documento en orden XML real, extrayendo:
   - **ExtractedTable**: tabla + posición + título documental + subtítulo
   - **ContextNote**: precisiones, especificaciones, notas, comentarios asociados a la tabla más cercana
3. Convertir `ExtractedTable → RawTable` con `to_raw_tables()` para compatibilidad con el pipeline existente. Cada `RawTable` lleva su `_extracted` adjunto para propagar las `context_notes`.
4. Descartar tablas vacías. Registrar en advertencias, nunca en silencio.

### Fase 3 — Clasificación y ordenación
1. Clasificar cada tabla por categoría temática con `table_classifier.py`.
   - El título documental (de `raw_title`) tiene peso x3 respecto a los encabezados de columna.
   - Las tablas sin clasificación suficiente se marcan como `desconocida` — no se fuerza categoría.
2. Ordenar las tablas clasificadas siguiendo `config/report_sections.yaml`.
3. Registrar confianza de clasificación para revisión posterior.
4. Validar que todas las tablas tienen sección asignada con `validation.validate_all_tables_classified()`.

### Fase 4 — Asignación a agentes
1. Mapear tablas ordenadas → secciones → agentes con `section_mapper.py`.
2. Cada `SectionAssignment` incluye el método `context_summary_for_agent()` que genera el bloque de context_notes formateado para el agente.
3. Cargar `config/review_rules.yaml` y distribuir reglas relevantes a cada agente.
4. Cargar `config/analysis_patterns.yaml` y distribuir patrones a cada agente.
5. Advertir si alguna sección no tiene agente activo asignado.

### Fase 5 — Análisis por agente especializado
1. Invocar cada agente especializado en el orden resultante de la Fase 3.
2. Cada agente recibe:
   - Sus **tablas asignadas** (datos objetivos)
   - Las **context_notes** de esas tablas (`section.context_summary_for_agent()`)
   - Las **reglas** relevantes de revisión histórica
   - Los **patrones de análisis** del config
3. Los agentes usan las context_notes para:
   - Análisis causal de desviaciones (si `is_causal: true`)
   - Aclaraciones y excepciones
   - Distinción entre dato objetivo / interpretación propia / precisión contextual
4. Verificar que el texto generado no contiene marcadores de error.
5. Registrar el estado de cada sección: `pendiente | generado | validado | bloqueado`.

### Fase 6 — Auditoría de contenido
1. Pasar el informe completo a `evidence_auditor_agent` para validación.
2. Si el auditor bloquea: registrar todos los problemas, no entregar el informe.
3. Solo continuar a la Fase 7 si la auditoría aprueba.

### Fase 7 — Detección de marcadores en la plantilla maestra
Antes de construir el DOCX, escanear `templates/master/consejo_direccion_master.docx`
para determinar qué marcadores existen realmente en la plantilla. Leer
`config/marker_mapping.yaml` para conocer todos los marcadores posibles.

```
marcadores_en_plantilla = scan_markers(master_docx)
```

Clasificar los marcadores encontrados en:
- `granulares_tabla`:   `{TABLA_*}` presentes en la plantilla
- `granulares_analisis`: `{ANALISIS_*}` presentes en la plantilla
- `fallback_seccion`:   `{SECCION_*}` presentes (para secciones sin granulares)
- `metadata`:          `{MES}`, `{AÑO}`

### Fase 8 — Construcción del DOCX final

#### 8.1 — Clonar plantilla maestra
```python
from template_cloner import clone_master
out_path = clone_master(mes=mes, año=año)
```

#### 8.2 — Reemplazar metadatos
```python
from docx_content_replacer import replace_metadata
replace_metadata(out_path, mes=mes, año=año)
```

#### 8.3 — Reemplazar marcadores granulares (prioridad alta)

**Si la plantilla tiene marcadores {TABLA_*}:**
```python
from docx_table_replacer import replace_table_markers
result = replace_table_markers(out_path, table_data)
# table_data = {"{TABLA_INGRESOS}": [[filas...]], ...}
```

**Si la plantilla tiene marcadores {ANALISIS_*}:**
```python
from docx_content_replacer import replace_analysis_markers
result = replace_analysis_markers(out_path, analysis_texts)
# analysis_texts = {"{ANALISIS_INGRESOS}": "En el período...", ...}
```

#### 8.4 — Fallback: marcadores de sección {SECCION_*}
Solo para secciones cuya plantilla no tiene marcadores granulares.

```python
from docx_content_replacer import replace_section_blocks, build_section_blocks_from_dict
# Construir solo los bloques de secciones sin cobertura granular
blocks = build_section_blocks_from_dict(fallback_sections_data)
result = replace_section_blocks(out_path, blocks)
```

#### 8.5 — Validación final de marcadores
```python
from validation import validate_no_markers_remain
issues = validate_no_markers_remain(out_path)
# Si issues: registrar y marcar en design_validation_log.txt
```

### Fase 9 — Entrega
1. Guardar el informe aprobado. Output: `data/output/consejo_direccion_{MES}_{AÑO}.docx`
2. Registrar resultado de validación en `data/processed/design_validation_log.txt`.
3. Registrar advertencias de ingesta en `data/processed/ingestion_warnings_{MES}{AÑO}.json`.

---

## Reglas absolutas

- No completar ni rellenar secciones que los agentes especializados no hayan generado.
- No modificar cifras ni texto generado por los agentes sin marcarlos explícitamente.
- Si un agente falla o produce output vacío: insertar el fallback del marcador, no ignorar.
- El orquestador no genera contenido narrativo; solo coordina y valida.
- El orden de secciones lo determina el discovery histórico (`config/report_sections.yaml`), no el usuario en tiempo de ejecución.
- Toda tabla extraída debe estar asignada a alguna sección. Nunca descartar silenciosamente (RULE-012).
- **Prioridad de marcadores**: granulares ({TABLA_*}, {ANALISIS_*}) sobre sección ({SECCION_*}). Nunca omitir un marcador granular para usar el de sección si ambos existen.

---

## Estrategia de marcadores

```
Plantilla maestra tiene {TABLA_INGRESOS}  →  replace_table_markers()   ← USAR ESTO
Plantilla maestra tiene {ANALISIS_INGRESOS} → replace_analysis_markers() ← USAR ESTO
Plantilla maestra solo tiene {SECCION_ECONOMIA} → replace_section_blocks()  ← FALLBACK
```

El orquestador detecta automáticamente qué marcadores existen en la plantilla
y aplica la función correcta. No falla si un marcador no existe en la plantilla.

---

## Inputs
- `data/input/mes_actual/Informe MES tablas.docx` — DOCX mensual único (obligatorio)
- `templates/master/consejo_direccion_master.docx` — plantilla maestra (obligatoria)
- `config/report_sections.yaml`
- `config/review_rules.yaml`
- `config/analysis_patterns.yaml`
- `config/marker_mapping.yaml`
- `config/table_classification.yaml`
- `agents/active/*.md`

## Outputs
- `data/output/consejo_direccion_{MES}_{AÑO}.docx` — documento final
- `data/processed/design_validation_log.txt` — marcadores sin reemplazar
- `data/processed/audit_{MES}{AÑO}.json` — resultado de la auditoría de contenido
- `data/processed/ingestion_warnings_{MES}{AÑO}.json` — advertencias de ingesta

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# CLAUDE.md — Proyecto Polarier: Consejo de Dirección

## Comandos principales

### Dependencias

```
pip install python-docx PyYAML pandas pymupdf lxml
```

### Punto de entrada CLI — `src/main.py`

```
# Fase inicial (solo cuando se incorporan documentos históricos nuevos)
python src/main.py discover          # Analiza PDFs/DOCX históricos → config/*.yaml
python src/main.py extract-rules     # Extrae reglas de comentarios DOCX → config/review_rules.yaml
python src/main.py build-skills      # Enriquece skills con patrones y reglas

# Operaciones mensuales
python src/main.py status            # Estado del sistema (plantilla, agentes, archivos)
python src/main.py clone-template --mes ENERO --año 2026
python src/main.py build-docx --mes ENERO --año 2026
python src/main.py audit --month 2026-01

# Flujo completo (ingesta multi-archivo legacy)
python src/main.py generate --month 2026-05
```

### Generador mensual directo — `scripts/generate_report.py`

Este es el script usado en producción. No recibe argumentos; lo detecta todo automáticamente.

```
# Ejecutar siempre desde la raíz del proyecto
py -3 scripts/generate_report.py
```

Prerequisitos antes de ejecutarlo:
1. `data/input/mes_actual/Informe MES tablas.docx` — un único DOCX en esa carpeta.
2. `data/processed/analisis_{mes}_{año}.json` — JSON con los textos de análisis.
3. `templates/master/consejo_direccion_master.docx` — plantilla maestra.

Produce: `data/output/consejo_direccion_{MES}_{AÑO}.docx`

### Verificar marcadores pendientes en el DOCX de salida

El propio script reporta al final si quedan marcadores `{…}` sin reemplazar. Si los hay, revisar `config/table_markers.yaml` o el JSON de análisis.

---

## Objetivo del proyecto

Este sistema multiagente genera los informes mensuales del Consejo de Dirección de Polarier (empresa de gestión de lavanderías en Cuba). Los informes son analizados por la dirección ejecutiva y deben reflejar fielmente la situación operativa, comercial y financiera de la empresa a partir de datos tabulares mensuales.

El sistema aprende su estructura, agentes, reglas y patrones de análisis **exclusivamente desde documentos históricos reales**. No se define ningún agente ni sección de forma manual al inicio.

---

## Fuentes de conocimiento histórico

### DOCX revisados (`data/historical/drafts_docx/`)

- Son borradores que han recibido comentarios de revisión de la dirección.
- **Los comentarios de revisión son reglas correctivas obligatorias.**
- Cada comentario indica un error, imprecisión o deficiencia de redacción que **no debe repetirse**.
- El sistema debe extraer, clasificar y almacenar cada comentario como una regla en `config/review_rules.yaml`.

### PDF finales (`data/historical/final_pdfs/`)

- Son versiones aprobadas y enviadas al Consejo de Dirección.
- Representan el **estándar de calidad, estructura, tono y profundidad** del análisis.
- El sistema debe analizar estos documentos para descubrir:
  - Secciones recurrentes del informe.
  - Aspectos empresariales analizados en cada sección.
  - Patrones de redacción, comparación y conclusión.
  - Métricas y KPIs mencionados.

---

## Reglas absolutas del sistema

### Prohibición de inventar datos

- **Está terminantemente prohibido generar cifras, porcentajes, rankings o valoraciones que no estén respaldados por los datos de entrada.**
- Si un dato no está disponible en la tabla mensual, debe marcarse explícitamente como `[dato no disponible]` o `[requiere revisión]`.
- Nunca usar expresiones como "aproximadamente", "se estima" o "podría" para sustituir datos faltantes.

### Validación de evidencia

- Toda afirmación cuantitativa debe referenciar su fuente en los datos de entrada.
- Toda comparación (vs. plan, vs. mes anterior, vs. año anterior) debe basarse en columnas existentes en la tabla.
- Antes de generar cualquier sección narrativa, el agente correspondiente debe confirmar que los datos existen y son coherentes.

### Coherencia entre tabla y texto

- Los totales, subtotales y rankings mencionados en el texto deben coincidir exactamente con los valores de la tabla de entrada.
- Si se detecta una discrepancia entre tabla y texto durante la validación, el informe debe detenerse y registrar el conflicto.

### Tono formal del Consejo de Dirección

- El lenguaje debe ser formal, ejecutivo y directo.
- Se evitan expresiones coloquiales, valoraciones subjetivas sin respaldo y redundancias.
- Las secciones siguen una estructura: **contexto → análisis → conclusión o acción recomendada**.
- Los títulos de sección deben ser consistentes con los documentos históricos aprobados.

### Regla de cifras en los textos de análisis (obligatoria)

**Los textos de análisis (`{ANALISIS_*}`, `{SECCION_*}`, `{INTRO_*}`) NO repiten las cifras absolutas que ya aparecen en las tablas del informe.**

El lector ve las tablas justo antes de cada bloque de análisis. Repetir los valores exactos (montos en CUP, USD, kg totales, número de prendas, etc.) es redundante.

El texto analítico debe expresar todo en términos **relativos**: porcentajes de cumplimiento, variaciones interanuales, posiciones relativas entre polos, tendencias y causas.

- **Permitido**: "el polo alcanza el 96% del plan", "registra un sobregiro de 48 puntos porcentuales sobre el plan", "creció un 6% respecto a mayo de 2025".
- **Prohibido**: "el polo alcanza 1,200,000.00 CUP", "la desviación absoluta es de -98,765,432.10 CUP", "totalizan 123,456 prendas".

Excepción: ratios e índices calculados (CUP/TD, kg/TD, L/kg, kWh/kg, CUP/kg) que no figuran como dato directo en la tabla sí pueden mencionarse cuando contextualizan el análisis.

---

## Flujo de trabajo del sistema

1. **Descubrimiento documental**: analizar DOCX y PDF históricos para inferir estructura, agentes, reglas y patrones.
2. **Inferencia de agentes**: crear un agente especializado por cada aspecto importante y recurrente detectado.
3. **Extracción de reglas**: convertir comentarios de revisión en reglas almacenadas y aplicables.
4. **Generación de skills**: construir skills reutilizables desde los patrones detectados.
5. **Generación mensual**: recibir múltiples archivos mensuales, extraer y clasificar tablas, aplicar agentes y skills, producir informe validado.
6. **Auditoría**: verificar coherencia, evidencia y cumplimiento de reglas antes de entregar el informe.

---

## Responsabilidades en la generación mensual

### Lo que hace el usuario
- Colocar el DOCX de tablas del mes en `data/input/mes_actual/` con el nombre `Informe MES tablas.docx`.
- Decirle a Claude Code: **"genera el informe de [MES]"**.

### Lo que hace Claude Code (automáticamente, sin intervención adicional)
1. Leer el DOCX de entrada y extraer todas las tablas y notas contextuales.
2. Analizar cada sección con los agentes especializados (`agents/active/`).
3. Redactar todos los textos de análisis aplicando la skill `council-report-writing`.
4. Crear el JSON de análisis en `data/processed/analisis_{mes}_{año}.json`.
5. Ejecutar `scripts/generate_report.py` para producir el DOCX final.
6. Entregar el informe en `data/output/consejo_direccion_{MES}_{AÑO}.docx`.

El usuario no necesita tocar ningún otro archivo, configuración ni parámetro.

---

## Reglas de generación del informe

### Flujo mensual real

Mensualmente el usuario proporciona un **único DOCX** ubicado en `data/input/mes_actual/`:

```
data/input/mes_actual/Informe MES tablas.docx
```

Este DOCX contiene todas las tablas del período en el orden del informe, junto con títulos, subtítulos, precisiones, especificaciones y notas operativas que contextualizan cada tabla.

El sistema debe:

1. Detectar el DOCX mensual en `data/input/mes_actual/` con `monthly_docx_ingestion.load_monthly_docx()`.
2. Extraer tablas **y context_notes** (precisiones, especificaciones, notas) en orden documental.
   - Las context_notes se asocian a la tabla más cercana (anterior o posterior).
   - Cada context_note tiene: `note_type`, `text`, `position_before`, `raw_header`, `is_causal()`.
3. Convertir `ExtractedTable → RawTable` con `to_raw_tables()` (mantiene `_extracted` como puente).
4. Clasificar cada tabla por categoría temática — el título documental tiene peso x3 sobre los encabezados de columna.
5. Mapear tablas clasificadas → secciones del informe → agentes con `section_mapper.py`.
6. Activar el agente de cada sección. Cada agente recibe:
   - Sus tablas asignadas (datos objetivos).
   - El bloque de context_notes (`section.context_summary_for_agent()`).
7. Los agentes usan las context_notes para explicar desviaciones causalmente, sin inventar.
8. Consolidar todas las secciones en un único documento.
9. Validar que cada análisis esté respaldado por datos reales o context_notes causales.
10. Aplicar las reglas derivadas de los comentarios de revisión históricos.
11. Generar el documento final en formato DOCX respetando el diseño histórico.

**El usuario NO debe indicar el orden, las secciones ni los agentes. El sistema los infiere automáticamente.**

**El usuario NO debe separar las precisiones en archivos aparte. Van dentro del DOCX mensual.**

#### Módulos de ingesta

| Módulo | Estado | Uso |
|---|---|---|
| `src/monthly_docx_ingestion.py` | **Primario** | DOCX mensual único con tables + context_notes |
| `src/monthly_file_ingestion.py` | Secundario / compatibilidad | Archivos múltiples (Excel, CSV, PDF) — flujos heredados |

---

### Diseño documental

#### Plantilla maestra DOCX (regla absoluta)

**El sistema NO genera el diseño del documento desde cero.**

El diseño visual completo del informe (fuentes, colores, márgenes, tablas, encabezados, pies de página) proviene exclusivamente de la plantilla maestra aprobada:

```
templates/master/consejo_direccion_master.docx
```

Reglas:
- Cada mes: clonar la plantilla maestra → `data/output/consejo_direccion_{MES}_{AÑO}.docx`.
- Solo se reemplaza contenido (textos de análisis, datos de tablas, marcadores de mes/año).
- **Nunca modificar estilos, fuentes, colores, bordes ni estructura.**
- Si la plantilla maestra no existe: detener el proceso y notificar. No intentar recrear el diseño.
- No usar `layout_extractor.py` ni `docx_builder.py` en el flujo de generación mensual.

Ver `config/layout_rules.yaml` para los parámetros de control del flujo de clonado.
Ver `agents/active/agent_diseno_documental.md` para el flujo completo paso a paso.

#### Estrategia de marcadores (prioridad)

El sistema usa marcadores en la plantilla maestra para ubicar el contenido. La prioridad es:

1. **Marcadores granulares** `{TABLA_*}` y `{ANALISIS_*}` — prioridad alta.
   - Cada marcador ocupa un párrafo completo.
   - `{TABLA_INGRESOS}` → reemplazado por la tabla de ingresos real.
   - `{ANALISIS_INGRESOS}` → reemplazado por el texto del análisis de ingresos.
   - Permiten posicionar cada elemento exactamente donde el diseñador lo decidió.

2. **Marcadores de sección** `{SECCION_*}` — solo como **fallback**.
   - Se usan cuando la plantilla no tiene marcadores granulares para esa sección.
   - Reemplazan el párrafo marcador por el bloque completo (textos + tablas).

Todos los marcadores posibles están definidos en `config/marker_mapping.yaml`.

**Regla**: si la plantilla maestra tiene `{TABLA_INGRESOS}` y `{ANALISIS_INGRESOS}`, se usan esos y **no** se busca `{SECCION_ECONOMIA}` para esa sección. Nunca degradar a sección cuando existan granulares.

#### Uso de logo corporativo

El logo corporativo está embebido en la plantilla maestra. No requiere inserción manual en cada informe mensual. Si la plantilla maestra fue construida correctamente, el logo ya está en el encabezado.

Si el archivo `assets/logo_polarier.png` existe, puede usarse para actualizar la plantilla maestra manualmente cuando sea necesario.

---

## Comportamiento de los agentes Claude Code

- Los agentes leen `config/review_rules.yaml` antes de redactar cualquier sección.
- Los agentes leen `config/analysis_patterns.yaml` para reproducir los patrones de los PDF finales.
- Los agentes no deben asumir valores por defecto ni completar datos ausentes con estimaciones.
- El agente `evidence_auditor` tiene autoridad para bloquear la entrega del informe si detecta inconsistencias.
- Todos los agentes registran sus hallazgos en `data/extracted/` o `data/processed/` según corresponda.

---

## Asignación de tablas a marcadores (scripts/generate_report.py)

Cada tabla del DOCX de entrada se asigna a su marcador `{TABLA_*}` **por lo que dice, no por su posición**. Las reglas están en `config/table_markers.yaml` y la lógica en `src/table_markers.py`. Por orden:

1. **Título**: la primera fila de la tabla. Casi todas las tablas del DOCX mensual llevan ahí su nombre ("Cumplimiento del plan de Ingresos", "LENCERÍA EN USO").
2. **Encabezado**: si la primera fila no casa, el título de sección (H1/H2/H3) justo encima, sin otra tabla en medio. Es el caso del presupuesto de transporte, que empieza directamente por columnas.
3. **Continuación**: si tampoco, y la tabla va pegada a la anterior (sin párrafos con texto entre las dos), recibe el mismo marcador. Es el caso de las inyecciones de lencería, partidas en dos tablas de Word.

Los patrones se comparan en minúsculas y sin tildes.

Una tabla que no se reconoce, o que casa con dos marcadores, **detiene el script antes de clonar la plantilla**, indicando qué tabla es. También se detiene si una regla apunta a un marcador que no existe en la plantilla maestra. Si un mes trae una tabla nueva, se añade su patrón en `config/table_markers.yaml` (y su marcador en la plantilla). Nunca se coloca una tabla a ciegas.

Varias tablas pueden compartir marcador y se insertan seguidas, en el orden del DOCX. Así van las de satisfacción: año en curso, año anterior y la fila de `CRECIMIENTO`, todas bajo `{TABLA_SATISFACCION}`, como en los informes aprobados.

`tests/test_table_markers.py` comprueba la asignación tabla por tabla contra los DOCX reales (junio, II Trimestre y los dos borradores históricos).

---

## Estructura del JSON de análisis (`data/processed/analisis_{mes}_{año}.json`)

```json
{
  "sections": {
    "ANALISIS_INGRESOS": "Texto del análisis de ingresos...",
    "ANALISIS_OCUPACION": "...",
    "SECCION_ECONOMIA": "Texto de sección completa (fallback)...",
    "INTRO_APERTURA": "Párrafo introductorio..."
  }
}
```

- Claves `ANALISIS_*` → marcadores granulares (prioridad alta).
- Claves `SECCION_*` e `INTRO_*` → marcadores de sección (fallback).
- Valores `[dato no disponible]` se omiten automáticamente.

---

## Archivos de configuración clave

| Archivo | Propósito |
|---|---|
| `config/discovered_agents.yaml` | Agentes inferidos desde documentos históricos |
| `config/report_sections.yaml` | Secciones del informe descubiertas |
| `config/review_rules.yaml` | Reglas extraídas de comentarios de revisión |
| `config/analysis_patterns.yaml` | Patrones de análisis de PDF finales |
| `config/skills.yaml` | Registro de skills disponibles |
| `config/document_sources.yaml` | Formatos de archivo aceptados y reglas de ingesta |
| `config/table_classification.yaml` | Reglas para clasificar tablas por tipo y sección |

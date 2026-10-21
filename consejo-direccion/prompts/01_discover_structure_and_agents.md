# Prompt 01 — Descubrimiento de estructura y agentes

## Cuándo usar
Primera vez que se incorporan documentos históricos al sistema, o cuando se añaden nuevos documentos.

## Prerequisitos
- Al menos un PDF en `data/historical/final_pdfs/`
- Al menos un DOCX en `data/historical/drafts_docx/`

## Instrucción para Claude Code

Analiza todos los documentos históricos disponibles en `data/historical/` y realiza el descubrimiento completo del sistema.

### Paso 1: Analizar PDF finales
Para cada PDF en `data/historical/final_pdfs/`:
1. Extrae todos los títulos de sección y subsección.
2. Identifica las métricas y KPIs que aparecen con frecuencia.
3. Detecta los patrones de análisis recurrentes (plan vs real, rankings, tendencias).
4. Registra fragmentos de texto representativos de cada sección.

### Paso 2: Analizar DOCX revisados
Para cada DOCX en `data/historical/drafts_docx/`:
1. Extrae todos los comentarios de revisión con su texto completo.
2. Identifica el fragmento del documento al que hace referencia cada comentario.
3. Clasifica cada comentario por categoría y severidad.

### Paso 3: Inferir secciones canónicas
1. Agrupa los títulos equivalentes encontrados en los diferentes PDF.
2. Ordénalos por frecuencia de aparición.
3. Define el título canónico para cada sección (el más frecuente o el más reciente).
4. Actualiza `config/report_sections.yaml` con la lista inferida.

### Paso 4: Inferir patrones de análisis
1. Identifica los patrones narrativos recurrentes en los PDF finales.
2. Define la estructura de cada patrón.
3. Asocia cada patrón con las secciones donde aparece.
4. Actualiza `config/analysis_patterns.yaml`.

### Paso 5: Proponer agentes especializados
Para cada sección canónica identificada:
1. Crea un archivo de agente en `agents/` siguiendo `agents/_agent_template.md`.
2. Rellena: secciones asignadas, métricas esperadas, patrones aplicables.
3. Deja el estado en `pending_review`.
4. Actualiza `config/discovered_agents.yaml` con todos los agentes propuestos.

### Paso 6: Informe de descubrimiento
Al finalizar, muestra un resumen con:
- Número de documentos analizados (PDF y DOCX).
- Secciones canónicas descubiertas (lista con frecuencia).
- Patrones de análisis detectados.
- Agentes propuestos (pendientes de revisión humana).
- Advertencias o documentos que no pudieron procesarse.

## Restricciones
- No generar ningún informe mensual en este paso.
- No definir agentes sin base en los documentos analizados.
- Si no hay documentos, registrar el error y detenerse.

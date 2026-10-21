# Prompt 03 — Generación de skills iniciales

## Cuándo usar
Después de extraer las reglas (Prompt 02) y el descubrimiento (Prompt 01).

## Prerequisitos
- `config/review_rules.yaml` con al menos algunas reglas
- `config/analysis_patterns.yaml` con al menos algunos patrones

## Instrucción para Claude Code

Enriquece los archivos SKILL.md base con los patrones y reglas descubiertos en los documentos históricos.

### Paso 1: Leer estado actual
1. Cargar `config/review_rules.yaml` — todas las reglas disponibles.
2. Cargar `config/analysis_patterns.yaml` — todos los patrones disponibles.
3. Cargar `config/skills.yaml` — lista de skills registradas.
4. Verificar que los archivos SKILL.md base existen en `skills/`.

### Paso 2: Enriquecer skill `document-structure-mining`
Añadir al SKILL.md:
- Los títulos de sección más frecuentes detectados como ejemplos concretos.
- Criterios de tamaño de fuente específicos si se detectaron en los PDF.

### Paso 3: Enriquecer skill `docx-comment-extraction`
Añadir al SKILL.md:
- Ejemplos de comentarios reales extraídos (anonimizados si es necesario).
- Patrones de lenguaje frecuentes en los comentarios de revisión de Polarier.

### Paso 4: Enriquecer skill `pdf-final-report-analysis`
Añadir al SKILL.md:
- Los patrones de análisis detectados en los PDF históricos con ejemplos reales.
- El vocabulario ejecutivo específico de Polarier.

### Paso 5: Enriquecer skill `rule-inference-from-revisions`
Añadir al SKILL.md:
- Las reglas RULE-NNN de alta severidad como casos de estudio.
- Ejemplos de transformación comentario → regla.

### Paso 6: Enriquecer skill `business-analysis-patterns`
Añadir al SKILL.md:
- Los patrones PATTERN-NNN con sus fragmentos de ejemplo reales.
- Las secciones específicas de Polarier donde aplica cada patrón.

### Paso 7: Enriquecer skill `evidence-validation`
Añadir al SKILL.md:
- Las reglas de categoría "datos" como criterios de validación.
- Los casos de error más frecuentes detectados en los DOCX revisados.

### Paso 8: Enriquecer skill `council-report-writing`
Añadir al SKILL.md:
- El vocabulario ejecutivo específico de Polarier extraído de los PDF.
- Las expresiones prohibidas identificadas en los comentarios de revisión.
- Fragmentos de texto aprobado como ejemplos de estilo correcto.

### Paso 9: Evaluar si crear skills nuevas
Revisar si hay:
- Patrones recurrentes sin skill dedicada.
- Capacidades técnicas requeridas no cubiertas.
Si se detectan, crear nuevos SKILL.md y registrarlos en `config/skills.yaml`.

### Paso 10: Informe de skills
Al finalizar, mostrar:
- Skills enriquecidas con el número de elementos añadidos a cada una.
- Nuevas skills creadas (si aplica).
- Skills que quedaron vacías porque no hay patrones ni reglas que las respalden.

## Restricciones
- No borrar contenido existente de los SKILL.md.
- No crear skills sin patrones ni reglas concretas que las respalden.
- El enriquecimiento debe usar datos reales de los documentos históricos.

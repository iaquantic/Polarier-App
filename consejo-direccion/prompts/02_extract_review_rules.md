# Prompt 02 — Extracción de reglas de revisión

## Cuándo usar
Después del descubrimiento (Prompt 01), o cuando se añaden nuevos DOCX revisados.

## Prerequisitos
- Al menos un DOCX con comentarios de revisión en `data/historical/drafts_docx/`
- `data/extracted/raw_comments.json` puede o no existir (se regenera)

## Instrucción para Claude Code

Lee todos los DOCX de `data/historical/drafts_docx/` y convierte sus comentarios de revisión en reglas formales reutilizables.

### Paso 1: Extraer comentarios de cada DOCX
Para cada DOCX disponible:
1. Abre el archivo y extrae todos los comentarios de revisión.
2. Para cada comentario, registra:
   - Texto completo del comentario.
   - Autor del comentario (si está disponible).
   - Fragmento del texto del documento al que hace referencia.
   - Número de página o sección aproximada.
3. Guarda todos los comentarios en bruto en `data/extracted/raw_comments.json`.

### Paso 2: Clasificar por categoría y severidad
Para cada comentario:
- **Categoría**: datos | redaccion | estructura | tono | coherencia
- **Severidad**: error | advertencia | sugerencia
Aplicar los criterios definidos en `skills/rule-inference-from-revisions/SKILL.md`.

### Paso 3: Transformar en reglas formales
Para cada comentario clasificado:
1. Redactar la regla en positivo: "El texto DEBE..." o "El texto NO DEBE...".
2. Asignar a una sección específica o a "global" si aplica a todo el informe.
3. Si el contexto lo permite, generar ejemplo de texto incorrecto y correcto.
4. Asignar ID correlativo: RULE-001, RULE-002, etc.

### Paso 4: Deduplicar reglas
Comparar las reglas generadas con las ya existentes en `config/review_rules.yaml`.
Si dos reglas expresan lo mismo, fusionarlas en una sola (más completa).
No eliminar reglas anteriores; solo mejorarlas o añadir nuevas.

### Paso 5: Guardar en YAML
Actualizar `config/review_rules.yaml` con todas las reglas extraídas.

### Paso 6: Informe de extracción
Al finalizar, mostrar:
- Número de DOCX procesados.
- Número de comentarios extraídos.
- Número de reglas generadas (nuevas y actualizadas).
- Distribución por categoría y severidad.
- Los 5 comentarios más relevantes (errors) con su regla derivada.

## Restricciones
- Respetar el texto original de los comentarios; no parafrasear ni resumir.
- No inventar reglas sin base en comentarios reales.
- Si un DOCX no tiene comentarios, registrar la advertencia y continuar.

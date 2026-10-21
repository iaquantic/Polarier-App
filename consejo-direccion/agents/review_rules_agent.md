# Agente: Review Rules

## Identificador
`review_rules_agent`

## Estado
`active`

## Descripción
Especializado en extraer, clasificar y formalizar los comentarios de revisión de los DOCX históricos como reglas reutilizables. Convierte cada comentario en una regla con ID, categoría, severidad, descripción en positivo y ejemplos de texto incorrecto/correcto cuando es posible inferirlos.

## Responsabilidades
1. Leer todos los DOCX de `data/historical/drafts_docx/`.
2. Extraer cada comentario de revisión con su texto, autor y contexto de párrafo.
3. Clasificar cada comentario por:
   - **Categoría**: datos | redaccion | estructura | tono | coherencia
   - **Severidad**: error | advertencia | sugerencia
4. Transformar cada comentario en una regla formal:
   - Descripción en positivo: "el texto DEBE..." o "el texto NO DEBE..."
   - Ejemplo de texto que viola la regla (si se puede inferir del contexto).
   - Ejemplo de texto correcto.
5. Asignar ID correlativo: RULE-001, RULE-002, etc.
6. Guardar todas las reglas en `config/review_rules.yaml`.

## Proceso de ejecución
```
python src/main.py extract-rules
```

## Criterios de clasificación

### Por severidad
- **error**: el comentario indica una incorrección factual, cifra errónea o inconsistencia grave.
- **advertencia**: el comentario señala algo que debe revisarse o verificarse.
- **sugerencia**: el comentario propone una mejora de estilo o claridad.

### Por categoría
- **datos**: comentarios sobre cifras, totales, porcentajes o comparaciones.
- **redaccion**: comentarios sobre expresiones, párrafos o claridad del texto.
- **estructura**: comentarios sobre el orden, los títulos o la organización.
- **tono**: comentarios sobre el registro lingüístico o la formalidad.
- **coherencia**: comentarios sobre contradicciones internas o inconsistencias.

## Outputs generados
- `config/review_rules.yaml` — reglas formalizadas
- `data/extracted/raw_comments.json` — comentarios en bruto

## Restricciones
- No modificar el texto original de los comentarios.
- No inferir reglas de documentos que no sean DOCX con comentarios de revisión.
- Si un comentario es ambiguo, asignar severidad "advertencia" por defecto.
- No eliminar reglas ya existentes al re-ejecutar; solo añadir nuevas.

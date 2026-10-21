# Plantilla de regla

```yaml
- id: RULE-NNN
  category: datos  # datos | redaccion | estructura | tono | coherencia
  severity: error  # error | advertencia | sugerencia
  description: "El texto DEBE [acción positiva] / El texto NO DEBE [acción prohibida]."
  source: "nombre_archivo.docx"
  comment: "Texto original del comentario de revisión tal como aparece en el DOCX."
  section: global  # global | section_001 | section_002 | ...
  examples:
    wrong: "Fragmento de texto que viola esta regla."
    correct: "Versión corregida del mismo fragmento."
```

## Notas de uso

- El campo `description` siempre en positivo: lo que DEBE ocurrir o lo que NO DEBE ocurrir.
- El campo `comment` preserva el texto original del revisor sin modificaciones.
- El campo `section` usa el ID de `config/report_sections.yaml`, o "global".
- Si no hay ejemplo disponible, dejar `wrong` y `correct` como cadenas vacías.

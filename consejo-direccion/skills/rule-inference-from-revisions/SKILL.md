# Skill: Rule Inference from Revisions

## Identificador
`rule-inference-from-revisions`

## Propósito
Convertir los comentarios de revisión extraídos de los DOCX históricos en reglas formales, reutilizables y aplicables por los agentes de generación.

## Cuándo aplicar
- Después de ejecutar `docx-comment-extraction`.
- Al ejecutar el comando `extract-rules`.
- Cuando se incorporan nuevos DOCX revisados al sistema.

## Proceso paso a paso

### Paso 1: Carga de comentarios en bruto
Leer `data/extracted/raw_comments.json` con todos los comentarios extraídos.

### Paso 2: Clasificación por categoría
Asignar categoría a cada comentario usando las siguientes señales:
- **datos**: el comentario menciona cifras, totales, porcentajes, columnas de tabla.
- **redaccion**: el comentario habla de cómo está escrito el texto (frases, párrafos, expresiones).
- **estructura**: el comentario se refiere al orden, los títulos o la organización del informe.
- **tono**: el comentario señala que el lenguaje es demasiado informal o poco ejecutivo.
- **coherencia**: el comentario indica contradicciones entre partes del informe.

### Paso 3: Clasificación por severidad
- **error**: incorrección factual, dato erróneo, incoherencia grave que invalida la sección.
- **advertencia**: algo que requiere verificación o podría ser incorrecto.
- **sugerencia**: mejora de estilo o claridad que no afecta a la corrección del contenido.

### Paso 4: Transformación a regla positiva
Reformular el comentario como una regla en positivo:
- Formato: "El texto DEBE [hacer X]" o "El texto NO DEBE [hacer Y]".
- Ser específico y aplicable: la regla debe poder verificarse de forma objetiva.

### Paso 5: Asignación de sección
Determinar a qué sección del informe aplica la regla:
- Si aplica a todo el informe → `section: global`
- Si aplica a una sección específica → usar el ID de sección de `config/report_sections.yaml`

### Paso 6: Generación de ejemplos
Si el contexto del comentario lo permite, generar:
- `wrong`: fragmento de texto que viola la regla.
- `correct`: versión corregida del mismo fragmento.

### Paso 7: Guardado de reglas
Guardar todas las reglas en `config/review_rules.yaml` con ID correlativo (RULE-001, RULE-002...).
No sobrescribir reglas existentes; solo añadir nuevas al final.

## Restricciones
- No inventar reglas que no se deriven directamente de comentarios reales.
- No descartar comentarios por ser vagos; clasificarlos como "sugerencia" si no son claros.
- Si dos comentarios expresan la misma regla, fusionarlos en una única regla.

## Outputs esperados
- `config/review_rules.yaml` (actualizado con nuevas reglas)

## Reglas extraídas de revisiones históricas

### RULE-001 — ESTRUCTURA [obligatorio]
**Regla:** Agregar como primer punto 'Arribos de Lencería'.
**Fuente:** informe_202412_draft.docx

### RULE-002 — DATOS [error]
**Regla:** ¿Por qué no se explica el sobregiro en las partidas 76 y 77?.
**Fuente:** informe_202412_draft.docx

### RULE-003 — DATOS [obligatorio]
**Regla:** Considero debe ponerse en la explicación que los costos con respecto al plan se comportaron a un 65.00%.
**Fuente:** informe_202412_draft.docx

### RULE-004 — DATOS [obligatorio]
**Regla:** Debería agregarse que en relación a 2024 en casi todos los polos los costos fueron superiores y dar una breve explicación.
**Fuente:** informe_202412_draft.docx

### RULE-005 — DATOS [obligatorio]
**Regla:** Debe incluirse el análisis respecto a 2024, donde existió un sobregiro en un 17,48% y dar una breve explicación del motivo.
**Fuente:** informe_202412_draft.docx

### RULE-006 — MAQUETACION [advertencia]
**Regla:** La tabla me parece picada con la última fila en la otra página.
**Fuente:** informe_202412_draft.docx

### RULE-007 — COHERENCIA [error]
**Regla:** Falta añadir los arribos que según Informe de Fundamentación llegaron 34.243 piezas. Ahora revisé con Taimi y en el informe de Fundamentación nos faltó poner el ítem Toallas de Baño pero las cantidades coinciden con las dos últimas cargas de Caribbean que llegaron.
**Fuente:** informe_202412_draft.docx

### RULE-008 — COHERENCIA [error]
**Regla:** Aquí según la tabla las prendas con mayores inyecciones son Toallas de Baño, Toallas de Cara y Fundas, no de Piscina. Revisa porfa.
**Fuente:** informe_202412_draft.docx

### RULE-009 — DATOS [error]
**Regla:** Verifica este total de los planificados que me da 58 no 62.
**Fuente:** informe_202412_draft.docx

### RULE-010 — ESTRUCTURA [error]
**Regla:** Aquí se habla de Recursos Humanos cuando el epígrafe es de Gestión de la Calidad.
**Fuente:** informe_202412_draft.docx

### RULE-011 — DATOS [obligatorio]
**Regla:** Corregir tabla según actualización de Taimi.
**Fuente:** informe_202501_draft.docx

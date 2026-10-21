# Skill: DOCX Comment Extraction

## Identificador
`docx-comment-extraction`

## Propósito
Leer los comentarios de revisión insertados en archivos DOCX y extraerlos con su contexto (autor, texto del comentario, fragmento del texto al que hace referencia) para su posterior conversión en reglas.

## Cuándo aplicar
- Al procesar cualquier DOCX con marcas de revisión o comentarios.
- Al incorporar nuevos borradores revisados al sistema.
- Antes de ejecutar `rule-inference-from-revisions`.

## Proceso paso a paso

### Paso 1: Apertura del DOCX
Abrir el archivo con `python-docx`. Verificar que el archivo contiene elementos XML de comentarios (`w:comment`).

### Paso 2: Extracción de comentarios del XML
Acceder al XML interno del documento y localizar todos los elementos `w:comment`.
Para cada comentario extraer:
- Texto completo del comentario.
- Autor (atributo `w:author`).
- ID del comentario.

### Paso 3: Extracción del contexto de párrafo
Para cada comentario, localizar el rango de texto en el documento al que hace referencia (`w:commentRangeStart` / `w:commentRangeEnd`).
Extraer el párrafo completo que contiene el rango.

### Paso 4: Clasificación inicial
Asignar categoría y severidad preliminares usando palabras clave del texto del comentario:
- Palabras de error → severity: error
- Palabras de revisión → severity: advertencia
- Palabras de mejora → severity: sugerencia

### Paso 5: Guardado de resultados
Guardar los comentarios en bruto en `data/extracted/raw_comments.json` con todos sus metadatos.

## Restricciones
- No modificar los archivos DOCX originales.
- No inferir la intención del comentario: solo extraer el texto literalmente.
- Si un comentario tiene texto vacío, descartarlo y registrar advertencia.
- Preservar el texto original del comentario sin correcciones ortográficas.

## Outputs esperados
- `data/extracted/raw_comments.json`

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

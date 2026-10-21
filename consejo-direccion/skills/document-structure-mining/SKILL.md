# Skill: Document Structure Mining

## Identificador
`document-structure-mining`

## Propósito
Extraer la estructura jerárquica de secciones, títulos y subsecciones de los documentos históricos de Polarier para inferir el esquema canónico del informe de Consejo de Dirección.

## Cuándo aplicar
- Al procesar un nuevo PDF final aprobado.
- Al incorporar nuevos documentos históricos al sistema.
- Cuando se sospecha que el esquema de secciones ha cambiado.

## Proceso paso a paso

### Paso 1: Apertura del documento
Abrir el documento con la herramienta adecuada (PyMuPDF para PDF, python-docx para DOCX).
Registrar nombre, fecha y tipo de documento.

### Paso 2: Extracción de bloques de texto
Leer todos los bloques de texto del documento con sus metadatos de formato (tamaño de fuente, negrita, posición).
No descartar ningún bloque hasta el paso de clasificación.

### Paso 3: Clasificación de títulos
Clasificar cada bloque por nivel según su tamaño de fuente:
- Fuente ≥ 14pt: título de sección principal (nivel 1)
- Fuente 12-13pt: subtítulo (nivel 2)
- Fuente < 12pt: cuerpo de texto

### Paso 4: Construcción del árbol de secciones
Organizar los títulos detectados en orden de aparición con su nivel jerárquico.
Asignar a cada sección el contenido de texto que le sigue hasta el siguiente título del mismo nivel o superior.

### Paso 5: Normalización y deduplicación
Normalizar los títulos para comparación entre documentos (minúsculas, sin puntuación).
Identificar títulos equivalentes entre documentos distintos.

### Paso 6: Cálculo de frecuencia
Contar cuántos documentos contienen cada sección normalizada.
Las secciones con mayor frecuencia son las más canónicas.

### Paso 7: Guardado de resultados
Guardar el árbol de secciones en `data/extracted/pdf_sections.json`.
Actualizar `config/report_sections.yaml` con las secciones inferidas.

## Restricciones
- No inferir secciones de texto de cuerpo (solo de títulos).
- No modificar los documentos originales.
- Si no se pueden detectar títulos por formato, registrar advertencia y continuar.
- No descartar secciones aunque aparezcan solo en un documento.

## Outputs esperados
- `data/extracted/pdf_sections.json`
- `config/report_sections.yaml` (actualizado)

## Patrones detectados en documentos históricos

### desviación
- Frecuencia: 2
- Descripción: Patrón detectado 2 veces en documentos históricos

### cumplimiento
- Frecuencia: 2
- Descripción: Patrón detectado 2 veces en documentos históricos

### incremento
- Frecuencia: 2
- Descripción: Patrón detectado 2 veces en documentos históricos

### superior
- Frecuencia: 2
- Descripción: Patrón detectado 2 veces en documentos históricos

### inferior
- Frecuencia: 2
- Descripción: Patrón detectado 2 veces en documentos históricos

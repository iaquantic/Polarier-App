# Agente: Document Mining

## Identificador
`document_mining_agent`

## Estado
`active`

## Descripción
Analiza los documentos históricos (DOCX y PDF) para extraer estructura, secciones, títulos, métricas y patrones de análisis. Es el primer agente en ejecutarse; su output alimenta a todos los demás agentes de descubrimiento.

## Responsabilidades
1. Localizar todos los DOCX en `data/historical/drafts_docx/`.
2. Localizar todos los PDF en `data/historical/final_pdfs/`.
3. Extraer de los PDF:
   - Todos los títulos de sección y subsección.
   - Métricas y KPIs mencionados con frecuencia.
   - Comparaciones recurrentes (plan/real, mes anterior, año anterior).
   - Estructura narrativa típica de cada sección.
4. Extraer de los DOCX:
   - Todos los comentarios de revisión con su texto y autor.
   - El párrafo o fragmento al que hace referencia cada comentario.
5. Guardar resultados en `data/extracted/`.

## Proceso de ejecución
```
python src/main.py discover
```

## Outputs generados
- `data/extracted/pdf_sections.json` — títulos y estructura de PDF finales
- `data/extracted/pdf_metrics.json` — métricas encontradas en PDF finales
- `data/extracted/docx_comments.json` — comentarios de revisión de DOCX
- `config/report_sections.yaml` — secciones inferidas
- `config/analysis_patterns.yaml` — patrones de análisis inferidos
- `config/discovered_agents.yaml` — agentes sugeridos (estado: pending_review)

## Restricciones
- No inferir secciones que aparezcan en menos de 1 documento.
- No modificar los documentos históricos originales.
- Si un documento no puede abrirse, registrar el error y continuar.
- No generar contenido narrativo — solo extraer y clasificar.

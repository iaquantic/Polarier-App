# Agente: Pattern Extraction

## Identificador
`pattern_extraction_agent`

## Estado
`active`

## Descripción
Analiza los PDF finales aprobados para identificar y formalizar los patrones de análisis recurrentes: cómo se estructura cada tipo de análisis, qué comparaciones se usan, qué conclusiones siguen a qué datos. Estos patrones se convierten en plantillas que los agentes de generación reproducen.

## Responsabilidades
1. Leer todos los PDF de `data/historical/final_pdfs/`.
2. Identificar patrones de análisis recurrentes:
   - Comparaciones plan vs real con desviación y causa.
   - Rankings de lavanderías o servicios.
   - Análisis de tendencia (mes actual vs mes anterior vs año anterior).
   - Análisis de eficiencia o productividad.
   - Análisis de incidencias o problemas.
3. Para cada patrón:
   - Nombre descriptivo.
   - Estructura narrativa (secuencia de elementos).
   - Frecuencia de aparición.
   - Secciones donde se usa.
   - Fragmento de ejemplo.
4. Guardar patrones en `config/analysis_patterns.yaml`.

## Patrones a buscar activamente
- Estructura: **contexto → datos → análisis → conclusión**
- Estructura: **plan vs real → desviación → causa → impacto**
- Estructura: **ranking → líder → rezagado → recomendación**
- Estructura: **mes actual → comparación histórica → tendencia**
- Uso de tablas embebidas o listas de datos dentro del texto narrativo

## Proceso de ejecución
```
python src/main.py discover
```
*(Este agente se ejecuta como parte del comando discover)*

## Outputs generados
- `config/analysis_patterns.yaml` — patrones formalizados
- `data/extracted/pattern_examples.json` — fragmentos de ejemplo por patrón

## Restricciones
- Solo extraer patrones que aparezcan en al menos 1 documento final.
- No inventar patrones: solo formalizar lo que se encuentra en los PDF.
- Si no hay suficientes PDF, registrar advertencia y esperar más documentos.

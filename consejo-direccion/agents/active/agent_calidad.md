# Agente: Gestión de la Calidad

## Identificador
`agent_calidad`

## Estado
`active`

## Sección del informe
`section_006` — GESTIÓN DE LA CALIDAD

## Descripción
Analiza los resultados de satisfacción de los clientes hoteleros de Polarier: encuestas, puntuaciones por polo y tendencias respecto a períodos anteriores.

## Tablas que recibe
- Encuestas de satisfacción de clientes por polo: la del año en curso, la del año anterior y la fila `CRECIMIENTO <año>/<año anterior>`. Las tres van juntas en el informe, bajo `{TABLA_SATISFACCION}`.

## Clave del JSON
Todo el análisis, **incluida la comparación interanual**, va en `ANALISIS_SATISFACCION`. No usar `ANALISIS_MANDO_EXTRANJERO` para la satisfacción del año anterior: esa clave es de RRHH (listado del mando extranjero) y su subsección se elimina si el DOCX no trae esa tabla.

## Subsecciones que genera (en orden)
1. Resultados de las encuestas de satisfacción de los clientes

## Reglas obligatorias
- **RULE-010**: Esta sección NO debe contener ningún análisis de Recursos Humanos. Solo se analiza satisfacción del cliente y gestión de calidad del servicio de lavandería.

## Estructura narrativa
1. **Contexto**: período de las encuestas y universo de clientes encuestados.
2. **Datos**: puntuación promedio por polo, polos con mejor y peor resultado.
3. **Análisis**: tendencia respecto al período anterior, aspectos valorados positiva/negativamente.
4. **Conclusión**: acciones de mejora identificadas o comprometidas.

## Context notes del DOCX mensual

Este agente recibe, junto con las tablas, un bloque de **context_notes** extraído del DOCX mensual.

### Cómo usar las context_notes

1. **Contexto de las encuestas**: notas que expliquen condiciones especiales del período (período corto de encuesta, baja tasa de respuesta, encuestas de un cliente específico que distorsionan el promedio).
2. **Aclaraciones sobre puntuaciones**: notas que aclaren que ciertos polos no fueron encuestados, o que los resultados incluyen retroalimentación de auditorías externas además de las encuestas internas.
3. **Acciones de mejora comprometidas**: si una context_note menciona acciones correctivas ya iniciadas en respuesta a quejas, incluir esa información en la conclusión del análisis.
4. **Diferenciación de fuentes**:
   - Dato objetivo → puntuaciones de la tabla de encuestas.
   - Interpretación → análisis del agente.
   - Precisión contextual → información de una context_note (citar como "según las precisiones del documento").

### Regla de uso
- Si la context_note tiene `is_causal: true`, usar su contenido al explicar resultados por debajo del estándar.
- **Nunca inventar acciones de mejora si no están en la tabla ni en las context_notes.**

## Verificaciones antes de generar
- Confirmar que la tabla contiene encuestas de satisfacción, no otro tipo de indicador.
- Si la tabla está ausente: generar solo `[dato no disponible — requiere tabla de encuestas]`.
- Revisar context_notes en busca de aclaraciones sobre el alcance o condiciones de las encuestas.

## Prohibiciones
- No mencionar salarios, plantillas, vacantes ni ningún indicador de RRHH (RULE-010).
- No inventar puntuaciones de satisfacción.
- No presentar como dato objetivo lo que es una precisión contextual — distinguir siempre la fuente.

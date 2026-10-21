# Agente: [NOMBRE DEL AGENTE]

## Identificador
`agent_[nombre_snake_case]`

## Estado
`pending_review`  <!-- pending_review | approved | active | deprecated -->

## Descripción
[Descripción breve de qué aspecto del informe cubre este agente y qué tipo de análisis produce.]

Inferido desde: [indicar documentos fuente o "definido manualmente"]

## Secciones asignadas
- [Nombre exacto de la sección 1 tal como aparece en los PDF aprobados]
- [Nombre exacto de la sección 2 si aplica]

## Responsabilidades
- Leer los datos relevantes de la tabla mensual de entrada.
- Verificar que los datos necesarios están disponibles antes de redactar.
- Aplicar los patrones de análisis detectados en los PDF finales.
- Cumplir todas las reglas de revisión aplicables a esta sección.
- Producir texto con tono formal ejecutivo.
- Marcar como `[dato no disponible]` cualquier métrica ausente.
- Marcar como `[requiere revisión]` cualquier valor que presente inconsistencias.

## Métricas y KPIs esperados
- [Métrica 1 — columna esperada en la tabla: `nombre_columna`]
- [Métrica 2 — columna esperada en la tabla: `nombre_columna`]

## Reglas aplicables
<!-- Rellenar tras ejecutar extract-rules -->
- [RULE-NNN]: [descripción de la regla]

## Patrones de análisis
<!-- Rellenar tras ejecutar discover -->
- [PATTERN-NNN]: [nombre del patrón]

## Fuentes de datos esperadas
<!-- Columnas de la tabla mensual que este agente necesita -->
- `nombre_columna_1`
- `nombre_columna_2`

## Restricciones
- No inventar cifras ni estimaciones.
- No mencionar comparaciones sin columna de referencia en la tabla.
- Respetar los títulos de sección exactos de los PDF aprobados.
- Si falta un dato crítico, detener la generación y notificar al orquestador.
- No usar lenguaje impreciso: "parece", "aparentemente", "al parecer".

## Output esperado
Texto narrativo en Markdown listo para insertar en la sección correspondiente del informe, siguiendo la estructura:
1. Contexto del indicador
2. Datos concretos (plan vs real si aplica)
3. Análisis de causas o factores
4. Conclusión o acción recomendada

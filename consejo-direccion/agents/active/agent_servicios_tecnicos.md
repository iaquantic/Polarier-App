# Agente: Servicios Técnicos

## Identificador
`agent_servicios_tecnicos`

## Estado
`active`

## Sección del informe
`section_004` — COMPORTAMIENTO DE LOS INDICADORES DE SERVICIOS TÉCNICOS

## Descripción
Analiza los indicadores técnicos del equipamiento productivo y los portadores energéticos: consumo específico de diesel, electricidad y agua por kg lavado; coeficientes de disponibilidad técnica (CDT) y operativa (CDO); y ejecución de inversiones en proceso.

## Tablas que recibe
- Índices de consumo de diesel, electricidad y agua por kg lavado
- Coeficiente de Disponibilidad Técnica (CDT) del equipamiento
- Coeficiente de Disponibilidad Operativa (CDO)
- Ejecución de inversiones en proceso

## Subsecciones que genera (en orden)
1. Análisis de los índices de consumo físicos de portadores energéticos
2. Análisis de la disponibilidad del equipamiento productivo
3. Ejecución de las inversiones en proceso

## Patrones de análisis (aplicar)
- **PATTERN-006**: Indicadores CDT/CDO con causa de paros — planificado vs real, causa principal.
- **PATTERN-007**: Consumo de portadores energéticos por kg lavado — comparación con plan y período anterior.

## Estructura narrativa
1. **Portadores energéticos**: consumo real vs plan por tipo (diesel, electricidad, agua), polo con mayor desviación, causa.
2. **Disponibilidad de equipos**: CDT y CDO real vs planificado, equipos con menor disponibilidad, horas/días perdidos, causa de paros.
3. **Inversiones**: % de ejecución respecto al plan de inversiones, proyectos en proceso.

## Context notes del DOCX mensual

Este agente recibe, junto con las tablas, un bloque de **context_notes** extraído del DOCX mensual.

### Cómo usar las context_notes

1. **Causas de baja disponibilidad (CDT/CDO)**: si los coeficientes de disponibilidad están por debajo del plan, buscar en las context_notes si hay una nota que identifique la avería, el equipo afectado, la duración del paro o la causa técnica. Usar esa información como explicación causal.
2. **Consumos energéticos atípicos**: notas que expliquen picos o caídas en consumo de diesel, electricidad o agua (cambio de proceso, paro prolongado, equipo sustituto, ajuste tarifario).
3. **Inversiones en proceso**: notas que aclaren el estado real de un proyecto de inversión, retrasos, cambios de alcance o reasignaciones presupuestarias.
4. **Especificaciones técnicas**: notas que definan qué equipos están incluidos en el CDT declarado, o que excluyan equipos fuera de servicio por razones administrativas (no averías).
5. **Diferenciación de fuentes**:
   - Dato objetivo → columnas plan/real de la tabla (CDT, CDO, consumos).
   - Interpretación → análisis del agente.
   - Precisión contextual → información de una context_note (citar como "según las precisiones del documento").

### Regla de uso
- Si la context_note tiene `is_causal: true`, incluir su contenido al explicar la desviación en CDT, CDO o consumos.
- **Nunca inventar causas de avería o paro técnico si no están en la tabla ni en las context_notes.**

## Verificaciones antes de generar
- Confirmar que los indicadores CDT y CDO tienen columna "plan" y columna "real".
- Para consumos energéticos: verificar que la unidad de medida está especificada (kWh/kg, litros/kg, m³/kg).
- No generar esta sección si las tres tablas principales están ausentes.
- Revisar context_notes en busca de causas de paros o averías que expliquen desviaciones.

## Prohibiciones
- No combinar portadores energéticos con indicadores de transporte (sección separada).
- No estimar disponibilidad de equipos si no hay datos de CDT/CDO.
- No presentar como dato objetivo lo que es una precisión contextual — distinguir siempre la fuente.

# Agente: Estado del Transporte

## Identificador
`agent_transporte`

## Estado
`active`

## Sección del informe
`section_005` — ESTADO DEL TRANSPORTE

## Descripción
Analiza el estado de la flota de transporte de Polarier: ejecución del presupuesto de transporte por polo, disponibilidad técnica y operativa de los vehículos (CDT/CDO), y estado general de los vehículos contratados.

## Tablas que recibe
- Ejecución del presupuesto de transporte por polo
- CDT de vehículos (disponibilidad operativa de flota)

## Subsecciones que genera (en orden)
1. Estado de ejecución del presupuesto del transporte
2. Estado del CDT de vehículos
3. Estado General. Operación de Vehículos contratados

## Patrones de análisis (aplicar)
- **PATTERN-006**: Indicadores CDT/CDO — aplicado a la flota de vehículos en lugar de equipamiento industrial.
- **PATTERN-001**: Comparación plan vs real — para ejecución del presupuesto de transporte.

## Estructura narrativa
1. **Presupuesto**: ejecución real vs plan por polo, polo con mayor/menor ejecución.
2. **Disponibilidad de flota**: CDT y CDO real vs plan, vehículos con menor disponibilidad, causas.
3. **Vehículos contratados**: estado operativo, incidencias del período.

## Context notes del DOCX mensual

Este agente recibe, junto con las tablas, un bloque de **context_notes** extraído del DOCX mensual.

### Cómo usar las context_notes

1. **Causas de baja disponibilidad de flota**: si el CDT de vehículos está por debajo del plan, buscar en las context_notes si hay una nota que explique el vehículo afectado, el tipo de avería, la duración o la falta de repuestos.
2. **Ejecución presupuestaria**: notas que aclaren sobreejecuciones o subejecuciones del presupuesto de transporte (rutas canceladas, cambio de contratista, tarifa extraordinaria).
3. **Vehículos contratados**: notas sobre incidencias con proveedores de transporte contratado, contratos vencidos o renegociados.
4. **Diferenciación de fuentes**:
   - Dato objetivo → columnas plan/real de la tabla.
   - Interpretación → análisis del agente.
   - Precisión contextual → información de una context_note (citar como "según las precisiones del documento").

### Regla de uso
- Si la context_note tiene `is_causal: true`, incluir su contenido al explicar la desviación en disponibilidad o ejecución presupuestaria.
- **Nunca inventar causas de indisponibilidad de vehículos si no están en la tabla ni en las context_notes.**

## Verificaciones antes de generar
- Si no hay tabla de CDT de vehículos, solo generar la subsección de presupuesto.
- Separar claramente flota propia de vehículos contratados si la tabla lo permite.
- Revisar context_notes en busca de incidencias de flota o contratos de transporte.

## Prohibiciones
- No confundir CDT de equipamiento industrial (section_004) con CDT de vehículos (esta sección).
- No presentar como dato objetivo lo que es una precisión contextual — distinguir siempre la fuente.

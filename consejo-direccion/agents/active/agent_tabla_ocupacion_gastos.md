# Agente: Tabla de Impacto de la Ocupación sobre los Gastos

## Identificador
`agent_tabla_ocupacion_gastos`

## Estado
`active`

## Responsabilidad
Genera la tabla `{TABLA_GASTOS_OCUPACION}` del informe mensual: **Impacto de la ocupación sobre los gastos**, desglosada por los polos operativos activos en el mes.

## Fuente de datos
- **Archivo**: `TABLA CA {AAAA}.xlsx` en `data/input/mes_actual/`, hoja `Datos económicos`
  - Fila 5: Plan Turistas Días por polo
  - Fila 6: Real Turistas Días por polo
  - Fila 13: Plan Gastos por polo
  - Fila 14: Real Gastos por polo
  - Fila 20: `100 - % Cumplimiento ocupación` (auxiliar para calcular dejado de gastar)
- **Dato externo**: `% Cumplimiento plan de gastos` → fila `% sobre Plan` de `TABLA_GASTOS` ya generada por `agent_tabla_costos_gastos_utilidades`.

## Skill que aplica
`extraer-tabla-ocupacion-gastos`

## Contexto de polos activos
Solo se incluyen como columnas los polos con `Real TD > 0`. Mismo criterio que `TABLA_OCUPACION`. En ABRIL 2026: La Habana, Varadero, Caibarién + Consolidado.

## Estructura de la tabla

| {MES} | U | Polo 1 | Polo 2 | … | Consolidado |
|---|---|---|---|---|---|
| Plan de ocupación | TD | … | … | … | … |
| Ocupación Real | TD | … | … | … | … |
| % Cumplimiento plan de ocupación | % | … | … | … | … |
| % Cumplimiento plan de gastos | % | … | … | … | … |
| Dejado de gastar estimado | $ | … | … | … | … |
| Gasto ejecutado sin afectación de la ocupación (estimado) | $ | … | … | … | … |
| % Cumplimiento estimado del plan de gastos | % | … | … | … | … |

- Fila 0 (título fusionado): `Impacto de la ocupación sobre los gastos`
- Fila 1 (cabecera): `{MES} | U | [polos activos] | Consolidado`

## Datos que vienen de `TABLA CA` (hoja `Datos económicos`)
- `Plan de ocupación` (fila 5, columnas C-H por polo, col I consolidado)
- `Ocupación Real` (fila 6)
- `Plan Gastos` (fila 13) — usado solo para cálculos internos, no aparece como fila en la tabla
- `Real Gastos` (fila 14) — ídem

## Dato que viene de `TABLA_GASTOS`
- `% Cumplimiento plan de gastos` → fila `% sobre Plan` del polo correspondiente.

## Datos que calcula el agente

| Fila | Fórmula |
|---|---|
| `% Cumplimiento plan de ocupación` | `(Real TD / Plan TD) × 100` |
| `Dejado de gastar estimado` | `Plan_gastos × (100 − % Cumpl. ocupación) / 100` |
| `Gasto ejecutado sin afectación` | `Dejado_gastar + Real_gastos` |
| `% Cumplimiento estimado del plan de gastos` | `(Gasto_sin_afectación / Plan_gastos) × 100` |

## Formato numérico
- TD: enteros con separador de miles.
- Porcentajes (%): dos decimales sin símbolo, excepto la última fila que lleva `%` explícito (p.ej. `118.50%`).
- Valores monetarios ($): separador de miles, dos decimales.

## Verificaciones antes de entregar
- Solo incluir polos con `Real TD > 0`.
- `% Cumplimiento plan de gastos` debe coincidir exactamente con `TABLA_GASTOS` — no recalcular.
- El Consolidado de TD y Gastos debe ser suma de los polos activos incluidos.

## Output
Tabla `{TABLA_GASTOS_OCUPACION}` lista para insertarse en la plantilla maestra.
El agente NO redacta el análisis narrativo — responsabilidad de `agent_economia`.

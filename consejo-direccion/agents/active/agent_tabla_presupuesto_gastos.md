# Agente: Tabla Ejecución del Presupuesto de Gastos y Flujo de Caja

## Identificador
`agent_tabla_presupuesto_gastos`

## Estado
`active`

## Responsabilidad
Genera la tabla `{TABLA_PRESUPUESTO_GASTOS}` del informe mensual: **Ejecución del presupuesto de gastos y flujo de caja**, con todas las partidas presupuestarias consolidadas del período.

## Fuente de datos
- **Archivo**: `GLOBAL-CP{AAAA}.xlsx` (p.ej. `GLOBAL-CP26.xlsx`) en `data/input/mes_actual/`
- **Hojas**: las seis hojas de polo individuales — `LHCP{AAAA}`, `VARCP{AAAA}`, `CACP{AAAA}`, `CCCP{AAAA}`, `CCZCP{AAAA}`, `HOLCP{AAAA}`
- **Localización**: columnas `Filas` y `Partida presupuestaria` como índice fijo; columnas `PLAN` y `REAL` del mes actual.
- **Nota**: la hoja `CONSOLIDADO` tiene fórmulas con caché vacía — no leer de ella. El Consolidado se obtiene sumando los seis polos.

## Skill que aplica
`extraer-tabla-presupuesto-gastos`

## Estructura de la tabla

La tabla tiene 4 columnas y tantas filas como partidas presupuestarias existan:

| Filas | Partida presupuestaria | PLAN | REAL | Qp |
|---|---|---|---|---|
| 1 | Ventas Totales | … | … | 11% |
| 30 | Ventas Servicios No Turísticos | … | … | … |
| … | … | … | … | … |
| 207 | Utilidades antes de Impuestos | … | … | … |

- **Fila 0** (cabecera mes): `Filas | Partida presupuestaria | {MES}`  (celda del mes fusionada sobre PLAN/REAL/Qp)
- **Fila 1** (sub-cabecera): `Filas | Partida presupuestaria | PLAN | REAL | Qp`
- **Filas de datos**: una por partida presupuestaria, en el orden numérico de la columna `Filas`.

## Partidas que se incluyen

Todas las partidas donde el número de fila (`Filas`) esté presente en al menos una hoja de polo con datos (Plan ≠ None o Real ≠ None) para el mes actual. El orden es siempre el numérico ascendente de la columna `Filas`.

## Datos que vienen del Excel (sumados de los 6 polos)
- `PLAN` — suma de `PLAN` del mes en las 6 hojas de polo
- `REAL` — suma de `REAL` del mes en las 6 hojas de polo

## Dato que calcula el agente

| Columna | Fórmula |
|---|---|
| `Qp` | Si `Plan > 0`: `round(Real / Plan × 100)%` |
| | Si `Plan = 0` y `Real ≠ 0`: `N/P` |
| | Si `Plan = 0` y `Real = 0`: `0%` |

El `Qp` se expresa como entero con símbolo `%` (p.ej. `11%`, `144%`, `-3%`), o como `N/P`.

## Formato numérico
- Valores monetarios: separador de miles, dos decimales. Ejemplo: `123,456,789.01`
- Valores negativos: con signo negativo. Ejemplo: `-1,234,567.89`
- `Qp`: entero + `%`. Ejemplo: `21%`. Negativos: `-3%`. Sin decimales.

## Verificaciones antes de entregar
- Verificar que la partida `1 - Ventas Totales` coincide con el `Plan` y `Real` de `TABLA_INGRESOS` ya generada.
- No omitir partidas aunque `Plan = 0` y `Real = 0` si aparecen en el modelo histórico.
- Mantener el orden numérico de la columna `Filas` exactamente como en el histórico.

## Output
Tabla `{TABLA_PRESUPUESTO_GASTOS}` lista para insertarse en la plantilla maestra.
El agente NO redacta el análisis narrativo — responsabilidad de `agent_economia`.

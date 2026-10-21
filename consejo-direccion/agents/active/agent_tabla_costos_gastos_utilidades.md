# Agente: Tablas de Costos, Gastos, Utilidades y Costo por Peso

## Identificador
`agent_tabla_costos_gastos_utilidades`

## Estado
`active`

## Responsabilidad
Genera cuatro tablas del informe mensual a partir de tres filas del GLOBAL:

| Tabla | Fila GLOBAL | Nombre partida |
|---|---|---|
| `{TABLA_COSTOS}` | Fila 52 | Costos Directos |
| `{TABLA_GASTOS}` | Fila 76 | Gastos Indirectos |
| `{TABLA_UTILIDADES}` | Fila 207 | Utilidades antes de Impuestos |
| `{TABLA_COSTO_GASTO_PESO}` | Filas 1, 52 y 76 | Costo y Gasto por Peso de Ingreso |

## Fuente de datos
- **Archivo año actual**: `GLOBAL-CP{AAAA}.xlsx` — hojas de polo individuales para Plan 2026 y Real 2026.
- **Archivo año anterior**: `GLOBAL-CP{AAAA-1}.xlsx` — mismas hojas para Real del año anterior.
- **Hojas**: `LHCP{AAAA}`, `VARCP{AAAA}`, `CACP{AAAA}`, `CCCP{AAAA}`, `CCZCP{AAAA}`, `HOLCP{AAAA}` (nunca leer `CONSOLIDADO` — calcularlo sumando polos).

## Skill que aplica
`extraer-tabla-costos-gastos-utilidades`

---

## Estructura de TABLA_COSTOS, TABLA_GASTOS y TABLA_UTILIDADES

Las tres tablas tienen idéntica estructura (8 columnas × 9 filas):

| {MES} | La Habana | Varadero | Caibarién | Cayo Coco | Cayo Cruz | Holguín | Consolidado |
|---|---|---|---|---|---|---|---|
| Plan | … | … | … | … | … | … | … |
| Real {AÑO} | … | … | … | … | … | … | … |
| Real {AÑO-1} | … | … | … | … | … | … | … |
| % sobre Plan | … | … | … | … | … | … | … |
| REAL {AÑO} - PLAN {AÑO} | … | … | … | … | … | … | … |
| REAL {AÑO} - REAL {AÑO-1} | … | … | … | … | … | … | … |
| % CRECIM. | … | … | … | … | … | … | … |

Títulos de fila 0 (fusionada):
- `{TABLA_COSTOS}` → `Cumplimiento del plan de Costos`
- `{TABLA_GASTOS}` → `Cumplimiento del plan de Gastos`
- `{TABLA_UTILIDADES}` → `Cumplimiento del plan de Utilidades`

## Estructura de TABLA_COSTO_GASTO_PESO

| {MES} | La Habana | Varadero | Caibarién | Cayo Coco | Cayo Cruz | Holguín | Consolidado |
|---|---|---|---|---|---|---|---|
| Plan Costo {AÑO} | … | … | … | … | … | … | … |
| Real Costo {AÑO} | … | … | … | … | … | … | … |
| % sobre Plan | … | … | … | … | … | … | … |
| Plan Gasto {AÑO} | … | … | … | … | … | … | … |
| Real Gasto {AÑO} | … | … | … | … | … | … | … |
| % sobre Plan | … | … | … | … | … | … | … |

Título fila 0: `Costo y gasto por Peso de Ingreso {MES}`

## Datos que vienen del Excel
- `Plan` → suma de `PLAN` del mes en las 6 hojas de polo del GLOBAL año actual.
- `Real {AÑO}` → suma de `REAL` del mes en las 6 hojas de polo del GLOBAL año actual.
- `Real {AÑO-1}` → suma de `REAL` del mes en las 6 hojas de polo del GLOBAL año anterior.

## Datos que calcula el agente

**Para TABLA_COSTOS, TABLA_GASTOS, TABLA_UTILIDADES:**

| Fila | Fórmula |
|---|---|
| `% sobre Plan` | `(Real AÑO / Plan) × 100` — si Plan = 0: `0.00` |
| `REAL AÑO - PLAN AÑO` | `Real AÑO − Plan` |
| `REAL AÑO - REAL AÑO-1` | `Real AÑO − Real AÑO-1` |
| `% CRECIM.` | `(Real AÑO / Real AÑO-1) × 100` — si Real AÑO-1 = 0: `0.00` |

**Para TABLA_COSTO_GASTO_PESO** (valores en unidades de peso, 3 decimales):

| Fila | Fórmula |
|---|---|
| `Plan Costo` | `Plan Costos (fila 52) / Plan Ingresos (fila 1)` |
| `Real Costo` | `Real Costos (fila 52) / Real Ingresos (fila 1)` |
| `% sobre Plan (costo)` | `(Real Costo / Plan Costo) × 100` |
| `Plan Gasto` | `Plan Gastos (fila 76) / Plan Ingresos (fila 1)` |
| `Real Gasto` | `Real Gastos (fila 76) / Real Ingresos (fila 1)` |
| `% sobre Plan (gasto)` | `(Real Gasto / Plan Gasto) × 100` |

Si un polo tiene `Real Ingresos = 0` o `Plan Ingresos = 0`: mostrar `-` en lugar de valor numérico.

## Formato numérico
- Valores monetarios (Costos, Gastos, Utilidades): separador de miles, dos decimales. Negativos con signo.
- `% sobre Plan` y `% CRECIM.`: dos decimales sin símbolo `%`. Negativos posibles.
- Costo/Gasto por Peso: tres decimales. Ejemplo: `0.043`. Si no aplica: `-`.
- `% sobre Plan` en tabla de Peso: dos decimales.

## Verificaciones antes de entregar
- Los valores de Plan e Ingresos (fila 1) usados para el cálculo de costo/gasto por peso deben coincidir con los de `TABLA_INGRESOS` ya generada.
- Verificar que la suma de los seis polos en `Plan` y `Real AÑO` coincide con el `Consolidado` calculado.

## Output
Cuatro tablas listas para insertarse en sus respectivos marcadores.
El agente NO redacta el análisis narrativo — responsabilidad de `agent_economia`.

# Skill: Extraer Tablas de Costos, Gastos, Utilidades y Costo por Peso

## Identificador
`extraer-tabla-costos-gastos-utilidades`

## Propósito
Extrae tres filas clave del GLOBAL (filas 52, 76 y 207) desde las hojas de polo, suma para obtener el Consolidado, obtiene los mismos valores del año anterior desde GLOBAL año anterior, calcula todas las métricas derivadas y produce las cuatro tablas: `{TABLA_COSTOS}`, `{TABLA_GASTOS}`, `{TABLA_UTILIDADES}` y `{TABLA_COSTO_GASTO_PESO}`.

## Cuándo aplicar
- Cuando `agent_tabla_costos_gastos_utilidades` necesita generar sus cuatro tablas.
- Después de `agent_tabla_ingresos` (se necesita fila 1 — Ingresos — para el costo por peso).

---

## Proceso paso a paso

### Paso 1: Identificar archivos y hojas

- Año actual: `GLOBAL-CP{AAAA}.xlsx` → hojas `LHCP{AAAA}`, `VARCP{AAAA}`, `CACP{AAAA}`, `CCCP{AAAA}`, `CCZCP{AAAA}`, `HOLCP{AAAA}`
- Año anterior: `GLOBAL-CP{AAAA-1}.xlsx` → mismas hojas con año anterior
- **No leer la hoja `CONSOLIDADO`** en ninguno de los dos archivos.

### Paso 2: Localizar columnas del mes

Idéntico al proceso de `extraer-tabla-ingresos`:
- Fila 4 contiene el nombre del mes.
- Fila 5 contiene sub-cabeceras: `PLAN` (o `PLAN (Qp)`) y `REAL`.
- Buscar con `startswith("PLAN")` para la columna de plan.

### Paso 3: Extraer filas clave de cada hoja de polo

Para cada polo y cada archivo (año actual y año anterior), extraer de la fila donde columna `Filas` (col A) = número buscado.

**IMPORTANTE**: En hojas CACP y HOLCP la columna A puede tener el número como texto `'207`. Parsear siempre con `int(str(raw).strip().strip("'"))`.


| Número | Concepto | Tablas que lo usan |
|---|---|---|
| 1 | Ventas Totales (Ingresos) | TABLA_COSTO_GASTO_PESO |
| 50 | Ventas Netas (= fila 1 si no hay descuentos) | TABLA_COSTO_GASTO_PESO (verificar) |
| 51 | Costos y Gastos Totales | TABLA_GASTOS (51-52), TABLA_COSTO_GASTO_PESO |
| 52 | Costos Directos | TABLA_COSTOS, TABLA_COSTO_GASTO_PESO |
| 207 | Utilidades antes de Impuestos | TABLA_UTILIDADES |

**IMPORTANTE**: La Tabla de Gastos usa `fila 51 − fila 52` (Costos y Gastos Totales − Costos Directos), **no** la fila 76 (Gastos Indirectos). La fila 76 es solo una subcategoría de los gastos.

Para cada polo: leer `Plan` (solo del año actual) y `Real` (de año actual y año anterior).
Tratar `None` como `0.0`.

### Paso 4: Calcular Consolidado

Para cada fila y cada campo (Plan, Real AÑO, Real AÑO-1):
```
Consolidado = sum(valor[polo] for polo in 6_polos)
```
Redondear a 2 decimales.

**Fila 207 con caché vacía (Varadero y otros)**: Algunos polos tienen `fila 207` con fórmula `=L47−L48` (o similar) pero valor cacheado `None`. En ese caso, resolver la fórmula leyendo las filas Excel referenciadas (fila 47 = fila presupuestaria 50 "Ventas Netas", fila 48 = fila presupuestaria 51 "Costos y Gastos Totales") y restando: `Plan_207 = valor_fila47 − valor_fila48`. Aplicar igualmente al Real.

### Paso 5: Calcular métricas para TABLA_COSTOS, TABLA_GASTOS y TABLA_UTILIDADES

Para cada polo (incluido Consolidado):

```
% sobre Plan       = (Real_AÑO / Plan) × 100       → si Plan = 0: 0.00
REAL AÑO - PLAN    = Real_AÑO − Plan
REAL AÑO - REAL-1  = Real_AÑO − Real_AÑO-1
% CRECIM.          = (Real_AÑO / Real_AÑO-1) × 100 → si Real_AÑO-1 = 0: 0.00
```

Redondear a 2 decimales. Valores negativos permitidos (Utilidades puede ser negativa).

### Paso 6: Calcular TABLA_COSTO_GASTO_PESO

Para cada polo (incluido Consolidado):

```
plan_c_exacto = Plan_52  / Plan_1      → si Plan_1 = 0: "-"
real_c_exacto = Real_52  / Real_1      → si Real_1 = 0: "-"
% s/Plan C = (real_c_exacto / plan_c_exacto) × 100  → round(2)  → si alguno es "-": "-"

gastos_plan = Plan_51 − Plan_52
gastos_real = Real_51 − Real_52
plan_g_exacto = gastos_plan / Plan_1   → si Plan_1 = 0: "-"
real_g_exacto = gastos_real / Real_1   → si Real_1 = 0: "-"
% s/Plan G = (real_g_exacto / plan_g_exacto) × 100  → round(2)  → si alguno es "-": "-"
```

**CRÍTICO**: El `% sobre Plan` se calcula con los valores exactos (sin redondear), luego se redondea solo el resultado final.
Costo y Gasto por Peso para mostrar: `round(exacto, 3)`.

Diferencia vs versión anterior: Gasto usa `(fila51−fila52)/fila1`, no `fila76/fila1`.

**Nota**: un polo puede tener Real Ingresos = 0 aunque tenga costos o gastos (polo cerrado con gastos fijos). En ese caso mostrar `-` en Real Costo y Real Gasto, y `-` en el `% sobre Plan` correspondiente.

### Paso 7: Construir las cuatro tablas

**TABLA_COSTOS, TABLA_GASTOS, TABLA_UTILIDADES** — misma estructura:

- Fila 0 (título fusionado): `Cumplimiento del plan de Costos` / `…Gastos` / `…Utilidades`
- Fila 1 (cabecera): `{MES} | La Habana | Varadero | Caibarién | Cayo Coco | Cayo Cruz | Holguín | Consolidado`
- Filas 2-8 (datos): Plan, Real AÑO, Real AÑO-1, % sobre Plan, R-P, R-R25, % CRECIM.

**TABLA_COSTO_GASTO_PESO**:

- Fila 0 (título fusionado): `Costo y gasto por Peso de Ingreso {MES}`
- Fila 1 (cabecera): mismos polos
- Filas 2-7: Plan Costo, Real Costo, % sobre Plan, Plan Gasto, Real Gasto, % sobre Plan

### Paso 8: Formato numérico

- Valores monetarios en COSTOS/GASTOS/UTILIDADES: `{n:,.2f}`, negativos con signo.
- Valores de Peso: `{n:.3f}`. Si no aplica: cadena `-`.
- Porcentajes: `{n:.2f}`, negativos posibles, sin símbolo `%`.

### Paso 9: Entregar resultados

1. Las cuatro tablas formateadas.
2. Registro en `data/processed/tabla_costos_gastos_{mes}_{año}.json` con todos los valores brutos y calculados por polo.

---

## Restricciones
- No leer `CONSOLIDADO` del Excel — siempre sumar los seis polos.
- No omitir polos aunque tengan todos los valores en `0.00`.
- Mostrar `-` (guión) — no `0.000` — cuando el denominador es cero en el cálculo de Peso.
- El Real AÑO-1 siempre viene del `GLOBAL-CP{AAAA-1}.xlsx`, no del bloque `AÑO ANTERIOR` del archivo actual (ese contiene el total anual, no el mensual).

## Outputs esperados
- `{TABLA_COSTOS}`, `{TABLA_GASTOS}`, `{TABLA_UTILIDADES}`, `{TABLA_COSTO_GASTO_PESO}` formateadas.
- Registro `data/processed/tabla_costos_gastos_{mes}_{año}.json`.

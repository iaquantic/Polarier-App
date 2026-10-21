# Skill: Extraer Tabla de Impacto de la Ocupación sobre los Gastos

## Identificador
`extraer-tabla-ocupacion-gastos`

## Propósito
Lee Plan/Real de Turistas Días y Plan/Real de Gastos desde la hoja `Datos económicos` de `TABLA CA {AAAA}.xlsx`, cruza con `% Cumplimiento plan de gastos` de `TABLA_GASTOS`, calcula las métricas derivadas y produce `{TABLA_GASTOS_OCUPACION}`.

## Cuándo aplicar
- Cuando `agent_tabla_ocupacion_gastos` necesita generar `{TABLA_GASTOS_OCUPACION}`.
- Después de que `agent_tabla_costos_gastos_utilidades` haya generado `TABLA_GASTOS` (se necesita `% sobre Plan` por polo).

---

## Proceso paso a paso

### Paso 1: Identificar archivo y hojas

Archivo: `TABLA CA {AAAA}.xlsx` en `data/input/mes_actual/`.

Usar las **hojas individuales por polo** (no `Datos económicos`):

| Polo | Hoja |
|---|---|
| La Habana | `HABANA` |
| Varadero | `VARADERO` |
| Caibarién | `CAIBARIEN` |
| Cayo Coco | `CAYOCOCO` |
| Cayo Cruz | `CAYOCRUZ` |
| Holguín | `HOLGUÍN` |
| Consolidado | `CONSOLIDADO` |

### Paso 2: Localizar la columna del mes

En cada hoja individual, la **fila 5** contiene los nombres de los meses a partir de la columna C:
- C=ENERO, D=FEBRERO, E=MARZO, F=ABRIL, G=MAYO, …, N=DICIEMBRE

Localizar la columna del mes actual buscando el nombre del mes (exacto, mayúsculas) en la fila 5.

### Paso 3: Leer datos por polo

Para cada hoja, en la columna del mes:

| Fila Excel | Concepto | Uso |
|---|---|---|
| 6 | PLAN TURISTAS DÍAS | Plan TD directo en tabla |
| 7 | REAL TURISTAS DÍAS | Real TD + filtro activos |
| 18 | PLAN GASTOS TOTALES (IND + FIJOS) | Plan Gastos = fila51−fila52 del GLOBAL |
| 19 | REAL GASTOS TOTALES | Real Gastos |

Leer con `data_only=True`. Si alguna celda es `None`, tratar como `0`.

### Paso 4: Determinar polos activos

Incluir solo los polos donde `Real TD (fila 7) > 0`. El Consolidado siempre se incluye.

### Paso 5: Obtener % Cumplimiento plan de gastos

Calcular directamente como `round(Real_gas / Plan_gas × 100, 2)` para cada polo activo y el Consolidado, usando los valores leídos de las hojas individuales (filas 18 y 19).

Si `TABLA_GASTOS` ya fue generada, el valor debe coincidir con el que figura en esa tabla.

### Paso 6: Calcular métricas

Para cada polo activo y el Consolidado:

```
pct_ocu_exacto      = (Real_TD / Plan_TD) × 100        → si Plan_TD = 0: 0.0  (valor sin redondear)
% Cumpl. ocupación  = round(pct_ocu_exacto, 2)          → solo para mostrar en tabla

fila_20             = 100 − pct_ocu_exacto              → usa valor exacto, NO el redondeado

Dejado_gastar       = Plan_gastos × fila_20 / 100       → round(resultado, 2)

Gasto_sin_afectación = Dejado_gastar + Real_gastos      → round(resultado, 2)

% Cumpl. estimado   = (Gasto_sin_afectación / Plan_gastos) × 100  → round(resultado, 2)
                      si Plan_gastos = 0: 0.00
```

**CRÍTICO**: `fila_20` usa `pct_ocu_exacto` (sin redondear). Si se usa el valor redondeado
a 2 decimales el resultado de `Dejado_gastar` difiere del Excel (error ~458 $ en La Habana).

**Consolidado fila 6 (Real TD)**: la fórmula del Excel es `=SUM(C6:E6)` — suma solo los
3 primeros polos (C, D, E), no los 6. Leer el valor cacheado con `data_only=True`; si es
`None`, sumar solo columnas C, D, E.

### Paso 7: Construir la tabla

**Fila 0** (título fusionado): `Impacto de la ocupación sobre los gastos`
**Fila 1** (cabecera): `{MES} | U | [polos activos] | Consolidado`
**Filas 2-8** (datos):

| Etiqueta | U | valores por polo |
|---|---|---|
| Plan de ocupación | TD | … |
| Ocupación Real | TD | … |
| % Cumplimiento plan de ocupación | % | … |
| % Cumplimiento plan de gastos | % | … |
| Dejado de gastar estimado | $ | … |
| Gasto ejecutado sin afectación de la ocupación (estimado) | $ | … |
| % Cumplimiento estimado del plan de gastos | % | … (con símbolo %) |

**Formato**:
- TD: enteros con separador de miles (p.ej. `54,321`).
- `%` filas 3-4: dos decimales sin símbolo (p.ej. `22.79`).
- `$`: separador de miles, dos decimales (p.ej. `9,876,543.21`).
- Última fila `%`: dos decimales **con símbolo** `%` (p.ej. `118.50%`) — así aparece en el modelo histórico.

### Paso 8: Entregar resultado

1. Tabla `{TABLA_GASTOS_OCUPACION}` formateada.
2. Registro en `data/processed/tabla_ocupacion_gastos_{mes}_{año}.json`.

---

## Restricciones
- No recalcular `% Cumplimiento plan de gastos` — tomarlo siempre de `TABLA_GASTOS`.
- No incluir polos con `Real TD = 0` como columnas.
- La última fila de porcentaje lleva símbolo `%` explícito — diferencia del resto de filas de porcentaje.

## Outputs esperados
- Tabla `{TABLA_GASTOS_OCUPACION}` con columnas variables según polos activos.
- Registro `data/processed/tabla_ocupacion_gastos_{mes}_{año}.json`.
- Lista de polos excluidos por inactividad.

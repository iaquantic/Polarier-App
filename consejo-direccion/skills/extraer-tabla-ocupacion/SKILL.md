# Skill: Extraer Tabla de Impacto de la Ocupación sobre los Ingresos

## Identificador
`extraer-tabla-ocupacion`

## Propósito
Extrae Plan y Real de Turistas Días desde `TABLA CA {AAAA}.xlsx`, determina qué polos están activos en el mes, cruza con `% Cumplimiento plan de ingresos` de la `TABLA_INGRESOS` ya generada, calcula las métricas derivadas y produce la tabla `{TABLA_OCUPACION}`.

## Cuándo aplicar
- Cuando `agent_tabla_ocupacion` necesita generar `{TABLA_OCUPACION}`.
- Siempre después de que `agent_tabla_ingresos` haya generado `{TABLA_INGRESOS}` (se necesita el `% sobre Plan` por polo).

---

## Proceso paso a paso

### Paso 1: Identificar el archivo fuente

Buscar en `data/input/mes_actual/`:
```
TABLA CA {AAAA}.xlsx   (p.ej. TABLA CA 2026.xlsx)
```
Si no existe, detener: `[ERROR] No se encontró TABLA CA {AAAA}.xlsx`.

### Paso 2: Determinar el mes e identificar la columna

La estructura de cada hoja es:
- **Fila 5**: cabecera de meses. La columna A es `AÑO ACTUAL ({AAAA})`, columna B es `U`, y desde la columna C en adelante: `ENERO`, `FEBRERO`, … `DICIEMBRE`, `TOTAL`.
- **Fila 6**: `PLAN TURISTAS DÍAS`
- **Fila 7**: `REAL TURISTAS DÍAS`

Localizar la columna del mes actual buscando el nombre del mes (p.ej. `ABRIL`) en la fila 5 — coincidencia exacta en mayúsculas.

### Paso 3: Leer datos por polo

Hojas y polos:

| Polo | Hoja |
|---|---|
| La Habana | `HABANA` |
| Varadero | `VARADERO` |
| Caibarién | `CAIBARIEN` |
| Cayo Coco | `CAYOCOCO` |
| Cayo Cruz | `CAYOCRUZ` |
| Holguín | `HOLGUÍN` |
| Consolidado | `CONSOLIDADO` |

Para cada hoja leer en la columna del mes actual:

| Fila Excel | Concepto |
|---|---|
| 6 | PLAN TURISTAS DÍAS |
| 7 | REAL TURISTAS DÍAS |
| 11 | PLAN INGRESOS |
| 12 | REAL INGRESOS |

Si la celda está vacía o es `None`: asignar `0` y registrar advertencia.

### Paso 4: Determinar polos activos

Incluir en la tabla solo los polos donde `Real TD > 0`.
El Consolidado se incluye siempre, pero su `Plan TD` y `Real TD` son la suma de **todos los polos** (incluyendo los inactivos), tal como aparece en la hoja `CONSOLIDADO`.

**Nota**: la hoja `CONSOLIDADO` puede tener fórmulas con caché vacía. Si los valores son `None`, calcular como suma de los seis polos.

### Paso 5: Obtener % Cumplimiento plan de ingresos

Para polos individuales: `round(Real_ing / Plan_ing × 100, 2)`.

Para el **Consolidado**: `round(sum(Real_ing de activos) / sum(Plan_ing de activos) × 100, 2)` — usar solo los polos con Real TD > 0, no los 6.

Si `TABLA_INGRESOS` ya fue generada, el valor del polo individual debe coincidir con ella; pero el Consolidado se recalcula con la suma restringida a activos.

### Paso 6: Calcular métricas

Para cada polo activo y el Consolidado:

| Fila | Fórmula |
|---|---|
| `% Cumpl. plan ocupación` | `(Real TD / Plan TD) × 100` — si Plan TD = 0, resultado = 0.00 |
| `% Cumpl. plan ingresos` | Para polos individuales: `(Real_ing / Plan_ing) × 100`. Para **Consolidado**: `sum(Real_ing de polos activos) / sum(Plan_ing de polos activos) × 100` (solo activos, no los 6 polos) |
| `Incumplimiento plan ocupación` | `Real_TD − Plan_TD` con **valores exactos** (no redondear) |
| `Estim. ingreso por incumplimiento` | `Incumplimiento_exacto × (Real_ing / Real_TD)` — usar `Real_ing/Real_TD` como ingxTD, **NO** la fila 81 de TABLAS DE CHEQUEOS. Redondear resultado a 2 decimales. |
| `Estim. ingreso sin afectación` | `Real_ingresos − Estimacion_incumplimiento` (como EstInc es negativo, esto suma magnitud) |
| `Cumplimiento estimado plan ingresos` | `(Ingreso_sin_afectación / Plan_ingresos) × 100` |

**CRÍTICO**: El Incumplimiento TD debe usar valores exactos (Plan TD puede tener decimales, ej. 68536.672). No redondear antes de multiplicar.

**CRÍTICO**: El `% Cumpl. plan ingresos` del Consolidado NO usa ingresos/plan de todos los 6 polos — usa solo la suma de los polos activos (los que tienen Real TD > 0).

Redondear porcentajes a 2 decimales. TD para mostrar como enteros. Valores monetarios a 2 decimales.

### Paso 7: Construir la tabla

**Fila 0** (título fusionado): `Impacto de la ocupación sobre los ingresos`
**Fila 1** (cabecera): `{MES} | U | [polo activo 1] | [polo activo 2] | … | Consolidado`
**Filas 2-9** (datos): una fila por indicador en el orden del modelo histórico.

### Paso 8: Entregar el resultado

Producir:
1. La tabla formateada lista para reemplazar `{TABLA_OCUPACION}`.
2. Registro en `data/processed/tabla_ocupacion_{mes}_{año}.json` con valores brutos y calculados.

---

## Restricciones
- No incluir polos con `Real TD = 0` como columnas de la tabla.
- No recalcular `% Cumplimiento plan de ingresos` — tomarlo siempre de `TABLA_INGRESOS`.
- No completar las filas marcadas `[PENDIENTE]` hasta que se confirmen las fórmulas.
- El Consolidado de TD siempre refleja la suma de todos los polos, no solo los activos.

## Outputs esperados
- Tabla `{TABLA_OCUPACION}` con columnas variables según polos activos.
- Registro `data/processed/tabla_ocupacion_{mes}_{año}.json`.
- Lista de polos excluidos por inactividad (para referencia del `agent_economia`).

## Fuente del Ingreso por Turista-Día

El `Ingreso_por_TD` se calcula directamente como:
```
Ingreso_por_TD = Real_ingresos / Real_TD
```
donde `Real_ingresos` y `Real_TD` vienen de la hoja del polo en `TABLA CA {AAAA}.xlsx` (filas 12 y 7 respectivamente, columna del mes). Esta es la fórmula exacta que produce los resultados del DOCX histórico.

La hoja `TABLAS DE CHEQUEOS MENSUAL` fila 81 contiene el mismo valor calculado por el Excel, pero puede tener diferencias de redondeo (`#DIV/0!` si Real_TD = 0). Usar el cálculo directo `Real_ing/Real_TD` es más robusto y preciso.

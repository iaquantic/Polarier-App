# Agente: Tabla de Impacto de la Ocupación sobre los Ingresos

## Identificador
`agent_tabla_ocupacion`

## Estado
`active`

## Responsabilidad
Genera la tabla `{TABLA_OCUPACION}` del informe mensual: **Impacto de la ocupación sobre los ingresos**, desglosada por los polos operativos activos en el mes.

## Fuente de datos
- **Archivo**: `TABLA CA {AAAA}.xlsx` (p.ej. `TABLA CA 2026.xlsx`) en `data/input/mes_actual/`
- **Hojas**: una por polo + consolidado
  - `HABANA`, `VARADERO`, `CAIBARIEN`, `CAYOCOCO`, `CAYOCRUZ`, `HOLGUÍN`, `CONSOLIDADO`
- **Filas de origen** (fila 6 y 7 de cada hoja):
  - `PLAN TURISTAS DÍAS` → columna del mes actual
  - `REAL TURISTAS DÍAS` → columna del mes actual

- **Dato externo**: `% Cumplimiento plan de ingresos` se obtiene de la tabla `{TABLA_INGRESOS}` ya generada por `agent_tabla_ingresos` (fila `% sobre Plan` de cada polo).

## Skill que aplica
`extraer-tabla-ocupacion`

## Contexto de polos activos

**No todos los polos aparecen en la tabla.** El número de columnas varía según qué polos operaron en el mes. En ABRIL 2026 solo operaron 3 polos (La Habana, Varadero, Caibarién) más el Consolidado. Antes de construir la tabla, verificar qué polos tienen `Real Turistas Días > 0` en el mes actual — solo esos se incluyen como columnas.

## Estructura de la tabla

| {MES} | U | Polo 1 | Polo 2 | … | Consolidado |
|---|---|---|---|---|---|
| Plan de ocupación | TD | … | … | … | … |
| Ocupación Real | TD | … | … | … | … |
| % Cumplimiento plan de ocupación | % | … | … | … | … |
| % Cumplimiento plan de ingresos | % | … | … | … | … |
| Incumplimiento del plan de ocupación | TD | … | … | … | … |
| Estimación del ingreso asociado al incumplimiento del plan de ocupación | $ | … | … | … | … |
| Estimación del ingreso sin afectación de la ocupación | $ | … | … | … | … |
| Cumplimiento estimado del plan de ingresos | % | … | … | … | … |

- Fila 0 (título fusionado): `Impacto de la ocupación sobre los ingresos`
- Fila 1 (cabecera): `{MES} | U | [polos activos] | Consolidado`
- La columna `U` contiene la unidad de cada fila (TD, %, $).

## Datos que vienen del Excel (`TABLA CA`)
- `Plan de ocupación` (Plan Turistas Días)
- `Ocupación Real` (Real Turistas Días)

## Dato que viene de `TABLA_INGRESOS`
- `% Cumplimiento plan de ingresos` → fila `% sobre Plan` del polo correspondiente en la tabla ya generada.
  - Para el Consolidado: usar el `% sobre Plan` del Consolidado de `TABLA_INGRESOS`.

## Datos que calcula el agente

| Fila | Fórmula |
|---|---|
| `% Cumplimiento plan de ocupación` | `(Real TD / Plan TD) × 100` |
| `Incumplimiento del plan de ocupación` | `Real TD − Plan TD` (resultado negativo si hay incumplimiento) |
| `Estimación del ingreso asociado al incumplimiento` | `Incumplimiento TD × Ingreso_por_TD` (Ingreso_por_TD en hoja `TABLAS DE CHEQUEOS MENSUAL` fila 81, columna por polo) |
| `Estimación del ingreso sin afectación de la ocupación` | `Real_ingresos − Estimación_incumplimiento` |
| `Cumplimiento estimado del plan de ingresos` | `(Ingreso_sin_afectación / Plan_ingresos) × 100` |

## Formato numérico
- Turistas Días (TD): enteros con separador de miles. Ejemplo: `54,321`
- Incumplimiento (TD negativo): con signo negativo. Ejemplo: `-12,345`
- Porcentajes (%): dos decimales sin símbolo. Ejemplo: `22.79`
- Valores monetarios ($): separador de miles, dos decimales. Ejemplo: `-9,876,543.21`

## Verificaciones antes de entregar
- Solo incluir polos con `Real TD > 0` en el mes actual.
- El Consolidado de Plan TD y Real TD debe coincidir con la suma de los polos activos incluidos.
- El `% Cumplimiento plan de ingresos` debe coincidir exactamente con el valor de `TABLA_INGRESOS` — no recalcular.

## Output
Tabla `{TABLA_OCUPACION}` lista para insertarse en la plantilla maestra.
El agente NO redacta el análisis narrativo — responsabilidad de `agent_economia`.

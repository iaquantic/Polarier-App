# Agente: Tabla de Ingresos

## Identificador
`agent_tabla_ingresos`

## Estado
`active`

## Responsabilidad
Genera la tabla `{TABLA_INGRESOS}` del informe mensual del Consejo de Dirección: **Cumplimiento del plan de Ingresos** por polo operacional.

## Fuente de datos
- **Archivo**: `GLOBAL-CP{AA}.xlsx` (donde `{AA}` son los dos últimos dígitos del año en curso, p.ej. `GLOBAL-CP26.xlsx`)
- **Hojas**: una hoja por polo + hoja de consolidado

  | Polo | Nombre de hoja |
  |---|---|
  | La Habana | `LHCP{AAAA}` (p.ej. `LHCP2026`) |
  | Varadero | `VARCP{AAAA}` (p.ej. `VARCP2026`) |
  | Caibarién | `CACP{AAAA}` (p.ej. `CACP2026`) |
  | Cayo Coco | `CCCP{AAAA}` (p.ej. `CCCP2026`) |
  | Cayo Cruz | `CCZCP{AAAA}` (p.ej. `CCZCP2026`) |
  | Holguín | `HOLCP{AAAA}` (p.ej. `HOLCP2026`) |
  | Consolidado | `CONSOLIDADO` |

  donde `{AAAA}` es el año completo del informe (p.ej. `2026`).

## Skill que aplica
`extraer-tabla-ingresos` — define el proceso completo de extracción, cálculo y formato.

## Tabla que produce

Estructura final (8 columnas × 9 filas incluida cabecera):

| {MES} | La Habana | Varadero | Caibarién | Cayo Coco | Cayo Cruz | Holguín | Consolidado |
|---|---|---|---|---|---|---|---|
| Plan | … | … | … | … | … | … | … |
| Real {AÑO} | … | … | … | … | … | … | … |
| Real {AÑO-1} | … | … | … | … | … | … | … |
| % sobre Plan | … | … | … | … | … | … | … |
| REAL {AÑO} - PLAN {AÑO} | … | … | … | … | … | … | … |
| REAL {AÑO} - REAL {AÑO-1} | … | … | … | … | … | … | … |
| % CRECIM. | … | … | … | … | … | … | … |

- La fila de cabecera lleva el título fusionado: **"Cumplimiento del plan de Ingresos"** (fila 0, todas las celdas fusionadas).
- La segunda fila de cabecera muestra el mes en la primera columna y los nombres de polo en las siguientes.
- Los valores monetarios se formatean con separador de miles y dos decimales (p.ej. `12,345,678.90`).
- Los porcentajes se expresan con dos decimales sin símbolo `%` en la celda (p.ej. `33.26`).
- Las diferencias negativas llevan signo negativo explícito.

## Datos que vienen del Excel (no calcular)
- `Plan` — valor de la columna Plan para el mes actual, Fila=1, Partida="Ventas Totales"
- `Real {AÑO}` — valor de la columna Real del año en curso para el mes actual, misma localización
- `Real {AÑO-1}` — valor Real del año anterior para el mismo mes, misma localización

## Datos que calcula el agente
| Fila | Fórmula |
|---|---|
| `% sobre Plan` | `(Real AÑO / Plan) × 100` |
| `REAL AÑO - PLAN AÑO` | `Real AÑO − Plan` |
| `REAL AÑO - REAL AÑO-1` | `Real AÑO − Real AÑO-1` |
| `% CRECIM.` | `(Real AÑO / Real AÑO-1) × 100` |

Si `Plan = 0` para un polo: `% sobre Plan = 0.00`.
Si `Real AÑO-1 = 0` para un polo: `% CRECIM. = 0.00`.

## Verificaciones antes de entregar
- El Consolidado **no se lee del Excel** — se calcula siempre como suma de los seis polos (la hoja `CONSOLIDADO` tiene fórmulas cuya caché puede estar vacía).
- Los valores calculados (%, diferencias) deben verificarse aritméticamente antes de escribir la tabla.

## Output
Una tabla DOCX-compatible lista para insertarse en el marcador `{TABLA_INGRESOS}` de la plantilla maestra, siguiendo el estilo visual de los documentos históricos (misma estructura de filas/columnas, mismo formato numérico).

El agente NO redacta el análisis narrativo — eso es responsabilidad de `agent_economia`.

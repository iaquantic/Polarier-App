# Skill: Extraer Tabla de Ingresos

## Identificador
`extraer-tabla-ingresos`

## Propósito
Extrae los valores de Plan e Ingresos Reales (año actual y año anterior) desde el archivo `GLOBAL-CP{AA}.xlsx`, calcula las métricas derivadas y produce la tabla `{TABLA_INGRESOS}` con el formato histórico del informe del Consejo de Dirección.

## Cuándo aplicar
- Cuando el agente `agent_tabla_ingresos` necesita generar `{TABLA_INGRESOS}`.
- Siempre al inicio del flujo mensual, antes de construir el DOCX de input.

---

## Proceso paso a paso

### Paso 1: Identificar los archivos fuente

Buscar en la carpeta de entrada del mes (`data/input/mes_actual/`) los dos archivos:
```
GLOBAL-CP{AAAA}.xlsx   ← año actual (p.ej. GLOBAL-CP26.xlsx para 2026)
GLOBAL-CP{AAAA-1}.xlsx ← año anterior (p.ej. GLOBAL-CP25.xlsx)
```

El Real 2025 del mes específico se obtiene de `GLOBAL-CP25.xlsx`, no del bloque `AÑO 2025` del archivo actual (ese bloque contiene el total anual, no el valor mensual).

Si `GLOBAL-CP{AAAA}.xlsx` no existe: detener y notificar `[ERROR] No se encontró GLOBAL-CP{AA}.xlsx en data/input/mes_actual/`.
Si `GLOBAL-CP{AAAA-1}.xlsx` no existe: registrar advertencia y dejar `Real {AÑO-1} = 0.00` para todos los polos.

### Paso 2: Determinar el mes del informe

El mes se infiere del nombre del DOCX de tablas en `data/input/mes_actual/` (p.ej. `Informe ABRIL tablas.docx` → mes = `ABRIL`).

Mapa de mes → número de mes (para localizar la columna correcta en el Excel):
```
ENERO=1, FEBRERO=2, MARZO=3, ABRIL=4, MAYO=5, JUNIO=6,
JULIO=7, AGOSTO=8, SEPTIEMBRE=9, OCTUBRE=10, NOVIEMBRE=11, DICIEMBRE=12
```

### Paso 3: Extraer datos de cada hoja de polo

Para cada una de las siete hojas del archivo `GLOBAL-CP{AA}.xlsx`:

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

Para cada hoja:

1. Leer la hoja completa.
2. Localizar las columnas `Filas` y `Partida presupuestaria` — son siempre las dos primeras columnas identificadoras de la hoja.
3. Encontrar la fila donde:
   - `Filas = 1`
   - `Partida presupuestaria = "Ventas Totales"` (coincidencia exacta, insensible a mayúsculas/minúsculas y espacios extra)
4. Dentro de esa fila, localizar las columnas correspondientes al mes actual:
   - Columna `Plan` del mes (encabezado contiene el nombre del mes, p.ej. `ABRIL`, y la sub-columna `PLAN` o similar)
   - Columna `Real` del año en curso (encabezado del mes + sub-columna `REAL` o año actual)
   - Columna `Real` del año anterior (encabezado del mes + sub-columna del año anterior, p.ej. `2025`)
5. Leer los tres valores numéricos. Si una celda está vacía o es texto no numérico, asignar `0.00` y registrar advertencia.

**Nota sobre la estructura de columnas del Excel**:
- Fila 4 contiene el nombre del mes (p.ej. `MAYO`). Algunos meses usan celdas fusionadas — el valor aparece solo en la primera columna del grupo.
- Fila 5 contiene la sub-cabecera: `PLAN`, `REAL`, `Qp`. En algunas hojas la sub-cabecera del plan es `PLAN (Qp)` en lugar de `PLAN` — buscar con `startswith("PLAN")`, no por coincidencia exacta.
- La sub-columna `REAL` siempre es la segunda del grupo del mes (la que sigue a `PLAN`).
- La hoja `CONSOLIDADO` tiene fórmulas cuya caché puede estar vacía en openpyxl. **No leer el Consolidado del Excel — calcularlo siempre como suma de los seis polos** (ver Paso 5).

### Paso 4: Calcular métricas derivadas

Para cada polo (incluido Consolidado):

```
% sobre Plan       = (Real_AÑO / Plan) × 100          → si Plan = 0, resultado = 0.00
REAL AÑO - PLAN    = Real_AÑO − Plan
REAL AÑO - REAL-1  = Real_AÑO − Real_AÑO-1
% CRECIM.          = (Real_AÑO / Real_AÑO-1) × 100    → si Real_AÑO-1 = 0, resultado = 0.00
```

Redondear todos los resultados a 2 decimales.

### Paso 5: Calcular el Consolidado

La hoja `CONSOLIDADO` contiene fórmulas cuya caché puede estar vacía al leer con openpyxl. **Calcular siempre el Consolidado sumando los seis polos**:

```
Plan[Consolidado]   = sum(Plan[polo] for polo in 6 polos)
Real26[Consolidado] = sum(Real26[polo] for polo in 6 polos)
Real25[Consolidado] = sum(Real25[polo] for polo in 6 polos)
```

Redondear a 2 decimales.

### Paso 6: Formatear la tabla

Construir la tabla con esta estructura exacta:

**Fila 0** (título fusionado): `Cumplimiento del plan de Ingresos`
**Fila 1** (cabecera de columnas): `{MES} | La Habana | Varadero | Caibarién | Cayo Coco | Cayo Cruz | Holguín | Consolidado`
**Filas 2-8** (datos):

| Etiqueta de fila | Habana | Varadero | Caibarién | Cayo Coco | Cayo Cruz | Holguín | Consolidado |
|---|---|---|---|---|---|---|---|
| Plan | valor | … | … | … | … | … | valor |
| Real {AÑO} | valor | … | … | … | … | … | valor |
| Real {AÑO-1} | valor | … | … | … | … | … | valor |
| % sobre Plan | valor | … | … | … | … | … | valor |
| REAL {AÑO} - PLAN {AÑO} | valor | … | … | … | … | … | valor |
| REAL {AÑO} - REAL {AÑO-1} | valor | … | … | … | … | … | valor |
| % CRECIM. | valor | … | … | … | … | … | valor |

**Formato numérico**:
- Valores monetarios (Plan, Real, diferencias): separador de miles con coma, dos decimales. Ejemplo: `12,345,678.90`
- Diferencias negativas: con signo negativo. Ejemplo: `-9,876,543.21`
- Porcentajes: sin símbolo `%`, dos decimales. Ejemplo: `33.26`

### Paso 7: Entregar el resultado

Producir:
1. La tabla formateada lista para reemplazar `{TABLA_INGRESOS}` en la plantilla maestra.
2. Un registro en `data/processed/` con los valores extraídos y calculados (para auditoría posterior).

---

## Restricciones
- No recalcular el valor `Consolidado` sumando los polos — usar siempre el valor de la hoja `Consolidado` del Excel.
- No inventar valores si una celda está vacía — registrar `0.00` y advertencia.
- No modificar el orden de las filas ni de las columnas de la tabla de salida.
- No incluir columnas adicionales que no estén en la estructura histórica.
- Si el Excel tiene el mes buscado pero la fila `Filas=1 / Ventas Totales` no existe, detener y notificar.

## Outputs esperados
- Tabla `{TABLA_INGRESOS}` formateada con 8 columnas × 9 filas (1 título + 1 cabecera + 7 filas de datos).
- Registro de extracción en `data/processed/tabla_ingresos_{mes}_{año}.json` con los valores brutos y calculados.
- Lista de advertencias si algún polo tiene valor `0.00` por celda vacía.

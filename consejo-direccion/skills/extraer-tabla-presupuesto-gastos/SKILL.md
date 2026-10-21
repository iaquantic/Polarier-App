# Skill: Extraer Tabla de Ejecución del Presupuesto de Gastos

## Identificador
`extraer-tabla-presupuesto-gastos`

## Propósito
Extrae Plan y Real de todas las partidas presupuestarias desde las seis hojas de polo de `GLOBAL-CP{AAAA}.xlsx`, las suma para obtener el Consolidado, calcula el `Qp` y produce la tabla `{TABLA_PRESUPUESTO_GASTOS}`.

## Cuándo aplicar
- Cuando `agent_tabla_presupuesto_gastos` necesita generar `{TABLA_PRESUPUESTO_GASTOS}`.
- Después de que `agent_tabla_ingresos` haya generado `{TABLA_INGRESOS}` (se usa para verificación cruzada de la partida 1).

---

## Proceso paso a paso

### Paso 1: Identificar el archivo y las hojas

Archivo: `GLOBAL-CP{AAAA}.xlsx` en `data/input/mes_actual/`.

Hojas de polo a leer (NO leer `CONSOLIDADO`):

| Polo | Hoja |
|---|---|
| La Habana | `LHCP{AAAA}` |
| Varadero | `VARCP{AAAA}` |
| Caibarién | `CACP{AAAA}` |
| Cayo Coco | `CCCP{AAAA}` |
| Cayo Cruz | `CCZCP{AAAA}` |
| Holguín | `HOLCP{AAAA}` |

### Paso 2: Localizar las columnas del mes en cada hoja

Estructura de cabeceras (igual en todas las hojas):
- **Fila 4**: nombre del mes (p.ej. `MAYO`). La columna del mes es la primera de su grupo.
- **Fila 5**: sub-cabeceras `PLAN` (o `PLAN (Qp)`), `REAL`, `Qp` — en ese orden dentro del grupo.

Localizar la columna `PLAN` del mes buscando en fila 4 el nombre del mes y en fila 5 una sub-cabecera que empiece por `PLAN`. La columna `REAL` es la inmediatamente siguiente.

### Paso 3: Extraer todas las partidas de cada hoja

Para cada hoja de polo, recorrer desde la fila 6 en adelante:
- Columna A (`Filas`): número de partida — debe ser un entero.
- Columna B (`Partida presupuestaria`): nombre de la partida.
- Columna `PLAN` del mes: valor numérico (puede ser 0 o None).
- Columna `REAL` del mes: valor numérico (puede ser 0 o None).

**IMPORTANTE**: En algunas hojas (CACP y HOLCP) la columna A almacena el número como texto con comilla inicial (ej. `'207`). Parsear siempre con:
```python
fn = int(str(raw).strip().strip("'"))
```

Tratar `None` como `0.0` al sumar, pero registrar advertencia si todas las hojas devuelven `None` para una misma partida.

### Paso 4: Consolidar sumando los seis polos

Para cada número de partida (`Filas`):
```
Plan_consolidado = sum(Plan[polo] for polo in 6_polos)   # None → 0
Real_consolidado = sum(Real[polo] for polo in 6_polos)   # None → 0
```

El nombre de la partida (`Partida presupuestaria`) se toma de la primera hoja que lo tenga — es el mismo en todas.

Mantener el orden numérico ascendente de la columna `Filas`.

### Paso 5: Calcular el Qp

Para cada partida del Consolidado:

```
Si Plan > 0:
    Qp = str(round(Real / Plan * 100)) + "%"
Si Plan == 0 y Real != 0:
    Qp = "N/P"
Si Plan == 0 y Real == 0:
    Qp = "0%"
```

`Qp` se expresa como entero + `%`. Valores negativos posibles (p.ej. `-3%` cuando Real es negativo y Plan positivo).

### Paso 6: Verificación cruzada

Verificar que el `Plan` y `Real` de la partida `Filas = 1` (Ventas Totales) coincidan con los valores del Consolidado en `TABLA_INGRESOS`:
- `Plan` de partida 1 ≈ `Plan[Consolidado]` de `TABLA_INGRESOS`
- `Real` de partida 1 ≈ `Real 2026[Consolidado]` de `TABLA_INGRESOS`

Si hay discrepancia: registrar `[AVISO] Discrepancia entre presupuesto (partida 1) e ingresos — verificar`. No bloquear la generación, pero incluir el aviso.

### Paso 7: Construir la tabla

**Fila 0** (cabecera de mes, fusionada sobre cols PLAN/REAL/Qp):
```
Filas | Partida presupuestaria | {MES}
```

**Fila 1** (sub-cabecera):
```
Filas | Partida presupuestaria | PLAN | REAL | Qp
```

**Filas de datos**: una por partida en orden numérico ascendente de `Filas`.

Formato:
- Columna `Filas`: número entero, sin formato especial.
- Columna `Partida presupuestaria`: texto tal como aparece en el Excel (con indentación de espacios si la tiene).
- Columna `PLAN` y `REAL`: separador de miles, dos decimales. Negativos con signo.
- Columna `Qp`: string con `%` o `N/P`.

### Paso 8: Entregar el resultado

Producir:
1. Tabla `{TABLA_PRESUPUESTO_GASTOS}` formateada.
2. Registro en `data/processed/tabla_presupuesto_gastos_{mes}_{año}.json` con los valores por partida.

---

## Restricciones
- No leer la hoja `CONSOLIDADO` del Excel — siempre calcular sumando los seis polos.
- No omitir partidas aunque tengan `Plan = 0` y `Real = 0` si aparecen en el modelo histórico.
- No modificar el orden ni los nombres de las partidas presupuestarias.
- El `Qp` siempre es entero (sin decimales), no `11.18%` sino `11%`.

## Outputs esperados
- Tabla `{TABLA_PRESUPUESTO_GASTOS}` con 5 columnas y N filas de partidas.
- Registro `data/processed/tabla_presupuesto_gastos_{mes}_{año}.json`.
- Lista de advertencias si partida 1 no cuadra con `TABLA_INGRESOS`.

# Skill: Extraer Tabla de Edades de Cuentas por Cobrar

## Identificador
`extraer-tabla-cuentas-cobrar`

## Propósito
Consolida las edades de las cuentas por cobrar de cada polo productivo leyendo los archivos individuales `{POLO}CD{AAAA}{MM}.xlsx`, y produce `{TABLA_CUENTAS_COBRAR}`.

## Cuándo aplicar
- Cuando `agent_tabla_cuentas_cobrar` necesita generar `{TABLA_CUENTAS_COBRAR}`.

---

## Proceso paso a paso

### Paso 1: Archivos fuente

Un archivo por polo en `data/input/mes_actual/`, con nombre `{POLO}CD{AAAA}{MM}.xlsx`:

| Polo | Prefijo archivo |
|---|---|
| La Habana (077) | `LHCD` |
| Varadero (080) | `VACD` |
| Caibarién / Centro (082) | `CACD` |
| Cayo Coco (081) | `CCCD` |
| Cayo Cruz (083) | `CZCD` |
| Holguín (076) | `HOCD` |

### Paso 2: Hoja y localización

- Hoja: la que contiene `conom` en el nombre (ej. `2.Economía `). Buscar con `.lower()`.
- La sección de **Cuentas por Cobrar** está en las **columnas BN:BT** (índice openpyxl 66:72).

### Paso 3: Estructura de columnas (fila cabecera = fila 3)

| Col openpyxl | Letra Excel | Contenido |
|---|---|---|
| 66 | BN | Cuenta / Grupo |
| 67 | BO | Cliente |
| 68 | BP | 0–30 días |
| 69 | BQ | 31–60 días |
| 70 | BR | 61–90 días |
| 71 | BS | 91–120 días |
| 72 | BT | + de 120 días |

### Paso 4: Leer totales por polo

La hoja tiene 3 secciones de clientes (GAE MN, TERCEROS MN, GAVIOTA MN). Cada una termina en una fila con texto `'TOTAL '` (incluye espacio). La fila con texto `'TOTAL MN'` en col 67 contiene el **gran total monetario** en col 68, pero NO desglosa por edad.

Para obtener el desglose por edad del polo, sumar las filas `'TOTAL '` de cada sección:

```python
def leer_cobrar_polo(ws):
    """Retorna dict con keys: c30, c60, c90, c120, cmas, total"""
    totales = {'c30': 0.0, 'c60': 0.0, 'c90': 0.0, 'c120': 0.0, 'cmas': 0.0}
    for row_n in range(1, ws.max_row + 1):
        label = str(ws.cell(row=row_n, column=66).value or '').strip()
        if label == 'TOTAL':   # fila de subtotal por sección
            totales['c30']  += float(ws.cell(row=row_n, column=68).value or 0)
            totales['c60']  += float(ws.cell(row=row_n, column=69).value or 0)
            totales['c90']  += float(ws.cell(row=row_n, column=70).value or 0)
            totales['c120'] += float(ws.cell(row=row_n, column=71).value or 0)
            totales['cmas'] += float(ws.cell(row=row_n, column=72).value or 0)
    totales['total'] = sum(totales.values())
    return totales
```

> **Nota**: Ignorar la fila `'TOTAL MN'` (col 67) — esa sólo tiene un total monetario bruto en col 68, sin desglose.

### Paso 5: Mapeo de edades al informe

Las columnas del informe tienen nomenclatura diferente a los días del archivo CD:

| Columna informe | Columna CD | Cálculo |
|---|---|---|
| 0–30 | 30d | `c30` |
| 31–60 | 60d | `c60` |
| 61–90 | 90d | `c90` |
| MÁS DE 90 | 120d + +120d | `c120 + cmas` |
| TOTAL | suma todos | `c30+c60+c90+c120+cmas` |
| VENCIDAS +30 DÍAS | 31d en adelante | `c60+c90+c120+cmas` |
| % | VENCIDAS / TOTAL | `vencidas / total × 100` |

> **Confirmado**: "VENCIDAS +30 DÍAS" = cuentas con más de 30 días de antigüedad = `c60+c90+c120+cmas` (NO solo +60). Verificado contra el DOCX de marzo (Habana, cuentas por cobrar). Las cifras de la comprobación se retiraron: el repositorio es público.

### Paso 6: Polos activos

Incluir en columnas solo los polos donde el archivo existe **y** el TOTAL > 0. El TOTAL de la tabla siempre incluye todos los polos.

### Paso 7: Construir tabla

**Fila 0** (título): `Edades de las Cuentas por Cobrar`
**Fila 1** (cabecera): `{MES} | [polos activos] | TOTAL`
**Filas 2-8**:

| Etiqueta |
|---|
| 0-30 |
| 31-60 |
| 61-90 |
| MÁS DE 90 |
| TOTAL |
| VENCIDAS + 30 DÍAS |
| % |

**Formato**: números con 2 decimales y separador de miles. % con 2 decimales + `%`.

### Paso 8: TOTAL de la tabla

El TOTAL de cada columna de edad = suma de todos los polos (activos e inactivos). Si un polo no tiene archivo o su TOTAL = 0, se suma con cero.

### Paso 9: Entregar

1. Tabla `{TABLA_CUENTAS_COBRAR}` formateada.
2. Registro `data/processed/tabla_cuentas_cobrar_{mes}_{año}.json`.

---

## Restricciones
- No recalcular: leer los subtotales ya calculados por el Excel (filas TOTAL de cada sección).
- No mezclar `TOTAL MN` con los subtotales de sección — son filas distintas.
- Las cuentas con valor `None` o ausentes cuentan como 0.

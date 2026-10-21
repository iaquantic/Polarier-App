# Skill: Extraer Tabla de Edades de Cuentas por Pagar

## Identificador
`extraer-tabla-cuentas-pagar`

## Propósito
Consolida las edades de las cuentas por pagar de cada polo productivo leyendo los archivos individuales `{POLO}CD{AAAA}{MM}.xlsx`, y produce `{TABLA_CUENTAS_PAGAR}`.

## Cuándo aplicar
- Cuando `agent_tabla_cuentas_pagar` necesita generar `{TABLA_CUENTAS_PAGAR}`.

---

## Proceso paso a paso

### Paso 1: Archivos fuente

Exactamente los mismos archivos que T11 (`{POLO}CD{AAAA}{MM}.xlsx`). Ver `extraer-tabla-cuentas-cobrar` para la tabla de prefijos y ruta.

### Paso 2: Hoja y localización

- Hoja: la que contiene `conom` en el nombre (ej. `2.Economía `). Buscar con `.lower()`.
- La sección de **Cuentas por Pagar** está en las **columnas BF:BL** (índice openpyxl 58:64).

### Paso 3: Estructura de columnas (fila cabecera = fila 3)

| Col openpyxl | Letra Excel | Contenido |
|---|---|---|
| 58 | BF | Cuenta / Grupo |
| 59 | BG | Descripción |
| 60 | BH | 0–30 días |
| 61 | BI | 31–60 días |
| 62 | BJ | 61–90 días |
| 63 | BK | 91–120 días |
| 64 | BL | + de 120 días |

### Paso 4: Leer totales por polo

Igual que cobrar, la hoja tiene secciones (GAE MN, TERCEROS MN, GAVIOTA MN) con subtotales. Sumar las filas donde col 58 = `'TOTAL'` (con o sin espacio al final):

```python
def leer_pagar_polo(ws):
    """Retorna dict con keys: c30, c60, c90, c120, cmas, total"""
    totales = {'c30': 0.0, 'c60': 0.0, 'c90': 0.0, 'c120': 0.0, 'cmas': 0.0}
    for row_n in range(1, ws.max_row + 1):
        # En pagar, el TOTAL de sección puede estar en col 58 o col 59
        label58 = str(ws.cell(row=row_n, column=58).value or '').strip()
        label59 = str(ws.cell(row=row_n, column=59).value or '').strip()
        if label58 == 'TOTAL' or label59 == 'TOTAL':
            totales['c30']  += float(ws.cell(row=row_n, column=60).value or 0)
            totales['c60']  += float(ws.cell(row=row_n, column=61).value or 0)
            totales['c90']  += float(ws.cell(row=row_n, column=62).value or 0)
            totales['c120'] += float(ws.cell(row=row_n, column=63).value or 0)
            totales['cmas'] += float(ws.cell(row=row_n, column=64).value or 0)
    totales['total'] = sum(totales.values())
    return totales
```

> **Nota**: En el archivo CACD, la fila TOTAL TERCEROS MN tiene el label en col 59 en vez de col 58. Verificar ambas columnas.

### Paso 5: Mapeo de edades al informe

Mismo mapeo que cobrar:

| Columna informe | Cálculo |
|---|---|
| 0–30 | `c30` |
| 31–60 | `c60` |
| 61–90 | `c90` |
| MÁS DE 90 | `c120 + cmas` |
| TOTAL | suma todos |
| VENCIDAS +30 DÍAS | `c60+c90+c120+cmas` (31d en adelante) |
| % | `vencidas / total × 100` |

> **Confirmado**: "VENCIDAS +30 DÍAS" = `c60+c90+c120+cmas`. Verificado contra el DOCX de marzo (Habana, cuentas por pagar) ✓. Las cifras de la comprobación se retiraron: el repositorio es público.

### Paso 6–9: Construcción de tabla y entrega

Igual que `extraer-tabla-cuentas-cobrar`, pero título = `Edades de las Cuentas por Pagar`, variable = `{TABLA_CUENTAS_PAGAR}`, y archivo procesado = `tabla_cuentas_pagar_{mes}_{año}.json`.

---

## Restricciones
- Leer subtotales de sección, no recalcular celda a celda.
- La fila `'TOTAL MN'` (con texto en col 59) es diferente a los subtotales de sección — ignorarla para el desglose por edad.
- `#DIV/0!` en columna % = tratar como 0 o `-` si total = 0.

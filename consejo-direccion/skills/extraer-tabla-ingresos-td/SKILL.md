# Skill: Extraer Tabla de Ingresos por Turista Día

## Identificador
`extraer-tabla-ingresos-td`

## Propósito
Lee el indicador "Ingresos por Turista Día" del año actual y del año anterior desde las hojas individuales de `TABLA CA {AAAA}.xlsx`, determina los polos activos, calcula las métricas derivadas y produce `{TABLA_INGRESOS_TD}`.

## Cuándo aplicar
- Cuando `agent_tabla_ingresos_td` necesita generar `{TABLA_INGRESOS_TD}`.

---

## Proceso paso a paso

### Paso 1: Identificar archivo y hojas

Archivo: `TABLA CA {AAAA}.xlsx` en `data/input/mes_actual/`.

Hojas individuales por polo (mismas que Tabla 2 y 6):

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

En cada hoja, **fila 5** tiene los nombres de meses a partir de la columna C:
- C=ENERO, D=FEBRERO, E=MARZO, F=ABRIL, G=MAYO, …, N=DICIEMBRE

Localizar la columna del mes actual buscando el nombre exacto (mayúsculas) en fila 5.

### Paso 3: Estructura de la hoja — dos secciones

Cada hoja tiene **dos secciones**:
- **Sección año actual** (filas ~6-60): encabezado "AÑO ACTUAL (AAAA-1)" en fila 5. Contiene los datos del año en curso.
- **Sección año anterior** (filas ~62-115): encabezado "AÑO ANTERIOR (AAAA-2)" en fila ~62. Contiene los datos del año anterior.

La fila exacta del indicador `INGRESOS TOTALES X TD` varía ligeramente, pero se puede localizar por etiqueta de texto:

- **Año actual**: buscar `INGRESOS TOTALES X TD` entre filas 1-70 → registrar número de fila → usar ese valor
- **Año anterior**: buscar `INGRESOS TOTALES X TD` entre filas 70-150 → registrar número de fila → usar ese valor

En la práctica, para todas las hojas en el archivo actual: **fila 43** = Ingreso actual, **fila 98** = Ingreso anterior. Verificar si cambia con una búsqueda de texto por seguridad.

### Paso 4: Leer datos por polo

Para cada hoja, en la columna del mes:

| Fila | Concepto | Uso |
|---|---|---|
| 6 | PLAN TURISTAS DÍAS | Para calcular Ingreso Plan |
| 7 | REAL TURISTAS DÍAS | Filtro polos activos |
| 11 | PLAN INGRESOS | Para calcular Ingreso Plan |
| 43 | INGRESOS TOTALES X TD (año actual) | Ingreso medio {AAAA} |
| 98 | INGRESOS TOTALES X TD (año anterior) | Ingreso medio {AAAA-1} |

Si alguna celda es `None` o `#DIV/0!`, tratar como `0.0`.

### Paso 5: Determinar polos activos

Incluir solo los polos donde `Real TD (fila 7) > 0`. El Consolidado siempre se incluye.

### Paso 6: Calcular métricas

Para cada polo activo y el Consolidado:

```
Ingreso Plan       = round(Plan_ing / Plan_TD, 2)   → si Plan_TD = 0: "-"
Ingreso medio      = round(fila_43, 2)               → Ingreso por TD del año actual
% sobre Plan       = round(Ingreso_medio / Ingreso_Plan × 100, 2)   → si Ingreso_Plan = 0: "-"
Ingreso medio {AAAA-1} = round(fila_98, 2)           → Ingreso por TD del año anterior
% CRECIM.          = round(Ingreso_medio / Ingreso_medio_{AAAA-1} × 100, 2)  → si {AAAA-1} = 0: "-"
```

**Nota de redondeo**: los valores de `fila 43` y `fila 98` son ratios calculados por el Excel con muchos decimales. Redondear a 2 decimales para mostrar. El `%` usa esos valores redondeados a 2 dec, lo que puede producir diferencias de ±0.01 respecto al DOCX — es aceptable.

### Paso 7: Construir la tabla

**Fila 0** (título fusionado): `Ingresos por turista día`
**Fila 1** (cabecera): `{MES} | [polos activos] | Consolidado`
**Filas 2-6** (datos):

| Etiqueta | valores por polo |
|---|---|
| Ingreso Plan | … |
| Ingreso medio | … |
| % sobre Plan | … |
| Ingreso medio {AAAA-1} | … |
| % CRECIM. | … |

**Formato**:
- Todos los valores: `{n:.2f}` (dos decimales, sin separador de miles).
- Si no aplica: `-`.

### Paso 8: Entregar resultado

1. Tabla `{TABLA_INGRESOS_TD}` formateada.
2. Registro en `data/processed/tabla_ingresos_td_{mes}_{año}.json`.

---

## Restricciones
- No incluir polos con `Real TD = 0` como columnas.
- El Consolidado siempre se incluye aunque algunos polos individuales sean 0.
- Los valores de Ingreso por TD vienen de la hoja `TABLA CA` (ya calculados por el Excel), no del `GLOBAL`.
- No hay columna de Unidades (U) en esta tabla — solo nombre de fila y valores.

## Outputs esperados
- Tabla `{TABLA_INGRESOS_TD}` con columnas variables según polos activos.
- Registro `data/processed/tabla_ingresos_td_{mes}_{año}.json`.

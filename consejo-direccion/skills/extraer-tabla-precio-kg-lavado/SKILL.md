# Skill: Extraer Tabla de Precio de Venta del kg Lavado

## Identificador
`extraer-tabla-precio-kg-lavado`

## Propósito
Calcula el precio de venta por kilogramo lavado (Ingresos / kg producidos) para el año actual y anterior desde `TABLA CA {AAAA}.xlsx`, determina polos activos y produce `{TABLA_PRECIO_KG_LAVADO}`.

## Cuándo aplicar
- Cuando `agent_tabla_precio_kg_lavado` necesita generar `{TABLA_PRECIO_KG_LAVADO}`.

---

## Proceso paso a paso

### Paso 1: Archivo y hojas

`TABLA CA {AAAA}.xlsx` — mismas hojas individuales que Tablas 9, 2 y 6:
`HABANA`, `VARADERO`, `CAIBARIEN`, `CAYOCOCO`, `CAYOCRUZ`, `HOLGUÍN`, `CONSOLIDADO`

### Paso 2: Localizar columna del mes

Fila 5, columnas C-N = ENERO…DICIEMBRE. Buscar el mes exacto (mayúsculas).

### Paso 3: Leer datos por polo

En la columna del mes:

| Fila | Etiqueta col A | Uso |
|---|---|---|
| 6 | PLAN TURISTAS DÍAS | Filtro polos activos |
| 7 | REAL TURISTAS DÍAS | Filtro polos activos |
| 8 | PLAN PRODUCCIÓN | Denominador del Plan |
| 11 | PLAN INGRESOS | Numerador del Plan |
| 45 | INGRESOS X KG LAVADO | Real año actual |
| 100 | INGRESOS X KG LAVADO (sección año anterior) | Real año anterior |

Si alguna celda es `None` o `#DIV/0!`, tratar como `0.0`.

### Paso 4: Determinar polos activos

Incluir solo los polos donde `Real TD (fila 7) > 0`. Consolidado siempre incluido.

### Paso 5: Calcular métricas

```
Plan          = round(fila_11 / fila_8, 2)        → si fila_8 = 0: "-"
Real_{AAAA}   = round(fila_45, 2)                 → Ingresos x kg lavado actual
Real_{AAAA-1} = round(fila_100, 2)                → Ingresos x kg lavado anterior
% sobre Plan  = round(Real_{AAAA} / Plan × 100, 2)
R-P           = round(Real_{AAAA} - Plan, 2)
R-R{AAAA-1}   = round(Real_{AAAA} - Real_{AAAA-1}, 2)
% CRECIM.     = round(Real_{AAAA} / Real_{AAAA-1} × 100, 2)  → si {AAAA-1}=0: "-"
```

### Paso 6: Construir tabla

**Fila 0** (título): `Precios de Venta del kilogramo lavado - Venta / kg lavado`
**Fila 1** (cabecera): `{MES} | [polos activos] | Consolidado`
**Filas 2-8**:

| Etiqueta |
|---|
| Plan |
| Real {AAAA} |
| Real {AAAA-1} |
| % sobre Plan |
| REAL {AAAA} - PLAN |
| REAL {AAAA} - REAL {AAAA-1} |
| % CRECIM. |

**Formato**: `{n:.2f}` (dos decimales). Negativos con signo. Si no aplica: `-`.

### Paso 7: Entregar

1. Tabla `{TABLA_PRECIO_KG_LAVADO}` formateada.
2. Registro `data/processed/tabla_precio_kg_lavado_{mes}_{año}.json`.

---

## Restricciones
- No incluir polos con `Real TD = 0`.
- `Real_{AAAA}` y `Real_{AAAA-1}` vienen de filas 45 y 100 (ya calculadas por el Excel), no recalcular.
- El Plan sí se calcula: `Plan_ing / Plan_kg`.

# Skill: Replicar Formato Visual Exacto de Tablas DOCX

## Identificador
`replicar-formato-tablas-docx`

## Propósito
Genera un documento Word con tablas que replican **exactamente** el formato visual del documento de referencia (colores de celda, fuentes, tamaños, estilos de párrafo, anchos de columna, bordes). La estrategia es manipular el XML del DOCX original en lugar de construir desde cero — así los 71+ estilos personalizados (`H1Tema`, `H3EncabezadoJustificado`, `Prrafodelista`, etc.) y la configuración de página se preservan automáticamente.

## Cuándo aplicar
- Cuando se necesita generar un documento de verificación o borrador de una sección del informe con el formato idéntico al original.
- Cuando `document-layout-replication` o tareas similares requieren preservar el formato visual exactamente.

---

## Principio fundamental

**Nunca construir el documento desde `Document()` vacío.** Los estilos personalizados no se transfieren automáticamente. Siempre partir de una copia del DOCX de referencia y modificar su body XML.

---

## Proceso paso a paso

### Paso 1: Mapear la estructura del body

```python
from docx import Document
from docx.oxml.ns import qn

doc = Document(REF_PATH)
body = doc.element.body
children = list(body)

for i, child in enumerate(children):
    tag = child.tag.split('}')[-1]
    if tag == 'p':
        text = ''.join(t for t in child.itertext()).strip()[:60]
        style_elem = child.find('.//' + qn('w:pStyle'))
        style = style_elem.get(qn('w:val')) if style_elem is not None else 'Normal'
        print(f"[{i}] p style={style!r} {text!r}")
    elif tag == 'tbl':
        row = child.find('.//' + qn('w:tr'))
        cell = row.find('.//' + qn('w:tc')) if row is not None else None
        text = ''.join(t for t in cell.itertext()).strip()[:50] if cell is not None else ''
        print(f"[{i}] tbl: {text!r}")
    elif tag == 'sectPr':
        print(f"[{i}] sectPr")
```

Identificar el rango `[START_IDX, END_IDX)` que contiene la sección deseada.

### Paso 2: Filtrar el body

```python
START_IDX = ...   # primer elemento de la sección
END_IDX   = ...   # último elemento + 1

sect_pr = None
elements_to_keep = []

for i, child in enumerate(children):
    tag = child.tag.split('}')[-1]
    if tag == 'sectPr':
        sect_pr = child       # siempre conservar — define márgenes/orientación
    elif START_IDX <= i < END_IDX:
        elements_to_keep.append(child)

# Vaciar body y repoblar
for child in list(body):
    body.remove(child)
for elem in elements_to_keep:
    body.append(elem)
if sect_pr is not None:
    body.append(sect_pr)     # sectPr siempre va al final
```

### Paso 3: Modificar valores de celdas (sin tocar formato)

Para sustituir un valor en una celda **sin perder su formato**:

```python
def set_cell_value(cell, new_text):
    """Sustituye el texto de una celda preservando el formato de todos los runs."""
    for para in cell.paragraphs:
        if not para.runs:
            continue
        # Poner el texto en el primer run, vaciar el resto
        para.runs[0].text = new_text
        for run in para.runs[1:]:
            run.text = ''
        new_text = ''   # solo la primera celda-párrafo lleva el texto
```

> **Regla crítica**: nunca usar `cell.text = valor` ni borrar y recrear runs — eso destruye el formato (bold, color, tamaño). Modificar `.text` de los runs existentes.

### Paso 4: Sustituir valores en tablas

```python
# Ejemplo: actualizar fila 2 (Real 2026) de la tabla 0 (Ingresos)
t = doc.tables[0]
row_real26 = t.rows[2]   # fila 0=título, 1=cabecera mes, 2=Plan, 3=Real2026, ...

valores = [polo1, polo2, polo3, consolidado]
for col_idx, valor in enumerate(valores, start=1):  # col 0 = etiqueta
    cell = row_real26.cells[col_idx]
    set_cell_value(cell, format_number(valor))
```

### Paso 5: Formatear números

```python
def format_number(v, decimals=2):
    """Formatea número con separador de miles y decimales."""
    if v is None or v == '-':
        return '-'
    try:
        n = float(v)
        if decimals == 0:
            return f"{n:,.0f}"
        return f"{n:,.{decimals}f}"
    except:
        return str(v)

def format_pct(v, decimals=2):
    return f"{float(v):.{decimals}f}%" if v is not None else '-'
```

### Paso 6: Guardar

```python
doc.save(OUT_PATH)
```

---

## Estructura del DOCX de referencia (Informe MARZO tablas.docx)

### Tablas de Economía (body indices 41-91)

| Body idx | Tipo | Contenido |
|---|---|---|
| 41 | p H1Tema | "CUMPLIMIENTO DEL PLAN DE NEGOCIOS..." |
| 42 | p Normal | (vacío) |
| 43 | p H3EncabezadoJustificado | "Comportamiento de los ingresos" |
| 44 | **tbl[0]** | T1 Ingresos |
| 45-46 | p | Notas T1 |
| 47 | p H3 | "Relación entre ingresos y ocupación" |
| 48 | **tbl[1]** | T2 Ocupación-Ingresos |
| 49-51 | p | Notas/título T3 |
| 52 | **tbl[2]** | T3 Presupuesto GLOBAL (73 filas) |
| 53-64 | p | Análisis partidas |
| 65-66 | p H3 | Subejecuciones / Costos |
| 67 | **tbl[3]** | T4 Costos |
| 68-69 | p | Precisiones T4 |
| 70 | **tbl[4]** | T5 Gastos |
| 71 | p H3 | "Relación gastos y ocupación" |
| 72 | **tbl[5]** | T6 Ocupación-Gastos |
| 73-74 | p | Precisiones T6 |
| 75 | **tbl[6]** | T7 Utilidades |
| 76-77 | p | Análisis T7 |
| 78 | **tbl[7]** | T8 Costo/Gasto por Peso |
| 79-80 | p | Análisis T8 |
| 81 | p H3 | "Ingresos por turista día" |
| 82 | **tbl[8]** | T9 Ingresos x TD |
| 83-84 | p | Especificaciones T9 |
| 85 | p H3 | "Precios de Venta del kg lavado" |
| 86 | **tbl[9]** | T10 Precio kg lavado |
| 87 | p H3 | "Cuentas por Cobrar y Pagar" |
| 88 | **tbl[10]** | T11 Cuentas por Cobrar |
| 89 | p | (link Excel) |
| 90 | **tbl[11]** | T12 Cuentas por Pagar |
| 91 | p P1Texto | (vacío — cierre sección) |

### Colores de encabezado (fila 0) de cada tabla

| Tabla | BG fill | Descripción |
|---|---|---|
| T1, T3, T4, T5, T6, T7, T8, T9, T11, T12 | `C9D0EF` | Azul lavanda |
| T2 (Ocupación-Ingresos) | `E2EDFD` | Azul más claro |
| T3 Presupuesto GLOBAL | `A6A6A6` | Gris |
| T10 Precio kg lavado | `95B3D7` | Azul medio |

### Colores de fila de mes/cabecera (fila 1)

| Tabla | BG fill | Descripción |
|---|---|---|
| T1, T4, T5, T6, T7 | `F4BC46` | Amarillo/naranja |
| T8 | `F4BC46` | Amarillo |

---

## Restricciones

- **Nunca** crear `Document()` vacío y luego agregar tablas — los estilos personalizados no se transfieren.
- **Nunca** modificar el XML de estilos, `sectPr`, o `settings.xml` del DOCX — solo el body.
- Para actualizar valores: modificar `.text` de runs existentes, no recrear celdas.
- El `sectPr` (configuración de página) debe ir siempre como último hijo del body.
- Verificar siempre que `len(doc.tables) == N_esperado` después de filtrar.

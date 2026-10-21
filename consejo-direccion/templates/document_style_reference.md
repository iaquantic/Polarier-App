# Guía de referencia visual — Informes de Consejo de Dirección de Polarier

> Valores extraídos programáticamente de los documentos históricos aprobados:
> `Informe DICIEMBRE Rev. Dir.Org.docx` y `Informe ENERO Rev. Dir. Org. v2.docx`
> Fecha de extracción: 2026-05-13 | Autor de los originales: Nara Fornaris

---

## 1. Configuración de página

| Parámetro | Valor |
|---|---|
| Tamaño | A4 — 21.59 cm × 27.94 cm (612 × 792 pt) |
| Orientación | Vertical (portrait) |
| Margen superior | 3.00 cm |
| Margen inferior | 2.50 cm |
| Margen izquierdo | 2.20 cm |
| Margen derecho | 1.50 cm |

---

## 2. Tipografía

### Fuente principal
**Agfa Rotis Sans Serif** — fuente propietaria, representa el 56.8–68.2% de todos los textos.

> Si Agfa Rotis Sans Serif no está instalada, usar **Arial** como fallback.

### Escala tipográfica

| Uso | Tamaño | Estilo | Notas |
|---|---|---|---|
| Encabezado H1 | 20 pt | Negrita | Solo título de sección principal |
| Encabezado H2 | 16 pt | Negrita | Subsección |
| Encabezado H3 | 14 pt | Negrita | Sub-subsección |
| Encabezado H4–H5 | (heredado) | Negrita | Tamaño definido por tema |
| Encabezado H6–H7 | (heredado) | Normal | |
| Cuerpo de texto (P1_Texto) | 12 pt | Normal | Párrafos narrativos |
| Datos en tablas (dominante) | 9 pt | Normal/Negrita | 32.9–43.5% del total de texto |
| Datos en tablas (compacto) | 8 pt | Normal | 12.5–19.0% del total de texto |
| Datos muy comprimidos | 7 pt | Normal | Tablas de alta densidad |
| Datos mínimos | 6 pt | Normal | Máxima compresión |
| Texto de apoyo / pie | 10 pt | Normal | |
| Encabezado/pie de página | 9 pt | Normal | |

### Uso de estilos
- **Negrita**: usada en encabezados y filas de cabecera de tabla. Nunca cursiva ni subrayado.
- Itálica: **no se usa** en los documentos históricos.
- Subrayado: **no se usa**.

---

## 3. Paleta de colores corporativos

### Colores de texto

| Color | Hex | Uso |
|---|---|---|
| **Negro** | `#000000` | Texto principal — 51.6–59.9% de todo el texto |
| **Naranja dorado** | `#DD990D` | Todos los encabezados H1–H5 |
| **Gris oscuro** | `#595959` | Encabezados H6–H7 |
| **Gris muy oscuro** | `#272727` | Encabezados H8–H9 |
| **Rojo oscuro** | `#9C0006` | Valores negativos, incumplimientos |
| **Rojo mediano** | `#C00000` | Variante de alerta |
| **Verde oscuro** | `#006100` | Valores positivos, cumplimientos |
| **Rojo puro** | `#FF0000` | Énfasis crítico |

### Uso semántico del color en tablas

```
Verde #006100  →  El valor supera el plan o está en cumplimiento
Rojo  #9C0006  →  El valor incumple el plan o está en déficit
Negro #000000  →  Dato neutro sin connotación de cumplimiento
Rojo  #FF0000  →  Alerta crítica que requiere atención inmediata
```

### Colores de celdas de tabla

| Color | Hex | Uso en tabla |
|---|---|---|
| **Amarillo/Naranja** | `#F4BC46` | Fila de encabezado principal — 16–17 celdas por informe |
| **Azul claro** | `#C9D0EF` | Fila de subencabezado — 3 celdas |
| **Azul muy claro** | `#E2EDFD` | Filas alternas (opcional) |
| **Gris mediano** | `#A6A6A6` | Filas de totales y subtotales — 2–3 celdas |
| **Gris oscuro** | `#A5A5A5` | Variante de separador |
| **Blanco** | `#FFFFFF` | Celdas de datos estándar |

---

## 4. Estructura de tablas

Los informes históricos contienen entre **40 y 41 tablas** por documento.

### Anatomía de una tabla tipo

```
┌─────────────────────────────────────────┐ ← Fila encabezado: fondo #F4BC46, negrita, 9pt, centrado
│ TÍTULO COLUMNA 1 │ COL 2 │ COL 3 │ ...  │
├─────────────────────────────────────────┤ ← Subencabezado (si existe): fondo #C9D0EF
│ Subtítulo A      │  ...  │  ...  │ ...  │
├─────────────────────────────────────────┤
│ Dato 1           │ 1.234 │  98%  │ ...  │ ← Fila datos: fondo #FFFFFF, 9pt, centrado
│ Dato 2           │   567 │  85%  │ ...  │
│ Dato 3           │   890 │ 102%  │ ...  │
├─────────────────────────────────────────┤ ← Fila total/subtotal: fondo #A6A6A6, negrita
│ TOTAL            │ 2.691 │  95%  │ ...  │
└─────────────────────────────────────────┘
```

### Propiedades de tabla

| Propiedad | Valor |
|---|---|
| Fuente | Agfa Rotis Sans Serif |
| Tamaño de fuente | 9 pt (datos), 8 pt (compacto) |
| Alineación de datos | Centrado |
| Bordes | Línea simple, negro `#000000`, 0.5 pt |
| Relleno de celda | 2 pt |
| Encabezado principal | Fondo `#F4BC46`, negrita, centrado |
| Subtotal / total | Fondo `#A6A6A6`, negrita, centrado |

---

## 5. Encabezado y pie de página

### Encabezado
```
[LOGO POLARIER]    Informe consolidado [MES] [AÑO]
                   La Habana | Varadero | Caibarien | Cayo Coco | Cayo Cruz | Holguín
```
- Fuente: Agfa Rotis Sans Serif, 9 pt
- Alineación: Centrado
- Logo: PNG ~29.6 KB, posición izquierda

### Pie de página
```
                   Página | [número]
```
- Fuente: Agfa Rotis Sans Serif, 9 pt
- Alineación: Centrado
- Numeración automática de páginas

---

## 6. Alineación de párrafos

| Tipo | Alineación | Frecuencia |
|---|---|---|
| Contenido de tablas | Centro | Mayoritario |
| Encabezados del documento | Izquierda | |
| Párrafos narrativos | Justificado | 54–101 por informe |
| Texto de tabla (párrafos) | Centro | 1.803–1.837 por informe |
| Notas y aclaraciones | Derecha | 78–231 por informe |

---

## 7. Espaciado entre elementos

| Elemento | Espacio antes | Espacio después |
|---|---|---|
| H1 (20 pt) | 18 pt | 4 pt |
| H2 (16 pt) | 8 pt | 4 pt |
| H3 (14 pt) | 8 pt | 4 pt |
| H4–H5 | 4 pt | 2 pt |
| H6–H7 | 2 pt | 0 pt |
| H8–H9 | 0 pt | 0 pt |
| Párrafo body (P1_Texto) | 12 pt | 12 pt |
| Párrafo normal | 5 pt | 5 pt |
| Celdas de tabla | 2 pt (padding) | 2 pt (padding) |

---

## 8. Elementos que requieren ajuste manual

Los siguientes elementos no pueden replicarse automáticamente y deben ajustarse a mano:

| Elemento | Motivo | Acción requerida |
|---|---|---|
| Logo corporativo Polarier | Imagen PNG propietaria (29.6 KB) | Insertar manualmente en el encabezado del template |
| Fuente Agfa Rotis Sans Serif | Fuente propietaria de pago | Instalar en el sistema o usar Arial como fallback |
| Tamaño de H4–H9 | No definido explícitamente en el tema | Ajustar manualmente: 12/11/10/10/10/10 pt según nivel |
| Portada o página de orden del día | No detectada en documentos analizados | Verificar en versiones históricas anteriores |

---

## 9. Checklist visual antes de entregar el informe

Antes de entregar cualquier informe generado, verificar:

- [ ] Fuente Agfa Rotis Sans Serif aplicada (o Arial si no disponible)
- [ ] Márgenes: 3.00 / 2.50 / 2.20 / 1.50 cm
- [ ] Encabezados H1–H3 en color `#DD990D`
- [ ] Todas las tablas con encabezado `#F4BC46`
- [ ] Totales/subtotales de tabla con fondo `#A6A6A6`
- [ ] Valores negativos en texto de tabla con color `#9C0006`
- [ ] Valores positivos en texto de tabla con color `#006100`
- [ ] Encabezado de página con logo + nombre del informe + ubicaciones
- [ ] Pie de página con numeración `Página | N`
- [ ] Tamaño de texto en tablas: 9 pt (estándar) u 8 pt (compacto)
- [ ] Bordes de tabla: línea simple negro `#000000` 0.5 pt en todas las celdas

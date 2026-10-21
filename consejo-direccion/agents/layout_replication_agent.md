# Agente: Layout Replication

## Identificador
`layout_replication_agent`

## Estado
`active`

## Descripción
Agente especializado en replicar con máxima fidelidad el diseño visual de los informes históricos aprobados de Polarier. Transforma el contenido textual generado por los agentes especializados en un documento DOCX que es visualmente idéntico a los informes del Consejo de Dirección.

Este agente actúa **después** de que todos los agentes de contenido han completado sus secciones y el `evidence_auditor_agent` ha aprobado el informe. Su responsabilidad es exclusivamente visual: no modifica ni genera contenido narrativo.

---

## Posición en el pipeline

```
[Agentes de contenido] → [evidence_auditor_agent: APROBADO] → [layout_replication_agent] → DOCX final
```

---

## Responsabilidades

### Fase 1: Extracción de diseño (solo cuando hay nuevos documentos históricos)
1. Analizar los DOCX históricos en `data/historical/drafts_docx/` para extraer:
   - Fuentes, tamaños, colores y espaciados de todos los estilos de párrafo y heading.
   - Configuración de página: tamaño, márgenes.
   - Estructura y colores de tablas.
   - Contenido y formato de encabezado y pie de página.
2. Analizar los PDF históricos en `data/historical/final_pdfs/` para verificar:
   - Colores de texto (RGB).
   - Colores de fondo de bloques.
   - Distribución visual de elementos por página.
3. Actualizar `config/layout_rules.yaml` con los valores extraídos.
4. Actualizar `templates/document_style_reference.md`.

Ejecutar con:
```
python src/main.py extract-layout
```

### Fase 2: Construcción del template base
1. Leer `config/layout_rules.yaml`.
2. Crear `templates/consejo_direccion_template.docx` con:
   - Estilos de párrafo predefinidos (P1_Texto, Datos 9pt, Datos 8pt, Normal).
   - Estilos de encabezado H1–H9 con colores y espaciados exactos.
   - Configuración de página (A4, márgenes).
   - Encabezado de página con texto de plantilla y espacio reservado para logo.
   - Pie de página con numeración automática.

Ejecutar con:
```
python src/main.py build-template
```

### Fase 3: Generación del DOCX mensual
1. Cargar `templates/consejo_direccion_template.docx` como base.
2. Cargar el informe aprobado desde `data/output/informe_YYYYMM.md`.
3. Para cada sección del informe:
   - Insertar título con el estilo de heading correspondiente.
   - Insertar párrafos narrativos con el estilo `P1_Texto`.
   - Insertar tablas aplicando los colores de fila definidos en `config/layout_rules.yaml`.
   - Aplicar colores semánticos en celdas de datos (verde/rojo/negro según valor vs. plan).
4. Actualizar el encabezado con el mes y año del informe.
5. Verificar la numeración de páginas.
6. Guardar en `data/output/informe_YYYYMM.docx`.

### Fase 4: Auditoría visual
1. Ejecutar el checklist de `templates/document_style_reference.md` sección 9.
2. Verificar automáticamente:
   - Fuente aplicada en al menos el 80% de los runs de texto.
   - Color `#DD990D` en todos los headings H1–H5.
   - Color `#F4BC46` en todas las filas de encabezado de tabla.
   - Márgenes dentro de ±0.05 cm del valor especificado.
3. Registrar en `data/processed/visual_audit_YYYYMM.json`:
   - Elementos verificados correctamente.
   - Elementos que requieren ajuste manual.
4. Mostrar resumen de la auditoría visual en consola.

---

## Reglas absolutas del agente

- **No modificar contenido textual** generado por los agentes de análisis. Solo aplicar estilos.
- **No generar el DOCX** si el `evidence_auditor_agent` no ha aprobado el informe previamente.
- **Siempre leer `config/layout_rules.yaml`** antes de aplicar cualquier estilo. Nunca usar valores de memoria.
- **Si la fuente Agfa Rotis Sans Serif no está instalada**, usar Arial como fallback Y registrar el fallback en `visual_audit_YYYYMM.json`.
- **Nunca alterar** los colores corporativos `#DD990D` (encabezados) ni `#F4BC46` (tabla).
- **Marcar con `[requiere ajuste manual: descripción]`** cualquier elemento que no pueda replicarse automáticamente.

---

## Valores de diseño aplicados (referencia rápida)

| Elemento | Valor exacto |
|---|---|
| Página | A4, 21.59 × 27.94 cm |
| Márgenes | 3.00 / 2.50 / 2.20 / 1.50 cm (sup/inf/izq/der) |
| Fuente principal | Agfa Rotis Sans Serif (fallback: Arial) |
| H1 | 20 pt, `#DD990D`, negrita, 18 pt antes |
| H2 | 16 pt, `#DD990D`, negrita, 8 pt antes |
| H3 | 14 pt, `#DD990D`, negrita, 8 pt antes |
| Cuerpo (P1_Texto) | 12 pt, negro, 12 pt antes/después |
| Tabla datos | 9 pt, centrado |
| Tabla compacto | 8 pt, centrado |
| Encabezado tabla | Fondo `#F4BC46`, negrita |
| Subencabezado tabla | Fondo `#C9D0EF` |
| Totales/subtotales tabla | Fondo `#A6A6A6`, negrita |
| Valor positivo (texto tabla) | `#006100` |
| Valor negativo (texto tabla) | `#9C0006` |
| Alerta crítica (texto tabla) | `#FF0000` |

---

## Inputs
- `data/output/informe_YYYYMM.md` — informe aprobado por el auditor
- `config/layout_rules.yaml` — reglas de diseño
- `templates/consejo_direccion_template.docx` — template base con estilos
- `data/historical/drafts_docx/` — fuente para re-extracción de estilos
- `data/historical/final_pdfs/` — fuente para verificación visual

## Outputs
- `data/output/informe_YYYYMM.docx` — informe final con estilos aplicados
- `data/processed/visual_audit_YYYYMM.json` — auditoría visual del DOCX generado
- `config/layout_rules.yaml` — actualizado tras re-extracción (si aplica)
- `templates/consejo_direccion_template.docx` — actualizado tras re-extracción (si aplica)

---

## Skill asociada
`skills/document-layout-replication/SKILL.md`

## Módulos Python
- `src/layout_extractor.py` — extrae elementos visuales de DOCX/PDF históricos
- `src/docx_builder.py` — construye el DOCX final con estilos aplicados

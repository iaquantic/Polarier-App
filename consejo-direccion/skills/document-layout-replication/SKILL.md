# Skill: Document Layout Replication

## Identificador
`document-layout-replication`

## Propósito

Garantizar que el documento DOCX mensual del Consejo de Dirección preserve exactamente el diseño de la plantilla maestra aprobada, reemplazando solo el contenido sin alterar ningún elemento visual.

---

## Estrategia de diseño documental

**El sistema NO genera estilos dinámicamente.**

Todo el diseño visual (fuentes, colores, márgenes, tablas, encabezados, pies de página) proviene de la plantilla maestra DOCX:

```
templates/master/consejo_direccion_master.docx
```

El proceso mensual es: **clonar → reemplazar contenido → validar integridad**.

---

## Cuándo aplicar

- Al generar el DOCX final de cualquier informe mensual.
- Cuando se verifica que el output visual no coincide con la plantilla maestra.

---

## Proceso paso a paso

### Paso 1: Verificar que existe la plantilla maestra

```python
from template_cloner import verify_master
if not verify_master():
    raise FileNotFoundError("Plantilla maestra no encontrada: templates/master/consejo_direccion_master.docx")
```

### Paso 2: Clonar la plantilla al destino mensual

```python
from template_cloner import clone_master
output_path = clone_master(mes="ENERO", año="2026")
# → data/output/consejo_direccion_ENERO_2026.docx
```

### Paso 3: Reemplazar metadatos de período

```python
from docx_content_replacer import replace_metadata
replace_metadata(output_path, mes="ENERO", año="2026")
```

### Paso 4: Insertar textos de análisis

```python
from docx_content_replacer import replace_content
replace_content(output_path, {
    "{ANALISIS_ECONOMIA}": texto_economia,
    "{ANALISIS_PRODUCCION}": texto_produccion,
    # ... resto de secciones
})
```

### Paso 5: Reemplazar tablas de datos

```python
from docx_table_replacer import replace_tables_in_document
result = replace_tables_in_document(output_path, table_data_map)
# result = {"replaced": N, "unmatched": M, "total": T}
```

Si `unmatched > 0`: las tablas no mapeadas quedan marcadas con `[requiere revisión]`.

### Paso 6: Validar integridad del diseño

Verificar que el documento de salida:
- Tiene el mismo número de secciones que la plantilla maestra.
- No tiene estilos nuevos que no existían en el master.
- El encabezado de página contiene el período correcto.

Registrar cualquier anomalía en `data/processed/design_validation_log.txt`.

---

## Fuente de verdad

```
templates/master/consejo_direccion_master.docx   ← diseño aprobado (fuente única)
config/layout_rules.yaml                         ← parámetros de control del flujo
```

---

## Prohibiciones

- **No usar `layout_extractor.py`** en el flujo activo.
- **No usar `docx_builder.py`** para generación mensual (construcción dinámica de estilos).
- **No modificar bordes, colores, anchos ni fuentes** de ninguna celda o párrafo.
- **No intentar recrear el diseño** si la plantilla maestra no existe.

---

## Módulos Python activos

| Módulo | Rol |
|---|---|
| `src/template_cloner.py` | Clonar master al destino mensual |
| `src/docx_content_replacer.py` | Reemplazar texto preservando formato |
| `src/docx_table_replacer.py` | Reemplazar datos de tablas preservando diseño |

---

## Dependencias Python

```
pip install python-docx pyyaml
```

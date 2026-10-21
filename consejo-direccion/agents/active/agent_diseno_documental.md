# Agente: Diseño Documental

## Identificador
`agent_diseno_documental`

## Estado
`active`

## Posición en el pipeline
`post_audit` — se ejecuta después de que `evidence_auditor_agent` aprueba el informe.

```
[Agentes de contenido] → [evidence_auditor_agent: APROBADO] → [agent_diseno_documental] → DOCX final
```

## Descripción

Agente responsable de producir el documento DOCX mensual clonando la plantilla maestra aprobada e insertando el contenido generado por los agentes de análisis.

**Este agente NO genera estilos, NO construye tablas desde cero y NO aplica formato dinámico.**
Su única responsabilidad es: clonar la plantilla maestra, reemplazar marcadores con contenido real, y verificar que el diseño original no haya sido alterado.

---

## Flujo de trabajo

### Paso 1 — Verificar plantilla maestra

```
src/template_cloner.py → verify_master()
```

- Confirmar que `templates/master/consejo_direccion_master.docx` existe.
- Si no existe: **detener el proceso** y registrar:
  `"Plantilla maestra no encontrada. El proceso no puede continuar sin templates/master/consejo_direccion_master.docx"`
- **No intentar regenerar el diseño ni usar plantillas alternativas.**

### Paso 2 — Clonar plantilla al destino mensual

```
src/template_cloner.py → clone_master(mes, año)
```

- Copiar `templates/master/consejo_direccion_master.docx` → `data/output/consejo_direccion_{MES}_{AÑO}.docx`
- Sin ninguna modificación de estilos, estructura, fuentes ni colores.

### Paso 3 — Reemplazar metadatos de período

```
src/docx_content_replacer.py → replace_metadata(docx_path, mes, año)
```

- Reemplazar `{MES}` y `{AÑO}` en encabezado, pie de página y cuerpo.
- Preservar el formato de cada run. Estos son marcadores simples dentro de texto.

### Paso 4 — Insertar bloques de sección

```
src/docx_content_replacer.py → replace_section_blocks(docx_path, blocks)
```

Cada `{SECCION_*}` es un marcador que ocupa un párrafo completo. El sistema lo
reemplaza por un bloque que puede contener textos narrativos Y tablas de datos,
en el orden indicado por el agente de esa sección.

**Estrategia de resolución (en orden de prioridad):**

1. Si existe `{SECCION_ECONOMIA}` en la plantilla → insertar todo el contenido de esa sección (análisis + todas sus tablas) en ese punto.
2. Si no existe el marcador de sección → registrar en el log de validación y continuar.
3. Si existen marcadores específicos adicionales (e.g. `{ANALISIS_ECONOMIA}`, `{TABLA_PLAN_NEGOCIOS}`), se usan como complemento con `replace_simple()`.

**El contenido de cada bloque de sección se estructura así:**

```yaml
# data/processed/sections_enero_2026.yaml
economia:
  texts:
    - "Párrafo de análisis narrativo..."
    - "Segundo párrafo..."
  tables:
    - [["Concepto", "Plan", "Real"], ["Lavado", "1000", "980"]]
    - [["Polo", "Ingresos"], ["La Habana", "500"]]
```

El sistema inserta primero los textos, luego las tablas, salvo que se indique un
`order` explícito en el YAML.

### Paso 5 (opcional) — Rellenar tablas existentes en la plantilla

```
src/docx_table_replacer.py → fill_tables_in_document(docx_path, table_data_map)
```

Se usa **solo** cuando la plantilla maestra ya tiene tablas con diseño correcto
ubicadas fuera de marcadores `{SECCION_*}`, y se quieren actualizar sus datos.
No sustituye al Paso 4 — es complementario.

### Paso 6 — Validar integridad del diseño

Verificar que el documento de salida:

- Tiene el mismo número de secciones que la plantilla maestra.
- No tiene estilos nuevos que no existían en el master.
- Todos los encabezados mantienen el color `#DD990D`.
- El encabezado de página contiene el logo y el período correcto.

Si se detecta alguna anomalía: registrar en `data/processed/design_validation_log.txt` y marcar la sección afectada con `[diseño alterado - revisar]`.

---

## Marcadores de la plantilla maestra

### Marcadores simples (dentro de un run de texto)

| Marcador | Dónde va | Descripción |
|---|---|---|
| `{MES}` | Encabezado de página, título | Nombre del mes en mayúsculas, e.g. `ENERO` |
| `{AÑO}` | Encabezado de página, título | Año de cuatro dígitos, e.g. `2026` |

### Marcadores de sección (un párrafo completo)

Cada marcador de sección **ocupa un párrafo propio** en la plantilla. Al reemplazarlo, ese párrafo es sustituido por el bloque completo de la sección: textos narrativos + todas las tablas correspondientes.

| Marcador | Sección del informe |
|---|---|
| `{SECCION_ECONOMIA}` | Economía (13 tablas esperadas) |
| `{SECCION_PRODUCCION}` | Producción |
| `{SECCION_LENCERIA}` | Lencería |
| `{SECCION_SERVICIOS_TECNICOS}` | Servicios Técnicos |
| `{SECCION_TRANSPORTE}` | Transporte |
| `{SECCION_CALIDAD}` | Calidad |
| `{SECCION_RRHH}` | Recursos Humanos |
| `{SECCION_VALORACION}` | Valoración de la administración |
| `{SECCION_RIESGOS}` | Riesgos |
| `{SECCION_CONCLUSIONES}` | Conclusiones |

Los marcadores que no existan en la plantilla se registran en el log de validación pero no interrumpen el proceso.

---

## Prohibiciones absolutas

- **No generar estilos ni aplicar formato dinámico.**
- **No usar `layout_extractor.py` en el flujo activo.**
- **No intentar recrear el diseño si la plantilla maestra no existe.** Detener y notificar.
- **No modificar bordes, colores, anchos ni fuentes de ninguna celda o párrafo.**
- **No eliminar tablas o secciones de la plantilla**, aunque no haya datos para ellas.

---

## Módulos activos

| Módulo | Rol |
|---|---|
| `src/template_cloner.py` | Clonar el master al destino mensual |
| `src/docx_content_replacer.py` | Reemplazar texto preservando formato |
| `src/docx_table_replacer.py` | Reemplazar datos de tablas preservando diseño |

## Módulos desactivados (no usar en flujo activo)

- `src/layout_extractor.py` — extracción de estilos desde históricos (obsoleto)
- `src/docx_builder.py` — construcción de DOCX desde cero (obsoleto para generación mensual)

## Skill asociada

`skills/document-layout-replication/SKILL.md`

## Comandos Python

```bash
python src/main.py clone-template --mes ENERO --año 2026   # Clona master al destino mensual
python src/main.py build-docx --mes ENERO --año 2026       # Genera DOCX final completo
```

## Inputs

- `templates/master/consejo_direccion_master.docx` — plantilla maestra aprobada (obligatoria)
- Textos de análisis generados por agentes de contenido (diccionario de marcadores)
- Tablas de datos clasificadas y procesadas por el pipeline de ingesta

## Outputs

- `data/output/consejo_direccion_{MES}_{AÑO}.docx` — documento final
- `data/processed/design_validation_log.txt` — log de validación de diseño

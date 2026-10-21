# Polarier — Sistema Multiagente de Consejo de Dirección

Sistema que genera automáticamente los informes mensuales del Consejo de Dirección de Polarier a partir de tablas de datos mensuales, aprendiendo su estructura y reglas desde documentos históricos reales.

---

## Prerequisitos

```
pip install python-docx pymupdf pyyaml
```

---

## Cómo colocar los documentos históricos

### DOCX revisados (borradores con comentarios)
Copiar en:
```
data/historical/drafts_docx/
```
Nombrar con el formato: `informe_YYYYMM_draft.docx`  
Ejemplo: `informe_202412_draft.docx`

### PDF finales (versiones aprobadas)
Copiar en:
```
data/historical/final_pdfs/
```
Nombrar con el formato: `informe_YYYYMM_final.pdf`  
Ejemplo: `informe_202412_final.pdf`

> Los documentos históricos ya disponibles en la raíz del proyecto deben moverse a estas carpetas antes de ejecutar el descubrimiento.

---

## Flujo de trabajo completo

### Paso 1 — Descubrimiento documental

Analiza todos los documentos históricos e infiere secciones, aspectos y agentes necesarios.

```bash
python src/main.py discover
```

Produce:
- `config/report_sections.yaml` — secciones inferidas
- `config/analysis_patterns.yaml` — patrones de análisis
- `config/discovered_agents.yaml` — agentes sugeridos (pendientes de revisión)

### Paso 2 — Extracción de reglas de revisión

Lee los comentarios de los DOCX revisados y genera reglas correctivas.

```bash
python src/main.py extract-rules
```

Produce:
- `config/review_rules.yaml` — reglas extraídas y clasificadas

### Paso 3 — Generación de skills iniciales

Crea skills reutilizables desde los patrones y reglas descubiertos.

```bash
python src/main.py build-skills
```

Produce:
- Archivos `SKILL.md` actualizados en `skills/`

### Paso 4 — Revisión humana de agentes inferidos

Antes de continuar, revisar `config/discovered_agents.yaml`:

```yaml
# Ejemplo de agente inferido — revisar y ajustar si es necesario
- id: agent_lavanderia_productividad
  name: "Agente de Productividad por Lavandería"
  sections: ["Análisis por Lavandería", "Productividad"]
  status: pending_review   # cambiar a: approved
```

Cambiar `status: pending_review` a `status: approved` para activar el agente.  
Copiar el archivo generado en `agents/` a `agents/active/` para usarlo en la generación.

### Paso 5 — Colocar la plantilla maestra DOCX

**Requisito obligatorio antes de generar el primer informe.**

El sistema usa una plantilla maestra DOCX aprobada para producir los documentos mensuales. Esta plantilla debe colocarse en:

```
templates/master/consejo_direccion_master.docx
```

La plantilla maestra debe ser el último informe aprobado del Consejo de Dirección, guardado como `.docx`, con los siguientes marcadores insertados donde corresponda:

| Marcador | Dónde va |
|---|---|
**Marcadores simples** — van dentro de un run de texto normal:

| Marcador | Dónde va |
|---|---|
| `{MES}` | Encabezado de página y título del informe |
| `{AÑO}` | Encabezado de página y título del informe |

**Marcadores de sección** — cada uno ocupa un párrafo propio (solo ese texto en el párrafo):

| Marcador | Sección del informe |
|---|---|
| `{SECCION_ECONOMIA}` | Economía — reemplazado por análisis + todas las tablas económicas |
| `{SECCION_PRODUCCION}` | Producción |
| `{SECCION_LENCERIA}` | Lencería |
| `{SECCION_SERVICIOS_TECNICOS}` | Servicios Técnicos |
| `{SECCION_TRANSPORTE}` | Transporte |
| `{SECCION_CALIDAD}` | Calidad |
| `{SECCION_RRHH}` | Recursos Humanos |
| `{SECCION_VALORACION}` | Valoración de la administración |
| `{SECCION_RIESGOS}` | Riesgos |
| `{SECCION_CONCLUSIONES}` | Conclusiones |

Cuando el sistema encuentra `{SECCION_ECONOMIA}`, reemplaza ese párrafo por el bloque completo de esa sección: textos narrativos y todas las tablas correspondientes, en orden. No se requieren marcadores individuales por tabla ni por párrafo de análisis.

> **El sistema NO regenera el diseño.** Todo el formato (fuentes, colores, tablas, encabezados, márgenes) se preserva de la plantilla maestra. Solo se reemplaza el contenido.

Si la plantilla maestra no existe, el proceso de generación se detiene con error.

### Paso 6 — Generación mensual

Colocar el DOCX mensual único en `data/input/mes_actual/` y ejecutar:

```bash
python src/main.py generate --month 2026-05
```

Produce el informe en `data/output/consejo_direccion_MAYO_2026.docx`

> **Nuevo flujo de entrada**: el sistema espera un único DOCX mensual (`Informe MES tablas.docx`) que contiene todas las tablas del período junto con sus títulos, subtítulos, precisiones, especificaciones y notas operativas. Ver sección "Flujo mensual" más abajo.

### Paso 7 — Auditoría del informe

Verifica coherencia, evidencia y cumplimiento de reglas:

```bash
python src/main.py audit --month 2026-05
```

---

## Cómo revisar y modificar agentes inferidos

Los agentes se generan en `agents/` con el formato definido en `agents/_agent_template.md`.

Para modificar un agente:
1. Abrir el archivo `.md` correspondiente en `agents/`.
2. Ajustar las secciones asignadas, las métricas esperadas o las reglas aplicables.
3. Mover o copiar el archivo a `agents/active/` cuando esté listo para producción.

Para añadir un agente manualmente:
1. Copiar `agents/_agent_template.md` con un nuevo nombre.
2. Rellenar todos los campos requeridos.
3. Registrar el nuevo agente en `config/discovered_agents.yaml`.

---

## Estructura del proyecto

```
polarier-consejo-direccion/
├── CLAUDE.md                    # Reglas del sistema para Claude Code
├── README.md                    # Este archivo
├── config/                      # Configuraciones YAML (inferidas automáticamente)
├── data/
│   ├── historical/              # Documentos históricos fuente
│   ├── input/mes_actual/        # Tabla mensual de entrada
│   ├── extracted/               # Datos extraídos de documentos
│   ├── processed/               # Datos procesados listos para generación
│   └── output/                  # Informes generados
├── agents/                      # Definiciones de agentes especializados
│   └── active/                  # Agentes aprobados y activos
├── skills/                      # Skills reutilizables del sistema
├── prompts/                     # Prompts operativos numerados
├── templates/
│   └── master/                  # Plantilla maestra DOCX aprobada (obligatoria)
├── src/                         # Código fuente Python
└── tests/                       # Tests del sistema
```

---

## Flujo mensual

Una vez completado el setup inicial (pasos 1–4 del flujo completo), cada mes el proceso es:

### Lo que hace el usuario

**1. Colocar el DOCX mensual en:**
```
data/input/mes_actual/
```
El archivo se llama: `Informe MES tablas.docx` (ejemplo: `Informe MAYO tablas.docx`)

Este único archivo contiene **todas las tablas del período** junto con:
- Títulos y subtítulos de sección
- Precisiones y especificaciones
- Notas operativas y comentarios
- Aclaraciones sobre desviaciones o valores excepcionales

**2. Ejecutar:**
```bash
python src/main.py generate --month 2026-05
```

Eso es todo. El sistema se encarga del resto automáticamente.

### Lo que NO debe hacer el usuario

- ❌ Ordenar las tablas antes de colocarlas — el sistema las ordena solo.
- ❌ Indicar a qué sección pertenece cada tabla — el sistema las clasifica solo.
- ❌ Explicar las precisiones manualmente — el sistema las extrae del DOCX y las asocia a la tabla correspondiente.
- ❌ Separar tablas en archivos distintos — todo va en el único DOCX mensual.

### Lo que hace el sistema automáticamente

| Paso | Qué ocurre |
|---|---|
| 1. Ingesta | Detecta el DOCX mensual en `data/input/mes_actual/` |
| 2. Extracción | Extrae tablas **y context_notes** (precisiones, notas, especificaciones) en orden documental |
| 3. Clasificación | Identifica el tipo de cada tabla usando el título del DOCX como señal principal |
| 4. Mapeo | Asocia cada tabla a su sección del informe y al agente responsable |
| 5. Agrupación | Agrupa las tablas por sección, propagando las context_notes |
| 6. Análisis | Activa el agente de cada sección; el agente recibe tablas + context_notes |
| 7. Análisis causal | Los agentes usan las context_notes para explicar desviaciones sin inventar causas |
| 8. Auditoría | Valida que cada dato del texto esté respaldado por las tablas o las context_notes |
| 9. Generación | Clona la plantilla maestra, inserta análisis y tablas, produce el DOCX final |

> **El usuario no indica el orden, las secciones ni los agentes.**  
> Todo se infiere automáticamente desde los documentos históricos aprobados.

### Estructura del context_notes

Cuando el sistema extrae una tabla del DOCX, también extrae el texto contextual asociado:

```
tabla_001 — Cumplimiento del Plan de Ingresos
  [PRECISION] Los ingresos de Cayo Coco incluyen una liquidación extraordinaria de enero.
  [ESPECIFICACION] El plan fue ajustado en febrero según resolución 12/2026.

tabla_002 — Partidas Sobregiradas
  [NOTA] El sobregiro en combustible se debe al cierre temporal de caldera en Varadero.
```

Cada context_note tiene:
- `note_type`: precision | especificacion | nota | comentario | observacion | parrafo
- `is_causal`: True si menciona causas de desviación (sobregiro, cierre, avería, temporada…)
- `position_before`: True si el texto precede a la tabla en el documento

Los agentes usan esta información para producir análisis causales precisos en lugar de inferir.

### Resultado

```
data/output/consejo_direccion_MAYO_2026.docx  ← documento final con diseño Polarier preservado
```

---

## Principios de calidad

- **Sin datos inventados**: toda cifra debe venir de la tabla de entrada.
- **Tono ejecutivo**: formal, directo, sin valoraciones subjetivas.
- **Reglas de revisión**: los comentarios históricos son ley; no se repiten errores pasados.
- **Bloqueo por inconsistencia**: si tabla y texto no coinciden, el informe no se entrega.

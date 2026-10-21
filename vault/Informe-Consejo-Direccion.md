# Informe del Consejo de Dirección

Sistema que redacta el **informe mensual (o trimestral) del Consejo de Dirección de Polarier**: el documento largo, formal, que la dirección ejecutiva analiza. Vive en el repo desde el 2026-10-21 en [`consejo-direccion/`](../consejo-direccion/), traído de `C:\Trabajo\Consejo Direccion Claude\polarier-consejo-direccion`.

> No confundir con [[Routine-Informe-Mensual]], que es el informe mensual **del módulo de auditoría** (almacén hotelero, un hotel, datos de `audit_daily`). Son dos informes distintos: este es de toda la empresa y sale de un DOCX de tablas que entrega Economía.

**Todavía no está integrado en la app.** Hoy es un proyecto Python que se ejecuta a mano con Claude Code, o por un flujo de n8n con Telegram descrito en `INSTALACION.md` (no montado en el n8n actual).

> **Cambio de enfoque (2026-10-21, decisión de Leo):** el informe **dejará de depender del DOCX de tablas subido**. Los datos están en el **GLOBAL** y la **TABLA CA**, y se sacarán directamente de ahí. En la app, el apartado será solo **«Generar informe»**, el **historial** y, para el mes elegido, la **comprobación de si están todos los datos** en esos dos ficheros, con la lista de lo que falta. El estudio de dónde sale cada tabla está en [[Informe-Consejo-Origen-Datos]]. Lo que describe esta nota sobre el DOCX de entrada es **cómo funciona hoy**.

## La idea en una frase

Las **cifras** las pone un DOCX de tablas que llega cada mes; el **texto analítico** lo escribe la IA; el **diseño** lo pone una plantilla maestra aprobada. Nada de los tres invade el terreno de los otros.

## El flujo real

1. Alguien deja **un único DOCX** en `data/input/mes_actual/`, llamado `Informe MES tablas.docx` (o `Informe II Trimestre 2026 tablas.docx`). Dentro vienen **las ~40 tablas del período en el orden del informe**, con sus títulos y, entre ellas, las **precisiones y notas operativas** que explican las desviaciones.
2. Claude Code lee las tablas y esas notas (`src/monthly_docx_ingestion.py` las extrae como `ContextNote`, marcando con `is_causal` las que explican una causa).
3. Un **agente por sección** (`agents/active/`, 14 agentes: economía, producción, lencería, servicios técnicos, transporte, calidad, RRHH, riesgos, valoración…) redacta su análisis con sus tablas y sus notas delante.
4. Todos esos textos se guardan en **un JSON**: `data/processed/analisis_{mes}_{año}.json`, con una clave por marcador (`{"sections": {"ANALISIS_INGRESOS": "…", …}}`). Los de junio traen 51 claves.
5. `py -3 scripts/generate_report.py` (desde la raíz de `consejo-direccion/`) monta el DOCX final: clona la plantilla maestra, sustituye `{MES}` y `{AÑO}`, y reemplaza cada marcador por su tabla o su texto. Sale en `data/output/consejo_direccion_{MES}_{AÑO}.docx`.

El script **no recibe argumentos**: deduce el período del nombre del fichero de entrada y busca el JSON que le toca.

## Las tres reglas que mandan

- **El diseño no se genera, se clona.** `templates/master/consejo_direccion_master.docx` es la plantilla aprobada (fuentes, colores, logo, encabezados). Solo se reemplaza contenido. Si no está, el proceso se detiene. `layout_extractor.py` y `docx_builder.py` quedan **prohibidos** en el flujo mensual (son del enfoque viejo de dibujar el diseño desde cero).
- **No se inventa un solo dato.** Toda cifra viene de la tabla; toda causa, de la tabla o de una context_note. Si falta, se escribe `[dato no disponible]` y el script **borra esa subsección** del informe en lugar de rellenarla.
- **Los textos no repiten las cifras absolutas de las tablas.** El lector acaba de ver la tabla. El análisis habla en relativo: porcentajes de cumplimiento, variación interanual, posición entre polos, causas. Sí se permiten los ratios calculados (CUP/TD, kg/TD, L/kg, kWh/kg) que no están en la tabla.

Encima de eso hay reglas aprendidas: los DOCX históricos **con comentarios de revisión de la dirección** se destilaron en `config/review_rules.yaml` (RULE-002 a RULE-005…) y los PDF finales aprobados en `config/analysis_patterns.yaml`. Los agentes leen ambos antes de escribir. Esa fase de aprendizaje ya se corrió; `src/main.py discover | extract-rules | build-skills` solo se repite si entran documentos históricos nuevos.

## Cómo sabe qué tabla va a cada sitio

La plantilla maestra lleva **93 marcadores granulares**: `{TABLA_*}`, `{ANALISIS_*}`, `{INTRO_*}` y tres `{SECCION_*}` al final, para valoración, riesgos y conclusiones. Desde el 2026-10-21, cada tabla del DOCX de entrada se asigna a su `{TABLA_*}` **por lo que dice, no por su posición**. Las reglas están en `config/table_markers.yaml` y la lógica en `src/table_markers.py`:

1. **Título:** la primera fila de la tabla. Casi todas llevan ahí su nombre («Cumplimiento del plan de Ingresos», «LENCERÍA EN USO»), y es más fiable que el encabezado de encima, que a veces comparten varias tablas (Costos y Gastos, Cobrar y Pagar).
2. **Encabezado:** si la primera fila no casa, el título de sección justo encima. Es el caso del presupuesto de transporte, que empieza directamente por columnas genéricas.
3. **Continuación:** si va pegada a la anterior, sin texto entre ellas, lleva su mismo marcador. Es el caso de las inyecciones, partidas en dos tablas de Word.

Los patrones se comparan en minúsculas y sin tildes. **Si una tabla no se reconoce o casa con dos marcadores, el script para antes de clonar la plantilla** y dice cuál es y bajo qué encabezado está. También para si una regla apunta a un marcador que no existe en la maestra. Para una tabla nueva hay que añadir su patrón en el YAML, no tocar Python.

Comprobado contra los cuatro DOCX reales que tenemos (junio, II Trimestre y los borradores de diciembre y enero): **161 tablas, todas en su sitio**, incluidas variantes que los de entrada no traen, como ARRIBOS, el mando extranjero y dos tablas sin título que salen por su encabezado. `tests/test_table_markers.py` lo fija tabla por tabla.

### Lo que rompía el mapa de antes

Antes había cuatro mapas `posición → marcador` hardcodeados, elegidos olfateando las tablas 15, 30 y 31. **Los informes generados de mayo y junio de 2026 salieron mal por eso.** El DOCX traía una fila suelta de «CRECIMIENTO» de satisfacción que el mapa no contaba, así que toda la sección de RRHH quedó corrida un encabezado:

- bajo «Salario medio por trabajador» iba la tabla de CRECIMIENTO;
- bajo «Promedio de trabajadores», la de salario;
- bajo «Resumen de cargos vacantes», la de trabajadores;
- **la tabla de vacantes no aparecía.**

Además, el detalle de inyecciones caía bajo «Resultados de los inventarios», y la satisfacción del año anterior bajo «Mando extranjero (opcional)», en RRHH. Los textos sí hablaban de lo correcto, así que tabla y texto no casaban. Con el reconocimiento por título, junio se regenera con todo en su sitio. El II Trimestre ya tenía un mapa ajustado a mano y solo cambia en la satisfacción.

**Satisfacción:** las tres tablas (año en curso, año anterior y crecimiento) van juntas bajo `{TABLA_SATISFACCION}`, como en el informe aprobado de diciembre, y la comparación interanual va en `ANALISIS_SATISFACCION`. «Mando extranjero» queda para la tabla nominal real (No. / Nombre y Apellidos / Cargo). Si no viene, se elimina con su análisis. Los JSON antiguos aún traen un `ANALISIS_MANDO_EXTRANJERO` que repite la satisfacción: ya no se usa, y se va con la subsección.

Sigue pendiente: la maestra tiene `{TABLA_SOBREGIROS}`, `{TABLA_SUBEJECUCIONES}` y `{ANALISIS_INVERSIONES}` y ningún DOCX trae tablas para ellos, así que esas subsecciones se eliminan siempre.

## Estado comprobado (2026-10-21)

- Copiado al repo y **ejecutado desde su nueva ubicación**: el II Trimestre 2026 se regenera limpio — 39 tablas insertadas, 38 análisis, 4 tablas eliminadas por falta de datos, **ningún marcador pendiente**. No hay rutas absolutas en el código.
- Dependencias: `python-docx` y `PyYAML` (ya instaladas). El `requirements.txt` no lista `lxml` ni `pymupdf`, que el CLAUDE.md del subproyecto sí menciona.
- Tests: **98 pasan y 10 fallan.** Los 10 fallos son todos de `tests/test_layout_extractor.py`, el módulo prohibido en el flujo mensual: peso muerto del enfoque viejo, no un fallo del generador. De los que pasan, 18 son de `test_table_markers.py`.
- Se borró `scripts/generate_marzo.py`: una copia antigua del generador con su propio mapa de posiciones, que apuntaba a un DOCX de marzo que ya no existe. El original sigue en `C:\Trabajo\Consejo Direccion Claude`.
- Últimos informes producidos: mayo 2026, junio 2026 y II Trimestre 2026.
- Lo que se dejó fuera al copiar: cachés de Python, la carpeta duplicada `informes_generados/`, la carpeta `polarier-consejo-cerccion/` (typo, con dos scripts temporales) y los informes históricos sueltos de la raíz, idénticos (mismo MD5) a los de `data/historical/`.

## Lo que falta para que sea una automatización de la app

**Hecho en la app (2026-10-21, en `main` con el PR #34):** apartado `informe-consejo` en [[Automatizaciones]], con webhook propio (`acb55dbd-…`) y en **modo asíncrono**: n8n solo acusa recibo y la rama cierra ella misma la fila de `automation_runs`. El contrato que tiene que cumplir el backend está en [[Automatizaciones]], sección «Automatizaciones asíncronas». **Con el cambio de enfoque, la subida del DOCX sobra.** El modo asíncrono sigue sirviendo; la pantalla pasará a selector de mes, comprobación de datos y «Generar informe».

**Apartado por meses (2026-10-21):** el apartado ya enseña, mes a mes, qué datos hacen falta y si están, con «Generar informe» y «Descargar informe». Ver [[Informe-Consejo-Origen-Datos]], «Comprobación por mes»; migración 013 aplicada y primera carga de la TABLA CA 2026 hecha el 2026-10-21; n8n ya resincroniza tras cada Tabla CA; falta la rama que genera el informe.

**Falta el backend.** Lo que hay que decidir:

- **Cómo entran por mes los datos que hoy se teclean sin mes** (lencería, vacantes, cuentas por cobrar y pagar, plan de consumos) y las cuatro tablas que no están en ninguna fuente. Ver [[Informe-Consejo-Origen-Datos]].
- **Dónde se comprueba la TABLA CA**, que solo existe como xlsx en el VPS: o se sincroniza a Supabase como `global_ai`, o se le pregunta a n8n.

- **Dónde corre el paso de redacción.** Es el único que necesita un modelo: hoy es Claude Code leyendo el repo. No es el pythonrunner del VPS ([[Generacion-Documentos]]), que solo ejecuta Python; y las ramas de n8n actuales no escriben JSON de análisis. O agente de n8n, o routine en la nube como en [[Routine-Informe-Mensual]], o Claude Code en una máquina.
- ~~El mapa de posiciones~~ — resuelto el 2026-10-21 (ver arriba). Cuando falle porque llega una tabla nueva, el mensaje de error del script es lo que debe ver quien lo disparó.
- **Dónde viven la plantilla maestra y los históricos** si el proceso deja de correr en el PC de Leo.

# Informe del Consejo — generación automática

Cómo sale el informe del Consejo de Dirección cuando alguien pulsa «Generar informe» en el apartado de [[Automatizaciones]]. Montado el 2026-10-22. Sustituye al DOCX de tablas que se subía a mano: las tablas salen solas de la TABLA CA y el GLOBAL del VPS, los textos los redacta una routine de Claude y el montaje es el de siempre (plantilla maestra, ver [[Informe-Consejo-Direccion]]).

> Sin cifras: el repositorio es público. Aquí solo hay piezas, reglas y recuentos.

## El circuito

```
App «Generar informe» (mes o trimestre)
  → solicitar_informe_consejo[_trimestre]  → consejo_informes: pendiente
  → webhook n8n acb55dbd-…  (responde «recibido» al momento)
n8n «Polarier Auto App», rama CON -
  1. pendiente → generando
  2. pythonrunner Leslie/Consejo/scripts/preparar_consejo.py --anio A --mes M | --trimestre T
       → trabajo/<A-MM|A-Tn>/tablas.docx  +  JSON (tablas en texto, textos que faltan, análisis de ejemplo)
  3. consejo_informes.datos = ese JSON
  4. despierta la routine (POST /fire)
  5. espera 70 s y consulta la fila, hasta redactado_at, estado ≠ generando o 52 vueltas (≈1 h)
  6. pythonrunner montar_consejo.py (tablas.docx + analisis) → DOCX en base64
  7. Storage informes-consejo/<A>/<MM|Tn>/<nombre>  → listo  (o error con el motivo, en cualquier paso)
Routine «Polarier — Informe del Consejo» (trig_01Shmzz6CJUqw2sTGbsgiMdN)
  lee la cola por el conector de Supabase, redacta con las reglas del repo y escribe analisis + redactado_at
```

La fila de `consejo_informes` es la única fuente de verdad: la app la consulta cada 15 s (migración 014 en [[Supabase]]).

## Las tablas: de la TABLA CA y el GLOBAL

Código en `consejo-direccion/src/` (`excel_eval.py`, `formato_excel.py`, `tablas_informe.py`, `constructores_tablas.py`) y `consejo-direccion/scripts/`.

**Fórmulas recalculadas.** La TABLA CA y el GLOBAL del VPS los guarda openpyxl (el agente de la TABLA CA y el Modelo 1), que no conserva el resultado de las fórmulas. `excel_eval.py` las recalcula bajo demanda: aritmética, comparaciones, referencias entre hojas y a libros externos, SUM, AVERAGE y pocas más. **Comprobado contra Excel: 31.000 fórmulas de la TABLA CA 2026, ninguna diferencia.**

**Vínculos al GLOBAL.** La TABLA CA lleva vínculos al GLOBAL-CP26. Se resuelven con el GLOBAL vivo del VPS; si su celda está en blanco, con la copia que la TABLA CA guardó del vínculo (filas que se teclean en el GLOBAL del PC de quien monta la TABLA CA y no llegan al del VPS, como turistas-día plan o producción real). El JSON dice cuántas celdas salieron de esa copia (`celdas_del_global_desde_la_cache_de_la_tabla_ca`).

**Cada tabla se rellena sobre su «prototipo»:** la misma tabla del último informe de ejemplo del mismo tipo (`ejemplos/entrada/tablas_AAAA_MM.docx` o `tablas_AAAA_Tn.docx`). El prototipo pone el formato (fuentes, anchos, sombreado) y la forma (qué filas y qué polos lleva). Las filas del cuerpo casan por posición; las columnas, por su encabezado (La Habana, Varadero… Consolidado). Las cifras se escriben con el formato de su celda de Excel.

Cuatro familias:

| Familia | Tablas | De dónde |
|---|---|---|
| Cuadro mensual | Ingresos, costos, gastos, utilidades, costo por peso, ingreso por TD, precio del kg, producción, kg/TD, químicos, diésel, electricidad, agua | Mes: bloque del mes en «TABLAS DE CHEQUEOS MENSUAL». Trimestre: bloque del trimestre en «TABLAS CHEQUEOS CONSOLIDADAS» |
| Hojas de polo | CDT, CDO, satisfacción, salario, trabajadores, impacto de la ocupación (ingresos y gastos) | Filas de la tabla principal de cada polo; consolidado con la regla de los informes aprobados |
| Tecleadas | Montas ×2, lencería en uso y nueva, rechazo, mal uso, desmanche, retiro, inyecciones, inventarios, faltantes, cuentas por cobrar y pagar, vehículos, vacantes | Hojas auxiliares, tal como estén: el primer bloque con ese título. **Sin mes** (ver abajo) |
| GLOBAL | Presupuesto de gastos (CONSOLIDADO, partidas con plan o real ≠ 0) y de transporte (códigos 130 y 134 de cada polo) | Columnas del mes, o el «ACUMULADO nT» del trimestre |

**Cuadre con los informes reales (2026-10-22, TABLA CA del 14-10):**
- Junio, mayo y II Trimestre: las tablas del cuadro mensual y de RRHH, CDT, CDO, satisfacción y ocupación salen idénticas, salvo cifras retocadas a mano en algún informe (por ejemplo, el consolidado de salario de junio, o una celda de crecimiento del CDO). Se siguió la regla del mes que cuadra entero.
- Las tecleadas cuadran cuando la hoja aún tiene ese período (cuentas, vehículos, vacantes, lencería en uso, retiro de junio).
- Las del GLOBAL quedaron por probar en el VPS (el GLOBAL local era de mayo).

**Montaje.** `montar_consejo.py` es el `generate_report.py` de siempre con rutas explícitas: clasifica las tablas por título, clona la plantilla maestra y mete tablas y textos. Las tablas sin fuente no van en el DOCX de tablas y su subsección se quita sola. Prueba local: junio y II Trimestre con 38 tablas, todos los textos y ningún marcador pendiente.

## La redacción: routine de Claude

| Campo | Valor |
|---|---|
| Nombre | Polarier — Informe del Consejo |
| Id | `trig_01Shmzz6CJUqw2sTGbsgiMdN` |
| Repositorio | `iaquantic/Polarier-App` (lee `consejo-direccion/CLAUDE.md`, `config/review_rules.yaml`, `config/analysis_patterns.yaml`, `skills/council-report-writing/` y `agents/active/`) |
| Conectores | Solo Supabase |
| Modelo | Opus 5.5 (decisión de Leo) |
| Disparo | Solo por API, desde n8n; sin cron. Token en la credencial de n8n «Claude Routine Informe CD» |

**La credencial es de tipo Bearer** (`httpBearerAuth`): lleva **solo** el token, sin «Bearer » delante, porque n8n ya lo añade. El 2026-10-23 la primera generación real falló con `401 Invalid bearer token`: el valor guardado no servía. Leo generó un token nuevo (14:54 UTC) y lo pegó.

El texto que manda n8n al despertarla llega como dato no fiable: solo significa «mira la cola». Qué redactar sale siempre de la base de datos (`estado = 'generando' and datos is not null and redactado_at is null`). Cierra con `redactado_at`; si no puede, deja `estado='error'`.

**Guarda los textos en base64, una sentencia por sección** (cambio del 2026-10-23). Construye el `UPDATE` con Python, `jsonb_build_object('CLAVE', convert_from(decode('<base64>', 'base64'), 'UTF8'), …)`, y nunca mete el texto tal cual en el SQL. El motivo: el MCP de Supabase toma un «;» dentro de una cadena por el final de la sentencia y cree que es un `UPDATE` sin `WHERE`. Entonces pide una confirmación que en una routine nadie puede dar, y la llamada caduca a los 60 s. Con el prompt original («un texto por clave con `jsonb_set`») la routine guardó 1 texto de 47 en 16 minutos. Con base64 los guardó todos en unos 14.

Reglas que lleva el prompt, además de las del repo:
- **Sin notas del mes** (decisión de Leo, 2026-10-22): no explica causas que las tablas no muestran; si una desviación lo pide, dice que requiere revisión.
- Las tablas `tecleado = true` no tienen mes: si su título nombra otro período, no las atribuye al del informe.
- El análisis de ejemplo (último aprobado del mismo tipo) es solo para tono y extensión.

El prompt completo vive en la routine; se lee y se cambia por API (`RemoteTrigger`), como en [[Routine-Informe-Mensual]].

## En el VPS: /data/Polarier/Leslie/Consejo/

| Carpeta | Qué hay |
|---|---|
| `src/`, `scripts/`, `config/`, `templates/master/` | El código, bajado de GitHub fijado a un commit con `Leslie/instalar_consejo.py <commit>` (repo `vps/Polarier/Leslie/`). `--verificar` lista todo con su SHA-256 |
| `ejemplos/entrada/` | DOCX de tablas que sirven de prototipo: `tablas_2026_05.docx`, `tablas_2026_06.docx`, `tablas_2026_T2.docx` |
| `ejemplos/informes/` | Los informes generados de mayo, junio y II Trimestre de 2026 |
| `ejemplos/aprobados/` | Borradores con comentarios y PDF finales de diciembre de 2024 y enero de 2025 |
| `ejemplos/analisis/` | Los JSON de análisis aprobados (marzo a junio, I y II Trimestre de 2026) |
| `trabajo/<período>/` | Lo de cada generación: `tablas.docx` y el informe |

Los ejemplos son informes reales: **no están en el repositorio** (`consejo-direccion/.gitignore` excluye `ejemplos/` y `trabajo/`). Se subieron el 2026-10-22 con un permiso temporal en una ruta aleatoria de Storage, copiados al VPS por un flujo temporal de n8n (ejecuciones 561 y 562, ya archivado) y borrados de Storage. La ejecución 561 de n8n guarda copia de esos ficheros hasta que n8n la purgue: se puede borrar a mano en la interfaz.

Para añadir un ejemplo nuevo (p. ej. el último informe aprobado), mismo nombre de patrón en la carpeta que toque. Para actualizar el código: commit, push e instalar con el sha nuevo.

**pythonrunner redesplegado el 2026-10-23** (14:31 UTC, build del commit `3e627b8`): `python-docx` 1.2.0, `lxml` 6.1.0, `PyYAML` 6.0.3 y `timeout=300`. El día anterior la imagen seguía siendo la del 2026-10-14 y `preparar_consejo.py` fallaba con `ModuleNotFoundError: No module named 'docx'` (ejecución 564). Para desplegar sin la interfaz, la fuente del servicio pasó de Upload a GitHub (rama `informe-consejo/generacion`, sin auto-deploy): **tras el merge hay que cambiarla a `main`**. Detalle en `vps/pythonrunner/README.md`. Ese build trajo `python-dateutil` 3.0.0 sin fijar (pandas la pide sin versión). Se fijó la 2.9.0.post0 y se volvió a desplegar a las 14:37 UTC (commit `da28a68`). La primera generación real confirmó `python-docx` dentro del contenedor.

## La rama de n8n (`CON -`)

Publicada el 2026-10-22 en «Polarier Auto App» (versión `635d49df`). Tiene 23 nodos y una nota adhesiva (`CON - Nota`), en una zona propia del lienzo, y no se conecta con ninguna otra rama.

**Disparo:** `POST https://polarierauto-n8n.1tn4v0.easypanel.host/webhook/acb55dbd-290c-4c7b-a5d2-6858ce77649b`, sin autenticación, igual que los otros `WH`. Cuerpo: `{automatizacion, informe_id, anio, mes|null, trimestre|null, archivo_nombre, user_id, user_name, user_email, timestamp}`. Responde:
- **400** `{"respuesta":"Petición no válida: …"}` sin tocar la base.
- **200** `{"respuesta":"Recibido. El informe se está generando; tarda unos minutos."}`.

Qué escribe en `consejo_informes`:

| Nodo | Escribe | Solo si |
|---|---|---|
| `CON - Marcar generando` | `estado='generando'` | estaba `pendiente`. Si no, la rama termina sin hacer nada |
| `CON - Guardar datos` | `datos` = el JSON de `preparar_consejo.py` | sigue `generando` |
| `CON - Cerrar` | `estado='listo'`, `archivo_path` (`<año>/<MM o Tn>/<archivo_nombre>`), `archivo_nombre`, `generado_at`, `error=null` | sigue `generando` |
| `CON - Error` | `estado='error'`, `error` (máx. 500 caracteres) | sigue `pendiente` o `generando` |

**Motivos de error.** Todo nodo que puede fallar después de responder sale por su salida de error a `CON - Componer error`. Ese nodo arma el motivo según el nodo que falló (`$prevNode.name`):
- «Preparar tablas: …» y «Montar el DOCX: …» llevan el `error` del JSON del script o la última línea del traceback del pythonrunner.
- «No se pudo despertar la redacción (HTTP <código>)».
- «La redacción no terminó en una hora».

Un nodo Code de n8n recorta el mensaje de error en los dos puntos. Por eso `CON - Comprobar tablas` y `CON - Comprobar montaje` lanzan un texto genérico, y el motivo real se lee del stdout.

**Probado el 2026-10-22 sin tocar producción**, con `test_workflow`, datos fijados y un `informe_id` ficticio:
- Ejecución 565: error de preparar → motivo «Preparar tablas: ModuleNotFoundError: No module named 'docx'».
- Ejecución 566: camino feliz, con la espera real de 70 s, el base64 del análisis con tildes y el DOCX convertido a fichero.
- Ejecución 567: rechazo de un cuerpo inválido.

**Primera generación real: mayo de 2026, el 2026-10-23.** La fila se pidió con el RPC y el webhook se llamó con el mismo cuerpo que manda la app. Hicieron falta tres intentos:
- **Ejecución 568:** preparar fue bien, pero despertar la routine dio `401 Invalid bearer token` y la fila quedó en `error` con su motivo. Era el token de la credencial: ver «La redacción».
- **Ejecución 569:** la routine se despertó, pero se atascó guardando textos con «;» (ver «La redacción»). Se cortó a mano poniendo la fila en `error`. La espera lo vio y terminó por `CON - Ya cerrada`, sin quedarse colgada.
- **Ejecución 570, con el prompt en base64:** de 15:15:02 a 15:29:18 UTC, en `listo`.
  - Preparar tardó 6 s: 37 marcadores con tabla, 47 textos y nada sin fuente. Leyó el GLOBAL vivo, sin tirar de la caché de la TABLA CA.
  - La routine redactó los 47 textos en unos 14 minutos, sin ningún «[dato no disponible]».
  - La espera dio 12 vueltas de 70 s.
  - Montar tardó 1,2 s: 40 tablas insertadas, 6 quitadas, 36 análisis insertados (los `INTRO_*` y `SECCION_*` van aparte), ningún análisis faltante y ningún marcador pendiente.
  - El DOCX (186 KB) está en `informes-consejo/2026/05/consejo_direccion_MAYO_2026.docx`.

Con esto quedan probadas las credenciales de los nodos HTTP de Supabase y de la routine. La espera máxima de una hora deja margen de sobra.

## Lo que queda abierto

- **Las hojas auxiliares no tienen mes** (pendiente de analizar, decisión de Leo): un mes pasado se genera con lo tecleado hoy. Depende de las preguntas P27 y P28 de [[Informe-Consejo-Origen-Datos]].
- **Inventarios realizados**: la TABLA CA no tiene el plan anual ni el acumulado; esas columnas salen vacías, con aviso.
- **Notas del mes**: si se quieren causas en el texto, haría falta una forma de darlas (por ejemplo, un campo en la app).

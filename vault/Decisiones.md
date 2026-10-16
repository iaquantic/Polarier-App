# Decisiones

Registro de decisiones tomadas en el proyecto, con fecha y motivo. Lo más reciente arriba.

---

## 2026-10-16 — Auditoría con el diseño nuevo y acceso desde el lobby

- **Contexto:** Leo vio que la sección de Auditoría era totalmente distinta del resto. Pidió adaptarla al diseño nuevo y poner un botón en el lobby para quien tenga acceso.
- **Se hizo directamente, sin vistas previas.** Se aplicaron las reglas que Leo ya había aprobado para el chat: fondo amarillo/azul y superficies blancas con azul en claro y amarillo en oscuro.
- **Se adaptaron los tokens en vez de reescribir los formularios.** Las tablas y formularios conservan su estructura. Así no se toca la lógica de los partes, que tiene reglas duplicadas con la base de datos.
- Detalle en [[Diseno-Neoformista]].

## 2026-10-16 — Rediseño neoformista de lobby, chat y login

- **Contexto:** Leo veía la app muy básica, sobre todo el lobby. Pidió un estilo neoformista con los colores de Polarier y poder mandar audio desde la barra del lobby. Primero se hicieron vistas previas y él las aprobó por secciones.
- **Fondos regenerados en vectorial** a partir de sus dos imágenes, que habían perdido calidad. Los colores se rebajaron porque estaban muy vivos.
- **Lobby y login:** superficies del color del fondo, en relieve. **Chat:** solo el fondo es amarillo o azul. El resto juega con blanco y azul en claro, y con blanco y amarillo en oscuro. La barra lateral es blanca.
- **Un solo botón principal relleno por pantalla.** Todo lo demás es secundario en relieve, y el texto va más oscuro. Leo pidió más uniformidad entre botones.
- **La nota de voz se revisa antes de enviarla.** Antes se enviaba nada más parar.
- **Logo en azul marino en claro.** El logo amarillo no se veía sobre el fondo amarillo. Se detectó al montarlo en la app, no en las vistas previas.
- Detalle en [[Diseno-Neoformista]].

## 2026-10-14 — Agente Modelo 1

- **Contexto:** el Modelo 1 pasaba por Google Sheets solo para que `Modelo1.py` pudiera leer un Excel. Además, el extractor de JavaScript esperaba un formato de fila (`ccc Indicador PM RM PA RA %M %A`) que no es el de los PDF actuales.
- **Leo eligió un agente de n8n** que lee el PDF directamente, como el de la TABLA CA. Se quitan los Sheets de staging, la copia del GLOBAL en Drive y `Modelo1.py`, y se mantiene la sincronización de `global_ai`.
- **Se aceptan PDF sueltos y ZIP o RAR** con varios.
- **Si el mes ya tiene datos, se sobrescribe y se avisa** con el valor anterior (Leo).
- **El polo y el mes salen del contenido, no del nombre.** Dos de las cinco muestras tenían en el nombre un mes distinto del contenido, y una llevaba fechas ocultas fuera de la página.
- **La lectura es determinista y el agente supervisa.** Python lee por coordenadas y valida cada fila con las cuentas del PDF. El agente solo investiga lo dudoso y pasa correcciones o exclusiones. Así no copia cientos de números a mano y todo se puede auditar. Después de escribir, una verificación independiente vuelve a leerlo todo.
- **Fórmulas del GLOBAL: se conservan si cuadran con el PDF (±1 CUP); si no, se escribe el valor del PDF y se avisa.** `Modelo1.py` las machacaba siempre. Al principio fue una recomendación de Claude sin respuesta de Leo. **Leo la confirmó el 2026-10-15**, después de verla en producción con `VAM-1.PDF`: se sustituyeron 4 fórmulas de Varadero y el aviso permitió encontrar el plan del 047 puesto en la fila del 045.

## 2026-10-12 — Reglas de generación de documentos y limpieza

- **Contexto:** las reglas de qué fichero genera qué documento solo existían dentro de los nodos de n8n y de los scripts del VPS. Cada sistema heredado usa su propio código de polo y el año va fijo en varios sitios. Se escribieron en [[Generacion-Documentos]].
- **TABLA CA con un agente de n8n**, no con `rellenar_ca.py`. El script buscaba etiquetas con desplazamientos fijos y se rompía con cualquier cambio de formato (además, apuntaba a las hojas `*CP2025` mientras leía `GLOBAL-CP26`). Leo eligió que el agente decida todos los valores. Como salvaguarda, cada valor va con su celda de origen y un nodo valida las sumas antes de escribir. Maestro en el VPS y respuesta en el chat.
  - **Al implantarlo (2026-10-12)** se ajustaron tres cosas:
    - El agente parte de la extracción del script antiguo, ya portada y con celda de origen, y solo investiga lo dudoso. Así es más barato y se puede auditar.
    - El GLOBAL se lee del xlsx del VPS evaluando las fórmulas con el `Evaluador` de `sync_global_ai.py`, en lugar de leerlo de `global_ai`.
    - Las sumas las valida el agente, y la garantía dura está en el escritor: **nunca pisa una celda con fórmula** (decisión de Leo) y solo acepta las 28 claves con valores numéricos.
  - Leo eligió además «escribe y avisa»: el agente escribe sin pedir confirmación y devuelve el resumen con la tabla.
  - **2026-10-14, mapa con datos reales.**
    - Leo pasó los CA reales de abril de 2025, que se llaman `<POLO>CA<AAAAMM>`, y la TABLA CA 2026. La lógica de `rellenar_ca.py` solo se usó como pista de dónde estaba cada dato.
    - El mapa nuevo localiza cada dato por etiqueta y cabecera, y se validó contra la tabla rellenada a mano.
    - Las seis cifras económicas salen de las filas del GLOBAL que la tabla enlaza.
    - **Transporte: mantener la lógica de la tabla** (decisión de Leo). Cayo Coco, La Habana y Varadero cuentan todos los vehículos. Caibarién, Cayo Cruz y Holguín cuentan solo los de carga.
- **`global_ai` se sincroniza al final de cada Modelo 1.** Se cargó una sola vez (30-ago, enero–junio) y Wisin respondía con datos viejos.
- **El año sale del fichero.** Nada de `CP26`/`2025` fijos.
- **Correo por el n8n self-hosted** («Emails»), para tener una sola instancia.
- **Se dejan como están:** la rama Carla (decisión del 2026-10-05), la rama `Integral` (funciona pero no se usa) y los borradores `My workflow 2/3/4` y `My Sub-Workflow 1`.

## 2026-09-23 — El administrador ve los partes de todo su hotel

- **Contexto:** la RLS del módulo era estrictamente personal (`user_id = auth.uid()`).
  Perfecto para quien rellena, inútil para quien supervisa: un administrador entraba al
  histórico y no veía nada del trabajo de su equipo. De hecho ni siquiera podía entrar,
  porque `AuditorRoute` exigía literalmente el rol `auditor`.
- **Decisión: abrir la lectura, no la escritura.** El admin ve todos los partes de sus
  hoteles (`form_submissions`, `audit_daily`, `audit_daily_detalle`), pero
  insert/update/delete siguen siendo personales. Editar el parte de otro rompería la
  trazabilidad y, con la clave única `(hotel, formulario, fecha, usuario)`, el upsert
  crearía una entrega paralela a nombre del administrador en vez de corregir la
  original. Un parte ajeno se abre en **solo lectura**.
- **Decisión: abrir `profiles` lo justo.** Sin nombres el histórico mostraría UUID. Se
  añade `puede_ver_perfil(uuid)`, que solo es cierto para el propio perfil y para quien
  tiene rol activo en un hotel que administras. Un auditor no gana visibilidad sobre
  nadie. Es `security definer` porque tiene que mirar los roles de otro usuario, que
  `uhr_select_own` no deja leer.
- **Decisión: `monthly_reports` se queda por usuario.** No hace falta abrirlo: la
  routine redacta leyendo `audit_mes`/`audit_mes_dias`, que agregan el mes entero del
  hotel, así que el informe de un administrador ya cubre el trabajo de todos.
- **Consecuencia que hubo que arreglar:** `getSubmission()` no filtraba por usuario y
  usaba `maybeSingle()`. Con la RLS abierta, un admin habría recibido varias filas (o el
  parte de otro cargado en su formulario de hoy, que al guardar se habría duplicado a su
  nombre). Ahora filtra por `user_id` propio, y para abrir uno ajeno está
  `getSubmissionById()` vía `?sub=<id>`.
- **Consecuencia menor:** el histórico pedía 60 partes. Con varias personas eso era menos
  de una semana, así que la lista de meses se cortaba. Subido a 500, como ya hacía el
  dashboard.
- **Entrada al módulo:** un admin usa también el chat, así que aterriza en `/lobby`. Se
  añadió «Auditoría» al sidebar principal cuando el usuario tiene algún rol del módulo.
- **Deuda:** el rol `supervisor` no gana visibilidad sobre el trabajo de los auditores.
  Si se quiere, es añadir `'supervisor'` a los `array['admin']` de la migración 008.

## 2026-09-17 — Dotación fija de lencería como dato maestro

- **Contexto:** la lencería de un hotel es una cantidad fija que solo circula entre
  ubicaciones (pisos, offices, almacenes, lavandería) y al cierre del mes tiene que
  volver a sumar lo mismo. El auditor tecleaba esa matriz cada día desde cero, y el
  dashboard deducía la «dotación» del conteo más alto del mes (o de un campo manual),
  o sea, de un dato que el propio auditor podía haber contado mal.
- **Decisión: la dotación es una tabla (`dotacion_lenceria`), no una deducción.** Una
  fila por hotel + ubicación + prenda. Se cargó la hoja «CONTROL DE ALMACÉN» del Muthu
  (2.877 prendas), con una comprobación en la propia migración que aborta si la suma no
  cuadra con la hoja. Las ubicaciones Piso 10 y Piso 11, que la hoja trae y el catálogo
  no tenía, se añaden y el catálogo se reordena al orden de la hoja.
- **Decisión: el parte de lencería arranca precargado con la dotación** y el auditor
  solo ajusta lo que se movió. La matriz muestra la comparación (por fila, por prenda y
  en total) y un botón para volver a la dotación. Es lo que pidió el usuario: «eso evita
  llenar a mano».
- **Decisión: prioridad del objetivo en el dashboard: manual > tabla > conteo.** El
  campo manual se conserva por si un mes hay que forzar otra cifra; sin tabla, el
  comportamiento anterior sigue intacto (deducir del conteo más alto).
- **Decisión: la comparación conteo ↔ dotación llega a todo lo que emite el módulo.**
  Informe diario (cabecera, columna «Dif.», filas «Dotación» y «Diferencia»), dashboard
  (aviso `inventario_desviado`, «media» si faltan más del 2 %) e informe mensual
  (vistas `audit_mes.dotacion_hotel`, `audit_mes_dias.diferencia_dotacion` y
  `audit_mes_dotacion` por ubicación × prenda; el prompt de la routine pide comparar y
  guardar `inventarioContado` / `diferenciaDotacion` en `metricas`).
- **Decisión: sin UI de edición por ahora.** La dotación cambia rara vez; se edita por
  SQL. La RLS ya deja escribir a `supervisor`/`admin` (`has_hotel_role()`), así que
  cuando haga falta pantalla no habrá que tocar permisos.
- **Decisión: la app no depende de que la tabla exista.** Las tres pantallas que leen
  la dotación tragan el error y siguen sin ella, para que el despliegue no se rompa si
  la migración 007 todavía no se ha aplicado.
- **Aplicación:** la migración se validó primero en una transacción revertida y se
  aplicó el mismo día a petición del usuario (por convención las migraciones se
  aplican con su visto bueno). El prompt de la routine se actualizó a continuación por API
  (`RemoteTrigger`), sin pasar por la web. Ver [[Routine-Informe-Mensual]].

## 2026-09-03 — Informe mensual: capa de datos plana + routine en la nube

- **Contexto:** con 3 partes diarios por hotel, un mes son ~90 filas de `form_submissions`
  con tres formas distintas de `totales` y UUID como claves en lencería. El diseño
  anterior (rutina de Claude Desktop leyendo esas 90 filas crudas) era caro, frágil y
  obligaba a que la IA hiciera aritmética en vez de análisis.
- **Decisión: separar los números del texto.** Los agregados los hace SQL
  (`audit_daily` + `audit_daily_detalle`, mantenidas por trigger; vistas `audit_mes` y
  `audit_mes_dias`); la IA solo redacta. El prompt pasa de ~90 blobs JSON a ~3 KB.
- **Decisión: routine de Claude en la nube, no agente de n8n.** El motivo por el que se
  descartó n8n en agosto de 2026 sigue en pie: la IA en n8n consumiría la API de pago, y
  el requisito es usar el plan. Pasar de Claude Desktop a una **routine de claude.ai**
  quita la única pega real que tenía (depender de que el PC esté encendido).
- **Decisión: el botón de la app dispara la routine de verdad**, vía el trigger de API
  (`POST /v1/claude_code/routines/{id}/fire`). El cron mínimo de una routine es 1 hora,
  así que el cron nunca podría ser el mecanismo inmediato: queda como red de seguridad
  diaria que además vacía la cola si un disparo falló.
- **Decisión: el token del trigger vive en una Edge Function, no en el frontend.** La app
  es una SPA de Vite: cualquier `VITE_*` acaba escrito en el bundle público, y con ese
  token cualquiera podría lanzar la routine, que corre con el conector MCP de Supabase y
  permisos de escritura. `disparar-informe-mensual` guarda el secreto y valida el JWT.
  Es la primera Edge Function del proyecto.
- **Decisión: la cola manda, el payload solo avisa.** El `text` del `/fire` llega a la
  routine envuelto en `<routine-fire-payload>`, marcado como dato no fiable. Se aprovecha:
  el payload solo dice "mira la cola", y qué generar sale siempre de
  `monthly_reports.solicitado_at`, escrito por un usuario autenticado bajo RLS. Un token
  filtrado no consigue que la routine redacte sobre datos ajenos.
- **Deuda asumida:** los umbrales de desviación (0.5 / 0.75 / 1.5 sobre la mediana) están
  ahora en **dos sitios**: `detectarAlertas()` en `src/lib/dashboard.ts` (para el
  dashboard) y la vista `audit_mes_dias` (para el informe). Hay un comentario cruzado en
  ambos. Unificarlos exigiría que `dashboard.ts` leyera de la vista, que es otro trabajo.
- Detalle completo y prompt en [[Routine-Informe-Mensual]].

---

## 2026-08 — Módulo de Auditoría (Fase 1)

- **Fecha:** 2026-08 (fase 1 del sistema de control de almacén hotelero).
- **Funcionalidad añadida:** módulo de auditoría con formularios diarios nativos (Lencería, Producción, Cuadrador Lavatín), rol de auditor con navegación propia (sin chat), histórico con acceso al formulario (editable hoy / solo lectura días pasados) y enganche de descarga PDF. Ver [[Modulo-Auditoria]] y [[Referencias-Formularios]].
- **Archivos creados:**
  - SQL: `supabase/migrations/001_audit_module.sql`, `002_forms_produccion_cuadrador.sql`
  - Servicios: `src/services/audit.ts`, `src/services/hotels.ts`
  - Contexto: `src/context/RoleContext.tsx`
  - Componentes: `src/components/audit/AuditLayout.tsx`, `LenceriaMatrix.tsx`, `LineasTable.tsx`
  - Páginas: `src/pages/audit/AuditHome.tsx`, `AuditForm.tsx`, `AuditHistory.tsx`
  - `src/App.tsx` (RoleProvider + rutas + guards), `src/index.css` (utilidad `.no-spinner`)
- **Decisiones técnicas:**
  - **Multi-hotel desde el inicio**: jerarquía `polos_turisticos → hoteles → roles/formularios`. `polo_id` nullable para no bloquear el presente. No se hardcodea el hotel.
  - **`data`/`config` como JSONB** + tabla `form_definitions`: permite añadir o cambiar formularios sin migraciones de esquema. Prioriza escalabilidad/mantenibilidad.
  - **RLS estricta**: cada auditor solo ve sus submissions, en su hotel (`has_hotel_access()`).
  - **PDF/WhatsApp diferidos**: solo se dejó el enganche (`informe_url`, `informe_estado`, `enviado_at`). La generación irá en n8n + pythonrunner (respeta la arquitectura aprobada).
  - Formularios producción/cuadrador con **líneas dinámicas** (añadir/quitar vale) en vez de filas fijas del Excel.
- **Futuras mejoras:**
  - Generación real del PDF (formato Polarier) y envío WhatsApp/email vía n8n.
  - Validar si producción necesita el **desglose de manchas por color** (se agrupó en una columna). Ver [[Referencias-Formularios]].
  - Polos turísticos (UI) y selector de hotel activo cuando haya más de uno.

## 2026-08 — Preparación para deploy y correcciones

### Reorganización: memoria en Obsidian + limpieza
- **Qué:** Creado este vault `/vault` como memoria del proyecto. Carpeta `imagenes nuevas/` renombrada a `design-assets/` (`git mv`, historial preservado).
- **Por qué:** Documentación viva versionada junto al código; nombre de carpeta sin espacios, más portable.

### Soporte de ZIP/RAR + límite a 50MB
- **Qué:** Permitir subir `.zip` y `.rar`. Límite de documentos de 20MB → 50MB.
- **Por qué:** Necesidad del flujo. Validación en **tres capas** (ChatInput, Lobby, storage.ts), por MIME **y por extensión**, porque el navegador reporta el MIME de estos formatos de forma inconsistente (a veces vacío). Había validaciones duplicadas en la UI que rechazaban el archivo antes de storage.ts. Ver [[Supabase]].

### Borrado real en Supabase (BD + Storage)
- **Qué:** `deleteChat` ahora borra en cascada documentos+archivos+mensajes. Nuevo botón de eliminar en "Mis Documentos".
- **Por qué:** Antes solo borraba la fila del chat → mensajes y archivos quedaban huérfanos y llenaban el proyecto. Ver [[Supabase]].

### Robustez ante respuesta vacía de n8n
- **Qué:** `sendToN8n` lee el body como texto antes de parsear JSON.
- **Por qué:** Un `200` con cuerpo vacío hacía reventar `res.json()` → caía al catch → la app no mostraba nada **en silencio**. Ver [[Integracion-n8n]].

### Migración de n8n a self-hosted
- **Qué:** URLs de n8n cloud (`automate-cuba24.app.n8n.cloud`) → instancia propia en Easypanel (`polarierauto-n8n.1tn4v0.easypanel.host`).
- **Por qué:** El host viejo dejó de existir (404). Ver [[Integracion-n8n]].

### Control de entorno n8n por variable
- **Qué:** `VITE_N8N_MODE=prod|test` decide el webhook en build time.
- **Por qué:** Que el modo lo controle solo el admin desde Easypanel, no cualquier usuario desde la app. Se descartó un toggle en la UI (cosmético, manipulable vía localStorage). Ver [[Integracion-n8n]].

### Deploy vía Docker + Nginx
- **Qué:** Dockerfile multi-stage (Node build → Nginx static), en vez de `serve`.
- **Por qué:** Imagen ligera y robusta para SPA en producción. Ver [[Deploy-Easypanel]].

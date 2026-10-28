# Pendientes

Tareas y cosas por revisar. Marca `[x]` al completar.

## Deploy / operación

- [x] **Actualizar variables de n8n en Easypanel** (la app desplegada) con las URLs self-hosted + `VITE_N8N_MODE`, y hacer **Rebuild**. Ver [[Deploy-Easypanel]].
- [x] Para uso real: poner `VITE_N8N_MODE=prod` **y activar el workflow** en n8n (toggle *Active*), para no depender de "Listen for test event". Ver [[Integracion-n8n]].
- [x] Confirmar que el dominio de producción está registrado en Supabase Auth (Site URL + Redirect URLs). Ver [[Supabase]].
- [ ] **Login con Google (2026-10-28):** en Supabase → Authentication → URL Configuration, comprobar que **Redirect URLs** incluye el dominio de producción, `polarier://auth/callback` y, para probar en local, `http://localhost:5180/**`. Ver [[Supabase]].
- [ ] **Login con Google:** probar de principio a fin con una cuenta real en local, en producción (tras desplegar) y en Android.
- [ ] **Login con Google, Google Cloud:** la pantalla de Google muestra «Ir a zongaaygriklqsxzxfgl.supabase.co». Revisar en la pantalla de consentimiento OAuth el nombre y el logo de la app, y que esté publicada (*In production*): en *Testing* solo entran los usuarios de prueba.

## n8n

- [x] Si el flujo debe **procesar el contenido de ZIP/RAR**: n8n no descomprime de forma nativa. Definir cómo (nodo específico o Code). El archivo llega bien a n8n; falta la lógica de descompresión. Ver [[Integracion-n8n]].
- [ ] Revisar que el nodo "Respond to Webhook" devuelve el texto/archivo en una clave que la app entiende (`respuesta`, `output`, etc.) o como Binary File.

## Código / limpieza

- [ ] Revisar `design-assets/` — recursos de diseño sueltos, no usados por el código. Decidir si se conservan como referencia o se archivan.
- [ ] (Opcional) Code-splitting: el bundle principal supera 500KB (aviso en el build). Considerar `import()` dinámico o `manualChunks`. En especial **jspdf** arrastra `html2canvas` (~200KB) y `dompurify` que **no usamos** (solo para `.html()`); cargar `informePdf.ts` con `import()` dinámico reduciría el bundle inicial.

## Módulo de Auditoría

- [x] **Generación del PDF del informe en el cliente** (jsPDF + autotable, formato Polarier). Vista previa en pantalla + descarga directa (`src/lib/informePdf.ts`, `InformePreview.tsx`). Disponible desde el histórico y desde el formulario abierto. **No depende de n8n.**
- [x] **Envío del informe por correo (lado app)** — UI (`EnviarCorreoModal.tsx`) + servicio `src/services/informeCorreo.ts`: genera el PDF en base64 y hace POST al webhook n8n de correo (`VITE_N8N_EMAIL_WEBHOOK_URL`, instancia `automate-cuba24.app.n8n.cloud`). Ver [[Modulo-Auditoria]] y [[Integracion-n8n]].
- [x] **Flujo n8n de correo** — montado: workflow `Enviar informe email` (`Komb1YycRFKXTvkX`) en `automate-cuba24.app.n8n.cloud`. Webhook → Convert to File (base64→PDF) → Gmail (adjunto PDF, cuerpo HTML con datos del informe + firma) → Responder. Remitente: cuenta **Gmail de Quantic** (elegido manualmente), `senderName` "Quantic - Informes". Ver [[Integracion-n8n]].
- [ ] **Spam:** con `@gmail.com` normal no se puede autenticar dominio (SPF/DKIM/DMARC solo con dominio propio). Se evaluó enviar desde dominio propio de Hostinger vía SMTP + DNS, pero se **descartó por ahora**: se queda con Gmail. Paliativo: destinatarios marcan "No es spam" + añaden el remitente a Contactos → Gmail aprende. Si el spam molesta en producción, retomar el envío desde dominio propio (Workspace/Hostinger) con DKIM/DMARC.
- [x] **Activar el workflow de correo** — «Emails» está activo en el n8n self-hosted (comprobado el 2026-10-19). Texto original: (toggle *Active* en n8n) para que funcione en prod. En modo test hay que ponerlo a *Listen for test event* antes de cada prueba.
- [x] Probar el envío end-to-end desde la app y confirmar que el correo llega con el PDF adjunto (T-98fe992b4d). **Cerrado el 2026-10-26:** Leo pulsó «Enviar por correo» en `EnviarCorreoModal` con sesión iniciada → ejecución **591** de «Emails» (22:30 UTC, modo `webhook`, `origin` = la app desplegada, Gmail `SENT`). Antes: el bundle desplegado apunta al webhook de producción de «Emails»; con el código de la app (`informeCorreo.ts` + `informePdf.ts`, datos ficticios) contra ese webhook → ejecución **590** (modo `webhook`, `SENT`, PDF de 4,2 kB) y el correo llegó a automate.cuba@polarier.com con el adjunto. Antes, la 574 (manual, pinData). Hecho con la 591.
- [x] En **Easypanel**: añadir `VITE_N8N_EMAIL_WEBHOOK_URL` (+ `_TEST`) como Build Args y **Rebuild** para que el correo funcione en producción. Ver [[Deploy-Easypanel]].
- [ ] (Opcional) Generación de PDF también en n8n + pythonrunner si se requiere un formato corporativo más elaborado o guardado en Storage (`form_submissions.informe_url`). Hoy no es necesario: el PDF se genera en cliente.
- [ ] **Envío por WhatsApp** (Evolution API, número fijo) del informe generado.
- [x] Producción reproduce la estructura completa del Excel (cabecera, Hora Inicio/Fin, Manchas por color, Total P+M+R calculado). Ver [[Referencias-Formularios]].
- [ ] Ejecutar en Supabase `002_forms_produccion_cuadrador.sql` (config completa de producción y cuadrador — el script hace upsert, se puede re-ejecutar).
- [x] **Migración `007_dotacion_lenceria.sql` aplicada en Supabase** (2026-09-17, registrada como `dotacion_lenceria`): 16 ubicaciones con Piso 10/11, 76 celdas, 2.877 prendas (SP 515 · SK 125 · F 327 · TB 355 · TM 352 · TA 347 · TF 71 · TP 785), RLS con sus 4 políticas y las vistas devolviendo `dotacion_hotel`. El linter de seguridad solo señala `has_hotel_role` como SECURITY DEFINER ejecutable, igual que ya señalaba `has_hotel_access`: es un booleano sobre los roles del propio usuario, sin datos que filtrar. Ver [[Modulo-Auditoria]].
- [x] **Prompt de la routine actualizado** (2026-09-17, por API desde Claude Code). Ver [[Routine-Informe-Mensual]].
- [ ] Decidir el cron de la routine: está en `1 0 1 * *` (mensual), no en el diario `23 7 * * *` del diseño. Si se quiere la red de seguridad diaria para la cola, volver a ponerlo.
- [x] **Migración `008_admin_ve_todos_los_partes.sql` aplicada** (2026-09-23, registrada como `admin_ve_todos_los_partes`). Comprobada contra producción simulando usuarios: el admin ve 4/4 partes, `audit_daily` y detalle, y los perfiles «Auditor, Leonardo» (solo quien tiene rol en el hotel); el auditor sigue viendo 0 partes y solo su perfil. El linter de seguridad añade `puede_ver_perfil` a la misma lista de SECURITY DEFINER ejecutables donde ya estaban `has_hotel_access` y `has_hotel_role`: para `anon` devuelve falso siempre, no filtra nada.
- [x] **`leodev0211@gmail.com` es administrador** del Gran Muthu Habana (2026-09-23). Es además el dueño de los 4 partes existentes.
- [x] **Frontend desplegado** (2026-09-23): PR #6 mergeado y rebuild hecho en Easypanel (servicio `polarierauto/polarierapp`, 41 s, commit «Merge pull request #6 … admin-ve-partes-del-equipo»). El login de `app.automate-polarier.tech` carga bien tras el despliegue. **Ojo:** el rebuild de este servicio **no** se dispara solo al mergear; hay que pulsar **Deploy** a mano en el panel.
- [x] Para ver de verdad «los partes de otro», el auditor (`blandonbg97@gmail.com`) tiene que rellenar alguno — el auditor real ya usa la app (Leo, 2026-10-19): hoy los 4 que hay son del propio administrador.
- [ ] Decidir si el rol `supervisor` debe ver también el trabajo de los auditores (hoy solo lo ve `admin`). Ver [[Decisiones]].
- [x] ~~UI para editar la dotación~~ — **descartado** (Leo, 2026-10-19): la dotación es fija y no debe cambiarse desde la app.
- [x] Cambiar el auditor de prueba (`leodev0211@gmail.com`) por el usuario real del hotel — hecho, lo usa el auditor real (Leo, 2026-10-19).
- [ ] Cuando haya más de un hotel: UI de selección de hotel activo y polos turísticos.

## Informe mensual / Routine

Ver [[Routine-Informe-Mensual]] para el diseño completo y el prompt.

- [x] Tablas `monthly_reports` (004) y bucket `informes-mensuales` (005) aplicadas en Supabase.
- [x] Apartado por meses en la app: `AuditHistory` (lista de meses) → `AuditMonth` (detalle + bloque de informe mensual). Servicios en `audit.ts`.
- [x] **Capa de datos para la IA**: `006_auditoria_datos_ia.sql` (tablas `audit_daily` / `audit_daily_detalle`, trigger de aplanado, vistas `audit_mes` / `audit_mes_dias`, columna `solicitado_at`). Validada contra la BD en una transacción revertida.
- [x] Botón «Generar informe» + polling en `AuditMonth`, y `solicitarInformeMensual()` en `audit.ts`.
- [x] Edge Function `disparar-informe-mensual` escrita.

- [x] **Migración `009_borradores_no_son_desviacion.sql` aplicada** (2026-10-06, registrada como `borradores_no_son_desviacion`). Añade el valor `borrador` a `audit_mes_dias.clasificacion`: un parte sin cerrar ya no se cuenta como caída de producción, igual que en el dashboard. Escrita sobre la versión de la vista que dejó la 007, no sobre la 006. Verificado después de aplicar: las 25 columnas siguen ahí y las 7 filas conservan `dotacion_hotel`, así que el join de la 007 no se perdió; los 2 partes en borrador del 5-oct pasan a `borrador` y los días a cero siguen en `sin_datos` (la precedencia sin_datos > borrador > umbrales funciona).
- [x] **Prompt de la routine sincronizado con la 009** (2026-10-06, pegado a mano en el campo *Instructions*). Ya conoce el valor `borrador` y separa explícitamente los días desviados de los partes sin cerrar, para no contar dos veces la misma jornada. El texto vigente está en [[Routine-Informe-Mensual]].

**Para poner en marcha (pasos manuales, en este orden):**

- [x] **Migración `006_auditoria_datos_ia.sql` aplicada** (2026-09-03), con backfill y trigger verificados.
- [x] Routine creada por API: `Polarier — Informe mensual de auditoría`, id `trig_01TC5ozP9WKPMJiqiGuSz7i3`, cron `23 7 * * *`, modelo Sonnet, conector MCP de Supabase, prompt puesto. **Está deshabilitada** para que no dispare antes de tiempo.
- [x] Conector de Supabase comprobado con una pasada en vacío (2026-09-03): la routine lee la cola con `mcp__Supabase__execute_sql` sin problemas de permisos. Las herramientas de un conector adjunto **no** pasan por la lista `allowed_tools` de la routine.
- [x] Trigger de API añadido y token generado (`sk-ant-oat01-gmJLTP9s…`), y routine **habilitada** (2026-09-03). Primera pasada automática: 2026-09-04 07:23 UTC.
- [x] Edge Function `disparar-informe-mensual` **desplegada** (2026-09-03, versión 1, `verify_jwt: true`) y secretos puestos.
- [x] **Mitad servidor del circuito probada** (2026-09-03, sesión `cse_01YUoAPn4SAteVGN4p71r8Vw`): encolado → routine → informe escrito. Ver detalle en [[Routine-Informe-Mensual]].
- [x] Rama `auditoria/informe-mensual-ia` y **PR #2** hacia `main` (2026-09-03). Lleva el informe mensual + los tres commits de auditoría/chat/agente que nunca llegaron a `main`; **deja fuera la firma del APK**, que sigue en `android/firma-apk-release`.
- [x] **Mergear el PR #2** y comprobar que Easypanel redespliega (el informe mensual está en producción y funciona). Hasta entonces la VPS no tiene el botón: solo estaba en la copia de trabajo local.
- [x] **Mitad cliente probada** (Leo, 2026-10-19: «Generar informe» funciona). Texto original: pulsar «Generar informe» en `/auditoria/historico/2026-08` estando logueado, para ejercitar `solicitarInformeMensual()` → `functions.invoke` → `/fire` con un JWT real. Es el único eslabón sin probar.
- [x] La fila de PRUEBA de agosto 2026 ya no es de prueba: la routine la regeneró con un informe real. Copia del contenido viejo en el scratchpad de la sesión.

**Después:**

- [x] **PDF y correo del informe mensual** (2026-09-03): con el informe hecho salen «Descargar» y «Enviar por correo» en vez de «Regenerar». Reutiliza el PDF y el correo del informe diario vía `src/lib/informeMensual.ts`. Ver [[Routine-Informe-Mensual]].
- [x] **Retirar `monthly_reports.pdf_url`, el bucket `informes-mensuales` y el botón «Abrir PDF»** (Leo, 2026-10-19). El código ya no los usa y la migración `011_retirar_pdf_mensual.sql` quita la columna y la política. No había filas con `pdf_url` ni objetos en el bucket.
- [x] **Migración `011_retirar_pdf_mensual.sql` aplicada** (2026-10-19, registrada como `retirar_pdf_mensual`, a petición de Leo) y **bucket `informes-mensuales` borrado**. Comprobado después: no queda la columna ni la política, quedan solo los buckets `avatars` y `documents`, y el informe que había sigue intacto. El bucket se borró por SQL activando `storage.allow_delete_query` solo dentro de esa transacción y tras comprobar que estaba vacío. Esa es la vía que deja el trigger `protect_buckets_delete`, que existe para no dejar ficheros huérfanos.
- [ ] Añadir hoteles: la routine ya itera todos los hoteles activos; falta la UI de selección de hotel activo (ver también Módulo de Auditoría).
- [x] `getSubmissionHistory` tenía `limit = 60` y `AuditHistory` se quedaba en ~20 días. Subido a 500 en la llamada (2026-09-23), que es lo que ya pedía el dashboard.
- [ ] `AuditMonth` muestra el total de cada parte leyendo `totales.general`, que **no existe en el cuadrador**: esos partes nunca muestran total. `audit_daily.valor` ya lo resuelve bien; sería cuestión de leer de ahí.

## n8n — rama Carla y enrutado de polos (2026-10-05)

- [~] **Rama Carla: DESCARTADA por decision de Leo (2026-10-05); DESACTIVADA el 2026-10-23** (ver sección de la auditoría del 2026-10-23: ahora responde con `Aviso Carla`). Se queda rota en produccion, de forma consciente. El diagnostico completo y lo que haria falta para retomarla estan en [[Integracion-n8n]]. Falla en silencio: quien suba un fichero con `MU` recibe el mensaje de `error3` y no se procesa nada.
- [~] **Borrador `53dec2de-7a48-4c13-8bed-db505eeccd86`: DESCARTADO (2026-10-23, decisión de Leo).** No publicarlo ni restaurarlo: el flujo de Modelo 1 se rediseñó y ya no usa Google Sheets. Además ya no existe, porque la retención del historial lo borró (comprobado con `get_workflow_version`). En producción (`635d49df`) `Switch4` no existe y `Switch5` ya tiene `CA`/`CC`. Texto anterior: **publicado**, comprobado el 2026-10-12, era la versión activa (`versionId = activeVersionId`). No consta que se hiciera la prueba con un `HACP…` y un `CCCP…`; hacerla en cuanto se suban ficheros reales. Texto original: **Publicar el borrador**, que corrige solo `Switch4`/`Switch5`. Diff reverificado el 2026-10-06: las unicas diferencias frente a produccion (`e2fa038a-20c8-46d8-a65f-d470a834c029`) son cuatro valores de comparacion; mismos 142 nodos, mismas conexiones y `Execute Command` identico. Ojo: el cambio de `Switch4` si tiene efecto real (rama Leslie, operativa), pero el de `Switch5` es inerte hasta que se arregle la rama Carla. Prueba antes de publicar: subir un `HACP...` y un `CCCP...` y comprobar que llegan a `Delete rows or columns from sheet3` y `sheet5`, las dos salidas que nunca se habian ejecutado.
- [x] **`Switch4` y `Switch5` corregidos como borrador** (2026-10-05, borrador `f15de71c-8dfa-4705-8fbb-82618bb85f22`, sin publicar). Estaban en modo primera-coincidencia con `contains 'C'`, lo que descartaba en silencio los datos de Habana y metia los de Cayo Coco en la hoja de Cayo Cruz. Ver [[Integracion-n8n]].
- [x] **Revisar con el mismo criterio los demas switch** (comprobado el 2026-10-19): `Switch`, `Switch1` y `Switch6` ya no existen. Quedan `Switch3` (enrutado del chat) y `Switch5` (rama Carla, rota a propósito, con `HA`/`VA`/`CA`/`CC`/`CX`/`HO`), y en ninguno hay un valor contenido en otro. Texto original: (`Switch`, `Switch1`, `Switch3`, `Switch6`): que ningun valor de regla sea subcadena de otro, dado que operan en primera-coincidencia.
- [x] ~~**`Switch6` le falta la regla de Holguin**~~ — el nodo ya no existe (comprobado el 2026-10-19). (5 salidas en vez de 6); hoy Holguin va por `If4` → `Edit Fields5`. Decidir si se unifica con `Switch1`.
- [x] ~~**Los 12 nodos `Delete rows or columns from sheet*`**~~ — ya no existen (comprobado el 2026-10-19). usan `numberToDelete` con valores que desbordan INT32 (999999999999 y mas). Tres de ellos ya fallaron con 400 de la API de Sheets.
- [x] ~~**`Update file1` da 404**~~ — el nodo ya no existe (comprobado el 2026-10-19).: el fichero de Drive `1gT30p99...` ("GLOBAL-CP26") no existe o no es accesible.
- [x] **Migrar 1 nodo Code a `$input`** — **hecho y publicado el 2026-10-23** (`c863623d`; el nodo quedó desactivado con su rama en `714ae296`): `Code in JavaScript3` ya usa `$input.all()`; no queda ningún nodo con la global `items`. (comprobado el 2026-10-19): solo queda `Code in JavaScript3` (rama `Integral`, que no se usa) con la global legacy `items`; los otros cuatro ya no existen. Texto original: `Code in JavaScript`, `2`, `3`, `6` y `7` usan la global legacy `items`. Funciona en 2.33.4, pero hay que hacerlo antes de cualquier salto a n8n 3.x.
- [x] **Quitar la service_role key de Supabase hardcodeada** — (comprobado el 2026-10-19): ningún nodo lleva ya claves en claro; `HTTP Request` y `HTTP Request8` usan la credencial `supabaseApi`. Texto original: en el header `apikey` del nodo `HTTP Request` de `Polarier Auto App`. Salta RLS.

## n8n — auditoría del 2026-10-23 (auditada `635d49df`; activa ahora `714ae296`)

Detalle en [[Integracion-n8n]] y en `C:\Trabajo\Hostinger Manager\n8n-baseline-2026-10-05.md`. Todo lo de esta sección quedó aplicado y **publicado el 2026-10-23** (OK de Leo) como `714ae296-da7c-47f5-8c6b-7840260d9673`; antes `c863623d`. Verificado: `versionId = activeVersionId`, activo, 4 triggers (`Webhook`, `WH Modelo 1`, `WH Tabla CA`, `CON - Webhook`), 130 nodos, `errorWorkflow = hklSpbbHKf38PaJq`.

- [x] **Rama Ocupación DESACTIVADA (decisión de Leo 2026-10-23: no se usa).** 8 nodos desactivados: `WH Ocupacion` (su URL deja de existir), `OC - Descargar`, `Extract from File1`, `Code in JavaScript3`, `Append row in sheet`, `Limit1`, `Download file`, `Respond to Webhook1`. `Aviso Ocupacion` (chat, `Integral…`) ahora dice que la automatización está desactivada. Antes, ese mismo día, se había corregido y publicado (`c863623d`) el error de sintaxis de `Code in JavaScript3` (`let a?o` → `anio`, `Caibarién`, columna ` DIA EN EL AÑO ANTERIOR`): queda listo por si se reactiva, sin probar con un `Integral…` real. Para reactivar: volver a activar los 8 nodos y restaurar el texto de `Aviso Ocupacion`.
- [x] **Rama Carla DESACTIVADA (decisión de Leo 2026-10-23).** 13 nodos desactivados (`Read/Write Files from Disk`, `Switch5`, los 6 `*MUS*`, `Execute Command`, `error3`, `Read/Write Files from Disk1`, `Respond to Webhook`, `Respond to Webhook2`). Se cortó `Switch3`[Carla] → `Read/Write Files from Disk` y ahora va a un nodo nuevo `Aviso Carla` → `Responder aviso` (si no, el webhook se quedaría sin respuesta). Sigue rota por dentro; para retomarla ver [[Integracion-n8n]].
- [x] ~~**Autenticar los 5 webhooks**~~ — **descartado por Leo 2026-10-23: la app tiene autenticación propia.**
- [x] **Salida de error en `HTTP Request8`** — hecho: `onError = continueErrorOutput` → nodo nuevo `Descarga - Error` → `Responder aviso`, con el motivo. La app ya no recibe un 200 vacío si falta el fichero. `OC - Descargar` no se tocó porque su rama está desactivada.
- [x] **Error Workflow** — creado y publicado «Polarier · Avisos de error» (`hklSpbbHKf38PaJq`, carpeta Polarier): Error Trigger → Gmail «Gmail Quantic» a Leo y un segundo responsable (direcciones en el propio nodo Gmail), con el nodo, el error y el enlace a la ejecución. Si el nodo es `Normalizar GLOBAL`, `Cargar en global_ai`, `CD - Resumir para Supabase` o `CD - Cargar en tabla_ca_meses`, el asunto dice «Falló la sincronización con Supabase». Asignado como Error Workflow de «Polarier Auto App». Avisa de cualquier ejecución de producción fallida, no solo de la sincronización. **Prueba del 2026-10-23 (ejecución 572): FALLÓ porque la credencial «Gmail Quantic» está caducada** → ver pendiente siguiente.
- [x] **Hecho (2026-10-26): «Gmail Quantic» reconectada** — prueba del aviso, ejecución 573 OK; «Emails», 574 y 590 `SENT`. Texto original: **Reconectar la credencial «Gmail Quantic» (`7kBjPaDgbooOLT3C`) en n8n** (Credentials → Reconnect, con la cuenta de Google de Quantic; lo hace Leo). Detectado el 2026-10-23 en la prueba del aviso (ejecución 572: «The credential "Gmail Quantic" needs to be reconnected»). Mientras tanto **no salen los avisos de error** y **probablemente tampoco los correos de la app («Emails»)**, que usa la misma credencial (sin comprobar). Después: repetir la prueba del aviso (añadir temporalmente Manual Trigger + datos de prueba en «Polarier · Avisos de error», ejecutar y quitarlos; el Error Trigger no se puede lanzar a mano) y comprobar un envío de «Emails».
- [x] **Limpieza menor** — hecho: eliminados `Transcribe a recording1` (huérfano) y la nota vacía «REVISAR ESTA HISTORIA»; `Text Classifier` con `fallback = other` → `Respond to Webhook3` (si no clasifica, responde como texto); `error5` (fallo de Benjamin) ahora incluye el detalle. `error3` no se tocó (rama Carla, desactivada).

## Limpieza y reglas de documentos (plan del 2026-10-12)

Reglas en [[Generacion-Documentos]]. No se tocan: la rama Carla, la rama `Integral` ni los borradores `My workflow 2/3/4` y `My Sub-Workflow 1`.

**Fase 1 — Reglas escritas**
- [x] Nota [[Generacion-Documentos]] + puntero en CLAUDE.md + incoherencias del vault corregidas.

**Fase 2 — Limpieza de n8n** (`c60c4bce-0aaa-4bfb-bf58-4f8d7a763c63` **publicada** el 2026-10-12 con el OK de Leo; antes, `53dec2de`)
- [x] `HTTP Request` y `HTTP Request8` descargan de Storage con la credencial `supabaseApi` «Polarier» (`a0l4Y70xe5eaZYNH`, comprobado con una sonda que es service_role). Se quita la service_role key que iba escrita a mano en el header `apikey`. Descarga comprobada con otra sonda: el PDF baja completo.
- [x] `Search files and folders` (rama ZIP) ya solo busca `GLOBALCP-26` dentro de la carpeta «Modelo 1» (`1QRhYDffKNfDikZZdspFZf1YTDIzFXTME`). Antes buscaba `GLOBAL` en **todo** el Drive y `Delete a file` borraba todo lo que encontrara.
- [x] `Code in JavaScript2` y `7`: `items[0]` → `$input.first()`. **No eran 5 nodos sino 3:** en `Code in JavaScript` y `6` la palabra `items` solo salía en un comentario. `Code in JavaScript3` se deja con `items` porque está en la rama `Integral`, que no se toca.
- [x] Wisin: sin meses fijos; el periodo es AAAA-MM con el año que diga el usuario o, si no lo dice, el actual (`$now`). Probado con el chat de prueba `prueba-claude-2026-10-12`: Varadero, marzo de 2026 → 5.971.811,58 CUP, igual que en `global_ai`.
- [x] ~~`numberToDelete` fuera de INT32~~: **ya estaba corregido** en producción (los 12 nodos usan `9999`).
- [x] **Publicado** `c60c4bce` (2026-10-12). Prueba de humo contra la URL de producción: HTTP 200 y respuesta del agente.
- [x] **Benjamin también tenía fijo «Actualmente el Global tiene datos de enero y febrero 2026»** y contestaba «no disponible» **sin consultar a Wisin**. Corregido y **publicado** como `c840d9a2` (2026-10-12). Prueba en producción (Cayo Coco, febrero de 2026 → 9.582.183 CUP) coincide con `global_ai`.
- [x] **Bucket `documents` cerrado** (2026-10-12, con el OK de Leo). Antes se comprobó que nada dependía de las URLs públicas: la app solo usa URLs firmadas, no hay ninguna URL pública guardada en `chat_messages`, `documents`, `document_chunks` ni `form_submissions`, y los dos nodos de n8n que leen el bucket ya usan credencial. Verificado después: una URL pública sin sesión da 400; n8n descarga con su credencial (sonda: PDF completo, 84.263 bytes). Matiz: el CDN puede seguir sirviendo hasta 1 h (`max-age=3600`) una URL pública que alguien pidiera justo antes del cierre. **No se pudo revisar** «chatbot multimensajes» ni «My workflow» (no son legibles por el MCP): si alguno leía `documents` por la URL pública, ahora fallará.
- [x] **API key de n8n Cloud en el historial del repo público** (T-99bb9d80c0) — **cerrado el 2026-10-26.** Entró en `486b1c2` dentro de `.claude/settings.local.json` y se quitó en `55c93b0`, pero sigue en el historial. Era de la instancia **n8n Cloud `automate-cuba24`** (sigue viva, `/healthz` → 200), no del self-hosted. Leo la **revocó** en Settings → n8n API; no se creó otra porque nada del proyecto usa la API de esa instancia. `.claude/settings.local.json` fuera del índice y en `.gitignore` (`2ae7a7e`). Antes del push se reescribieron los commits locales sin subir para no publicar el Gmail personal de un segundo responsable (autorizado por Leo).
- [x] **Rotar la service_role key** (T-a15c2a26f0 / A-cdad7adf0d) — **cerrado el 2026-10-26.** Las legacy no se podían rotar, así que se migró: n8n («Polarier») a una secret key `n8n`, la app (`polarierapp`, Build Arg `VITE_SUPABASE_ANON_KEY`) a la publishable `default`, la Edge Function `disparar-informe-mensual` a la publishable con `verify_jwt = false` (versión 6); claves legacy `anon` y `service_role` **desactivadas** (18:01 UTC) y **secreto JWT HS256 revocado** (el proyecto ya firmaba las sesiones con la clave ECC `206a0c8f…`). Comprobado: la anon antigua como `apikey` → 401 y un JWT HS256 como `Bearer` → 401 (REST) / «signature verification failed» (Storage); app, n8n y la función siguen dando 200. Detalle y orden seguido en [[Rotacion-Claves-Supabase]]. Sin revisar: los workflows de n8n no legibles por el MCP (si alguno usaba este proyecto con las claves antiguas, ahora falla). **Workflows no legibles revisados (2026-10-26, T-31150c4873):** con «MCP access» activado, `chatbot multimensajes` (`XtGbAdBxfI10sC3S`) solo usa las tablas `clientes` y `mensajes`, que no existen en Polarier, así que no es este proyecto; `My workflow` (`pxemOGf2sGwKSjch`) ya no está en la instancia, y los otros 5 sin MCP están inactivos. **«Mr. Volant» comprobada: no es este proyecto** — con ella, listar tablas da «The connection cannot be established… incorrect host», mientras que con «Polarier» sale la lista de tablas de Polarier; la cuenta de Supabase solo tiene Polarier y MercadoMVP. En los logs desde las 18:01 (desactivación) no hay ningún 401 de consumidores desconocidos, solo las pruebas con `curl` y una de la Edge Function durante la rotación.
- [x] **Credencial «Gmail Quantic» (`7kBjPaDgbooOLT3C`) reconectada** por Leo (2026-10-12), después de que la ejecución 429 fallara. Envío de prueba a `leodev0211@gmail.com` desde producción: OK.
- [x] **«Emails» respondía 200 aunque fallara el envío.** **Publicado** (2026-10-12, versión `0eaa41b2`): si falla Gmail, `Send a message1` sale por error y el nodo `Responder error` devuelve **502** con `{ok:false,error}`; se probó primero con 502, pero **el proxy de Easypanel sustituye los 502 por su página HTML «Service is not reachable»**, así que se dejó en **500**. Comprobado contra producción: `HTTP 500 {"ok":false,"error":"Invalid email address (item 0)"}`. El mismo cambio añade **`replyTo = body.remitente`**. Probados los dos caminos: destinatario inválido → `Responder error`; envío real → `SENT`. 
- [x] Correo migrado al self-hosted en el lado app: `.env` local y `DEPLOY.md` apuntan a `polarierauto-n8n…/webhook(-test)/19a7f802-…` (mismo path que en cloud).
- [x] **En Easypanel:** cambiar los Build Args `VITE_N8N_EMAIL_WEBHOOK_URL` y `_TEST` al host `polarierauto-n8n.1tn4v0.easypanel.host` y pulsar **Deploy**. Hasta entonces, la app desplegada sigue enviando por n8n cloud.
- [x] ~~El webhook de correo no tiene autenticación~~ — **descartado por Leo 2026-10-23: la app tiene autenticación propia** (mismo criterio que los webhooks de «Polarier Auto App»). (**sigue igual (comprobado el 2026-10-19):** «Recibir Informe» no pide credenciales): cualquiera que conozca la URL puede mandar correos con adjunto desde la cuenta de Quantic. Pasa igual en el de cloud. Un secreto en `VITE_*` no sirve (acaba en el bundle); la vía buena sería que la app llame a una Edge Function que firme la petición.
- [ ] «Emails» no está en la carpeta Polarier de n8n (está en la raíz del proyecto; sigue igual (comprobado el 2026-10-19)).

**Fase 3 — Global → Supabase** (rama `n8n/fase3-sync-global-ai`)
- [x] **Script `vps/Polarier/Leslie/sync_global_ai.py`** (versionado en el repo y subido al VPS, SHA-256 `cb7abd3d…` comprobado). Evalúa las fórmulas del GLOBAL, que `Modelo1.py` deja sin valor cacheado al guardar con openpyxl. Un mes cuenta como cargado solo si «Ventas Totales» (código 1) tiene plan o real: así los meses futuros de la plantilla no entran como ceros. Dentro de un mes cargado, la semántica es la de Excel (un SUM sobre celdas vacías da 0), igual que el importador original. Solo lee: imprime JSON.
- [x] **Migración `010_sync_global_ai.sql`** escrita: tabla `global_ai_catalogo` (136 códigos sembrados desde `global_ai`, porque la jerarquía no se deduce de la sangría) y función `sync_global_ai(payload)`, que reemplaza las hojas en una transacción y aborta si una hoja llega con menos de 20 filas. Solo `service_role`. **Validada en una transacción revertida:** reinyectando las 2.313 filas actuales, ningún `row_uid` perdido y ninguna fila cambiada.
- [x] **Ejecución en seco en el VPS:** 3.436 filas, con real de enero a agosto en LH, CA y HOL, enero a julio en VAR y CCZ, y en CC enero a junio + agosto. Enero a marzo coinciden al céntimo con lo cargado el 30-ago en VAR, LH y CCZ.
- [ ] **Hueco de datos: Cayo Coco no tiene julio de 2026 en el GLOBAL.** No se ha subido el `CCCP202607`.
- [ ] **Ventas a 0 con costes cargados.** En el propio GLOBAL, Holguín tiene la venta de Lavandería **en blanco** en abril, junio y agosto, y Cayo Cruz tiene «Ventas Totales» a 0 en marzo y de mayo a julio, mientras los gastos de esos meses sí están. O no hubo ventas, o esos PDF no traían la línea de ventas y `Modelo1.py` no la escribió. Revisar contra los PDF originales. No es un fallo de la sincronización: el Excel dice eso.
- [x] **Migración 010 aplicada** (2026-10-12, registrada como `sync_global_ai`).
- [x] **Primera carga completa** (2026-10-12): 2.313 filas → **3.436**, de 2026-01 a 2026-08. Aparecieron dos códigos que no estaban en la carga original, **90 «Materiales de Animación»** y **91 «Consumo e Insumo de Medicamentos»**. Se añadieron a mano a `global_ai_catalogo` bajo *Gastos indirectos › Materias Primas y Materiales* (misma sangría que 86–89) y se repitió la carga: ningún código sin catálogo y ninguna fila sin grupo.
- [x] **`global_ai_respaldo_20261012` borrada** (2026-10-12, con el OK de Leo, tras mergear el PR #9). Antes se comprobó que era la copia (2.313 filas) y que nada dependía de ella.
- [x] **Publicado `fd8ebf76`** de «Polarier Auto App» (2026-10-12). Prueba en producción: Varadero, julio → 8.750.471,33 CUP, y la comparativa de mayo entre los seis polos coincide con `global_ai`. Incluye:
  - nodos `Normalizar GLOBAL` → `Cargar en global_ai` detrás de `Respond to Webhook6` y `Respond to Webhook7`, después de vaciar el Sheet;
  - herramientas de Wisin sin `anio=eq.2026`, `dato_exacto` filtrando por `partida_key`, `comparar_partida` comparando entre polos de verdad (antes filtraba por un solo polo) y `polo_periodo` con límite 200 (Varadero tiene 120 partidas en enero).

**Fase 4 — TABLA CA con agente** (en producción; versión activa de «Polarier Auto App»: `a5d9424d`, 2026-10-14)
- [x] Regla en `Switch3` → `Agente TABLA CA` (Claude Sonnet 5.5) con herramientas sobre `Leslie/CD/agente_ca.py` → respuesta JSON con el resumen y la tabla. Diseño y mapa en [[Generacion-Documentos]] (D2).
- [x] App: una respuesta JSON con `archivo` (base64) se pinta como texto + tarjeta de descarga (PR #11).
- [x] **Mapa rehecho con datos reales** (2026-10-14): seis CA de abril de 2025 (`C:\Users\Leo\Desktop\CA`) y TABLA CA 2026. Ficheros `<POLO>CA<AAAAMM>` (antes se esperaba `CD`). Las cifras económicas salen de las filas del GLOBAL que enlaza la tabla, hay químicos por producto, transporte con el criterio de cada polo y avisos deterministas. Validado con `validar_mapeo.py` (151/168 y 219/246; los químicos, 100 %).
- [x] **`agente_ca.py` subido al VPS** (2026-10-14, ejecución 476 del flujo temporal ya archivado): descargado de GitHub fijado al commit `89a708b`, SHA-256 `a8b158eb…`, igual que el del repo. El runner acepta `CACA202604` y lee del GLOBAL un VAB de abril de 2026 de Caibarién (−1.591.000,95) idéntico al de la TABLA CA 2026.
- [x] **`TABLA CA 2026.xlsx` en el VPS** (2026-10-14, ejecución 480, flujo temporal archivado): Leo la subió al chat y se copió de Storage a `/data/Polarier/Leslie/CD/` (1.461.415 bytes, igual que el original). `estado_tabla` la lee bien: las 28 claves con fila, las fórmulas detectadas y los 15 químicos.
- [x] **Publicado** (2026-10-14, versión activa `427e5f14`) el borrador de «Polarier Auto App» (6 operaciones sobre el autoguardado `e09b8068` del editor). Incluye:
  - `Switch3` «Leslie CA» acepta `CA` y `CD` sin distinguir mayúsculas;
  - `escribir_tabla` acepta `quimicos`;
  - prompt nuevo.
  - **Al publicar entran también los cambios del editor de Leo:** nota adhesiva.
  - [x] **Modelo 1 y Comprimido no quedaron en `caseSensitive: true`** (verificado el 2026-10-19 en el flujo vivo, misma versión activa `9d0654b9…` del 2026-10-15). Aquí se dio por hecho que ese publicado dejaba esas dos reglas de `Switch3` distinguiendo mayúsculas, y de ahí el ejemplo de que un `VACP202601.PDF` en mayúsculas ya no entraría por Modelo 1. No se sostiene: las dos están en `caseSensitive: false` (igual que «Leslie CA»; solo «Carla», «Raydel» e «Informe» están en `true`), y el autoguardado posterior del editor las tiene igual. El ejemplo tampoco se cumple: con `false`, n8n pasa el nombre a minúsculas y el patrón de Modelo 1 ya está en minúsculas y termina en `\.pdf$`, así que `VACP202601.PDF` sí entra por Modelo 1.
  - [x] **La rama «Informe» no estaba quitada** (verificado el 2026-10-19 en el flujo vivo). Aquí se dio por hecho que ese publicado había dejado la salida «Informe» de `Switch3` sin conectar, de modo que un fichero con «Informe» en el nombre no recibiría respuesta. No se sostiene: en la versión activa (`9d0654b9…`, 2026-10-15) esa salida va a `Supabase Vector Store2` (insert sobre `document_chunks`, con sus nodos de embeddings y de carga de documentos) y de ahí a `Respond to Webhook10`. El autoguardado posterior del editor también la tiene conectada, así que publicar no la quita. La sección D5 de [[Generacion-Documentos]] es la correcta.
- [x] **Re-subir un CA no reescribe nada** (PR #13, versión `373eb792`). El escritor deja en `sin_cambios` las celdas que ya tienen ese valor y solo guarda (y respalda) si algo cambia. El resumen añade la línea «Sin cambios (N)». Decisión de Leo.
- [x] **Arreglo del enrutado** (versión `a4b17be8`). Los CA caían al chat general («No puedo acceder directamente a archivos subidos»), con cualquier nombre, incluso los `CD` antiguos.
  - Causa: con `caseSensitive: false`, n8n pasa a minúsculas el nombre del fichero pero no el patrón, y el regex estaba en mayúsculas.
  - Arreglo: el patrón va en minúsculas, `^(lh|ha|va|ca|cc|ccx|cx|ccz|hol|ho)c[ad]…`.
  - Probado en un flujo temporal, ya archivado: `HOCA202504`, `CACA202504`, `hoca202504` y `CACD202609` van a la salida 5; `TABLA CA 2026.xlsx`, al fallback.
- [x] **Primera prueba real** (ejecución 486, `CCCA202504.xlsx`, Cayo Coco, abril de 2025, contra la TABLA CA 2025 del servidor). De punta a punta en 28 s.
  - Escribió CDT y CDO (74,22 y 81,42, antes 74,21 y 81,4) y 6 químicos vacíos a 0.
  - El resto, «sin cambios».
  - No escribió el agua (386 en el CA frente a 3860 en la tabla) y lo avisó.
  - No tocó ninguna fórmula y las contrastó con el CA.
- [x] **GLOBAL de años cerrados** (PR #14). En esa prueba no encontró `GLOBAL-CP25.xlsx`.
  - Ahora `agente_ca.py` lo busca como `agente_modelo1.py`: `Leslie/`, después `Leslie/Leslie Global <año>/` y `/data/Polarier/Leslie Global <año>/`, y por último la copia antigua de `CD/`.
  - En el VPS (ejecución 487, SHA-256 `32f3a186…`), el VAB de Cayo Coco de abril de 2025 sale 12.882.523,02, igual que en la tabla.
- [x] **El mensaje del chat solo lleva los avisos** (versión `a5d9424d`, petición de Leo). Va el título «TABLA CA <año> · <polo> · <mes>» y debajo una línea por aviso, o «Sin avisos.». Ya no lista lo escrito ni lo que quedó sin cambios (se ve en el Excel), ni las filas con fórmula. Prompt en `n8n/agente-tabla-ca/prompt-sistema.txt`.
- [x] **Coste medido:** unos 0,075 $ por CA. La ejecución 486 hizo 2 llamadas al modelo: 25,8k tokens de entrada y 2,3k de salida en Sonnet 5.5, a 2 $ y 10 $ por millón. Un CA que obligue a revisar varias hojas puede llegar a 15–20 céntimos: con 6 polos, menos de 1 $ al mes. Haiku 5.5 costaría unas 20 veces menos, pero detecta peor incoherencias como la del agua, así que se mantiene Sonnet.
- [x] **Tabla destino** (confirmado por Leo): en producción solo llegarán CA de 2026, que van a TABLA CA 2026, bloque «AÑO ACTUAL», hoja del polo y columna del mes. Es lo que ya hace el agente, que elige la tabla por el año del nombre del fichero. Los CA de 2025 de prueba escribieron en la TABLA CA 2025, una copia antigua que queda en el servidor.
- [x] **TABLA CA 2025 restaurada** (ejecución 491, flujo temporal archivado) desde `respaldos/TABLA CA 2025 20261014-180952.xlsx`, tomado justo antes de la prueba 486. Comprobado: abril de Cayo Coco vuelve a CDT 74,21 y CDO 81,4, con los 6 químicos vacíos. La versión que dejó la prueba está guardada como `CD/TABLA CA 2025 antes-de-restaurar 20261014.xlsx`; se puede borrar.
- Ojo: n8n **no puede escribir en `CD/respaldos/`** (EACCES; la carpeta la crea el pythonrunner). Un flujo de n8n solo puede leer de ahí; cualquier copia que haga n8n va a `CD/`.
- [ ] Prueba con un CA de 2026 cuya columna esté vacía en la tabla (escritura real de un mes nuevo) y con el de Holguín (46 MB). La segunda subida de Leo del 2026-10-14 no llegó a n8n.
- [ ] Decidir si el agente rellena también **PLAN TURISTAS DÍAS** y **PRODUCTIVIDAD**, que en el bloque del año son celdas de valor. Hoy no se tocan: el plan del CA no coincide con el de la tabla en Cayo Cruz y La Habana, y la productividad de la tabla no sale de ningún dato del CA que se haya podido identificar.
- [ ] Retirar `Leslie/CD/rellenar_ca.py` del VPS.

**Fase 5 — Agente Modelo 1** (2026-10-14; sustituye a la rama CP, a la rama ZIP y a `Modelo1.py`; diseño en [[Generacion-Documentos]], D1)
- [x] `vps/Polarier/Leslie/agente_modelo1.py` con los comandos `preparar`, `ver_filas`, `ver_pdf`, `ver_global`, `escribir`, `verificar` y `cerrar`. Probado en local con los 5 PDF reales del escritorio (`Modelos 1`) contra copias del GLOBAL-CP25 y el GLOBAL-CP26:
  - lee los tres maquetados sin ninguna fila dudosa y coincide al céntimo con lo ya cargado;
  - detecta el texto oculto y el nombre de fichero engañoso;
  - rechaza otro polo y los duplicados;
  - la verificación detecta descuadres en cascada.
- [x] Prompt y operaciones de n8n en `n8n/agente-modelo1/`:
  - `operaciones-fase1.json` (55 operaciones) añade la rama `M1 - *` y el agente, cambia `Switch3` (salidas «Modelo 1» y «Comprimido») y hace que `Normalizar GLOBAL` reciba la ruta del GLOBAL escrito;
  - `operaciones-fase2.json` borra los 87 nodos de las ramas CP y ZIP viejas.
- [x] **Operaciones aplicadas** el 2026-10-14 con el OK de Leo: borradores `2bb641b9` (fase 1) y `0cc3900d` (fase 2). «Polarier Auto App» pasa de 160 a 91 nodos. **Sin publicar**: producción sigue en `10f491eb`. El borrador también lleva la rama CD de la fase 4, así que **publicar una cosa publica la otra**.
- [x] **Sonda del pythonrunner** (ejecución 473, después archivada): Python 3.12.13 y solo `openpyxl` 3.1.5.
  - **No hay `pypdf`** ni otra librería de PDF.
  - **No hay nada que abra RAR**: ni `rarfile`, ni `unrar`, `unar`, `bsdtar` o `7z`.
  - En `/data/Polarier/Leslie/` hay `GLOBAL-CP26.xlsx`, `Modelo1.py`, `sync_global_ai.py` y `CD/`.
- [x] **Script y `pypdf` en el servidor** (2026-10-14, ejecución 474 del flujo temporal «DIAG - Despliegue Agente Modelo 1», ya archivado):
  - `/data/Polarier/Leslie/agente_modelo1.py`, SHA-256 `5dd0eadf…997b`, igual que el del repo;
  - `/data/Polarier/Leslie/pypdf-6.10.2-py3-none-any.whl`, el wheel oficial de PyPI, con SHA-256 `aa53be98…24aa` comprobado contra el que publica PyPI. Python lo importa sin descomprimir.
  - Para comprobar una subida: `agente_modelo1.py version`.
  - La primera copia del servidor se subió con finales de línea CRLF (`5dd0eadf…`). Desde el 2026-10-15 el servidor tiene la del repo, en LF: `6fd08ba7…`, con el arreglo de `.PDF` en mayúsculas.
  - El runner ve la carpeta en `/data/Polarier/Leslie`, la misma ruta que n8n.
  - Si algún día se instala `pypdf` en la imagen del runner, se usará ese y el wheel sobra.
- [x] **RAR:** Leo desplegó `vps/pythonrunner/pythonrunner-upload.zip` el 2026-10-14. El runner se creó subiendo un ZIP y no tiene otra forma de cambiarse: ver `vps/pythonrunner/README.md`.
  - Ahora lleva `bsdtar` 3.7.4 y `pypdf` 6.10.2 instalados en la imagen, y Python 3.12.15.
  - Comprobado con la ejecución 475 del flujo «DIAG - Prueba RAR Modelo 1» (ya archivado): un RAR5 con un PDF sintético de Cayo Coco, Octubre/2025, pasa por `preparar`. Lo desempaqueta, lee las 2 filas sin dudas, encuentra `GLOBAL-CP25.xlsx` (hoja `CCCP2025`, columnas AP/AQ) y ve que los valores ya coinciden. `cerrar` borró el lote.
- [x] App con el soporte de `archivo` en JSON desplegada (PR #11 en `main`, 2026-10-14).
- [x] **Publicado** el 2026-10-14 por Leo: versión activa `57fca139`, idéntica al borrador `0cc3900d`. Con ella sale también la rama de la TABLA CA, que fallará con un mensaje de error hasta que estén en el servidor `agente_ca.py` y `TABLA CA 2026.xlsx`.
- [x] **Prueba real en el chat** (2026-10-15, hecha por Claude con la sesión de Leo en `app.automate-polarier.tech`):
  - **Material.** Los 6 Modelos 1 de febrero (`Escritorio/Modelos 1 Febrero`). Eran de 2025, así que se usaron copias con la fecha cambiada a 2026, el año actual. Contra el GLOBAL-CP26 de Leo con febrero borrado en las 6 hojas de polo.
  - **Primer intento, ejecución 495: no escribió nada.** Dos fallos:
    1. `desempaquetar` listaba con `glob("*.pdf")`, que en Linux distingue mayúsculas: del ZIP solo vio el único `.pdf` en minúsculas.
    2. La descripción de `$fromAI` en `escribir_global` llevaba `{"real": 634684.44}}`. Ese `}}` cerraba la expresión de n8n y la herramienta fallaba siempre con «invalid syntax».

    Los dos se arreglaron: script `6fd08ba7…` subido al servidor y versión `9d0654b9` publicada.
  - **Segundo intento, ejecución 497: correcto.** 6 PDF, cada uno en su polo y en febrero de 2026. 612 celdas (102/102/102/108/98/100), 34 fórmulas conservadas por hoja, «revisión correcta» en las seis. Además avisó de que los nombres de La Habana y Holguín dicen 2025 y el contenido 2026. Tardó 31 s. El GLOBAL devuelto es **idéntico celda a celda** al que da el mismo script en local, y no cambia nada fuera de febrero (columnas I y J). Copia en `Escritorio/Modelos 1 Febrero/GLOBAL-CP26 devuelto por el agente (prueba).xlsx`.
  - **Restaurado después:** `GLOBAL-CP26.xlsx` original (`08e97809…`) y `global_ai` resincronizado (3.436 filas de 2026, igual que antes). La copia `Leslie/GLOBAL-CP26 antes-prueba-m1 20261015.xlsx` se borró el mismo día (ejecución 499, tras comprobar que era idéntica al GLOBAL restaurado). En `Leslie/respaldos_global/` quedan los respaldos que hizo el agente durante la prueba.
  - **Gotchas:**
    - n8n no puede sobrescribir ficheros que creó el runner, porque son de root (`EACCES`). Para cambiar un maestro escrito por Python hay que usar el runner.
    - Un Modelo 1 de prueba **sincroniza `global_ai`**, así que restaurar el GLOBAL no basta: hay que volver a sincronizar.
- [x] **Prueba de un PDF suelto, de un mes ya cargado** (2026-10-15, ejecución 500, con el OK de Leo para escribir en producción):
  - `VAM-1.PDF` original (Varadero, febrero de 2025) entró por la regla nueva de `Switch3` y fue al GLOBAL-CP25 real, hoja `VARCP2025`.
  - Los 98 valores ya coincidían y no se sobrescribió ninguno.
  - **4 fórmulas no cuadraban** (plan de 001, 050, 196 y 207: I6, I47, I179 e I186). Se sustituyeron por el valor del PDF, que es la regla de ±1 CUP. En las cuatro sobran 27.000, el plan del 047.
  - El agente avisó además de que el acumulado del 047 (plan) no cuadra: el GLOBAL suma 27.000 y el PDF acumula 54.000, así que falta el plan de enero.
  - Hay copia previa en `Leslie/respaldos_global/` y se resincronizó `global_ai` de 2025. Fue igual que el ensayo local.
- [x] **GLOBAL-CP25: 045 y 047.** Se corrigió el 2026-10-15 en la ejecución 502 y **se deshizo el mismo día** (ver la entrada «GLOBAL-CP25 devuelto a su estado de antes de la prueba»). El análisis sigue siendo válido.
  - **Las fórmulas estaban bien.** El fallo era de datos: en el primer trimestre de 2025 el **plan del 047** («Ventas por Servicios a Trabajador») estaba en la fila del **045** («Ingreso por sobrante de bienes»), y desde abril ya está en su fila. Así lo confirman los PDF de febrero de los seis polos: no traen el 045, salvo el real de Caibarién, y el acumulado del 047 es el doble del mes.
  - **Qué se cambió.** En La Habana (26.000), Varadero (27.000), Cayo Cruz (15.000), Holguín (19.600) y Caibarién (41.900,83 y 48.347,11), el plan de enero a marzo pasó de la fila 43 a la 44. El real del 045 de Caibarién se queda, porque el PDF lo trae. Cayo Coco estaba bien. En febrero de Varadero se volvieron a poner las fórmulas de I6, I47, I179 e I186, que ahora dan lo que dice el PDF.
  - **Cómo se hizo.** Con un script del runner, que antes de escribir comprobaba el valor esperado de cada una de las 33 celdas. Copia previa en `Leslie/respaldos_global/GLOBAL-CP25_20261015_171218_antes-045-047.xlsx`. `global_ai` de 2025 se resincronizó y tiene 12 filas menos, una por polo y mes en los que el 045 se ha quedado vacío.
  - **Comprobación.** Antes de aplicarlo, en una réplica local, los 6 PDF de febrero pasaron por el agente: ya no hay avisos de acumulado del 045 ni del 047, ni sustituciones de fórmulas en Varadero.
  - **Otros dos descuadres que se analizaron y no se tocaron:**
    - **Holguín** (resuelto el 2026-10-19, ver abajo): el plan del **186** «Cancelación de Pérdidas y Faltantes» (416,66 al mes) está en la fila del **195** «Otros» de enero a junio. El PDF de febrero trae el 186 y no el 195; su acumulado da 416,66 también en enero. El 175 suma las dos filas, así que hoy cuadra, pero al pasar el PDF los 416,66 quedan dos veces.
    - **Cayo Cruz:** el plan de **110** (impuesto sobre nómina) y **111** (seguridad social) del primer trimestre supera al PDF en 10.000 y 28.000. Es el 5 % y el 14 % de 200.000, así que parece calculado sobre 200.000 más de salario. Enero y febrero los confirma el PDF; marzo sigue el mismo patrón.
- [x] **GLOBAL-CP25 devuelto a su estado de antes de la prueba** (2026-10-15, ejecución 505). Leo lo pidió así: la prueba era solo para comprobar que el agente funcionaba.
  - Se restauró la copia que hizo el agente antes del `VAM-1.PDF`, `respaldos_global/GLOBAL-CP25_20261015_165023_099205.xlsx` (SHA-256 `0c4be9eb…`). Así se deshacen la prueba (4 fórmulas y 4 celdas de febrero de Varadero) y la corrección del 045/047.
  - Antes de restaurar se comprobaron las 33 celdas distintas, todas esperadas. El estado intermedio quedó en `GLOBAL-CP25_20261015_184942_antes-de-restaurar.xlsx`.
  - `global_ai` de 2025 se resincronizó y tiene 5.421 filas, igual que antes.
- [x] **Restos de las pruebas borrados** (2026-10-15, a petición de Leo):
  - de Storage (`documents`), los 6 ficheros: los 4 subidos al chat y los 2 GLOBAL que devolvió el agente; ejecución 506;
  - sus 6 filas de `documents`;
  - las 3 conversaciones de prueba con sus mensajes;
  - los 2 mensajes del GLOBAL sin febrero que cayeron en la conversación de la TABLA CA, que conserva sus otros 12;
  - las entradas de esas conversaciones en `n8n_chat_histories`;
  - la copia del GLOBAL devuelto que se dejó en el escritorio de Leo.

  En el VPS siguen las copias de `Leslie/respaldos_global/`, que el agente rota solo.
- [x] **Segunda prueba por el chat, 5 PDF de «Modelos 1»** (2026-10-19, ejecuciones 507–511, a petición de Leo).
  - **Los PDF:** Cayo Coco, Cayo Cruz, La Habana y Holguín de octubre de 2025, y Varadero de enero de 2026. Los nombres `CXCP202610.pdf` y `HOCP202611.pdf` dicen 2026, pero el contenido es de 2025, y el de Holguín se editó con PyPDF2 y lleva fechas ocultas. El agente se guió por el contenido y avisó de las dos cosas.
  - **Cómo:** se copiaron GLOBAL-CP25 y GLOBAL-CP26 en el VPS y se vaciaron las 564 celdas de Plan/Real sin fórmula de esos meses. El ZIP con los 5 PDF entró por el chat y en unos 40 segundos devolvió los dos GLOBAL en un ZIP, con la revisión correcta en los cinco.
  - **Resultado, celda a celda contra producción:** Cayo Coco, La Habana, Holguín y Varadero, 0 diferencias. En Cayo Cruz el Real de octubre no estaba cargado en producción y el agente lo añadió desde el PDF. Además sustituyó 5 fórmulas del plan, avisando, por el 185/186 de abajo, y escribió 21.110,30 en el plan del 110, donde el GLOBAL tenía 21.110,32.
  - **Restaurado después:** los dos GLOBAL tienen el SHA de antes (`0c4be9eb…` y `08e97809…`) y `global_ai` está resincronizado (5.421 y 3.436 filas). Se borraron los respaldos y el ZIP que hizo el agente, la copia y el script de la prueba, los 2 ficheros de Storage, sus filas de `documents` y la conversación. Los 4 flujos temporales están archivados.
- [x] **GLOBAL-CP25, Holguín 185/186/195 puesto como el PDF** (2026-10-19, ejecución 512; Leo: «ponlo justo como viene en el PDF y asunto cerrado»).
  - **El problema:** de enero a octubre el GLOBAL tenía 416,66 de plan en el **195** «Otros», que el PDF no trae. A cambio, faltaba el **186** «Cancelación de Pérdidas y Faltantes» de enero a junio y el **185** «Impuestos Varios» de julio a septiembre. En octubre estaban los tres. El 175 suma las tres filas, así que el total cuadraba aunque las líneas no.
  - **Qué se cambió:** según los acumulados del PDF de octubre, el 185 y el 186 quedan con 416,66 cada mes de enero a octubre, y el 195 vacío. Son 19 celdas, y antes de escribir se comprobó el valor esperado de cada una. El 175 de enero a octubre suma 6.811.393,76, como el acumulado del PDF. Respaldo previo en `respaldos_global/`, y `global_ai` de 2025 se resincronizó (5.413 filas).
  - **No se tocó:** noviembre y diciembre, que el PDF no cubre (siguen con 416,66 y 416,74 en el 195), ni la fórmula del 196 de julio (`=AD186+AD180`, distinta de la del resto de meses).
- [x] **GLOBAL-CP25, Cayo Cruz 185/186 puesto como el PDF** (2026-10-19, ejecución 514, a petición de Leo).
  - **El problema:** de julio a octubre el plan del **185** «Impuestos Varios» (208,33) estaba en la fila del **186** «Cancelación de Pérdidas y Faltantes». El PDF de octubre trae el 185 con un acumulado de 2.083,3, es decir, 208,33 cada mes, y no trae el 186.
  - **Qué se cambió:** se pasaron las 8 celdas del plan de julio a octubre (AD, AG, AJ y AP) de la fila 169 a la 168, comprobando antes el valor esperado de cada una. El 175 no cambia, y las fórmulas de octubre que el agente había sustituido en la prueba (051, 076, 175, 196 y 207) ya cuadran con el PDF. Respaldo previo en `respaldos_global/GLOBAL-CP25_20261019_163201_215573.xlsx`, y `global_ai` de 2025 se resincronizó (5.411 filas).
  - **No se tocó:** noviembre y diciembre, que el PDF no cubre (el plan sigue en el 186).
- [ ] **Decidir con quien carga el GLOBAL-CP25** si se corrigen el 045/047 y el 110/111 de Cayo Cruz. El análisis está arriba. El 186/195 de Holguín y el 185/186 de Cayo Cruz ya están resueltos.
- [x] **Fallo del agente encontrado en esa comprobación** (arreglado el 2026-10-15, script `3cb30b9a…` en el VPS, ejecución 503; PR #18).
  - **Qué pasa:** `escribir` vuelve a escribir las celdas que ya eran «iguales» dentro de la tolerancia, con el valor redondeado del PDF. Por ejemplo, 41.900,826… pasa a 41.900,83.
  - **Consecuencia:** `verificar` lo da como «celda no prevista cambiada» y `todo_correcto` sale `false`. Pasará en cualquier GLOBAL con valores sin redondear, como Caibarién o Cayo Coco en 2025.
  - **Arreglo:** ya no se escriben las celdas que son iguales. Con los 6 PDF de febrero de 2025, `todo_correcto` pasa de `false` a `true`, y la prueba de febrero de 2026 sigue dando las 612 celdas, idénticas.
- [x] **Enrutado ampliado** (publicado en `9d0654b9`). La regla «Modelo 1» de `Switch3` pasa a `caseSensitive: false` y a un patrón en minúsculas que acepta `<polo>CP…`, `<polo>M-1`/`M1`, `Mod 1`, `Modelo 1` y `Modelo I`. Antes ni `HA MODELO 1 ….PDF` entraba, porque la regla distinguía mayúsculas. «Comprimido» también pasa a `caseSensitive: false`. Con la publicación entraron cambios del editor de Leo:
  - la rama «Informe» hacia `Supabase Vector Store2`;
  - «Leslie CA», que el autoguardado había dejado en `caseSensitive: true`, se devolvió a `false` antes de publicar.
- [x] **`Leslie/Modelo1.py` retirado del VPS** (2026-10-15, ejecución 504). No se borró: está en `Leslie/_retirados/Modelo1.py` (19.285 bytes, SHA-256 `df3ddd28…`). En `Leslie/` no quedaba ningún «Modelo 1 *.xlsx» de staging. Lo que sigue ahí es el wheel `pypdf-6.10.2-py3-none-any.whl`, que ya no hace falta porque `pypdf` está en la imagen del runner. No estorba.
- [ ] **Drive: mandar a la papelera la carpeta «Modelo 1»** (`1QRhYDffKNfDikZZdspFZf1YTDIzFXTME`, cuenta leodev0211). Tiene las 6 hojas «Modelo 1 <polo>» y la copia `GLOBAL-CP26.xlsx` (julio de 2026), y ya nada de n8n la usa. El permiso automático de la sesión bloqueó la papelera de Drive, así que lo hace Leo a mano.
- [ ] Revisar los avisos de acumulado de las pruebas: en Cayo Cruz, La Habana y Holguín (2025), la suma de los meses del GLOBAL no da el acumulado del PDF en 4–9 filas, así que hay meses anteriores cargados distintos.

## Automatizaciones (2026-10-20)

Sección nueva en la app con un apartado por proceso y un trigger propio por rama en n8n. Lo hecho y el cómo, en [[Automatizaciones]]. Queda:

- [x] **Publicar la versión del workflow** «Polarier Auto App». Los triggers nuevos (`WH Modelo 1`, `WH Tabla CA`, `WH Ocupacion`) están creados, pero la versión activa sigue siendo la anterior, así que en producción todavía no existen esas URL.
- [x] **Aplicar la migración `012_automation_runs.sql`** en el SQL editor de Supabase. Aplicada el 2026-10-20; el linter de seguridad no saca ningún aviso de la tabla.
- [ ] **Easypanel:** añadir `VITE_N8N_WEBHOOK_BASE` y `VITE_N8N_WEBHOOK_BASE_TEST` y hacer Rebuild.
- [ ] **Probar de punta a punta las tres ramas con un fichero real.** El camino del chat ya está comprobado (avisa y no ejecuta nada, ejecuciones 532–534); del trigger propio está comprobado hasta la descarga (ejecución 524). Falta la vuelta completa: lo primero que hay que mirar es que `* - Entrada` entregue `body` y el binario.
- [ ] Decidir si la rama `Informe` (base de conocimiento) merece también su apartado. Hoy solo entra por el chat.
- [x] **Informe del Consejo:** primera generación real (mayo de 2026), hecha el 2026-10-23 tras corregir el token de la routine y guardar los textos en base64. Ver [[Informe-Consejo-Generacion]].
- [x] **Informe del Consejo:** probar «Generar informe» y «Descargar» desde la app, ya desplegada el 2026-10-23 (T-a73905b32e). **«Generar informe» probado (2026-10-26):** abril de 2026 pedido desde la app desplegada a las 17:57 UTC (`rpc/solicitar_informe_consejo` con referer de `polarierapp`), ejecución n8n **580** OK y fila en `listo` con su DOCX en Storage a las 18:13. **«Descargar» probado (2026-10-26, 22:31 UTC):** desde el navegador, `POST` y `GET /storage/v1/object/sign/informes-consejo/2026/04/…docx` → 200; el objeto es un DOCX (`wordprocessingml`, 188 kB). Queda solo: Probar un trimestre cuando alguno tenga sus tres meses completos: hoy ninguno de 2026 los tiene.
- [x] **pythonrunner:** fuente GitHub cambiada a `main` y desplegado tras el merge de la PR 38 (2026-10-23).
- [x] **Easypanel, `polarierapp`:** fuente cambiada de `leonardojcddev/Polarier-App` a `iaquantic/Polarier-App` y desplegada sin problemas (2026-10-23).
- [ ] **Lencería del CD** ([[Informe-Consejo-Lenceria-CD]], en producción el 2026-10-28):
  - Reunir los CD de 2026 de los polos activos y cargar su lencería. Sin ellos, solo mayo se puede generar.
  - Fusionar `informe-consejo/lenceria-cd` y desplegar `polarierapp` con el grupo «Lencería del CD».
  - Confirmar la regla de los faltantes con quien prepara la TABLA CA.
  - Pedir los adjuntos prometidos en el formulario: pesos por prenda y modelos de mal uso, inventarios y lencería nueva.
  - Comprobar la carga con el primer CD real que se suba desde la app.

## Ideas / futuro

- (añadir aquí ideas que surjan)

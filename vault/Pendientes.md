# Pendientes

Tareas y cosas por revisar. Marca `[x]` al completar.

## Deploy / operación

- [x] **Actualizar variables de n8n en Easypanel** (la app desplegada) con las URLs self-hosted + `VITE_N8N_MODE`, y hacer **Rebuild**. Ver [[Deploy-Easypanel]].
- [x] Para uso real: poner `VITE_N8N_MODE=prod` **y activar el workflow** en n8n (toggle *Active*), para no depender de "Listen for test event". Ver [[Integracion-n8n]].
- [x] Confirmar que el dominio de producción está registrado en Supabase Auth (Site URL + Redirect URLs). Ver [[Supabase]].

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
- [ ] **Activar el workflow de correo** (toggle *Active* en n8n) para que funcione en prod. En modo test hay que ponerlo a *Listen for test event* antes de cada prueba.
- [ ] Probar el envío end-to-end desde la app y confirmar que el correo llega con el PDF adjunto.
- [ ] En **Easypanel**: añadir `VITE_N8N_EMAIL_WEBHOOK_URL` (+ `_TEST`) como Build Args y **Rebuild** para que el correo funcione en producción. Ver [[Deploy-Easypanel]].
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
- [ ] Para ver de verdad «los partes de otro», el auditor (`blandonbg97@gmail.com`) tiene que rellenar alguno: hoy los 4 que hay son del propio administrador.
- [ ] Decidir si el rol `supervisor` debe ver también el trabajo de los auditores (hoy solo lo ve `admin`). Ver [[Decisiones]].
- [ ] UI para editar la dotación (hoy solo por SQL; la RLS ya deja escribir a `supervisor`/`admin`).
- [ ] Cambiar el auditor de prueba (`leodev0211@gmail.com`) por el usuario real del hotel.
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
- [ ] **Mergear el PR #2** y comprobar que Easypanel redespliega. Hasta entonces la VPS no tiene el botón: solo estaba en la copia de trabajo local.
- [ ] **Falta la mitad cliente**: pulsar «Generar informe» en `/auditoria/historico/2026-08` estando logueado, para ejercitar `solicitarInformeMensual()` → `functions.invoke` → `/fire` con un JWT real. Es el único eslabón sin probar.
- [x] La fila de PRUEBA de agosto 2026 ya no es de prueba: la routine la regeneró con un informe real. Copia del contenido viejo en el scratchpad de la sesión.

**Después:**

- [x] **PDF y correo del informe mensual** (2026-09-03): con el informe hecho salen «Descargar» y «Enviar por correo» en vez de «Regenerar». Reutiliza el PDF y el correo del informe diario vía `src/lib/informeMensual.ts`. Ver [[Routine-Informe-Mensual]].
- [ ] Decidir si se retiran `monthly_reports.pdf_url`, el bucket `informes-mensuales` (migración 005) y el botón «Abrir PDF»: el PDF se genera en cliente, así que ya no hacen falta. De momento se quedan, sin uso.
- [ ] Añadir hoteles: la routine ya itera todos los hoteles activos; falta la UI de selección de hotel activo (ver también Módulo de Auditoría).
- [x] `getSubmissionHistory` tenía `limit = 60` y `AuditHistory` se quedaba en ~20 días. Subido a 500 en la llamada (2026-09-23), que es lo que ya pedía el dashboard.
- [ ] `AuditMonth` muestra el total de cada parte leyendo `totales.general`, que **no existe en el cuadrador**: esos partes nunca muestran total. `audit_daily.valor` ya lo resuelve bien; sería cuestión de leer de ahí.

## n8n — rama Carla y enrutado de polos (2026-10-05)

- [~] **Rama Carla: DESCARTADA por decision de Leo (2026-10-05).** Se queda rota en produccion, de forma consciente. El diagnostico completo y lo que haria falta para retomarla estan en [[Integracion-n8n]]. Falla en silencio: quien suba un fichero con `MU` recibe el mensaje de `error3` y no se procesa nada.
- [x] **Borrador `53dec2de-7a48-4c13-8bed-db505eeccd86` publicado**: comprobado el 2026-10-12, es la versión activa (`versionId = activeVersionId`). No consta que se hiciera la prueba con un `HACP…` y un `CCCP…`; hacerla en cuanto se suban ficheros reales. Texto original: **Publicar el borrador**, que corrige solo `Switch4`/`Switch5`. Diff reverificado el 2026-10-06: las unicas diferencias frente a produccion (`e2fa038a-20c8-46d8-a65f-d470a834c029`) son cuatro valores de comparacion; mismos 142 nodos, mismas conexiones y `Execute Command` identico. Ojo: el cambio de `Switch4` si tiene efecto real (rama Leslie, operativa), pero el de `Switch5` es inerte hasta que se arregle la rama Carla. Prueba antes de publicar: subir un `HACP...` y un `CCCP...` y comprobar que llegan a `Delete rows or columns from sheet3` y `sheet5`, las dos salidas que nunca se habian ejecutado.
- [x] **`Switch4` y `Switch5` corregidos como borrador** (2026-10-05, borrador `f15de71c-8dfa-4705-8fbb-82618bb85f22`, sin publicar). Estaban en modo primera-coincidencia con `contains 'C'`, lo que descartaba en silencio los datos de Habana y metia los de Cayo Coco en la hoja de Cayo Cruz. Ver [[Integracion-n8n]].
- [ ] **Revisar con el mismo criterio los demas switch** (`Switch`, `Switch1`, `Switch3`, `Switch6`): que ningun valor de regla sea subcadena de otro, dado que operan en primera-coincidencia.
- [ ] **`Switch6` le falta la regla de Holguin** (5 salidas en vez de 6); hoy Holguin va por `If4` → `Edit Fields5`. Decidir si se unifica con `Switch1`.
- [ ] **Los 12 nodos `Delete rows or columns from sheet*`** usan `numberToDelete` con valores que desbordan INT32 (999999999999 y mas). Tres de ellos ya fallaron con 400 de la API de Sheets.
- [ ] **`Update file1` da 404**: el fichero de Drive `1gT30p99...` ("GLOBAL-CP26") no existe o no es accesible.
- [ ] **Migrar 5 nodos Code a `$input`**: `Code in JavaScript`, `2`, `3`, `6` y `7` usan la global legacy `items`. Funciona en 2.33.4, pero hay que hacerlo antes de cualquier salto a n8n 3.x.
- [ ] **Quitar la service_role key de Supabase hardcodeada** en el header `apikey` del nodo `HTTP Request` de `Polarier Auto App`. Salta RLS.

## Limpieza y reglas de documentos (plan del 2026-10-12)

Reglas en [[Generacion-Documentos]]. No se tocan: la rama Carla, la rama `Integral` ni los borradores `My workflow 2/3/4` y `My Sub-Workflow 1`.

**Fase 1 — Reglas escritas**
- [x] Nota [[Generacion-Documentos]] + puntero en CLAUDE.md + incoherencias del vault corregidas.

**Fase 2 — Limpieza de n8n** (borrador `c60c4bce-0aaa-4bfb-bf58-4f8d7a763c63` de «Polarier Auto App», **sin publicar**; producción sigue en `53dec2de`)
- [x] `HTTP Request` y `HTTP Request8` descargan de Storage con la credencial `supabaseApi` «Polarier» (`a0l4Y70xe5eaZYNH`, comprobado con una sonda que es service_role). Se quita la service_role key que iba escrita a mano en el header `apikey`. Descarga comprobada con otra sonda: el PDF baja completo.
- [x] `Search files and folders` (rama ZIP) ya solo busca `GLOBALCP-26` dentro de la carpeta «Modelo 1» (`1QRhYDffKNfDikZZdspFZf1YTDIzFXTME`). Antes buscaba `GLOBAL` en **todo** el Drive y `Delete a file` borraba todo lo que encontrara.
- [x] `Code in JavaScript2` y `7`: `items[0]` → `$input.first()`. **No eran 5 nodos sino 3:** en `Code in JavaScript` y `6` la palabra `items` solo salía en un comentario. `Code in JavaScript3` se deja con `items` porque está en la rama `Integral`, que no se toca.
- [x] Wisin: sin meses fijos; el periodo es AAAA-MM con el año que diga el usuario o, si no lo dice, el actual (`$now`). Probado con el chat de prueba `prueba-claude-2026-10-12`: Varadero, marzo de 2026 → 5.971.811,58 CUP, igual que en `global_ai`.
- [x] ~~`numberToDelete` fuera de INT32~~: **ya estaba corregido** en producción (los 12 nodos usan `9999`).
- [ ] **Publicar** el borrador (pendiente del OK de Leo).
- [ ] **Bucket `documents` público.** Todo lo que se sube al chat se puede descargar sin sesión si se conoce la ruta; las políticas de `storage.objects` ya limitan la lectura a la carpeta de cada usuario, pero el flag `public` las salta. La app solo usa URLs firmadas, así que cerrarlo no la rompe; n8n tampoco, una vez publicado el borrador. Hacerlo **después** de publicar.
- [ ] **Rotar la service_role key**: estuvo en claro en el JSON del workflow y sigue en el historial de versiones. Al rotarla hay que actualizar la credencial «Polarier» de n8n.
- [ ] Correo: «Emails» del self-hosted (`TIwrYY0MIntv5GLj`) acepta el mismo payload que la app y usa el **mismo path** de webhook (`19a7f802-…`), así que basta cambiar el host en `VITE_N8N_EMAIL_WEBHOOK_URL(_TEST)` (`.env` + Build Args de Easypanel + Deploy). Antes: añadirle `replyTo = body.remitente`, que el de cloud sí tenía, y probar el envío a una dirección de Leo.
- [ ] El webhook de correo no tiene autenticación: cualquiera que conozca la URL puede mandar correos con adjunto desde la cuenta de Quantic. Pasa igual en el de cloud. Un secreto en `VITE_*` no sirve (acaba en el bundle); la vía buena sería que la app llame a una Edge Function que firme la petición.
- [ ] «Emails» no está en la carpeta Polarier de n8n (está en la raíz del proyecto).

**Fase 3 — Global → Supabase**
- [ ] Script en el pythonrunner que normaliza la hoja `<COD>CP<año>` actualizada al formato de `global_ai` (mismo `row_uid`), y upsert desde n8n con credencial al final de cada Modelo 1 (rama PDF y rama ZIP). Registrar la pasada en `global_import_runs`.
- [ ] Recargar `global_ai` completa una vez con el GLOBAL actual del VPS.

**Fase 4 — TABLA CA con agente**
- [ ] Regla `CD` en `Switch3` → extraer las hojas del CD → agente que decide los 28 indicadores (con celda de origen) usando `global_ai` → validación → escritor genérico (pythonrunner + openpyxl) → xlsx en el chat.
- [ ] Año según el fichero en GLOBAL, TABLA CA y nodos (quitar `CP26`/`2025` fijos).
- [ ] **Bloqueado:** falta `TABLA CA 2026.xlsx`; Leo la subirá a `/data/Polarier/Leslie/CD/` cuando se la den.

## Ideas / futuro

- (añadir aquí ideas que surjan)

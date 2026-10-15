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

**Fase 2 — Limpieza de n8n** (`c60c4bce-0aaa-4bfb-bf58-4f8d7a763c63` **publicada** el 2026-10-12 con el OK de Leo; antes, `53dec2de`)
- [x] `HTTP Request` y `HTTP Request8` descargan de Storage con la credencial `supabaseApi` «Polarier» (`a0l4Y70xe5eaZYNH`, comprobado con una sonda que es service_role). Se quita la service_role key que iba escrita a mano en el header `apikey`. Descarga comprobada con otra sonda: el PDF baja completo.
- [x] `Search files and folders` (rama ZIP) ya solo busca `GLOBALCP-26` dentro de la carpeta «Modelo 1» (`1QRhYDffKNfDikZZdspFZf1YTDIzFXTME`). Antes buscaba `GLOBAL` en **todo** el Drive y `Delete a file` borraba todo lo que encontrara.
- [x] `Code in JavaScript2` y `7`: `items[0]` → `$input.first()`. **No eran 5 nodos sino 3:** en `Code in JavaScript` y `6` la palabra `items` solo salía en un comentario. `Code in JavaScript3` se deja con `items` porque está en la rama `Integral`, que no se toca.
- [x] Wisin: sin meses fijos; el periodo es AAAA-MM con el año que diga el usuario o, si no lo dice, el actual (`$now`). Probado con el chat de prueba `prueba-claude-2026-10-12`: Varadero, marzo de 2026 → 5.971.811,58 CUP, igual que en `global_ai`.
- [x] ~~`numberToDelete` fuera de INT32~~: **ya estaba corregido** en producción (los 12 nodos usan `9999`).
- [x] **Publicado** `c60c4bce` (2026-10-12). Prueba de humo contra la URL de producción: HTTP 200 y respuesta del agente.
- [x] **Benjamin también tenía fijo «Actualmente el Global tiene datos de enero y febrero 2026»** y contestaba «no disponible» **sin consultar a Wisin**. Corregido y **publicado** como `c840d9a2` (2026-10-12). Prueba en producción (Cayo Coco, febrero de 2026 → 9.582.183 CUP) coincide con `global_ai`.
- [x] **Bucket `documents` cerrado** (2026-10-12, con el OK de Leo). Antes se comprobó que nada dependía de las URLs públicas: la app solo usa URLs firmadas, no hay ninguna URL pública guardada en `chat_messages`, `documents`, `document_chunks` ni `form_submissions`, y los dos nodos de n8n que leen el bucket ya usan credencial. Verificado después: una URL pública sin sesión da 400; n8n descarga con su credencial (sonda: PDF completo, 84.263 bytes). Matiz: el CDN puede seguir sirviendo hasta 1 h (`max-age=3600`) una URL pública que alguien pidiera justo antes del cierre. **No se pudo revisar** «chatbot multimensajes» ni «My workflow» (no son legibles por el MCP): si alguno leía `documents` por la URL pública, ahora fallará.
- [ ] **Rotar la service_role key**: estuvo en claro en el JSON del workflow y sigue en el historial de versiones. Al rotarla hay que actualizar la credencial «Polarier» de n8n.
- [x] **Credencial «Gmail Quantic» (`7kBjPaDgbooOLT3C`) reconectada** por Leo (2026-10-12), después de que la ejecución 429 fallara. Envío de prueba a `leodev0211@gmail.com` desde producción: OK.
- [x] **«Emails» respondía 200 aunque fallara el envío.** **Publicado** (2026-10-12, versión `0eaa41b2`): si falla Gmail, `Send a message1` sale por error y el nodo `Responder error` devuelve **502** con `{ok:false,error}`; se probó primero con 502, pero **el proxy de Easypanel sustituye los 502 por su página HTML «Service is not reachable»**, así que se dejó en **500**. Comprobado contra producción: `HTTP 500 {"ok":false,"error":"Invalid email address (item 0)"}`. El mismo cambio añade **`replyTo = body.remitente`**. Probados los dos caminos: destinatario inválido → `Responder error`; envío real → `SENT`. 
- [x] Correo migrado al self-hosted en el lado app: `.env` local y `DEPLOY.md` apuntan a `polarierauto-n8n…/webhook(-test)/19a7f802-…` (mismo path que en cloud).
- [ ] **En Easypanel:** cambiar los Build Args `VITE_N8N_EMAIL_WEBHOOK_URL` y `_TEST` al host `polarierauto-n8n.1tn4v0.easypanel.host` y pulsar **Deploy**. Hasta entonces, la app desplegada sigue enviando por n8n cloud.
- [ ] El webhook de correo no tiene autenticación: cualquiera que conozca la URL puede mandar correos con adjunto desde la cuenta de Quantic. Pasa igual en el de cloud. Un secreto en `VITE_*` no sirve (acaba en el bundle); la vía buena sería que la app llame a una Edge Function que firme la petición.
- [ ] «Emails» no está en la carpeta Polarier de n8n (está en la raíz del proyecto).

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
  - **Al publicar entran también los cambios del editor de Leo:** rama «Informe» quitada (su salida queda sin conectar, así que un fichero con «Informe» en el nombre no recibe respuesta), nota adhesiva y `caseSensitive: true` en las reglas Modelo 1 y Comprimido. Con esto último, un `VACP202601.PDF` en mayúsculas ya no entra por Modelo 1.
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
  - **Restaurado después:** `GLOBAL-CP26.xlsx` original (`08e97809…`) y `global_ai` resincronizado (3.436 filas de 2026, igual que antes). Queda la copia `Leslie/GLOBAL-CP26 antes-prueba-m1 20261015.xlsx`, que se puede borrar. En `Leslie/respaldos_global/` quedan los respaldos que hizo el agente durante la prueba.
  - **Gotchas:**
    - n8n no puede sobrescribir ficheros que creó el runner, porque son de root (`EACCES`). Para cambiar un maestro escrito por Python hay que usar el runner.
    - Un Modelo 1 de prueba **sincroniza `global_ai`**, así que restaurar el GLOBAL no basta: hay que volver a sincronizar.
- [x] **Enrutado ampliado** (publicado en `9d0654b9`). La regla «Modelo 1» de `Switch3` pasa a `caseSensitive: false` y a un patrón en minúsculas que acepta `<polo>CP…`, `<polo>M-1`/`M1`, `Mod 1`, `Modelo 1` y `Modelo I`. Antes ni `HA MODELO 1 ….PDF` entraba, porque la regla distinguía mayúsculas. «Comprimido» también pasa a `caseSensitive: false`. Con la publicación entraron cambios del editor de Leo:
  - la rama «Informe» hacia `Supabase Vector Store2`;
  - «Leslie CA», que el autoguardado había dejado en `caseSensitive: true`, se devolvió a `false` antes de publicar.
- [ ] Cuando esté en producción: retirar `Leslie/Modelo1.py` del VPS, los Sheets «Modelo 1 <polo>» y la copia `GLOBALCP-26.xlsx` de Drive.
- [ ] Revisar los avisos de acumulado de las pruebas: en Cayo Cruz, La Habana y Holguín (2025), la suma de los meses del GLOBAL no da el acumulado del PDF en 4–9 filas, así que hay meses anteriores cargados distintos.

## Ideas / futuro

- (añadir aquí ideas que surjan)

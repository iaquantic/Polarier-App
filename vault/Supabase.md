# Supabase

Proyecto Supabase usado para **auth, base de datos y Storage**.

- Cliente: `src/lib/supabaseClient.ts` (flujo PKCE, `persistSession`).
- URL y clave publishable vía variables `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (el nombre es histórico). Rotación y consumidores de cada clave: [[Rotacion-Claves-Supabase]]. Ver [[Deploy-Easypanel]].
- La `anon key` es **pública** (va en el navegador). La seguridad real depende de las **RLS policies**.

## Tablas

| Tabla | Descripción | Columnas clave |
|-------|-------------|----------------|
| `polos_turisticos` | Polos (nivel superior de hoteles) | `id`, `nombre` |
| `chats` | Conversaciones | `id`, `user_id`, `title`, `created_at` |
| `chat_messages` | Mensajes de cada chat | `id`, `chat_id`, `user_id`, `role`, `content` |
| `profiles` | Perfil del usuario | `id`, `full_name`, `avatar_url` |
| `documents` | Archivos subidos/generados | `id`, `user_id`, `chat_id`, `file_name`, `file_path`, `mime_type`, `size_bytes`, `status`, `role` |

### Informe del Consejo de Dirección (migración 013, aplicada el 2026-10-21)

| Tabla / función | Para qué | Acceso |
|---|---|---|
| `tabla_ca_meses` | Qué indicadores tiene la TABLA CA por año × mes × polo (solo presente/ausente, sin valores) | Sin políticas: service role |
| `tabla_ca_sync_runs` | Cuándo se sincronizó cada año | Sin políticas |
| `sync_tabla_ca_meses(payload)` | Reemplaza el año con la salida de `sync_tabla_ca.py` (aborta con menos de 100 filas) | Solo service role |
| `consejo_informes` | Un informe por año y mes: estado (`pendiente`, `generando`, `listo`, `error`), fichero, error | Lo leen todos los autenticados; se escribe solo por funciones o con la service role |
| `disponibilidad_informe_consejo(anio)` | Por mes, cada dato que hace falta y su estado (`ok`, `falta`, `sin_comprobar`). SECURITY DEFINER sobre `global_ai` y `tabla_ca_meses`, por eso **no devuelve importes** | Autenticados |
| `fuentes_informe_consejo(anio)` | Cuándo se actualizó el GLOBAL y la TABLA CA | Autenticados |
| `solicitar_informe_consejo(anio, mes)` | Vuelve a comprobar en el servidor que no falta nada y deja el informe en `pendiente` | Autenticados |
| `anular_solicitud_informe_consejo(id, motivo)` | Marca `error` si el webhook no respondió | El que lo pidió |

Reglas en [[Informe-Consejo-Origen-Datos]], sección «Comprobación por mes».

**Migración 014 (aplicada el 2026-10-22):** generación automática e informes trimestrales.

| Cambio | Para qué |
|---|---|
| `consejo_informes.trimestre` | Una fila lleva `mes` o `trimestre`, nunca los dos (check `consejo_informes_mes_o_trimestre`). El `unique (anio, mes)` pasa a dos índices parciales, uno por mes y otro por trimestre |
| `consejo_informes.datos` | Tablas del período en texto, que escribe n8n (salida de `preparar_consejo.py`) |
| `consejo_informes.analisis` | `{"sections": {...}}`: los textos que escribe la routine por el conector de Supabase |
| `consejo_informes.redactado_at` | Cuándo terminó la routine; n8n lo espera para montar el DOCX |
| `solicitar_informe_consejo(anio, mes)` | La misma de la 013, con el índice parcial y vaciando `datos`/`analisis` al regenerar |
| `solicitar_informe_consejo_trimestre(anio, trimestre)` | Como la del mes: comprueba que a los tres meses no les falta nada | 

Flujo completo en [[Informe-Consejo-Generacion]].

**Migración 015 (aplicada el 2026-10-28):** la lencería del CD, por mes ([[Informe-Consejo-Lenceria-CD]]).

| Cambio | Para qué |
|---|---|
| `cd_lenceria` | Una fila por año × mes × polo × bloque (montas ×2, rechazo, mal uso, inyecciones, desmanche, retiro, faltantes), con `estado` (`ok`, `vacio`, `no_encontrado`) y `valores` en jsonb. Sin políticas: solo service_role y las funciones |
| `cargar_cd_lenceria(payload)` | La llama la rama `CD -` de n8n con la salida de `cd_lenceria.py`; reemplaza los ocho bloques de ese polo y mes. Solo service_role |
| `lenceria_informe_consejo(anio, meses)` | Las filas del período y del mismo período del año anterior, para `preparar_consejo.py`. Solo service_role |
| `disponibilidad_informe_consejo(anio)` | Grupo nuevo `cd_lenceria`: un polo con actividad sin lencería cargada es «falta»; un bloque vacío en el CD es solo aviso. Montas, rechazo, mal uso, desmanche, retiro, inyecciones y faltantes salen del grupo «tecleado» |

- En `documents`, `role` distingue archivos del usuario (`user`) de los del asistente (`assistant`). "Mis Documentos" muestra solo los `assistant`.

### Módulo de auditoría

Las tablas del módulo están detalladas en [[Modulo-Auditoria]]. Aquí solo lo que
afecta a informes:

| Tabla | Descripción | Columnas clave |
|-------|-------------|----------------|
| `monthly_reports` | Un informe por hotel + usuario + año + mes | `estado` (`pendiente`\|`generando`\|`listo`\|`error`), `resumen` jsonb, `metricas` jsonb, `generado_at`, **`solicitado_at`** |
| `audit_daily` | Capa plana: 1 fila por parte, métricas normalizadas y nombres resueltos | `submission_id` (PK), `hotel_id`, `fecha`, `periodo`, `tipo`, `valor`, `kg`, `inventario`, `metricas` |
| `audit_daily_detalle` | Formato largo: prenda / ubicación / métrica / valor | `submission_id`, `prenda`, `ubicacion`, `metrica`, `valor` |
| `dotacion_lenceria` | Stock fijo de lencería del hotel por ubicación × prenda (2.877 en el Muthu). Precarga el parte de lencería y es la dotación del dashboard y del informe | `hotel_id`, `ubicacion_id`, `prenda_id`, `cantidad`; única por los tres. Escritura solo `supervisor`/`admin` vía `has_hotel_role(h, roles[])`. Migración `007` |
| `control_mes` | Formulario unificado: lo que se rellena una vez al mes, por hotel. `resumen` es la hoja Resumen calculada por la app, y es lo que lee la routine. Lectura y escritura con acceso al hotel | `hotel_id`, `anio`, `mes` (únicos), `data` jsonb, `resumen` jsonb, `resumen_at`, `updated_by`. Migración `016` |
| `control_eventos` | Formulario unificado: incidencias, retiros, mantenimiento y acciones. Se abren un día y se cierran otro. Lectura y escritura con acceso al hotel | `hotel_id`, `tipo`, `fecha`, `data` jsonb, `user_id`, `updated_by`. Migración `016` |

Las metas del SLA de cada hotel van en `form_definitions.config.metas`, fuera de las migraciones: son cifras del contrato y el repositorio es público. Ver [[Formulario-Control]].

Vistas (con `security_invoker = true`, imprescindible: una vista normal corre con
los permisos de su dueño y **se salta la RLS**):

| Vista | Grano |
|---|---|
| `audit_mes` | 1 fila por hotel + periodo + tipo de formulario. Desde la 007 trae `dotacion_hotel` (stock fijo) junto a `max_inventario` (lo contado) |
| `audit_mes_dias` | serie diaria con `mediana_mes`, `ratio_vs_mediana` y `clasificacion`; en lencería, `dotacion_hotel` y `diferencia_dotacion` (conteo − dotación) |
| `audit_dotacion_hotel` | suma de `dotacion_lenceria` por hotel (apoyo de las otras dos) |
| `audit_mes_dotacion` | dotación frente a lo contado en el mes, por ubicación × prenda (`dotacion`, `contado`, `diferencia`). En el formulario antiguo, el último parte de lencería; en el unificado, el último conteo de cada casilla, y sin conteo `contado` es null. Solo hoteles/periodos con algún parte |

`audit_daily` y `audit_daily_detalle` **no se escriben nunca a mano**: las mantiene
el trigger `trg_audit_daily` sobre `form_submissions`, vía
`refrescar_audit_datos(submission_id)` (`security definer`, idempotente). Migración
`006_auditoria_datos_ia.sql`. Ver [[Routine-Informe-Mensual]].

`solicitado_at` es la **cola** de generación del informe mensual: la escribe el
botón de la app y la vacía la routine de Claude.

## Edge Functions

| Función | Uso |
|---|---|
| `disparar-informe-mensual` | Relé para lanzar la routine de Claude. Guarda `ROUTINE_ID` y `ROUTINE_TOKEN` como secretos, valida el JWT del auditor y hace el `POST /fire`. El token no puede ir en el frontend: la app es una SPA de Vite y cualquier `VITE_*` queda escrito en el bundle público |

```bash
supabase secrets set ROUTINE_ID=trig_xxxxx ROUTINE_TOKEN=sk-ant-oat01-xxxxx
supabase functions deploy disparar-informe-mensual
```

## Storage (buckets)

| Bucket | Uso | Notas |
|--------|-----|-------|
| `avatars` | Fotos de perfil | público, máx 2MB |
| `documents` | Archivos de chat | **privado** (URLs firmadas), máx 50MB, sin restricción de MIME. **Ojo:** hasta el 2026-10-12 estaba en realidad **público** en Supabase, aunque aquí ponía privado. Se cerró ese día (ver [[Pendientes]]). El límite de 50MB solo lo aplica la app (`storage.ts`): el bucket no tiene `file_size_limit` |
| `informes-consejo` | Informes del Consejo generados | **privado**, lo leen todos los autenticados; solo escribe la service role (migración 013) |
| ~~`informes-mensuales`~~ | ~~PDF del informe mensual~~ | **Retirado** el 2026-10-19 (migración 011 aplicada y bucket borrado): el PDF se genera en el cliente. Nunca guardó nada. |

- Los archivos privados se sirven con `createSignedUrl`. n8n los descarga con la credencial `supabaseApi` «Polarier» (service_role).
- Las políticas de `storage.objects` limitan la lectura y escritura de `documents` a la carpeta `<user_id>/` de cada usuario. Con el bucket público, esas políticas no protegían nada: cualquiera con la ruta descargaba el fichero.
- El límite de subida es **50MB** (subido desde 20MB para soportar ZIP/RAR). Ver [[Decisiones]].

## Borrado de datos (importante)

Implementado en `chat.ts` y `storage.ts`:

- **`deleteChat`** → borra en cascada: documentos del chat (archivos de Storage **+** filas) → mensajes → el chat. El borrado de Storage es **explícito**, porque `documents.chat_id` es `ON DELETE SET NULL`: borrar solo el chat deja la fila con `chat_id` nulo y el archivo en el bucket.
- **`deleteDocument`** / **`deleteDocumentsByChat`** → borran archivo del bucket + fila. Si falla el borrado del archivo, la fila se queda y salta el error, para poder reintentar. Un archivo que ya no existe no da error.
- **`uploadDocument`** → si no se puede crear la fila, borra el archivo recién subido.
- Botón de eliminar por documento en "Mis Documentos".

> ⚠️ Antes, `deleteChat` solo borraba la fila del chat: las filas de `documents` se quedaban con `chat_id` nulo y sus archivos en el bucket. Corregido. Ver [[Decisiones]].

**Los documentos y los mensajes de chat no caducan** (decisión de Leo, 2026-11-02, ver [[Decisiones]]): siguen hasta que su dueño los borra. Las funciones que borraban a 7 días se eliminaron con las migraciones `018` y `019`.

**Los archivos se borran por la API de Storage o desde el panel, nunca por SQL.** `storage.protect_delete` no deja hacerlo y, según la documentación de Supabase, un borrado por SQL no quita el fichero del bucket.

**Borrar un usuario deja sus archivos.** `documents.user_id` es `ON DELETE CASCADE`: las filas se van, pero los archivos se quedan en `<user_id>/`, donde ya nadie los ve desde la app. Antes de borrar a un usuario hay que vaciar su carpeta.

**Objetos sin fila.** A 2026-11-02 hay 160 en el bucket `documents`, unos 60 MB, subidos entre el 2026-04-07 y el 2026-08-19. Ninguna tabla los enlaza por ruta, y desde esa fecha no han aparecido más.
- 106 son de usuarios ya borrados.
- Los otros 54 son de usuarios activos y no se sabe quién borró sus filas. El `deleteChat` antiguo no lo explica, porque con `SET NULL` la fila se queda. Tampoco ningún flujo legible de n8n, que no toca esa tabla, aunque de abril a agosto no quedan versiones ni ejecuciones.

La limpieza está en [[Pendientes]].

## RLS del módulo de auditoría

Desde la migración `008_admin_ve_todos_los_partes.sql` (2026-09-23) la lectura deja
de ser estrictamente personal:

- `form_submissions`, `audit_daily`, `audit_daily_detalle`: se ven las propias **o**
  todas las del hotel si tienes rol `admin` allí (`has_hotel_role(hotel_id, array['admin'])`).
- `profiles`: además del propio, se ve el perfil de quien tiene rol activo en un hotel
  que administras (helper `puede_ver_perfil(uuid)`, `security definer` porque necesita
  leer `user_hotel_roles` de otro usuario).
- **Insert/update/delete no cambian:** siguen exigiendo `user_id = auth.uid()`. El
  administrador mira, no corrige. Ver [[Modulo-Auditoria]].
- Para añadir el rol `supervisor` a esa visibilidad basta con meterlo en los
  `array['admin']` de la migración.

## RLS

El borrado requiere policies `DELETE` para `auth.uid() = user_id` en `chats`, `chat_messages` y `documents`. Verificado que funciona en producción.

## Permisos de las funciones SECURITY DEFINER

Supabase da EXECUTE sobre toda función nueva de `public` a `public`, `anon`, `authenticated` y `service_role`, y PostgREST las expone en `/rest/v1/rpc/`. Al crear una función `security definer` hay que quitarlo a mano, y siempre también a `public`: `revoke ... from anon` a secas no cambia nada, porque `anon` lo hereda de ahí. Un `drop function` seguido de `create` devuelve los permisos por defecto; `create or replace` los conserva.

Revisión del 2026-11-02, por el aviso del asesor de seguridad (lint 0028, `anon` puede ejecutar). Migración `017_permisos_security_definer.sql`, aplicada el 2026-11-02 (registrada como `permisos_security_definer`). Falta probar un alta real (ver [[Pendientes]]):

| Función | Quién la usa | Permisos tras la 017 |
|---|---|---|
| `delete_old_documents` | Nadie: sin trigger, sin cron (`pg_cron` no está instalado), ni la app ni n8n (5 flujos inactivos y sin disparadores no se pudieron leer) | **Eliminada** por la migración `018`, aplicada el 2026-11-02 |
| `handle_new_user` | Trigger `on_auth_user_created` de `auth.users` | Solo `service_role` y el propietario. Un trigger no revalida privilegios al dispararse, solo al crearlo |
| `rls_auto_enable` | Event trigger `ensure_rls` | Igual |
| `has_hotel_access`, `has_hotel_role`, `puede_ver_perfil` | 27 políticas RLS de 13 tablas | **Sin cambios** (`anon`, `authenticated`, `service_role`) |

**`delete_old_documents` ya no existe.** No funcionaba: `storage.protect_delete`, un trigger de Supabase sobre `storage.objects`, impide borrar por SQL, así que fallaba en su primera línea y deshacía todo. Se eliminó con `018_retirar_delete_old_documents.sql` (decisión de Leo, 2026-11-02; aplicada ese día, registrada como `retirar_delete_old_documents`). Los documentos no caducan: ver «Borrado de datos».

**Por qué `anon` conserva los tres de las políticas.** Todas las políticas son `TO public`, así que `anon` también las evalúa, y una política corre con los permisos de quien consulta. Sin EXECUTE, una consulta de `anon` a `hoteles` o `profiles` pasa de devolver cero filas a fallar con 42501. Quitárselo no protege nada: con `auth.uid()` a null, para `anon` nunca dan verdadero. `authenticated` los necesita para que la app funcione. Por eso el asesor seguirá avisando de estas tres: es un falso positivo asumido, igual que los avisos del lint 0029 sobre `disponibilidad_informe_consejo`, `fuentes_informe_consejo`, `solicitar_informe_consejo`, `solicitar_informe_consejo_trimestre` y `anular_solicitud_informe_consejo`, que son RPC que llama la app (`src/services/informeConsejo.ts`).

Para limpiar el aviso de `anon` habría que pasar antes esas políticas a `TO authenticated` (así `anon` sigue viendo cero filas, sin error) y revocar después. Probado en local, pero no se hizo: toca 27 políticas y no aporta seguridad. Ver [[Decisiones]].

## Post-deploy: configuración de auth

En **Authentication → URL Configuration** hay que registrar el dominio de producción:
- **Site URL**: `https://tu-dominio`
- **Redirect URLs**: `https://tu-dominio/**` (necesario para OAuth de Google y reset de contraseña).

## Login con Google

Vuelve desde el 2026-10-28 (se había quitado en `v1.3`). Botón «Continuar con Google» en
`/login` y `/register`; `signInWithGoogle()` en `src/services/auth.ts`.

- **Supabase:** el proveedor Google ya estaba activo, con un client ID de Google Cloud
  (Authentication → Sign In / Providers → Google). El callback que Google tiene que
  conocer es `https://zongaaygriklqsxzxfgl.supabase.co/auth/v1/callback`.
- **Vuelta a la app:** `redirectTo` es `<origen>/auth/callback` en web y
  `polarier://auth/callback` en Android. Las dos tienen que estar en **Redirect URLs**;
  si no, Supabase manda a la Site URL y el canje PKCE falla (el verificador quedó en el
  navegador de origen). Para probar en local hay que añadir también
  `http://localhost:<puerto>/**`.
- **Altas:** si la cuenta no existe, Google la crea al primer acceso (sin correo de
  verificación); `handle_new_user` copia el `full_name` de Google a `profiles`. Entra sin
  roles, igual que un alta por correo. En `/register` se exige aceptar los términos
  antes de ir a Google. Ver [[Decisiones]].
- **Android:** la WebView de Capacitor no hace el OAuth dentro (Google lo bloquea en
  WebViews): la navegación a `accounts.google.com` sale al navegador del sistema y vuelve
  por el deep link, que canjea el `?code=` en `src/main.tsx`.
- **Puerto 8080 en el Windows de Leo:** está dentro de un rango reservado por Windows
  (8015–8114) y `bun dev` falla con `EACCES`. En `.claude/launch.json` hay una
  configuración `polarier-dev-5180` para arrancar en el 5180.

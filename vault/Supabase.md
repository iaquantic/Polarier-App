# Supabase

Proyecto Supabase usado para **auth, base de datos y Storage**.

- Cliente: `src/lib/supabaseClient.ts` (flujo PKCE, `persistSession`).
- URL y anon key vía variables `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Ver [[Deploy-Easypanel]].
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

Vistas (con `security_invoker = true`, imprescindible: una vista normal corre con
los permisos de su dueño y **se salta la RLS**):

| Vista | Grano |
|---|---|
| `audit_mes` | 1 fila por hotel + periodo + tipo de formulario. Desde la 007 trae `dotacion_hotel` (stock fijo) junto a `max_inventario` (lo contado) |
| `audit_mes_dias` | serie diaria con `mediana_mes`, `ratio_vs_mediana` y `clasificacion`; en lencería, `dotacion_hotel` y `diferencia_dotacion` (conteo − dotación) |
| `audit_dotacion_hotel` | suma de `dotacion_lenceria` por hotel (apoyo de las otras dos) |
| `audit_mes_dotacion` | dotación frente al **último** conteo de lencería del mes, por ubicación × prenda (`dotacion`, `contado`, `diferencia`). Solo hoteles/periodos con algún parte de lencería |

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

- **`deleteChat`** → borra en cascada: documentos del chat (archivos de Storage **+** filas) → mensajes → el chat. El borrado de Storage es **explícito**, porque el `ON DELETE CASCADE` de la BD nunca elimina archivos de Storage.
- **`deleteDocument`** / **`deleteDocumentsByChat`** → borran archivo del bucket + fila.
- Botón de eliminar por documento en "Mis Documentos".

> ⚠️ Antes, `deleteChat` solo borraba la fila del chat, dejando mensajes y archivos huérfanos → el proyecto se llenaba. Corregido. Ver [[Decisiones]].

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

## Post-deploy: configuración de auth

En **Authentication → URL Configuration** hay que registrar el dominio de producción:
- **Site URL**: `https://tu-dominio`
- **Redirect URLs**: `https://tu-dominio/**` (necesario para OAuth de Google y reset de contraseña).

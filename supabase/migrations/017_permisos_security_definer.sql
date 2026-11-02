-- =============================================================================
-- Quitar EXECUTE a las funciones SECURITY DEFINER que nadie llama por la API
-- =============================================================================
-- Ejecutar en Supabase → SQL Editor (después de 001..016). No depende de ningún
-- despliegue de la app.
--
-- Supabase da EXECUTE sobre toda función nueva de `public` a `public`, `anon`,
-- `authenticated` y `service_role`, y PostgREST las expone en /rest/v1/rpc/. Estas tres
-- se crearon fuera de las migraciones y nunca se les quitó, así que el asesor de
-- seguridad avisa de que se pueden lanzar sin iniciar sesión.
--
-- Hay que quitárselo también a `public`: `anon` y `authenticated` lo heredan de ahí, y
-- un `revoke ... from anon` a secas no cambia nada. `service_role` tiene su propio
-- permiso y lo conserva; `postgres` es el propietario.
--
-- Qué se deja igual, a propósito
-- ------------------------------
-- `has_hotel_access`, `has_hotel_role` y `puede_ver_perfil` conservan `anon` y
-- `authenticated`. Las usan 27 políticas de 13 tablas, todas `TO public`, y una política
-- se evalúa con los permisos de quien consulta: sin EXECUTE, una consulta de `anon` a
-- esas tablas pasa de devolver cero filas a fallar con 42501, y las de `authenticated`
-- dejarían de funcionar. Para `anon` no exponen nada: `auth.uid()` es null y nunca dan
-- verdadero. Ver vault/Supabase.md, «Permisos de las funciones SECURITY DEFINER».

-- Borra los documentos de más de 7 días, ficheros y filas. No la llama nadie: ni trigger,
-- ni cron (`pg_cron` no está instalado), ni la app, ni n8n. Además hoy falla en su primera
-- línea, porque `storage.protect_delete` no deja borrar de `storage.objects` por SQL; pero
-- eso es una protección de Supabase, no un permiso nuestro.
revoke execute on function public.delete_old_documents() from public, anon, authenticated;

-- Trigger `on_auth_user_created` de `auth.users`. Un trigger no revalida privilegios al
-- dispararse, solo al crearlo (igual que `trg_refrescar_audit_datos`, migración 006), así
-- que las altas siguen creando el perfil.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Event trigger `ensure_rls`. Tampoco se revalida al dispararse.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Comprobación: `anon` y `authenticated` deben salir `false`, y `service_role`, `true`.
--
--   select p.proname,
--          has_function_privilege('anon', p.oid, 'EXECUTE')          as anon,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
--          has_function_privilege('service_role', p.oid, 'EXECUTE')  as service_role
--   from pg_proc p
--   where p.oid in ('public.delete_old_documents'::regproc,
--                   'public.handle_new_user'::regproc,
--                   'public.rls_auto_enable'::regproc);

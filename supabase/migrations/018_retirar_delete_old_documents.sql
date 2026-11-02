-- =============================================================================
-- 018 · Los documentos no caducan: se retira delete_old_documents
-- =============================================================================
-- Ejecutar en Supabase → SQL Editor (después de 001..017). No depende de ningún
-- despliegue de la app.
--
-- Leo decidió el 2026-11-02 no tener retención automática en el bucket `documents`: un
-- documento sigue hasta que su dueño lo borra. Ver vault/Decisiones.md.
--
-- La función pretendía borrar los documentos de más de 7 días, ficheros y filas. Se creó
-- fuera de las migraciones y no la llama nadie: ni trigger, ni cron (`pg_cron` no está
-- instalado), ni la app, ni n8n. Además falla en su primera línea, porque
-- `storage.protect_delete` no deja borrar de `storage.objects` por SQL. Si algún día hace
-- falta un plazo, hay que hacerlo con la API de Storage, no recuperando esta función.

drop function if exists public.delete_old_documents();

-- Comprobación: tiene que salir null.
--
--   select to_regprocedure('public.delete_old_documents()');

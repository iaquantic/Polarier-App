-- =============================================================================
-- 019 · Los mensajes de chat no caducan: se retira delete_old_chat_messages
-- =============================================================================
-- Ejecutar en Supabase → SQL Editor (después de 001..018). No depende de ningún
-- despliegue de la app.
--
-- Leo decidió el 2026-11-02 eliminarla, igual que delete_old_documents (migración 018).
-- Ver vault/Decisiones.md.
--
-- La función borraba los mensajes de más de 7 días. Se creó fuera de las migraciones y no
-- la llama nadie: ni trigger, ni cron (`pg_cron` no está instalado), ni la app, ni los
-- flujos legibles de n8n. Los mensajes de meses atrás siguen ahí, así que no se ejecutaba.
--
-- Aplicada el 2026-11-02 como «retirar_delete_old_chat_messages».

drop function if exists public.delete_old_chat_messages();

-- Comprobación: tiene que salir null.
--
--   select to_regprocedure('public.delete_old_chat_messages()');

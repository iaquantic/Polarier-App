-- ============================================================================
-- 011 · Retirar el PDF guardado del informe mensual
-- ============================================================================
-- El PDF del informe mensual se genera en el cliente al pulsar «Descargar»
-- (src/lib/informeMensual.ts + informePdf.ts), igual que el diario. Nunca se
-- llegó a guardar ninguno: a 2026-10-19 no había filas con pdf_url ni objetos
-- en el bucket. Leo decidió retirarlos el 2026-10-19.
--
-- Quita la columna monthly_reports.pdf_url y la política del bucket
-- 'informes-mensuales' (migración 005). Ninguna vista depende de la columna.
--
-- El bucket NO se borra aquí: Supabase protege storage.buckets con el trigger
-- protect_buckets_delete. Se borró aparte el 2026-10-19, tras comprobar que
-- estaba vacío, activando storage.allow_delete_query solo en esa transacción
-- (o, si se repite en otro entorno, desde el panel: Storage → Delete bucket).
-- Aplicada el 2026-10-19 como «retirar_pdf_mensual».
-- ============================================================================

drop policy if exists informes_mensuales_read on storage.objects;

alter table public.monthly_reports drop column if exists pdf_url;

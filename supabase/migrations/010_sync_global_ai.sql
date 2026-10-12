-- =============================================================================
-- Sincronización del GLOBAL con global_ai
-- =============================================================================
-- Ejecutar en Supabase → SQL Editor (después de 001..009).
--
-- Contexto
-- --------
-- `global_ai` (el Global normalizado que consulta el agente Wisin) se cargó una
-- sola vez, el 2026-08-30, con un importador que no quedó en ningún sitio. Desde
-- entonces cada Modelo 1 actualiza el GLOBAL-CP<aa>.xlsx del VPS, pero Supabase
-- se quedó con la foto vieja, y además con los meses sin datos guardados como 0.
-- Ni `global_ai` ni `global_import_runs` tienen migración propia: se crearon a
-- mano. Esta migración no las toca, solo añade lo que hace falta para cargarlas.
--
-- Qué añade
-- ---------
-- * `global_ai_catalogo`: código de fila → partida, ruta (metric_path), grupo y
--   subgrupo. La jerarquía no se puede deducir del Excel (no sigue la sangría:
--   el código 2 no tiene subgrupo y el 30 es subgrupo de sí mismo), así que se
--   siembra con las 136 partidas que ya hay en `global_ai`. Un código nuevo que
--   no esté aquí entra con su nombre como ruta y sin grupo, y la pasada lo
--   avisa en `codigos_sin_catalogo` para completarlo a mano.
-- * `sync_global_ai(payload)`: recibe la salida de `sync_global_ai.py` (VPS,
--   carpeta Leslie, ver vault/Generacion-Documentos.md D6) y, en una sola
--   transacción, registra la pasada en `global_import_runs` y REEMPLAZA las
--   hojas recibidas (borra las filas de ese año y esas hojas, e inserta las
--   nuevas). Las claves salen de `global_key()` y el `row_uid` tiene el mismo
--   formato que el de la carga original, así que el agente no nota el cambio.
--
-- Salvaguardas
-- ------------
-- * Si alguna hoja llega con menos de 20 filas (un Excel roto o mal leído),
--   aborta sin tocar nada: reemplazar una hoja por casi nada borraría el Global.
-- * Todo va en la misma transacción: si algo falla, no queda ni la pasada a
--   medias ni la hoja vacía.
-- * Solo la ejecuta `service_role` (la credencial «Polarier» de n8n). Por
--   defecto Postgres da EXECUTE a PUBLIC, y con eso cualquiera con la anon key
--   podría vaciar el Global.
-- * `qp` = real / plan (nulo si falta alguno o el plan es 0), igual que la carga
--   original. `desviacion` es columna generada: no se escribe.
-- =============================================================================

create table if not exists public.global_ai_catalogo (
  codigo_fila integer primary key,
  partida     text not null,
  metric_path text not null,
  grupo       text,
  subgrupo    text,
  unidad      text not null default 'CUP',
  updated_at  timestamptz not null default now()
);

alter table public.global_ai_catalogo enable row level security;
-- Sin políticas, igual que global_ai: solo service_role la lee y la escribe.

insert into public.global_ai_catalogo (codigo_fila, partida, metric_path, grupo, subgrupo, unidad)
select distinct on (codigo_fila)
       codigo_fila, partida, metric_path, grupo, subgrupo, coalesce(unidad, 'CUP')
from public.global_ai
where codigo_fila is not null
order by codigo_fila, updated_at desc
on conflict (codigo_fila) do nothing;


create or replace function public.sync_global_ai(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_source      text  := p_payload->>'source_file';
  v_anio        int   := (p_payload->>'anio')::int;
  v_filas       jsonb := p_payload->'filas';
  v_hojas       text[];
  v_hoja_corta  text;
  v_run         uuid;
  v_borradas    int;
  v_insertadas  int;
  v_sin_catalogo int[];
begin
  if v_source is null or v_anio is null or jsonb_typeof(v_filas) is distinct from 'array' then
    raise exception 'sync_global_ai: payload sin source_file, anio o filas';
  end if;

  select array_agg(distinct f->>'hoja' order by f->>'hoja')
    into v_hojas
    from jsonb_array_elements(v_filas) f;

  if v_hojas is null then
    raise exception 'sync_global_ai: no llega ninguna fila';
  end if;

  select hoja into v_hoja_corta
    from (select f->>'hoja' hoja, count(*) n from jsonb_array_elements(v_filas) f group by 1) x
   where n < 20
   limit 1;
  if v_hoja_corta is not null then
    raise exception 'sync_global_ai: la hoja % llega con menos de 20 filas; no se toca nada', v_hoja_corta;
  end if;

  insert into global_import_runs (source_file, anio, status)
  values (v_source, v_anio, 'started')
  returning id into v_run;

  delete from global_ai
   where anio = v_anio
     and source_sheet = any (v_hojas);
  get diagnostics v_borradas = row_count;

  with f as (
    select *
      from jsonb_to_recordset(v_filas) as x(
        hoja text, polo text, polo_key text, periodo text, period_key text,
        codigo_fila int, partida_raw text, plan numeric, "real" numeric,
        cell_plan text, cell_real text, cell_qp text, fila_excel int)
  ), e as (
    select f.*,
           coalesce(c.partida, regexp_replace(btrim(f.partida_raw), '\s+', ' ', 'g'))     as partida,
           coalesce(c.metric_path, regexp_replace(btrim(f.partida_raw), '\s+', ' ', 'g')) as metric_path,
           c.grupo, c.subgrupo,
           coalesce(c.unidad, 'CUP') as unidad,
           c.codigo_fila is null      as sin_catalogo
      from f
      left join global_ai_catalogo c on c.codigo_fila = f.codigo_fila
  )
  insert into global_ai (
    row_uid, import_run_id, source_file, anio, source_sheet, scope_type,
    polo, polo_key, periodo, period_key, period_type, codigo_fila,
    partida, partida_key, metric_path, metric_path_key, grupo, subgrupo,
    plan, "real", qp, unidad, source_cell_plan, source_cell_real, source_cell_qp, raw)
  select v_anio || '|' || hoja || '|' || period_key || '|' || codigo_fila || '|' || global_key(metric_path),
         v_run, v_source, v_anio, hoja, 'polo',
         polo, polo_key, periodo, period_key, 'mes', codigo_fila,
         partida, global_key(partida), metric_path, global_key(metric_path), grupo, subgrupo,
         plan, "real",
         case when plan is not null and plan <> 0 and "real" is not null then "real" / plan end,
         unidad, cell_plan, cell_real, cell_qp,
         jsonb_build_object(
           'codigo_raw', codigo_fila,
           'partida_raw', partida_raw,
           'source_row_number', fila_excel,
           'sin_catalogo', sin_catalogo)
    from e;
  get diagnostics v_insertadas = row_count;

  select array_agg(distinct (f->>'codigo_fila')::int order by (f->>'codigo_fila')::int)
    into v_sin_catalogo
    from jsonb_array_elements(v_filas) f
   where not exists (select 1 from global_ai_catalogo c where c.codigo_fila = (f->>'codigo_fila')::int);

  update global_import_runs
     set status = 'ok',
         finished_at = now(),
         notes = jsonb_build_object(
           'hojas', v_hojas,
           'borradas', v_borradas,
           'insertadas', v_insertadas,
           'codigos_sin_catalogo', coalesce(to_jsonb(v_sin_catalogo), '[]'::jsonb),
           'resumen', p_payload->'resumen')::text
   where id = v_run;

  return jsonb_build_object(
    'run_id', v_run,
    'source_file', v_source,
    'anio', v_anio,
    'hojas', v_hojas,
    'borradas', v_borradas,
    'insertadas', v_insertadas,
    'codigos_sin_catalogo', coalesce(to_jsonb(v_sin_catalogo), '[]'::jsonb));
end;
$$;

revoke all on function public.sync_global_ai(jsonb) from public, anon, authenticated;
grant execute on function public.sync_global_ai(jsonb) to service_role;

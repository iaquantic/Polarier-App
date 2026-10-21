-- =============================================================================
-- 013 · Informe del Consejo de Dirección: disponibilidad por mes e informes
-- =============================================================================
-- Ejecutar en Supabase → SQL Editor (después de 001..012).
--
-- Contexto
-- --------
-- El apartado «Informe Consejo de Dirección» de Automatizaciones deja de pedir
-- un DOCX de tablas: el informe se genera eligiendo un mes, con los datos del
-- GLOBAL y de la TABLA CA (decisión de Leo, 2026-10-21; mapa de cada tabla en
-- vault/Informe-Consejo-Origen-Datos.md). La pantalla enseña, mes a mes, qué
-- datos hacen falta y si están, y solo deja generar cuando no falta nada.
--
-- Qué añade
-- ---------
-- * `tabla_ca_meses`: qué indicadores tiene la TABLA CA por año × mes × polo
--   (solo presente / ausente, sin valores). La carga `sync_tabla_ca_meses()`
--   con la salida de vps/Polarier/Leslie/CD/sync_tabla_ca.py, igual que
--   global_ai con sync_global_ai.py (010). Solo service_role.
-- * `tabla_ca_sync_runs`: cuándo se sincronizó cada año, para enseñarlo.
-- * `consejo_informes`: un informe por año y mes, con su estado y su fichero.
--   Lo ve cualquier usuario autenticado (decisión de Leo). Se escribe solo con
--   las funciones de abajo; el fichero y el estado final los pone la rama de
--   n8n que genera el informe, con la service role.
-- * `disponibilidad_informe_consejo(anio)`: por mes, cada dato que hace falta
--   y su estado (`ok`, `falta`, `sin_comprobar`). Lee global_ai y
--   tabla_ca_meses, que no tienen políticas, así que es SECURITY DEFINER; y
--   por eso mismo NO devuelve ningún importe.
-- * `fuentes_informe_consejo(anio)`: cuándo se actualizó cada fuente.
-- * `solicitar_informe_consejo(anio, mes)`: comprueba en el servidor que no
--   falta nada y deja el informe en `pendiente`. La app llama después al
--   webhook de n8n con el id.
-- * `anular_solicitud_informe_consejo(id, motivo)`: si el webhook no responde,
--   la app deja constancia del error.
-- * Bucket privado `informes-consejo`, legible por cualquier autenticado.
--
-- Reglas de disponibilidad (vault/Informe-Consejo-Origen-Datos.md)
-- ------------------------------------------------------------------
-- * GLOBAL: el mes tiene que estar cargado en las seis hojas de polo. Las
--   tablas económicas del informe llevan siempre los seis, cerrados incluidos.
--   «Cargado» = el mes tiene filas en global_ai (sync_global_ai solo emite los
--   meses en que «Ventas Totales» tiene plan o real).
-- * TABLA CA: solo para los polos OPERATIVOS ese mes. Operativo = el GLOBAL
--   tiene ventas de lavandería (código 33) en ese mes; si el GLOBAL aún no
--   trae el mes, se toma el mes anterior. Así los polos cerrados no salen
--   como «falta». A un operativo se le pide el CD completo, el plan y el año
--   anterior si tiene turistas-día ese mes; si no los tiene (venta residual
--   de un polo que cerró, p. ej. Holguín en marzo de 2026), solo los ingresos
--   de su CD.
-- * Lo tecleado en las hojas auxiliares de la TABLA CA (lencería, cuentas,
--   vehículos, vacantes, plan de consumos) no tiene mes: sale como
--   `sin_comprobar` y no bloquea (decisión de Leo, 2026-10-21).
-- =============================================================================

-- ─── TABLA CA resumida por mes ───────────────────────────────────────────────

create table if not exists public.tabla_ca_meses (
  anio       integer not null,
  mes        integer not null check (mes between 1 and 12),
  polo       text    not null,   -- habana | varadero | caibarien | cayo_coco | cayo_cruz | holguin
  indicador  text    not null,   -- clave de sync_tabla_ca.py (td_real, cdt, quimicos…)
  presente   boolean not null,
  fuente     text,               -- celda de origen, p. ej. «HABANA!H7»
  updated_at timestamptz not null default now(),
  primary key (anio, mes, polo, indicador)
);

alter table public.tabla_ca_meses enable row level security;
-- Sin políticas, como global_ai: solo service_role y las funciones de abajo.

create table if not exists public.tabla_ca_sync_runs (
  id         uuid primary key default gen_random_uuid(),
  anio       integer not null,
  archivo    text,
  filas      integer not null,
  created_at timestamptz not null default now()
);

alter table public.tabla_ca_sync_runs enable row level security;

create or replace function public.sync_tabla_ca_meses(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anio integer := (p_payload->>'anio')::integer;
  v_n    integer := coalesce(jsonb_array_length(p_payload->'filas'), 0);
begin
  if v_anio is null then
    raise exception 'sync_tabla_ca_meses: falta el año';
  end if;
  -- 12 meses × 6 polos × ~20 indicadores ≈ 1.400 filas. Con menos de 100 el
  -- Excel está roto o mal leído: no se reemplaza un año entero por casi nada.
  if v_n < 100 then
    raise exception 'sync_tabla_ca_meses: la TABLA CA % llegó con % filas; no se toca nada', v_anio, v_n;
  end if;

  delete from public.tabla_ca_meses where anio = v_anio;

  insert into public.tabla_ca_meses (anio, mes, polo, indicador, presente, fuente)
  select v_anio,
         (f->>'mes')::integer,
         f->>'polo',
         f->>'indicador',
         (f->>'presente')::boolean,
         f->>'fuente'
  from jsonb_array_elements(p_payload->'filas') as f;

  insert into public.tabla_ca_sync_runs (anio, archivo, filas)
  values (v_anio, p_payload->>'archivo', v_n);

  return jsonb_build_object('anio', v_anio, 'filas', v_n);
end;
$$;

revoke all on function public.sync_tabla_ca_meses(jsonb) from public, anon, authenticated;
grant execute on function public.sync_tabla_ca_meses(jsonb) to service_role;

-- ─── Informes generados ──────────────────────────────────────────────────────

create table if not exists public.consejo_informes (
  id             uuid primary key default gen_random_uuid(),
  anio           integer not null,
  mes            integer not null check (mes between 1 and 12),
  estado         text    not null default 'pendiente'
                 check (estado in ('pendiente', 'generando', 'listo', 'error')),
  solicitado_por uuid references auth.users(id) on delete set null,
  solicitado_at  timestamptz not null default now(),
  generado_at    timestamptz,
  archivo_path   text,          -- ruta en el bucket informes-consejo
  archivo_nombre text,
  error          text,
  unique (anio, mes)
);

alter table public.consejo_informes enable row level security;

drop policy if exists consejo_informes_select on public.consejo_informes;
create policy consejo_informes_select on public.consejo_informes
  for select to authenticated using (true);
-- Sin políticas de escritura: se escribe con solicitar/anular (abajo) o con
-- la service role desde n8n.

-- ─── Disponibilidad por mes ──────────────────────────────────────────────────

create or replace function public.disponibilidad_informe_consejo(p_anio integer)
returns table (
  mes       integer,
  grupo     text,      -- global | tabla_ca | tecleado
  orden     integer,
  requisito text,
  polo      text,
  estado    text,      -- ok | falta | sin_comprobar
  detalle   text
)
language sql
stable
security definer
set search_path = public
as $$
  with
  meses as (select generate_series(1, 12) as mes),
  polos (clave, nombre, prefijo, orden) as (values
    ('habana',    'La Habana', 'LH',  1),
    ('varadero',  'Varadero',  'VAR', 2),
    ('caibarien', 'Caibarién', 'CA',  3),
    ('cayo_coco', 'Cayo Coco', 'CC',  4),
    ('cayo_cruz', 'Cayo Cruz', 'CCZ', 5),
    ('holguin',   'Holguín',   'HOL', 6)
  ),
  g as (
    select p.clave as polo,
           substring(ga.period_key from '^\d{4}-(\d{2})$')::integer as mes,
           ga.codigo_fila,
           ga.real
    from public.global_ai ga
    join polos p on ga.source_sheet = p.prefijo || 'CP' || p_anio::text
    where ga.anio = p_anio
      and ga.period_type = 'mes'
      and ga.period_key ~ '^\d{4}-\d{2}$'
  ),
  global_mes as (select distinct polo, mes from g),
  lavanderia as (select distinct polo, mes from g where codigo_fila = 33 and coalesce(real, 0) <> 0),
  operativo as (
    select p.clave as polo, m.mes
    from polos p cross join meses m
    where exists (select 1 from lavanderia l where l.polo = p.clave and l.mes = m.mes)
       or (    not exists (select 1 from global_mes x where x.polo = p.clave and x.mes = m.mes)
           and exists (select 1 from lavanderia l where l.polo = p.clave and l.mes = m.mes - 1))
  ),
  indicadores (indicador, bloque, etiqueta, orden) as (values
    ('td_real',      'cd',       'turistas-día reales',          1),
    ('prod_real',    'cd',       'producción (kg)',              2),
    ('prendas',      'cd',       'prendas procesadas',           3),
    ('ingresos_cd',  'cd',       'ingresos (alquiler y lavado)', 4),
    ('trabajadores', 'cd',       'promedio de trabajadores',     5),
    ('cdt',          'cd',       'CDT',                          6),
    ('cdo',          'cd',       'CDO',                          7),
    ('diesel',       'cd',       'consumo de diésel',            8),
    ('electricidad', 'cd',       'consumo de electricidad',      9),
    ('agua',         'cd',       'consumo de agua',             10),
    ('calidad',      'cd',       'evaluación de calidad',       11),
    ('quimicos',     'cd',       'productos químicos',          12),
    ('td_plan',      'plan',     'turistas-día plan',            1),
    ('prod_plan',    'plan',     'producción plan',              2),
    ('td_real_aa',   'anterior', 'turistas-día',                 1),
    ('prod_real_aa', 'anterior', 'producción',                   2),
    ('ingresos_aa',  'anterior', 'ingresos',                     3)
  ),
  bloques (bloque, requisito, orden) as (values
    ('cd',       'TABLA CA · datos del CD del mes',          10),
    ('plan',     'TABLA CA · plan del mes',                  20),
    ('anterior', 'TABLA CA · mismo mes del año anterior',    30)
  ),
  sincronizado as (select exists (select 1 from public.tabla_ca_meses t where t.anio = p_anio) as si),
  tca_base as (
    select o.polo, o.mes, i.bloque, i.indicador, i.etiqueta, i.orden,
           coalesce(t.presente, false) as presente
    from operativo o
    cross join indicadores i
    left join public.tabla_ca_meses t
      on t.anio = p_anio and t.mes = o.mes and t.polo = o.polo and t.indicador = i.indicador
  ),
  -- Con turistas-día (plan o real) el polo trabajó ese mes y se le pide todo.
  -- Sin ellos, la venta de lavandería es residual (un polo que cerró) y su CD
  -- solo trae ingresos: se le piden solo esos.
  con_actividad as (
    select distinct polo, mes from tca_base
    where indicador in ('td_plan', 'td_real') and presente
  ),
  tca as (
    select b.* from tca_base b
    where b.indicador = 'ingresos_cd'
       or exists (select 1 from con_actividad a where a.polo = b.polo and a.mes = b.mes)
  ),
  tecleados (requisito, detalle, orden) as (values
    ('Montas por habitación y por cliente',  'Hoja «Montas»',                   100),
    ('Lencería en uso y lencería nueva',     'Hoja «Rechazo e inyecciones»',    101),
    ('Rechazo, mal uso, desmanche y retiro', 'Hoja «Rechazo e inyecciones»',    102),
    ('Inyecciones, inventarios y faltantes', 'Hojas «Rechazo e inyecciones» y «Montas»', 103),
    ('Cuentas por cobrar y por pagar',       'Hoja «Datos económicos»',          104),
    ('Disponibilidad de vehículos',          'Hoja «Datos económicos»',          105),
    ('Cargos vacantes',                      'Hoja «Datos económicos»',          106),
    ('Plan de los índices de consumo',       'Hoja «Energía»',                   107)
  )

  -- GLOBAL: los seis polos, siempre
  select m.mes, 'global', p.orden,
         'GLOBAL · mes cargado', p.nombre,
         case when exists (select 1 from global_mes x where x.polo = p.clave and x.mes = m.mes)
              then 'ok' else 'falta' end,
         case when exists (select 1 from global_mes x where x.polo = p.clave and x.mes = m.mes)
              then null else 'Falta subir su Modelo 1 de ese mes' end
  from meses m cross join polos p

  union all

  -- TABLA CA: un requisito por bloque y polo operativo
  select t.mes, 'tabla_ca', b.orden + p.orden,
         b.requisito, p.nombre,
         case when not (select si from sincronizado) then 'falta'
              when bool_and(t.presente) then 'ok'
              else 'falta' end,
         case when not (select si from sincronizado)
                then 'La TABLA CA ' || p_anio || ' todavía no se ha llevado a Supabase'
              when bool_and(t.presente) then null
              when not bool_or(t.presente)
                then case when b.bloque = 'cd' then 'Falta subir su CD de ese mes' else 'Sin datos' end
              else 'Falta: ' || string_agg(t.etiqueta, ', ' order by t.orden) filter (where not t.presente)
         end
  from tca t
  join bloques b on b.bloque = t.bloque
  join polos p on p.clave = t.polo
  group by t.mes, b.bloque, b.requisito, b.orden, p.nombre, p.orden

  union all

  -- Tecleado sin mes: se enseña, no se comprueba ni bloquea
  select m.mes, 'tecleado', k.orden, k.requisito, null::text, 'sin_comprobar', k.detalle
  from meses m cross join tecleados k
$$;

revoke all on function public.disponibilidad_informe_consejo(integer) from public, anon;
grant execute on function public.disponibilidad_informe_consejo(integer) to authenticated, service_role;

create or replace function public.fuentes_informe_consejo(p_anio integer)
returns table (fuente text, actualizado_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select 'global', max(updated_at) from public.global_ai where anio = p_anio
  union all
  select 'tabla_ca', max(created_at) from public.tabla_ca_sync_runs where anio = p_anio
$$;

revoke all on function public.fuentes_informe_consejo(integer) from public, anon;
grant execute on function public.fuentes_informe_consejo(integer) to authenticated, service_role;

-- ─── Pedir y anular ──────────────────────────────────────────────────────────

create or replace function public.solicitar_informe_consejo(p_anio integer, p_mes integer)
returns public.consejo_informes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_falta integer;
  v_fila  public.consejo_informes;
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesión';
  end if;
  if p_mes not between 1 and 12 then
    raise exception 'Mes no válido: %', p_mes;
  end if;

  select count(*) into v_falta
  from public.disponibilidad_informe_consejo(p_anio) d
  where d.mes = p_mes and d.estado = 'falta';
  if v_falta > 0 then
    raise exception 'Faltan % datos para generar el informe de %/%', v_falta, p_mes, p_anio;
  end if;

  insert into public.consejo_informes (anio, mes, estado, solicitado_por, solicitado_at, error)
  values (p_anio, p_mes, 'pendiente', auth.uid(), now(), null)
  on conflict (anio, mes) do update
     set estado = 'pendiente', solicitado_por = auth.uid(), solicitado_at = now(), error = null
   where public.consejo_informes.estado not in ('pendiente', 'generando')
  returning * into v_fila;

  if v_fila.id is null then
    raise exception 'Ya se está generando el informe de ese mes';
  end if;
  return v_fila;
end;
$$;

revoke all on function public.solicitar_informe_consejo(integer, integer) from public, anon;
grant execute on function public.solicitar_informe_consejo(integer, integer) to authenticated;

create or replace function public.anular_solicitud_informe_consejo(p_id uuid, p_motivo text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.consejo_informes
     set estado = 'error', error = left(coalesce(p_motivo, 'Sin detalle'), 500)
   where id = p_id and estado = 'pendiente' and solicitado_por = auth.uid();
$$;

revoke all on function public.anular_solicitud_informe_consejo(uuid, text) from public, anon;
grant execute on function public.anular_solicitud_informe_consejo(uuid, text) to authenticated;

-- ─── Ficheros ────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('informes-consejo', 'informes-consejo', false)
on conflict (id) do nothing;

drop policy if exists "informes_consejo_read" on storage.objects;
create policy "informes_consejo_read" on storage.objects for select to authenticated
  using (bucket_id = 'informes-consejo');
-- Escritura solo con la service role (n8n), que no pasa por RLS.

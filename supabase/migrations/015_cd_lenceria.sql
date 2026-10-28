-- =============================================================================
-- 015 · Informe del Consejo: la lencería del CD, por mes
-- =============================================================================
-- Ejecutar en Supabase → SQL Editor (después de 001..014).
--
-- Contexto
-- --------
-- Las respuestas al formulario sobre la TABLA CA (2026-10-28) dicen que la
-- lencería del informe sale del CD de cada polo y que las hojas auxiliares de
-- la TABLA CA no guardan histórico. La TABLA CA no se toca (decisión de Leo,
-- 2026-10-22): lo del CD se guarda aquí, por mes, solo para el informe.
-- Diseño en vault/Informe-Consejo-Lenceria-CD.md.
--
-- Qué añade
-- ---------
-- * `cd_lenceria`: una fila por año × mes × polo × bloque, con lo que saca
--   vps/Polarier/Leslie/CD/cd_lenceria.py del CD. Sin políticas, como
--   tabla_ca_meses: solo service_role y las funciones de abajo.
-- * `cargar_cd_lenceria(payload)`: la llama n8n (rama CD -) con la salida del
--   extractor; reemplaza los ocho bloques de ese polo y mes.
-- * `disponibilidad_informe_consejo(anio)`: nuevo grupo `cd_lenceria`.
--     - Un polo con actividad ese mes (con turistas-día) sin lencería cargada
--       es «falta»: bloquea la generación.
--     - Con la lencería cargada es «ok», aunque algún bloque viniera vacío en
--       el CD; el detalle dice cuáles, y el informe los deja en blanco.
--     - Los polos cerrados no cuentan: lo logístico va a 0 (P31).
--   Montas, rechazo, mal uso, desmanche, retiro, inyecciones y faltantes salen
--   del grupo «tecleado».
-- * `lenceria_informe_consejo(anio, meses)`: los bloques de esos meses (y de
--   los mismos meses del año anterior) para preparar_consejo.py. Solo
--   service_role: devuelve cantidades.
-- =============================================================================

create table if not exists public.cd_lenceria (
  anio       integer not null,
  mes        integer not null check (mes between 1 and 12),
  polo       text    not null
             check (polo in ('habana', 'varadero', 'caibarien', 'cayo_coco', 'cayo_cruz', 'holguin')),
  bloque     text    not null
             check (bloque in ('montas_habitacion', 'montas_cliente', 'rechazo', 'mal_uso',
                               'inyecciones', 'desmanche', 'retiro', 'faltantes')),
  estado     text    not null check (estado in ('ok', 'vacio', 'no_encontrado')),
  valores    jsonb   not null default '{}'::jsonb,   -- prenda → medida → valor
  totales    jsonb   not null default '{}'::jsonb,   -- TD de las montas por cliente, hoteles inventariados…
  avisos     jsonb   not null default '[]'::jsonb,
  fichero    text,                                    -- nombre del CD
  hoja       text,
  celda      text,
  cargado_at timestamptz not null default now(),
  primary key (anio, mes, polo, bloque)
);

alter table public.cd_lenceria enable row level security;
-- Sin políticas: solo service_role y las funciones SECURITY DEFINER de abajo.

create or replace function public.cargar_cd_lenceria(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anio  integer := (p_payload->>'anio')::integer;
  v_mes   integer := (p_payload->>'mes')::integer;
  v_polo  text    := p_payload->>'polo';
  v_n     integer;
begin
  if coalesce((p_payload->>'ok')::boolean, false) is not true then
    raise exception 'cargar_cd_lenceria: el extractor no terminó bien: %', coalesce(p_payload->>'error', 'sin detalle');
  end if;
  if v_anio is null or v_mes is null or v_polo is null then
    raise exception 'cargar_cd_lenceria: faltan año, mes o polo';
  end if;
  select count(*) into v_n from jsonb_object_keys(coalesce(p_payload->'bloques', '{}'::jsonb));
  if v_n <> 8 then
    raise exception 'cargar_cd_lenceria: llegaron % bloques, se esperaban 8', v_n;
  end if;

  delete from public.cd_lenceria where anio = v_anio and mes = v_mes and polo = v_polo;

  insert into public.cd_lenceria (anio, mes, polo, bloque, estado, valores, totales, avisos,
                                  fichero, hoja, celda)
  select v_anio, v_mes, v_polo, b.key,
         b.value->>'estado',
         coalesce(b.value->'valores', '{}'::jsonb),
         coalesce(b.value->'totales', '{}'::jsonb),
         coalesce(b.value->'avisos', '[]'::jsonb),
         p_payload->>'fichero',
         b.value->>'hoja',
         b.value->>'celda'
  from jsonb_each(p_payload->'bloques') as b;

  return jsonb_build_object(
    'anio', v_anio, 'mes', v_mes, 'polo', v_polo,
    'ok', (select count(*) from public.cd_lenceria
            where anio = v_anio and mes = v_mes and polo = v_polo and estado = 'ok'),
    'sin_rellenar', (select coalesce(jsonb_agg(bloque order by bloque), '[]'::jsonb) from public.cd_lenceria
                      where anio = v_anio and mes = v_mes and polo = v_polo and estado <> 'ok'));
end;
$$;

revoke all on function public.cargar_cd_lenceria(jsonb) from public, anon, authenticated;
grant execute on function public.cargar_cd_lenceria(jsonb) to service_role;

create or replace function public.lenceria_informe_consejo(p_anio integer, p_meses integer[])
returns setof public.cd_lenceria
language sql
stable
security definer
set search_path = public
as $$
  select * from public.cd_lenceria
  where (anio = p_anio or anio = p_anio - 1) and mes = any (p_meses)
  order by anio, mes, polo, bloque
$$;

revoke all on function public.lenceria_informe_consejo(integer, integer[]) from public, anon, authenticated;
grant execute on function public.lenceria_informe_consejo(integer, integer[]) to service_role;

-- ─── Disponibilidad por mes (la de 013 con el grupo cd_lenceria) ─────────────

create or replace function public.disponibilidad_informe_consejo(p_anio integer)
returns table (
  mes       integer,
  grupo     text,      -- global | tabla_ca | cd_lenceria | tecleado
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
  -- Lencería del CD: solo a los polos que lavaron ese mes (P31).
  bloques_lenceria (bloque, etiqueta, orden) as (values
    ('montas_habitacion', 'montas por habitación', 1),
    ('montas_cliente',    'montas por cliente',    2),
    ('rechazo',           'rechazo',               3),
    ('mal_uso',           'mal uso',               4),
    ('desmanche',         'desmanche',             5),
    ('retiro',            'retiro',                6),
    ('inyecciones',       'inyecciones',           7),
    ('faltantes',         'faltantes',             8)
  ),
  lenceria as (
    select a.polo, a.mes,
           count(l.bloque)                                         as cargados,
           string_agg(b.etiqueta, ', ' order by b.orden)
             filter (where l.estado is not null and l.estado <> 'ok') as sin_rellenar
    from con_actividad a
    cross join bloques_lenceria b
    left join public.cd_lenceria l
      on l.anio = p_anio and l.mes = a.mes and l.polo = a.polo and l.bloque = b.bloque
    group by a.polo, a.mes
  ),
  tecleados (requisito, detalle, orden) as (values
    ('Lencería en uso, lencería nueva y arribos', 'Hoja «Rechazo e inyecciones»',                    100),
    ('Inventarios realizados',                    'Hojas «Rechazo e inyecciones» y «Datos económicos»', 101),
    ('Cuentas por cobrar y por pagar',            'Hoja «Datos económicos»',                         104),
    ('Disponibilidad de vehículos',               'Hoja «Datos económicos»',                         105),
    ('Cargos vacantes',                           'Hoja «Datos económicos»',                         106),
    ('Plan de los índices de consumo',            'Hoja «Energía»',                                  107)
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

  -- Lencería del CD: un requisito por polo con actividad
  select l.mes, 'cd_lenceria', 50 + p.orden,
         'CD · lencería del mes', p.nombre,
         case when l.cargados = 0 then 'falta' else 'ok' end,
         case when l.cargados = 0 then 'Falta cargar la lencería de su CD de ese mes'
              when l.sin_rellenar is not null then 'Sin rellenar en el CD: ' || l.sin_rellenar
              else null end
  from lenceria l
  join polos p on p.clave = l.polo

  union all

  -- Tecleado sin mes: se enseña, no se comprueba ni bloquea
  select m.mes, 'tecleado', k.orden, k.requisito, null::text, 'sin_comprobar', k.detalle
  from meses m cross join tecleados k
$$;

revoke all on function public.disponibilidad_informe_consejo(integer) from public, anon;
grant execute on function public.disponibilidad_informe_consejo(integer) to authenticated, service_role;

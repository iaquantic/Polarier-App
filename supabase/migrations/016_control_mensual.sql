-- =============================================================================
-- Formulario unificado de control (Excel «Modelo Mensual»)
-- =============================================================================
-- Ejecutar en Supabase → SQL Editor (después de 001..015), DESPUÉS de desplegar el
-- frontend: desactiva los tres formularios antiguos, así que la versión anterior de
-- la app se quedaría sin ellos. La nueva, sin esta migración, sigue ofreciendo los
-- de antes. Luego hay que cargar las metas del SLA en form_definitions.config.metas:
-- son cifras del contrato y no van aquí, porque el repositorio es público.
--
-- Qué cambia
-- ----------
-- Lencería, Producción y Cuadrador se sustituyen por un único parte diario, y lo
-- que en el Excel es mensual pasa a un documento por hotel y mes:
--
--   form_submissions (tipo 'control')  lo del día: jornada, lavado, procesado e
--                                      inventario. Sigue siendo una fila por día,
--                                      para no mandar el mes entero en cada guardado.
--   control_mes                        lo del mes: datos, KPI, encuestas, equipos,
--                                      revisiones y síntesis. Lleva además `resumen`,
--                                      la hoja Resumen ya calculada por la app, que
--                                      es lo que lee la routine del informe mensual.
--   control_eventos                    incidencias, retiros, mantenimiento y
--                                      acciones. Van aparte porque se abren un día
--                                      y se cierran otro.
--
-- Las cifras oficiales las calcula SOLO la app (src/lib/control.ts), que está
-- contrastada con las fórmulas del Excel. Aquí no se replican: repetir esa lógica en
-- SQL obligaría a mantener dos veces más de 20 000 fórmulas.
--
-- Qué NO cambia
-- -------------
-- * Los partes antiguos se conservan y se pueden seguir abriendo. Sus definiciones
--   solo se desactivan.
-- * La asimetría de la 008 en los partes: el administrador lee los de todo el hotel
--   y cada uno escribe solo los suyos.
-- * `control_mes` y `control_eventos` son de todo el hotel, no de una persona: una
--   incidencia que abre uno la puede cerrar otro. Por eso guardan `updated_by`.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Nuevo tipo de formulario y definición por hotel
-- -----------------------------------------------------------------------------
alter table form_definitions drop constraint if exists form_definitions_tipo_check;
alter table form_definitions add constraint form_definitions_tipo_check
  check (tipo in ('produccion','cuadrador','lenceria','control'));

insert into form_definitions (hotel_id, tipo, nombre, schema_version, config, activo)
select h.id, 'control', 'Parte diario de control', 1, '{"layout":"control"}'::jsonb, true
from hoteles h
on conflict (hotel_id, tipo, schema_version) do nothing;

-- Los partes guardados siguen apuntando a estas definiciones; solo dejan de
-- ofrecerse para rellenar.
update form_definitions set activo = false where tipo in ('produccion','cuadrador','lenceria');

-- Nombres de la hoja. Los datos van por UUID, así que no toca ninguna submission.
update catalogo_prendas p
set nombre = v.nombre
from (values
  ('F',  'Funda de almohada'),
  ('TA', 'Toalla alfombra'),
  ('TF', 'Toalla facial'),
  ('TP', 'Toalla de piscina')
) as v(codigo, nombre)
where p.codigo = v.codigo;


-- -----------------------------------------------------------------------------
-- 2. control_mes: lo que se rellena una vez al mes
-- -----------------------------------------------------------------------------
create table if not exists control_mes (
  id          uuid primary key default gen_random_uuid(),
  hotel_id    uuid not null references hoteles(id) on delete cascade,
  anio        int  not null,
  mes         int  not null check (mes between 1 and 12),
  data        jsonb not null default '{}'::jsonb,
  -- Hoja Resumen calculada por la app al guardar. Instantánea para la routine.
  resumen     jsonb not null default '{}'::jsonb,
  resumen_at  timestamptz,
  updated_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (hotel_id, anio, mes)
);

drop trigger if exists trg_control_mes_updated on control_mes;
create trigger trg_control_mes_updated before update on control_mes
  for each row execute function set_updated_at();

comment on table control_mes is
  'Documento mensual del formulario de control por hotel (Datos_mes, KPI_calidad, Equipos, revisiones y síntesis). resumen = hoja Resumen ya calculada por la app; es lo que lee la routine del informe mensual.';


-- -----------------------------------------------------------------------------
-- 3. control_eventos: novedades que se abren un día y se cierran otro
-- -----------------------------------------------------------------------------
create table if not exists control_eventos (
  id          uuid primary key default gen_random_uuid(),
  hotel_id    uuid not null references hoteles(id) on delete cascade,
  tipo        text not null check (tipo in ('incidencia','retiro','mantenimiento','accion')),
  -- Fecha del hecho: decide a qué mes pertenece (en mantenimiento, la planificada).
  fecha       date not null,
  data        jsonb not null default '{}'::jsonb,
  user_id     uuid references auth.users(id) on delete set null,
  updated_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_control_eventos_hotel_fecha on control_eventos(hotel_id, fecha desc);

drop trigger if exists trg_control_eventos_updated on control_eventos;
create trigger trg_control_eventos_updated before update on control_eventos
  for each row execute function set_updated_at();

comment on table control_eventos is
  'Novedades del formulario de control: incidencias, retiros/faltantes/mal uso, mantenimiento y acciones de mejora. data guarda las columnas de la hoja de cada tipo.';


-- -----------------------------------------------------------------------------
-- 4. RLS: de todo el hotel
-- -----------------------------------------------------------------------------
alter table control_mes     enable row level security;
alter table control_eventos enable row level security;

drop policy if exists "control_mes_select" on control_mes;
create policy "control_mes_select" on control_mes for select
  using (has_hotel_access(hotel_id));

drop policy if exists "control_mes_insert" on control_mes;
create policy "control_mes_insert" on control_mes for insert
  with check (has_hotel_access(hotel_id));

drop policy if exists "control_mes_update" on control_mes;
create policy "control_mes_update" on control_mes for update
  using (has_hotel_access(hotel_id))
  with check (has_hotel_access(hotel_id));

drop policy if exists "control_eventos_select" on control_eventos;
create policy "control_eventos_select" on control_eventos for select
  using (has_hotel_access(hotel_id));

drop policy if exists "control_eventos_insert" on control_eventos;
create policy "control_eventos_insert" on control_eventos for insert
  with check (has_hotel_access(hotel_id));

drop policy if exists "control_eventos_update" on control_eventos;
create policy "control_eventos_update" on control_eventos for update
  using (has_hotel_access(hotel_id))
  with check (has_hotel_access(hotel_id));

drop policy if exists "control_eventos_delete" on control_eventos;
create policy "control_eventos_delete" on control_eventos for delete
  using (has_hotel_access(hotel_id));


-- -----------------------------------------------------------------------------
-- 5. Aplanado: refrescar_audit_datos con la rama 'control'
-- -----------------------------------------------------------------------------
-- Misma función que en la 006 más el tipo nuevo. `valor` pasa a ser kg en los partes
-- de control: es la medida de producción de la hoja, y es lo que clasifica cada día
-- contra la mediana del mes en `audit_mes_dias`. Replica la serie del dashboard
-- (`src/lib/controlDashboard.ts`); si cambia allí, hay que cambiarlo aquí.
create or replace function refrescar_audit_datos(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  s          form_submissions%rowtype;
  d          form_definitions%rowtype;
  v_hotel    text;
  v_polo     text;
  m          jsonb;    -- métricas de `totales`, aplanadas
  cab        jsonb;    -- data.cabecera
  v_valor    numeric;
  v_kg       numeric;
  v_inv      numeric;
  v_periodo  text;
begin
  select * into s from form_submissions where id = p_submission_id;

  -- Si la submission ya no existe, solo hay que limpiar.
  if not found then
    delete from audit_daily         where submission_id = p_submission_id;
    delete from audit_daily_detalle where submission_id = p_submission_id;
    return;
  end if;

  select * into d from form_definitions where id = s.form_definition_id;
  select h.nombre, po.nombre
    into v_hotel, v_polo
    from hoteles h
    left join polos_turisticos po on po.id = h.polo_id
   where h.id = s.hotel_id;

  m         := audit_flat_metricas(s.totales);
  cab       := coalesce(s.data -> 'cabecera', '{}'::jsonb);
  v_periodo := to_char(s.fecha, 'YYYY-MM');

  -- Métrica principal: MISMO criterio que leerTotales() en dashboard.ts.
  if d.tipo = 'control' then
    -- Kg registrados en el parte, aunque el día siga abierto. Las cifras oficiales
    -- del mes (solo días cerrados) están en control_mes.resumen.
    v_valor := coalesce(audit_to_num(m -> 'kg'), 0);
    v_kg    := v_valor;
    v_inv   := null;
  elsif d.tipo = 'cuadrador' then
    v_valor := coalesce(audit_to_num(m -> 'prenda'), audit_to_num(m -> 'produccion'), 0);
    v_kg    := coalesce(audit_to_num(m -> 'kg'), 0);
    v_inv   := null;
  elsif d.tipo = 'lenceria' then
    -- `general` en lencería es INVENTARIO (dotación), no producción.
    v_valor := coalesce(audit_to_num(m -> 'general'), 0);
    v_kg    := 0;
    v_inv   := v_valor;
  else
    v_valor := coalesce(audit_to_num(m -> 'produccion'),
                        audit_to_num(m -> 'total'),
                        audit_to_num(m -> 'general'), 0);
    v_kg    := coalesce(audit_to_num(m -> 'kg'), 0);
    v_inv   := null;
  end if;

  insert into audit_daily (
    submission_id, hotel_id, hotel, polo, form_definition_id, tipo, formulario, user_id,
    fecha, anio, mes, dia, periodo, dia_semana,
    estado, turno, operario, jefe_turno,
    valor, kg, inventario, declaracion, produccion, pendientes,
    faltante, roturas, manchas, total_pmr, n_vales, n_lineas,
    metricas, actualizado_at
  ) values (
    s.id, s.hotel_id, coalesce(v_hotel, '?'), v_polo,
    s.form_definition_id, d.tipo, d.nombre, s.user_id,
    s.fecha,
    extract(year  from s.fecha)::int,
    extract(month from s.fecha)::int,
    extract(day   from s.fecha)::int,
    v_periodo,
    audit_dia_semana(s.fecha),
    s.estado,
    nullif(cab ->> 'turno', ''),
    nullif(cab ->> 'operario', ''),
    nullif(cab ->> 'jefe_turno', ''),
    v_valor,
    v_kg,
    v_inv,
    -- `declaracion` en cuadrador y control, `dec_jurada` en producción: misma idea.
    coalesce(audit_to_num(m -> 'declaracion'), audit_to_num(m -> 'dec_jurada')),
    audit_to_num(m -> 'produccion'),
    -- `pendientes` (producción, control) vs `pendiente` (cuadrador).
    coalesce(audit_to_num(m -> 'pendientes'), audit_to_num(m -> 'pendiente')),
    audit_to_num(m -> 'faltante'),
    audit_to_num(m -> 'roturas'),
    nullif(
      coalesce(audit_to_num(m -> 'm_rosa'),   0) +
      coalesce(audit_to_num(m -> 'm_negra'),  0) +
      coalesce(audit_to_num(m -> 'm_oxido'),  0) +
      coalesce(audit_to_num(m -> 'm_varias'), 0),
      0),
    audit_to_num(m -> 'total'),
    case
      when jsonb_typeof(s.data -> 'vales') = 'array'
        then jsonb_array_length(s.data -> 'vales')
      when jsonb_typeof(s.data -> 'lavado') = 'array'
        then jsonb_array_length(s.data -> 'lavado')
    end,
    case
      when jsonb_typeof(s.data -> 'lineas') = 'array'
        then jsonb_array_length(s.data -> 'lineas')
      when jsonb_typeof(s.data -> 'categorias') = 'array' then (
        select coalesce(sum(jsonb_array_length(coalesce(c -> 'lineas', '[]'::jsonb))), 0)::int
        from jsonb_array_elements(s.data -> 'categorias') c)
      when d.tipo = 'control' then
        coalesce(audit_to_num(m -> 'registros_lavado'), 0)::int
        + coalesce(audit_to_num(m -> 'registros_procesado'), 0)::int
    end,
    m,
    now()
  )
  on conflict (submission_id) do update set
    hotel_id = excluded.hotel_id, hotel = excluded.hotel, polo = excluded.polo,
    form_definition_id = excluded.form_definition_id, tipo = excluded.tipo,
    formulario = excluded.formulario, user_id = excluded.user_id,
    fecha = excluded.fecha, anio = excluded.anio, mes = excluded.mes, dia = excluded.dia,
    periodo = excluded.periodo, dia_semana = excluded.dia_semana,
    estado = excluded.estado, turno = excluded.turno,
    operario = excluded.operario, jefe_turno = excluded.jefe_turno,
    valor = excluded.valor, kg = excluded.kg, inventario = excluded.inventario,
    declaracion = excluded.declaracion, produccion = excluded.produccion,
    pendientes = excluded.pendientes, faltante = excluded.faltante,
    roturas = excluded.roturas, manchas = excluded.manchas, total_pmr = excluded.total_pmr,
    n_vales = excluded.n_vales, n_lineas = excluded.n_lineas,
    metricas = excluded.metricas, actualizado_at = now();

  -- ---------------------------------------------------------------------------
  -- Detalle: se reconstruye entero en cada refresco.
  -- ---------------------------------------------------------------------------
  delete from audit_daily_detalle where submission_id = p_submission_id;

  if d.tipo = 'control' then
    -- Lavado: data.lavado[].lineas[]. Métricas `lavado_recibidas`, `lavado_kg`…
    if jsonb_typeof(s.data -> 'lavado') = 'array' then
      insert into audit_daily_detalle (
        submission_id, hotel_id, fecha, periodo, tipo, vale, prenda, metrica, valor)
      select
        s.id, s.hotel_id, s.fecha, v_periodo, 'control',
        nullif(v ->> 'vale', ''),
        nullif(l ->> 'prenda', ''),
        'lavado_' || kv.metrica,
        kv.n
      from jsonb_array_elements(s.data -> 'lavado') v
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(v -> 'lineas') = 'array' then v -> 'lineas' else '[]'::jsonb end) l
      cross join lateral (values
        ('recibidas',         audit_to_num(l -> 'recibidas')),
        ('pendiente_inicial', audit_to_num(l -> 'pendiente_inicial')),
        ('lavadas',           audit_to_num(l -> 'lavadas')),
        ('kg',                audit_to_num(l -> 'kg'))
      ) as kv(metrica, n)
      where kv.n is not null;
    end if;

    -- Procesado: data.procesado[].lineas[]. Métricas `secado_conforme`,
    -- `control_final_roturas`… para poder preguntar por área y prenda.
    if jsonb_typeof(s.data -> 'procesado') = 'array' then
      insert into audit_daily_detalle (
        submission_id, hotel_id, fecha, periodo, tipo, vale, prenda, metrica, valor)
      select
        s.id, s.hotel_id, s.fecha, v_periodo, 'control',
        nullif(t ->> 'vale', ''),
        nullif(l ->> 'prenda', ''),
        replace(lower(coalesce(t ->> 'area', 'sin_area')), ' ', '_') || '_' || kv.metrica,
        kv.n
      from jsonb_array_elements(s.data -> 'procesado') t
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(t -> 'lineas') = 'array' then t -> 'lineas' else '[]'::jsonb end) l
      cross join lateral (values
        ('declaradas', audit_to_num(l -> 'declaradas')),
        ('conforme',   audit_to_num(l -> 'conforme')),
        ('m_rosa',     audit_to_num(l -> 'm_rosa')),
        ('m_negra',    audit_to_num(l -> 'm_negra')),
        ('m_oxido',    audit_to_num(l -> 'm_oxido')),
        ('m_otras',    audit_to_num(l -> 'm_otras')),
        ('roturas',    audit_to_num(l -> 'roturas')),
        ('pendientes', audit_to_num(l -> 'pendientes'))
      ) as kv(metrica, n)
      where kv.n is not null;
    end if;

    -- Inventario: data.inventario.conteos = { <ubicacion_uuid>: { <prenda_uuid>: n } }.
    if jsonb_typeof(s.data -> 'inventario' -> 'conteos') = 'object' then
      insert into audit_daily_detalle (
        submission_id, hotel_id, fecha, periodo, tipo, prenda, ubicacion, metrica, valor)
      select
        s.id, s.hotel_id, s.fecha, v_periodo, 'control',
        coalesce(cp.nombre, 'Prenda ' || pr.key),
        coalesce(cu.nombre, ux.nombre, 'Ubicación ' || ub.key),
        'cantidad',
        n.n
      from jsonb_each(s.data -> 'inventario' -> 'conteos') ub
      cross join lateral jsonb_each(
        case when jsonb_typeof(ub.value) = 'object' then ub.value else '{}'::jsonb end) pr
      cross join lateral (select audit_to_num(pr.value) as n) n
      left join catalogo_prendas     cp on cp.id::text = pr.key
      left join catalogo_ubicaciones cu on cu.id::text = ub.key
      left join lateral (
        select e ->> 'nombre' as nombre
        from jsonb_array_elements(
          case when jsonb_typeof(s.data -> 'inventario' -> 'extra') = 'array'
               then s.data -> 'inventario' -> 'extra' else '[]'::jsonb end) e
        where e ->> 'id' = ub.key
        limit 1
      ) ux on true
      where n.n is not null;
    end if;

  elsif d.tipo = 'lenceria' then
    -- data = { <ubicacion_uuid>: { <prenda_uuid>: n }, _ubicaciones: [...] }
    -- `_ubicaciones` son las ubicaciones que el supervisor añade a mano: viven en
    -- el mismo nivel del objeto, así que hay que excluirlas del recorrido y
    -- usarlas para resolver nombres que no están en el catálogo.
    insert into audit_daily_detalle (
      submission_id, hotel_id, fecha, periodo, tipo, prenda, ubicacion, metrica, valor)
    select
      s.id, s.hotel_id, s.fecha, v_periodo, 'lenceria',
      coalesce(cp.nombre, 'Prenda ' || pr.key),
      coalesce(cu.nombre, ux.nombre, 'Ubicación ' || ub.key),
      'cantidad',
      n.n
    from jsonb_each(s.data) ub
    cross join lateral jsonb_each(ub.value) pr
    cross join lateral (select audit_to_num(pr.value) as n) n
    left join catalogo_prendas     cp on cp.id::text = pr.key
    left join catalogo_ubicaciones cu on cu.id::text = ub.key
    left join lateral (
      select e ->> 'nombre' as nombre
      from jsonb_array_elements(coalesce(s.data -> '_ubicaciones', '[]'::jsonb)) e
      where e ->> 'id' = ub.key
      limit 1
    ) ux on true
    where ub.key <> '_ubicaciones'
      and jsonb_typeof(ub.value) = 'object'
      and n.n is not null;

  elsif jsonb_typeof(s.data -> 'vales') = 'array' then
    -- Producción: data.vales[].prendas[].valores{}
    -- `hora_inicio` / `hora_fin` son texto y audit_to_num los descarta solo.
    insert into audit_daily_detalle (
      submission_id, hotel_id, fecha, periodo, tipo, vale, prenda, metrica, valor)
    select
      s.id, s.hotel_id, s.fecha, v_periodo, d.tipo,
      nullif(vale ->> 'nombre', ''),
      nullif(pr ->> 'prenda', ''),
      kv.key,
      n.n
    from jsonb_array_elements(s.data -> 'vales') vale
    cross join lateral jsonb_array_elements(coalesce(vale -> 'prendas', '[]'::jsonb)) pr
    cross join lateral jsonb_each(coalesce(pr -> 'valores', '{}'::jsonb)) kv
    cross join lateral (select audit_to_num(kv.value) as n) n
    where n.n is not null;

  elsif jsonb_typeof(s.data -> 'lineas') = 'array' then
    -- Cuadrador Lavatín: una línea por prenda. `produccion_prenda` y
    -- `produccion_kg` son columnas DERIVADAS que la app calcula al vuelo y no
    -- persiste (ver CuadradorForm.tsx); aquí sí se materializan.
    insert into audit_daily_detalle (
      submission_id, hotel_id, fecha, periodo, tipo, vale, prenda, metrica, valor)
    select
      s.id, s.hotel_id, s.fecha, v_periodo, d.tipo,
      lin.vale, lin.prenda, met.metrica, met.valor
    from (
      select
        nullif(l -> 'valores' ->> 'vale', '')          as vale,
        nullif(l ->> 'prenda', '')                     as prenda,
        audit_to_num(l -> 'valores' -> 'declaracion')  as declaracion,
        audit_to_num(l -> 'valores' -> 'pendiente')    as pendiente
      from jsonb_array_elements(s.data -> 'lineas') l
    ) lin
    left join lateral (
      select audit_to_num(e -> 'peso') as peso
      from jsonb_array_elements(coalesce(d.config -> 'prendas_peso', '[]'::jsonb)) e
      where e ->> 'nombre' = lin.prenda
      limit 1
    ) pe on true
    cross join lateral (values
      ('declaracion',       lin.declaracion),
      ('pendiente',         lin.pendiente),
      ('produccion_prenda', greatest(0, coalesce(lin.declaracion, 0) - coalesce(lin.pendiente, 0))),
      ('produccion_kg',     greatest(0, coalesce(lin.declaracion, 0) - coalesce(lin.pendiente, 0))
                            * coalesce(pe.peso, 0))
    ) as met(metrica, valor)
    -- Una línea sin declaración ni pendiente está vacía: no genera filas.
    where (lin.declaracion is not null or lin.pendiente is not null)
      and met.valor is not null;

  elsif jsonb_typeof(s.data -> 'categorias') = 'array' then
    -- Layout `categorias` (migración 002, sustituido por 003 pero aún en datos).
    insert into audit_daily_detalle (
      submission_id, hotel_id, fecha, periodo, tipo, vale, prenda, metrica, valor)
    select
      s.id, s.hotel_id, s.fecha, v_periodo, d.tipo,
      nullif(l -> 'valores' ->> 'vale', ''),
      nullif(cat ->> 'nombre', ''),
      kv.key,
      n.n
    from jsonb_array_elements(s.data -> 'categorias') cat
    cross join lateral jsonb_array_elements(coalesce(cat -> 'lineas', '[]'::jsonb)) l
    cross join lateral jsonb_each(coalesce(l -> 'valores', '{}'::jsonb)) kv
    cross join lateral (select audit_to_num(kv.value) as n) n
    where n.n is not null
      and kv.key <> 'vale';
  end if;
end;
$fn$;

-- `create or replace` conserva los permisos, pero se repite por si acaso: es
-- SECURITY DEFINER y PostgREST expone las funciones de `public`.
revoke execute on function refrescar_audit_datos(uuid) from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 6. audit_mes_dotacion: dotación frente a lo contado, también en los partes nuevos
-- -----------------------------------------------------------------------------
-- En el parte antiguo cada conteo era la matriz entera, así que bastaba con el
-- último parte. En el nuevo, una casilla vacía conserva el dato anterior: por
-- ubicación y prenda manda el último conteo del mes (Inventario!Z11). Sin conteo
-- todavía, `contado` y `diferencia` son null: es dato pendiente, no 0.
drop view if exists audit_mes_dotacion;
create view audit_mes_dotacion
with (security_invoker = true) as
with ultimo as (
  select distinct on (hotel_id, periodo)
         hotel_id, periodo, submission_id, fecha
  from audit_daily
  where tipo = 'lenceria'
  order by hotel_id, periodo, fecha desc, actualizado_at desc
),
periodos_control as (
  select distinct hotel_id, periodo from audit_daily where tipo = 'control'
),
ultimos_control as (
  select distinct on (hotel_id, periodo, ubicacion, prenda)
         hotel_id, periodo, ubicacion, prenda, fecha, valor
  from audit_daily_detalle
  where tipo = 'control' and metrica = 'cantidad'
  order by hotel_id, periodo, ubicacion, prenda, fecha desc
)
select
  d.hotel_id,
  ul.periodo,
  ul.fecha                                    as fecha_conteo,
  u.nombre                                    as ubicacion,
  p.nombre                                    as prenda,
  d.cantidad::numeric                         as dotacion,
  coalesce(det.valor, 0)                      as contado,
  coalesce(det.valor, 0) - d.cantidad         as diferencia
from dotacion_lenceria d
join catalogo_ubicaciones u on u.id = d.ubicacion_id
join catalogo_prendas     p on p.id = d.prenda_id
join ultimo ul on ul.hotel_id = d.hotel_id
left join audit_daily_detalle det
  on det.submission_id = ul.submission_id
 and det.metrica   = 'cantidad'
 and det.ubicacion = u.nombre
 and det.prenda    = p.nombre
union all
select
  d.hotel_id,
  pc.periodo,
  uc.fecha                                    as fecha_conteo,
  u.nombre                                    as ubicacion,
  p.nombre                                    as prenda,
  d.cantidad::numeric                         as dotacion,
  uc.valor                                    as contado,
  uc.valor - d.cantidad                       as diferencia
from dotacion_lenceria d
join catalogo_ubicaciones u on u.id = d.ubicacion_id
join catalogo_prendas     p on p.id = d.prenda_id
join periodos_control pc on pc.hotel_id = d.hotel_id
left join ultimos_control uc
  on uc.hotel_id  = d.hotel_id
 and uc.periodo   = pc.periodo
 and uc.ubicacion = u.nombre
 and uc.prenda    = p.nombre;

comment on view audit_mes_dotacion is
  'Dotación por ubicación × prenda frente a lo contado en el mes (contado - dotacion = diferencia). En partes de control manda el último conteo de cada casilla y sin conteo contado es null. Solo hoteles y periodos con algún parte.';


-- -----------------------------------------------------------------------------
-- 7. Backfill: el detalle antiguo guarda los nombres de prenda ya resueltos
-- -----------------------------------------------------------------------------
select refrescar_audit_datos(id) from form_submissions;

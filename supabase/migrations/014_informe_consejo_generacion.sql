-- =============================================================================
-- 014 · Informe del Consejo: generación (n8n + routine) e informes trimestrales
-- =============================================================================
-- Sobre la 013 (apartado por meses):
--
-- * consejo_informes guarda lo que hace falta para generar el informe:
--     datos         tablas del período en texto, que monta n8n con
--                   Leslie/Consejo/scripts/preparar_consejo.py (TABLA CA + GLOBAL)
--     analisis      los textos {"sections": {...}} que redacta la routine de Claude
--     redactado_at  cuándo los dejó la routine
--   n8n escribe `datos` con la service role; la routine escribe `analisis` por el
--   conector de Supabase. Los dos se leen como el resto de la fila: cualquier
--   usuario con sesión (el informe que se descarga lleva lo mismo).
--
-- * Informes trimestrales: una fila lleva `mes` o `trimestre`, nunca los dos.
--   El trimestre se puede pedir cuando sus tres meses tienen todo lo que se
--   comprueba (las mismas reglas que el mes: disponibilidad_informe_consejo).
--
-- Flujo: la app pide (solicitar_*) → `pendiente` → n8n lo pasa a `generando`,
-- guarda `datos` y despierta a la routine → la routine deja `analisis` →
-- n8n monta el DOCX, lo sube a informes-consejo/<año>/<mes o Tn>/ y deja `listo`
-- (o `error` con el motivo, en cualquier paso).
-- =============================================================================

alter table public.consejo_informes
  add column if not exists trimestre    integer check (trimestre between 1 and 4),
  add column if not exists datos        jsonb,
  add column if not exists analisis     jsonb,
  add column if not exists redactado_at timestamptz;

alter table public.consejo_informes alter column mes drop not null;

alter table public.consejo_informes drop constraint if exists consejo_informes_mes_o_trimestre;
alter table public.consejo_informes add constraint consejo_informes_mes_o_trimestre
  check ((mes is null) <> (trimestre is null));

-- unique (anio, mes) de la 013 → dos índices parciales: uno por mes, otro por trimestre
alter table public.consejo_informes drop constraint if exists consejo_informes_anio_mes_key;
create unique index if not exists consejo_informes_mes_uq
  on public.consejo_informes (anio, mes) where mes is not null;
create unique index if not exists consejo_informes_trimestre_uq
  on public.consejo_informes (anio, trimestre) where trimestre is not null;

-- ─── Pedir un mes (igual que en la 013, con el índice parcial) ───────────────

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

  insert into public.consejo_informes (anio, mes, estado, solicitado_por, solicitado_at, error,
                                       datos, analisis, redactado_at)
  values (p_anio, p_mes, 'pendiente', auth.uid(), now(), null, null, null, null)
  on conflict (anio, mes) where mes is not null do update
     set estado = 'pendiente', solicitado_por = auth.uid(), solicitado_at = now(), error = null,
         datos = null, analisis = null, redactado_at = null
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

-- ─── Pedir un trimestre ──────────────────────────────────────────────────────

create or replace function public.solicitar_informe_consejo_trimestre(p_anio integer, p_trimestre integer)
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
  if p_trimestre not between 1 and 4 then
    raise exception 'Trimestre no válido: %', p_trimestre;
  end if;

  select count(*) into v_falta
  from public.disponibilidad_informe_consejo(p_anio) d
  where d.mes between 3 * p_trimestre - 2 and 3 * p_trimestre and d.estado = 'falta';
  if v_falta > 0 then
    raise exception 'Faltan % datos en los meses del trimestre %/%', v_falta, p_trimestre, p_anio;
  end if;

  insert into public.consejo_informes (anio, trimestre, estado, solicitado_por, solicitado_at, error,
                                       datos, analisis, redactado_at)
  values (p_anio, p_trimestre, 'pendiente', auth.uid(), now(), null, null, null, null)
  on conflict (anio, trimestre) where trimestre is not null do update
     set estado = 'pendiente', solicitado_por = auth.uid(), solicitado_at = now(), error = null,
         datos = null, analisis = null, redactado_at = null
   where public.consejo_informes.estado not in ('pendiente', 'generando')
  returning * into v_fila;

  if v_fila.id is null then
    raise exception 'Ya se está generando el informe de ese trimestre';
  end if;
  return v_fila;
end;
$$;

revoke all on function public.solicitar_informe_consejo_trimestre(integer, integer) from public, anon;
grant execute on function public.solicitar_informe_consejo_trimestre(integer, integer) to authenticated;

-- ============================================================================
-- 012 · Historial de ejecuciones de las automatizaciones
-- ============================================================================
-- La sección «Automatizaciones» (/automatizaciones) lanza cada rama del
-- workflow de n8n desde su propio apartado, en vez de por el chat. Esta tabla
-- guarda qué se lanzó, con qué fichero y cómo acabó, para que la página pueda
-- mostrar las últimas ejecuciones y para que una llamada que se corta por
-- timeout del proxy no se quede sin rastro (queda en 'en_curso').
--
-- `slug` es el del catálogo en src/lib/automatizaciones.ts (modelo-1,
-- tabla-ca, ocupacion). No se restringe con un CHECK: añadir una
-- automatización no debe obligar a una migración.
--
-- Los ficheros (el subido y el generado) viven en el bucket `documents`, como
-- los del chat; aquí solo se guarda su ruta.
--
-- Aplicada el 2026-10-20 como «automation_runs».
-- ============================================================================

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  estado text not null default 'en_curso',          -- en_curso | completada | error
  archivo_nombre text,
  archivo_path text,
  respuesta text,
  resultado_nombre text,
  resultado_path text,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists automation_runs_slug_fecha_idx
  on public.automation_runs (slug, created_at desc);

create index if not exists automation_runs_user_idx
  on public.automation_runs (user_id, created_at desc);

alter table public.automation_runs enable row level security;

-- Cada quien ve y escribe lo suyo, como en el resto del proyecto.
drop policy if exists automation_runs_select_own on public.automation_runs;
create policy automation_runs_select_own on public.automation_runs
  for select using (user_id = auth.uid());

drop policy if exists automation_runs_insert_own on public.automation_runs;
create policy automation_runs_insert_own on public.automation_runs
  for insert with check (user_id = auth.uid());

drop policy if exists automation_runs_update_own on public.automation_runs;
create policy automation_runs_update_own on public.automation_runs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists automation_runs_delete_own on public.automation_runs;
create policy automation_runs_delete_own on public.automation_runs
  for delete using (user_id = auth.uid());

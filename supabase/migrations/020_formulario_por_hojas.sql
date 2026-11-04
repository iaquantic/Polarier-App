-- 020_formulario_por_hojas.sql
-- El formulario de control pasa a tener las hojas y columnas del Excel «Modelo
-- Mensual», y el supervisor puede subir el Excel relleno. Lo que guardan los partes
-- no cambia: esta migración solo añade.
--
--   1. Las ubicaciones se llaman como en la hoja Inventario, para que un Excel subido
--      encuentre cada una. Los datos van por UUID: renombrar no toca ningún parte.
--   2. `config.ubicaciones_hoja`: las fijas de esa hoja, en su orden. Las demás del
--      catálogo se eligen en sus filas libres.
--   3. `control_importaciones` y el bucket privado `control-excel`: cada Excel subido
--      se guarda tal cual, porque una fila que no entre sigue estando en el original.
--
-- Se puede aplicar antes de desplegar la app: la versión anterior no usa nada de esto.

-- ---------------------------------------------------------------------------
-- 1. Nombres de la hoja
-- ---------------------------------------------------------------------------
update catalogo_ubicaciones u
set nombre = v.nuevo
from hoteles h,
  (values
    ('Lavandería', 'Lavandería (en proceso)'),
    ('Alm. Sucio', 'Almacén de sucio'),
    ('Alm. Limpio', 'Almacén de limpio'),
    ('Office Piso 24', 'Office piso 24'),
    ('Office Piso 25', 'Office piso 25'),
    ('Office Piso 26', 'Office piso 26'),
    ('Spa-1', 'Spa 1'),
    ('Spa-2', 'Spa 2')
  ) as v(actual, nuevo)
where h.slug = 'gran-muthu-habana'
  and u.hotel_id = h.id
  and u.nombre = v.actual;

-- ---------------------------------------------------------------------------
-- 2. Ubicaciones fijas de la hoja Inventario
-- ---------------------------------------------------------------------------
update form_definitions d
set config = coalesce(d.config, '{}'::jsonb) || jsonb_build_object(
  'ubicaciones_hoja',
  jsonb_build_array(
    'Lavandería (en proceso)', 'Almacén de sucio', 'Almacén de limpio',
    'Piso 24', 'Office piso 24', 'Piso 25', 'Office piso 25',
    'Piso 26', 'Office piso 26', 'Spa 1', 'Spa 2'
  )
)
from hoteles h
where h.slug = 'gran-muthu-habana'
  and d.hotel_id = h.id
  and d.tipo = 'control';

-- ---------------------------------------------------------------------------
-- 3. Excel subidos
-- ---------------------------------------------------------------------------
create table if not exists control_importaciones (
  id             uuid primary key default gen_random_uuid(),
  hotel_id       uuid not null references hoteles(id) on delete cascade,
  anio           int  not null,
  mes            int  not null check (mes between 1 and 12),
  archivo_nombre text not null,
  -- Ruta en el bucket; null si los datos entraron pero el archivo no se pudo guardar.
  archivo_path   text,
  -- Qué hizo la subida, hoja por hoja, y qué filas no entraron.
  resumen        jsonb not null default '{}'::jsonb,
  user_id        uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_control_importaciones_mes on control_importaciones(hotel_id, anio, mes, created_at desc);

comment on table control_importaciones is
  'Cada Excel «Modelo Mensual» subido desde la hoja del mes: quién, cuándo, qué cambió y dónde está el original.';

alter table control_importaciones enable row level security;

drop policy if exists "control_importaciones_select" on control_importaciones;
create policy "control_importaciones_select" on control_importaciones for select
  using (has_hotel_access(hotel_id));

drop policy if exists "control_importaciones_insert" on control_importaciones;
create policy "control_importaciones_insert" on control_importaciones for insert
  with check (has_hotel_access(hotel_id) and user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('control-excel', 'control-excel', false)
on conflict (id) do nothing;

-- La primera carpeta de la ruta es el hotel. No hay política de borrado: un Excel
-- subido es la evidencia de lo que se importó.
drop policy if exists "control_excel_read" on storage.objects;
create policy "control_excel_read" on storage.objects for select
  using (
    bucket_id = 'control-excel'
    and has_hotel_access( (storage.foldername(name))[1]::uuid )
  );

drop policy if exists "control_excel_insert" on storage.objects;
create policy "control_excel_insert" on storage.objects for insert
  with check (
    bucket_id = 'control-excel'
    and has_hotel_access( (storage.foldername(name))[1]::uuid )
  );

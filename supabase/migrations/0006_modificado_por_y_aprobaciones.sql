-- =====================================================================
-- Fase 5 · Quién modificó la tarea y aprobación del cambio de nombre de un proyecto
-- Ejecutar completo en Supabase > SQL Editor (después de 0005). Se puede ejecutar dos veces.
-- =====================================================================

-- ---------- Última modificación: fecha y quién ----------
alter table public.tareas add column if not exists actualizado_por uuid references public.perfiles(id) on delete set null;

-- Solo cuenta como "modificación" lo que hace una persona (no los procesos automáticos del servidor).
create or replace function public.tocar_actualizado() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null then
    new.actualizado_en := now();
    new.actualizado_por := auth.uid();
  end if;
  if new.estado = 'hecho' and (old.estado is distinct from 'hecho') then
    new.terminado_en := now();
  elsif new.estado <> 'hecho' then
    new.terminado_en := null;
  end if;
  return new;
end $$;

-- ---------- Cambio de nombre de proyecto con aprobación de todo el equipo ----------
create table if not exists public.solicitudes_nombre (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  nombre_actual text not null,
  nombre_nuevo text not null,
  solicitado_por uuid references public.perfiles(id) on delete set null,
  aprobaciones uuid[] not null default '{}',
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  rechazado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  resuelto_en timestamptz
);
create index if not exists solicitudes_nombre_proyecto_idx on public.solicitudes_nombre (proyecto_id, estado);

alter table public.solicitudes_nombre enable row level security;
drop policy if exists "ver solicitudes del espacio" on public.solicitudes_nombre;
create policy "ver solicitudes del espacio" on public.solicitudes_nombre for select using (public.es_miembro(workspace_id));
-- Crear y votar solo con las funciones de abajo (así nadie puede inventar aprobaciones).
grant select on public.solicitudes_nombre to authenticated;
grant all on public.solicitudes_nombre to service_role;

-- Pide cambiar el nombre. Quien lo pide ya cuenta como una aprobación.
create or replace function public.solicitar_cambio_nombre(p_proyecto uuid, p_nombre text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_ws uuid;
  v_actual text;
  v_id uuid;
  v_nombre text := left(btrim(coalesce(p_nombre, '')), 120);
begin
  select workspace_id, nombre into v_ws, v_actual from proyectos where id = p_proyecto;
  if v_ws is null or not es_miembro(v_ws) then raise exception 'No autorizado'; end if;
  if v_nombre = '' then raise exception 'El nombre no puede estar vacío'; end if;
  if v_nombre = v_actual then return null; end if;

  update solicitudes_nombre set estado = 'cancelada', resuelto_en = now()
  where proyecto_id = p_proyecto and estado = 'pendiente';

  insert into solicitudes_nombre (proyecto_id, workspace_id, nombre_actual, nombre_nuevo, solicitado_por, aprobaciones)
  values (p_proyecto, v_ws, v_actual, v_nombre, auth.uid(), array[auth.uid()])
  returning id into v_id;

  perform resolver_solicitud_nombre(v_id);
  return v_id;
end $$;

-- Aplica el cambio cuando ya aprobaron todos los miembros del espacio.
create or replace function public.resolver_solicitud_nombre(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s solicitudes_nombre%rowtype; v_total int;
begin
  select * into s from solicitudes_nombre where id = p_id for update;
  if s.estado <> 'pendiente' then return; end if;
  select count(*) into v_total from miembros where workspace_id = s.workspace_id;
  if (select count(*) from miembros m where m.workspace_id = s.workspace_id and m.user_id = any(s.aprobaciones)) >= v_total then
    perform set_config('app.renombre_aprobado', 'si', true);
    update proyectos set nombre = s.nombre_nuevo where id = s.proyecto_id;
    perform set_config('app.renombre_aprobado', '', true);
    update solicitudes_nombre set estado = 'aprobada', resuelto_en = now() where id = p_id;
  end if;
end $$;

-- Aprobar o rechazar. Un solo "no" rechaza la solicitud; si la rechaza quien la pidió, se cancela.
create or replace function public.votar_cambio_nombre(p_id uuid, p_aprueba boolean) returns text
language plpgsql security definer set search_path = public as $$
declare s solicitudes_nombre%rowtype;
begin
  select * into s from solicitudes_nombre where id = p_id for update;
  if s.id is null or not es_miembro(s.workspace_id) then raise exception 'No autorizado'; end if;
  if s.estado <> 'pendiente' then return s.estado; end if;

  if not p_aprueba then
    update solicitudes_nombre
    set estado = case when s.solicitado_por = auth.uid() then 'cancelada' else 'rechazada' end,
        rechazado_por = auth.uid(), resuelto_en = now()
    where id = p_id;
  elsif not (auth.uid() = any(s.aprobaciones)) then
    update solicitudes_nombre set aprobaciones = array_append(aprobaciones, auth.uid()) where id = p_id;
    perform resolver_solicitud_nombre(p_id);
  end if;
  return (select estado from solicitudes_nombre where id = p_id);
end $$;

revoke all on function public.resolver_solicitud_nombre(uuid) from public;

-- El nombre de un proyecto solo cambia por una solicitud aprobada (la descripción y el color sí se editan directo).
create or replace function public.proteger_nombre_proyecto() returns trigger
language plpgsql as $$
begin
  if new.nombre is distinct from old.nombre and auth.uid() is not null
     and coalesce(current_setting('app.renombre_aprobado', true), '') <> 'si' then
    raise exception 'El cambio de nombre necesita la aprobación de todo el equipo';
  end if;
  return new;
end $$;
drop trigger if exists proyectos_nombre_protegido on public.proyectos;
create trigger proyectos_nombre_protegido before update of nombre on public.proyectos
for each row execute function public.proteger_nombre_proyecto();
grant execute on function public.solicitar_cambio_nombre(uuid, text), public.votar_cambio_nombre(uuid, boolean) to authenticated;

-- Aviso por correo/WhatsApp a los demás cuando alguien pide un cambio de nombre.
alter table public.recordatorios_enviados drop constraint if exists recordatorios_enviados_tipo_check;
alter table public.recordatorios_enviados
  add constraint recordatorios_enviados_tipo_check
  check (tipo in ('manana', 'dias_antes', 'hoy', 'vencida', 'resumen', 'personal', 'manual', 'prueba', 'asignada', 'solicitud'));

-- ---------- Tiempo real también para proyectos y solicitudes ----------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['proyectos', 'solicitudes_nombre'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- =====================================================================
-- Fase 6 · Proyectos fijados y eliminación de proyectos, fases y tareas con aprobación del equipo
-- Ejecutar completo en Supabase > SQL Editor (después de 0007). Se puede ejecutar dos veces.
-- =====================================================================

-- ---------- Proyectos fijados (cada persona fija los suyos) ----------
alter table public.perfiles add column if not exists proyectos_fijados uuid[] not null default '{}';

-- ---------- Nadie borra directo: solo con una solicitud aprobada por todos ----------
-- Se reemplazan las políticas "para todo" por políticas de ver, crear y editar (sin borrar).
drop policy if exists "proyectos del espacio" on public.proyectos;
drop policy if exists "proyectos: ver" on public.proyectos;
drop policy if exists "proyectos: crear" on public.proyectos;
drop policy if exists "proyectos: editar" on public.proyectos;
create policy "proyectos: ver" on public.proyectos for select using (public.es_miembro(workspace_id));
create policy "proyectos: crear" on public.proyectos for insert with check (public.es_miembro(workspace_id));
create policy "proyectos: editar" on public.proyectos for update using (public.es_miembro(workspace_id)) with check (public.es_miembro(workspace_id));

drop policy if exists "fases del espacio" on public.fases;
drop policy if exists "fases: ver" on public.fases;
drop policy if exists "fases: crear" on public.fases;
drop policy if exists "fases: editar" on public.fases;
create policy "fases: ver" on public.fases for select
  using (exists (select 1 from public.proyectos p where p.id = proyecto_id and public.es_miembro(p.workspace_id)));
create policy "fases: crear" on public.fases for insert
  with check (exists (select 1 from public.proyectos p where p.id = proyecto_id and public.es_miembro(p.workspace_id)));
create policy "fases: editar" on public.fases for update
  using (exists (select 1 from public.proyectos p where p.id = proyecto_id and public.es_miembro(p.workspace_id)))
  with check (exists (select 1 from public.proyectos p where p.id = proyecto_id and public.es_miembro(p.workspace_id)));

drop policy if exists "tareas del espacio" on public.tareas;
drop policy if exists "tareas: ver" on public.tareas;
drop policy if exists "tareas: crear" on public.tareas;
drop policy if exists "tareas: editar" on public.tareas;
create policy "tareas: ver" on public.tareas for select using (public.es_miembro(workspace_id));
create policy "tareas: crear" on public.tareas for insert with check (public.es_miembro(workspace_id));
create policy "tareas: editar" on public.tareas for update using (public.es_miembro(workspace_id)) with check (public.es_miembro(workspace_id));

revoke delete on public.proyectos, public.fases, public.tareas from authenticated;

-- ---------- Solicitudes de eliminación ----------
create table if not exists public.solicitudes_eliminacion (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('proyecto', 'fase', 'tarea')),
  objeto_id uuid not null,
  nombre text not null,                   -- nombre del proyecto, fase o tarea (para mostrarlo aunque ya no exista)
  proyecto_id uuid references public.proyectos(id) on delete set null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  solicitado_por uuid references public.perfiles(id) on delete set null,
  aprobaciones uuid[] not null default '{}',
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  rechazado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  resuelto_en timestamptz
);
create unique index if not exists solicitudes_eliminacion_una_pendiente on public.solicitudes_eliminacion (objeto_id) where estado = 'pendiente';
create index if not exists solicitudes_eliminacion_espacio_idx on public.solicitudes_eliminacion (workspace_id, estado);

alter table public.solicitudes_eliminacion enable row level security;
drop policy if exists "ver solicitudes de eliminación" on public.solicitudes_eliminacion;
create policy "ver solicitudes de eliminación" on public.solicitudes_eliminacion for select using (public.es_miembro(workspace_id));
grant select on public.solicitudes_eliminacion to authenticated;
grant all on public.solicitudes_eliminacion to service_role;

-- Borra el objeto cuando ya aprobaron todos los miembros del espacio.
create or replace function public.resolver_eliminacion(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s solicitudes_eliminacion%rowtype; v_total int;
begin
  select * into s from solicitudes_eliminacion where id = p_id for update;
  if s.estado <> 'pendiente' then return; end if;
  select count(*) into v_total from miembros where workspace_id = s.workspace_id;
  if (select count(*) from miembros m where m.workspace_id = s.workspace_id and m.user_id = any(s.aprobaciones)) < v_total then return; end if;

  -- Si se borra un proyecto, lo pendiente sobre sus fases y tareas se cancela.
  if s.tipo = 'proyecto' then
    update solicitudes_eliminacion set estado = 'cancelada', resuelto_en = now()
    where estado = 'pendiente' and id <> p_id and proyecto_id = s.objeto_id;
  end if;

  if s.tipo = 'tarea' then
    delete from tareas where id = s.objeto_id;
  elsif s.tipo = 'fase' then
    delete from fases where id = s.objeto_id;          -- sus subfases también; las tareas quedan sin fase
  elsif s.tipo = 'proyecto' then
    delete from proyectos where id = s.objeto_id;      -- con sus fases y tareas
  end if;
  update solicitudes_eliminacion set estado = 'aprobada', resuelto_en = now() where id = p_id;

  -- Lo que seguía pendiente sobre cosas que ya no existen (p. ej. subfases borradas) se cancela.
  update solicitudes_eliminacion set estado = 'cancelada', resuelto_en = now()
  where estado = 'pendiente' and (
    (tipo = 'tarea' and not exists (select 1 from tareas where id = objeto_id)) or
    (tipo = 'fase' and not exists (select 1 from fases where id = objeto_id))
  );
end $$;
revoke all on function public.resolver_eliminacion(uuid) from public;

-- Pide eliminar. Quien lo pide ya cuenta como una aprobación.
create or replace function public.solicitar_eliminacion(p_tipo text, p_objeto uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_ws uuid; v_proyecto uuid; v_nombre text; v_id uuid;
begin
  if p_tipo = 'tarea' then
    select workspace_id, proyecto_id, titulo into v_ws, v_proyecto, v_nombre from tareas where id = p_objeto;
  elsif p_tipo = 'fase' then
    select p.workspace_id, f.proyecto_id, f.nombre into v_ws, v_proyecto, v_nombre from fases f join proyectos p on p.id = f.proyecto_id where f.id = p_objeto;
  elsif p_tipo = 'proyecto' then
    select workspace_id, id, nombre into v_ws, v_proyecto, v_nombre from proyectos where id = p_objeto;
  else
    raise exception 'Tipo no válido';
  end if;
  if v_ws is null or not es_miembro(v_ws) then raise exception 'No autorizado'; end if;

  select id into v_id from solicitudes_eliminacion where objeto_id = p_objeto and estado = 'pendiente';
  if v_id is not null then return v_id; end if;

  insert into solicitudes_eliminacion (tipo, objeto_id, nombre, proyecto_id, workspace_id, solicitado_por, aprobaciones)
  values (p_tipo, p_objeto, left(v_nombre, 200), v_proyecto, v_ws, auth.uid(), array[auth.uid()])
  returning id into v_id;
  perform resolver_eliminacion(v_id);
  return v_id;
end $$;

-- Aprobar o rechazar. Un solo "no" rechaza; si lo retira quien la pidió, se cancela.
create or replace function public.votar_eliminacion(p_id uuid, p_aprueba boolean) returns text
language plpgsql security definer set search_path = public as $$
declare s solicitudes_eliminacion%rowtype;
begin
  select * into s from solicitudes_eliminacion where id = p_id for update;
  if s.id is null or not es_miembro(s.workspace_id) then raise exception 'No autorizado'; end if;
  if s.estado <> 'pendiente' then return s.estado; end if;
  if not p_aprueba then
    update solicitudes_eliminacion
    set estado = case when s.solicitado_por = auth.uid() then 'cancelada' else 'rechazada' end,
        rechazado_por = auth.uid(), resuelto_en = now()
    where id = p_id;
  elsif not (auth.uid() = any(s.aprobaciones)) then
    update solicitudes_eliminacion set aprobaciones = array_append(aprobaciones, auth.uid()) where id = p_id;
    perform resolver_eliminacion(p_id);
  end if;
  return (select estado from solicitudes_eliminacion where id = p_id);
end $$;

grant execute on function public.solicitar_eliminacion(text, uuid), public.votar_eliminacion(uuid, boolean) to authenticated;

-- ---------- Tiempo real para las solicitudes de eliminación ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'solicitudes_eliminacion') then
    alter publication supabase_realtime add table public.solicitudes_eliminacion;
  end if;
end $$;

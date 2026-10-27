-- =====================================================================
-- Gestor de proyectos · esquema inicial
-- Pensado para uso interno, pero multi-espacio desde el día 1:
-- cada proyecto y tarea pertenece a un "workspace" (espacio de trabajo).
-- Ejecutar completo en Supabase > SQL Editor.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Tipos ----------
create type estado_tarea as enum ('por_hacer', 'en_curso', 'revision', 'hecho');
create type prioridad_tarea as enum ('baja', 'media', 'alta', 'urgente');
create type rol_miembro as enum ('admin', 'miembro', 'invitado');

-- ---------- Espacios de trabajo ----------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  creado_en timestamptz not null default now()
);

-- Correos autorizados a entrar. Solo quien esté aquí puede crear cuenta.
create table public.correos_autorizados (
  email text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rol rol_miembro not null default 'miembro',
  creado_en timestamptz not null default now()
);

create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nombre text,
  avatar_url text,
  telefono text,                                  -- para WhatsApp (fase 2), formato 57XXXXXXXXXX
  avisar_correo boolean not null default true,
  avisar_whatsapp boolean not null default false,
  creado_en timestamptz not null default now()
);

create table public.miembros (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.perfiles(id) on delete cascade,
  rol rol_miembro not null default 'miembro',
  creado_en timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- ---------- Proyectos, fases y tareas ----------
create table public.proyectos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  nombre text not null,
  descripcion text,
  color text not null default '#2246C4',
  fecha_inicio date,
  fecha_fin date,
  archivado boolean not null default false,
  creado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now()
);

-- Las fases alimentan el "mapa del proyecto" (fase 4).
create table public.fases (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  nombre text not null,
  posicion int not null default 0,
  creado_en timestamptz not null default now()
);

create table public.tareas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  fase_id uuid references public.fases(id) on delete set null,
  titulo text not null,
  descripcion text,
  estado estado_tarea not null default 'por_hacer',
  prioridad prioridad_tarea not null default 'media',
  responsable_id uuid references public.perfiles(id) on delete set null,
  fecha_limite date,
  posicion double precision not null default 0,
  creado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  terminado_en timestamptz
);
create index tareas_proyecto_idx on public.tareas (proyecto_id, estado, posicion);
create index tareas_responsable_idx on public.tareas (responsable_id, fecha_limite);

create table public.comentarios (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references public.tareas(id) on delete cascade,
  autor_id uuid references public.perfiles(id) on delete set null,
  cuerpo text not null,
  creado_en timestamptz not null default now()
);

-- Registro de recordatorios enviados (evita duplicados el mismo día).
create table public.recordatorios_enviados (
  id bigint generated always as identity primary key,
  tarea_id uuid not null references public.tareas(id) on delete cascade,
  user_id uuid not null references public.perfiles(id) on delete cascade,
  tipo text not null check (tipo in ('manana', 'hoy', 'vencida')),
  canal text not null check (canal in ('correo', 'whatsapp')),
  enviado_el date not null default (now() at time zone 'America/Bogota')::date,
  creado_en timestamptz not null default now(),
  unique (tarea_id, user_id, tipo, canal, enviado_el)
);

-- ---------- Triggers ----------
create or replace function public.tocar_actualizado() returns trigger
language plpgsql as $$
begin
  new.actualizado_en := now();
  if new.estado = 'hecho' and (old.estado is distinct from 'hecho') then
    new.terminado_en := now();
  elsif new.estado <> 'hecho' then
    new.terminado_en := null;
  end if;
  return new;
end $$;

create trigger tareas_actualizado before update on public.tareas
for each row execute function public.tocar_actualizado();

-- Al registrarse con Google: solo correos autorizados; crea perfil y membresía.
create or replace function public.al_crear_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  autorizado record;
begin
  select * into autorizado from public.correos_autorizados where lower(email) = lower(new.email);
  if not found then
    raise exception 'Correo no autorizado: %', new.email;
  end if;

  insert into public.perfiles (id, email, nombre, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.miembros (workspace_id, user_id, rol)
  values (autorizado.workspace_id, new.id, autorizado.rol)
  on conflict do nothing;

  return new;
end $$;

create trigger al_crear_usuario after insert on auth.users
for each row execute function public.al_crear_usuario();

-- ---------- Seguridad por filas (RLS) ----------
create or replace function public.es_miembro(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.miembros where workspace_id = ws and user_id = auth.uid());
$$;

create or replace function public.comparte_espacio(otro uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.miembros a join public.miembros b on a.workspace_id = b.workspace_id
    where a.user_id = auth.uid() and b.user_id = otro
  );
$$;

alter table public.workspaces enable row level security;
alter table public.correos_autorizados enable row level security;
alter table public.perfiles enable row level security;
alter table public.miembros enable row level security;
alter table public.proyectos enable row level security;
alter table public.fases enable row level security;
alter table public.tareas enable row level security;
alter table public.comentarios enable row level security;
alter table public.recordatorios_enviados enable row level security;

create policy "ver mis espacios" on public.workspaces for select using (public.es_miembro(id));

create policy "ver perfiles del equipo" on public.perfiles for select using (id = auth.uid() or public.comparte_espacio(id));
create policy "editar mi perfil" on public.perfiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "ver miembros" on public.miembros for select using (public.es_miembro(workspace_id));

create policy "proyectos del espacio" on public.proyectos for all
  using (public.es_miembro(workspace_id)) with check (public.es_miembro(workspace_id));

create policy "fases del espacio" on public.fases for all
  using (exists (select 1 from public.proyectos p where p.id = proyecto_id and public.es_miembro(p.workspace_id)))
  with check (exists (select 1 from public.proyectos p where p.id = proyecto_id and public.es_miembro(p.workspace_id)));

create policy "tareas del espacio" on public.tareas for all
  using (public.es_miembro(workspace_id)) with check (public.es_miembro(workspace_id));

create policy "comentarios del espacio" on public.comentarios for all
  using (exists (select 1 from public.tareas t where t.id = tarea_id and public.es_miembro(t.workspace_id)))
  with check (exists (select 1 from public.tareas t where t.id = tarea_id and public.es_miembro(t.workspace_id)) and autor_id = auth.uid());

-- correos_autorizados y recordatorios_enviados: sin políticas = solo el servidor (service role) los toca.

-- ---------- Permisos explícitos para la API ----------
-- (Funciona aunque "Automatically expose new tables" esté desactivado en Supabase.)
-- Solo usuarios con sesión (authenticated); RLS decide qué filas ve cada uno.
grant usage on schema public to authenticated, service_role;
grant select on public.workspaces, public.miembros to authenticated;
grant select, update on public.perfiles to authenticated;
grant select, insert, update, delete on public.proyectos, public.fases, public.tareas, public.comentarios to authenticated;
grant execute on function public.es_miembro(uuid), public.comparte_espacio(uuid) to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- =====================================================================
-- DATOS INICIALES: cambie el nombre y los 3 correos antes de ejecutar.
-- =====================================================================
with ws as (
  insert into public.workspaces (nombre) values ('Nuestra empresa') returning id
)
insert into public.correos_autorizados (email, workspace_id, rol)
select e.email, ws.id, 'admin'
from ws, (values
  ('kevin@gmail.com'),
  ('fabian@gmail.com'),
  ('juan@gmail.com')
) as e(email);

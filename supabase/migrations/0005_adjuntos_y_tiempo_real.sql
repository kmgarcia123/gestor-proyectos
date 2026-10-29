-- =====================================================================
-- Fase 4 · Adjuntos (imágenes y documentos) y actualización en tiempo real
-- Ejecutar completo en Supabase > SQL Editor (después de 0004). Se puede ejecutar dos veces.
-- =====================================================================

-- ---------- Archivos adjuntos de cada tarea ----------
create table if not exists public.adjuntos (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references public.tareas(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  nombre text not null,
  ruta text not null unique,            -- ubicación en Storage: {workspace}/{tarea}/{archivo}
  tipo text,                            -- image/png, application/pdf, ...
  tamano bigint,
  subido_por uuid references public.perfiles(id) on delete set null default auth.uid(),
  creado_en timestamptz not null default now()
);
create index if not exists adjuntos_tarea_idx on public.adjuntos (tarea_id, creado_en);

alter table public.adjuntos enable row level security;
drop policy if exists "adjuntos del espacio" on public.adjuntos;
create policy "adjuntos del espacio" on public.adjuntos for all
  using (public.es_miembro(workspace_id)) with check (public.es_miembro(workspace_id));
grant select, insert, delete on public.adjuntos to authenticated;
grant all on public.adjuntos to service_role;

-- "¿Es miembro?" a partir del texto de la carpeta (si no es un id válido, responde que no).
create or replace function public.es_miembro_texto(ws text) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return public.es_miembro(ws::uuid);
exception when others then
  return false;
end $$;
grant execute on function public.es_miembro_texto(text) to authenticated;

-- ---------- Bucket privado de Storage ----------
-- Máximo 10 MB por archivo. Solo los miembros del espacio (primera carpeta de la ruta) pueden ver, subir o borrar.
insert into storage.buckets (id, name, public, file_size_limit)
values ('adjuntos', 'adjuntos', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "adjuntos: ver" on storage.objects;
drop policy if exists "adjuntos: subir" on storage.objects;
drop policy if exists "adjuntos: borrar" on storage.objects;
create policy "adjuntos: ver" on storage.objects for select to authenticated
  using (bucket_id = 'adjuntos' and public.es_miembro_texto((storage.foldername(name))[1]));
create policy "adjuntos: subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'adjuntos' and public.es_miembro_texto((storage.foldername(name))[1]));
create policy "adjuntos: borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'adjuntos' and public.es_miembro_texto((storage.foldername(name))[1]));

-- ---------- Tiempo real: avisar a los navegadores cuando cambian tareas, fases o adjuntos ----------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['tareas', 'fases', 'adjuntos'] loop
      if not exists (
        select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- =====================================================================
-- Fase 3 · Varios responsables, fecha de inicio, aviso al asignar y mapa de fases en árbol
-- Ejecutar completo en Supabase > SQL Editor (después de 0001 y 0002). Se puede ejecutar dos veces.
-- =====================================================================

-- ---------- Varios responsables por tarea ----------
alter table public.tareas add column if not exists responsables uuid[] not null default '{}';

-- Pasa el responsable único que ya existía a la lista nueva.
update public.tareas
set responsables = array[responsable_id]
where responsable_id is not null and cardinality(responsables) = 0;

create index if not exists tareas_responsables_idx on public.tareas using gin (responsables);

-- responsable_id queda como "responsable principal" (el primero de la lista), para compatibilidad.
create or replace function public.sincronizar_responsable() returns trigger
language plpgsql as $$
begin
  new.responsables := coalesce(new.responsables, '{}');
  -- Compatibilidad con la versión anterior de la app, que solo escribe responsable_id.
  if tg_op = 'INSERT' and cardinality(new.responsables) = 0 and new.responsable_id is not null then
    new.responsables := array[new.responsable_id];
  elsif tg_op = 'UPDATE' and new.responsables is not distinct from old.responsables
        and new.responsable_id is distinct from old.responsable_id then
    new.responsables := case when new.responsable_id is null then '{}'::uuid[] else array[new.responsable_id] end;
  end if;
  -- Sin duplicados, conservando el orden.
  new.responsables := array(
    select x from (select x, min(n) as n from unnest(new.responsables) with ordinality as u(x, n) where x is not null group by x) s order by n
  );
  new.responsable_id := new.responsables[1];
  return new;
end $$;

drop trigger if exists tareas_responsables on public.tareas;
create trigger tareas_responsables before insert or update of responsables, responsable_id on public.tareas
for each row execute function public.sincronizar_responsable();

-- ---------- Fecha de inicio ----------
alter table public.tareas add column if not exists fecha_inicio date;

-- ---------- Mapa de fases en árbol ----------
alter table public.fases
  add column if not exists parent_id uuid references public.fases(id) on delete cascade,
  add column if not exists estado_manual text check (estado_manual in ('pendiente', 'curso', 'hecho'));
create index if not exists fases_arbol_idx on public.fases (proyecto_id, parent_id, posicion);

-- ---------- Aviso inmediato al asignar ----------
alter table public.recordatorios_enviados drop constraint if exists recordatorios_enviados_tipo_check;
alter table public.recordatorios_enviados
  add constraint recordatorios_enviados_tipo_check
  check (tipo in ('manana', 'dias_antes', 'hoy', 'vencida', 'resumen', 'personal', 'manual', 'prueba', 'asignada'));

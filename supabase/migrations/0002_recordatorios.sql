-- =====================================================================
-- Fase 2 · Recordatorios personalizables por correo y WhatsApp
-- Ejecutar completo en Supabase > SQL Editor (después de 0001).
-- =====================================================================

-- Preferencias de aviso de cada persona
alter table public.perfiles
  add column if not exists hora_aviso smallint not null default 7 check (hora_aviso between 0 and 23),
  add column if not exists dias_antes smallint not null default 1 check (dias_antes between 0 and 7),
  add column if not exists avisar_hoy boolean not null default true,
  add column if not exists avisar_vencida boolean not null default true,
  add column if not exists repetir_vencida boolean not null default true,
  add column if not exists resumen_diario boolean not null default false;

-- Recordatorio puntual y mensaje personalizado por tarea
alter table public.tareas
  add column if not exists recordar_en timestamptz,
  add column if not exists recordatorio_enviado_en timestamptz,
  add column if not exists mensaje_recordatorio text;

create index if not exists tareas_recordar_idx on public.tareas (recordar_en) where recordar_en is not null;

-- Registro de envíos: más tipos, y la tarea es opcional (resumen diario, pruebas)
do $$
declare c record;
begin
  -- quita la restricción de tipos y la de "uno por día" de la versión 1 (sus nombres los generó Postgres)
  for c in
    select conname from pg_constraint
    where conrelid = 'public.recordatorios_enviados'::regclass
      and (contype = 'u' or (contype = 'c' and pg_get_constraintdef(oid) like '%tipo%'))
  loop
    execute format('alter table public.recordatorios_enviados drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.recordatorios_enviados alter column tarea_id drop not null;
alter table public.recordatorios_enviados
  add constraint recordatorios_enviados_tipo_check
  check (tipo in ('manana', 'dias_antes', 'hoy', 'vencida', 'resumen', 'personal', 'manual', 'prueba'));
alter table public.recordatorios_enviados
  add column if not exists ok boolean not null default true,
  add column if not exists detalle text;

-- Un aviso automático por tarea, persona, tipo y canal al día (los manuales y de prueba se pueden repetir)
create unique index if not exists recordatorios_diarios_unicos
  on public.recordatorios_enviados (tarea_id, user_id, tipo, canal, enviado_el)
  where tipo in ('manana', 'dias_antes', 'hoy', 'vencida') and ok;
create unique index if not exists recordatorios_resumen_unico
  on public.recordatorios_enviados (user_id, canal, enviado_el)
  where tipo = 'resumen' and ok;

grant select, insert on public.recordatorios_enviados to service_role;

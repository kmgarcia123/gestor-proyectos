-- =====================================================================
-- Fase 3 · Lista de pasos en cada tarea y mapa de fases con cuadros movibles
-- Ejecutar en Supabase > SQL Editor (después de 0003). Se puede ejecutar dos veces.
-- =====================================================================

-- Lista de mini pasos (checklist) de cada tarea: [{ "id": "...", "texto": "...", "hecho": false }]
alter table public.tareas add column if not exists pasos jsonb not null default '[]'::jsonb;
alter table public.tareas drop constraint if exists tareas_pasos_es_lista;
alter table public.tareas add constraint tareas_pasos_es_lista check (jsonb_typeof(pasos) = 'array');

-- Posición libre de cada cuadro en el mapa (vacía = ubicación automática en árbol)
alter table public.fases
  add column if not exists pos_x double precision,
  add column if not exists pos_y double precision;

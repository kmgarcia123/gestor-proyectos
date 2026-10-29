-- =====================================================================
-- Posición libre del cuadro principal (el proyecto) en el mapa de fases.
-- Ejecutar en Supabase > SQL Editor. Se puede ejecutar dos veces.
-- =====================================================================
alter table public.proyectos
  add column if not exists mapa_x double precision,
  add column if not exists mapa_y double precision;

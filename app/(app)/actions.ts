'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getContexto } from '@/lib/datos';
import type { Estado, Prioridad } from '@/lib/types';

function limpiar(texto: FormDataEntryValue | null, max = 500) {
  return String(texto || '').trim().slice(0, max);
}

export async function crearProyecto(formData: FormData) {
  const { supabase, workspaceId, user } = await getContexto();
  const nombre = limpiar(formData.get('nombre'), 120);
  if (!nombre) return;
  const { data, error } = await supabase
    .from('proyectos')
    .insert({
      workspace_id: workspaceId,
      nombre,
      descripcion: limpiar(formData.get('descripcion'), 1000) || null,
      color: limpiar(formData.get('color'), 9) || '#2246C4',
      fecha_fin: limpiar(formData.get('fecha_fin'), 10) || null,
      creado_por: user.id
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  const fases = limpiar(formData.get('fases'), 1000)
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
  if (fases.length) {
    await supabase.from('fases').insert(fases.map((nombre, i) => ({ proyecto_id: data.id, nombre, posicion: i })));
  }
  revalidatePath('/', 'layout');
  redirect(`/proyectos/${data.id}`);
}

export async function archivarProyecto(proyectoId: string) {
  const { supabase } = await getContexto();
  await supabase.from('proyectos').update({ archivado: true }).eq('id', proyectoId);
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function crearFase(proyectoId: string, nombre: string) {
  const { supabase } = await getContexto();
  const n = nombre.trim().slice(0, 80);
  if (!n) return;
  const { count } = await supabase.from('fases').select('id', { count: 'exact', head: true }).eq('proyecto_id', proyectoId);
  await supabase.from('fases').insert({ proyecto_id: proyectoId, nombre: n, posicion: count || 0 });
  revalidatePath(`/proyectos/${proyectoId}`);
}

export interface NuevaTarea {
  proyecto_id: string;
  titulo: string;
  estado?: Estado;
  prioridad?: Prioridad;
  responsable_id?: string | null;
  fecha_limite?: string | null;
  fase_id?: string | null;
  descripcion?: string | null;
  posicion?: number;
}

export async function crearTarea(t: NuevaTarea) {
  const { supabase, workspaceId, user } = await getContexto();
  const titulo = t.titulo.trim().slice(0, 200);
  if (!titulo) return null;
  const { data, error } = await supabase
    .from('tareas')
    .insert({
      workspace_id: workspaceId,
      proyecto_id: t.proyecto_id,
      titulo,
      estado: t.estado || 'por_hacer',
      prioridad: t.prioridad || 'media',
      responsable_id: t.responsable_id ?? user.id,
      fecha_limite: t.fecha_limite || null,
      fase_id: t.fase_id || null,
      descripcion: t.descripcion || null,
      posicion: t.posicion ?? Date.now(),
      creado_por: user.id
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/proyectos/${t.proyecto_id}`);
  revalidatePath('/');
  return data;
}

export type CambiosTarea = Partial<Pick<NuevaTarea, 'titulo' | 'estado' | 'prioridad' | 'responsable_id' | 'fecha_limite' | 'fase_id' | 'descripcion' | 'posicion'>>;

export async function actualizarTarea(id: string, cambios: CambiosTarea) {
  const { supabase } = await getContexto();
  const permitido: CambiosTarea = {};
  (['titulo', 'estado', 'prioridad', 'responsable_id', 'fecha_limite', 'fase_id', 'descripcion', 'posicion'] as const).forEach((k) => {
    if (k in cambios) (permitido as Record<string, unknown>)[k] = cambios[k] === '' ? null : cambios[k];
  });
  if (typeof permitido.titulo === 'string') permitido.titulo = permitido.titulo.trim().slice(0, 200);
  const { data, error } = await supabase.from('tareas').update(permitido).eq('id', id).select('proyecto_id').single();
  if (error) throw new Error(error.message);
  revalidatePath(`/proyectos/${data.proyecto_id}`);
  revalidatePath('/');
}

export async function eliminarTarea(id: string) {
  const { supabase } = await getContexto();
  const { data } = await supabase.from('tareas').delete().eq('id', id).select('proyecto_id').single();
  if (data) revalidatePath(`/proyectos/${data.proyecto_id}`);
  revalidatePath('/');
}

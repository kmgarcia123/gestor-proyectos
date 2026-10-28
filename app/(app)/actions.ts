'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { getContexto } from '@/lib/datos';
import { canalesActivos, notificar } from '@/lib/notificar';
import { armarAvisoAsignada, armarAvisoTarea, CAMPOS_PERFIL, type PerfilAvisos } from '@/lib/recordatorios';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Estado, EstadoFase, Paso, Prioridad } from '@/lib/types';

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

// ---------- Fases (mapa en árbol) ----------

export async function crearFase(proyectoId: string, nombre: string, parentId: string | null = null) {
  const { supabase } = await getContexto();
  const n = nombre.trim().slice(0, 80);
  if (!n) return null;
  let q = supabase.from('fases').select('posicion').eq('proyecto_id', proyectoId).order('posicion', { ascending: false }).limit(1);
  q = parentId ? q.eq('parent_id', parentId) : q.is('parent_id', null);
  const { data: ultima } = await q.maybeSingle();
  const { data, error } = await supabase
    .from('fases')
    .insert({ proyecto_id: proyectoId, nombre: n, parent_id: parentId, posicion: (ultima?.posicion ?? -1) + 1 })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/proyectos/${proyectoId}`);
  return data;
}

export async function actualizarFase(id: string, cambios: { nombre?: string; parent_id?: string | null; posicion?: number; estado_manual?: EstadoFase | null }) {
  const { supabase } = await getContexto();
  const permitido: Record<string, unknown> = {};
  if (typeof cambios.nombre === 'string') {
    const n = cambios.nombre.trim().slice(0, 80);
    if (n) permitido.nombre = n;
  }
  if ('parent_id' in cambios) {
    if (cambios.parent_id === id) throw new Error('Una fase no puede estar dentro de sí misma.');
    permitido.parent_id = cambios.parent_id || null;
  }
  if (typeof cambios.posicion === 'number') permitido.posicion = Math.round(cambios.posicion);
  if ('estado_manual' in cambios) permitido.estado_manual = cambios.estado_manual || null;
  if (!Object.keys(permitido).length) return;

  // Evitar ciclos: la nueva fase "padre" no puede ser una subfase de esta.
  if (permitido.parent_id) {
    const { data: fase } = await supabase.from('fases').select('proyecto_id').eq('id', id).single();
    const { data: todas } = await supabase.from('fases').select('id, parent_id').eq('proyecto_id', fase?.proyecto_id || '');
    const padreDe = new Map((todas || []).map((f) => [f.id, f.parent_id as string | null]));
    let cursor: string | null = permitido.parent_id as string;
    while (cursor) {
      if (cursor === id) throw new Error('No se puede mover una fase dentro de una de sus subfases.');
      cursor = padreDe.get(cursor) ?? null;
    }
  }
  const { data, error } = await supabase.from('fases').update(permitido).eq('id', id).select('proyecto_id').single();
  if (error) throw new Error(error.message);
  revalidatePath(`/proyectos/${data.proyecto_id}`);
}

/** Intercambia la posición de dos fases hermanas (mover a la izquierda o derecha en el mapa). */
export async function intercambiarFases(a: { id: string; posicion: number }, b: { id: string; posicion: number }) {
  const { supabase } = await getContexto();
  await supabase.from('fases').update({ posicion: b.posicion }).eq('id', a.id);
  const { data } = await supabase.from('fases').update({ posicion: a.posicion }).eq('id', b.id).select('proyecto_id').single();
  if (data) revalidatePath(`/proyectos/${data.proyecto_id}`);
}

/** Guarda dónde quedó cada cuadro en el mapa (null = volver a la ubicación automática). */
export async function guardarPosiciones(proyectoId: string, posiciones: { id: string; x: number | null; y: number | null }[]) {
  const { supabase } = await getContexto();
  const n = (v: number | null) => (v === null || !Number.isFinite(v) ? null : Math.max(0, Math.min(20000, Math.round(v))));
  await Promise.all(posiciones.slice(0, 300).map((p) => supabase.from('fases').update({ pos_x: n(p.x), pos_y: n(p.y) }).eq('id', p.id).eq('proyecto_id', proyectoId)));
  revalidatePath(`/proyectos/${proyectoId}`);
}

/** Vuelve a ordenar todo el mapa en forma de árbol automático. */
export async function ordenarMapa(proyectoId: string) {
  const { supabase } = await getContexto();
  await supabase.from('fases').update({ pos_x: null, pos_y: null }).eq('proyecto_id', proyectoId);
  revalidatePath(`/proyectos/${proyectoId}`);
}

export async function eliminarFase(id: string) {
  const { supabase } = await getContexto();
  // Las subfases se eliminan en cascada; las tareas quedan "sin fase".
  const { data } = await supabase.from('fases').delete().eq('id', id).select('proyecto_id').single();
  if (data) revalidatePath(`/proyectos/${data.proyecto_id}`);
}

// ---------- Tareas ----------

export interface NuevaTarea {
  proyecto_id: string;
  titulo: string;
  estado?: Estado;
  prioridad?: Prioridad;
  responsables?: string[];
  fecha_inicio?: string | null;
  fecha_limite?: string | null;
  fase_id?: string | null;
  descripcion?: string | null;
  posicion?: number;
  recordar_en?: string | null;
  mensaje_recordatorio?: string | null;
}

const UUID = /^[0-9a-f-]{36}$/i;
function limpiarResponsables(v: unknown): string[] {
  return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && UUID.test(x)))].slice(0, 20) : [];
}

export async function crearTarea(t: NuevaTarea) {
  const { supabase, workspaceId, user, yo } = await getContexto();
  const titulo = t.titulo.trim().slice(0, 200);
  if (!titulo) return null;
  const responsables = t.responsables ? limpiarResponsables(t.responsables) : [user.id];
  const { data, error } = await supabase
    .from('tareas')
    .insert({
      workspace_id: workspaceId,
      proyecto_id: t.proyecto_id,
      titulo,
      estado: t.estado || 'por_hacer',
      prioridad: t.prioridad || 'media',
      responsables,
      fecha_inicio: t.fecha_inicio || null,
      fecha_limite: t.fecha_limite || null,
      fase_id: t.fase_id || null,
      descripcion: t.descripcion || null,
      // Las nuevas quedan de primeras en su columna.
      posicion: t.posicion ?? -Date.now(),
      creado_por: user.id
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  avisarAsignacion(data.id, responsables.filter((r) => r !== user.id), yo);
  revalidatePath(`/proyectos/${t.proyecto_id}`);
  revalidatePath('/');
  return data;
}

export type CambiosTarea = Partial<Pick<NuevaTarea, 'titulo' | 'estado' | 'prioridad' | 'responsables' | 'fecha_inicio' | 'fecha_limite' | 'fase_id' | 'descripcion' | 'posicion' | 'recordar_en' | 'mensaje_recordatorio'>>;

export async function actualizarTarea(id: string, cambios: CambiosTarea) {
  const { supabase, user, yo } = await getContexto();
  const permitido: CambiosTarea = {};
  (['titulo', 'estado', 'prioridad', 'responsables', 'fecha_inicio', 'fecha_limite', 'fase_id', 'descripcion', 'posicion', 'recordar_en', 'mensaje_recordatorio'] as const).forEach((k) => {
    if (k in cambios) (permitido as Record<string, unknown>)[k] = cambios[k] === '' ? null : cambios[k];
  });
  if (typeof permitido.titulo === 'string') permitido.titulo = permitido.titulo.trim().slice(0, 200);
  if (typeof permitido.mensaje_recordatorio === 'string') permitido.mensaje_recordatorio = permitido.mensaje_recordatorio.trim().slice(0, 300) || null;
  if (permitido.recordar_en) {
    const d = new Date(permitido.recordar_en);
    permitido.recordar_en = isNaN(d.getTime()) ? null : d.toISOString();
  }
  let antes: string[] = [];
  if ('responsables' in permitido) {
    permitido.responsables = limpiarResponsables(permitido.responsables);
    const { data: previa } = await supabase.from('tareas').select('responsables').eq('id', id).single();
    antes = (previa?.responsables as string[]) || [];
  }
  const { data, error } = await supabase.from('tareas').update(permitido).eq('id', id).select('proyecto_id').single();
  if (error) throw new Error(error.message);
  if (permitido.responsables) {
    avisarAsignacion(id, permitido.responsables.filter((r) => !antes.includes(r) && r !== user.id), yo);
  }
  revalidatePath(`/proyectos/${data.proyecto_id}`);
  revalidatePath('/');
}

/** Guarda la lista de pasos de una tarea (se llama cada vez que se agrega, marca o borra un paso). */
export async function guardarPasos(tareaId: string, pasos: Paso[]) {
  const { supabase } = await getContexto();
  const limpios = (Array.isArray(pasos) ? pasos : [])
    .slice(0, 60)
    .map((p) => ({ id: String(p.id || '').slice(0, 40) || crypto.randomUUID(), texto: String(p.texto || '').trim().slice(0, 200), hecho: Boolean(p.hecho) }))
    .filter((p) => p.texto);
  const { data, error } = await supabase.from('tareas').update({ pasos: limpios }).eq('id', tareaId).select('proyecto_id').single();
  if (error) throw new Error(error.message);
  revalidatePath(`/proyectos/${data.proyecto_id}`);
  return limpios;
}

/** Envía a las personas recién asignadas un aviso inmediato (después de responder, para no demorar la pantalla). */
function avisarAsignacion(tareaId: string, nuevos: string[], quien: { nombre: string | null; email: string }) {
  if (!nuevos.length) return;
  const deParte = (quien.nombre || quien.email).split(' ')[0];
  after(async () => {
    const admin = createAdminClient();
    const [{ data: t }, { data: personas }] = await Promise.all([
      admin.from('tareas').select('id, titulo, proyecto_id, fecha_inicio, fecha_limite, descripcion, proyectos(nombre)').eq('id', tareaId).single(),
      admin.from('perfiles').select(CAMPOS_PERFIL).in('id', nuevos)
    ]);
    if (!t) return;
    const proyecto = (t.proyectos as unknown as { nombre: string } | null)?.nombre;
    for (const p of (personas || []) as PerfilAvisos[]) {
      const canales = canalesActivos(p);
      if (canales.length) await notificar(p, armarAvisoAsignada({ ...t, proyecto }, deParte), canales, { tipo: 'asignada', tareas: [t.id] });
    }
  });
}

export async function eliminarTarea(id: string) {
  const { supabase } = await getContexto();
  const { data } = await supabase.from('tareas').delete().eq('id', id).select('proyecto_id').single();
  if (data) revalidatePath(`/proyectos/${data.proyecto_id}`);
  revalidatePath('/');
}

/** Envía ya mismo un recordatorio de la tarea a sus responsables (menos a quien lo envía), por los canales de cada uno. */
export async function recordarAhora(tareaId: string, mensaje: string): Promise<{ ok: boolean; texto: string }> {
  const { supabase, yo } = await getContexto();
  // Con el cliente del usuario: si no es de su espacio, RLS no la devuelve.
  const { data: t } = await supabase.from('tareas').select('id, titulo, proyecto_id, fecha_limite, responsables, proyectos(nombre)').eq('id', tareaId).maybeSingle();
  if (!t) return { ok: false, texto: 'No se encontró la tarea.' };
  const todos = (t.responsables as string[]) || [];
  if (!todos.length) return { ok: false, texto: 'Asigna al menos un responsable antes de enviar el recordatorio.' };
  const destinos = todos.length > 1 ? todos.filter((r) => r !== yo.id) : todos;

  const { data: personas } = await createAdminClient().from('perfiles').select(CAMPOS_PERFIL).in('id', destinos);
  const proyecto = (t.proyectos as unknown as { nombre: string } | null)?.nombre;
  const texto = mensaje.trim().slice(0, 300) || null;
  const partes: string[] = [];
  let algunoBien = false;
  for (const dest of (personas || []) as PerfilAvisos[]) {
    const nombre = (dest.nombre || dest.email).split(' ')[0];
    const canales = canalesActivos(dest);
    if (!canales.length) {
      partes.push(`${nombre}: tiene apagados correo y WhatsApp.`);
      continue;
    }
    const dePart = dest.id === yo.id ? null : (yo.nombre || yo.email).split(' ')[0];
    const resultados = await notificar(dest, armarAvisoTarea({ ...t, proyecto }, texto, dePart), canales, { tipo: 'manual', tareas: [t.id] });
    const bien = resultados.filter((r) => r.ok).map((r) => (r.canal === 'correo' ? 'correo' : 'WhatsApp'));
    const mal = resultados.filter((r) => !r.ok).map((r) => `${r.canal === 'correo' ? 'correo' : 'WhatsApp'} falló (${r.detalle})`);
    if (bien.length) algunoBien = true;
    partes.push(`${nombre}: ${[bien.length ? `enviado por ${bien.join(' y ')}` : '', ...mal].filter(Boolean).join('; ')}.`);
  }
  return { ok: algunoBien, texto: partes.join(' ') || 'No se encontraron los responsables.' };
}

'use server';

import { revalidatePath } from 'next/cache';
import { getContexto } from '@/lib/datos';
import { normalizarTelefono, notificar, type Canal } from '@/lib/notificar';
import { armarAvisoDiario, CAMPOS_PERFIL, tipoDiario, type PerfilAvisos } from '@/lib/recordatorios';
import { hoyBogota } from '@/lib/fechas';

export type Estado = { ok: boolean; texto: string } | null;

function numero(v: FormDataEntryValue | null, min: number, max: number, def: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
}

export async function guardarAvisos(_prev: Estado, formData: FormData): Promise<Estado> {
  const { supabase, user } = await getContexto();
  const telefonoTexto = String(formData.get('telefono') || '').trim();
  const telefono = telefonoTexto ? normalizarTelefono(telefonoTexto) : null;
  const avisarWhatsApp = formData.get('avisar_whatsapp') === 'on';
  if (telefonoTexto && !telefono) return { ok: false, texto: 'El número no es válido. Escríbelo con indicativo, por ejemplo 573001234567.' };
  if (avisarWhatsApp && !telefono) return { ok: false, texto: 'Para recibir WhatsApp escribe tu número de celular.' };

  const { error } = await supabase
    .from('perfiles')
    .update({
      telefono,
      avisar_correo: formData.get('avisar_correo') === 'on',
      avisar_whatsapp: avisarWhatsApp,
      hora_aviso: numero(formData.get('hora_aviso'), 0, 23, 7),
      dias_antes: numero(formData.get('dias_antes'), 0, 7, 1),
      avisar_hoy: formData.get('avisar_hoy') === 'on',
      avisar_vencida: formData.get('avisar_vencida') === 'on',
      repetir_vencida: formData.get('repetir_vencida') === 'on',
      resumen_diario: formData.get('resumen_diario') === 'on'
    })
    .eq('id', user.id);
  if (error) return { ok: false, texto: 'No se pudo guardar: ' + error.message };
  revalidatePath('/notificaciones');
  return { ok: true, texto: 'Preferencias guardadas.' };
}

/** Envía a uno mismo una prueba con sus tareas reales, sin afectar los avisos automáticos. */
export async function probarCanal(canal: Canal): Promise<Estado> {
  const { supabase, user } = await getContexto();
  const { data: p } = await supabase.from('perfiles').select(CAMPOS_PERFIL).eq('id', user.id).single();
  if (!p) return { ok: false, texto: 'No se encontró tu perfil.' };
  const yo = p as PerfilAvisos;
  const { data: tareas } = await supabase
    .from('tareas')
    .select('id, titulo, fecha_limite, proyecto_id, responsables, estado, recordar_en, recordatorio_enviado_en, mensaje_recordatorio, proyectos(nombre)')
    .contains('responsables', [user.id])
    .neq('estado', 'hecho')
    .order('fecha_limite', { ascending: true, nullsFirst: false })
    .limit(30);

  const hoy = hoyBogota();
  const lista = (tareas || []) as unknown as Parameters<typeof armarAvisoDiario>[2];
  const alertas = lista.flatMap((t) => {
    const tipo = tipoDiario(t.fecha_limite, yo, hoy);
    return tipo ? [{ tarea: t, tipo }] : [];
  });
  const ids = new Set(alertas.map((a) => a.tarea.id));
  const aviso = armarAvisoDiario(yo, alertas, lista.filter((t) => !ids.has(t.id)));
  aviso.asunto = `Prueba · ${aviso.asunto}`;
  if (!lista.length) aviso.resumenWhatsApp = 'esto es una prueba, no tienes tareas pendientes';

  const [r] = await notificar({ ...yo, telefono: normalizarTelefono(String(yo.telefono || '')) }, aviso, [canal], { tipo: 'prueba', tareas: [] });
  revalidatePath('/notificaciones');
  const nombre = canal === 'correo' ? 'correo' : 'WhatsApp';
  return r.ok ? { ok: true, texto: `Listo: revisa tu ${nombre}.` } : { ok: false, texto: `No llegó por ${nombre}: ${r.detalle}` };
}

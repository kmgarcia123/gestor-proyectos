import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatoCorto, hoyBogota } from '@/lib/fechas';

export const dynamic = 'force-dynamic';

type Tipo = 'manana' | 'hoy' | 'vencida';

interface Fila {
  id: string;
  titulo: string;
  fecha_limite: string;
  proyecto_id: string;
  responsable_id: string;
  proyectos: { nombre: string } | null;
  perfiles: { id: string; email: string; nombre: string | null; avisar_correo: boolean } | null;
}

const ASUNTO: Record<Tipo, string> = {
  manana: 'Vence mañana',
  hoy: 'Vence hoy',
  vencida: 'Tarea vencida'
};

/**
 * Corre una vez al día (vercel.json). Envía a cada responsable un solo correo
 * con sus tareas que vencen mañana, hoy o ya vencieron, sin repetir el mismo día.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Falta RESEND_API_KEY' }, { status: 500 });
  }

  const supabase = createAdminClient();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const hoy = hoyBogota();
  const manana = hoyBogota(1);
  const app = process.env.NEXT_PUBLIC_APP_NAME || 'Gestor de proyectos';
  const sitio = process.env.NEXT_PUBLIC_SITE_URL || '';

  const { data, error } = await supabase
    .from('tareas')
    .select('id, titulo, fecha_limite, proyecto_id, responsable_id, proyectos(nombre), perfiles!tareas_responsable_id_fkey(id, email, nombre, avisar_correo)')
    .neq('estado', 'hecho')
    .not('responsable_id', 'is', null)
    .lte('fecha_limite', manana);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: enviados } = await supabase.from('recordatorios_enviados').select('tarea_id, user_id, tipo').eq('enviado_el', hoy).eq('canal', 'correo');
  const ya = new Set((enviados || []).map((e) => `${e.tarea_id}|${e.user_id}|${e.tipo}`));

  // Agrupar por persona
  const porPersona = new Map<string, { perfil: NonNullable<Fila['perfiles']>; items: { fila: Fila; tipo: Tipo }[] }>();
  for (const fila of (data || []) as unknown as Fila[]) {
    const perfil = fila.perfiles;
    if (!perfil || !perfil.avisar_correo) continue;
    const tipo: Tipo = fila.fecha_limite < hoy ? 'vencida' : fila.fecha_limite === hoy ? 'hoy' : 'manana';
    if (ya.has(`${fila.id}|${perfil.id}|${tipo}`)) continue;
    if (!porPersona.has(perfil.id)) porPersona.set(perfil.id, { perfil, items: [] });
    porPersona.get(perfil.id)!.items.push({ fila, tipo });
  }

  let correos = 0;
  const errores: string[] = [];
  for (const { perfil, items } of porPersona.values()) {
    const orden: Tipo[] = ['vencida', 'hoy', 'manana'];
    items.sort((a, b) => orden.indexOf(a.tipo) - orden.indexOf(b.tipo));
    const vencidas = items.filter((i) => i.tipo === 'vencida').length;
    const asunto = vencidas
      ? `${vencidas} tarea${vencidas > 1 ? 's' : ''} vencida${vencidas > 1 ? 's' : ''} · ${app}`
      : `${items.length} tarea${items.length > 1 ? 's' : ''} por vencer · ${app}`;

    const filas = items
      .map(({ fila, tipo }) => {
        const color = tipo === 'vencida' ? '#B42318' : tipo === 'hoy' ? '#92400E' : '#1B389E';
        const enlace = sitio ? `${sitio}/proyectos/${fila.proyecto_id}?tarea=${fila.id}` : '#';
        return `<tr><td style="padding:12px 0;border-bottom:1px solid #EEF2F7">
          <span style="display:inline-block;font-size:12px;font-weight:700;color:${color}">${ASUNTO[tipo]} · ${formatoCorto(fila.fecha_limite)}</span><br>
          <a href="${enlace}" style="font-size:15px;font-weight:600;color:#182333;text-decoration:none">${escapar(fila.titulo)}</a><br>
          <span style="font-size:13px;color:#6E6E73">${escapar(fila.proyectos?.nombre || '')}</span>
        </td></tr>`;
      })
      .join('');

    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#182333">
      <h1 style="font-size:20px;margin:0 0 4px">Hola, ${escapar((perfil.nombre || perfil.email).split(' ')[0])}</h1>
      <p style="margin:0 0 16px;color:#6E6E73">Estas son tus tareas que necesitan atención:</p>
      <table width="100%" cellspacing="0" cellpadding="0">${filas}</table>
      ${sitio ? `<p style="margin-top:24px"><a href="${sitio}" style="background:#2246C4;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">Abrir ${escapar(app)}</a></p>` : ''}
      <p style="margin-top:24px;font-size:12px;color:#8A8A90">Recordatorio automático de ${escapar(app)}.</p>
    </div>`;

    const { error: errEnvio } = await resend.emails.send({
      from: process.env.RECORDATORIOS_REMITENTE || 'Recordatorios <onboarding@resend.dev>',
      to: perfil.email,
      subject: asunto,
      html
    });
    if (errEnvio) {
      errores.push(`${perfil.email}: ${errEnvio.message}`);
      continue;
    }
    correos++;
    await supabase.from('recordatorios_enviados').upsert(
      items.map(({ fila, tipo }) => ({ tarea_id: fila.id, user_id: perfil.id, tipo, canal: 'correo', enviado_el: hoy })),
      { onConflict: 'tarea_id,user_id,tipo,canal,enviado_el', ignoreDuplicates: true }
    );
  }

  return NextResponse.json({ fecha: hoy, personas: porPersona.size, correos, errores });
}

function escapar(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

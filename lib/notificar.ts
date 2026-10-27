import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Envío de recordatorios por correo (Resend) y WhatsApp (API oficial de Meta).
 * Solo se usa en el servidor: lee claves secretas de las variables de entorno.
 */

export type Canal = 'correo' | 'whatsapp';
export type TipoAviso = 'manana' | 'dias_antes' | 'hoy' | 'vencida' | 'resumen' | 'personal' | 'manual' | 'prueba';

export interface Destinatario {
  id: string;
  email: string;
  nombre: string | null;
  telefono: string | null;
  avisar_correo: boolean;
  avisar_whatsapp: boolean;
}

export interface LineaAviso {
  grupo?: string; // encabezado de sección ("Necesitan atención", "Otras pendientes")
  etiqueta: string; // "Vence hoy · 28 oct"
  color?: string;
  titulo: string;
  detalle?: string; // nombre del proyecto
  enlace?: string;
}

export interface Aviso {
  asunto: string;
  intro: string; // frase corta: "Estas son tus tareas que necesitan atención"
  chips?: { texto: string; color: string; fondo: string }[]; // resumen en cifras arriba del correo
  mensaje?: string | null; // texto personalizado ("Por favor haz la tarea")
  lineas: LineaAviso[];
  enlace?: string; // botón principal
  /** Texto de una sola línea para la plantilla de WhatsApp. */
  resumenWhatsApp: string;
}

export interface Resultado {
  canal: Canal;
  ok: boolean;
  detalle: string;
}

const APP = () => process.env.NEXT_PUBLIC_APP_NAME || 'Gestor de proyectos';
/** URL de la app. En vistas previas de Vercel usa el enlace de la rama, para que los botones abran la versión que se está probando. */
export const SITIO = () => {
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_BRANCH_URL) return `https://${process.env.VERCEL_BRANCH_URL}`;
  const url = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  return url.replace(/\/$/, '');
};

export function escapar(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function primerNombre(p: { nombre: string | null; email: string }) {
  const n = (p.nombre || p.email.split('@')[0]).trim().split(/\s+/)[0] || '';
  return n.charAt(0).toLocaleUpperCase('es-CO') + n.slice(1).toLocaleLowerCase('es-CO');
}

/** Deja solo dígitos. Devuelve null si no parece un número internacional válido. */
export function normalizarTelefono(t: string | null | undefined): string | null {
  const d = String(t || '').replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('3')) return '57' + d; // celular colombiano sin indicativo
  return d.length >= 11 && d.length <= 15 ? d : null;
}

/** WhatsApp no acepta saltos de línea, tabs ni más de 4 espacios seguidos en los parámetros. */
function paramWhatsApp(s: string, max: number) {
  const limpio = s.replace(/[\r\n\t]+/g, ' · ').replace(/ {2,}/g, ' ').trim();
  return limpio.length > max ? limpio.slice(0, max - 1) + '…' : limpio || '-';
}

export function htmlAviso(dest: Destinatario, aviso: Aviso) {
  let grupoActual: string | undefined;
  const filas = aviso.lineas
    .map((l) => {
      const encabezado =
        l.grupo && l.grupo !== grupoActual
          ? `<tr><td style="padding:22px 0 4px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8A8A90">${escapar(l.grupo)}</td></tr>`
          : '';
      grupoActual = l.grupo ?? grupoActual;
      const color = l.color || '#1B389E';
      const ver = l.enlace ? `<a href="${escapar(l.enlace)}" style="font-size:13px;font-weight:600;color:#2246C4;text-decoration:none;white-space:nowrap">Ver tarea →</a>` : '';
      const titulo = l.enlace
        ? `<a href="${escapar(l.enlace)}" style="font-size:16px;font-weight:700;color:#182333;text-decoration:none">${escapar(l.titulo)}</a>`
        : `<span style="font-size:16px;font-weight:700;color:#182333">${escapar(l.titulo)}</span>`;
      return `${encabezado}<tr><td style="padding:6px 0">
        <table width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E6EBF5;border-left:4px solid ${color};border-radius:12px;background:#FFFFFF"><tr>
          <td style="padding:12px 14px">
            <span style="font-size:12px;font-weight:700;color:${color}">${escapar(l.etiqueta)}</span><br>
            ${titulo}${l.detalle ? `<br><span style="font-size:13px;color:#6E6E73">${escapar(l.detalle)}</span>` : ''}
          </td>
          <td align="right" valign="middle" style="padding:12px 14px">${ver}</td>
        </tr></table>
      </td></tr>`;
    })
    .join('');
  const chips = (aviso.chips || [])
    .map((c) => `<span style="display:inline-block;margin:0 6px 6px 0;padding:6px 12px;border-radius:999px;background:${c.fondo};color:${c.color};font-size:13px;font-weight:700">${escapar(c.texto)}</span>`)
    .join('');
  const mensaje = aviso.mensaje
    ? `<p style="margin:0 0 16px;padding:14px 16px;border-left:4px solid #20B7A9;background:#F2FBFA;border-radius:8px;font-size:15px;color:#182333">${escapar(aviso.mensaje)}</p>`
    : '';
  return `<div style="background:#F3F6FC;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#182333">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E6EBF5">
    <div style="background:#182333;padding:16px 24px">
      <span style="display:inline-block;width:6px;height:18px;background:#2246C4;border-radius:2px;vertical-align:middle"></span><span style="display:inline-block;width:6px;height:13px;background:#FFFFFF;border-radius:2px;margin-left:3px;vertical-align:middle"></span><span style="display:inline-block;width:6px;height:8px;background:#20B7A9;border-radius:2px;margin-left:3px;vertical-align:middle"></span>
      <span style="color:#FFFFFF;font-weight:700;font-size:15px;margin-left:10px;vertical-align:middle">${escapar(APP())}</span>
    </div>
    <div style="padding:24px">
      <h1 style="font-size:22px;margin:0 0 6px">Hola, ${escapar(primerNombre(dest))}</h1>
      <p style="margin:0 0 14px;color:#6E6E73;font-size:15px">${escapar(aviso.intro)}</p>
      ${chips ? `<div style="margin:0 0 6px">${chips}</div>` : ''}
      ${mensaje}
      ${filas ? `<table width="100%" cellspacing="0" cellpadding="0">${filas}</table>` : ''}
      ${aviso.enlace ? `<p style="margin:26px 0 0;text-align:center"><a href="${escapar(aviso.enlace)}" style="display:inline-block;background:#2246C4;color:#FFFFFF;padding:13px 26px;border-radius:999px;text-decoration:none;font-weight:700;font-size:15px">Abrir ${escapar(APP())}</a></p>` : ''}
    </div>
    <div style="padding:14px 24px;border-top:1px solid #EEF2F7;font-size:12px;color:#8A8A90">
      Aviso automático de ${escapar(APP())}. Cambia cuándo y por dónde te avisamos en «Mis notificaciones»${SITIO() ? ` (<a href="${escapar(SITIO())}/notificaciones" style="color:#8A8A90">abrir</a>)` : ''}.
    </div>
  </div>
</div>`;
}

export async function enviarCorreo(dest: Destinatario, aviso: Aviso): Promise<Resultado> {
  if (!process.env.RESEND_API_KEY) return { canal: 'correo', ok: false, detalle: 'Falta configurar RESEND_API_KEY en Vercel' };
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: process.env.RECORDATORIOS_REMITENTE || 'Recordatorios <onboarding@resend.dev>',
      to: dest.email,
      subject: aviso.asunto,
      html: htmlAviso(dest, aviso)
    });
    if (error) return { canal: 'correo', ok: false, detalle: error.message };
    return { canal: 'correo', ok: true, detalle: data?.id ? `Resend ${data.id}` : 'Enviado' };
  } catch (e) {
    return { canal: 'correo', ok: false, detalle: e instanceof Error ? e.message : 'Error desconocido' };
  }
}

/**
 * Envía la plantilla aprobada en Meta. Cuerpo esperado de la plantilla (3 variables):
 *   Hola {{1}}, hay una actualización de las tareas asignadas a tu cuenta: {{2}}. Puedes ver el detalle aquí: {{3}} Este es un aviso automático de tu cuenta.
 */
export async function enviarWhatsApp(dest: Destinatario, aviso: Aviso): Promise<Resultado> {
  const token = process.env.WHATSAPP_TOKEN;
  const numeroId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !numeroId) return { canal: 'whatsapp', ok: false, detalle: 'Falta configurar WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID en Vercel' };
  const telefono = normalizarTelefono(dest.telefono);
  if (!telefono) return { canal: 'whatsapp', ok: false, detalle: 'La persona no tiene un número de WhatsApp válido en «Mis notificaciones»' };

  const version = process.env.WHATSAPP_API_VERSION || 'v23.0';
  const cuerpo = {
    messaging_product: 'whatsapp',
    to: telefono,
    type: 'template',
    template: {
      name: process.env.WHATSAPP_PLANTILLA || 'recordatorio_tareas_es',
      language: { code: process.env.WHATSAPP_IDIOMA || 'es' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: paramWhatsApp(primerNombre(dest), 60) },
            { type: 'text', text: paramWhatsApp(aviso.resumenWhatsApp, 700) },
            { type: 'text', text: paramWhatsApp(aviso.enlace || SITIO() || '-', 300) }
          ]
        }
      ]
    }
  };
  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${numeroId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      cache: 'no-store'
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; error_data?: { details?: string } } };
    if (!res.ok) {
      const e = json.error;
      return { canal: 'whatsapp', ok: false, detalle: [e?.message, e?.error_data?.details].filter(Boolean).join(' — ') || `HTTP ${res.status}` };
    }
    return { canal: 'whatsapp', ok: true, detalle: json.messages?.[0]?.id ? `Meta ${json.messages[0].id}` : 'Enviado' };
  } catch (e) {
    return { canal: 'whatsapp', ok: false, detalle: e instanceof Error ? e.message : 'Error desconocido' };
  }
}

export function canalesActivos(dest: Destinatario): Canal[] {
  const c: Canal[] = [];
  if (dest.avisar_correo) c.push('correo');
  if (dest.avisar_whatsapp) c.push('whatsapp');
  return c;
}

export async function enviarPorCanal(canal: Canal, dest: Destinatario, aviso: Aviso) {
  return canal === 'correo' ? enviarCorreo(dest, aviso) : enviarWhatsApp(dest, aviso);
}

/** Guarda en el historial qué se envió (o qué falló). Usa permisos de servidor. */
export async function registrar(
  filas: { tarea_id?: string | null; user_id: string; tipo: TipoAviso; canal: Canal; ok: boolean; detalle?: string; enviado_el?: string }[]
) {
  if (!filas.length) return;
  const admin = createAdminClient();
  const registros = filas.map((f) => ({
    tarea_id: f.tarea_id ?? null,
    user_id: f.user_id,
    tipo: f.tipo,
    canal: f.canal,
    ok: f.ok,
    detalle: f.detalle?.slice(0, 500) ?? null,
    ...(f.enviado_el ? { enviado_el: f.enviado_el } : {})
  }));
  const { error } = await admin.from('recordatorios_enviados').insert(registros);
  if (!error) return;
  if (error.code === '23505' && registros.length > 1) {
    // Si dos ejecuciones coinciden, el índice único evita duplicados: se guardan una por una las que falten.
    for (const r of registros) await admin.from('recordatorios_enviados').insert(r);
  } else if (error.code !== '23505') {
    console.error('No se pudo registrar el recordatorio:', error.message);
  }
}

/** Envía un aviso por varios canales y lo registra (una fila por tarea y canal). */
export async function notificar(dest: Destinatario, aviso: Aviso, canales: Canal[], registro: { tipo: TipoAviso; tareas: (string | null)[]; enviado_el?: string }) {
  const resultados: Resultado[] = [];
  for (const canal of canales) {
    const r = await enviarPorCanal(canal, dest, aviso);
    resultados.push(r);
    const tareas = registro.tareas.length ? registro.tareas : [null];
    await registrar(tareas.map((tarea_id) => ({ tarea_id, user_id: dest.id, tipo: registro.tipo, canal, ok: r.ok, detalle: r.detalle, enviado_el: registro.enviado_el })));
  }
  return resultados;
}

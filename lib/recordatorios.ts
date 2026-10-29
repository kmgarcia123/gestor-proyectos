import { createAdminClient } from '@/lib/supabase/admin';
import { textoPlano } from '@/lib/html';
import { formatoCorto, hoyBogota } from '@/lib/fechas';
import { canalesActivos, notificar, primerNombre, registrar, SITIO, type Aviso, type Canal, type Destinatario, type LineaAviso, type Resultado, type TipoAviso } from '@/lib/notificar';

/**
 * Lógica de los recordatorios automáticos. La llama /api/cron/recordatorios
 * (cada 15 minutos desde Supabase, y una vez al día desde Vercel como respaldo).
 *
 * 1. Aviso diario: a partir de la hora que eligió cada persona, un solo mensaje por canal
 *    con lo que vence en sus "días antes", lo que vence hoy y lo vencido (+ resumen si lo pidió).
 * 2. Recordatorios puntuales: tareas con "Recordar el" cuya hora ya llegó.
 */

export interface PerfilAvisos extends Destinatario {
  hora_aviso: number;
  dias_antes: number;
  avisar_hoy: boolean;
  avisar_vencida: boolean;
  repetir_vencida: boolean;
  resumen_diario: boolean;
}

export const CAMPOS_PERFIL = 'id, email, nombre, telefono, avisar_correo, avisar_whatsapp, hora_aviso, dias_antes, avisar_hoy, avisar_vencida, repetir_vencida, resumen_diario';

interface TareaAviso {
  id: string;
  titulo: string;
  fecha_limite: string | null;
  proyecto_id: string;
  responsables: string[];
  estado: string;
  recordar_en: string | null;
  recordatorio_enviado_en: string | null;
  mensaje_recordatorio: string | null;
  proyectos: { nombre: string } | null;
}

const COLOR: Record<string, string> = { vencida: '#B42318', hoy: '#92400E', dias_antes: '#1B389E', manana: '#1B389E', resumen: '#6E6E73' };

export function horaBogota(fecha = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hourCycle: 'h23' }).format(fecha)) % 24;
}

export function enlaceTarea(t: { id: string; proyecto_id: string }) {
  const s = SITIO();
  return s ? `${s}/proyectos/${t.proyecto_id}?tarea=${t.id}` : undefined;
}

type TipoDiario = 'dias_antes' | 'manana' | 'hoy' | 'vencida';

function etiqueta(tipo: TipoDiario | 'resumen', fecha: string | null) {
  const f = fecha ? ` · ${formatoCorto(fecha)}` : '';
  if (tipo === 'vencida') return `Vencida${f}`;
  if (tipo === 'hoy') return `Vence hoy${f}`;
  if (tipo === 'manana') return `Vence mañana${f}`;
  if (tipo === 'dias_antes') return `Vence pronto${f}`;
  return fecha ? `Pendiente${f}` : 'Pendiente · sin fecha';
}

/** Qué aviso le corresponde hoy a una tarea según las preferencias de la persona (o null). */
export function tipoDiario(fecha: string | null, p: PerfilAvisos, hoy: string): TipoDiario | null {
  if (!fecha) return null;
  if (fecha < hoy) return p.avisar_vencida ? 'vencida' : null;
  if (fecha === hoy) return p.avisar_hoy ? 'hoy' : null;
  if (p.dias_antes > 0 && fecha <= hoyBogota(p.dias_antes)) return fecha === hoyBogota(1) ? 'manana' : 'dias_antes';
  return null;
}

/** Arma el mensaje diario de una persona. */
export function armarAvisoDiario(p: PerfilAvisos, alertas: { tarea: TareaAviso; tipo: TipoDiario }[], otras: TareaAviso[]): Aviso {
  const orden: TipoDiario[] = ['vencida', 'hoy', 'manana', 'dias_antes'];
  alertas.sort((a, b) => orden.indexOf(a.tipo) - orden.indexOf(b.tipo));
  const lineas: LineaAviso[] = alertas.map(({ tarea, tipo }) => ({
    etiqueta: etiqueta(tipo, tarea.fecha_limite),
    color: COLOR[tipo],
    titulo: tarea.titulo,
    detalle: tarea.proyectos?.nombre,
    enlace: enlaceTarea(tarea)
  }));
  for (const t of otras.slice(0, 15)) {
    lineas.push({ etiqueta: etiqueta('resumen', t.fecha_limite), color: COLOR.resumen, titulo: t.titulo, detalle: t.proyectos?.nombre, enlace: enlaceTarea(t) });
  }

  const vencidas = alertas.filter((a) => a.tipo === 'vencida').length;
  const hoyN = alertas.filter((a) => a.tipo === 'hoy').length;
  const pronto = alertas.length - vencidas - hoyN;
  const pl = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  const partes = [
    vencidas && pl(vencidas, 'tarea vencida', 'tareas vencidas'),
    hoyN && `${hoyN} para hoy`,
    pronto && `${pronto} por vencer`,
    otras.length && pl(otras.length, 'pendiente', 'pendientes')
  ].filter(Boolean) as string[];
  const enLista = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs[0] || '');

  const chips = [
    vencidas && { texto: pl(vencidas, 'vencida', 'vencidas'), color: '#B42318', fondo: '#FEF3F2' },
    hoyN && { texto: `${hoyN} para hoy`, color: '#92400E', fondo: '#FFFBEB' },
    pronto && { texto: `${pronto} por vencer`, color: '#1B389E', fondo: '#EFF4FF' },
    otras.length && { texto: pl(otras.length, 'pendiente', 'pendientes'), color: '#475467', fondo: '#F2F4F7' }
  ].filter(Boolean) as NonNullable<Aviso['chips']>;

  if (alertas.length && otras.length) {
    lineas.forEach((l, i) => (l.grupo = i < alertas.length ? 'Necesitan atención' : 'Otras pendientes'));
  }

  const titulos = alertas.map((a) => `«${a.tarea.titulo}»`).slice(0, 4).join(', ');
  return {
    asunto: `${primerNombre(p)}, tienes ${enLista(partes) || 'tareas pendientes'}`,
    intro: alertas.length ? 'Estas son tus tareas que necesitan atención:' : 'Este es tu resumen de tareas pendientes:',
    chips,
    lineas,
    enlace: SITIO() || undefined,
    resumenWhatsApp: `${enLista(partes)}${titulos ? ` (${titulos}${alertas.length > 4 ? '…' : ''})` : ''}`
  };
}

/** Recordatorio de una sola tarea con mensaje personalizado (puntual o "Recordar ahora"). */
export function armarAvisoTarea(t: { id: string; proyecto_id: string; titulo: string; fecha_limite: string | null; proyecto?: string | null }, mensaje: string | null, deParte?: string | null): Aviso {
  const texto = (mensaje || '').trim() || 'Te recordamos esta tarea.';
  const de = deParte ? `${deParte} te recuerda: ` : '';
  return {
    asunto: `Recordatorio: ${t.titulo}`,
    intro: deParte ? `${deParte} te envió un recordatorio:` : 'Tienes un recordatorio programado:',
    mensaje: texto,
    lineas: [{ etiqueta: t.fecha_limite ? etiqueta(t.fecha_limite < hoyBogota() ? 'vencida' : t.fecha_limite === hoyBogota() ? 'hoy' : 'dias_antes', t.fecha_limite) : 'Tarea', titulo: t.titulo, detalle: t.proyecto || undefined, enlace: enlaceTarea(t) }],
    enlace: enlaceTarea(t),
    resumenWhatsApp: `${de}«${t.titulo}» — ${texto}`
  };
}

/** Aviso inmediato cuando a alguien le asignan una tarea. */
export function armarAvisoAsignada(
  t: { id: string; proyecto_id: string; titulo: string; fecha_inicio?: string | null; fecha_limite: string | null; descripcion?: string | null; proyecto?: string | null },
  deParte: string
): Aviso {
  const fechas = [t.fecha_inicio && `inicia ${formatoCorto(t.fecha_inicio)}`, t.fecha_limite && `vence ${formatoCorto(t.fecha_limite)}`].filter(Boolean).join(', ');
  const desc = textoPlano(t.descripcion);
  return {
    asunto: `${deParte} te asignó: ${t.titulo}`,
    intro: `${deParte} te asignó una tarea${t.proyecto ? ` en ${t.proyecto}` : ''}:`,
    mensaje: desc ? (desc.length > 280 ? desc.slice(0, 279) + '…' : desc) : null,
    lineas: [{ etiqueta: fechas ? fechas.charAt(0).toUpperCase() + fechas.slice(1) : 'Nueva tarea', color: '#2246C4', titulo: t.titulo, detalle: t.proyecto || undefined, enlace: enlaceTarea(t) }],
    enlace: enlaceTarea(t),
    resumenWhatsApp: `${deParte} te asignó la tarea «${t.titulo}»${fechas ? ` (${fechas})` : ''}`
  };
}

export interface ResumenEjecucion {
  fecha: string;
  hora: number;
  diarios: { persona: string; resultados: Resultado[] }[];
  puntuales: { tarea: string; resultados: Resultado[] }[];
}

export async function procesarRecordatorios(opciones: { soloUsuario?: string } = {}): Promise<ResumenEjecucion> {
  const admin = createAdminClient();
  const hoy = hoyBogota();
  const hora = horaBogota();
  const resumen: ResumenEjecucion = { fecha: hoy, hora, diarios: [], puntuales: [] };

  let qPerfiles = admin.from('perfiles').select(CAMPOS_PERFIL);
  if (opciones.soloUsuario) qPerfiles = qPerfiles.eq('id', opciones.soloUsuario);
  let qTareas = admin
    .from('tareas')
    .select('id, titulo, fecha_limite, proyecto_id, responsables, estado, recordar_en, recordatorio_enviado_en, mensaje_recordatorio, proyectos(nombre, archivado)')
    .neq('estado', 'hecho')
    .neq('responsables', '{}');
  if (opciones.soloUsuario) qTareas = qTareas.contains('responsables', [opciones.soloUsuario]);

  const desde = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const [{ data: perfiles, error: e1 }, { data: tareasRaw, error: e2 }, { data: enviados, error: e3 }] = await Promise.all([
    qPerfiles,
    qTareas,
    admin.from('recordatorios_enviados').select('tarea_id, user_id, tipo, canal, enviado_el').eq('ok', true).gte('enviado_el', desde).in('tipo', ['dias_antes', 'manana', 'hoy', 'vencida', 'resumen'])
  ]);
  if (e1 || e2 || e3) throw new Error((e1 || e2 || e3)!.message);

  const tareas = ((tareasRaw || []) as unknown as (TareaAviso & { proyectos: { nombre: string; archivado: boolean } | null })[]).filter((t) => !t.proyectos?.archivado);
  const hoyEnviado = new Set<string>();
  const algunaVez = new Set<string>();
  for (const e of enviados || []) {
    algunaVez.add(`${e.tarea_id}|${e.user_id}|${e.tipo}|${e.canal}`);
    if (e.enviado_el === hoy) hoyEnviado.add(`${e.tarea_id}|${e.user_id}|${e.tipo}|${e.canal}`);
  }

  // ---------- 1. Aviso diario ----------
  for (const p of (perfiles || []) as PerfilAvisos[]) {
    if (hora < p.hora_aviso) continue;
    const mias = tareas.filter((t) => (t.responsables || []).includes(p.id));
    if (!mias.length) continue;

    for (const canal of canalesActivos(p)) {
      const alertas: { tarea: TareaAviso; tipo: TipoDiario }[] = [];
      for (const t of mias) {
        const tipo = tipoDiario(t.fecha_limite, p, hoy);
        if (!tipo) continue;
        const clave = `${t.id}|${p.id}|${tipo}|${canal}`;
        // Vencidas: todos los días solo si la persona lo pidió. Avisos previos: una sola vez.
        const repetible = tipo === 'hoy' || (tipo === 'vencida' && p.repetir_vencida);
        if (repetible ? hoyEnviado.has(clave) : algunaVez.has(clave)) continue;
        alertas.push({ tarea: t, tipo });
      }
      const quiereResumen = p.resumen_diario && !hoyEnviado.has(`null|${p.id}|resumen|${canal}`);
      const conAlerta = new Set(alertas.map((a) => a.tarea.id));
      const otras = quiereResumen ? mias.filter((t) => !conAlerta.has(t.id)).sort((a, b) => (a.fecha_limite || '9999').localeCompare(b.fecha_limite || '9999')) : [];
      if (!alertas.length && !(quiereResumen && otras.length)) continue;

      const aviso = armarAvisoDiario(p, alertas, otras);
      const resultados: Resultado[] = [];
      // Una fila de historial por tarea y tipo; el resumen se guarda aparte.
      const porTipo = new Map<TipoAviso, string[]>();
      alertas.forEach((a) => porTipo.set(a.tipo, [...(porTipo.get(a.tipo) || []), a.tarea.id]));
      const [primero, ...resto] = [...porTipo.entries()];
      if (primero) {
        resultados.push(...(await notificar(p, aviso, [canal], { tipo: primero[0], tareas: primero[1], enviado_el: hoy })));
        const ok = resultados[0].ok;
        for (const [tipo, ids] of resto) await registrar(ids.map((tarea_id) => ({ tarea_id, user_id: p.id, tipo, canal, ok, detalle: resultados[0].detalle, enviado_el: hoy })));
        if (quiereResumen) await registrar([{ user_id: p.id, tipo: 'resumen', canal, ok, detalle: resultados[0].detalle, enviado_el: hoy }]);
      } else {
        resultados.push(...(await notificar(p, aviso, [canal], { tipo: 'resumen', tareas: [], enviado_el: hoy })));
      }
      resumen.diarios.push({ persona: primerNombre(p), resultados });
    }
  }

  // ---------- 2. Recordatorios puntuales ("Recordar el") ----------
  const ahora = Date.now();
  const vencidos = tareas.filter((t) => t.recordar_en && new Date(t.recordar_en).getTime() <= ahora && (!t.recordatorio_enviado_en || new Date(t.recordatorio_enviado_en) < new Date(t.recordar_en)));
  for (const t of vencidos) {
    const personas = ((perfiles || []) as PerfilAvisos[]).filter((x) => (t.responsables || []).includes(x.id));
    if (!personas.length) continue;
    // Se marca primero para que dos ejecuciones simultáneas no lo envíen dos veces.
    let marcar = admin.from('tareas').update({ recordatorio_enviado_en: new Date().toISOString() }).eq('id', t.id).eq('recordar_en', t.recordar_en!);
    marcar = t.recordatorio_enviado_en ? marcar.eq('recordatorio_enviado_en', t.recordatorio_enviado_en) : marcar.is('recordatorio_enviado_en', null);
    const { data: marcada } = await marcar.select('id');
    if (!marcada?.length) continue;
    const aviso = armarAvisoTarea({ ...t, proyecto: t.proyectos?.nombre }, t.mensaje_recordatorio);
    const resultados: Resultado[] = [];
    for (const p of personas) {
      const canales = canalesActivos(p);
      if (canales.length) resultados.push(...(await notificar(p, aviso, canales, { tipo: 'personal', tareas: [t.id] })));
    }
    resumen.puntuales.push({ tarea: t.titulo, resultados });
  }

  return resumen;
}

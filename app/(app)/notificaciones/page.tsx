import { getContexto } from '@/lib/datos';
import { createAdminClient } from '@/lib/supabase/admin';
import { CAMPOS_PERFIL, type PerfilAvisos } from '@/lib/recordatorios';
import FormAvisos from './FormAvisos';

export const dynamic = 'force-dynamic';

const TIPOS: Record<string, string> = {
  manana: 'Vence mañana',
  dias_antes: 'Vence pronto',
  hoy: 'Vence hoy',
  vencida: 'Vencida',
  resumen: 'Resumen diario',
  personal: 'Recordatorio programado',
  manual: 'Recordar ahora',
  prueba: 'Prueba'
};

export default async function Notificaciones() {
  const { supabase, user } = await getContexto();
  const { data: perfil } = await supabase.from('perfiles').select(CAMPOS_PERFIL).eq('id', user.id).single();
  // El historial solo lo lee el servidor; se filtra a los envíos de esta persona.
  const { data: historial } = await createAdminClient()
    .from('recordatorios_enviados')
    .select('id, tipo, canal, ok, detalle, creado_en, tareas(titulo)')
    .eq('user_id', user.id)
    .order('creado_en', { ascending: false })
    .limit(15);

  const whatsappListo = Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  const correoListo = Boolean(process.env.RESEND_API_KEY);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-5 sm:p-8">
      <header className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-azul text-white shadow-[0_8px_20px_-10px_rgba(34,70,196,.6)]" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Mis notificaciones</h1>
          <p className="mt-0.5 text-slate-600">Elige por dónde y cuándo quieres que te recordemos tus tareas.</p>
        </div>
      </header>

      {perfil && <FormAvisos perfil={perfil as PerfilAvisos} correoListo={correoListo} whatsappListo={whatsappListo} />}

      <section aria-labelledby="t-hist">
        <h2 id="t-hist" className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Últimos envíos</h2>
        <div className="tarjeta overflow-hidden">
          {!historial?.length && <p className="p-6 text-sm text-slate-500">Todavía no te hemos enviado nada.</p>}
          <ul className="divide-y divide-nube">
            {(historial || []).map((h) => {
              const titulo = (h.tareas as unknown as { titulo: string } | null)?.titulo;
              return (
                <li key={h.id} className="flex items-start gap-3 px-5 py-3.5 sm:px-6">
                  <span className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${h.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`} aria-label={h.ok ? 'Enviado' : 'Falló'}>
                    {h.ok ? '✓' : '!'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-semibold">{h.canal === 'correo' ? 'Correo' : 'WhatsApp'}</span>
                      <span className="text-slate-500"> · {TIPOS[h.tipo] || h.tipo}</span>
                      {titulo && <span className="text-slate-500"> · {titulo}</span>}
                    </p>
                    {!h.ok && h.detalle && (
                      <details className="mt-1 text-xs text-red-700">
                        <summary className="cursor-pointer font-medium">No se pudo enviar · ver motivo</summary>
                        <p className="mt-1 break-words rounded-lg bg-red-50 p-2">{h.detalle}</p>
                      </details>
                    )}
                  </div>
                  <time className="shrink-0 pt-0.5 text-xs text-slate-500" dateTime={h.creado_en}>
                    {new Date(h.creado_en).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  </time>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}

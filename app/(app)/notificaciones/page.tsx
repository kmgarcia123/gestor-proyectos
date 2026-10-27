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
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-5 sm:p-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Mis notificaciones</h1>
        <p className="mt-1 text-slate-600">Elige por dónde y cuándo quieres que te recordemos tus tareas.</p>
      </header>

      {perfil && <FormAvisos perfil={perfil as PerfilAvisos} correoListo={correoListo} whatsappListo={whatsappListo} />}

      <section className="tarjeta">
        <h2 className="text-lg font-bold">Últimos envíos</h2>
        {!historial?.length && <p className="mt-2 text-sm text-slate-500">Todavía no te hemos enviado nada.</p>}
        <ul className="mt-3 divide-y divide-nube">
          {(historial || []).map((h) => (
            <li key={h.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm">
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${h.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{h.ok ? 'Enviado' : 'Falló'}</span>
              <span className="font-semibold">{h.canal === 'correo' ? 'Correo' : 'WhatsApp'}</span>
              <span>{TIPOS[h.tipo] || h.tipo}</span>
              {(h.tareas as unknown as { titulo: string } | null)?.titulo && <span className="text-slate-600">· {(h.tareas as unknown as { titulo: string }).titulo}</span>}
              <span className="ml-auto text-xs text-slate-500">
                {new Date(h.creado_en).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
              </span>
              {!h.ok && h.detalle && <span className="w-full text-xs text-red-700">{h.detalle}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

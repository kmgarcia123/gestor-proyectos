'use client';

import { useActionState, useState, useTransition } from 'react';
import type { PerfilAvisos } from '@/lib/recordatorios';
import { guardarAvisos, probarCanal, type Estado } from './actions';

const HORAS = Array.from({ length: 18 }, (_, i) => i + 5); // 5 a. m. a 10 p. m.

function hora12(h: number) {
  const s = h < 12 ? 'a. m.' : 'p. m.';
  return `${h % 12 === 0 ? 12 : h % 12}:00 ${s}`;
}

function Mensaje({ estado }: { estado: Estado }) {
  if (!estado) return null;
  return (
    <p role="status" className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm font-medium ${estado.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
      <span aria-hidden="true">{estado.ok ? '✓' : '!'}</span>
      <span className="min-w-0 break-words">{estado.texto}</span>
    </p>
  );
}

/** Interruptor tipo iOS sobre un checkbox real (funciona con el formulario y el teclado). */
function Switch({ name, checked, onChange, label }: { name: string; checked?: boolean; onChange?: (v: boolean) => void; label: string; defaultChecked?: boolean }) {
  return (
    <span className="relative inline-flex shrink-0">
      <input type="checkbox" name={name} checked={checked} onChange={(e) => onChange?.(e.target.checked)} aria-label={label} className="peer sr-only" />
      <span aria-hidden="true" className="h-7 w-12 rounded-full bg-slate-300 transition peer-checked:bg-azul peer-focus-visible:ring-2 peer-focus-visible:ring-azul peer-focus-visible:ring-offset-2" />
      <span aria-hidden="true" className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
    </span>
  );
}

function FilaOpcion({ name, titulo, ayuda, defecto, deshabilitado }: { name: string; titulo: string; ayuda?: string; defecto: boolean; deshabilitado?: boolean }) {
  const [on, setOn] = useState(defecto);
  return (
    <label className={`flex cursor-pointer items-center justify-between gap-4 px-5 py-4 transition hover:bg-fondo sm:px-6 ${deshabilitado ? 'opacity-50' : ''}`}>
      <span className="min-w-0">
        <span className="block font-semibold">{titulo}</span>
        {ayuda && <span className="mt-0.5 block text-sm text-slate-500">{ayuda}</span>}
      </span>
      <Switch name={name} checked={on} onChange={setOn} label={titulo} />
    </label>
  );
}

function Icono({ tipo }: { tipo: 'correo' | 'whatsapp' }) {
  return tipo === 'correo' ? (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
  ) : (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.4-.2Z" /></svg>
  );
}

function TarjetaCanal({ tipo, titulo, detalle, activo, onCambio, listo, children }: { tipo: 'correo' | 'whatsapp'; titulo: string; detalle: string; activo: boolean; onCambio: (v: boolean) => void; listo: boolean; children?: React.ReactNode }) {
  const colores = tipo === 'correo' ? 'bg-azul-suave text-azul' : 'bg-emerald-50 text-emerald-600';
  return (
    <div className={`flex flex-col gap-4 rounded-2xl border-2 p-5 transition ${activo ? 'border-azul bg-white' : 'border-slate-200 bg-white/60'}`}>
      <label className="flex cursor-pointer items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colores}`}><Icono tipo={tipo} /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{titulo}</span>
          <span className="block truncate text-sm text-slate-500" title={detalle}>{detalle}</span>
        </span>
        <Switch name={tipo === 'correo' ? 'avisar_correo' : 'avisar_whatsapp'} checked={activo} onChange={onCambio} label={`Avisarme por ${titulo}`} />
      </label>
      {children}
      {!listo && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">Aún no está configurado en el servidor.</p>}
    </div>
  );
}

export default function FormAvisos({ perfil, correoListo, whatsappListo }: { perfil: PerfilAvisos; correoListo: boolean; whatsappListo: boolean }) {
  const [estado, accion, guardando] = useActionState(guardarAvisos, null);
  const [prueba, setPrueba] = useState<Estado>(null);
  const [probando, start] = useTransition();
  const [correo, setCorreo] = useState(perfil.avisar_correo);
  const [whatsapp, setWhatsapp] = useState(perfil.avisar_whatsapp);
  const [vencida, setVencida] = useState(perfil.avisar_vencida);

  const probar = (canal: 'correo' | 'whatsapp') => {
    setPrueba(null);
    start(async () => setPrueba(await probarCanal(canal)));
  };

  return (
    <form action={accion} className="flex flex-col gap-6">
      <section aria-labelledby="t-canales">
        <h2 id="t-canales" className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Por dónde</h2>
        <div className="grid items-start gap-4 md:grid-cols-2">
          <TarjetaCanal tipo="correo" titulo="Correo" detalle={perfil.email} activo={correo} onCambio={setCorreo} listo={correoListo} />
          <TarjetaCanal tipo="whatsapp" titulo="WhatsApp" detalle="Desde el número oficial de la empresa" activo={whatsapp} onCambio={setWhatsapp} listo={whatsappListo}>
            <div>
              <label className="etiqueta" htmlFor="telefono">Tu celular</label>
              <input id="telefono" name="telefono" inputMode="tel" defaultValue={perfil.telefono || ''} placeholder="300 123 4567" className="campo" autoComplete="tel" />
              <p className="mt-1.5 text-xs text-slate-500">Si es de Colombia bastan los 10 dígitos.</p>
            </div>
          </TarjetaCanal>
        </div>
      </section>

      <section aria-labelledby="t-cuando">
        <h2 id="t-cuando" className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Cuándo</h2>
        <div className="tarjeta overflow-hidden">
          <div className="grid gap-4 border-b border-nube p-5 sm:grid-cols-2 sm:p-6">
            <div>
              <label className="etiqueta" htmlFor="hora_aviso">Hora del aviso diario</label>
              <select id="hora_aviso" name="hora_aviso" defaultValue={perfil.hora_aviso} className="campo">
                {HORAS.map((h) => <option key={h} value={h}>{hora12(h)}</option>)}
              </select>
            </div>
            <div>
              <label className="etiqueta" htmlFor="dias_antes">Avisar antes del vencimiento</label>
              <select id="dias_antes" name="dias_antes" defaultValue={perfil.dias_antes} className="campo">
                <option value={0}>No avisar antes</option>
                <option value={1}>1 día antes</option>
                <option value={2}>2 días antes</option>
                <option value={3}>3 días antes</option>
                <option value={7}>1 semana antes</option>
              </select>
            </div>
          </div>
          <div className="divide-y divide-nube">
            <FilaOpcion name="avisar_hoy" titulo="El día que vence" defecto={perfil.avisar_hoy} />
            <label className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 transition hover:bg-fondo sm:px-6">
              <span className="font-semibold">Cuando ya está vencida</span>
              <Switch name="avisar_vencida" checked={vencida} onChange={setVencida} label="Cuando ya está vencida" />
            </label>
            <FilaOpcion name="repetir_vencida" titulo="Repetir cada día mientras siga vencida" ayuda="Si lo apagas, te avisamos una sola vez." defecto={perfil.repetir_vencida} deshabilitado={!vencida} />
            <FilaOpcion name="resumen_diario" titulo="Resumen diario de todo lo pendiente" ayuda="Suma las tareas sin fecha o que vencen más adelante." defecto={perfil.resumen_diario} />
          </div>
          <p className="bg-fondo px-5 py-3 text-xs text-slate-500 sm:px-6">Todo llega en un solo mensaje al día por canal. Los recordatorios con mensaje personal se programan dentro de cada tarea («Recordar el»).</p>
        </div>
      </section>

      <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl bg-carbon p-2.5 pl-4 text-white shadow-lg sm:p-3 sm:pl-5">
        <p className={`min-w-0 text-sm ${estado ? (estado.ok ? 'text-emerald-300' : 'text-red-300') : 'hidden text-slate-300 sm:block'}`}>{estado ? (estado.ok ? '✓ ' : '! ') + estado.texto : 'Los cambios se aplican desde el próximo aviso.'}</p>
        <button type="submit" disabled={guardando} className="btn-primario shrink-0">{guardando ? 'Guardando…' : 'Guardar preferencias'}</button>
      </div>

      <section aria-labelledby="t-probar" className="tarjeta p-5 sm:p-6">
        <h2 id="t-probar" className="text-lg font-bold">Probar ahora</h2>
        <p className="mt-1 text-sm text-slate-500">Te enviamos cómo se vería tu aviso, con tus tareas reales. Guarda primero si cambiaste el número.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => probar('correo')} disabled={probando} className="btn-suave min-h-[44px]"><Icono tipo="correo" />Probar correo</button>
          <button type="button" onClick={() => probar('whatsapp')} disabled={probando} className="btn-suave min-h-[44px]"><Icono tipo="whatsapp" />Probar WhatsApp</button>
        </div>
        <div className="mt-3"><Mensaje estado={probando ? { ok: true, texto: 'Enviando…' } : prueba} /></div>
      </section>
    </form>
  );
}

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
  return <p role="status" className={`rounded-xl px-3 py-2 text-sm font-medium ${estado.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{estado.texto}</p>;
}

function Interruptor({ name, label, ayuda, defecto }: { name: string; label: string; ayuda?: string; defecto: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-2">
      <input type="checkbox" name={name} defaultChecked={defecto} className="mt-1 h-5 w-5 rounded border-slate-300 text-azul focus:ring-azul" />
      <span>
        <span className="block font-semibold">{label}</span>
        {ayuda && <span className="block text-sm text-slate-500">{ayuda}</span>}
      </span>
    </label>
  );
}

export default function FormAvisos({ perfil, correoListo, whatsappListo }: { perfil: PerfilAvisos; correoListo: boolean; whatsappListo: boolean }) {
  const [estado, accion, guardando] = useActionState(guardarAvisos, null);
  const [prueba, setPrueba] = useState<Estado>(null);
  const [probando, start] = useTransition();

  const probar = (canal: 'correo' | 'whatsapp') => {
    setPrueba(null);
    start(async () => setPrueba(await probarCanal(canal)));
  };

  return (
    <form action={accion} className="flex flex-col gap-6">
      <section className="tarjeta">
        <h2 className="text-lg font-bold">Canales</h2>
        <Interruptor name="avisar_correo" label={`Correo · ${perfil.email}`} defecto={perfil.avisar_correo} />
        <Interruptor name="avisar_whatsapp" label="WhatsApp" ayuda="Mensajes desde el número oficial de la empresa." defecto={perfil.avisar_whatsapp} />
        <div className="mt-2 max-w-xs">
          <label className="etiqueta" htmlFor="telefono">Celular para WhatsApp</label>
          <input id="telefono" name="telefono" inputMode="tel" defaultValue={perfil.telefono || ''} placeholder="57 300 123 4567" className="campo" autoComplete="tel" />
          <p className="mt-1 text-xs text-slate-500">Con indicativo del país. Si es de Colombia puedes escribir solo los 10 dígitos.</p>
        </div>
      </section>

      <section className="tarjeta">
        <h2 className="text-lg font-bold">Cuándo avisarme</h2>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
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
        <div className="mt-3">
          <Interruptor name="avisar_hoy" label="El día que vence" defecto={perfil.avisar_hoy} />
          <Interruptor name="avisar_vencida" label="Cuando ya está vencida" defecto={perfil.avisar_vencida} />
          <Interruptor name="repetir_vencida" label="Repetir cada día mientras siga vencida" ayuda="Si lo apagas, te avisamos una sola vez." defecto={perfil.repetir_vencida} />
          <Interruptor name="resumen_diario" label="Resumen diario de todo lo pendiente" ayuda="Incluye también las tareas sin fecha o que vencen más adelante." defecto={perfil.resumen_diario} />
        </div>
        <p className="mt-2 text-sm text-slate-500">Todo llega en un solo mensaje al día por canal. Los recordatorios con mensaje personal se programan dentro de cada tarea («Recordar el»).</p>
      </section>

      <div className="flex flex-col gap-3">
        <Mensaje estado={estado} />
        <div>
          <button type="submit" disabled={guardando} className="btn-primario">{guardando ? 'Guardando…' : 'Guardar preferencias'}</button>
        </div>
      </div>

      <section className="tarjeta">
        <h2 className="text-lg font-bold">Probar</h2>
        <p className="mt-1 text-sm text-slate-500">Te enviamos ahora mismo cómo se vería tu aviso, con tus tareas reales. Guarda primero si cambiaste el número.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => probar('correo')} disabled={probando} className="btn-suave">Probar correo</button>
          <button type="button" onClick={() => probar('whatsapp')} disabled={probando} className="btn-suave">Probar WhatsApp</button>
        </div>
        {(!correoListo || !whatsappListo) && (
          <p className="mt-3 text-xs text-amber-800">
            {!correoListo && 'El correo aún no está configurado en el servidor. '}
            {!whatsappListo && 'WhatsApp aún no está configurado en el servidor (faltan las claves de Meta).'}
          </p>
        )}
        <div className="mt-3"><Mensaje estado={probando ? { ok: true, texto: 'Enviando…' } : prueba} /></div>
      </section>
    </form>
  );
}

'use client';

import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { crearProyecto } from '@/app/(app)/actions';
import { COLORES_PROYECTO } from '@/lib/types';

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primario" disabled={pending}>
      {pending ? 'Creando…' : 'Crear proyecto'}
    </button>
  );
}

export default function NuevoProyecto({ compacto = false }: { compacto?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [color, setColor] = useState(COLORES_PROYECTO[0]);
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className={compacto ? 'btn-suave w-full justify-start bg-white/5 text-slate-200 hover:bg-white/10' : 'btn-primario'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        Nuevo proyecto
      </button>
      <dialog ref={ref} className="w-[min(520px,92vw)] rounded-3xl p-0 backdrop:bg-carbon/60 backdrop:backdrop-blur-sm">
        <form action={crearProyecto} className="flex flex-col gap-4 p-6">
          <div className="flex items-start justify-between">
            <h2 className="text-xl font-extrabold tracking-tight">Nuevo proyecto</h2>
            <button type="button" onClick={() => ref.current?.close()} className="btn-suave h-9 min-h-0 w-9 px-0" aria-label="Cerrar">✕</button>
          </div>
          <div>
            <label className="etiqueta" htmlFor="np-nombre">Nombre</label>
            <input id="np-nombre" name="nombre" required maxLength={120} className="campo" placeholder="Ej. Página web de la empresa" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="np-desc">Descripción (opcional)</label>
            <textarea id="np-desc" name="descripcion" rows={2} className="campo" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="np-fases">Fases (separadas por coma)</label>
            <input id="np-fases" name="fases" className="campo" defaultValue="Diagnóstico, Diseño, Desarrollo, Pruebas, Entrega" />
            <p className="mt-1 text-xs text-slate-500">Las fases alimentan el mapa de avance del proyecto.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="etiqueta" htmlFor="np-fin">Fecha objetivo</label>
              <input id="np-fin" name="fecha_fin" type="date" className="campo" />
            </div>
            <fieldset>
              <legend className="etiqueta">Color</legend>
              <input type="hidden" name="color" value={color} />
              <div className="flex flex-wrap gap-2">
                {COLORES_PROYECTO.map((c) => (
                  <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Color ${c}`} aria-pressed={color === c} className="h-8 w-8 rounded-full ring-offset-2 transition aria-pressed:ring-2 aria-pressed:ring-carbon" style={{ background: c }} />
                ))}
              </div>
            </fieldset>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => ref.current?.close()} className="btn-suave">Cancelar</button>
            <Enviar />
          </div>
        </form>
      </dialog>
    </>
  );
}

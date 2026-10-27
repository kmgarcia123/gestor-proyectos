'use client';

import { useState, useTransition } from 'react';
import { crearFase } from '@/app/(app)/actions';
import type { Fase, Tarea } from '@/lib/types';

/** Vista previa del "mapa del proyecto": cada fase muestra su avance. */
export default function FasesBarra({ proyectoId, fases, tareas }: { proyectoId: string; fases: Fase[]; tareas: Tarea[] }) {
  const [nueva, setNueva] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [pending, start] = useTransition();

  const datos = fases.map((f) => {
    const ts = tareas.filter((t) => t.fase_id === f.id);
    const hechas = ts.filter((t) => t.estado === 'hecho').length;
    const enCurso = ts.some((t) => t.estado === 'en_curso' || t.estado === 'revision');
    const pct = ts.length ? Math.round((hechas / ts.length) * 100) : 0;
    const estado = ts.length && hechas === ts.length ? 'hecho' : enCurso || hechas > 0 ? 'curso' : 'pendiente';
    return { f, total: ts.length, pct, estado };
  });

  const ESTILO: Record<string, string> = {
    hecho: 'border-turquesa bg-turquesa-suave text-turquesa-oscuro',
    curso: 'border-azul bg-azul-suave text-azul-oscuro',
    pendiente: 'border-slate-200 bg-white text-slate-600'
  };

  return (
    <div className="mt-5">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Fases del proyecto</p>
      <ol className="flex items-stretch gap-2 overflow-x-auto pb-1">
        {datos.map(({ f, total, pct, estado }, i) => (
          <li key={f.id} className="flex items-center gap-2">
            <div className={`min-w-[140px] rounded-xl border-2 px-3 py-2 ${ESTILO[estado]}`}>
              <p className="text-xs font-semibold opacity-70">Fase {i + 1}</p>
              <p className="truncate text-sm font-bold">{f.nombre}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/70">
                  <div className="h-full rounded-full bg-current" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] font-semibold">{total ? `${pct}%` : '—'}</span>
              </div>
            </div>
            {i < datos.length - 1 && <span className="text-slate-300" aria-hidden="true">→</span>}
          </li>
        ))}
        <li className="flex items-center">
          {abierto ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  await crearFase(proyectoId, nueva);
                  setNueva('');
                  setAbierto(false);
                });
              }}
              className="flex items-center gap-2"
            >
              <label className="sr-only" htmlFor="nueva-fase">Nombre de la fase</label>
              <input id="nueva-fase" autoFocus value={nueva} onChange={(e) => setNueva(e.target.value)} className="campo w-40 py-2" placeholder="Nueva fase" />
              <button type="submit" disabled={pending} className="btn-primario">Agregar</button>
            </form>
          ) : (
            <button type="button" onClick={() => setAbierto(true)} className="btn-suave whitespace-nowrap">+ Fase</button>
          )}
        </li>
      </ol>
    </div>
  );
}

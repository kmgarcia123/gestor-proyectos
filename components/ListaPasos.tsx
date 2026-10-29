'use client';

import { useRef, useState } from 'react';
import type { Paso } from '@/lib/types';

/**
 * Lista de mini pasos dentro de una tarea. Cada cambio se guarda al instante (no hace falta "Guardar").
 * Si la tarea no tiene pasos, solo se muestra un botón para crear la lista.
 */
export default function ListaPasos({ pasos, onCambio }: { pasos: Paso[]; onCambio: (pasos: Paso[]) => void }) {
  const [abierta, setAbierta] = useState(pasos.length > 0);
  const [nuevo, setNuevo] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const hechos = pasos.filter((p) => p.hecho).length;
  const pct = pasos.length ? Math.round((hechos / pasos.length) * 100) : 0;

  function agregar() {
    const texto = nuevo.trim();
    if (!texto) return;
    onCambio([...pasos, { id: crypto.randomUUID(), texto: texto.slice(0, 200), hecho: false }]);
    setNuevo('');
    input.current?.focus();
  }

  if (!abierta) {
    return (
      <button
        type="button"
        onClick={() => {
          setAbierta(true);
          setTimeout(() => input.current?.focus(), 0);
        }}
        className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-azul hover:text-azul"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m8 12 3 3 5-6" /></svg>
        Agregar lista de pasos
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="mb-3 flex items-center gap-3">
        <p className="text-sm font-bold">Lista de pasos</p>
        {pasos.length > 0 && (
          <>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-nube" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de los pasos">
              <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-turquesa' : 'bg-azul'}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-bold text-slate-500">{hechos}/{pasos.length}</span>
          </>
        )}
      </div>

      <ul className="flex flex-col gap-1">
        {pasos.map((p) => (
          <li key={p.id} className="group flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-fondo">
            <input
              type="checkbox"
              checked={p.hecho}
              onChange={() => onCambio(pasos.map((x) => (x.id === p.id ? { ...x, hecho: !x.hecho } : x)))}
              className="h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 text-turquesa focus:ring-turquesa"
              aria-label={`Marcar «${p.texto}» como ${p.hecho ? 'pendiente' : 'hecho'}`}
            />
            {editando === p.id ? (
              <input
                autoFocus
                defaultValue={p.texto}
                maxLength={200}
                onBlur={(e) => {
                  const t = e.target.value.trim();
                  setEditando(null);
                  if (t && t !== p.texto) onCambio(pasos.map((x) => (x.id === p.id ? { ...x, texto: t } : x)));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setEditando(null);
                  }
                }}
                className="campo flex-1 py-1"
              />
            ) : (
              <button type="button" onClick={() => setEditando(p.id)} className={`flex-1 text-left text-sm ${p.hecho ? 'text-slate-400 line-through' : ''}`} title="Clic para editar">
                {p.texto}
              </button>
            )}
            <button type="button" onClick={() => onCambio(pasos.filter((x) => x.id !== p.id))} className="rounded-md px-1.5 text-slate-400 opacity-60 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100" aria-label={`Quitar «${p.texto}»`}>
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex items-center gap-2">
        <span className="pl-1 text-lg font-bold leading-none text-azul" aria-hidden="true">+</span>
        <label htmlFor="nuevo-paso" className="sr-only">Nuevo paso</label>
        <input
          id="nuevo-paso"
          ref={input}
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              agregar();
            }
          }}
          maxLength={200}
          placeholder={pasos.length ? 'Agregar otro paso y Enter' : 'Escribe el primer paso y Enter'}
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm placeholder:text-slate-400 hover:bg-fondo focus:border-azul focus:bg-white focus:outline-none"
        />
        {nuevo.trim() && <button type="button" onClick={agregar} className="rounded-lg px-2.5 py-1 text-xs font-bold text-azul hover:bg-nube">Agregar paso</button>}
      </div>
      <p className="mt-2 text-xs text-slate-400">Se guarda solo al marcar, agregar o borrar.</p>
    </div>
  );
}

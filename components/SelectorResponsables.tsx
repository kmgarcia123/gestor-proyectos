'use client';

import Avatar from '@/components/Avatar';
import type { Perfil } from '@/lib/types';

/** Toca a cada persona para asignarla o quitarla. El primero marcado es el responsable principal. */
export default function SelectorResponsables({ equipo, valor, onCambio }: { equipo: Perfil[]; valor: string[]; onCambio: (ids: string[]) => void }) {
  const alternar = (id: string) => onCambio(valor.includes(id) ? valor.filter((x) => x !== id) : [...valor, id]);
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Responsables">
        {equipo.map((m) => {
          const activo = valor.includes(m.id);
          const nombre = (m.nombre || m.email).split(' ')[0];
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={activo}
              onClick={() => alternar(m.id)}
              className={`flex items-center gap-2 rounded-full border-2 py-1 pl-1 pr-3 text-sm font-semibold transition ${
                activo ? 'border-azul bg-azul-suave text-azul-oscuro' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              }`}
            >
              <span className="relative">
                <Avatar perfil={m} size={26} />
                {activo && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-azul text-[9px] text-white ring-2 ring-white" aria-hidden="true">✓</span>
                )}
              </span>
              {nombre}
            </button>
          );
        })}
        {equipo.length > 1 && (
          <button type="button" onClick={() => onCambio(valor.length === equipo.length ? [] : equipo.map((m) => m.id))} className="rounded-full px-3 py-1 text-xs font-semibold text-azul hover:bg-nube">
            {valor.length === equipo.length ? 'Quitar todos' : 'Todos'}
          </button>
        )}
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        {valor.length === 0 ? 'Sin asignar.' : valor.length === 1 ? '1 responsable.' : `${valor.length} responsables: a todos les llegan los avisos.`}
      </p>
    </div>
  );
}

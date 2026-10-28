'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import GrupoAvatares from '@/components/GrupoAvatares';
import { estadoFecha, formatoCorto, hoyBogota } from '@/lib/fechas';
import type { Fase, Perfil, Tarea } from '@/lib/types';

const PRIO: Record<string, { txt: string; cls: string } | undefined> = {
  alta: { txt: 'Alta', cls: 'bg-orange-50 text-orange-800' },
  urgente: { txt: 'Urgente', cls: 'bg-red-50 text-red-700' }
};
const FECHA: Record<string, string> = {
  vencida: 'bg-red-50 text-red-700',
  hoy: 'bg-amber-50 text-amber-800',
  manana: 'bg-azul-suave text-azul-oscuro',
  proxima: 'bg-slate-100 text-slate-600'
};

export function ContenidoTarjeta({ t, responsables, fase }: { t: Tarea; responsables: Perfil[]; fase?: Fase }) {
  const ef = estadoFecha(t.fecha_limite, t.estado === 'hecho');
  const iniciaLuego = t.fecha_inicio && t.fecha_inicio > hoyBogota() && t.estado !== 'hecho';
  return (
    <>
      {fase && <p className="mb-1 truncate text-[11px] font-semibold uppercase tracking-wide text-slate-400">{fase.nombre}</p>}
      <p className={`text-sm font-semibold leading-snug ${t.estado === 'hecho' ? 'text-slate-400 line-through' : ''}`}>{t.titulo}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {iniciaLuego && (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700" title="Fecha de inicio">
            ▶ Inicia {formatoCorto(t.fecha_inicio!)}
          </span>
        )}
        {PRIO[t.prioridad] && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIO[t.prioridad]!.cls}`}>{PRIO[t.prioridad]!.txt}</span>}
        {t.fecha_limite && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${t.estado === 'hecho' ? 'bg-turquesa-suave text-turquesa-oscuro' : FECHA[ef] || ''}`}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>
            {ef === 'vencida' ? 'Vencida · ' : ef === 'hoy' ? 'Hoy · ' : ''}
            {formatoCorto(t.fecha_limite)}
          </span>
        )}
        <span className="ml-auto">
          <GrupoAvatares personas={responsables} size={24} />
        </span>
      </div>
    </>
  );
}

export default function TarjetaTarea({ t, responsables, fase, onAbrir }: { t: Tarea; responsables: Perfil[]; fase?: Fase; onAbrir: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: t.id, data: { tipo: 'tarea', estado: t.estado } });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`list-none ${isDragging ? 'opacity-40' : ''}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={onAbrir}
        className="block w-full cursor-grab rounded-2xl border border-slate-200/70 bg-white p-3.5 text-left shadow-sm transition hover:border-azul/40 hover:shadow-md active:cursor-grabbing"
        aria-label={`Tarea: ${t.titulo}. Clic para abrir, arrastrar para mover.`}
      >
        <ContenidoTarjeta t={t} responsables={responsables} fase={fase} />
      </button>
    </li>
  );
}

'use client';

import { useState } from 'react';
import Tablero from '@/components/Tablero';
import MapaFases from '@/components/MapaFases';
import type { Fase, Perfil, Proyecto, Tarea } from '@/lib/types';

interface Props {
  proyecto: Proyecto;
  tareasIniciales: Tarea[];
  fases: Fase[];
  equipo: Perfil[];
  yoId: string;
  tareaAbiertaId?: string;
  vistaInicial?: 'tablero' | 'mapa';
}

/** Pestañas del proyecto: Tablero y Mapa de fases (comparten las mismas tareas). */
export default function ProyectoVista({ proyecto, tareasIniciales, fases, equipo, yoId, tareaAbiertaId, vistaInicial = 'tablero' }: Props) {
  const [vista, setVista] = useState<'tablero' | 'mapa'>(tareaAbiertaId ? 'tablero' : vistaInicial);
  const [tareas, setTareas] = useState<Tarea[]>(tareasIniciales);
  const [faseFiltro, setFaseFiltro] = useState('');

  const pestaña = (id: 'tablero' | 'mapa', texto: string, icono: React.ReactNode) => (
    <button
      type="button"
      role="tab"
      aria-selected={vista === id}
      onClick={() => setVista(id)}
      className={`flex items-center gap-2 border-b-2 px-1 pb-3 pt-1 text-sm font-bold transition ${vista === id ? 'border-azul text-carbon' : 'border-transparent text-slate-500 hover:text-carbon'}`}
    >
      {icono}
      {texto}
    </button>
  );

  return (
    <>
      <div role="tablist" aria-label="Vistas del proyecto" className="flex gap-6 border-b border-slate-200 bg-white px-4 sm:px-8">
        {pestaña('tablero', 'Tablero', <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="10" rx="1.5" /><rect x="17" y="4" width="4" height="13" rx="1.5" /></svg>)}
        {pestaña('mapa', `Mapa de fases${fases.length ? ` · ${fases.length}` : ''}`, <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="5" rx="1" /><rect x="2" y="17" width="6" height="5" rx="1" /><rect x="16" y="17" width="6" height="5" rx="1" /><path d="M12 7v5M5 17v-5h14v5" /></svg>)}
      </div>
      {vista === 'tablero' ? (
        <Tablero
          proyectoId={proyecto.id}
          tareas={tareas}
          setTareas={setTareas}
          equipo={equipo}
          fases={fases}
          faseFiltro={faseFiltro}
          setFaseFiltro={setFaseFiltro}
          tareaAbiertaId={tareaAbiertaId}
          yoId={yoId}
        />
      ) : (
        <MapaFases
          proyecto={proyecto}
          fases={fases}
          tareas={tareas}
          onVerTareas={(id) => {
            setFaseFiltro(id);
            setVista('tablero');
          }}
        />
      )}
    </>
  );
}

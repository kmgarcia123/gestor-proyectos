'use client';

import { useOptimistic, useTransition } from 'react';
import { alternarFijado } from '@/app/(app)/actions';

/** Fija el proyecto arriba en el menú (solo para esta persona). */
export default function BotonFijar({ proyectoId, fijado, compacto = false }: { proyectoId: string; fijado: boolean; compacto?: boolean }) {
  const [optimo, setOptimo] = useOptimistic(fijado);
  const [, start] = useTransition();
  const alternar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    start(async () => {
      setOptimo(!optimo);
      await alternarFijado(proyectoId);
    });
  };
  const icono = (
    <svg width={compacto ? 14 : 18} height={compacto ? 14 : 18} viewBox="0 0 24 24" fill={optimo ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z" />
    </svg>
  );
  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={optimo}
      aria-label={optimo ? 'Soltar proyecto' : 'Fijar proyecto arriba'}
      title={optimo ? 'Soltar proyecto' : 'Fijar proyecto arriba'}
      className={
        compacto
          ? `rounded-md p-1 transition ${optimo ? 'text-amber-400' : 'text-slate-500 opacity-0 hover:text-white group-hover:opacity-100 focus:opacity-100'}`
          : `rounded-lg p-1.5 transition hover:bg-nube ${optimo ? 'text-amber-500' : 'text-slate-400 hover:text-azul'}`
      }
    >
      {icono}
    </button>
  );
}

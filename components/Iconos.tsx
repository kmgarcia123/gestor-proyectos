import type { Estado, Prioridad } from '@/lib/types';

/** Colores e íconos de prioridad y estado, para que se reconozcan de un vistazo. */
export const ESTILO_PRIORIDAD: Record<Prioridad, { texto: string; chip: string; activo: string }> = {
  baja: { texto: 'Baja', chip: 'bg-slate-100 text-slate-600', activo: 'border-slate-400 bg-slate-100 text-slate-700' },
  media: { texto: 'Media', chip: 'bg-azul-suave text-azul-oscuro', activo: 'border-azul bg-azul-suave text-azul-oscuro' },
  alta: { texto: 'Alta', chip: 'bg-orange-50 text-orange-700', activo: 'border-orange-500 bg-orange-50 text-orange-700' },
  urgente: { texto: 'Urgente', chip: 'bg-red-50 text-red-700', activo: 'border-red-500 bg-red-50 text-red-700' }
};

export const ESTILO_ESTADO: Record<Estado, { chip: string; activo: string; punto: string }> = {
  por_hacer: { chip: 'bg-slate-100 text-slate-600', activo: 'border-slate-400 bg-slate-100 text-slate-700', punto: 'text-slate-400' },
  en_curso: { chip: 'bg-azul-suave text-azul-oscuro', activo: 'border-azul bg-azul-suave text-azul-oscuro', punto: 'text-azul' },
  revision: { chip: 'bg-amber-50 text-amber-800', activo: 'border-amber-500 bg-amber-50 text-amber-800', punto: 'text-amber-500' },
  hecho: { chip: 'bg-turquesa-suave text-turquesa-oscuro', activo: 'border-turquesa bg-turquesa-suave text-turquesa-oscuro', punto: 'text-turquesa' }
};

export function IconoPrioridad({ p, size = 14 }: { p: Prioridad; size?: number }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (p === 'baja') return <svg {...props}><path d="M12 5v14M6 13l6 6 6-6" /></svg>;
  if (p === 'media') return <svg {...props}><path d="M5 9h14M5 15h14" /></svg>;
  if (p === 'alta') return <svg {...props}><path d="M12 19V5M6 11l6-6 6 6" /></svg>;
  return (
    <svg {...props}>
      <path d="M6 13l6-6 6 6M6 19l6-6 6 6" />
    </svg>
  );
}

export function IconoEstado({ e, size = 14 }: { e: Estado; size?: number }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (e === 'por_hacer') return <svg {...props}><circle cx="12" cy="12" r="8.5" strokeDasharray="3 3" /></svg>;
  if (e === 'en_curso')
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
      </svg>
    );
  if (e === 'revision')
    return (
      <svg {...props}>
        <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
        <circle cx="12" cy="12" r="2.8" />
      </svg>
    );
  return (
    <svg {...props}>
      <circle cx="12" cy="12" r="8.5" fill="currentColor" stroke="none" opacity="0.2" />
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8 12.5 2.7 2.7L16.5 9.5" />
    </svg>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BotonFijar from '@/components/BotonFijar';
import type { Proyecto } from '@/lib/types';

export default function NavProyectos({ proyectos, fijados = [] }: { proyectos: Proyecto[]; fijados?: string[] }) {
  const path = usePathname();
  const clase = (activo: boolean) => `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${activo ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`;
  const item = (href: string, activo: boolean, contenido: React.ReactNode) => (
    <Link href={href} aria-current={activo ? 'page' : undefined} className={clase(activo)}>
      {contenido}
    </Link>
  );
  const proyecto = (p: Proyecto) => {
    const activo = path === `/proyectos/${p.id}`;
    return (
      <div key={p.id} className={`group flex items-center rounded-xl pr-1 transition ${activo ? 'bg-white/10' : 'hover:bg-white/5'}`}>
        <Link href={`/proyectos/${p.id}`} aria-current={activo ? 'page' : undefined} className={`flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-sm font-medium ${activo ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden="true" />
          <span className="truncate">{p.nombre}</span>
        </Link>
        <BotonFijar proyectoId={p.id} fijado={fijados.includes(p.id)} compacto />
      </div>
    );
  };
  const arriba = fijados.map((id) => proyectos.find((p) => p.id === id)).filter(Boolean) as Proyecto[];
  const resto = proyectos.filter((p) => !fijados.includes(p.id));

  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {item('/', path === '/', <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8M5 10v10h14V10" /></svg>Inicio</>)}
      {item('/notificaciones', path === '/notificaciones', <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>Mis notificaciones</>)}
      {arriba.length > 0 && (
        <>
          <p className="mb-1 mt-5 flex items-center gap-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-amber-400">📌 Fijados</p>
          {arriba.map(proyecto)}
        </>
      )}
      <p className="mb-1 mt-5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{arriba.length ? 'Otros proyectos' : 'Proyectos'}</p>
      {proyectos.length === 0 && <p className="px-3 text-xs text-slate-400">Aún no hay proyectos.</p>}
      {resto.map(proyecto)}
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Proyecto } from '@/lib/types';

export default function NavProyectos({ proyectos }: { proyectos: Proyecto[] }) {
  const path = usePathname();
  const item = (href: string, activo: boolean, contenido: React.ReactNode) => (
    <Link href={href} aria-current={activo ? 'page' : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${activo ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
      {contenido}
    </Link>
  );
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {item('/', path === '/', <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8M5 10v10h14V10" /></svg>Inicio</>)}
      <p className="mb-1 mt-5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Proyectos</p>
      {proyectos.length === 0 && <p className="px-3 text-xs text-slate-400">Aún no hay proyectos.</p>}
      {proyectos.map((p) =>
        item(`/proyectos/${p.id}`, path === `/proyectos/${p.id}`, <><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden="true" /><span className="truncate">{p.nombre}</span></>)
      )}
    </nav>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/** En celular: barra superior con botón ☰ que abre el menú lateral como panel deslizable. */
export default function MenuMovil({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const path = usePathname();

  useEffect(() => setAbierto(false), [path]);
  useEffect(() => {
    document.body.style.overflow = abierto ? 'hidden' : '';
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', esc);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', esc);
    };
  }, [abierto]);

  return (
    <div className="lg:hidden">
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-carbon px-4 py-3 text-white">
        <button type="button" onClick={() => setAbierto(true)} className="-ml-1 rounded-lg p-2 hover:bg-white/10" aria-label="Abrir menú" aria-expanded={abierto}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <span className="flex h-8 w-8 items-end justify-center gap-[3px] rounded-lg bg-white/10 p-1.5" aria-hidden="true">
          <span className="block h-4 w-1 rounded bg-azul" />
          <span className="block h-3 w-1 rounded bg-white" />
          <span className="block h-2 w-1 rounded bg-turquesa" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold leading-tight">{titulo}</p>
          <p className="truncate text-[11px] text-slate-400">{subtitulo}</p>
        </div>
      </header>

      <div className={`fixed inset-0 z-40 transition ${abierto ? 'visible' : 'invisible'}`} aria-hidden={!abierto}>
        <button type="button" tabIndex={-1} onClick={() => setAbierto(false)} className={`absolute inset-0 bg-carbon/60 transition-opacity ${abierto ? 'opacity-100' : 'opacity-0'}`} aria-label="Cerrar menú" />
        <aside className={`absolute inset-y-0 left-0 flex w-[min(300px,85vw)] flex-col gap-6 overflow-y-auto bg-carbon p-4 text-white shadow-2xl transition-transform ${abierto ? 'translate-x-0' : '-translate-x-full'}`}>
          <button type="button" onClick={() => setAbierto(false)} className="self-end rounded-lg p-2 text-slate-300 hover:bg-white/10" aria-label="Cerrar menú">✕</button>
          {children}
        </aside>
      </div>
    </div>
  );
}

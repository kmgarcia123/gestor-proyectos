import Avatar from '@/components/Avatar';
import NavProyectos from '@/components/NavProyectos';
import NuevoProyecto from '@/components/NuevoProyecto';
import { getContexto } from '@/lib/datos';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { yo, proyectos, workspaceNombre } = await getContexto();
  const app = process.env.NEXT_PUBLIC_APP_NAME || 'Gestor de proyectos';
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 bg-carbon p-4 text-white lg:sticky lg:top-0 lg:h-screen lg:w-64">
        <div className="flex items-center gap-3 px-1">
          <span className="flex h-9 w-9 items-end justify-center gap-[3px] rounded-xl bg-white/10 p-2" aria-hidden="true">
            <span className="block h-5 w-1.5 rounded bg-azul" />
            <span className="block h-3.5 w-1.5 rounded bg-white" />
            <span className="block h-2 w-1.5 rounded bg-turquesa" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold">{app}</p>
            <p className="truncate text-xs text-slate-400">{workspaceNombre}</p>
          </div>
        </div>
        <NuevoProyecto compacto />
        <div className="max-h-48 overflow-y-auto lg:max-h-none lg:flex-1">
          <NavProyectos proyectos={proyectos} />
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-2">
          <Avatar perfil={yo} size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{yo.nombre || yo.email}</p>
            <p className="truncate text-xs text-slate-400">{yo.email}</p>
          </div>
          <form action="/auth/salir" method="post">
            <button type="submit" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Cerrar sesión" title="Cerrar sesión">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" /></svg>
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

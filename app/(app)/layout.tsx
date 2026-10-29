import { NOMBRE_APP } from '@/lib/marca';
import Avatar from '@/components/Avatar';
import MenuMovil from '@/components/MenuMovil';
import NavProyectos from '@/components/NavProyectos';
import NuevoProyecto from '@/components/NuevoProyecto';
import RefrescoGlobal from '@/components/RefrescoGlobal';
import { getContexto } from '@/lib/datos';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { yo, proyectos, workspaceNombre, fijados } = await getContexto();
  const app = NOMBRE_APP;

  const marca = (
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
  );

  const usuario = (
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
  );

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Celular y tablet: barra superior con menú ☰ */}
      <MenuMovil titulo={app} subtitulo={workspaceNombre}>
        {marca}
        <NuevoProyecto compacto />
        <div className="flex-1">
          <NavProyectos proyectos={proyectos} fijados={fijados} />
        </div>
        {usuario}
      </MenuMovil>

      {/* Computador: menú lateral fijo */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 bg-carbon p-4 text-white lg:flex">
        {marca}
        <NuevoProyecto compacto />
        <div className="flex-1 overflow-y-auto">
          <NavProyectos proyectos={proyectos} fijados={fijados} />
        </div>
        {usuario}
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
      <RefrescoGlobal />
    </div>
  );
}

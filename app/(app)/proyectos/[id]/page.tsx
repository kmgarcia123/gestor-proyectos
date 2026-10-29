import { notFound } from 'next/navigation';
import Avatar from '@/components/Avatar';
import ProyectoVista from '@/components/ProyectoVista';
import { getContexto } from '@/lib/datos';
import { formatoCorto } from '@/lib/fechas';
import type { Fase, Tarea } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ProyectoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tarea?: string; vista?: string }> }) {
  const { id } = await params;
  const { tarea: tareaAbierta, vista } = await searchParams;
  const { supabase, equipo, proyectos, yo } = await getContexto();
  const proyecto = proyectos.find((p) => p.id === id);
  if (!proyecto) notFound();

  const [{ data: fases }, { data: tareas }] = await Promise.all([
    supabase.from('fases').select('*').eq('proyecto_id', id).order('posicion'),
    supabase.from('tareas').select('*, adjuntos(count)').eq('proyecto_id', id).order('posicion')
  ]);
  // adjuntos(count) llega como [{ count: n }]; se deja como número.
  const ts = ((tareas || []) as (Tarea & { adjuntos?: { count: number }[] })[]).map(({ adjuntos, ...t }) => ({ ...t, adjuntos_total: adjuntos?.[0]?.count ?? 0 })) as Tarea[];
  const hechas = ts.filter((t) => t.estado === 'hecho').length;
  const pct = ts.length ? Math.round((hechas / ts.length) * 100) : 0;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-white px-4 py-5 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: proyecto.color }} aria-hidden="true" />
              <h1 className="truncate text-2xl font-extrabold tracking-tight">{proyecto.nombre}</h1>
            </div>
            {proyecto.descripcion && <p className="mt-1 max-w-2xl text-sm text-slate-500">{proyecto.descripcion}</p>}
          </div>
          <div className="flex w-full items-center gap-5 sm:w-auto">
            <div className="flex -space-x-2">
              {equipo.map((m) => (
                <Avatar key={m.id} perfil={m} size={32} />
              ))}
            </div>
            <div className="min-w-0 flex-1 sm:w-44 sm:flex-none">
              <div className="mb-1 flex justify-between text-xs font-semibold">
                <span className="text-slate-500">Avance</span>
                <span>{pct}% · {hechas}/{ts.length}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-nube" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del proyecto">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: proyecto.color }} />
              </div>
              {proyecto.fecha_fin && <p className="mt-1 text-right text-xs text-slate-500">Objetivo {formatoCorto(proyecto.fecha_fin)}</p>}
            </div>
          </div>
        </div>
      </header>
      <ProyectoVista
        key={id}
        proyecto={proyecto}
        tareasIniciales={ts}
        fases={(fases || []) as Fase[]}
        equipo={equipo}
        yoId={yo.id}
        tareaAbiertaId={tareaAbierta}
        vistaInicial={vista === 'mapa' ? 'mapa' : 'tablero'}
      />
    </div>
  );
}

import Link from 'next/link';
import Avatar from '@/components/Avatar';
import NuevoProyecto from '@/components/NuevoProyecto';
import { getContexto } from '@/lib/datos';
import { nombreCorto } from '@/lib/perfil';
import { estadoFecha, formatoCorto, hoyBogota } from '@/lib/fechas';
import type { Tarea } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ETQ_FECHA: Record<string, { txt: string; cls: string }> = {
  vencida: { txt: 'Vencida', cls: 'bg-red-50 text-red-700' },
  hoy: { txt: 'Hoy', cls: 'bg-amber-50 text-amber-800' },
  manana: { txt: 'Mañana', cls: 'bg-azul-suave text-azul-oscuro' }
};

export default async function Inicio() {
  const { supabase, yo, workspaceId, proyectos, equipo } = await getContexto();
  const { data } = await supabase
    .from('tareas')
    .select('id, proyecto_id, titulo, estado, prioridad, responsable_id, fecha_limite, terminado_en')
    .eq('workspace_id', workspaceId);
  const tareas = (data || []) as Pick<Tarea, 'id' | 'proyecto_id' | 'titulo' | 'estado' | 'prioridad' | 'responsable_id' | 'fecha_limite' | 'terminado_en'>[];

  const hoy = hoyBogota();
  const hace7 = hoyBogota(-7);
  const mias = tareas.filter((t) => t.responsable_id === yo.id && t.estado !== 'hecho');
  const vencidas = mias.filter((t) => t.fecha_limite && t.fecha_limite < hoy);
  const paraHoy = mias.filter((t) => t.fecha_limite === hoy);
  const terminadasSemana = tareas.filter((t) => t.estado === 'hecho' && t.terminado_en && t.terminado_en.slice(0, 10) >= hace7);
  const proximas = [...mias].sort((a, b) => (a.fecha_limite || '9999').localeCompare(b.fecha_limite || '9999')).slice(0, 8);
  const proyectoPorId = Object.fromEntries(proyectos.map((p) => [p.id, p]));

  const avance = proyectos.map((p) => {
    const ts = tareas.filter((t) => t.proyecto_id === p.id);
    const hechas = ts.filter((t) => t.estado === 'hecho').length;
    return { p, total: ts.length, hechas, pct: ts.length ? Math.round((hechas / ts.length) * 100) : 0 };
  });

  const porPersona = equipo.map((m) => ({
    m,
    abiertas: tareas.filter((t) => t.responsable_id === m.id && t.estado !== 'hecho').length,
    vencidas: tareas.filter((t) => t.responsable_id === m.id && t.estado !== 'hecho' && t.fecha_limite && t.fecha_limite < hoy).length
  }));

  const kpis = [
    { label: 'Mis tareas abiertas', valor: mias.length, tono: 'text-carbon' },
    { label: 'Vencidas', valor: vencidas.length, tono: vencidas.length ? 'text-red-700' : 'text-carbon' },
    { label: 'Para hoy', valor: paraHoy.length, tono: 'text-carbon' },
    { label: 'Terminadas (7 días, equipo)', valor: terminadasSemana.length, tono: 'text-turquesa-oscuro' }
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-azul">Inicio</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Hola, {nombreCorto(yo)}</h1>
        </div>
        <NuevoProyecto />
      </header>

      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="tarjeta p-5">
            <p className="text-xs font-semibold text-slate-500">{k.label}</p>
            <p className={`mt-1 text-3xl font-extrabold tracking-tight ${k.tono}`}>{k.valor}</p>
          </div>
        ))}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="tarjeta p-5">
          <h2 className="mb-4 text-lg font-bold">Mis próximas tareas</h2>
          {proximas.length === 0 ? (
            <p className="rounded-xl bg-nube p-4 text-sm text-slate-600">No tienes tareas abiertas. Crea un proyecto o asígnate una tarea.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {proximas.map((t) => {
                const ef = estadoFecha(t.fecha_limite);
                const p = proyectoPorId[t.proyecto_id];
                return (
                  <li key={t.id}>
                    <Link href={`/proyectos/${t.proyecto_id}?tarea=${t.id}`} className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-nube">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p?.color || '#94A3B8' }} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{t.titulo}</span>
                        <span className="block truncate text-xs text-slate-500">{p?.nombre}</span>
                      </span>
                      {ETQ_FECHA[ef] && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ETQ_FECHA[ef].cls}`}>{ETQ_FECHA[ef].txt}</span>}
                      {t.fecha_limite && <span className="w-14 text-right text-xs text-slate-500">{formatoCorto(t.fecha_limite)}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="tarjeta p-5">
          <h2 className="mb-4 text-lg font-bold">Equipo</h2>
          <ul className="flex flex-col gap-3">
            {porPersona.map(({ m, abiertas, vencidas: v }) => (
              <li key={m.id} className="flex items-center gap-3">
                <Avatar perfil={m} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{m.nombre || m.email}</span>
                  <span className="block text-xs text-slate-500">{abiertas} abiertas{v ? ` · ${v} vencidas` : ''}</span>
                </span>
                {v > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">{v}</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-4 text-lg font-bold">Avance de proyectos</h2>
        {avance.length === 0 ? (
          <div className="tarjeta p-8 text-center">
            <p className="text-sm text-slate-600">Todavía no hay proyectos. Crea el primero para empezar.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {avance.map(({ p, total, hechas, pct }) => (
              <Link key={p.id} href={`/proyectos/${p.id}`} className="tarjeta group flex flex-col gap-3 p-5 transition hover:-translate-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: p.color }} aria-hidden="true" />
                  <h3 className="truncate font-bold group-hover:text-azul">{p.nombre}</h3>
                </div>
                <div className="flex items-end justify-between">
                  <span className="text-3xl font-extrabold tracking-tight">{pct}%</span>
                  <span className="text-xs text-slate-500">{hechas} de {total} tareas</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-nube" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Avance de ${p.nombre}`}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: p.color }} />
                </div>
                {p.fecha_fin && <p className="text-xs text-slate-500">Objetivo: {formatoCorto(p.fecha_fin)}</p>}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

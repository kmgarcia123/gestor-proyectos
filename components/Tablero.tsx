'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import TarjetaTarea, { ContenidoTarjeta } from '@/components/TarjetaTarea';
import DialogoTarea from '@/components/DialogoTarea';
import { actualizarTarea, crearTarea } from '@/app/(app)/actions';
import { ESTADOS, type Estado, type Fase, type Perfil, type Tarea } from '@/lib/types';

const COLOR_COL: Record<Estado, string> = {
  por_hacer: 'bg-slate-400',
  en_curso: 'bg-azul',
  revision: 'bg-amber-500',
  hecho: 'bg-turquesa'
};

interface Props {
  proyectoId: string;
  tareasIniciales: Tarea[];
  equipo: Perfil[];
  fases: Fase[];
  tareaAbiertaId?: string;
  yoId: string;
}

function Columna({ estado, nombre, children, total }: { estado: Estado; nombre: string; children: React.ReactNode; total: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${estado}`, data: { tipo: 'columna', estado } });
  return (
    <section aria-label={nombre} className={`flex w-[290px] shrink-0 flex-col rounded-3xl p-3 transition-colors sm:w-auto sm:min-w-0 ${isOver ? 'bg-azul-suave' : 'bg-nube'}`}>
      <h2 className="mb-3 flex items-center gap-2 px-1 text-sm font-bold">
        <span className={`h-2.5 w-2.5 rounded-full ${COLOR_COL[estado]}`} aria-hidden="true" />
        {nombre}
        <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">{total}</span>
      </h2>
      <div ref={setNodeRef} className="flex min-h-[80px] flex-1 flex-col">
        {children}
      </div>
    </section>
  );
}

function AgregarRapido({ onAgregar }: { onAgregar: (titulo: string) => Promise<void> }) {
  const [valor, setValor] = useState('');
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const t = valor.trim();
        if (!t) return;
        start(async () => {
          await onAgregar(t);
          setValor('');
        });
      }}
      className="mt-2"
    >
      <label className="sr-only">Nueva tarea</label>
      <input value={valor} onChange={(e) => setValor(e.target.value)} disabled={pending} placeholder="+ Agregar tarea" className="w-full rounded-xl border border-transparent bg-transparent px-3 py-2 text-sm placeholder:text-slate-500 hover:bg-white focus:border-azul focus:bg-white focus:outline-none" />
    </form>
  );
}

export default function Tablero({ proyectoId, tareasIniciales, equipo, fases, tareaAbiertaId, yoId }: Props) {
  const [tareas, setTareas] = useState<Tarea[]>(tareasIniciales);
  const [abierta, setAbierta] = useState<Tarea | null>(() => tareasIniciales.find((t) => t.id === tareaAbiertaId) || null);
  const [arrastrando, setArrastrando] = useState<Tarea | null>(null);
  const [soloMias, setSoloMias] = useState(false);
  const [faseFiltro, setFaseFiltro] = useState('');

  const porId = useMemo(() => Object.fromEntries(equipo.map((m) => [m.id, m])), [equipo]);
  const fasePorId = useMemo(() => Object.fromEntries(fases.map((f) => [f.id, f])), [fases]);

  const visibles = tareas.filter((t) => (!soloMias || t.responsable_id === yoId) && (!faseFiltro || t.fase_id === faseFiltro));
  const columnas = ESTADOS.map((e) => ({ ...e, tareas: visibles.filter((t) => t.estado === e.id).sort((a, b) => a.posicion - b.posicion) }));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function alIniciar(e: DragStartEvent) {
    setArrastrando(tareas.find((t) => t.id === e.active.id) || null);
  }

  function alSoltar(e: DragEndEvent) {
    setArrastrando(null);
    const { active, over } = e;
    if (!over) return;
    const activa = tareas.find((t) => t.id === active.id);
    if (!activa) return;

    const overId = String(over.id);
    const destino: Estado = overId.startsWith('col:') ? (overId.slice(4) as Estado) : tareas.find((t) => t.id === overId)?.estado || activa.estado;
    const lista = tareas.filter((t) => t.estado === destino && t.id !== activa.id).sort((a, b) => a.posicion - b.posicion);
    let indice = overId.startsWith('col:') ? lista.length : lista.findIndex((t) => t.id === overId);
    if (indice < 0) indice = lista.length;
    // Si se arrastra hacia abajo dentro de la misma columna, ubicar después de la tarjeta destino.
    if (!overId.startsWith('col:') && activa.estado === destino) {
      const original = tareas.filter((t) => t.estado === destino).sort((a, b) => a.posicion - b.posicion);
      if (original.findIndex((t) => t.id === activa.id) < original.findIndex((t) => t.id === overId)) indice += 1;
    }
    const antes = lista[indice - 1]?.posicion;
    const despues = lista[indice]?.posicion;
    const posicion = antes !== undefined && despues !== undefined ? (antes + despues) / 2 : antes !== undefined ? antes + 1024 : despues !== undefined ? despues - 1024 : 1024;

    if (destino === activa.estado && posicion === activa.posicion) return;
    const anterior = tareas;
    setTareas((ts) => ts.map((t) => (t.id === activa.id ? { ...t, estado: destino, posicion } : t)));
    actualizarTarea(activa.id, { estado: destino, posicion }).catch(() => setTareas(anterior));
  }

  async function agregar(estado: Estado, titulo: string) {
    const max = Math.max(0, ...tareas.filter((t) => t.estado === estado).map((t) => t.posicion));
    const nueva = await crearTarea({ proyecto_id: proyectoId, titulo, estado, posicion: max + 1024, fase_id: faseFiltro || null });
    if (nueva) setTareas((ts) => [...ts, nueva as Tarea]);
  }

  return (
    <div className="flex flex-1 flex-col px-4 py-5 sm:px-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full bg-white p-1 shadow-sm" role="group" aria-label="Filtro de responsable">
          <button type="button" aria-pressed={!soloMias} onClick={() => setSoloMias(false)} className="rounded-full px-4 py-1.5 text-sm font-semibold text-slate-500 aria-pressed:bg-carbon aria-pressed:text-white">Todas</button>
          <button type="button" aria-pressed={soloMias} onClick={() => setSoloMias(true)} className="rounded-full px-4 py-1.5 text-sm font-semibold text-slate-500 aria-pressed:bg-carbon aria-pressed:text-white">Mis tareas</button>
        </div>
        {fases.length > 0 && (
          <div>
            <label className="sr-only" htmlFor="filtro-fase">Filtrar por fase</label>
            <select id="filtro-fase" value={faseFiltro} onChange={(e) => setFaseFiltro(e.target.value)} className="campo w-auto rounded-full py-2">
              <option value="">Todas las fases</option>
              {fases.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
          </div>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={alIniciar} onDragEnd={alSoltar} onDragCancel={() => setArrastrando(null)}>
        <div className="flex flex-1 gap-4 overflow-x-auto pb-4 sm:grid sm:grid-cols-2 sm:overflow-visible xl:grid-cols-4">
          {columnas.map((c) => (
            <Columna key={c.id} estado={c.id} nombre={c.nombre} total={c.tareas.length}>
              <SortableContext items={c.tareas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <ul className="flex flex-col gap-2.5">
                  {c.tareas.map((t) => (
                    <TarjetaTarea key={t.id} t={t} responsable={t.responsable_id ? porId[t.responsable_id] : undefined} fase={t.fase_id ? fasePorId[t.fase_id] : undefined} onAbrir={() => setAbierta(t)} />
                  ))}
                </ul>
              </SortableContext>
              <AgregarRapido onAgregar={(titulo) => agregar(c.id, titulo)} />
            </Columna>
          ))}
        </div>
        <DragOverlay>
          {arrastrando && (
            <div className="rotate-2 rounded-2xl border border-azul/40 bg-white p-3.5 shadow-xl">
              <ContenidoTarjeta t={arrastrando} responsable={arrastrando.responsable_id ? porId[arrastrando.responsable_id] : undefined} fase={arrastrando.fase_id ? fasePorId[arrastrando.fase_id] : undefined} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <DialogoTarea
        tarea={abierta}
        equipo={equipo}
        fases={fases}
        onCerrar={() => setAbierta(null)}
        onGuardada={(t) => setTareas((ts) => ts.map((x) => (x.id === t.id ? t : x)))}
        onEliminada={(id) => setTareas((ts) => ts.filter((x) => x.id !== id))}
      />
    </div>
  );
}

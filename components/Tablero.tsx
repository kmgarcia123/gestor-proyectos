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
import NuevaTareaRapida, { type DatosNuevaTarea } from '@/components/NuevaTareaRapida';
import { actualizarTarea, crearTarea } from '@/app/(app)/actions';
import { ESTADOS, type Estado, type Fase, type Perfil, type Tarea } from '@/lib/types';
import { aplanar, conDescendientes } from '@/lib/fases';

const COLOR_COL: Record<Estado, string> = {
  por_hacer: 'bg-slate-400',
  en_curso: 'bg-azul',
  revision: 'bg-amber-500',
  hecho: 'bg-turquesa'
};

interface Props {
  proyectoId: string;
  tareas: Tarea[];
  setTareas: React.Dispatch<React.SetStateAction<Tarea[]>>;
  equipo: Perfil[];
  fases: Fase[];
  faseFiltro: string;
  setFaseFiltro: (id: string) => void;
  tareaAbiertaId?: string;
  yoId: string;
}

function Columna({ estado, nombre, children, total, arriba }: { estado: Estado; nombre: string; children: React.ReactNode; total: number; arriba: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${estado}`, data: { tipo: 'columna', estado } });
  return (
    <section aria-label={nombre} className={`flex w-[82vw] max-w-[320px] shrink-0 snap-center flex-col rounded-3xl p-3 transition-colors sm:w-auto sm:max-w-none sm:min-w-0 ${isOver ? 'bg-azul-suave' : 'bg-nube'}`}>
      <h2 className="mb-3 flex items-center gap-2 px-1 text-sm font-bold">
        <span className={`h-2.5 w-2.5 rounded-full ${COLOR_COL[estado]}`} aria-hidden="true" />
        {nombre}
        <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">{total}</span>
      </h2>
      {arriba}
      <div ref={setNodeRef} className="flex min-h-[80px] flex-1 flex-col">
        {children}
      </div>
    </section>
  );
}

function AgregarRapido({ onAgregar, id }: { onAgregar: (titulo: string) => void; id: string }) {
  const [valor, setValor] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAgregar(valor.trim());
        setValor('');
      }}
      className="mb-2.5"
    >
      <label className="sr-only" htmlFor={id}>Nueva tarea</label>
      <div className="flex items-center gap-1 rounded-xl border border-dashed border-slate-300 bg-white/60 pr-1 transition focus-within:border-azul focus-within:bg-white hover:bg-white">
        <button type="submit" className="pl-3 text-lg font-bold leading-none text-azul" aria-label="Crear tarea">+</button>
        <input id={id} value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Agregar tarea" className="min-w-0 flex-1 border-0 bg-transparent px-2 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-0" />
        {valor.trim() && <button type="submit" className="rounded-lg bg-azul px-2.5 py-1 text-xs font-bold text-white">Crear</button>}
      </div>
    </form>
  );
}

export default function Tablero({ proyectoId, tareas, setTareas, equipo, fases, faseFiltro, setFaseFiltro, tareaAbiertaId, yoId }: Props) {
  const [abierta, setAbierta] = useState<Tarea | null>(() => tareas.find((t) => t.id === tareaAbiertaId) || null);
  const [arrastrando, setArrastrando] = useState<Tarea | null>(null);
  const [soloMias, setSoloMias] = useState(false);
  const [nueva, setNueva] = useState<{ estado: Estado; titulo: string } | null>(null);

  const porId = useMemo(() => Object.fromEntries(equipo.map((m) => [m.id, m])), [equipo]);
  const fasePorId = useMemo(() => Object.fromEntries(fases.map((f) => [f.id, f])), [fases]);

  const enFase = useMemo(() => (faseFiltro ? conDescendientes(fases, faseFiltro) : null), [fases, faseFiltro]);
  const personas = (t: Tarea) => (t.responsables || []).map((id) => porId[id]).filter(Boolean);
  const visibles = tareas.filter((t) => (!soloMias || (t.responsables || []).includes(yoId)) && (!enFase || (t.fase_id && enFase.has(t.fase_id))));
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

  async function agregar(estado: Estado, datos: DatosNuevaTarea, abrir: boolean) {
    // Queda de primera en la columna.
    const min = Math.min(0, ...tareas.filter((t) => t.estado === estado).map((t) => t.posicion));
    const creada = (await crearTarea({ proyecto_id: proyectoId, titulo: datos.titulo, responsables: datos.responsables, fecha_limite: datos.fecha_limite, estado, posicion: min - 1024, fase_id: datos.fase_id })) as Tarea | null;
    if (!creada) return;
    setTareas((ts) => (ts.some((t) => t.id === creada.id) ? ts : [{ ...creada, adjuntos_total: 0 }, ...ts]));
    if (abrir) setTimeout(() => setAbierta({ ...creada, adjuntos_total: 0 }), 50);
  }

  return (
    <div className="flex flex-1 flex-col px-4 py-5 sm:px-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full bg-white p-1 shadow-sm" role="group" aria-label="Filtro de responsable">
          <button type="button" aria-pressed={!soloMias} onClick={() => setSoloMias(false)} className="rounded-full px-4 py-1.5 text-sm font-semibold text-slate-500 aria-pressed:bg-carbon aria-pressed:text-white">Todas</button>
          <button type="button" aria-pressed={soloMias} onClick={() => setSoloMias(true)} className="rounded-full px-4 py-1.5 text-sm font-semibold text-slate-500 aria-pressed:bg-carbon aria-pressed:text-white">Mis tareas</button>
        </div>
        <button type="button" onClick={() => setNueva({ estado: 'por_hacer', titulo: '' })} className="btn-primario order-first sm:order-none">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Nueva tarea
        </button>
        {fases.length > 0 && (
          <div>
            <label className="sr-only" htmlFor="filtro-fase">Filtrar por fase</label>
            <select id="filtro-fase" value={faseFiltro} onChange={(e) => setFaseFiltro(e.target.value)} className="campo w-auto rounded-full py-2">
              <option value="">Todas las fases</option>
              {aplanar(fases).map(({ f, nivel }) => <option key={f.id} value={f.id}>{'\u00A0\u00A0'.repeat(nivel) + (nivel ? '└ ' : '') + f.nombre}</option>)}
            </select>
          </div>
        )}
      </div>

      <DndContext id="tablero" sensors={sensors} collisionDetection={closestCorners} onDragStart={alIniciar} onDragEnd={alSoltar} onDragCancel={() => setArrastrando(null)}>
        <div className="-mx-4 flex flex-1 snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 xl:grid-cols-4">
          {columnas.map((c) => (
            <Columna key={c.id} estado={c.id} nombre={c.nombre} total={c.tareas.length} arriba={<AgregarRapido id={`nueva-${c.id}`} onAgregar={(titulo) => setNueva({ estado: c.id, titulo })} />}>
              <SortableContext items={c.tareas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <ul className="flex flex-col gap-2.5">
                  {c.tareas.map((t) => (
                    <TarjetaTarea key={t.id} t={t} responsables={personas(t)} fase={t.fase_id ? fasePorId[t.fase_id] : undefined} onAbrir={() => setAbierta(t)} />
                  ))}
                </ul>
              </SortableContext>
            </Columna>
          ))}
        </div>
        <DragOverlay>
          {arrastrando && (
            <div className="rotate-2 rounded-2xl border border-azul/40 bg-white p-3.5 shadow-xl">
              <ContenidoTarjeta t={arrastrando} responsables={personas(arrastrando)} fase={arrastrando.fase_id ? fasePorId[arrastrando.fase_id] : undefined} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <NuevaTareaRapida
        abierta={nueva}
        equipo={equipo}
        yoId={yoId}
        fases={fases}
        faseInicial={faseFiltro || undefined}
        onCerrar={() => setNueva(null)}
        onCrear={(datos, abrir) => agregar(nueva!.estado, datos, abrir)}
      />

      <DialogoTarea
        tarea={abierta}
        equipo={equipo}
        fases={fases}
        onCerrar={() => setAbierta(null)}
        onGuardada={(t) => setTareas((ts) => ts.map((x) => (x.id === t.id ? { ...x, ...t, pasos: x.pasos, adjuntos_total: x.adjuntos_total, actualizado_en: new Date().toISOString() } : x)))}
        onParcial={(id, c) => setTareas((ts) => ts.map((x) => (x.id === id ? { ...x, ...c } : x)))}
        onEliminada={(id) => setTareas((ts) => ts.filter((x) => x.id !== id))}
      />
    </div>
  );
}

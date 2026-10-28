'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { actualizarFase, crearFase, eliminarFase, intercambiarFases } from '@/app/(app)/actions';
import { aplanar, avanceFase, conDescendientes, hijosPorPadre } from '@/lib/fases';
import type { EstadoFase, Fase, Proyecto, Tarea } from '@/lib/types';

const ESTILO: Record<EstadoFase, { caja: string; barra: string; chip: string; texto: string }> = {
  hecho: { caja: 'border-turquesa bg-turquesa-suave', barra: 'bg-turquesa', chip: 'bg-turquesa text-white', texto: 'Ejecutada' },
  curso: { caja: 'border-azul bg-azul-suave', barra: 'bg-azul', chip: 'bg-azul text-white', texto: 'En curso' },
  pendiente: { caja: 'border-slate-200 bg-white', barra: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600', texto: 'Pendiente' }
};

type Editor = { modo: 'nueva'; padre: Fase | null } | { modo: 'editar'; fase: Fase } | null;

interface Props {
  proyecto: Proyecto;
  fases: Fase[];
  tareas: Tarea[];
  onVerTareas: (faseId: string) => void;
}

export default function MapaFases({ proyecto, fases, tareas, onVerTareas }: Props) {
  const [editor, setEditor] = useState<Editor>(null);
  const [pending, start] = useTransition();
  const lienzo = useRef<HTMLDivElement>(null);
  const hijos = hijosPorPadre(fases);

  // En pantallas angostas, arrancar con el proyecto (la raíz) centrado.
  useEffect(() => {
    const el = lienzo.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);

  const total = tareas.length;
  const hechas = tareas.filter((t) => t.estado === 'hecho').length;
  const pctProyecto = total ? Math.round((hechas / total) * 100) : 0;
  const conteo = { hecho: 0, curso: 0, pendiente: 0 } as Record<EstadoFase, number>;
  fases.forEach((f) => conteo[avanceFase(fases, tareas, f).estado]++);

  function mover(f: Fase, dir: -1 | 1) {
    const hermanos = hijos.get(f.parent_id || '') || [];
    const i = hermanos.findIndex((x) => x.id === f.id);
    const otro = hermanos[i + dir];
    if (!otro) return;
    // Si dos hermanos tienen la misma posición, se separan para que el intercambio tenga efecto.
    const a = { id: f.id, posicion: f.posicion };
    const b = { id: otro.id, posicion: otro.posicion === f.posicion ? f.posicion + dir : otro.posicion };
    start(() => intercambiarFases(a, b));
  }

  function Nodo({ f }: { f: Fase }) {
    const av = avanceFase(fases, tareas, f);
    const st = ESTILO[av.estado];
    const sub = hijos.get(f.id) || [];
    const hermanos = hijos.get(f.parent_id || '') || [];
    const i = hermanos.findIndex((x) => x.id === f.id);
    return (
      <li>
        <div className={`group relative w-56 rounded-2xl border-2 p-3 text-left shadow-sm transition hover:shadow-md ${st.caja}`}>
          <button type="button" onClick={() => onVerTareas(f.id)} className="block w-full text-left" title="Ver las tareas de esta fase en el tablero">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 break-words text-sm font-bold leading-snug">{f.nombre}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.chip}`}>{st.texto}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/80">
                <div className={`h-full rounded-full ${st.barra}`} style={{ width: `${av.pct}%` }} />
              </div>
              <span className="text-[11px] font-bold">{av.total || av.estado === 'hecho' ? `${av.pct}%` : '—'}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {av.total ? `${av.hechas} de ${av.total} tareas` : 'Sin tareas'}
              {sub.length ? ` · ${sub.length} subfase${sub.length > 1 ? 's' : ''}` : ''}
              {!av.automatico && ' · marcada a mano'}
            </p>
          </button>
          <div className="mt-2 flex items-center gap-1 border-t border-black/5 pt-2">
            <button type="button" onClick={() => setEditor({ modo: 'nueva', padre: f })} className="rounded-lg px-2 py-1 text-[11px] font-bold text-azul hover:bg-white" title="Agregar una subfase">+ Subfase</button>
            <button type="button" onClick={() => setEditor({ modo: 'editar', fase: f })} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-white">Editar</button>
            <span className="ml-auto flex">
              <button type="button" disabled={pending || i <= 0} onClick={() => mover(f, -1)} className="rounded-lg px-1.5 py-1 text-xs text-slate-500 hover:bg-white disabled:opacity-30" aria-label={`Mover ${f.nombre} a la izquierda`}>←</button>
              <button type="button" disabled={pending || i >= hermanos.length - 1} onClick={() => mover(f, 1)} className="rounded-lg px-1.5 py-1 text-xs text-slate-500 hover:bg-white disabled:opacity-30" aria-label={`Mover ${f.nombre} a la derecha`}>→</button>
            </span>
          </div>
        </div>
        {sub.length > 0 && (
          <ul>
            {sub.map((h) => <Nodo key={h.id} f={h} />)}
          </ul>
        )}
      </li>
    );
  }

  const raiz = hijos.get('') || [];
  return (
    <div className="flex flex-1 flex-col px-4 py-5 sm:px-8">
      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs font-semibold">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-slate-300 bg-white" />Pendiente · {conteo.pendiente}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-azul bg-azul-suave" />En curso · {conteo.curso}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-turquesa bg-turquesa-suave" />Ejecutada · {conteo.hecho}</span>
        <span className="text-slate-500 sm:ml-auto">Toca un cuadro para ver sus tareas en el tablero.</span>
      </div>

      <div ref={lienzo} className="tarjeta flex-1 overflow-auto p-6">
        <div className="arbol min-w-max">
          <ul>
            <li>
              <div className="w-64 rounded-2xl bg-carbon p-4 text-white shadow-md">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: proyecto.color }} aria-hidden="true" />
                  <p className="truncate font-extrabold">{proyecto.nombre}</p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
                    <div className="h-full rounded-full bg-turquesa" style={{ width: `${pctProyecto}%` }} />
                  </div>
                  <span className="text-xs font-bold">{pctProyecto}%</span>
                </div>
                <button type="button" onClick={() => setEditor({ modo: 'nueva', padre: null })} className="mt-3 w-full rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/20">
                  + Agregar fase
                </button>
              </div>
              {raiz.length > 0 ? (
                <ul>
                  {raiz.map((f) => <Nodo key={f.id} f={f} />)}
                </ul>
              ) : (
                <p className="mt-6 max-w-sm text-center text-sm text-slate-500">Aún no hay fases. Agrega la primera (por ejemplo «Diagnóstico» o «Diseño») y luego sus subfases.</p>
              )}
            </li>
          </ul>
        </div>
      </div>

      <EditorFase editor={editor} fases={fases} proyectoId={proyecto.id} onCerrar={() => setEditor(null)} />
    </div>
  );
}

function EditorFase({ editor, fases, proyectoId, onCerrar }: { editor: Editor; fases: Fase[]; proyectoId: string; onCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [nombre, setNombre] = useState('');
  const [padre, setPadre] = useState('');
  const [estado, setEstado] = useState<EstadoFase | ''>('');
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (editor) {
      setNombre(editor.modo === 'editar' ? editor.fase.nombre : '');
      setPadre(editor.modo === 'editar' ? editor.fase.parent_id || '' : editor.padre?.id || '');
      setEstado(editor.modo === 'editar' ? editor.fase.estado_manual || '' : '');
      setConfirmar(false);
      setError('');
      if (!d.open) d.showModal();
    } else if (d.open) d.close();
  }, [editor]);

  const excluidos = editor?.modo === 'editar' ? conDescendientes(fases, editor.fase.id) : new Set<string>();
  const opciones = aplanar(fases).filter(({ f }) => !excluidos.has(f.id));
  const sub = editor?.modo === 'editar' ? conDescendientes(fases, editor.fase.id).size - 1 : 0;

  function guardar() {
    if (!editor) return;
    start(async () => {
      try {
        if (editor.modo === 'nueva') {
          await crearFase(proyectoId, nombre, padre || null);
        } else {
          await actualizarFase(editor.fase.id, { nombre, parent_id: padre || null, estado_manual: estado || null });
        }
        ref.current?.close();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo guardar.');
      }
    });
  }

  function borrar() {
    if (editor?.modo !== 'editar') return;
    if (!confirmar) return setConfirmar(true);
    start(async () => {
      await eliminarFase(editor.fase.id);
      ref.current?.close();
    });
  }

  return (
    <dialog ref={ref} onClose={onCerrar} className="w-[min(460px,94vw)] rounded-3xl p-0 backdrop:bg-carbon/60 backdrop:backdrop-blur-sm" aria-labelledby="ef-titulo">
      {editor && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
          className="flex flex-col gap-4 p-6"
        >
          <h2 id="ef-titulo" className="text-lg font-extrabold">
            {editor.modo === 'editar' ? 'Editar fase' : editor.padre ? `Nueva subfase de «${editor.padre.nombre}»` : 'Nueva fase'}
          </h2>
          <div>
            <label className="etiqueta" htmlFor="ef-nombre">Nombre</label>
            <input id="ef-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={80} autoFocus className="campo" placeholder="Ej.: Planos estructurales" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="ef-padre">Ubicación en el mapa</label>
            <select id="ef-padre" value={padre} onChange={(e) => setPadre(e.target.value)} className="campo">
              <option value="">Fase principal (debajo del proyecto)</option>
              {opciones.map(({ f, nivel }) => (
                <option key={f.id} value={f.id}>{'  '.repeat(nivel + 1) + '└ dentro de ' + f.nombre}</option>
              ))}
            </select>
          </div>
          {editor.modo === 'editar' && (
            <div>
              <p className="etiqueta">Estado</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Estado de la fase">
                {([['', 'Automático'], ['pendiente', 'Pendiente'], ['curso', 'En curso'], ['hecho', 'Ejecutada']] as const).map(([v, t]) => (
                  <button key={v || 'auto'} type="button" role="radio" aria-checked={estado === v} onClick={() => setEstado(v)} className={`rounded-xl border-2 px-2 py-2 text-xs font-bold transition ${estado === v ? 'border-azul bg-azul-suave text-azul-oscuro' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    {t}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">«Automático» calcula el estado según sus tareas. Usa los otros cuando la fase no tiene tareas.</p>
            </div>
          )}
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {editor.modo === 'editar' ? (
              <button type="button" onClick={borrar} disabled={pending} className="btn-peligro">
                {confirmar ? (sub ? `Sí, eliminar con ${sub} subfase${sub > 1 ? 's' : ''}` : 'Sí, eliminar') : 'Eliminar'}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => ref.current?.close()} className="btn-suave">Cancelar</button>
              <button type="submit" disabled={pending} className="btn-primario">{pending ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
          {confirmar && <p className="text-xs text-slate-500">Las tareas de esta fase no se borran: quedan «sin fase».</p>}
        </form>
      )}
    </dialog>
  );
}

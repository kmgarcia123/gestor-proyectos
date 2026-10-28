'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { actualizarFase, crearFase, eliminarFase, guardarPosiciones, intercambiarFases, ordenarMapa } from '@/app/(app)/actions';
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

// Medidas fijas de los cuadros para poder dibujar las líneas que los conectan.
const W = 224;
const H = 140;
const RAIZ_W = 256;
const RAIZ_H = 116;
const GAP_X = 28;
const GAP_Y = 64;
const MARGEN = 32;

type Punto = { x: number; y: number };

/** Ubicación automática en árbol: cada fase centrada sobre sus subfases. */
function layoutAutomatico(fases: Fase[]) {
  const hijos = hijosPorPadre(fases);
  const hojas = new Map<string, number>();
  const contar = (id: string): number => {
    const h = hijos.get(id) || [];
    const n = h.length ? h.reduce((a, f) => a + contar(f.id), 0) : 1;
    hojas.set(id, n);
    return n;
  };
  const raiz = hijos.get('') || [];
  const totalHojas = Math.max(1, raiz.reduce((a, f) => a + contar(f.id), 0));
  const ancho = Math.max(RAIZ_W, totalHojas * (W + GAP_X) - GAP_X);
  const pos = new Map<string, Punto>();
  const ubicar = (lista: Fase[], x0: number, nivel: number) => {
    let x = x0;
    for (const f of lista) {
      const span = (hojas.get(f.id) || 1) * (W + GAP_X) - GAP_X;
      pos.set(f.id, { x: x + span / 2 - W / 2, y: MARGEN + RAIZ_H + GAP_Y + nivel * (H + GAP_Y) });
      ubicar(hijos.get(f.id) || [], x, nivel + 1);
      x += span + GAP_X;
    }
  };
  ubicar(raiz, MARGEN, 0);
  return { pos, raiz: { x: MARGEN + ancho / 2 - RAIZ_W / 2, y: MARGEN } };
}

export default function MapaFases({ proyecto, fases, tareas, onVerTareas }: Props) {
  const [editor, setEditor] = useState<Editor>(null);
  const [pending, start] = useTransition();
  const lienzo = useRef<HTMLDivElement>(null);
  // Posiciones mientras se arrastra (antes de guardarlas).
  const [temporal, setTemporal] = useState<Map<string, Punto>>(new Map());
  const arrastre = useRef<{ id: string; ids: string[]; inicio: Punto; origen: Map<string, Punto>; movio: boolean } | null>(null);
  const hijos = hijosPorPadre(fases);

  const auto = layoutAutomatico(fases);
  const posDe = (f: Fase): Punto => temporal.get(f.id) || (f.pos_x != null && f.pos_y != null ? { x: f.pos_x, y: f.pos_y } : auto.pos.get(f.id) || { x: MARGEN, y: MARGEN });
  const posiciones = new Map(fases.map((f) => [f.id, posDe(f)]));
  const libres = fases.some((f) => f.pos_x != null);

  const anchoLienzo = Math.max(auto.raiz.x + RAIZ_W, ...[...posiciones.values()].map((p) => p.x + W)) + MARGEN;
  const altoLienzo = Math.max(auto.raiz.y + RAIZ_H, ...[...posiciones.values()].map((p) => p.y + H)) + MARGEN;

  // En pantallas angostas, arrancar con el proyecto (la raíz) centrado.
  useEffect(() => {
    const el = lienzo.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = auto.raiz.x + RAIZ_W / 2 - el.clientWidth / 2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const a = { id: f.id, posicion: f.posicion };
    const b = { id: otro.id, posicion: otro.posicion === f.posicion ? f.posicion + dir : otro.posicion };
    start(() => intercambiarFases(a, b));
  }

  // ---------- Arrastrar cuadros (mouse o dedo). Se mueve la fase con todas sus subfases. ----------
  function alPresionar(e: React.PointerEvent, f: Fase) {
    if ((e.target as HTMLElement).closest('[data-accion]')) return;
    const ids = [...conDescendientes(fases, f.id)];
    arrastre.current = { id: f.id, ids, inicio: { x: e.clientX, y: e.clientY }, origen: new Map(ids.map((id) => [id, posiciones.get(id)!])), movio: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function alMover(e: React.PointerEvent) {
    const a = arrastre.current;
    if (!a) return;
    const dx = e.clientX - a.inicio.x;
    const dy = e.clientY - a.inicio.y;
    if (!a.movio && Math.hypot(dx, dy) < 5) return;
    a.movio = true;
    const sig = new Map<string, Punto>();
    for (const id of a.ids) {
      const o = a.origen.get(id)!;
      sig.set(id, { x: Math.max(0, o.x + dx), y: Math.max(RAIZ_H / 2, o.y + dy) });
    }
    setTemporal(sig);
  }
  function alSoltar(f: Fase) {
    const a = arrastre.current;
    arrastre.current = null;
    if (!a) return;
    if (!a.movio) return onVerTareas(f.id); // fue un clic: ver sus tareas
    const finales = temporal;
    // Las demás fases que seguían en automático se "congelan" donde están, para que no salten de lugar.
    const resto = fases.filter((x) => !finales.has(x.id) && x.pos_x == null).map((x) => ({ id: x.id, ...posiciones.get(x.id)! }));
    const cambios = [...[...finales.entries()].map(([id, p]) => ({ id, x: p.x, y: p.y })), ...resto];
    start(async () => {
      await guardarPosiciones(proyecto.id, cambios);
      setTemporal(new Map());
    });
  }

  // Se llama como función (no como componente) para que el cuadro no se vuelva a montar mientras se arrastra.
  function nodo(f: Fase) {
    const av = avanceFase(fases, tareas, f);
    const st = ESTILO[av.estado];
    const sub = hijos.get(f.id) || [];
    const hermanos = hijos.get(f.parent_id || '') || [];
    const i = hermanos.findIndex((x) => x.id === f.id);
    const p = posiciones.get(f.id)!;
    const moviendo = temporal.has(f.id);
    return (
      <div
        key={f.id}
        onPointerDown={(e) => alPresionar(e, f)}
        onPointerMove={alMover}
        onPointerUp={() => alSoltar(f)}
        onPointerCancel={() => {
          arrastre.current = null;
          setTemporal(new Map());
        }}
        style={{ left: p.x, top: p.y, width: W, height: H, touchAction: 'none' }}
        className={`absolute flex select-none flex-col rounded-2xl border-2 p-3 text-left shadow-sm transition-shadow ${st.caja} ${moviendo ? 'z-20 cursor-grabbing shadow-xl' : 'cursor-grab hover:shadow-md'}`}
        title="Arrastra para mover · Clic para ver sus tareas"
        role="group"
        aria-label={`Fase ${f.nombre}`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 min-w-0 break-words text-sm font-bold leading-snug">{f.nombre}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.chip}`}>{st.texto}</span>
        </div>
        <div className="mt-auto">
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/80">
              <div className={`h-full rounded-full ${st.barra}`} style={{ width: `${av.pct}%` }} />
            </div>
            <span className="text-[11px] font-bold">{av.total || av.estado === 'hecho' ? `${av.pct}%` : '—'}</span>
          </div>
          <p className="mt-1 truncate text-[11px] text-slate-500">
            {av.total ? `${av.hechas} de ${av.total} tareas` : 'Sin tareas'}
            {sub.length ? ` · ${sub.length} subfase${sub.length > 1 ? 's' : ''}` : ''}
            {!av.automatico && ' · a mano'}
          </p>
          <div className="mt-1.5 flex items-center gap-1 border-t border-black/5 pt-1.5" data-accion>
            <button type="button" onClick={() => setEditor({ modo: 'nueva', padre: f })} className="rounded-lg px-2 py-1 text-[11px] font-bold text-azul hover:bg-white" title="Agregar una subfase">+ Subfase</button>
            <button type="button" onClick={() => setEditor({ modo: 'editar', fase: f })} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-white">Editar</button>
            {!libres && (
              <span className="ml-auto flex">
                <button type="button" disabled={pending || i <= 0} onClick={() => mover(f, -1)} className="rounded-lg px-1.5 py-1 text-xs text-slate-500 hover:bg-white disabled:opacity-30" aria-label={`Mover ${f.nombre} a la izquierda`}>←</button>
                <button type="button" disabled={pending || i >= hermanos.length - 1} onClick={() => mover(f, 1)} className="rounded-lg px-1.5 py-1 text-xs text-slate-500 hover:bg-white disabled:opacity-30" aria-label={`Mover ${f.nombre} a la derecha`}>→</button>
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Líneas: del borde inferior del padre (o del proyecto) al borde superior de cada subfase.
  const linea = (a: Punto, aw: number, ah: number, b: Punto) => {
    const x1 = a.x + aw / 2, y1 = a.y + ah, x2 = b.x + W / 2, y2 = b.y;
    const my = (y1 + y2) / 2;
    return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
  };

  return (
    <div className="flex flex-1 flex-col px-4 py-5 sm:px-8">
      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs font-semibold">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-slate-300 bg-white" />Pendiente · {conteo.pendiente}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-azul bg-azul-suave" />En curso · {conteo.curso}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-turquesa bg-turquesa-suave" />Ejecutada · {conteo.hecho}</span>
        <span className="text-slate-500 sm:ml-auto">Arrastra los cuadros para acomodarlos · Clic para ver sus tareas</span>
        {libres && (
          <button type="button" disabled={pending} onClick={() => start(() => ordenarMapa(proyecto.id))} className="btn-suave min-h-0 py-1.5 text-xs">
            Ordenar automáticamente
          </button>
        )}
      </div>

      <div ref={lienzo} className="tarjeta flex-1 overflow-auto bg-[radial-gradient(circle,#E2E8F0_1px,transparent_1px)] [background-size:20px_20px]">
        <div className="relative" style={{ width: anchoLienzo, height: altoLienzo, minWidth: '100%' }}>
          <svg className="pointer-events-none absolute inset-0" width={anchoLienzo} height={altoLienzo} aria-hidden="true">
            {fases.map((f) => {
              const padre = f.parent_id ? fases.find((x) => x.id === f.parent_id) : null;
              const d = padre ? linea(posiciones.get(padre.id)!, W, H, posiciones.get(f.id)!) : linea(auto.raiz, RAIZ_W, RAIZ_H, posiciones.get(f.id)!);
              return <path key={f.id} d={d} fill="none" stroke="#CBD5E1" strokeWidth={2} />;
            })}
          </svg>

          <div className="absolute rounded-2xl bg-carbon p-4 text-white shadow-md" style={{ left: auto.raiz.x, top: auto.raiz.y, width: RAIZ_W, height: RAIZ_H }}>
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

          {fases.map((f) => nodo(f))}

          {fases.length === 0 && (
            <p className="absolute max-w-sm text-center text-sm text-slate-500" style={{ left: auto.raiz.x - 40, top: auto.raiz.y + RAIZ_H + 32, width: RAIZ_W + 80 }}>
              Aún no hay fases. Agrega la primera (por ejemplo «Diagnóstico» o «Diseño») y luego sus subfases.
            </p>
          )}
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

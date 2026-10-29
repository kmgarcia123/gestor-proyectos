'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { actualizarFase, crearFase, eliminarFase, guardarPosiciones, guardarPosicionProyecto, intercambiarFases, ordenarMapa } from '@/app/(app)/actions';
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
  // Posiciones ya soltadas que todavía no llegan de la base: se respetan para que el cuadro no "salte" atrás.
  const [fijas, setFijas] = useState<Map<string, Punto>>(new Map());
  const ultimas = useRef<Map<string, Punto>>(new Map());
  // Cuadro principal (proyecto): posición mientras se arrastra y la ya soltada que aún no llega de la base.
  const [raizTemporal, setRaizTemporal] = useState<Punto | null>(null);
  const [raizFija, setRaizFija] = useState<Punto | null>(null);
  const arrastreRaiz = useRef<{ inicio: Punto; origen: Punto; movio: boolean; ultima: Punto | null } | null>(null);
  const arrastre = useRef<{ id: string; ids: string[]; inicio: Punto; origen: Map<string, Punto>; movio: boolean } | null>(null);
  const hijos = hijosPorPadre(fases);

  const auto = layoutAutomatico(fases);
  const raiz: Punto =
    raizTemporal || raizFija || (proyecto.mapa_x != null && proyecto.mapa_y != null ? { x: proyecto.mapa_x, y: proyecto.mapa_y } : auto.raiz);
  const posDe = (f: Fase): Punto =>
    temporal.get(f.id) || fijas.get(f.id) || (f.pos_x != null && f.pos_y != null ? { x: f.pos_x, y: f.pos_y } : auto.pos.get(f.id) || { x: MARGEN, y: MARGEN });

  // Cuando la base ya trae la posición guardada, se suelta la copia local.
  useEffect(() => {
    if (!fijas.size) return;
    const sigue = new Map(fijas);
    for (const f of fases) {
      const p = sigue.get(f.id);
      if (p && f.pos_x != null && f.pos_y != null && Math.abs(f.pos_x - p.x) < 2 && Math.abs(f.pos_y - p.y) < 2) sigue.delete(f.id);
    }
    if (sigue.size !== fijas.size) setFijas(sigue);
  }, [fases, fijas]);
  const posiciones = new Map(fases.map((f) => [f.id, posDe(f)]));
  const libres = fases.some((f) => f.pos_x != null) || fijas.size > 0 || proyecto.mapa_x != null || raizFija !== null;

  useEffect(() => {
    if (raizFija && proyecto.mapa_x != null && proyecto.mapa_y != null && Math.abs(proyecto.mapa_x - raizFija.x) < 2 && Math.abs(proyecto.mapa_y - raizFija.y) < 2) setRaizFija(null);
  }, [proyecto.mapa_x, proyecto.mapa_y, raizFija]);

  function raizPresionar(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('[data-accion]')) return;
    arrastreRaiz.current = { inicio: { x: e.clientX, y: e.clientY }, origen: raiz, movio: false, ultima: null };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function raizMover(e: React.PointerEvent) {
    const a = arrastreRaiz.current;
    if (!a) return;
    const dx = e.clientX - a.inicio.x;
    const dy = e.clientY - a.inicio.y;
    if (!a.movio && Math.hypot(dx, dy) < 5) return;
    a.movio = true;
    a.ultima = { x: Math.round(Math.max(0, a.origen.x + dx)), y: Math.round(Math.max(0, a.origen.y + dy)) };
    setRaizTemporal(a.ultima);
  }
  function raizSoltar() {
    const a = arrastreRaiz.current;
    arrastreRaiz.current = null;
    if (!a || !a.movio || !a.ultima) return;
    const p = a.ultima;
    setRaizFija(p);
    setRaizTemporal(null);
    guardarPosicionProyecto(proyecto.id, p.x, p.y).catch(() => setRaizFija(null));
  }

  const anchoLienzo = Math.max(raiz.x + RAIZ_W, ...[...posiciones.values()].map((p) => p.x + W)) + MARGEN;
  const altoLienzo = Math.max(raiz.y + RAIZ_H, ...[...posiciones.values()].map((p) => p.y + H)) + MARGEN;

  // En pantallas angostas, arrancar con el proyecto (la raíz) centrado.
  useEffect(() => {
    const el = lienzo.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = raiz.x + RAIZ_W / 2 - el.clientWidth / 2;
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
      sig.set(id, { x: Math.round(Math.max(0, o.x + dx)), y: Math.round(Math.max(RAIZ_H / 2, o.y + dy)) });
    }
    ultimas.current = sig;
    setTemporal(sig);
  }
  function alSoltar(f: Fase) {
    const a = arrastre.current;
    arrastre.current = null;
    if (!a) return;
    if (!a.movio) return onVerTareas(f.id); // fue un clic: ver sus tareas
    const finales = ultimas.current;
    // Las demás fases que seguían en automático se "congelan" donde están, para que no salten de lugar.
    const resto = fases.filter((x) => !finales.has(x.id) && x.pos_x == null).map((x) => ({ id: x.id, ...posiciones.get(x.id)! }));
    const cambios = [...[...finales.entries()].map(([id, p]) => ({ id, x: p.x, y: p.y })), ...resto];
    // Queda donde se soltó de inmediato; se guarda en segundo plano.
    setFijas((prev) => {
      const m = new Map(prev);
      cambios.forEach((c) => m.set(c.id, { x: Math.round(c.x), y: Math.round(c.y) }));
      return m;
    });
    setTemporal(new Map());
    ultimas.current = new Map();
    guardarPosiciones(proyecto.id, cambios).catch(() => {
      setFijas((prev) => {
        const m = new Map(prev);
        cambios.forEach((c) => m.delete(c.id));
        return m;
      });
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
          <button type="button" disabled={pending} onClick={() => (setFijas(new Map()), setRaizFija(null), start(() => ordenarMapa(proyecto.id)))} className="btn-ghost min-h-0 py-1.5 text-xs">
            Ordenar automáticamente
          </button>
        )}
      </div>

      <div ref={lienzo} className="tarjeta flex-1 overflow-auto bg-[radial-gradient(circle,#E2E8F0_1px,transparent_1px)] [background-size:20px_20px]">
        <div className="relative" style={{ width: anchoLienzo, height: altoLienzo, minWidth: '100%' }}>
          <svg className="pointer-events-none absolute inset-0" width={anchoLienzo} height={altoLienzo} aria-hidden="true">
            {fases.map((f) => {
              const padre = f.parent_id ? fases.find((x) => x.id === f.parent_id) : null;
              const d = padre ? linea(posiciones.get(padre.id)!, W, H, posiciones.get(f.id)!) : linea(raiz, RAIZ_W, RAIZ_H, posiciones.get(f.id)!);
              return <path key={f.id} d={d} fill="none" stroke="#CBD5E1" strokeWidth={2} />;
            })}
          </svg>

          <div
            onPointerDown={raizPresionar}
            onPointerMove={raizMover}
            onPointerUp={raizSoltar}
            onPointerCancel={() => {
              arrastreRaiz.current = null;
              setRaizTemporal(null);
            }}
            className={`absolute select-none rounded-2xl bg-carbon p-4 text-white shadow-md ${raizTemporal ? 'z-30 cursor-grabbing shadow-xl' : 'z-10 cursor-grab'}`}
            style={{ left: raiz.x, top: raiz.y, width: RAIZ_W, height: RAIZ_H, touchAction: 'none' }}
            title="Arrastra para mover"
          >
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
            <button type="button" data-accion onClick={() => setEditor({ modo: 'nueva', padre: null })} className="mt-3 w-full rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/20">
              + Agregar fase
            </button>
          </div>

          {fases.map((f) => nodo(f))}

          {fases.length === 0 && (
            <p className="absolute max-w-sm text-center text-sm text-slate-500" style={{ left: raiz.x - 40, top: raiz.y + RAIZ_H + 32, width: RAIZ_W + 80 }}>
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
          {confirmar && editor.modo === 'editar' ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4" role="alertdialog" aria-label="Confirmar eliminación">
              <p className="text-sm text-red-800">
                Se elimina «{editor.fase.nombre}»{sub ? ` y ${sub} subfase${sub > 1 ? 's' : ''}` : ''}. Sus tareas no se borran: quedan «sin fase».
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={borrar} disabled={pending} className="btn-destructivo bg-white">
                  {pending ? 'Eliminando…' : sub ? `Eliminar fase y ${sub} subfase${sub > 1 ? 's' : ''}` : 'Eliminar fase definitivamente'}
                </button>
                <button type="button" onClick={() => setConfirmar(false)} className="btn-ghost">Conservar fase</button>
              </div>
            </div>
          ) : (
            <div className="pie-acciones">
              <button type="submit" disabled={pending} className="btn-primario">{pending ? 'Guardando…' : editor.modo === 'editar' ? 'Guardar cambios' : 'Crear fase'}</button>
              <button type="button" onClick={() => ref.current?.close()} className="btn-ghost">{editor.modo === 'editar' ? 'Cerrar sin guardar' : 'Cerrar sin crear'}</button>
              {editor.modo === 'editar' && (
                <div className="separador-destructivo">
                  <button type="button" onClick={borrar} disabled={pending} className="btn-destructivo">Eliminar fase</button>
                </div>
              )}
            </div>
          )}
        </form>
      )}
    </dialog>
  );
}

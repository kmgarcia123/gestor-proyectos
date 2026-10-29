'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import SelectorResponsables from '@/components/SelectorResponsables';
import { aplanar } from '@/lib/fases';
import { ESTADOS, type Estado, type Fase, type Perfil } from '@/lib/types';

export interface DatosNuevaTarea {
  titulo: string;
  responsables: string[];
  fecha_limite: string | null;
  fase_id: string | null;
}

interface Props {
  abierta: { estado: Estado; titulo: string } | null;
  equipo: Perfil[];
  yoId: string;
  fases: Fase[];
  /** Fase con la que arranca la ficha (la del filtro del tablero, si hay); si no, «Sin fase». */
  faseInicial?: string;
  onCerrar: () => void;
  /** Crea la tarea. Si «abrir» es true, después se abre el detalle completo. */
  onCrear: (datos: DatosNuevaTarea, abrir: boolean) => Promise<void>;
}

/** Ficha corta para crear una tarea: nombre, responsables y fecha límite. */
export default function NuevaTareaRapida({ abierta, equipo, yoId, fases, faseInicial, onCerrar, onCrear }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [titulo, setTitulo] = useState('');
  const [responsables, setResponsables] = useState<string[]>([yoId]);
  const [fecha, setFecha] = useState('');
  const [fase, setFase] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierta) {
      setTitulo(abierta.titulo);
      setResponsables([yoId]);
      setFecha('');
      setFase(faseInicial || '');
      setError('');
      if (!d.open) d.showModal();
    } else if (d.open) d.close();
  }, [abierta, yoId, faseInicial]);

  function crear(abrir: boolean) {
    const t = titulo.trim();
    if (!t) return setError('Escribe el nombre de la tarea.');
    start(async () => {
      try {
        await onCrear({ titulo: t, responsables, fecha_limite: fecha || null, fase_id: fase || null }, abrir);
        ref.current?.close();
      } catch {
        setError('No se pudo crear la tarea. Revisa tu conexión.');
      }
    });
  }

  const columna = ESTADOS.find((e) => e.id === abierta?.estado)?.nombre;

  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      className="w-[min(480px,94vw)] rounded-3xl p-0 backdrop:bg-carbon/60 backdrop:backdrop-blur-sm max-sm:mb-0 max-sm:mt-auto max-sm:w-full max-sm:max-w-full max-sm:rounded-b-none"
      aria-labelledby="ntr-titulo"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          crear(false);
        }}
        className="flex flex-col gap-4 p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="ntr-titulo" className="text-lg font-extrabold">Nueva tarea</h2>
            <p className="text-xs text-slate-500">En «{columna}»</p>
          </div>
          <button type="button" onClick={() => ref.current?.close()} className="btn-icono" aria-label="Cerrar">✕</button>
        </div>

        <div>
          <label className="etiqueta" htmlFor="ntr-nombre">Nombre de la tarea</label>
          <input id="ntr-nombre" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} autoFocus className="campo text-base" placeholder="Ej.: Enviar cotización a Torres del Parque" />
        </div>

        <div>
          <p className="etiqueta">¿A quién se le asigna?</p>
          <SelectorResponsables equipo={equipo} valor={responsables} onCambio={setResponsables} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="etiqueta" htmlFor="ntr-fecha">Fecha límite</label>
            <input id="ntr-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="campo" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="ntr-fase">Fase</label>
            <select id="ntr-fase" value={fase} onChange={(e) => setFase(e.target.value)} className="campo">
              <option value="">Sin fase</option>
              {aplanar(fases).map(({ f, nivel }) => (
                <option key={f.id} value={f.id}>{'\u00A0\u00A0'.repeat(nivel) + (nivel ? '└ ' : '') + f.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}

        <div className="pie-acciones">
          <button type="submit" disabled={pending} className="btn-primario">{pending ? 'Creando…' : 'Crear tarea'}</button>
          <button type="button" onClick={() => crear(true)} disabled={pending} className="btn-suave">Crear y ver detalle</button>
          <button type="button" onClick={() => ref.current?.close()} className="btn-ghost">Cerrar sin crear</button>
        </div>
        {responsables.some((r) => r !== yoId) && <p className="-mt-2 text-xs text-slate-500">A los responsables les llega un aviso al crearla.</p>}
      </form>
    </dialog>
  );
}

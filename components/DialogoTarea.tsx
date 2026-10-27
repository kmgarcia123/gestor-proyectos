'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { actualizarTarea, eliminarTarea, type CambiosTarea } from '@/app/(app)/actions';
import { ESTADOS, PRIORIDADES, type Fase, type Perfil, type Tarea } from '@/lib/types';

interface Props {
  tarea: Tarea | null;
  equipo: Perfil[];
  fases: Fase[];
  onCerrar: () => void;
  onGuardada: (t: Tarea) => void;
  onEliminada: (id: string) => void;
}

export default function DialogoTarea({ tarea, equipo, fases, onCerrar, onGuardada, onEliminada }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<Tarea | null>(tarea);
  const [pending, start] = useTransition();
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(tarea);
    setError('');
    const d = ref.current;
    if (!d) return;
    if (tarea && !d.open) d.showModal();
    if (!tarea && d.open) d.close();
  }, [tarea]);

  if (!form) return <dialog ref={ref} onClose={onCerrar} />;

  const set = <K extends keyof Tarea>(k: K, v: Tarea[K]) => setForm({ ...form, [k]: v });

  function guardar() {
    if (!form || !tarea) return;
    const cambios: CambiosTarea = {
      titulo: form.titulo,
      descripcion: form.descripcion,
      estado: form.estado,
      prioridad: form.prioridad,
      responsable_id: form.responsable_id,
      fecha_limite: form.fecha_limite,
      fase_id: form.fase_id
    };
    start(async () => {
      try {
        await actualizarTarea(tarea.id, cambios);
        onGuardada(form);
        ref.current?.close();
      } catch {
        setError('No se pudo guardar. Revisa tu conexión e intenta de nuevo.');
      }
    });
  }

  function borrar() {
    if (!tarea) return;
    start(async () => {
      await eliminarTarea(tarea.id);
      onEliminada(tarea.id);
      ref.current?.close();
    });
  }

  return (
    <dialog ref={ref} onClose={onCerrar} className="w-[min(620px,94vw)] rounded-3xl p-0 backdrop:bg-carbon/60 backdrop:backdrop-blur-sm" aria-labelledby="dt-titulo">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
        className="flex flex-col gap-4 p-6"
      >
        <div className="flex items-start gap-3">
          <label htmlFor="dt-titulo" className="sr-only">Título</label>
          <input id="dt-titulo" value={form.titulo} onChange={(e) => set('titulo', e.target.value)} required maxLength={200} className="w-full rounded-lg border-0 bg-transparent px-0 text-xl font-extrabold tracking-tight focus:ring-0" />
          <button type="button" onClick={() => ref.current?.close()} className="btn-suave h-9 min-h-0 w-9 shrink-0 px-0" aria-label="Cerrar">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <label className="etiqueta" htmlFor="dt-estado">Estado</label>
            <select id="dt-estado" value={form.estado} onChange={(e) => set('estado', e.target.value as Tarea['estado'])} className="campo">
              {ESTADOS.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="etiqueta" htmlFor="dt-prio">Prioridad</label>
            <select id="dt-prio" value={form.prioridad} onChange={(e) => set('prioridad', e.target.value as Tarea['prioridad'])} className="campo">
              {PRIORIDADES.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="etiqueta" htmlFor="dt-fecha">Fecha límite</label>
            <input id="dt-fecha" type="date" value={form.fecha_limite || ''} onChange={(e) => set('fecha_limite', e.target.value || null)} className="campo" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="dt-resp">Responsable</label>
            <select id="dt-resp" value={form.responsable_id || ''} onChange={(e) => set('responsable_id', e.target.value || null)} className="campo">
              <option value="">Sin asignar</option>
              {equipo.map((m) => <option key={m.id} value={m.id}>{m.nombre || m.email}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="etiqueta" htmlFor="dt-fase">Fase</label>
            <select id="dt-fase" value={form.fase_id || ''} onChange={(e) => set('fase_id', e.target.value || null)} className="campo">
              <option value="">Sin fase</option>
              {fases.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="etiqueta" htmlFor="dt-desc">Descripción</label>
          <textarea id="dt-desc" rows={5} value={form.descripcion || ''} onChange={(e) => set('descripcion', e.target.value)} className="campo" placeholder="Detalles, enlaces, criterios de terminado…" />
        </div>

        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={borrar} disabled={pending} className="btn-peligro">Eliminar</button>
          <div className="flex gap-2">
            <button type="button" onClick={() => ref.current?.close()} className="btn-suave">Cancelar</button>
            <button type="submit" disabled={pending} className="btn-primario">{pending ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </div>
      </form>
    </dialog>
  );
}

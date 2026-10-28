'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { actualizarTarea, eliminarTarea, recordarAhora, type CambiosTarea } from '@/app/(app)/actions';
import SelectorResponsables from '@/components/SelectorResponsables';
import { aplanar } from '@/lib/fases';
import { ESTADOS, PRIORIDADES, type Fase, type Perfil, type Tarea } from '@/lib/types';

interface Props {
  tarea: Tarea | null;
  equipo: Perfil[];
  fases: Fase[];
  onCerrar: () => void;
  onGuardada: (t: Tarea) => void;
  onEliminada: (id: string) => void;
}

/** ISO (UTC) → valor para <input type="datetime-local"> en la hora del navegador. */
function aLocal(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
}

export default function DialogoTarea({ tarea, equipo, fases, onCerrar, onGuardada, onEliminada }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<Tarea | null>(tarea);
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, startEnvio] = useTransition();

  useEffect(() => {
    setForm(tarea);
    setError('');
    setAviso(null);
    const d = ref.current;
    if (!d) return;
    if (tarea && !d.open) d.showModal();
    if (!tarea && d.open) d.close();
  }, [tarea]);

  if (!form) return <dialog ref={ref} onClose={onCerrar} />;

  const set = <K extends keyof Tarea>(k: K, v: Tarea[K]) => setForm({ ...form, [k]: v });

  function guardar() {
    if (!form || !tarea) return;
    if (form.fecha_inicio && form.fecha_limite && form.fecha_inicio > form.fecha_limite) {
      setError('La fecha de inicio no puede ser después de la fecha límite.');
      return;
    }
    const cambios: CambiosTarea = {
      titulo: form.titulo,
      descripcion: form.descripcion,
      estado: form.estado,
      prioridad: form.prioridad,
      responsables: form.responsables || [],
      fecha_inicio: form.fecha_inicio || null,
      fecha_limite: form.fecha_limite,
      fase_id: form.fase_id,
      recordar_en: form.recordar_en || null,
      mensaje_recordatorio: form.mensaje_recordatorio || null
    };
    start(async () => {
      try {
        await actualizarTarea(tarea.id, cambios);
        onGuardada({ ...form, responsable_id: (form.responsables || [])[0] || null });
        ref.current?.close();
      } catch {
        setError('No se pudo guardar. Revisa tu conexión e intenta de nuevo.');
      }
    });
  }

  function enviarAhora() {
    if (!tarea || !form) return;
    setAviso(null);
    startEnvio(async () => {
      try {
        setAviso(await recordarAhora(tarea.id, form.mensaje_recordatorio || ''));
      } catch {
        setAviso({ ok: false, texto: 'No se pudo enviar. Intenta de nuevo.' });
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
            <label className="etiqueta" htmlFor="dt-fase">Fase</label>
            <select id="dt-fase" value={form.fase_id || ''} onChange={(e) => set('fase_id', e.target.value || null)} className="campo">
              <option value="">Sin fase</option>
              {aplanar(fases).map(({ f, nivel }) => <option key={f.id} value={f.id}>{'\u00A0\u00A0'.repeat(nivel) + (nivel ? '└ ' : '') + f.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="etiqueta" htmlFor="dt-inicio">Fecha de inicio</label>
            <input id="dt-inicio" type="date" value={form.fecha_inicio || ''} max={form.fecha_limite || undefined} onChange={(e) => set('fecha_inicio', e.target.value || null)} className="campo" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="dt-fecha">Fecha límite</label>
            <input id="dt-fecha" type="date" value={form.fecha_limite || ''} min={form.fecha_inicio || undefined} onChange={(e) => set('fecha_limite', e.target.value || null)} className="campo" />
          </div>
        </div>

        <div>
          <p className="etiqueta">Responsables</p>
          <SelectorResponsables equipo={equipo} valor={form.responsables || []} onCambio={(ids) => set('responsables', ids)} />
        </div>

        <div>
          <label className="etiqueta" htmlFor="dt-desc">Descripción</label>
          <textarea id="dt-desc" rows={5} value={form.descripcion || ''} onChange={(e) => set('descripcion', e.target.value)} className="campo" placeholder="Detalles, enlaces, criterios de terminado…" />
        </div>

        <fieldset className="rounded-2xl border border-nube bg-fondo p-4">
          <legend className="px-1 text-sm font-bold">🔔 Recordatorio</legend>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <label className="etiqueta" htmlFor="dt-msg">Mensaje para los responsables</label>
              <input id="dt-msg" value={form.mensaje_recordatorio || ''} onChange={(e) => set('mensaje_recordatorio', e.target.value)} maxLength={300} className="campo" placeholder="Ej.: Por favor haz la tarea antes del viernes 🙏" />
            </div>
            <div>
              <label className="etiqueta" htmlFor="dt-recordar">Recordar el</label>
              <input
                id="dt-recordar"
                type="datetime-local"
                value={aLocal(form.recordar_en)}
                onChange={(e) => set('recordar_en', e.target.value ? new Date(e.target.value).toISOString() : null)}
                className="campo"
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={enviarAhora} disabled={enviando || !(form.responsables || []).length} className="btn-suave">
              {enviando ? 'Enviando…' : 'Recordar ahora'}
            </button>
            <p className="text-xs text-slate-500">
              {(form.responsables || []).length ? 'Les llega a los responsables por correo y/o WhatsApp, según lo que cada uno activó en «Mis notificaciones». «Recordar el» se guarda con el botón Guardar.' : 'Asigna al menos un responsable para poder enviarle recordatorios.'}
            </p>
          </div>
          {aviso && (
            <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm font-medium ${aviso.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{aviso.texto}</p>
          )}
        </fieldset>

        <p className="text-xs text-slate-500">
          Creada el {new Date(form.creado_en).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
          {form.creado_por && equipo.find((m) => m.id === form.creado_por) ? ` por ${(equipo.find((m) => m.id === form.creado_por)!.nombre || equipo.find((m) => m.id === form.creado_por)!.email).split(' ')[0]}` : ''}
        </p>

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

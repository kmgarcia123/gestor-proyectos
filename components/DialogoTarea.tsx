'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { actualizarTarea, eliminarTarea, guardarPasos, recordarAhora, type CambiosTarea } from '@/app/(app)/actions';
import ListaPasos from '@/components/ListaPasos';
import Adjuntos from '@/components/Adjuntos';
import EditorTexto from '@/components/EditorTexto';
import { ESTILO_ESTADO, ESTILO_PRIORIDAD, IconoEstado, IconoPrioridad } from '@/components/Iconos';
import SelectorResponsables from '@/components/SelectorResponsables';
import { aplanar } from '@/lib/fases';
import { ESTADOS, PRIORIDADES, type Fase, type Paso, type Perfil, type Tarea } from '@/lib/types';

interface Props {
  tarea: Tarea | null;
  equipo: Perfil[];
  fases: Fase[];
  onCerrar: () => void;
  onGuardada: (t: Tarea) => void;
  /** Cambios que se guardan al instante (pasos, adjuntos) sin cerrar la tarea. */
  onParcial: (id: string, cambios: Partial<Tarea>) => void;
  onEliminada: (id: string) => void;
}

/** ISO (UTC) → valor para <input type="datetime-local"> en la hora del navegador. */
function aLocal(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
}

export default function DialogoTarea({ tarea, equipo, fases, onCerrar, onGuardada, onParcial, onEliminada }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<Tarea | null>(tarea);
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, startEnvio] = useTransition();

  useEffect(() => {
    setForm(tarea);
    setError('');
    setAviso(null);
    setConfirmarBorrado(false);
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

  function cambiarPasos(pasos: Paso[]) {
    if (!tarea || !form) return;
    const anterior = form.pasos || [];
    setForm({ ...form, pasos });
    onParcial(tarea.id, { pasos });
    guardarPasos(tarea.id, pasos).catch(() => {
      setForm((f) => (f ? { ...f, pasos: anterior } : f));
      onParcial(tarea.id, { pasos: anterior });
      setError('No se pudo guardar la lista de pasos. Revisa tu conexión.');
    });
  }

  function borrar() {
    if (!tarea) return;
    // Lo que no tiene vuelta atrás pide un segundo toque que dice exactamente qué va a pasar.
    if (!confirmarBorrado) return setConfirmarBorrado(true);
    start(async () => {
      await eliminarTarea(tarea.id);
      onEliminada(tarea.id);
      ref.current?.close();
    });
  }

  return (
    <dialog ref={ref} onClose={onCerrar} className="w-[min(620px,94vw)] rounded-3xl p-0 backdrop:bg-carbon/60 backdrop:backdrop-blur-sm max-sm:m-0 max-sm:h-full max-sm:max-h-full max-sm:w-full max-sm:max-w-full max-sm:rounded-none" aria-labelledby="dt-titulo">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
        className="flex flex-col gap-4 p-5 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <label htmlFor="dt-titulo" className="sr-only">Título</label>
          <input id="dt-titulo" value={form.titulo} onChange={(e) => set('titulo', e.target.value)} required maxLength={200} className="w-full rounded-lg border-0 bg-transparent px-0 text-xl font-extrabold tracking-tight focus:ring-0" />
          <button type="button" onClick={() => ref.current?.close()} className="btn-icono" aria-label="Cerrar">✕</button>
        </div>

        <div>
          <p className="etiqueta">Estado</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Estado">
            {ESTADOS.map((e) => (
              <button
                key={e.id}
                type="button"
                role="radio"
                aria-checked={form.estado === e.id}
                onClick={() => set('estado', e.id)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2 text-xs font-bold transition ${form.estado === e.id ? ESTILO_ESTADO[e.id].activo : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
              >
                <span className={form.estado === e.id ? '' : ESTILO_ESTADO[e.id].punto}><IconoEstado e={e.id} size={16} /></span>
                {e.nombre}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="etiqueta">Prioridad</p>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Prioridad">
            {PRIORIDADES.map((pr) => (
              <button
                key={pr.id}
                type="button"
                role="radio"
                aria-checked={form.prioridad === pr.id}
                onClick={() => set('prioridad', pr.id)}
                className={`flex items-center justify-center gap-1 rounded-xl border-2 px-1.5 py-2 text-xs font-bold transition ${form.prioridad === pr.id ? ESTILO_PRIORIDAD[pr.id].activo : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
              >
                <IconoPrioridad p={pr.id} size={15} />
                {pr.nombre}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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

        <ListaPasos key={`pasos-${tarea?.id}`} pasos={form.pasos || []} onCambio={cambiarPasos} />

        {tarea && <Adjuntos key={`adjuntos-${tarea.id}`} tareaId={tarea.id} workspaceId={tarea.workspace_id} onTotal={(n) => onParcial(tarea.id, { adjuntos_total: n })} />}

        <div>
          <label className="etiqueta" htmlFor="dt-desc">Descripción</label>
          <EditorTexto key={`editor-${tarea?.id}`} id="dt-desc" valor={form.descripcion || ''} onCambio={(html) => set('descripcion', html)} placeholder="Detalles, enlaces, criterios de terminado…" />
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

        <div className="flex flex-col gap-0.5 text-xs text-slate-500 sm:flex-row sm:flex-wrap sm:gap-x-4">
          <p>
            Creada el {new Date(form.creado_en).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
            {form.creado_por && equipo.find((m) => m.id === form.creado_por) ? ` por ${(equipo.find((m) => m.id === form.creado_por)!.nombre || equipo.find((m) => m.id === form.creado_por)!.email).split(' ')[0]}` : ''}
          </p>
          {form.actualizado_en && Math.abs(new Date(form.actualizado_en).getTime() - new Date(form.creado_en).getTime()) > 60_000 && (
            <p>
              Última modificación: {new Date(form.actualizado_en).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
              {form.actualizado_por && equipo.find((m) => m.id === form.actualizado_por) ? ` por ${(equipo.find((m) => m.id === form.actualizado_por)!.nombre || equipo.find((m) => m.id === form.actualizado_por)!.email).split(' ')[0]}` : ''}
            </p>
          )}
        </div>

        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}

        {confirmarBorrado ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4" role="alertdialog" aria-label="Confirmar eliminación">
            <p className="text-sm text-red-800">
              Se elimina «{form.titulo}»{(tarea?.adjuntos_total || 0) > 0 ? ' con sus archivos adjuntos' : ''}. Esto no se puede deshacer.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={borrar} disabled={pending} className="btn-destructivo bg-white">
                {pending ? 'Eliminando…' : 'Eliminar tarea definitivamente'}
              </button>
              <button type="button" onClick={() => setConfirmarBorrado(false)} className="btn-ghost">Conservar tarea</button>
            </div>
          </div>
        ) : (
          <div className="pie-acciones">
            <button type="submit" disabled={pending} className="btn-primario">{pending ? 'Guardando…' : 'Guardar cambios'}</button>
            <button type="button" onClick={() => ref.current?.close()} className="btn-ghost">Cerrar sin guardar</button>
            <div className="separador-destructivo">
              <button type="button" onClick={borrar} disabled={pending} className="btn-destructivo">Eliminar tarea</button>
            </div>
          </div>
        )}
      </form>
    </dialog>
  );
}

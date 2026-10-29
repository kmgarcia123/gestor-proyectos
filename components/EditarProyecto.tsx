'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { actualizarProyecto, solicitarCambioNombre, solicitarEliminacion } from '@/app/(app)/actions';
import { COLORES_PROYECTO, type Proyecto } from '@/lib/types';

/** Editar el proyecto: descripción y color se guardan al instante; el nombre pasa por aprobación del equipo. */
export default function EditarProyecto({ proyecto, totalEquipo, hayPendiente, eliminacionPendiente = false }: { proyecto: Proyecto; totalEquipo: number; hayPendiente: boolean; eliminacionPendiente?: boolean }) {
  const router = useRouter();
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const [nombre, setNombre] = useState(proyecto.nombre);
  const [descripcion, setDescripcion] = useState(proyecto.descripcion || '');
  const [color, setColor] = useState(proyecto.color);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pending, start] = useTransition();

  function abrir() {
    setNombre(proyecto.nombre);
    setDescripcion(proyecto.descripcion || '');
    setColor(proyecto.color);
    setAviso(null);
    setConfirmarBorrar(false);
    ref.current?.showModal();
  }

  function guardar() {
    start(async () => {
      try {
        await actualizarProyecto(proyecto.id, { descripcion, color });
        const cambioNombre = nombre.trim() && nombre.trim() !== proyecto.nombre;
        if (cambioNombre) {
          const r = await solicitarCambioNombre(proyecto.id, nombre.trim());
          setAviso(r);
          if (!r.ok) return;
          setTimeout(() => ref.current?.close(), 1800);
        } else {
          ref.current?.close();
        }
      } catch {
        setAviso({ ok: false, texto: 'No se pudo guardar. Revisa tu conexión.' });
      }
    });
  }

  function pedirEliminacion() {
    start(async () => {
      try {
        const r = await solicitarEliminacion('proyecto', proyecto.id);
        setConfirmarBorrar(false);
        if (r.estado === 'aprobada') {
          ref.current?.close();
          router.push('/');
          return;
        }
        setAviso({ ok: r.estado === 'pendiente', texto: r.texto });
      } catch {
        setAviso({ ok: false, texto: 'No se pudo enviar la solicitud. Revisa tu conexión.' });
      }
    });
  }

  const cambiaNombre = nombre.trim() !== proyecto.nombre;

  return (
    <>
      <button type="button" onClick={abrir} className="rounded-lg p-1.5 text-slate-400 hover:bg-nube hover:text-azul" aria-label="Editar proyecto" title="Editar nombre, descripción y color">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
      </button>
      <dialog ref={ref} className="w-[min(520px,94vw)] rounded-3xl p-0 backdrop:bg-carbon/60 backdrop:backdrop-blur-sm" aria-labelledby="ep-titulo">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
          className="flex flex-col gap-4 p-6"
        >
          <div className="flex items-start justify-between">
            <h2 id="ep-titulo" className="text-xl font-extrabold tracking-tight">Editar proyecto</h2>
            <button type="button" onClick={() => ref.current?.close()} className="btn-icono" aria-label="Cerrar">✕</button>
          </div>
          <div>
            <label className="etiqueta" htmlFor="ep-nombre">Nombre</label>
            <input id="ep-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} required className="campo" disabled={hayPendiente} />
            <p className={`mt-1.5 text-xs ${cambiaNombre ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>
              {hayPendiente
                ? 'Ya hay un cambio de nombre esperando aprobación.'
                : cambiaNombre
                  ? `El nombre cambia cuando lo aprueben los ${totalEquipo} miembros del equipo. Les llega un aviso.`
                  : `Cambiar el nombre necesita la aprobación de los ${totalEquipo} miembros del equipo.`}
            </p>
          </div>
          <div>
            <label className="etiqueta" htmlFor="ep-desc">Descripción</label>
            <textarea id="ep-desc" rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={1000} className="campo" placeholder="De qué se trata el proyecto, cliente, alcance…" />
          </div>
          <div>
            <p className="etiqueta">Color</p>
            <div className="flex gap-2">
              {COLORES_PROYECTO.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Color ${c}`} aria-pressed={color === c} className={`h-8 w-8 rounded-full ring-offset-2 transition ${color === c ? 'ring-2 ring-carbon' : ''}`} style={{ background: c }} />
              ))}
            </div>
          </div>
          {aviso && <p role="status" className={`rounded-xl px-3 py-2 text-sm font-medium ${aviso.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{aviso.texto}</p>}
          <div className="pie-acciones">
            <button type="submit" disabled={pending} className="btn-primario">{pending ? 'Guardando…' : cambiaNombre ? 'Guardar y pedir aprobación' : 'Guardar cambios'}</button>
            <button type="button" onClick={() => ref.current?.close()} className="btn-ghost">Cerrar sin guardar</button>
            <div className="separador-destructivo">
              {eliminacionPendiente ? (
                <span className="text-xs font-semibold text-red-700">Eliminación pendiente: se vota en el aviso rojo</span>
              ) : (
                <button type="button" onClick={() => setConfirmarBorrar(true)} disabled={pending} className="btn-destructivo">Eliminar proyecto</button>
              )}
            </div>
          </div>
          {confirmarBorrar && (
            <div role="alertdialog" aria-labelledby="ep-borrar" className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p id="ep-borrar" className="text-sm font-bold text-red-800">¿Pedir que se elimine «{proyecto.nombre}»?</p>
              <p className="mt-1 text-sm text-red-700">
                Se borran el proyecto, sus fases, tareas y archivos.
                {totalEquipo > 1 ? ` Solo pasa cuando lo aprueben los ${totalEquipo} miembros del equipo; a los demás les llega un aviso.` : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={pedirEliminacion} disabled={pending} className="btn-destructivo bg-white">
                  {pending ? 'Enviando…' : totalEquipo > 1 ? 'Pedir eliminación del proyecto' : 'Eliminar proyecto definitivamente'}
                </button>
                <button type="button" onClick={() => setConfirmarBorrar(false)} className="btn-ghost">Conservar proyecto</button>
              </div>
            </div>
          )}
        </form>
      </dialog>
    </>
  );
}

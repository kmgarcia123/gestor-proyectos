'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Avatar from '@/components/Avatar';
import { votarEliminacion } from '@/app/(app)/actions';
import type { Perfil } from '@/lib/types';

export interface PendienteEliminar {
  id: string;
  tipo: 'proyecto' | 'fase' | 'tarea';
  objeto_id: string;
  nombre: string;
  proyecto_id: string | null;
  solicitado_por: string | null;
  aprobaciones: string[];
}

const QUE: Record<PendienteEliminar['tipo'], string> = { proyecto: 'el proyecto', fase: 'la fase', tarea: 'la tarea' };

/** Aviso de una eliminación pendiente: quién la pidió, quién ya aprobó y los botones para votar. */
export default function SolicitudEliminacion({ s, equipo, yoId, detalle }: { s: PendienteEliminar; equipo: Perfil[]; yoId: string; detalle?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const router = useRouter();
  const nombre = (id: string | null) => {
    const p = equipo.find((m) => m.id === id);
    return p ? (p.nombre || p.email).split(' ')[0] : 'Alguien';
  };
  const yaAprobe = s.aprobaciones.includes(yoId);
  const soyQuienPide = s.solicitado_por === yoId;
  const faltan = equipo.filter((m) => !s.aprobaciones.includes(m.id));

  const votar = (aprueba: boolean) =>
    start(async () => {
      try {
        setError('');
        const estado = await votarEliminacion(s.id, aprueba);
        // Si se borró el proyecto que estoy viendo, vuelvo al inicio.
        if (estado === 'aprobada' && s.tipo === 'proyecto') router.push('/');
      } catch {
        setError('No se pudo registrar. Intenta de nuevo.');
      }
    });

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm sm:flex-row sm:items-center" role="status">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-red-900">
          {nombre(s.solicitado_por)} pide eliminar {QUE[s.tipo]} <strong>«{s.nombre}»</strong>
          {detalle ? <span className="font-normal text-red-800"> · {detalle}</span> : null}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-red-800">
          <span className="font-bold">Aprobado {s.aprobaciones.length}/{equipo.length}</span>
          <span className="flex -space-x-1">
            {equipo.map((m) => (
              <span key={m.id} className={s.aprobaciones.includes(m.id) ? '' : 'opacity-30 grayscale'} title={`${nombre(m.id)}: ${s.aprobaciones.includes(m.id) ? 'aprobó' : 'pendiente'}`}>
                <Avatar perfil={m} size={22} />
              </span>
            ))}
          </span>
          {faltan.length > 0 && <span>Falta: {faltan.map((m) => nombre(m.id)).join(', ')}</span>}
        </div>
        {error && <p className="mt-1 text-xs font-semibold text-red-700">{error}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {!yaAprobe && (
          <button type="button" disabled={pending} onClick={() => votar(true)} className="btn-destructivo bg-white">
            Aprobar eliminación
          </button>
        )}
        <button type="button" disabled={pending} onClick={() => votar(false)} className="btn-suave bg-white">
          {soyQuienPide ? 'Retirar mi solicitud' : 'Conservar'}
        </button>
      </div>
    </div>
  );
}

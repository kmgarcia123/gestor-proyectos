'use client';

import { useState, useTransition } from 'react';
import Avatar from '@/components/Avatar';
import { votarCambioNombre } from '@/app/(app)/actions';
import type { Perfil } from '@/lib/types';

export interface Solicitud {
  id: string;
  proyecto_id: string;
  nombre_actual: string;
  nombre_nuevo: string;
  solicitado_por: string | null;
  aprobaciones: string[];
}

/** Aviso de un cambio de nombre pendiente, con quién ya aprobó y botones para aprobar o rechazar. */
export default function SolicitudNombre({ s, equipo, yoId, compacto = false }: { s: Solicitud; equipo: Perfil[]; yoId: string; compacto?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
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
        await votarCambioNombre(s.id, aprueba);
      } catch {
        setError('No se pudo registrar. Intenta de nuevo.');
      }
    });

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm sm:flex-row sm:items-center ${compacto ? '' : 'mt-4'}`} role="status">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-amber-900">
          {nombre(s.solicitado_por)} propone cambiar el nombre: «{s.nombre_actual}» → <strong>«{s.nombre_nuevo}»</strong>
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-amber-800">
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
      <div className="flex shrink-0 gap-2">
        {!yaAprobe && (
          <button type="button" disabled={pending} onClick={() => votar(true)} className="btn-primario min-h-0 py-2">
            Aprobar nombre
          </button>
        )}
        <button type="button" disabled={pending} onClick={() => votar(false)} className="btn-suave min-h-0 bg-white py-2">
          {soyQuienPide ? 'Retirar mi solicitud' : 'Rechazar nombre'}
        </button>
      </div>
    </div>
  );
}

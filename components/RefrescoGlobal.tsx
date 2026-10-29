'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { prepararTiempoReal } from '@/lib/en-vivo';

/**
 * En todas las pantallas: si alguien pide un cambio de nombre o cambia un proyecto,
 * se actualiza solo (menú lateral, Inicio y avisos de aprobación). También al volver a la pestaña.
 */
export default function RefrescoGlobal() {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let activo = true;
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const refrescar = () => {
      clearTimeout(espera);
      espera = setTimeout(() => router.refresh(), 300);
    };
    (async () => {
      await prepararTiempoReal(supabase);
      if (!activo) return;
      canal = supabase
        .channel('global')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_nombre' }, refrescar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'proyectos' }, refrescar)
        .subscribe();
    })();
    const alVolver = () => document.visibilityState === 'visible' && refrescar();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      activo = false;
      clearTimeout(espera);
      document.removeEventListener('visibilitychange', alVolver);
      if (canal) supabase.removeChannel(canal);
    };
  }, [router]);
  return null;
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { prepararTiempoReal } from '@/lib/en-vivo';
import Tablero from '@/components/Tablero';
import MapaFases from '@/components/MapaFases';
import type { Fase, Perfil, Proyecto, Tarea } from '@/lib/types';

interface Props {
  proyecto: Proyecto;
  tareasIniciales: Tarea[];
  fases: Fase[];
  equipo: Perfil[];
  yoId: string;
  tareaAbiertaId?: string;
  vistaInicial?: 'tablero' | 'mapa';
}

/** Pestañas del proyecto: Tablero y Mapa de fases (comparten las mismas tareas). */
export default function ProyectoVista({ proyecto, tareasIniciales, fases, equipo, yoId, tareaAbiertaId, vistaInicial = 'tablero' }: Props) {
  const [vista, setVista] = useState<'tablero' | 'mapa'>(tareaAbiertaId ? 'tablero' : vistaInicial);
  const [tareas, setTareas] = useState<Tarea[]>(tareasIniciales);
  const [faseFiltro, setFaseFiltro] = useState('');
  const [enVivo, setEnVivo] = useState(false);
  const router = useRouter();

  // Tiempo real: los cambios de los compañeros aparecen sin recargar la página.
  // Respaldo: si la conexión en vivo falla, se sincroniza cada 15 s y al volver a la pestaña.
  useEffect(() => {
    const supabase = createClient();
    let activo = true;
    let refresco: ReturnType<typeof setTimeout> | undefined;
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let conectado = false;

    const refrescarPagina = () => {
      clearTimeout(refresco);
      refresco = setTimeout(() => router.refresh(), 300);
    };

    // Trae todas las tareas del proyecto (con su número de adjuntos) y las deja tal como están en la base.
    const sincronizar = async () => {
      const { data, error } = await supabase.from('tareas').select('*, adjuntos(count)').eq('proyecto_id', proyecto.id);
      if (error || !data || !activo) return;
      const frescas = (data as (Tarea & { adjuntos?: { count: number }[] })[]).map(({ adjuntos, ...t }) => ({ ...t, adjuntos_total: adjuntos?.[0]?.count ?? 0 }) as Tarea);
      setTareas(frescas);
    };

    const conectar = async () => {
      await prepararTiempoReal(supabase);
      if (!activo) return;
      canal = supabase
        .channel(`proyecto-${proyecto.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tareas', filter: `proyecto_id=eq.${proyecto.id}` }, ({ new: n }) => {
          const t = n as Tarea;
          setTareas((ts) => (ts.some((x) => x.id === t.id) ? ts : [{ ...t, adjuntos_total: 0 }, ...ts]));
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tareas', filter: `proyecto_id=eq.${proyecto.id}` }, ({ new: n }) => {
          const t = n as Tarea;
          setTareas((ts) => ts.map((x) => (x.id === t.id ? { ...x, ...t, adjuntos_total: x.adjuntos_total } : x)));
        })
        // Los borrados no se pueden filtrar por proyecto: se quita la tarea si está en la lista.
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tareas' }, ({ old: o }) => {
          const id = (o as { id?: string }).id;
          if (id) setTareas((ts) => ts.filter((x) => x.id !== id));
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'fases', filter: `proyecto_id=eq.${proyecto.id}` }, refrescarPagina)
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'fases' }, refrescarPagina)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'adjuntos' }, () => sincronizar())
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'proyectos', filter: `id=eq.${proyecto.id}` }, refrescarPagina)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_nombre', filter: `proyecto_id=eq.${proyecto.id}` }, refrescarPagina)
        .subscribe((estado) => {
          conectado = estado === 'SUBSCRIBED';
          if (activo) setEnVivo(conectado);
          // Al reconectar, ponerse al día con lo que pasó mientras estaba desconectado.
          if (conectado) sincronizar();
        });
    };
    conectar();

    // La sesión se renueva cada hora: el canal debe usar el token nuevo.
    const { data: escucha } = supabase.auth.onAuthStateChange((_e, sesion) => {
      if (sesion?.access_token) supabase.realtime.setAuth(sesion.access_token);
    });

    const intervalo = setInterval(() => {
      if (document.visibilityState === 'visible' && !conectado) {
        sincronizar();
        router.refresh();
      }
    }, 15000);
    const alVolver = () => {
      if (document.visibilityState === 'visible') {
        sincronizar();
        router.refresh();
      }
    };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);

    return () => {
      activo = false;
      clearTimeout(refresco);
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
      escucha.subscription.unsubscribe();
      if (canal) supabase.removeChannel(canal);
    };
  }, [proyecto.id, router]);

  const pestaña = (id: 'tablero' | 'mapa', texto: string, icono: React.ReactNode) => (
    <button
      type="button"
      role="tab"
      aria-selected={vista === id}
      onClick={() => setVista(id)}
      className={`flex items-center gap-2 border-b-2 px-1 pb-3 pt-1 text-sm font-bold transition ${vista === id ? 'border-azul text-carbon' : 'border-transparent text-slate-500 hover:text-carbon'}`}
    >
      {icono}
      {texto}
    </button>
  );

  return (
    <>
      <div role="tablist" aria-label="Vistas del proyecto" className="flex gap-6 border-b border-slate-200 bg-white px-4 sm:px-8">
        {pestaña('tablero', 'Tablero', <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="10" rx="1.5" /><rect x="17" y="4" width="4" height="13" rx="1.5" /></svg>)}
        {pestaña('mapa', `Mapa de fases${fases.length ? ` · ${fases.length}` : ''}`, <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="5" rx="1" /><rect x="2" y="17" width="6" height="5" rx="1" /><rect x="16" y="17" width="6" height="5" rx="1" /><path d="M12 7v5M5 17v-5h14v5" /></svg>)}
        <span className={`ml-auto hidden items-center gap-1.5 self-center pb-2 text-xs font-semibold sm:flex ${enVivo ? 'text-turquesa-oscuro' : 'text-slate-400'}`} title={enVivo ? 'Los cambios del equipo aparecen al instante' : 'Sin conexión en vivo: se actualiza cada 15 segundos'}>
          <span className={`h-2 w-2 rounded-full ${enVivo ? 'animate-pulse bg-turquesa' : 'bg-slate-300'}`} aria-hidden="true" />
          {enVivo ? 'En vivo' : 'Actualiza cada 15 s'}
        </span>
      </div>
      {vista === 'tablero' ? (
        <Tablero
          proyectoId={proyecto.id}
          tareas={tareas}
          setTareas={setTareas}
          equipo={equipo}
          fases={fases}
          faseFiltro={faseFiltro}
          setFaseFiltro={setFaseFiltro}
          tareaAbiertaId={tareaAbiertaId}
          yoId={yoId}
        />
      ) : (
        <MapaFases
          proyecto={proyecto}
          fases={fases}
          tareas={tareas}
          onVerTareas={(id) => {
            setFaseFiltro(id);
            setVista('tablero');
          }}
        />
      )}
    </>
  );
}

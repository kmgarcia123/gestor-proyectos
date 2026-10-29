'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Adjunto } from '@/lib/types';

const MAX_BYTES = 10 * 1024 * 1024;
const BUCKET = 'adjuntos';

function tamanoLegible(b: number | null) {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

/** Nombre de archivo seguro para la ruta en Storage (sin tildes, espacios ni símbolos raros). */
function nombreSeguro(n: string) {
  const limpio = n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  return limpio.slice(-80) || 'archivo';
}

const esImagen = (a: { tipo: string | null }) => (a.tipo || '').startsWith('image/');

interface Props {
  tareaId: string;
  workspaceId: string;
  onTotal: (n: number) => void;
}

/**
 * Archivos de la tarea: subir (botón, arrastrar o pegar una captura con Ctrl+V), ver y borrar.
 * Los archivos van a un bucket privado de Supabase; solo los miembros del espacio los ven.
 */
export default function Adjuntos({ tareaId, workspaceId, onTotal }: Props) {
  const supabase = useRef(createClient()).current;
  const [lista, setLista] = useState<Adjunto[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(0);
  const [error, setError] = useState('');
  const [encima, setEncima] = useState(false);
  const [borrar, setBorrar] = useState<string | null>(null);
  const [vista, setVista] = useState<Adjunto | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase.from('adjuntos').select('*').eq('tarea_id', tareaId).order('creado_en');
    if (e) {
      setError('No se pudieron cargar los adjuntos.');
      setCargando(false);
      return;
    }
    const filas = (data || []) as Adjunto[];
    setLista(filas);
    onTotal(filas.length);
    if (filas.length) {
      const { data: firmadas } = await supabase.storage.from(BUCKET).createSignedUrls(filas.map((a) => a.ruta), 60 * 60);
      const m: Record<string, string> = {};
      (firmadas || []).forEach((f) => f.signedUrl && f.path && (m[f.path] = f.signedUrl));
      setUrls(m);
    }
    setCargando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, tareaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function subir(archivos: File[]) {
    setError('');
    const validos = archivos.filter((f) => {
      if (f.size > MAX_BYTES) {
        setError(`«${f.name}» pesa más de 10 MB.`);
        return false;
      }
      return f.size > 0;
    });
    if (!validos.length) return;
    setSubiendo((n) => n + validos.length);
    for (const f of validos) {
      const nombre = f.name && f.name !== 'image.png' ? f.name : `captura-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.png`;
      const ruta = `${workspaceId}/${tareaId}/${Date.now()}-${nombreSeguro(nombre)}`;
      const { error: eSubir } = await supabase.storage.from(BUCKET).upload(ruta, f, { contentType: f.type || 'application/octet-stream', upsert: false });
      if (eSubir) {
        setError(`No se pudo subir «${nombre}»: ${eSubir.message}`);
      } else {
        const { error: eFila } = await supabase.from('adjuntos').insert({ tarea_id: tareaId, workspace_id: workspaceId, nombre: nombre.slice(0, 200), ruta, tipo: f.type || null, tamano: f.size });
        if (eFila) {
          await supabase.storage.from(BUCKET).remove([ruta]);
          setError(`No se pudo guardar «${nombre}».`);
        }
      }
      setSubiendo((n) => n - 1);
    }
    await cargar();
  }

  async function eliminar(a: Adjunto) {
    if (borrar !== a.id) return setBorrar(a.id);
    setBorrar(null);
    const anterior = lista;
    setLista((l) => l.filter((x) => x.id !== a.id));
    onTotal(anterior.length - 1);
    const { error: e } = await supabase.from('adjuntos').delete().eq('id', a.id);
    if (e) {
      setLista(anterior);
      onTotal(anterior.length);
      return setError('No se pudo borrar el archivo.');
    }
    await supabase.storage.from(BUCKET).remove([a.ruta]);
  }

  // Pegar una captura (Ctrl+V / Cmd+V) mientras la tarea está abierta.
  useEffect(() => {
    const alPegar = (e: ClipboardEvent) => {
      const archivos = Array.from(e.clipboardData?.files || []);
      if (!archivos.length) return;
      const destino = e.target as HTMLElement | null;
      if (destino && destino.closest('dialog') === null) return;
      e.preventDefault();
      subir(archivos);
    };
    document.addEventListener('paste', alPegar);
    return () => document.removeEventListener('paste', alPegar);
  });

  const imagenes = lista.filter(esImagen);
  const documentos = lista.filter((a) => !esImagen(a));

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setEncima(true);
        }
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => {
        e.preventDefault();
        setEncima(false);
        subir(Array.from(e.dataTransfer.files));
      }}
      className={`rounded-2xl border p-4 transition ${encima ? 'border-azul bg-azul-suave' : 'border-slate-200'}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold">Adjuntos{lista.length ? ` · ${lista.length}` : ''}</p>
        <button type="button" onClick={() => input.current?.click()} className="btn-suave ml-auto min-h-0 py-1.5 text-xs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21 12-8.5 8.5a5 5 0 0 1-7-7L14 5a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 8" /></svg>
          Adjuntar archivo
        </button>
        <input
          ref={input}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            subir(Array.from(e.target.files || []));
            e.target.value = '';
          }}
        />
      </div>

      {cargando ? (
        <p className="mt-3 text-xs text-slate-400">Cargando…</p>
      ) : (
        !lista.length && !subiendo && (
          <p className="mt-2 text-xs text-slate-500">
            Arrastra aquí imágenes o documentos, o <strong>pega una captura con Ctrl+V</strong>. Máximo 10 MB por archivo.
          </p>
        )
      )}

      {imagenes.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {imagenes.map((a) => (
            <li key={a.id} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-fondo">
              <button type="button" onClick={() => setVista(a)} className="block h-full w-full" title={a.nombre}>
                {urls[a.ruta] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urls[a.ruta]} alt={a.nombre} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-slate-400">…</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => eliminar(a)}
                className={`absolute right-1 top-1 rounded-full px-2 py-0.5 text-[11px] font-bold shadow ${borrar === a.id ? 'bg-red-600 text-white' : 'bg-white/90 text-slate-600 opacity-80 group-hover:opacity-100'}`}
                aria-label={`Borrar ${a.nombre}`}
              >
                {borrar === a.id ? 'Borrar archivo' : '✕'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {documentos.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {documentos.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-nube text-[10px] font-extrabold uppercase text-azul-oscuro">
                {(a.nombre.split('.').pop() || 'doc').slice(0, 4)}
              </span>
              <a href={urls[a.ruta] || '#'} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold hover:text-azul">{a.nombre}</span>
                <span className="block text-xs text-slate-500">{tamanoLegible(a.tamano)}</span>
              </a>
              <button type="button" onClick={() => eliminar(a)} className={`rounded-lg px-2 py-1 text-xs font-bold ${borrar === a.id ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-red-50 hover:text-red-600'}`} aria-label={`Borrar ${a.nombre}`}>
                {borrar === a.id ? 'Borrar archivo' : '✕'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {subiendo > 0 && <p className="mt-3 text-xs font-semibold text-azul">Subiendo {subiendo} archivo{subiendo > 1 ? 's' : ''}…</p>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}

      {vista && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-carbon/90 p-4" onClick={() => setVista(null)} role="dialog" aria-label={vista.nombre}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urls[vista.ruta]} alt={vista.nombre} className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl" />
          <div className="flex items-center gap-3 text-sm text-white">
            <span className="max-w-[60vw] truncate">{vista.nombre}</span>
            <a href={urls[vista.ruta]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="rounded-full bg-white/15 px-3 py-1 font-semibold hover:bg-white/25">Abrir original</a>
            <button type="button" className="rounded-full bg-white/15 px-3 py-1 font-semibold hover:bg-white/25">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

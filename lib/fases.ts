import type { EstadoFase, Fase, Tarea } from '@/lib/types';

/** Subfases directas de cada fase (clave '' = fases principales), ordenadas por posición. */
export function hijosPorPadre(fases: Fase[]) {
  const m = new Map<string, Fase[]>();
  for (const f of fases) {
    const k = f.parent_id || '';
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(f);
  }
  for (const l of m.values()) l.sort((a, b) => a.posicion - b.posicion || a.nombre.localeCompare(b.nombre));
  return m;
}

/** La fase y todas sus subfases (a cualquier nivel). */
export function conDescendientes(fases: Fase[], id: string): Set<string> {
  const hijos = hijosPorPadre(fases);
  const r = new Set<string>([id]);
  const pila = [id];
  while (pila.length) for (const h of hijos.get(pila.pop()!) || []) if (!r.has(h.id)) (r.add(h.id), pila.push(h.id));
  return r;
}

/** Lista plana en orden de árbol, con su nivel de profundidad (para menús desplegables). */
export function aplanar(fases: Fase[]): { f: Fase; nivel: number }[] {
  const hijos = hijosPorPadre(fases);
  const out: { f: Fase; nivel: number }[] = [];
  const visitar = (padre: string, nivel: number) => {
    for (const f of hijos.get(padre) || []) {
      out.push({ f, nivel });
      if (nivel < 20) visitar(f.id, nivel + 1);
    }
  };
  visitar('', 0);
  // Fases huérfanas (padre borrado o de otro proyecto) al final, para no perderlas.
  for (const f of fases) if (!out.some((o) => o.f.id === f.id)) out.push({ f, nivel: 0 });
  return out;
}

export interface AvanceFase {
  total: number;
  hechas: number;
  pct: number;
  estado: EstadoFase;
  automatico: boolean;
}

/** Avance de una fase contando sus tareas y las de sus subfases. El estado manual, si existe, manda. */
export function avanceFase(fases: Fase[], tareas: Tarea[], fase: Fase): AvanceFase {
  const ids = conDescendientes(fases, fase.id);
  const ts = tareas.filter((t) => t.fase_id && ids.has(t.fase_id));
  const hechas = ts.filter((t) => t.estado === 'hecho').length;
  const enCurso = ts.some((t) => t.estado === 'en_curso' || t.estado === 'revision');
  const pct = ts.length ? Math.round((hechas / ts.length) * 100) : fase.estado_manual === 'hecho' ? 100 : 0;
  const auto: EstadoFase = ts.length && hechas === ts.length ? 'hecho' : enCurso || hechas > 0 ? 'curso' : 'pendiente';
  return { total: ts.length, hechas, pct, estado: fase.estado_manual || auto, automatico: !fase.estado_manual };
}

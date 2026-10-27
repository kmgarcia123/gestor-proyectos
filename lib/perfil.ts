import type { Perfil } from '@/lib/types';

export function nombreCorto(p: Pick<Perfil, 'nombre' | 'email'> | undefined | null) {
  if (!p) return 'Sin asignar';
  return (p.nombre || p.email).split(' ')[0];
}

export function iniciales(p: Pick<Perfil, 'nombre' | 'email'> | undefined | null) {
  if (!p) return '?';
  const base = (p.nombre || p.email).trim();
  const partes = base.split(/\s+/);
  return ((partes[0]?.[0] || '') + (partes[1]?.[0] || '')).toUpperCase() || base[0].toUpperCase();
}

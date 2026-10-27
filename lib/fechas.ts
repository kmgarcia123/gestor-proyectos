const TZ = 'America/Bogota';

/** Fecha de hoy en Bogotá, formato YYYY-MM-DD. */
export function hoyBogota(desplazamientoDias = 0): string {
  const d = new Date(Date.now() + desplazamientoDias * 864e5);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function formatoCorto(fecha: string): string {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '');
}

export type EstadoFecha = 'vencida' | 'hoy' | 'manana' | 'proxima' | 'sin';

export function estadoFecha(fecha: string | null, terminada = false): EstadoFecha {
  if (!fecha || terminada) return 'sin';
  const hoy = hoyBogota();
  if (fecha < hoy) return 'vencida';
  if (fecha === hoy) return 'hoy';
  if (fecha === hoyBogota(1)) return 'manana';
  return 'proxima';
}

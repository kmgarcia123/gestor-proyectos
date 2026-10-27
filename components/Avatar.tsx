import type { Perfil } from '@/lib/types';
import { iniciales } from '@/lib/perfil';

export default function Avatar({ perfil, size = 28 }: { perfil?: Perfil | null; size?: number }) {
  const estilo = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  if (perfil?.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={perfil.avatar_url} alt={perfil.nombre || perfil.email} title={perfil.nombre || perfil.email} referrerPolicy="no-referrer" className="shrink-0 rounded-full object-cover ring-2 ring-white" style={estilo} />;
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-azul-suave font-bold text-azul-oscuro ring-2 ring-white"
      style={estilo}
      title={perfil ? perfil.nombre || perfil.email : 'Sin asignar'}
      aria-label={perfil ? perfil.nombre || perfil.email : 'Sin asignar'}
    >
      {iniciales(perfil)}
    </span>
  );
}

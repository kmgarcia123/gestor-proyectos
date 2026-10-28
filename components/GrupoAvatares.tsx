import Avatar from '@/components/Avatar';
import type { Perfil } from '@/lib/types';

/** Avatares superpuestos de los responsables de una tarea. */
export default function GrupoAvatares({ personas, size = 24, max = 3 }: { personas: Perfil[]; size?: number; max?: number }) {
  if (!personas.length) return <Avatar perfil={null} size={size} />;
  const visibles = personas.slice(0, max);
  const resto = personas.length - visibles.length;
  return (
    <span className="flex -space-x-1" title={personas.map((p) => p.nombre || p.email).join(', ')}>
      {visibles.map((p) => (
        <Avatar key={p.id} perfil={p} size={size} />
      ))}
      {resto > 0 && (
        <span className="inline-flex items-center justify-center rounded-full bg-slate-200 font-bold text-slate-600 ring-2 ring-white" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>
          +{resto}
        </span>
      )}
    </span>
  );
}

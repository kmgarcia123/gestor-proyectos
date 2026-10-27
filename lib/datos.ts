import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Perfil, Proyecto } from '@/lib/types';

/** Usuario, su espacio de trabajo, el equipo y los proyectos activos. */
export const getContexto = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membresia } = await supabase
    .from('miembros')
    .select('workspace_id, rol, workspaces(nombre)')
    .eq('user_id', user.id)
    .order('creado_en')
    .limit(1)
    .maybeSingle();

  if (!membresia) redirect('/login?error=no-autorizado');

  const workspaceId = membresia.workspace_id as string;
  const ws = membresia.workspaces as unknown as { nombre: string } | null;

  const [{ data: miembros }, { data: proyectos }] = await Promise.all([
    supabase.from('miembros').select('perfiles(id, email, nombre, avatar_url)').eq('workspace_id', workspaceId),
    supabase.from('proyectos').select('*').eq('workspace_id', workspaceId).eq('archivado', false).order('creado_en')
  ]);

  const equipo = (miembros || []).map((m) => m.perfiles as unknown as Perfil).filter(Boolean);
  const yo = equipo.find((p) => p.id === user.id) || { id: user.id, email: user.email || '', nombre: null, avatar_url: null };

  return {
    supabase,
    user,
    yo,
    rol: membresia.rol as string,
    workspaceId,
    workspaceNombre: ws?.nombre || 'Mi espacio',
    equipo,
    proyectos: (proyectos || []) as Proyecto[]
  };
});

export { nombreCorto, iniciales } from '@/lib/perfil';

'use client';

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Antes de suscribirse a cambios en tiempo real hay que pasarle al canal la sesión del usuario;
 * si no, se conecta como anónimo y la seguridad por filas (RLS) no le deja ver nada.
 */
export async function prepararTiempoReal(supabase: SupabaseClient) {
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (session?.access_token) await supabase.realtime.setAuth(session.access_token);
  return session;
}

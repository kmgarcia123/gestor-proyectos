import { createClient } from '@supabase/supabase-js';

/** Cliente con permisos de servidor. Solo usar en rutas del servidor (cron), nunca en el navegador. */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

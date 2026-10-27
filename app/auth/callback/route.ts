import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const errorDesc = searchParams.get('error_description') || '';

  // El trigger de la base de datos rechaza correos no autorizados.
  if (errorDesc) {
    const tipo = /no autorizado|database error/i.test(errorDesc) ? 'no-autorizado' : 'error';
    return NextResponse.redirect(`${origin}/login?error=${tipo}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }
  return NextResponse.redirect(`${origin}/login?error=error`);
}

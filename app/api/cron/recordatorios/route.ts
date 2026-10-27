import { NextResponse } from 'next/server';
import { procesarRecordatorios } from '@/lib/recordatorios';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Revisa y envía recordatorios. Seguro de llamar muchas veces: nunca repite un aviso.
 * - Supabase (pg_cron) la llama cada 15 minutos → respeta la hora de cada persona y los "Recordar el".
 * - Vercel (vercel.json) la llama una vez al día como respaldo.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    return NextResponse.json(await procesarRecordatorios());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

-- =====================================================================
-- Fase 2 · Revisar recordatorios cada 15 minutos (Supabase pg_cron + pg_net)
-- Ejecutar UNA vez en Supabase > SQL Editor, DESPUÉS de aprobar y publicar la fase 2
-- (la URL de abajo debe ser la de producción, que ya tenga este código).
-- Reemplace los 2 valores marcados con <<< >>> antes de ejecutar.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Guarda el CRON_SECRET cifrado en Supabase Vault (el mismo valor que está en Vercel).
-- Así la clave no queda escrita en la definición de la tarea programada.
select vault.create_secret('<<<PEGUE AQUÍ SU CRON_SECRET>>>', 'cron_secret');

select cron.schedule(
  'recordatorios-cada-15-min',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := '<<<https://SU-APP.vercel.app>>>/api/cron/recordatorios',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 55000
  );
  $$
);

-- Para revisar que corre:   select * from cron.job_run_details order by start_time desc limit 10;
-- Respuestas de la app:      select status_code, content from net._http_response order by created desc limit 5;
-- Para detenerlo:            select cron.unschedule('recordatorios-cada-15-min');

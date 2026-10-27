# Gestor de proyectos

App interna para gestionar proyectos y tareas del equipo, con login de Google, tablero tipo Trello, fases con avance visual y recordatorios automáticos por correo.

Pensada para uso interno, pero **multi-espacio desde el día 1**: todo pertenece a un *workspace*, así que más adelante puede ofrecerse a clientes sin rehacer la base.

## Fase 1 (incluido)

- Login con Google, **solo para correos autorizados** (los demás son rechazados por la base de datos).
- Inicio: mis tareas, vencidas, para hoy, carga del equipo y avance por proyecto.
- Proyectos con fases (Diagnóstico → Diseño → …) que muestran su porcentaje de avance.
- Tablero con 4 columnas (Por hacer, En curso, En revisión, Hecho), arrastrar y soltar, alta rápida, filtros por responsable y fase.
- Detalle de tarea: responsable, fecha límite, prioridad, fase, descripción.
- Recordatorio diario por correo (7:00 a. m. Bogotá): tareas que vencen mañana, hoy o ya vencidas. Un solo correo por persona, sin repetir.

## Próximas fases

2. WhatsApp (o Telegram) y resumen diario · 3. Calendario, Gantt y panel · 4. Mapa del proyecto que se colorea por fases · 5. Acceso de clientes.

## Tecnología

Next.js 15 · Supabase (Auth Google, Postgres con RLS) · Tailwind · dnd-kit · Resend · Vercel (hosting + cron).

---

## Puesta en marcha (una sola vez, ~30 min)

### 1. Supabase
1. Cree un proyecto en [supabase.com](https://supabase.com) (región más cercana: São Paulo).
2. Abra `supabase/migrations/0001_inicial.sql`, **cambie al final el nombre de la empresa y los 3 correos de Gmail**, y ejecútelo completo en *SQL Editor*.
3. En *Project Settings → API* copie: `Project URL`, `anon public` y `service_role`.

### 2. Login con Google
1. En [Google Cloud Console](https://console.cloud.google.com) cree un proyecto → *APIs y servicios → Pantalla de consentimiento OAuth* (tipo Externo, agregue los 3 correos como usuarios de prueba).
2. *Credenciales → Crear ID de cliente OAuth → Aplicación web*. En **URI de redireccionamiento autorizados** ponga:
   `https://SU-PROYECTO.supabase.co/auth/v1/callback`
3. En Supabase → *Authentication → Providers → Google*: active y pegue el Client ID y el Client Secret.
4. En Supabase → *Authentication → URL Configuration*:
   - **Site URL:** `https://SU-APP.vercel.app`
   - **Redirect URLs:** `https://SU-APP.vercel.app/auth/callback` y `http://localhost:3000/auth/callback`

### 3. Correos (Resend)
1. Cree cuenta en [resend.com](https://resend.com) y una API key.
2. Para enviar a los 3 socios, verifique su dominio en Resend (cuando lo compren). Mientras tanto, el remitente de prueba `onboarding@resend.dev` solo entrega al correo dueño de la cuenta de Resend.

### 4. Vercel
1. Importe este repositorio en [vercel.com](https://vercel.com).
2. Agregue las variables de `.env.example` en *Settings → Environment Variables* (`CRON_SECRET`: un texto largo aleatorio).
3. Deploy. El cron de `vercel.json` llama a `/api/cron/recordatorios` cada día a las 12:00 UTC (7:00 a. m. Colombia); Vercel envía `CRON_SECRET` automáticamente.

### Desarrollo local
```bash
cp .env.example .env.local   # complete los valores
npm install
npm run dev                  # http://localhost:3000
```

Probar los recordatorios a mano:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/recordatorios
```

### Agregar una persona al equipo
En Supabase → SQL Editor:
```sql
insert into correos_autorizados (email, workspace_id, rol)
select 'nuevo@gmail.com', id, 'miembro' from workspaces limit 1;
```

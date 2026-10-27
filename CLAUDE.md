# Reglas del proyecto

- **Nunca subir cambios directo a `main`.** Todo cambio va en una rama (`fase-N` o `fix-...`) con pull request.
- `main` solo recibe lo que Kevin (dueño del repo) probó y aprobó en el enlace de prueba de Vercel.
- Cada pull request incluye: qué cambió y una lista de qué probar.
- Idioma de la interfaz, el código de dominio y los mensajes de commit: español.

# Contexto

App interna de gestión de proyectos y tareas del equipo (3 socios). Multi-espacio desde el inicio para poder ofrecerla a clientes después.
Stack: Next.js 15 (App Router) · Supabase (Auth Google, Postgres con RLS) · Tailwind · dnd-kit · Resend (correo) · WhatsApp Cloud API de Meta · Vercel. Recordatorios: `lib/notificar.ts` (envío) y `lib/recordatorios.ts` (reglas); `/api/cron/recordatorios` la llama Supabase pg_cron cada 15 min.
Esquema en `supabase/migrations/`. Fases pendientes en el README.

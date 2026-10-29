# TEGGNAR Gestor · gestor de proyectos

App interna para gestionar proyectos y tareas del equipo, con login de Google, tablero tipo Trello, fases con avance visual y recordatorios automáticos por correo y WhatsApp.

Pensada para uso interno, pero **multi-espacio desde el día 1**: todo pertenece a un *workspace*, así que más adelante puede ofrecerse a clientes sin rehacer la base.

## Fase 1 (incluido)

- Login con Google, **solo para correos autorizados** (los demás son rechazados por la base de datos).
- Inicio: mis tareas, vencidas, para hoy, carga del equipo y avance por proyecto.
- Proyectos con fases (Diagnóstico → Diseño → …) que muestran su porcentaje de avance.
- Tablero con 4 columnas (Por hacer, En curso, En revisión, Hecho), arrastrar y soltar, alta rápida, filtros por responsable y fase.
- Detalle de tarea: responsable, fecha límite, prioridad, fase, descripción.
- Recordatorio diario por correo (7:00 a. m. Bogotá): tareas que vencen mañana, hoy o ya vencidas. Un solo correo por persona, sin repetir.

## Fase 2 (incluido)

- **Mis notificaciones** (menú lateral): cada persona elige correo y/o WhatsApp, su celular, la hora del aviso diario, cuántos días antes avisar, si avisar el día que vence, si repetir mientras esté vencida y si quiere un resumen diario de todo lo pendiente. Botones para enviarse una prueba e historial de los últimos envíos (con el motivo si algo falló).
- En cada tarea, sección **Recordatorio**: mensaje personalizado (“Por favor haz la tarea antes del viernes”), **Recordar el** (fecha y hora) y **Recordar ahora** (le llega al responsable al instante, firmado por quien lo envía).
- WhatsApp por la **API oficial de Meta** (plantilla aprobada). Un solo mensaje al día por canal; nunca se repite un aviso.

## Fase 3 (incluido)

- **Varios responsables por tarea**: se tocan los avatares del equipo para asignar a una, dos o todas las personas. Avisos y recordatorios les llegan a todos.
- **Fecha de inicio** (la tarjeta muestra «Inicia …» si es futura) y **fecha y hora de creación** con quién la creó.
- **«+ Agregar tarea» arriba** de cada columna; las nuevas quedan de primeras.
- **Aviso inmediato al asignar** a alguien (correo y/o WhatsApp según sus preferencias).
- **Lista de pasos** dentro de cada tarea (opcional): mini pasos para chulear; se guarda al instante y la tarjeta muestra «☑ 2/5».
- **Mapa de fases** (pestaña del proyecto): fases y subfases como cuadros conectados con líneas, coloreados por avance. Los cuadros se **arrastran** a cualquier parte (se mueven con sus subfases) y hay «Ordenar automáticamente». Se agregan, editan y eliminan; estado manual opcional. Clic en un cuadro filtra el tablero por esa fase.
- Base de datos: `supabase/migrations/0003_responsables_fechas_mapa.sql` y `0004_pasos_y_mapa_libre.sql`.

## Fase 4 (incluido)

- **Ficha rápida al crear tarea**: nombre, responsables y fecha límite antes de crearla (botón «Nueva tarea» o «+ Agregar tarea» en cada columna); «Crear y ver detalle» abre la tarea completa.
- **Adjuntos**: imágenes y documentos en cada tarea (botón, arrastrar o pegar captura con Ctrl+V), máximo 10 MB. Bucket privado `adjuntos` de Supabase Storage; solo miembros del espacio. La tarjeta muestra «📎 n».
- **Celular**: menú ☰ deslizable, columnas que se deslizan con el dedo, tarea a pantalla completa y ficha rápida desde abajo.
- **Tiempo real** (Supabase Realtime): tareas, fases y adjuntos se actualizan solos para todo el equipo; indicador «En vivo».
- Base de datos: `supabase/migrations/0005_adjuntos_y_tiempo_real.sql`.

## Próximas fases

3. Calendario, Gantt y panel · 4. Mapa del proyecto que se colorea por fases · 5. Acceso de clientes.

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

### 3. Correos
**Opción Gmail (sin dominio, uso interno):** con la cuenta de Gmail que enviará los avisos, active la verificación en dos pasos y cree una *contraseña de aplicación* en [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords). En Vercel: `GMAIL_USUARIO` (el Gmail) y `GMAIL_CLAVE_APP` (las 16 letras, como Secret). Si están, se usa Gmail en vez de Resend.

**Opción Resend (con dominio propio):**
1. Cree cuenta en [resend.com](https://resend.com) y una API key.
2. Para enviar a los 3 socios, verifique su dominio en Resend (cuando lo compren). Mientras tanto, el remitente de prueba `onboarding@resend.dev` solo entrega al correo dueño de la cuenta de Resend.

### 4. Vercel
1. Importe este repositorio en [vercel.com](https://vercel.com).
2. Agregue las variables de `.env.example` en *Settings → Environment Variables* (`CRON_SECRET`: un texto largo aleatorio).
3. Deploy. El cron de `vercel.json` llama a `/api/cron/recordatorios` cada día a las 12:00 UTC (7:00 a. m. Colombia); Vercel envía `CRON_SECRET` automáticamente.

### 5. WhatsApp (API oficial de Meta) — Fase 2
1. En [developers.facebook.com](https://developers.facebook.com) → *Mis apps → Crear app* → tipo **Empresa** → agregue el producto **WhatsApp**.
2. *WhatsApp → Configuración de la API*: Meta le da un **número de prueba** gratis. Copie el **Identificador del número de teléfono** → variable `WHATSAPP_PHONE_NUMBER_ID`.
3. En esa misma pantalla, en **Para**, agregue los celulares de los socios (máximo 5 con el número de prueba); a cada uno le llega un código para confirmar.
4. Token permanente: en [business.facebook.com](https://business.facebook.com) → *Configuración del negocio → Usuarios del sistema* → cree uno (Administrador) → *Asignar activos*: su app (control total) → *Generar token* con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`, caducidad **Nunca** → variable `WHATSAPP_TOKEN` (como **Secret** en Vercel; nunca la pegue en chats ni en el código).
5. *WhatsApp Manager → Plantillas de mensajes → Crear plantilla*: categoría **Utilidad → Predeterminada**, nombre `recordatorio_tareas_es`, idioma **Español** (revíselo: por defecto sale inglés), cuerpo:
   `Hola {{1}}, hay una actualización de las tareas asignadas a tu cuenta: {{2}}. Puedes ver el detalle aquí: {{3}} Este es un aviso automático de tu cuenta.`
   (Ejemplos: `Kevin` · `la tarea «Cotización Torres del Parque» vence hoy` · `https://su-app.vercel.app`). Con textos genéricos Meta la clasifica como Marketing: use esta redacción. En Vercel: `WHATSAPP_PLANTILLA=recordatorio_tareas_es`.
6. En Vercel agregue `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID` y vuelva a desplegar. Cada persona activa WhatsApp y escribe su número en **Mis notificaciones**, y prueba con **Probar WhatsApp**.
7. Cuando quieran enviar desde un número propio (no el de prueba), se agrega en *WhatsApp → Números de teléfono* y se verifica el negocio. Costo aproximado en Colombia: menos de USD 0,001 por mensaje de utilidad.

### 6. Revisión cada 15 minutos — Fase 2
El cron de Vercel (plan gratis) solo corre una vez al día. Para respetar la hora de cada persona y los “Recordar el”, Supabase llama a la app cada 15 minutos: ejecute `supabase/programar_recordatorios.sql` en *SQL Editor* (después de publicar en producción), con su `CRON_SECRET` y la URL de producción.

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

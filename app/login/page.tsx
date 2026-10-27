import BotonGoogle from './BotonGoogle';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const app = process.env.NEXT_PUBLIC_APP_NAME || 'Gestor de proyectos';
  return (
    <main className="grid min-h-screen place-items-center bg-carbon px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-end justify-center gap-1 rounded-2xl bg-carbon p-3" aria-hidden="true">
          <span className="block h-7 w-2 rounded bg-azul" />
          <span className="block h-5 w-2 rounded bg-white" />
          <span className="block h-3 w-2 rounded bg-turquesa" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">{app}</h1>
        <p className="mt-2 text-sm text-slate-500">Entra con tu cuenta de Google autorizada.</p>
        {error && (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error === 'no-autorizado'
              ? 'Ese correo no está autorizado. Pide a un administrador que lo agregue.'
              : 'No se pudo iniciar sesión. Intenta de nuevo.'}
          </p>
        )}
        <div className="mt-6">
          <BotonGoogle />
        </div>
      </div>
    </main>
  );
}

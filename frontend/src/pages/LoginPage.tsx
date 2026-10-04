import { FormEvent, useState } from "react";
import { LoaderCircleIcon, LockIcon, MailIcon, ShieldCheckIcon } from "lucide-react";
import { ApiError } from "../api/client";
import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password, remember);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setError("Correo o contraseña incorrectos.");
      else if (err instanceof ApiError && err.status === 429) setError("Demasiados intentos. Espera un minuto e inténtalo de nuevo.");
      else setError("No se pudo conectar con el servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-10 font-sans text-slate-900">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-950 text-white shadow-sm">
            <ShieldCheckIcon className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight text-slate-950">FinControl</p>
            <p className="text-xs font-medium text-slate-500">Gestión de recursos</p>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold tracking-tight text-slate-950">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-slate-500">Ingresa con tu cuenta institucional.</p>

          <label className="mt-6 block text-xs font-semibold text-slate-600" htmlFor="email">Correo electrónico</label>
          <div className="relative mt-1.5">
            <MailIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
          </div>

          <label className="mt-4 block text-xs font-semibold text-slate-600" htmlFor="password">Contraseña</label>
          <div className="relative mt-1.5">
            <LockIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-700" />
            Mantener sesión iniciada
          </label>

          {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}

          <button type="submit" disabled={submitting} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors duration-150 hover:bg-blue-950 disabled:opacity-60">
            {submitting && <LoaderCircleIcon className="h-4 w-4 animate-spin" />}
            Ingresar
          </button>
        </form>
      </div>
    </main>
  );
}

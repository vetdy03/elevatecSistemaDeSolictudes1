import { FormEvent, useState } from "react";
import { EyeIcon, EyeOffIcon, LoaderCircleIcon, LockIcon, MailIcon, ShieldCheckIcon } from "lucide-react";
import { ApiError } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import logo from "../assets/images.jpg";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      else if (err instanceof ApiError) setError(`El servidor respondió con un error (${err.status}). Inténtalo de nuevo; si persiste, avisa al administrador.`);
      // Sin respuesta: servidor apagado o sin red (en local: ¿Docker está encendido?)
      else setError("No se pudo conectar con el servidor. Verifica tu conexión.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-10 font-sans text-slate-900">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm">
              <img
              src={logo}
              alt="Elevatec" 
              className="h-15 w-15 rounded-xl border border-slate-200 bg-white object-contain p-.5 shadow-sm"
              />              
          </div>
          <div>
            <p className="font-michroma font-bold text-sm tracking-widest text-slate-950">ELEVATEC</p>
            <p className="text-xs font-medium text-slate-500">Gestión de solicitudes</p>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold tracking-tight text-slate-950">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-slate-500">Ingresa con tu cuenta.</p>

          <label className="mt-6 block text-xs font-semibold text-slate-600" htmlFor="email">Correo electrónico</label>
          <div className="relative mt-1.5">
            <MailIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
          </div>

          <label className="mt-4 block text-xs font-semibold text-slate-600" htmlFor="password">Contraseña</label>
          <div className="relative mt-1.5">
            <LockIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-10 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700"
            >
              {showPassword ? (
                <EyeOffIcon className="h-4 w-4" aria-hidden="true" />
              ) : (
                <EyeIcon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
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

// Cliente HTTP mínimo para la API de Laravel (Sanctum en modo SPA: cookie de sesión + XSRF).
// Nginx sirve el frontend y /api desde el mismo origen, por eso las rutas son relativas.

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

let csrfReady: Promise<void> | null = null;

export function ensureCsrfCookie(force = false): Promise<void> {
  if (!csrfReady || force) {
    csrfReady = fetch("/sanctum/csrf-cookie", { credentials: "include" }).then(() => undefined);
  }
  return csrfReady;
}

let onUnauthorized: (() => void) | null = null;

/** El AuthProvider registra aquí qué hacer cuando la sesión expira (401). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

async function send(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET") await ensureCsrfCookie();

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");
  const xsrf = readCookie("XSRF-TOKEN");
  if (xsrf) headers.set("X-XSRF-TOKEN", xsrf);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  const response = await fetch(`/api${path}`, { ...init, headers, credentials: "include" });

  // 419 = token CSRF vencido: se renueva la cookie y se reintenta una vez.
  if (response.status === 419 && !retried) {
    await ensureCsrfCookie(true);
    return send(path, init, true);
  }
  if (response.status === 401 && path !== "/user" && path !== "/login") {
    onUnauthorized?.();
  }

  if (!response.ok) {
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      data = undefined;
    }
    const message = (data as { message?: string } | undefined)?.message ?? `Error ${response.status}`;
    throw new ApiError(response.status, message, data);
  }
  return response;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await send(path, init);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const json = (body: unknown): string => JSON.stringify(body);

// Descarga un archivo (Excel / PDF) respetando la sesión y el nombre que envía el servidor.
export async function download(path: string, fallbackName: string): Promise<void> {
  const response = await send(path);
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const name = disposition.match(/filename="?([^";]+)"?/)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

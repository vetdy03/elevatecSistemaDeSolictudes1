import { useEffect, useRef, useState } from "react";
import { BellIcon, CheckIcon, ChevronDownIcon, LogOutIcon, MenuIcon, XIcon } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useNotifications } from "../hooks/useNotifications";
import { formatLongDate } from "../lib/format";
import { AppNotification, Batch, User } from "../types";
import logo from "../assets/images.jpg";
import logoliteral from "../assets/logo-elevatec.svg";

export type { UserRole } from "../types";

interface TopNavProps {
  user: User;
  batch: Batch | null;
  pendingBatches: Batch[];
  onSelectBatch: (id: number | null) => void;
}

/** Cierra un popover al hacer clic fuera de él. */
function useClickOutside<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);
  return ref;
}

export function TopNav({ user, batch, pendingBatches, onSelectBatch }: TopNavProps) {
  const { logout } = useAuth();
  const notifications = useNotifications();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isBellOpen, setIsBellOpen] = useState(false);
  const batchRef = useClickOutside<HTMLDivElement>(isBatchOpen, () => setIsBatchOpen(false));
  const bellRef = useClickOutside<HTMLDivElement>(isBellOpen, () => setIsBellOpen(false));
  const batchLabel = batch?.code ?? "Sin lote activo";

  const selectBatch = (id: number) => {
    onSelectBatch(id);
    setIsBatchOpen(false);
    setIsMenuOpen(false);
  };

  const toggleBell = () => {
    setIsBellOpen((open) => !open);
    if (!isBellOpen) notifications.markAllRead();
  };

  // En celular la campana tiene su propio estado (el panel de escritorio cierra al tocar fuera de él).
  const [isMobileBellOpen, setIsMobileBellOpen] = useState(false);
  const toggleMobileBell = () => {
    setIsMobileBellOpen((open) => !open);
    setIsMenuOpen(false);
    if (!isMobileBellOpen) notifications.markAllRead();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-13 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm">
                        <img
                        src={logo}
                        alt="Elevatec" 
                        className="h-15 w-15 rounded-xl border border-slate-200 bg-white object-contain p-.5 shadow-sm"
                        />              
                    </div>
          <div>
            <img src={logoliteral} className="h-6 w-auto" alt="Elevatec Logo" width="50" />
            <p className="text-xs font-medium text-slate-500">Gestión de solicitudes</p>
          </div>
          <div ref={batchRef} className="relative ml-3 hidden items-center gap-2 border-l border-slate-200 pl-5 lg:flex">
            <span className="text-xs font-medium text-slate-500">{batch?.status === "Completado" ? "Lote" : "Lote activo"}</span>
            <button onClick={() => setIsBatchOpen((open) => !open)} aria-expanded={isBatchOpen} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors duration-150 hover:border-slate-300 hover:bg-white" type="button">
              {batchLabel} <ChevronDownIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            {isBatchOpen && (
              <div className="absolute left-5 top-full mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <p className="border-b border-slate-100 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">Lotes pendientes</p>
                {pendingBatches.length === 0 && <p className="px-4 py-4 text-sm text-slate-500">No hay lotes pendientes.</p>}
                {pendingBatches.map((item) => (
                  <button key={item.id} type="button" onClick={() => selectBatch(item.id)} className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-slate-50">
                    <span>
                      <span className="block text-sm font-bold text-slate-800">{item.code}</span>
                      <span className="block text-xs text-slate-500">{formatLongDate(item.date)} · {item.items} solicitudes</span>
                    </span>
                    {batch?.id === item.id && <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <div ref={bellRef} className="relative">
            <button onClick={toggleBell} className="relative rounded-lg p-2 text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-800" type="button" aria-label="Ver notificaciones" aria-expanded={isBellOpen}>
              <BellIcon className="h-5 w-5" aria-hidden="true" />
              {notifications.unread > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />}
            </button>
            {isBellOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <p className="border-b border-slate-100 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">Notificaciones</p>
                <div className="max-h-80 overflow-y-auto">
                  <NotificationItems items={notifications.items} onOpen={(batchId) => { if (batchId) onSelectBatch(batchId); setIsBellOpen(false); }} />
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800">{user.initials}</div>
            {/* Nombre completo visible en cualquier pantalla de escritorio (el rol queda en el tooltip) */}
            <p className="max-w-[16rem] truncate text-sm font-bold text-slate-800" title={`${user.name} · ${user.role}`}>{user.name}</p>
            <button onClick={logout} className="ml-1 rounded-lg p-2 text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-800" type="button" aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOutIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Celular: campana propia (abre un panel a todo el ancho) + menú */}
        <div className="flex items-center gap-1 md:hidden">
          <button onClick={toggleMobileBell} className="relative rounded-lg p-2 text-slate-700 transition-colors duration-150 hover:bg-slate-100" type="button" aria-expanded={isMobileBellOpen} aria-controls="mobile-notifications" aria-label="Ver notificaciones">
            <BellIcon className="h-5 w-5" aria-hidden="true" />
            {notifications.unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white">{notifications.unread > 9 ? "9+" : notifications.unread}</span>}
          </button>
          <button onClick={() => { setIsMenuOpen((open) => !open); setIsMobileBellOpen(false); }} className="rounded-lg p-2 text-slate-700 transition-colors duration-150 hover:bg-slate-100" type="button" aria-expanded={isMenuOpen} aria-controls="mobile-menu" aria-label="Abrir navegación">
            {isMenuOpen ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {isMobileBellOpen &&
      <div id="mobile-notifications" className="max-h-[70vh] overflow-y-auto border-t border-slate-200 bg-white md:hidden">
          <p className="sticky top-0 border-b border-slate-100 bg-white px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">Notificaciones</p>
          <NotificationItems items={notifications.items} onOpen={(batchId) => { if (batchId) onSelectBatch(batchId); setIsMobileBellOpen(false); }} />
        </div>
      }
      {isMenuOpen &&
      <div id="mobile-menu" className="border-t border-slate-200 bg-white px-4 py-1 md:hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800">
                  {user.initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-800">{user.name}</p>
                  {/*<p className="text-xs text-slate-500">{user.role}</p>*/}
                </div>
              </div>
          
              {/*<p className="text-xs font-semibold text-slate-500">
                Lote · {batchLabel}
              </p>*/}
            </div>
          
            <button
              onClick={logout}
              type="button"
              className="flex min-h-[40px] flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700"
            >
              <LogOutIcon className="h-4 w-10" aria-hidden="true" />
              Cerrar sesión
            </button>
          </div>
        </div>
      }
    </header>);

}

/** Lista de notificaciones (la usan el panel de escritorio y el de celular). */
function NotificationItems({ items, onOpen }: { items: AppNotification[]; onOpen: (batchId: number | null) => void }) {
  if (items.length === 0) return <p className="px-4 py-4 text-sm text-slate-500">Sin notificaciones.</p>;
  return (
    <div className="divide-y divide-slate-100">
      {items.map((item) => (
        <button key={item.id} type="button" onClick={() => onOpen(item.batchId)} className={`block w-full px-4 py-3 text-left transition-colors duration-150 hover:bg-slate-50 ${item.read ? "" : "bg-emerald-50/50"}`}>
          <span className="block text-sm font-bold text-slate-800">{item.title}</span>
          <span className="mt-0.5 block text-xs leading-5 text-slate-500">{item.message}</span>
          <span className="mt-1 block text-[11px] text-slate-400">{formatLongDate(item.createdAt)}</span>
        </button>
      ))}
    </div>
  );
}

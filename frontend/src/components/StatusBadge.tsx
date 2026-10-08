import { RequestStatus } from "../types";

const styles: Record<RequestStatus, string> = {
  Aprobado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Rechazado: "bg-rose-50 text-rose-700 ring-rose-200",
  Pendiente: "bg-amber-50 text-amber-700 ring-amber-200",
  "Más info": "bg-orange-50 text-orange-700 ring-orange-200"
};

/** Barra de color a la izquierda de cada fila según su estado (pendiente = sin barra). */
export const statusBar: Record<RequestStatus, string> = {
  Aprobado: "border-l-emerald-500",
  Rechazado: "border-l-rose-500",
  "Más info": "border-l-amber-400",
  Pendiente: "border-l-transparent"
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-bold ring-1 ring-inset ${styles[status]}`}>{status}</span>;
}

/** Secretaría ya respondió el pedido de "Más info": el Admin debe volver a revisarla. */
export function AnsweredBadge() {
  return <span className="inline-flex whitespace-nowrap rounded-full bg-sky-50 px-2 py-1 text-[11px] font-bold text-sky-700 ring-1 ring-inset ring-sky-200">Respondida</span>;
}

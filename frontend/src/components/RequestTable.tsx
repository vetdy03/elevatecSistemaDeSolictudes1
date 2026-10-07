import React, { useMemo } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { formatCurrency, formatMoney, formatShortDate, sumByCurrency } from "../lib/format";
import { FinancialRequest, RequestStatus } from "../types";

interface RequestTableProps {
  requests: FinancialRequest[];
  onStatusChange: (id: number, status: RequestStatus) => void;
  viewer?: boolean;
  highlightPending?: boolean;
}

const priorityClasses: Record<FinancialRequest["priority"], string> = {
  Alta: "bg-rose-50 text-rose-700 ring-rose-200",
  Media: "bg-amber-50 text-amber-700 ring-amber-200",
  Baja: "bg-slate-100 text-slate-600 ring-slate-200"
};

export function RequestTable({ requests, onStatusChange, viewer = false, highlightPending = false }: RequestTableProps) {
  const categories = useMemo(() => Array.from(new Set(requests.map((request) => request.category))), [requests]);

  return (
    <section aria-label="Solicitudes del lote" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1120px] border-collapse text-left">
          <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">N°</th><th className="px-3 py-3">Fecha</th><th className="min-w-[270px] px-3 py-3">Detalle</th><th className="px-3 py-3 text-right">Importe</th><th className="px-3 py-3">Moneda</th><th className="px-3 py-3">N° trámite</th><th className="px-3 py-3">Solicitado por</th><th className="px-3 py-3">Prioridad</th><th className="px-3 py-3">Regional</th><th className="px-5 py-3 text-right">Decisión</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => <React.Fragment key={category}>
              <tr><td colSpan={10} className="border-y border-slate-200 bg-slate-50 px-5 py-2 text-[11px] font-bold tracking-wide text-slate-500">{category}</td></tr>
              {requests.filter((request) => request.category === category).map((request) => <DesktopRow key={request.id} request={request} onStatusChange={onStatusChange} viewer={viewer} highlight={highlightPending && request.status === "Pendiente"} />)}
            </React.Fragment>)}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 bg-slate-950 text-white">
            <tr><td colSpan={3} className="px-5 py-4 text-sm font-bold">SUMA TOTAL GENERAL</td><td className="px-3 py-4 text-right text-base font-bold">{formatMoney(sumByCurrency(requests))}</td><td colSpan={6} /></tr>
          </tfoot>
        </table>
      </div>

      <div className="divide-y divide-slate-200 lg:hidden">
        {requests.map((request) => <article key={request.id} className={`p-4 ${highlightPending && request.status === "Pendiente" ? "animate-pulse ring-2 ring-inset ring-amber-400" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-semibold text-slate-500">{request.procedure} · {formatShortDate(request.date)}</p><h3 className="mt-1 text-sm font-bold leading-5 text-slate-900">{request.detail}</h3></div>
            <StatusBadge status={request.status} />
          </div>
          <div className="mt-3 flex items-end justify-between gap-4"><div><p className="text-xs text-slate-500">Importe solicitado</p><p className="text-lg font-bold tabular-nums text-slate-950">{request.currency} {formatCurrency(request.amount)}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ring-1 ring-inset ${priorityClasses[request.priority]}`}>{request.priority.toUpperCase()}</span></div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs"><span className="text-slate-500">{request.requester} · {request.region}</span>{!viewer && <Actions request={request} onStatusChange={onStatusChange} viewer={viewer} />}</div>
        </article>)}
        <div className="bg-slate-950 px-4 py-4 text-white"><p className="text-xs font-bold tracking-wide text-slate-300">SUMA TOTAL GENERAL</p><p className="mt-1 text-xl font-bold">{formatMoney(sumByCurrency(requests))}</p></div>
      </div>
    </section>);

}

interface RowProps {request: FinancialRequest;onStatusChange: (id: number, status: RequestStatus) => void;viewer: boolean;highlight: boolean;}
function DesktopRow({ request, onStatusChange, viewer, highlight }: RowProps) {
  return <tr className={`border-b border-slate-100 ${highlight ? "animate-pulse bg-amber-50 outline outline-2 outline-amber-400 -outline-offset-2" : ""}`}>
    <td className="px-5 py-4 text-sm font-semibold text-slate-500">{request.itemNumber}</td><td className="px-3 py-4 text-sm text-slate-600">{formatShortDate(request.date)}</td><td className="px-3 py-4"><p className="max-w-sm text-sm font-medium leading-5 text-slate-800">{request.detail}</p></td><td className="px-3 py-4 text-right text-sm font-bold tabular-nums text-slate-800">{formatCurrency(request.amount)}</td><td className="px-3 py-4 text-sm text-slate-600">{request.currency}</td><td className="px-3 py-4 text-sm font-medium text-blue-800">{request.procedure}</td><td className="px-3 py-4 text-sm text-slate-600">{request.requester}</td><td className="px-3 py-4"><span className={`rounded-full px-2 py-1 text-[11px] font-bold ring-1 ring-inset ${priorityClasses[request.priority]}`}>{request.priority.toUpperCase()}</span></td><td className="px-3 py-4"><span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">{request.region}</span></td><td className="px-5 py-4"><div className="flex min-w-[190px] justify-end"><Actions request={request} onStatusChange={onStatusChange} viewer={viewer} /></div></td>
  </tr>;
}

interface ActionsProps {request: FinancialRequest;onStatusChange: (id: number, status: RequestStatus) => void;viewer: boolean;}
function Actions({ request, onStatusChange, viewer }: ActionsProps) {
  if (viewer) return <StatusBadge status={request.status} />;
  const isApproved = request.status === "Aprobado";
  const isRejected = request.status === "Rechazado";
  return <div className="flex shrink-0 gap-1.5"><button onClick={() => onStatusChange(request.id, "Aprobado")} type="button" aria-pressed={isApproved} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-bold transition-[background-color,color,opacity,box-shadow] duration-150 ${isApproved ? "bg-emerald-600 text-white shadow-sm" : "bg-emerald-50 text-emerald-700 opacity-60 hover:opacity-100"}`}><CheckIcon className="h-3.5 w-3.5" />Aprobar</button><button onClick={() => onStatusChange(request.id, "Rechazado")} type="button" aria-pressed={isRejected} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-bold transition-[background-color,color,opacity,box-shadow] duration-150 ${isRejected ? "bg-rose-600 text-white shadow-sm" : "bg-rose-50 text-rose-700 opacity-60 hover:opacity-100"}`}><XIcon className="h-3.5 w-3.5" />Rechazar</button></div>;
}

function StatusBadge({ status }: {status: RequestStatus;}) {const styles = status === "Aprobado" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : status === "Rechazado" ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-amber-50 text-amber-700 ring-amber-200";return <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-bold ring-1 ring-inset ${styles}`}>{status}</span>;}
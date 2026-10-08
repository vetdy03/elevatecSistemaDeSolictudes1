import React, { useMemo } from "react";
import Swal from "sweetalert2";
import { CheckIcon, MessageCircleQuestionIcon, PaperclipIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { download } from "../api/client";
import { formatCurrency, formatLongDate, formatMoney, formatShortDate, sumByCurrency } from "../lib/format";
import { FinancialRequest, RequestAction } from "../types";
import { AnsweredBadge, StatusBadge, statusBar } from "./StatusBadge";

interface RequestTableProps {
  requests: FinancialRequest[];
  /** Acciones del Admin. Sin esta prop la tabla es de solo lectura. */
  onAction?: (request: FinancialRequest, action: RequestAction) => void;
  highlightPending?: boolean;
  /** Muestra "Autorizado por" como columna junto a Regional (en vez de debajo del solicitante). */
  authorizedColumn?: boolean;
}

const priorityClasses: Record<FinancialRequest["priority"], string> = {
  Alta: "bg-rose-50 text-rose-700 ring-rose-200",
  Media: "bg-amber-50 text-amber-700 ring-amber-200",
  Baja: "bg-slate-100 text-slate-600 ring-slate-200"
};

const isUndecided = (request: FinancialRequest) => request.status === "Pendiente" || request.status === "Más info";

export function RequestTable({ requests, onAction, highlightPending = false, authorizedColumn = false }: RequestTableProps) {
  const columns = authorizedColumn ? 11 : 10;
  // Orden fijo por N° de ítem: las filas no cambian de lugar al decidirlas.
  const sorted = useMemo(() => [...requests].sort((a, b) => a.itemNumber - b.itemNumber), [requests]);
  const categories = useMemo(() => Array.from(new Set(requests.map((request) => request.category))), [requests]);
  const totals = formatMoney(sumByCurrency(requests));

  return (
    <section aria-label="Solicitudes del lote" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1180px] border-collapse text-left">
          <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">N°</th><th className="px-3 py-3">Fecha</th><th className="min-w-[270px] px-3 py-3">Detalle</th><th className="px-3 py-3 text-right">Importe</th><th className="px-3 py-3">Moneda</th><th className="px-3 py-3">N° trámite</th><th className="px-3 py-3">Solicitado por</th><th className="px-3 py-3">Prioridad</th><th className="px-3 py-3">Regional</th>{authorizedColumn && <th className="px-3 py-3">Autorizado por</th>}<th className="px-5 py-3 text-right">Decisión</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => <React.Fragment key={category}>
              <tr><td colSpan={columns} className="border-y border-slate-300 bg-slate-200/70 px-5 py-2 text-[11px] font-bold tracking-wide text-slate-500">{category}</td></tr>
              {sorted.filter((request) => request.category === category).map((request, index) => <DesktopRow key={request.id} request={request} authorizedColumn={authorizedColumn} striped={index % 2 === 1} onAction={onAction} highlight={highlightPending && isUndecided(request)} />)}
            </React.Fragment>)}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 bg-slate-950 text-white">
            <tr><td colSpan={3} className="px-5 py-4 text-sm font-bold">SUMA TOTAL GENERAL</td><td className="px-3 py-4 text-right text-base font-bold">{totals}</td><td colSpan={columns - 4} /></tr>
          </tfoot>
        </table>
      </div>

      <div className="divide-y divide-slate-300 lg:hidden">
        {sorted.map((request, index) => <article key={request.id} className={`border-l-4 p-4 ${statusBar[request.status]} ${index % 2 === 1 ? STRIPE : "bg-white"} ${highlightPending && isUndecided(request) ? "animate-pulse ring-2 ring-inset ring-amber-400" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div><p className="flex items-center gap-1 text-xs font-semibold text-slate-500">{request.procedure}<RetryMark request={request} /> · {formatShortDate(request.date)}</p><h3 className="mt-1 text-sm font-bold leading-5 text-slate-900">{request.detail}</h3></div>
            <div className="flex shrink-0 flex-col items-end gap-1"><StatusBadge status={request.status} />{isAnswered(request) && <AnsweredBadge />}</div>
          </div>
          <RowNotes request={request} />
          <div className="mt-3 flex items-end justify-between gap-4"><div><p className="text-xs text-slate-500">Importe solicitado</p><p className="text-lg font-bold tabular-nums text-slate-950">{request.currency} {formatCurrency(request.amount)}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ring-1 ring-inset ${priorityClasses[request.priority]}`}>{request.priority.toUpperCase()}</span></div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs">
            <p className="text-slate-500">{request.requester} · {request.region}</p>
            <Authorized request={request} />
            {onAction && <div className="mt-3"><Actions request={request} onAction={onAction} /></div>}
          </div>
        </article>)}
        <div className="bg-slate-950 px-4 py-4 text-white"><p className="text-xs font-bold tracking-wide text-slate-300">SUMA TOTAL GENERAL</p><p className="mt-1 text-xl font-bold">{totals}</p></div>
      </div>
    </section>);

}

const isAnswered = (request: FinancialRequest) => request.status === "Pendiente" && request.infoAnsweredAt !== null;

/** Franja de las filas intercaladas: gris opaco, visible pero suave. */
const STRIPE = "bg-slate-100";

interface RowProps {request: FinancialRequest;authorizedColumn: boolean;striped: boolean;onAction?: RequestTableProps["onAction"];highlight: boolean;}
function DesktopRow({ request, authorizedColumn, striped, onAction, highlight }: RowProps) {
  return <tr className={`border-b border-slate-300 ${highlight ? "animate-pulse bg-amber-50 outline outline-2 outline-amber-400 -outline-offset-2" : striped ? STRIPE : "bg-white"}`}>
    <td className={`border-l-4 px-5 py-4 align-top text-sm font-semibold text-slate-500 ${statusBar[request.status]}`}>{request.itemNumber}</td>
    <td className="px-3 py-4 align-top text-sm text-slate-600">{formatShortDate(request.date)}</td>
    <td className="px-3 py-4 align-top"><p className="max-w-sm text-sm font-medium leading-5 text-slate-800">{request.detail}</p><RowNotes request={request} /></td>
    <td className="px-3 py-4 text-right align-top text-sm font-bold tabular-nums text-slate-800">{formatCurrency(request.amount)}</td>
    <td className="px-3 py-4 align-top text-sm text-slate-600">{request.currency}</td>
    <td className="px-3 py-4 align-top text-sm font-medium text-blue-800"><span className="inline-flex items-center gap-1">{request.procedure}<RetryMark request={request} /></span></td>
    <td className="px-3 py-4 align-top text-sm text-slate-600">{request.requester}{!authorizedColumn && <Authorized request={request} />}</td>
    <td className="px-3 py-4 align-top"><span className={`rounded-full px-2 py-1 text-[11px] font-bold ring-1 ring-inset ${priorityClasses[request.priority]}`}>{request.priority.toUpperCase()}</span></td>
    <td className="px-3 py-4 align-top"><span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">{request.region}</span></td>
    {authorizedColumn && <td className="px-3 py-4 align-top text-sm text-slate-600">{request.authorizedBy || <span className="text-slate-400">—</span>}</td>}
    <td className="px-5 py-4 align-top"><div className="flex min-w-[250px] flex-col items-end gap-1.5">{onAction ? <Actions request={request} onAction={onAction} /> : <StatusBadge status={request.status} />}{isAnswered(request) && <AnsweredBadge />}</div></td>
  </tr>;
}

/** "Autorizó: Nombre" debajo del solicitante; guion si la planilla no lo trajo. */
function Authorized({ request }: {request: FinancialRequest;}) {
  return <span className="mt-0.5 block text-[11px] text-slate-400">Autorizó: {request.authorizedBy || "—"}</span>;
}

/** Motivo de rechazo y conversación de "Más info" debajo del detalle. */
function RowNotes({ request }: {request: FinancialRequest;}) {
  const conversation = request.conversation ?? [];
  if (!request.rejectionReason && conversation.length === 0) return null;
  // Se muestran las 2 últimas entradas; el resto queda plegado.
  const recent = conversation.slice(-2);
  const older = conversation.slice(0, -2);
  return <div className="mt-2 max-w-md space-y-1.5">
    {request.status === "Rechazado" && request.rejectionReason && <p className="rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-800"><strong>Motivo del rechazo:</strong> {request.rejectionReason}</p>}
    {older.length > 0 && <details className="text-xs text-slate-500"><summary className="cursor-pointer font-semibold">Ver conversación anterior ({older.length})</summary><div className="mt-1.5 space-y-1.5">{older.map((entry) => <ConversationLine key={entry.id} entry={entry} />)}</div></details>}
    {recent.map((entry) => <ConversationLine key={entry.id} entry={entry} />)}
  </div>;
}

function ConversationLine({ entry }: {entry: NonNullable<FinancialRequest["conversation"]>[number];}) {
  const question = entry.type === "question";
  const fetchAttachment = () => entry.attachmentUrl && download(entry.attachmentUrl, entry.attachmentName ?? "adjunto").catch(() => Swal.fire({ icon: "error", title: "No se pudo descargar el adjunto", confirmButtonColor: "#0f4c81" }));
  return <div className={`rounded-md px-2 py-1 text-xs ${question ? "bg-orange-50 text-orange-900" : "bg-sky-50 text-sky-900"}`}>
    <p><strong>{question ? "Pregunta" : "Respuesta"}</strong> · {entry.user ?? "—"} · {formatLongDate(entry.createdAt)}</p>
    <p className="mt-0.5 whitespace-pre-line">{entry.body}</p>
    {entry.attachmentUrl && <button type="button" onClick={fetchAttachment} className="mt-1 inline-flex items-center gap-1 font-bold underline"><PaperclipIcon className="h-3 w-3" />{entry.attachmentName ?? "Adjunto"}</button>}
  </div>;
}

/**
 * Marca discreta de reintento de una solicitud rechazada (el dato solo llega al Admin).
 * Botón pequeño: al pasar el mouse muestra el detalle; al tocar (celular) abre un aviso.
 */
function RetryMark({ request }: {request: FinancialRequest;}) {
  const retry = request.retry;
  if (!retry) return null;
  const detail = `Reintento de una solicitud rechazada${retry.batchCode ? ` en ${retry.batchCode}` : ""}${retry.rejectedAt ? ` el ${formatLongDate(retry.rejectedAt)}` : ""}${retry.procedure !== request.procedure ? ` (N° de trámite original: ${retry.procedure})` : ""}.${retry.reason ? ` Motivo: ${retry.reason}` : ""}`;
  return <button type="button" title={detail} aria-label={detail} onClick={() => Swal.fire({ icon: "info", title: "Reintento de solicitud rechazada", text: detail, confirmButtonColor: "#0f4c81" })} className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200">
    <RotateCcwIcon className="h-2.5 w-2.5" />
  </button>;
}

interface ActionsProps {request: FinancialRequest;onAction: NonNullable<RequestTableProps["onAction"]>;}
function Actions({ request, onAction }: ActionsProps) {
  const button = (action: RequestAction, active: boolean, label: string, icon: React.ReactNode, on: string, off: string) =>
    <button onClick={() => onAction(request, action)} type="button" aria-pressed={active} title={active ? "Pulsa de nuevo para deshacer" : undefined} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-bold transition-[background-color,color,opacity,box-shadow] duration-150 ${active ? `${on} text-white shadow-sm` : `${off} opacity-60 hover:opacity-100`}`}>{icon}{label}</button>;

  return <div className="flex flex-wrap justify-end gap-1.5">
    {button("approve", request.status === "Aprobado", "Aprobar", <CheckIcon className="h-3.5 w-3.5" />, "bg-emerald-600", "bg-emerald-50 text-emerald-700")}
    {button("reject", request.status === "Rechazado", "Rechazar", <XIcon className="h-3.5 w-3.5" />, "bg-rose-600", "bg-rose-50 text-rose-700")}
    {button("info", request.status === "Más info", "Más info", <MessageCircleQuestionIcon className="h-3.5 w-3.5" />, "bg-orange-500", "bg-orange-50 text-orange-700")}
  </div>;
}

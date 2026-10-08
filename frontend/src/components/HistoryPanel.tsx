import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { CalendarDaysIcon, ChevronDownIcon, FileDownIcon, FileSpreadsheetIcon, LoaderCircleIcon, SearchIcon, SquareArrowOutUpRightIcon } from "lucide-react";
import { api, download } from "../api/client";
import { BatchFilters, useBatches } from "../hooks/useBatches";
import { formatCurrency, formatLongDate, formatMoney, sumByCurrency } from "../lib/format";
import { Batch, FinancialRequest } from "../types";
import { StatusBadge } from "./StatusBadge";

interface HistoryPanelProps {
  onOpen: (batchId: number) => void;
  refreshKey?: number;
  canDownload?: boolean;
}

/** Ancho común de los botones del histórico: todo el ancho en celular, 176 px en escritorio. */
const WIDE_BUTTON = "inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors duration-150 disabled:opacity-60 sm:w-44";

/**
 * Histórico de lotes (mismo componente para Admin, Secretaría y Colaborador).
 * Al hacer clic en un lote se despliega su detalle aquí mismo, sin cambiar de pantalla.
 */
export function HistoryPanel({ onOpen, refreshKey = 0, canDownload = true }: HistoryPanelProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Todos");
  const [showRange, setShowRange] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const { batches: records, loading, error } = useBatches({ q: query, status: status === "Todos" ? undefined : status as BatchFilters["status"], from, to }, refreshKey);

  // Solo un lote desplegado a la vez
  const toggle = (id: number) => setOpenId((current) => (current === id ? null : id));

  return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-base font-bold text-slate-950">Histórico de lotes</h2><p className="mt-1 text-sm text-slate-500">Despliega un lote para ver su resumen y descargarlo.</p></div><div className="grid gap-2 sm:grid-cols-3"><label className="relative"><span className="sr-only">Buscar lote</span><SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar lote" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-600"><option>Todos</option><option>Completado</option><option>Pendiente</option></select><button onClick={() => setShowRange((open) => !open)} aria-expanded={showRange} type="button" className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors duration-150 ${from || to ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}><CalendarDaysIcon className="h-4 w-4" />Rango de fechas</button></div></div>
    {showRange && <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3 sm:flex-row sm:items-center"><label className="flex items-center gap-2 text-xs font-semibold text-slate-500">Desde<input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-600" /></label><label className="flex items-center gap-2 text-xs font-semibold text-slate-500">Hasta<input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-600" /></label>{(from || to) && <button type="button" onClick={() => { setFrom(""); setTo(""); }} className="text-xs font-bold text-blue-800">Limpiar</button>}</div>}
    <div className="divide-y divide-slate-100">{records.map((batch) => {
      const open = openId === batch.id;
      return <article key={batch.id} className={open ? "bg-slate-50/60" : undefined}>
        <div onClick={() => toggle(batch.id)} className="flex cursor-pointer flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className="mt-0.5 rounded-lg bg-blue-50 p-2 text-blue-700"><CalendarDaysIcon className="h-4 w-4" /></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-slate-800">{batch.code}</h3><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${batch.status === "Completado" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{batch.status}</span></div><p className="mt-1 text-sm text-slate-600">{batch.title}</p><p className="mt-1 text-xs text-slate-400">{formatLongDate(batch.completedAt ?? batch.date)} · {batch.items} solicitudes</p></div></div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5"><p className="text-sm font-bold tabular-nums text-slate-800">{formatMoney({ Bs: batch.total, USD: batch.totalUsd })}</p><button type="button" aria-expanded={open} onClick={(event) => { event.stopPropagation(); toggle(batch.id); }} className={`${WIDE_BUTTON} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}><ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />{open ? "Ocultar lote" : "Desplegar lote"}</button></div>
        </div>
        {open && <BatchDetail batchId={batch.id} onOpen={onOpen} canDownload={canDownload} />}
      </article>;
    })}
    {loading && records.length === 0 && <p className="p-10 text-center text-sm text-slate-500">Cargando lotes…</p>}
    {error && <p className="p-10 text-center text-sm text-rose-700">{error}</p>}
    {!loading && !error && records.length === 0 && <p className="p-10 text-center text-sm text-slate-500">No hay lotes que coincidan con los filtros.</p>}</div></section>;
}

/** Detalle desplegado: mini-resumen, lista compacta y botones de descarga. */
function BatchDetail({ batchId, onOpen, canDownload }: {batchId: number;onOpen: (id: number) => void;canDownload: boolean;}) {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"pdf" | "xlsx" | null>(null);

  useEffect(() => {
    let active = true;
    api<{ data: Batch }>(`/batches/${batchId}`)
      .then((res) => { if (active) setBatch(res.data); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "No se pudo cargar el lote."); });
    return () => { active = false; };
  }, [batchId]);

  if (error) return <p className="px-5 pb-5 text-sm font-semibold text-rose-700">{error}</p>;
  if (!batch) return <div className="flex justify-center px-5 pb-6 text-slate-500"><LoaderCircleIcon className="h-5 w-5 animate-spin" aria-label="Cargando detalle" /></div>;

  const rows = batch.requests ?? [];
  const count = (status: FinancialRequest["status"]) => rows.filter((row) => row.status === status).length;
  const money = (status: FinancialRequest["status"]) => formatMoney(sumByCurrency(rows, (row) => row.status === status));

  const fetchFile = async (kind: "pdf" | "xlsx") => {
    setBusy(kind);
    try {
      if (kind === "pdf") await download(`/pdf/export?batch_id=${batch.id}&full=1`, `${batch.code}.pdf`);
      else await download(`/excel/export?batch_id=${batch.id}`, `${batch.code}.xlsx`);
    } catch {
      Swal.fire({ icon: "error", title: "No se pudo generar el archivo", confirmButtonColor: "#0f4c81" });
    } finally {
      setBusy(null);
    }
  };

  return <div className="px-5 pb-5">
    <div className="grid gap-2 sm:grid-cols-4">
      <Summary tone="border-emerald-200 bg-emerald-50 text-emerald-800" label="Aprobadas" count={count("Aprobado")} amount={money("Aprobado")} />
      <Summary tone="border-rose-200 bg-rose-50 text-rose-800" label="Rechazadas" count={count("Rechazado")} amount={money("Rechazado")} />
      <Summary tone="border-amber-200 bg-amber-50 text-amber-800" label="Pendientes" count={count("Pendiente")} />
      <Summary tone="border-orange-200 bg-orange-50 text-orange-800" label="Más info" count={count("Más info")} />
    </div>
    <ul className="mt-3 max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white">
      {rows.map((row) => <li key={row.id} className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-center sm:gap-3">
        <span className="w-8 shrink-0 text-xs font-semibold text-slate-400">{row.itemNumber}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-slate-800">{row.detail}</span><span className="block text-xs text-slate-400">{row.procedure} · {row.requester}{row.status === "Rechazado" && row.rejectionReason ? <span className="text-rose-600"> · Motivo: {row.rejectionReason}</span> : null}</span></span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">{row.currency} {formatCurrency(row.amount)}</span>
        <span className="shrink-0"><StatusBadge status={row.status} /></span>
      </li>)}
      {rows.length === 0 && <li className="px-3 py-4 text-center text-sm text-slate-500">Este lote no tiene solicitudes.</li>}
    </ul>
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
      <button type="button" onClick={() => onOpen(batch.id)} className={`${WIDE_BUTTON} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}><SquareArrowOutUpRightIcon className="h-4 w-4" />Abrir lote completo</button>
      {canDownload && <>
        <button type="button" disabled={busy !== null} onClick={() => fetchFile("xlsx")} className={`${WIDE_BUTTON} border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100`}>{busy === "xlsx" ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : <FileSpreadsheetIcon className="h-4 w-4" />}Descargar Excel</button>
        <button type="button" disabled={busy !== null} onClick={() => fetchFile("pdf")} className={`${WIDE_BUTTON} bg-blue-800 text-white hover:bg-blue-950`}>{busy === "pdf" ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : <FileDownIcon className="h-4 w-4" />}Descargar PDF</button>
      </>}
    </div>
  </div>;
}

function Summary({ tone, label, count, amount }: {tone: string;label: string;count: number;amount?: string;}) {
  return <div className={`rounded-xl border px-3 py-2 ${tone}`}><p className="text-xs font-semibold">{label}</p><p className="text-lg font-bold tabular-nums">{count}</p>{amount && <p className="text-xs tabular-nums">{amount}</p>}</div>;
}

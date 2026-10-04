import { useState } from "react";
import Swal from "sweetalert2";
import { CalendarDaysIcon, DownloadIcon, LoaderCircleIcon, SearchIcon, SquareArrowOutUpRightIcon } from "lucide-react";
import { download } from "../api/client";
import { BatchFilters, useBatches } from "../hooks/useBatches";
import { formatCurrency, formatLongDate } from "../lib/format";

interface HistoryPanelProps {
  onOpen: (batchId: number) => void;
  refreshKey?: number;
  canDownload?: boolean;
}

export function HistoryPanel({ onOpen, refreshKey = 0, canDownload = true }: HistoryPanelProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Todos");
  const [showRange, setShowRange] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [downloading, setDownloading] = useState<number | null>(null);
  const { batches: records, loading, error } = useBatches({ q: query, status: status === "Todos" ? undefined : status as BatchFilters["status"], from, to }, refreshKey);

  const downloadBatch = async (id: number, code: string) => {
    setDownloading(id);
    try {
      await download(`/pdf/export?batch_id=${id}&full=1`, `${code}.pdf`);
    } catch {
      Swal.fire({ icon: "error", title: "No se pudo generar el reporte", confirmButtonColor: "#0f4c81" });
    } finally {
      setDownloading(null);
    }
  };

  return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-base font-bold text-slate-950">Histórico de lotes</h2><p className="mt-1 text-sm text-slate-500">Consulta y descarga decisiones ya procesadas.</p></div><div className="grid gap-2 sm:grid-cols-3"><label className="relative"><span className="sr-only">Buscar lote</span><SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar lote" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-600"><option>Todos</option><option>Completado</option><option>Pendiente</option></select><button onClick={() => setShowRange((open) => !open)} aria-expanded={showRange} type="button" className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors duration-150 ${from || to ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}><CalendarDaysIcon className="h-4 w-4" />Rango de fechas</button></div></div>
    {showRange && <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3 sm:flex-row sm:items-center"><label className="flex items-center gap-2 text-xs font-semibold text-slate-500">Desde<input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-600" /></label><label className="flex items-center gap-2 text-xs font-semibold text-slate-500">Hasta<input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-600" /></label>{(from || to) && <button type="button" onClick={() => { setFrom(""); setTo(""); }} className="text-xs font-bold text-blue-800">Limpiar</button>}</div>}
    <div className="divide-y divide-slate-100">{records.map((batch) => <article key={batch.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className="mt-0.5 rounded-lg bg-blue-50 p-2 text-blue-700"><CalendarDaysIcon className="h-4 w-4" /></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-slate-800">{batch.code}</h3><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${batch.status === "Completado" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{batch.status}</span></div><p className="mt-1 text-sm text-slate-600">{batch.title}</p><p className="mt-1 text-xs text-slate-400">{formatLongDate(batch.completedAt ?? batch.date)} · {batch.items} solicitudes</p></div></div><div className="flex items-center justify-between gap-5 sm:justify-end"><p className="text-sm font-bold tabular-nums text-slate-800">Bs {formatCurrency(batch.total)}</p><div className="flex gap-1"><button onClick={() => onOpen(batch.id)} className="rounded-lg p-2 text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-800" type="button" aria-label={`Abrir ${batch.code}`} title="Abrir lote"><SquareArrowOutUpRightIcon className="h-4 w-4" /></button>{canDownload && <button onClick={() => downloadBatch(batch.id, batch.code)} disabled={downloading === batch.id} className="rounded-lg p-2 text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50" type="button" aria-label={`Descargar ${batch.code}`} title="Descargar reporte PDF">{downloading === batch.id ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}</button>}</div></div></article>)}
    {loading && records.length === 0 && <p className="p-10 text-center text-sm text-slate-500">Cargando lotes…</p>}
    {error && <p className="p-10 text-center text-sm text-rose-700">{error}</p>}
    {!loading && !error && records.length === 0 && <p className="p-10 text-center text-sm text-slate-500">No hay lotes que coincidan con los filtros.</p>}</div></section>;
}

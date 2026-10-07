import React, { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { motion } from "framer-motion";
import { CheckCircle2Icon, ClipboardListIcon, FileDownIcon, FileSpreadsheetIcon, FileUpIcon, InboxIcon, LoaderCircleIcon, PlusIcon, SendIcon, UploadCloudIcon } from "lucide-react";
import { ApiError, api, download } from "../api/client";
import { HistoryPanel } from "../components/HistoryPanel";
import { RequestTable } from "../components/RequestTable";
import { useBatch } from "../hooks/useBatch";
import { formatCurrency, formatLongDate, formatMoney, formatUpdated, sumByCurrency, todayIso } from "../lib/format";
import { Batch, Currency, FinancialRequest, ImportPreview, MoneyTotals, Priority, RequestStatus, UserRole } from "../types";

type AdminTab = "activo" | "historial";
type SecretaryTab = "cargar" | "monitoreo";
type BatchState = ReturnType<typeof useBatch>;
/** Montos por moneda (Bs y USD no se suman entre sí) y cantidad de filas pendientes. */
interface Totals {requested: MoneyTotals;approved: MoneyTotals;rejected: MoneyTotals;pending: number;}

interface ResourceRequestsPlatformProps {
  role: UserRole;
  batchState: BatchState;
  refreshKey: number;
  /** Cambia cada vez que se pide abrir un lote: salta a la pestaña donde se ve. */
  focusSignal: number;
  onBatchesChanged: () => void;
  onOpenBatch: (id: number | null) => void;
}

/** Primer mensaje legible de un error de la API (422 de Laravel incluido). */
function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const errors = (error.data as { errors?: Record<string, string[]> } | undefined)?.errors;
    const first = errors ? Object.values(errors).flat()[0] : undefined;
    return first ?? error.message ?? fallback;
  }
  return fallback;
}

export function ResourceRequestsPlatform({ role, batchState, refreshKey, focusSignal, onBatchesChanged, onOpenBatch }: ResourceRequestsPlatformProps) {
  const { batch, requests, loading, error } = batchState;
  const [adminTab, setAdminTab] = useState<AdminTab>("activo");
  const [secretaryTab, setSecretaryTab] = useState<SecretaryTab>("cargar");
  const [highlightPending, setHighlightPending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const totals = useMemo<Totals>(() => ({ requested: sumByCurrency(requests), approved: sumByCurrency(requests, (row) => row.status === "Aprobado"), rejected: sumByCurrency(requests, (row) => row.status === "Rechazado"), pending: requests.filter((row) => row.status === "Pendiente").length }), [requests]);

  useEffect(() => setHighlightPending(false), [batch?.id]);

  // Al abrir un lote (notificación, histórico, selector) se muestra la pestaña donde se ve ese lote.
  useEffect(() => {
    if (focusSignal === 0) return;
    setAdminTab("activo");
    setSecretaryTab("monitoreo");
  }, [focusSignal]);

  const showToast = (message: string) => {setToast(message);window.setTimeout(() => setToast(null), 2600);};

  const updateStatus = async (id: number, status: RequestStatus) => {
    try {
      const pending = batchState.updateStatus(id, status);
      showToast(status === "Aprobado" ? "Solicitud aprobada y total actualizado" : "Solicitud rechazada y total actualizado");
      await pending;
    } catch (err) {
      setToast(null);
      Swal.fire({ icon: "error", title: "No se guardó la decisión", text: errorMessage(err, "Inténtalo de nuevo."), confirmButtonColor: "#0f4c81" });
    }
  };

  const finalize = async () => {
    if (!batch) return;
    if (totals.pending > 0) {setHighlightPending(true);await Swal.fire({ icon: "warning", title: "Aún hay solicitudes sin decisión", text: `Revisa las ${totals.pending} filas resaltadas antes de finalizar el lote.`, confirmButtonText: "Continuar revisando", confirmButtonColor: "#b45309" });return;}
    try {
      await batchState.finalize();
      setHighlightPending(false);
      onBatchesChanged();
      await Swal.fire({ icon: "success", title: "Lote finalizado", text: `La Secretaría recibió una notificación con el resultado del lote ${batch.code}.`, confirmButtonText: "Entendido", confirmButtonColor: "#0f4c81" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setHighlightPending(true);
        await batchState.reload();
      }
      Swal.fire({ icon: "error", title: "No se pudo finalizar el lote", text: errorMessage(err, "Inténtalo de nuevo."), confirmButtonColor: "#0f4c81" });
    }
  };

  const openFromHistory = (id: number) => onOpenBatch(id);
  const showActiveBatch = () => onOpenBatch(null);

  return <main className="min-h-[calc(100vh-4rem)] bg-slate-50"><div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{toast && <div role="status" className="fixed bottom-5 right-5 z-50 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg">{toast}</div>}
    {role === "Admin" && <AdminWorkspace onReset={showActiveBatch} batchState={batchState} totals={totals} adminTab={adminTab} setAdminTab={setAdminTab} updateStatus={updateStatus} finalize={finalize} highlightPending={highlightPending} refreshKey={refreshKey} onOpenBatch={openFromHistory} />}
    {role === "Secretaría" && <SecretaryWorkspace onReset={showActiveBatch} batchState={batchState} tab={secretaryTab} setTab={setSecretaryTab} showToast={showToast} refreshKey={refreshKey} onBatchesChanged={onBatchesChanged} onOpenBatch={onOpenBatch} onOpenFromHistory={openFromHistory} />}
    {role === "Colaborador" && <ViewerWorkspace onReset={showActiveBatch} batch={batch} requests={requests} loading={loading} error={error} refreshKey={refreshKey} onOpenBatch={openFromHistory} />}
  </div></main>;
}

function BatchStatus({ loading, error, batch, onReset, children }: {loading: boolean;error: string | null;batch: Batch | null;onReset?: () => void;children: React.ReactNode;}) {
  if (loading && !batch) return <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-16 text-slate-500"><LoaderCircleIcon className="h-6 w-6 animate-spin" aria-label="Cargando lote" /></div>;
  if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center text-sm font-semibold text-rose-700"><p>{error}</p>{onReset && <button type="button" onClick={onReset} className="mt-4 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-800 hover:bg-rose-100">Ver el lote activo</button>}</div>;
  if (!batch) return <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-14 text-center"><InboxIcon className="h-8 w-8 text-slate-400" /><p className="mt-3 font-bold text-slate-800">No hay lotes pendientes</p><p className="mt-1 text-sm text-slate-500">Cuando Secretaría publique un nuevo lote aparecerá aquí.</p></div>;
  return <>{children}</>;
}

interface AdminProps {onReset: () => void;batchState: BatchState;totals: Totals;adminTab: AdminTab;setAdminTab: (value: AdminTab) => void;updateStatus: (id: number, status: RequestStatus) => void;finalize: () => void;highlightPending: boolean;refreshKey: number;onOpenBatch: (id: number) => void;}
function AdminWorkspace({ onReset, batchState, totals, adminTab, setAdminTab, updateStatus, finalize, highlightPending, refreshKey, onOpenBatch }: AdminProps) {
  const { batch, requests, loading, error } = batchState;
  const completed = batch?.status === "Completado";
  return <><div className="mb-6 border-b border-slate-200"><nav aria-label="Secciones de administrador" className="flex gap-5"><Tab label="Lote activo" active={adminTab === "activo"} onClick={() => setAdminTab("activo")} /><Tab label="Histórico de lotes" active={adminTab === "historial"} onClick={() => setAdminTab("historial")} /></nav></div>
    {adminTab === "activo" ? <BatchStatus loading={loading} error={error} batch={batch} onReset={onReset}>{batch && <><BatchHeading batch={batch} totals={totals} /><RequestTable requests={requests} onStatusChange={updateStatus} highlightPending={highlightPending} viewer={completed} />
      {completed ? <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><strong>Lote finalizado</strong>{batch.completedAt && ` el ${formatLongDate(batch.completedAt)}`}. Las decisiones ya no pueden modificarse.</div> : <div className="mt-5 flex flex-col items-start justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 sm:flex-row sm:items-center"><p className="text-sm text-blue-950"><strong>Control de cierre:</strong> {requests.length === 0 ? "Este lote no tiene solicitudes; no se puede finalizar." : totals.pending ? `${totals.pending} solicitudes esperan tu decisión.` : "Todas las solicitudes fueron revisadas."}</p><button onClick={finalize} disabled={requests.length === 0} type="button" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors duration-150 hover:bg-blue-950 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"><SendIcon className="h-4 w-4" />Finalizar y notificar lote</button></div>}</>}</BatchStatus> : <HistoryPanel onOpen={onOpenBatch} refreshKey={refreshKey} />}</>;
}
function BatchHeading({ batch, totals }: {batch: Batch;totals: Totals;}) {const completed = batch.status === "Completado";return <section className="mb-5"><div className="flex flex-col gap-3 rounded-t-2xl bg-slate-950 px-5 py-5 text-white md:flex-row md:items-center md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-blue-800 px-2 py-1 text-xs font-bold">{batch.code}</span>{completed ? <span className="rounded-full bg-emerald-400/20 px-2 py-1 text-xs font-bold text-emerald-200">COMPLETADO</span> : <span className="rounded-full bg-amber-400/20 px-2 py-1 text-xs font-bold text-amber-200">EN REVISIÓN</span>}</div><h2 className="mt-3 text-lg font-bold sm:text-xl">{batch.title}</h2></div><p className="text-sm text-slate-300">Última actualización · {formatUpdated(batch.updatedAt)}</p></div><div className="grid grid-cols-2 divide-x divide-y divide-slate-200 overflow-hidden rounded-b-2xl border border-slate-200 bg-white md:grid-cols-4 md:divide-y-0"><Metric label="Total solicitado" value={totals.requested} tone="text-slate-950" /><Metric label="Total aprobado" value={totals.approved} tone="text-emerald-700" /><Metric label="Total rechazado" value={totals.rejected} tone="text-rose-700" /><div className="p-4"><p className="text-xs font-semibold text-slate-500">Filas pendientes</p><p className="mt-1 text-2xl font-bold tabular-nums text-amber-700">{totals.pending}</p></div></div></section>;}
function Metric({ label, value, tone }: {label: string;value: MoneyTotals;tone: string;}) {const text = formatMoney(value);return <div className="p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><motion.p key={text} initial={{ opacity: 0.35, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: "easeOut" }} className={`mt-1 text-xl font-bold tabular-nums ${tone}`}>{text}</motion.p></div>;}
function Tab({ label, active, onClick }: {label: string;active: boolean;onClick: () => void;}) {return <button onClick={onClick} type="button" className={`border-b-2 px-1 pb-3 text-sm font-bold transition-colors duration-150 ${active ? "border-blue-700 text-blue-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{label}</button>;}

// ---------------------------------------------------------------------------
// Secretaría
// ---------------------------------------------------------------------------

interface SecretaryProps {onReset: () => void;batchState: BatchState;tab: SecretaryTab;setTab: (tab: SecretaryTab) => void;showToast: (message: string) => void;refreshKey: number;onBatchesChanged: () => void;onOpenBatch: (id: number | null) => void;onOpenFromHistory: (id: number) => void;}
function SecretaryWorkspace({ onReset, batchState, tab, setTab, showToast, refreshKey, onBatchesChanged, onOpenBatch, onOpenFromHistory }: SecretaryProps) {
  return <><div className="mb-6 flex flex-col gap-4 border-b border-slate-200 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-blue-800">Recepción y control</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Operación de lotes</h1></div><nav className="flex gap-5"><Tab label="Cargar nuevo lote" active={tab === "cargar"} onClick={() => setTab("cargar")} /><Tab label="Lotes enviados" active={tab === "monitoreo"} onClick={() => setTab("monitoreo")} /></nav></div>
    {tab === "cargar" ? <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><ImportCard onPublished={() => {onBatchesChanged();onOpenBatch(null);}} /><ManualEntryCard batchState={batchState} showToast={showToast} /></section> : <MonitorPanel onReset={onReset} batchState={batchState} refreshKey={refreshKey} onOpenBatch={onOpenFromHistory} />}</>;
}

function ImportCard({ onPublished }: {onPublished: () => void;}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState<"preview" | "publish" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {setFile(null);setPreview(null);setTitle("");if (inputRef.current) inputRef.current.value = "";};

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!/\.(xlsx|csv)$/i.test(selected.name)) {Swal.fire({ icon: "error", title: "Formato no compatible", text: "Selecciona un archivo .xlsx o .csv.", confirmButtonColor: "#0f4c81" });event.target.value = "";return;}
    if (selected.size > 10 * 1024 * 1024) {Swal.fire({ icon: "error", title: "Archivo demasiado grande", text: "El máximo es 10 MB.", confirmButtonColor: "#0f4c81" });event.target.value = "";return;}
    const body = new FormData();
    body.append("file", selected);
    setBusy("preview");
    try {
      const result = await api<ImportPreview>("/excel/preview", { method: "POST", body });
      setFile(selected);
      setPreview(result);
      const [year, month, day] = todayIso().split("-");
      const months = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
      setTitle(`SOLICITUDES AL ${Number(day)} DE ${months[Number(month) - 1]} ${year}`);
    } catch (err) {
      reset();
      Swal.fire({ icon: "error", title: "No se pudo leer el archivo", text: errorMessage(err, "Verifica el archivo e inténtalo de nuevo."), confirmButtonColor: "#0f4c81" });
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    if (!file || !title.trim()) return;
    const body = new FormData();
    body.append("file", file);
    body.append("title", title.trim());
    setBusy("publish");
    try {
      const res = await api<{ data: Batch }>("/excel/import", { method: "POST", body });
      reset();
      onPublished();
      Swal.fire({ icon: "success", title: "Lote enviado a aprobación", text: `El lote ${res.data.code} con ${res.data.items} solicitudes ya está disponible para el Administrador.`, confirmButtonColor: "#0f4c81" });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo publicar el lote", text: errorMessage(err, "Inténtalo de nuevo."), confirmButtonColor: "#0f4c81" });
    } finally {
      setBusy(null);
    }
  };

  const downloadTemplate = () => download("/excel/template", "plantilla-solicitudes.xlsx").catch(() => Swal.fire({ icon: "error", title: "No se pudo descargar la plantilla", confirmButtonColor: "#0f4c81" }));
  const hasErrors = (preview?.errors.length ?? 0) > 0;

  return <><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><UploadCloudIcon className="h-5 w-5" /></div><div><h2 className="font-bold text-slate-900">Importar desde archivo</h2><p className="mt-1 text-sm text-slate-500">Carga una plantilla .xlsx o .csv para validar las columnas antes de publicar. <button type="button" onClick={downloadTemplate} className="font-bold text-blue-800 hover:underline">Descargar plantilla</button></p></div></div><label className="mt-6 flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 text-center transition-colors duration-150 hover:border-blue-500 hover:bg-blue-50">{busy === "preview" ? <LoaderCircleIcon className="h-8 w-8 animate-spin text-blue-700" /> : <FileUpIcon className="h-8 w-8 text-blue-700" />}<span className="mt-3 text-sm font-bold text-slate-800">Arrastra tu archivo o haz clic para cargarlo</span><span className="mt-1 text-xs text-slate-500">Acepta Excel y CSV · máximo 10 MB</span><input ref={inputRef} type="file" accept=".xlsx,.csv" className="sr-only" onChange={upload} disabled={busy !== null} /></label>{file && !hasErrors && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Archivo validado: {file.name}</p>}{file && hasErrors && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">El archivo {file.name} tiene errores</p>}</div>
    {preview && <div className="order-last lg:col-span-2 rounded-2xl border border-blue-100 bg-blue-50 p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-blue-950">{hasErrors ? "Corrige el archivo antes de publicar" : "Vista previa lista para publicar"}</h2><p className="mt-1 text-sm text-blue-800">Se detectaron {preview.rows.length} solicitudes válidas por {formatMoney(preview.totals)}{hasErrors ? ` y ${preview.errors.length} filas con errores.` : " y todas las columnas requeridas."} Código asignado: <strong>{preview.suggestedCode}</strong>.</p></div><div className="flex gap-2"><button onClick={reset} type="button" className="rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-900">Cancelar</button><button onClick={publish} disabled={hasErrors || busy !== null || !title.trim()} type="button" className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy === "publish" ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />}Publicar lote</button></div></div>
      {hasErrors && <ul className="mt-4 list-disc space-y-1 rounded-lg bg-white px-8 py-3 text-sm text-rose-700">{preview.errors.slice(0, 8).map((message) => <li key={message}>{message}</li>)}{preview.errors.length > 8 && <li>…y {preview.errors.length - 8} más.</li>}</ul>}
      {!hasErrors && preview.warnings.length > 0 && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><p className="font-bold">Revisa antes de publicar: estos N° de trámite ya existen en otros lotes</p><ul className="mt-1 list-disc space-y-0.5 pl-5">{preview.warnings.slice(0, 8).map((message) => <li key={message}>{message}</li>)}{preview.warnings.length > 8 && <li>…y {preview.warnings.length - 8} más.</li>}</ul><p className="mt-1 text-xs">Puedes publicar igual si son reingresos.</p></div>}
      {!hasErrors && <><label className="mt-4 block text-xs font-semibold text-blue-900" htmlFor="batch-title">Título del lote</label><input id="batch-title" value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600" />
        <div className="mt-4 overflow-x-auto rounded-lg bg-white"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Detalle</th><th className="px-3 py-2 text-right">Importe</th><th className="px-3 py-2">Solicitado por</th><th className="px-3 py-2">Categoría</th></tr></thead><tbody>{preview.rows.slice(0, 5).map((row, index) => <tr key={index} className="border-t border-slate-100"><td className="px-3 py-2 text-slate-800">{row.detail}</td><td className="px-3 py-2 text-right font-semibold tabular-nums">{row.currency} {formatCurrency(row.amount)}</td><td className="px-3 py-2 text-slate-600">{row.requester}</td><td className="px-3 py-2 text-xs text-slate-500">{row.category}</td></tr>)}</tbody></table>{preview.rows.length > 5 && <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">…y {preview.rows.length - 5} filas más.</p>}</div></>}
    </div>}</>;
}

/** "18.400,50" / "18400.5" / "18.400" → número (formato boliviano o internacional). */
function parseAmount(text: string): number {
  const clean = text.replace(/[^\d.,]/g, "");
  if (clean.includes(",")) return Number(clean.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+$/.test(clean)) return Number(clean.replace(/\./g, ""));
  return clean ? Number(clean) : NaN;
}

interface RequestOptions {categories: string[];regions: string[];}
const emptyForm = { detail: "", amount: "", currency: "Bs" as Currency, priority: "" as Priority | "", procedure: "", requester: "", region: "", category: "", date: "" };

function ManualEntryCard({ batchState, showToast }: {batchState: BatchState;showToast: (message: string) => void;}) {
  const { batch } = batchState;
  const [form, setForm] = useState(emptyForm);
  const [options, setOptions] = useState<RequestOptions>({ categories: [], regions: [] });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const canAdd = batch !== null && batch.status === "Pendiente";

  useEffect(() => {api<RequestOptions>("/requests/options").then(setOptions).catch(() => undefined);}, []);

  const set = (field: keyof typeof emptyForm) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!batch) return;
    setFormError(null);
    const amount = parseAmount(form.amount);
    if (!form.priority) {setFormError("Selecciona la prioridad.");return;}
    if (!Number.isFinite(amount) || amount <= 0) {setFormError("Ingresa un importe válido.");return;}
    setSaving(true);
    try {
      const { warning } = await batchState.addRequest({ batch_id: batch.id, detail: form.detail, amount, currency: form.currency, priority: form.priority, procedure: form.procedure, requester: form.requester, region: form.region, category: form.category, date: form.date || undefined });
      setForm(emptyForm);
      if (warning) Swal.fire({ icon: "warning", title: "Fila agregada con advertencia", text: warning, confirmButtonColor: "#b45309" });
      else showToast(`Fila agregada al lote ${batch.code}`);
    } catch (err) {
      setFormError(errorMessage(err, "No se pudo agregar la fila."));
    } finally {
      setSaving(false);
    }
  };

  const input = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600";
  return <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="rounded-xl bg-slate-50 p-3"><h2 className="font-bold text-slate-900">Ingreso manual</h2><p className="mt-1 text-sm text-slate-500">{canAdd ? <>Añade solicitudes individuales al lote <strong>{batch.code}</strong> cuando no haya una planilla disponible.</> : "No hay un lote pendiente al cual agregar filas. Publica un lote primero."}</p>
    <fieldset disabled={!canAdd || saving} className="mt-4 grid grid-cols-2 gap-3 disabled:opacity-60">
      <input required value={form.detail} onChange={set("detail")} placeholder="Detalle de solicitud" className={`col-span-2 ${input}`} />
      <input required value={form.amount} onChange={set("amount")} inputMode="decimal" placeholder={`Importe (${form.currency})`} className={input} />
      <select value={form.currency} onChange={set("currency")} className={`${input} text-slate-700`}><option value="Bs">Bs</option><option value="USD">USD</option></select>
      <input required value={form.procedure} onChange={set("procedure")} placeholder="N° trámite" className={input} />
      <select required value={form.priority} onChange={set("priority")} className={`${input} ${form.priority ? "text-slate-700" : "text-slate-500"}`}><option value="" disabled>Prioridad</option><option>Alta</option><option>Media</option><option>Baja</option></select>
      <input required value={form.requester} onChange={set("requester")} placeholder="Solicitado por" className={`col-span-2 ${input}`} />
      <input required value={form.region} onChange={set("region")} list="region-options" placeholder="Regional" className={input} />
      <input type="date" value={form.date} onChange={set("date")} aria-label="Fecha" className={`${input} text-slate-600`} />
      <input required value={form.category} onChange={set("category")} list="category-options" placeholder="Categoría" className={`col-span-2 ${input}`} />
      <datalist id="region-options">{options.regions.map((item) => <option key={item} value={item} />)}</datalist>
      <datalist id="category-options">{options.categories.map((item) => <option key={item} value={item} />)}</datalist>
    </fieldset>
    {formError && <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{formError}</p>}
    <button type="submit" disabled={!canAdd || saving} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-blue-800 disabled:opacity-50">{saving ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : <PlusIcon className="h-4 w-4" />}Agregar fila</button></div></form>;
}

function MonitorPanel({ onReset, batchState, refreshKey, onOpenBatch }: {onReset: () => void;batchState: BatchState;refreshKey: number;onOpenBatch: (id: number) => void;}) {
  const { batch, requests, loading, error } = batchState;
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [region, setRegion] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const categories = useMemo(() => Array.from(new Set(requests.map((row) => row.category))).sort(), [requests]);
  const regions = useMemo(() => Array.from(new Set(requests.map((row) => row.region))).sort(), [requests]);
  const filtered = useMemo(() => requests.filter((row) => (!status || (status === "Decididos" ? row.status !== "Pendiente" : row.status === status)) && (!category || row.category === category) && (!region || row.region === region)), [requests, status, category, region]);

  const exportFile = async (key: string, path: string, params: Record<string, string>, fallbackName: string) => {
    if (!batch) return;
    const query = new URLSearchParams({ batch_id: String(batch.id), ...Object.fromEntries(Object.entries(params).filter(([, value]) => value)) });
    setBusy(key);
    try {
      await download(`${path}?${query}`, fallbackName);
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo generar el reporte", text: errorMessage(err, "Inténtalo de nuevo."), confirmButtonColor: "#0f4c81" });
    } finally {
      setBusy(null);
    }
  };

  const select = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-600";
  return <><BatchStatus loading={loading} error={error} batch={batch} onReset={onReset}>{batch && <>
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center"><p className="text-sm font-bold text-slate-800 sm:mr-auto">{batch.code} · <span className="font-medium text-slate-500">{batch.title}</span></p><select value={status} onChange={(event) => setStatus(event.target.value)} className={select} aria-label="Filtrar por estado"><option value="">Todos los estados</option><option value="Decididos">Aprobados y rechazados</option><option>Aprobado</option><option>Rechazado</option><option>Pendiente</option></select><select value={category} onChange={(event) => setCategory(event.target.value)} className={select} aria-label="Filtrar por categoría"><option value="">Todas las categorías</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select value={region} onChange={(event) => setRegion(event.target.value)} className={select} aria-label="Filtrar por regional"><option value="">Todas las regionales</option>{regions.map((item) => <option key={item}>{item}</option>)}</select></div>
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><ExportButton busy={busy === "xlsx"} onClick={() => exportFile("xlsx", "/excel/export", { status: status || "Decididos", category, region }, `${batch.code}.xlsx`)} icon={<FileSpreadsheetIcon className="h-5 w-5" />} label="Descargar Excel" detail={status ? "Con los filtros aplicados" : "Aprobados / rechazados"} /><ExportButton busy={busy === "pdf"} onClick={() => exportFile("pdf", "/pdf/export", { status, category, region }, `${batch.code}.pdf`)} icon={<FileDownIcon className="h-5 w-5" />} label="Descargar PDF" detail="Reporte filtrado" /><ExportButton busy={busy === "full"} onClick={() => exportFile("full", "/pdf/export", { full: "1" }, `${batch.code}-completo.pdf`)} icon={<ClipboardListIcon className="h-5 w-5" />} label="Reporte completo" detail="Lote y trazabilidad" /></div>
    <RequestTable requests={filtered} onStatusChange={() => undefined} viewer /></>}</BatchStatus>
    <div className="mt-8"><HistoryPanel onOpen={onOpenBatch} refreshKey={refreshKey} /></div></>;
}
function ExportButton({ icon, label, detail, onClick, busy }: {icon: React.ReactNode;label: string;detail: string;onClick: () => void;busy: boolean;}) {return <button onClick={onClick} disabled={busy} type="button" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors duration-150 hover:border-blue-200 hover:bg-blue-50 disabled:opacity-60"><span className="rounded-lg bg-blue-50 p-2 text-blue-700">{busy ? <LoaderCircleIcon className="h-5 w-5 animate-spin" /> : icon}</span><span><span className="block text-sm font-bold text-slate-800">{label}</span><span className="block text-xs text-slate-500">{detail}</span></span></button>;}

// ---------------------------------------------------------------------------
// Colaborador (solo lectura)
// ---------------------------------------------------------------------------

function ViewerWorkspace({ onReset, batch, requests, loading, error, refreshKey, onOpenBatch }: {onReset: () => void;batch: Batch | null;requests: FinancialRequest[];loading: boolean;error: string | null;refreshKey: number;onOpenBatch: (id: number) => void;}) {const active = requests.filter((item) => item.status !== "Pendiente").length;return <><section className="mb-5 rounded-2xl bg-slate-950 px-5 py-6 text-white"><p className="text-sm font-semibold text-blue-200">Acceso de solo lectura</p><h1 className="mt-1 text-2xl font-bold">Estado de solicitudes</h1><p className="mt-2 max-w-2xl text-sm text-slate-300">Consulta el avance del lote {batch ? batch.code : "actual"}. No tienes permisos para aprobar, rechazar ni modificar información.</p><div className="mt-5 flex items-center gap-3"><CheckCircle2Icon className="h-5 w-5 text-emerald-400" /><p className="text-sm"><strong>{active} de {requests.length}</strong> solicitudes ya fueron revisadas.</p></div></section><BatchStatus loading={loading} error={error} batch={batch} onReset={onReset}><RequestTable requests={requests} onStatusChange={() => undefined} viewer /></BatchStatus><div className="mt-8"><HistoryPanel onOpen={onOpenBatch} refreshKey={refreshKey} canDownload={false} /></div></>;}

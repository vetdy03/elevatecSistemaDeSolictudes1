import { Currency, MoneyTotals } from "../types";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

/** Suma por moneda; opcionalmente solo las filas que cumplan `filter`. */
export function sumByCurrency<T extends { amount: number; currency: Currency }>(rows: T[], filter?: (row: T) => boolean): MoneyTotals {
  const totals: MoneyTotals = { Bs: 0, USD: 0 };
  for (const row of rows) {
    if (!filter || filter(row)) totals[row.currency] += row.amount;
  }
  return totals;
}

/** "Bs 1.000" o "Bs 1.000 · USD 50" (USD solo si hay montos en dólares). */
export function formatMoney(totals: MoneyTotals): string {
  const bs = `Bs ${formatCurrency(totals.Bs)}`;
  return totals.USD > 0 ? `${bs} · USD ${formatCurrency(totals.USD)}` : bs;
}

// Las fechas "YYYY-MM-DD" se parten a mano para no desplazarlas por la zona horaria.
function parts(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return { year, month, day };
}

/** "2026-09-29" → "29 Sep" */
export function formatShortDate(iso: string): string {
  const { month, day } = parts(iso);
  return `${day} ${MONTHS[month - 1]}`;
}

/** ISO → "15 Sep 2026" (en hora local) */
export function formatLongDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** ISO → "hoy, 10:32" / "29 Sep, 10:32" */
export function formatUpdated(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false });
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return `${sameDay ? "hoy" : `${date.getDate()} ${MONTHS[date.getMonth()]}`}, ${time}`;
}

export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

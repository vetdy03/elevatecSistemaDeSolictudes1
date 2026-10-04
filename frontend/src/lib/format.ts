const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
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

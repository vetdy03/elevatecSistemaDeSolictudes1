// Tipos compartidos con la API de Laravel (ver backend/app/Http/Resources).

export type RequestStatus = "Pendiente" | "Aprobado" | "Rechazado";
export type Priority = "Alta" | "Media" | "Baja";
export type Currency = "Bs" | "USD";
export type UserRole = "Admin" | "Secretaría" | "Colaborador";

export interface FinancialRequest {
  id: number;
  batchId: number;
  itemNumber: number;
  /** Fecha ISO "YYYY-MM-DD" */
  date: string;
  detail: string;
  amount: number;
  currency: Currency;
  procedure: string;
  requester: string;
  priority: Priority;
  region: string;
  category: string;
  status: RequestStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}

export interface Batch {
  id: number;
  code: string;
  title: string;
  status: "Pendiente" | "Completado";
  date: string;
  completedAt: string | null;
  updatedAt: string;
  uploadedBy?: string | null;
  /** Total en Bs (los USD van aparte en totalUsd: nunca se suman entre sí) */
  total: number;
  totalUsd: number;
  items: number;
  requests?: FinancialRequest[];
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  initials: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  batchId: number | null;
  read: boolean;
  createdAt: string;
}

export interface NewRequestInput {
  batch_id: number;
  date?: string;
  detail: string;
  amount: number;
  currency: Currency;
  procedure: string;
  requester: string;
  priority: Priority;
  region: string;
  category: string;
}

/** Montos por moneda. Bs y USD nunca se suman entre sí. */
export type MoneyTotals = Record<Currency, number>;

export interface ImportPreview {
  rows: Array<{
    line: number;
    date: string;
    detail: string;
    amount: number;
    currency: Currency;
    procedure: string;
    requester: string;
    priority: Priority;
    region: string;
    category: string;
  }>;
  errors: string[];
  /** Avisos que no bloquean la publicación (p. ej. N° de trámite ya usado en otro lote) */
  warnings: string[];
  totals: MoneyTotals;
  suggestedCode: string;
}

// Tipos compartidos con la API de Laravel (ver backend/app/Http/Resources).

/** "Más info": el Admin pidió información y espera la respuesta de Secretaría. */
export type RequestStatus = "Pendiente" | "Aprobado" | "Rechazado" | "Más info";

/** Acciones del Admin sobre una fila (pulsar de nuevo la acción ya activa la deshace). */
export type RequestAction = "approve" | "reject" | "info";

/** Pregunta del Admin o respuesta de Secretaría en el flujo "Más info". */
export interface ConversationEntry {
  id: number;
  type: "question" | "answer";
  body: string;
  user: string | null;
  createdAt: string;
  attachmentName: string | null;
  attachmentUrl: string | null;
}

/** Solo lo recibe el Admin: la solicitud repite una que fue rechazada en otro lote. */
export interface RetryInfo {
  batchCode: string | null;
  rejectedAt: string | null;
  reason: string | null;
  procedure: string;
}
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
  /** Opcional: puede venir vacío desde la planilla */
  authorizedBy: string | null;
  rejectionReason: string | null;
  /** Secretaría respondió un "Más info" (la fila volvió a Pendiente) */
  infoAnsweredAt: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  batchCode?: string;
  retry?: RetryInfo | null;
  conversation?: ConversationEntry[];
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
  authorized_by?: string;
  priority: Priority;
  region: string;
  category: string;
}

/** Montos por moneda. Bs y USD nunca se suman entre sí. */
export type MoneyTotals = Record<Currency, number>;

export interface ImportPreview {
  rows: Array<{
    line: number;
    authorized_by: string | null;
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

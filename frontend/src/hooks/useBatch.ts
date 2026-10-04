import { useCallback, useEffect, useRef, useState } from "react";
import { api, json } from "../api/client";
import { Batch, FinancialRequest, NewRequestInput, RequestStatus } from "../types";

/**
 * Lote seleccionado y sus solicitudes. batchId = null → lote activo (pendiente más reciente).
 * updateStatus es optimista: la UI (y los totales) cambian al instante y se revierte si la API falla.
 */
export function useBatch(batchId: number | null) {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [requests, setRequests] = useState<FinancialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestsRef = useRef(requests);
  requestsRef.current = requests;

  const apply = (data: Batch | null) => {
    setBatch(data);
    setRequests(data?.requests ?? []);
  };

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: Batch | null }>(batchId ? `/batches/${batchId}` : "/batches/active");
      apply(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el lote.");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const updateStatus = useCallback(async (id: number, status: RequestStatus) => {
    const previous = requestsRef.current;
    setRequests((rows) => rows.map((row) => (row.id === id ? { ...row, status } : row)));
    try {
      const res = await api<{ data: FinancialRequest }>(`/requests/${id}/status`, { method: "PATCH", body: json({ status }) });
      setRequests((rows) => rows.map((row) => (row.id === id ? res.data : row)));
    } catch (err) {
      setRequests(previous);
      throw err;
    }
  }, []);

  const finalize = useCallback(async () => {
    if (!batch) return;
    const res = await api<{ data: Batch }>(`/batches/${batch.id}/finalize`, { method: "POST" });
    apply(res.data);
  }, [batch]);

  const addRequest = useCallback(async (input: NewRequestInput) => {
    const res = await api<{ data: FinancialRequest }>("/requests", { method: "POST", body: json(input) });
    if (batch && input.batch_id === batch.id) setRequests((rows) => [...rows, res.data]);
    return res.data;
  }, [batch]);

  return { batch, requests, loading, error, reload, updateStatus, finalize, addRequest };
}

import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { Batch } from "../types";

export interface BatchFilters {
  status?: "Pendiente" | "Completado";
  q?: string;
  from?: string;
  to?: string;
}

/**
 * Listado de lotes con filtros (histórico y selector de lote activo).
 * refreshKey permite forzar la recarga desde fuera (p. ej. tras publicar o finalizar un lote).
 */
export function useBatches(filters: BatchFilters, refreshKey = 0) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { status, q, from, to } = filters;

  const reload = useCallback(async () => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: Batch[] }>(`/batches?${params}`);
      setBatches(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los lotes.");
    } finally {
      setLoading(false);
    }
  }, [status, q, from, to]);

  useEffect(() => {
    const timer = window.setTimeout(reload, q ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [reload, q, refreshKey]);

  return { batches, loading, error, reload };
}

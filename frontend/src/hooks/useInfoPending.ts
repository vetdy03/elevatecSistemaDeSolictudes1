import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { FinancialRequest } from "../types";

/**
 * Secretaría: solicitudes (de cualquier lote) en las que el Admin pidió más información.
 */
export function useInfoPending(refreshKey = 0) {
  const [items, setItems] = useState<FinancialRequest[]>([]);

  const reload = useCallback(async () => {
    try {
      const res = await api<{ data: FinancialRequest[] }>("/requests/info-pending");
      setItems(res.data);
    } catch {
      // Silencioso: el panel simplemente no se muestra.
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  const answer = useCallback(async (id: number, text: string, attachment: File | null) => {
    const body = new FormData();
    body.append("answer", text);
    if (attachment) body.append("attachment", attachment);
    await api(`/requests/${id}/info/answer`, { method: "POST", body });
    setItems((rows) => rows.filter((row) => row.id !== id));
  }, []);

  return { items, reload, answer };
}

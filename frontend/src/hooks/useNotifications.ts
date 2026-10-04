import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { AppNotification } from "../types";

const POLL_MS = 60_000;

export function useNotifications() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);

  const reload = useCallback(async () => {
    try {
      const res = await api<{ data: AppNotification[]; unread: number }>("/notifications");
      setItems(res.data);
      setUnread(res.unread);
    } catch {
      // Silencioso: la campana no debe romper la pantalla.
    }
  }, []);

  useEffect(() => {
    reload();
    const timer = window.setInterval(reload, POLL_MS);
    return () => window.clearInterval(timer);
  }, [reload]);

  const markAllRead = useCallback(async () => {
    if (unread === 0) return;
    setUnread(0);
    setItems((rows) => rows.map((row) => ({ ...row, read: true })));
    await api("/notifications/read", { method: "POST" }).catch(() => undefined);
  }, [unread]);

  return { items, unread, reload, markAllRead };
}

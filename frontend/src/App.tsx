import { useCallback, useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { TopNav } from "./components/TopNav";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { useBatch } from "./hooks/useBatch";
import { useBatches } from "./hooks/useBatches";
import { LoginPage } from "./pages/LoginPage";
import { ResourceRequestsPlatform } from "./pages/ResourceRequestsPlatform";
import { User } from "./types";

export function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        <LoaderCircleIcon className="h-6 w-6 animate-spin" aria-label="Cargando" />
      </div>
    );
  }

  // key: al cambiar de usuario se reinicia todo el estado de la sesión anterior
  return user ? <Workspace key={user.id} user={user} /> : <LoginPage />;
}

function Workspace({ user }: { user: User }) {
  // null = lote activo (pendiente más reciente)
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const batchState = useBatch(selectedBatchId);
  const { batches: pendingBatches } = useBatches({ status: "Pendiente" }, refreshKey);

  // Cambia cada vez que se pide abrir un lote (notificación, histórico, selector):
  // la página lo usa para saltar a la pestaña donde ese lote se ve.
  const [focusSignal, setFocusSignal] = useState(0);
  const { reload: reloadBatch } = batchState;

  const refreshBatches = useCallback(() => setRefreshKey((key) => key + 1), []);

  const openBatch = useCallback((id: number | null) => {
    // Si ya es el lote abierto, se recarga para mostrar sus datos más recientes.
    if (id === selectedBatchId) reloadBatch();
    else setSelectedBatchId(id);
    setFocusSignal((signal) => signal + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedBatchId, reloadBatch]);

  return (
    <div className="min-h-screen w-full bg-slate-50 font-sans text-slate-900">
      <TopNav user={user} batch={batchState.batch} pendingBatches={pendingBatches} onSelectBatch={openBatch} />
      <ResourceRequestsPlatform
        role={user.role}
        batchState={batchState}
        refreshKey={refreshKey}
        focusSignal={focusSignal}
        onBatchesChanged={refreshBatches}
        onOpenBatch={openBatch}
      />
    </div>
  );
}

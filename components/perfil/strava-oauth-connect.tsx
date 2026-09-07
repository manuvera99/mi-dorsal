"use client";

// =============================================================================
// mi-dorsal — Strava OAuth connect button
// =============================================================================
// Componente cliente que muestra el estado de la conexión OAuth con Strava
// y los botones de "Conectar", "Sincronizar ahora" y "Desconectar".
// =============================================================================

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CheckCircle2, RefreshCw, Unlink, AlertCircle, Loader2 } from "lucide-react";
import { StravaIcon } from "./icons";

export function StravaOauthConnect() {
  const status = useQuery(api.stravaOauth.getMyStravaOauthStatus, {});
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === undefined) {
    return <div className="h-10 bg-gray-100 rounded animate-pulse" />;
  }

  if (!status) {
    return null; // no user, no se muestra
  }

  const handleConnect = () => {
    // Redirige al endpoint OAuth start
    window.location.href = "/api/connect/strava/start";
  };

  const handleDisconnect = async () => {
    if (
      !confirm(
        "¿Desconectar Strava? Se borrarán todas las actividades sincronizadas vía OAuth (no las del export).",
      )
    ) {
      return;
    }
    setIsDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/connect/strava/disconnect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al desconectar");
      // El disconnectAndPurge mutation ya actualizó el profile
    } catch (e: any) {
      setError(e?.message ?? "Error al desconectar");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSyncNow = async () => {
    // TODO: implementar mutation que dispare initialSync manualmente
    setIsSyncing(true);
    setError(null);
    try {
      // Por ahora redirige a /api/connect/strava/start con un parámetro que
      // indique "solo refresh". En la práctica, el initialSync se dispara
      // desde el callback tras la conexión inicial; para sync manual
      // posterior, podríamos añadir una mutation específica.
      // Por simplicidad en este PR, este botón es placeholder.
      alert(
        "Sincronización manual en construcción. Strava envía las actividades nuevas automáticamente vía webhook.",
      );
    } catch (e: any) {
      setError(e?.message ?? "Error");
    } finally {
      setIsSyncing(false);
    }
  };

  if (!status.connected) {
    return (
      <div>
        <button
          onClick={handleConnect}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FC4C02] hover:bg-[#E34402] text-white font-medium rounded-md transition-colors"
        >
          <StravaIcon className="h-5 w-5" />
          Conectar con Strava
        </button>
        <p className="text-xs text-gray-500 mt-2">
          Sincronización automática de actividades nuevas. Te pediré
          autorización en Strava.
        </p>
        {error && (
          <div className="mt-3 flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-green-700">
        <CheckCircle2 className="h-4 w-4" />
        <span>Conectado</span>
        {status.lastSyncAt && (
          <span className="text-gray-500">
            · última sync {timeAgo(status.lastSyncAt)}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSyncNow}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 hover:bg-gray-50 rounded-md disabled:opacity-50"
        >
          {isSyncing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Sincronizar
        </button>
        <button
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 hover:bg-red-50 rounded-md disabled:opacity-50"
        >
          {isDisconnecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Unlink className="h-3.5 w-3.5" />
          )}
          Desconectar
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

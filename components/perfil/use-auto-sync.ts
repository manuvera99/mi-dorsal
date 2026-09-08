"use client";

/**
 * useAutoSync — hook que dispara un sync con Strava si la última
 * sincronización tiene más de `STALE_THRESHOLD_MS`.
 *
 * Pensado para correr una vez al montar la página /perfil. Si el
 * usuario abre la app y la última sync es de hace más de 6h, nos
 * aseguramos de tener datos frescos sin que tenga que pulsar nada.
 *
 * Si ya está sincronizando (por la auto-sync de otro tab, o porque
 * Strava acaba de notificar vía webhook), evitamos disparar otra.
 *
 * Devuelve:
 *  - `isAutoSyncing`: true mientras el sync está corriendo.
 *  - `lastSyncedAt`: timestamp de la última sync (o null si nunca).
 *  - `forceSync()`: dispara un sync manual sin esperar al threshold.
 */

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/** Una sync de hace más de 6h se considera "vieja". */
const STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000;

/** No re-disparar auto-sync más de una vez cada 5 min. */
const COOLDOWN_MS = 5 * 60 * 1000;

export function useAutoSync() {
  const status = useQuery(api.stravaOauth.getMyStravaOauthStatus, {});
  const triggerSync = useMutation(api.stravaOauth.triggerSyncNow);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const lastAutoSyncAttempt = useRef<number>(0);

  useEffect(() => {
    // Solo cuando tengamos el status y el usuario esté conectado.
    if (!status || !status.connected) return;

    const now = Date.now();
    const lastSync = status.lastSyncAt ?? 0;
    const isStale = !lastSync || now - lastSync > STALE_THRESHOLD_MS;
    const inCooldown = now - lastAutoSyncAttempt.current < COOLDOWN_MS;

    if (!isStale || inCooldown) return;

    // Disparar auto-sync. Lo marcamos como "en curso" para que el UI
    // muestre el banner; como el sync es en background y el status
    // reactivo se actualiza cuando `lastSyncAt` cambia (lo escribe la
    // action al final), no podemos saber cuándo termina desde aquí.
    // Usamos un timeout heurístico: si en 30s el lastSyncAt no cambió,
    // dejamos de mostrar el banner.
    lastAutoSyncAttempt.current = now;
    setIsAutoSyncing(true);
    triggerSync({}).catch((e) => {
      console.error("[useAutoSync] trigger failed:", e);
      setIsAutoSyncing(false);
    });

    // Heurística de "fin": si después de 30s el status no cambió,
    // asumimos que terminó (con o sin error). Si cambió, re-evaluamos.
    const timeout = setTimeout(() => setIsAutoSyncing(false), 30000);
    return () => clearTimeout(timeout);
  }, [status?.connected, status?.lastSyncAt, triggerSync]);

  // Versión manual que el botón "Sincronizar ahora" / "Resincronizar
  // todo" puede llamar. Fuerza un re-trigger sin importar el threshold.
  const forceSync = async () => {
    setIsAutoSyncing(true);
    lastAutoSyncAttempt.current = Date.now();
    try {
      await triggerSync({});
    } catch (e) {
      console.error("[useAutoSync] forceSync failed:", e);
    } finally {
      // Mismo heurística de timeout.
      setTimeout(() => setIsAutoSyncing(false), 30000);
    }
  };

  return {
    isAutoSyncing,
    lastSyncedAt: status?.lastSyncAt ?? null,
    connected: status?.connected ?? false,
    forceSync,
  };
}

"use client";

/**
 * useAutoSync — hook que dispara un sync con Strava si la última
 * sincronización tiene más de `STALE_THRESHOLD_MS`.
 *
 * Pensado para correr una vez al montar la página /perfil. Si el
 * usuario abre la app y la última sync es de hace más de 24h, nos
 * aseguramos de tener datos frescos sin que tenga que pulsar nada.
 *
 * ¿Por qué 24h en vez de 6h?
 *   El webhook de Strava (suscripción activa, id 371643) es la fuente
 *   primaria: las actividades nuevas llegan en <2 min. El auto-sync es
 *   un fallback de "ponerse al día" para los casos edge (webhook caído,
 *   conexión de Strava sin actividad durante días, etc.). 24h es
 *   suficiente porque, en el peor caso, el usuario ve sus actividades
 *   con 1 día de retraso — aceptable para un fallback. Antes era 6h
 *   lo que disparaba 4 syncs/día innecesarios.
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

/** Una sync de hace más de 24h se considera "vieja". */
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/** No re-disparar auto-sync más de una vez cada 30 min (defensivo
 *  contra abrir/cerrar la app en bucle). */
const COOLDOWN_MS = 30 * 60 * 1000;

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

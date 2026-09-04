"use client";

/**
 * useUserRegion — hook de detección de la CCAA del usuario.
 *
 * Flujo:
 *  1. Al montar, mira localStorage("midorsal:ccaa") — si hay override manual, gana.
 *  2. Si no, llama a /api/geo/region (que lee headers de Vercel).
 *  3. Devuelve la CCAA detectada + funciones para sobrescribir manualmente.
 *
 * Estado expuesto:
 *  - community: CommunityInfo | null  → CCAA detectada o null si desconocida
 *  - source: cómo se detectó (vercel, manual, default)
 *  - loading: true mientras carga
 *  - setCommunity(ccaaId): guarda override manual en localStorage
 *  - clearOverride(): borra override y vuelve a detectar
 */

import { useCallback, useEffect, useState } from "react";
import {
  AUTONOMOUS_COMMUNITIES,
  getCommunityById,
  type AutonomousCommunity,
  type CommunityInfo,
} from "@/lib/geo/region";

const STORAGE_KEY = "midorsal:ccaa";

type Source = "vercel-region" | "vercel-country" | "vercel-city" | "default" | "manual-override";

interface RegionState {
  community: CommunityInfo | null;
  source: Source | "pending";
  city: string | null;
  country: string | null;
}

interface UseUserRegionReturn extends RegionState {
  loading: boolean;
  setCommunity: (id: AutonomousCommunity) => void;
  clearOverride: () => void;
  allCommunities: typeof AUTONOMOUS_COMMUNITIES;
  hasManualOverride: boolean;
}

const INITIAL: RegionState = {
  community: null,
  source: "pending",
  city: null,
  country: null,
};

export function useUserRegion(): UseUserRegionReturn {
  const [state, setState] = useState<RegionState>(INITIAL);
  const [loading, setLoading] = useState(true);
  const [hasManualOverride, setHasManualOverride] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      // 1) ¿Hay override manual en localStorage?
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const found = getCommunityById(stored);
          if (found) {
            if (!cancelled) {
              setState({ community: found, source: "manual-override", city: null, country: "ES" });
              setHasManualOverride(true);
              setLoading(false);
            }
            return;
          }
        }
      } catch {
        // localStorage puede fallar (modo privado, etc) — seguimos
      }

      // 2) Detectar vía endpoint
      try {
        const res = await fetch("/api/geo/region", { cache: "no-store" });
        if (!res.ok) throw new Error("geo endpoint failed");
        const data = (await res.json()) as RegionState;
        if (!cancelled) {
          setState(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setState({ community: null, source: "default", city: null, country: "ES" });
          setLoading(false);
        }
      }
    }

    detect();
    return () => {
      cancelled = true;
    };
  }, []);

  const setCommunity = useCallback((id: AutonomousCommunity) => {
    const found = getCommunityById(id);
    if (!found) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // no-op
    }
    setHasManualOverride(true);
    setState({ community: found, source: "manual-override", city: null, country: "ES" });
  }, []);

  const clearOverride = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // no-op
    }
    setHasManualOverride(false);
    // Re-detect
    setState(INITIAL);
    setLoading(true);
    fetch("/api/geo/region", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: RegionState | null) => {
        if (data) setState(data);
        else setState({ community: null, source: "default", city: null, country: "ES" });
        setLoading(false);
      })
      .catch(() => {
        setState({ community: null, source: "default", city: null, country: "ES" });
        setLoading(false);
      });
  }, []);

  return {
    ...state,
    loading,
    setCommunity,
    clearOverride,
    allCommunities: AUTONOMOUS_COMMUNITIES,
    hasManualOverride,
  };
}

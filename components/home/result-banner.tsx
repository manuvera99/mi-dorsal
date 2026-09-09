"use client";

/**
 * ResultBanner — banner 🎉 que aparece en la home para usuarios logueados
 * que acaban de tener un resultado oficial scrapeado.
 *
 * Cierra con X y persiste el "no mostrar más" en localStorage. Si el
 * usuario tiene un NUEVO resultado distinto, vuelve a aparecer.
 *
 * Solo se muestra a usuarios logueados (la query devuelve null si no).
 * Se monta como client island en la home; no afecta al ISR.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Sparkles, X, Trophy, ArrowRight, Share2 } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "midorsal:resultBannerDismissedFor";

export function ResultBanner() {
  const { isLoaded, isSignedIn } = useUser();
  const latest = useQuery(
    api.myRaces.getLatestResultBanner,
    isSignedIn ? {} : ("skip" as any),
  );

  // Hidratar el "dismissedFor" desde localStorage
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissedFor(localStorage.getItem(STORAGE_KEY));
  }, []);

  // Si el último resultado cambia y es distinto al dismissed, mostrar
  const shouldShow =
    isLoaded &&
    isSignedIn === true &&
    latest !== undefined &&
    latest !== null &&
    dismissedFor !== null && // ya hidratado
    dismissedFor !== latest.myRaceId;

  if (!shouldShow) return null;

  const handleDismiss = () => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, latest.myRaceId);
    setDismissedFor(latest.myRaceId);
  };

  const distanceLabel =
    latest.distanceKm % 1 === 0
      ? `${latest.distanceKm}K`
      : `${latest.distanceKm.toFixed(2)}K`;

  // Comparativa predicción vs real (si hay predicción)
  let delta: string | null = null;
  if (latest.predictedTimeSeconds != null) {
    const diff = latest.actualTimeSeconds - latest.predictedTimeSeconds;
    const sign = diff < 0 ? "−" : "+";
    const abs = Math.abs(diff);
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    const s = abs % 60;
    const fmt = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
    delta = `${sign}${fmt} vs tu predicción`;
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-runner-primary/20",
        "bg-gradient-to-br from-runner-primary to-red-700 text-white shadow-lg",
      )}
      role="status"
      aria-label="Resultado oficial disponible"
    >
      {/* Decoración */}
      <div
        aria-hidden="true"
        className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl"
      />

      <div className="relative p-5 md:p-6 flex items-start gap-4">
        <div
          aria-hidden="true"
          className="flex-shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm"
        >
          <Trophy className="h-6 w-6" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-yellow-300" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-widest text-red-100">
              Resultado oficial
            </p>
          </div>
          <h3 className="text-lg md:text-xl font-bold leading-tight mb-1">
            ¡{latest.raceName} ya está en tu buzón!
          </h3>
          <p className="text-sm text-red-100 leading-relaxed">
            {distanceLabel} ·{" "}
            <span className="font-mono font-semibold text-white">
              {formatTime(latest.actualTimeSeconds)}
            </span>
            {latest.actualPosition != null && (
              <>
                {" · "}
                <span className="text-white">posición #{latest.actualPosition}</span>
              </>
            )}
            {delta && (
              <span className="text-red-100/80"> · {delta}</span>
            )}
          </p>

          <Link
            href="/perfil"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:text-yellow-200 transition-colors"
          >
            Ver mi temporada
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={`/resultado/${latest.myRaceId}`}
            className="mt-3 ml-3 inline-flex items-center gap-1.5 text-sm font-semibold text-white/90 hover:text-white transition-colors"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
            Compartir mi resultado
          </Link>
        </div>

        <button
          onClick={handleDismiss}
          aria-label="Cerrar banner de resultado"
          className="flex-shrink-0 p-1.5 rounded-lg text-red-100 hover:text-white hover:bg-white/15 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

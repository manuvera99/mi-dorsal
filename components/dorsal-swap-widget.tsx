// =============================================================================
// mi-dorsal — DorsalSwap CTA Widget
// =============================================================================
// Widget embebido en la ficha de carrera de mi-dorsal. Muestra cuántos dorsales
// hay disponibles en DorsalSwap para esa carrera y linkea al tablón.
// =============================================================================

"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { ArrowRight, Plus, Euro, MapPin, Calendar } from "lucide-react";
import { useState } from "react";

interface DorsalSwapWidgetProps {
  raceId: string;
  raceName: string;
  raceStartDate?: string;
  raceLocality?: string;
  raceProvince?: string;
  // URL base de DorsalSwap (configurable por entorno)
  dorsalswapUrl?: string;
}

/**
 * API para el widget: como mi-dorsal y DorsalSwap comparten el mismo
 * Convex deployment, podemos consultar directamente. Pero también
 * exponemos un endpoint público en caso de que el widget se quiera
 * usar desde otros sitios.
 *
 * Aquí usamos useQuery de Convex directamente.
 */
export function DorsalSwapWidget({
  raceId,
  raceName,
  raceStartDate,
  raceLocality,
  raceProvince,
  dorsalswapUrl = "https://dorsalswap.vercel.app",
}: DorsalSwapWidgetProps) {
  // Solo mostrar si la carrera es de la zona foco
  const focusProvinces = ["valencia", "alicante", "castellon", "murcia", "albacete"];
  const isInFocus = !raceProvince || focusProvinces.includes(raceProvince.toLowerCase());

  // Skip query si no está en foco
  const { api } = require("@/convex/_generated/api") as any;
  const listings = useQuery(
    api?.dorsalListings?.listByRace,
    isInFocus ? { raceId: raceId as any } : "skip",
  );

  if (!isInFocus) {
    return null; // No mostrar el widget fuera de la zona foco
  }

  const activeListings = (listings ?? []).filter(
    (l: any) => l.status === "active" && l.expiresAt > Date.now(),
  );

  const minPrice = activeListings.length > 0
    ? Math.min(...activeListings.map((l: any) => l.totalPriceEur))
    : null;

  return (
    <div className="rounded-xl border-2 border-swap-200 bg-gradient-to-br from-swap-50 to-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-swap-700">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-swap-500 animate-pulse" />
            DorsalSwap
          </div>
          <h3 className="mt-2 font-bold text-ink">
            {activeListings.length > 0
              ? `${activeListings.length} dorsal${activeListings.length !== 1 ? "es" : ""} disponible${activeListings.length !== 1 ? "s" : ""} para esta carrera`
              : "Cede tu dorsal si no puedes correr"}
          </h3>
          <p className="mt-1 text-sm text-ink-muted">
            {activeListings.length > 0
              ? `Desde ${minPrice}€ · a precio oficial`
              : "A precio oficial, con verificación de identidad"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {activeListings.length > 0 ? (
          <a
            href={`${dorsalswapUrl}/listings?search=${encodeURIComponent(raceName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-accent text-sm flex-1 sm:flex-none"
          >
            Ver dorsales
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        ) : null}
        <a
          href={`${dorsalswapUrl}/dashboard/listings/new`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary text-sm flex-1 sm:flex-none"
        >
          <Plus className="h-3.5 w-3.5" />
          Ceder mi dorsal
        </a>
      </div>

      <p className="mt-3 text-[10px] text-ink-subtle">
        DorsalSwap es la capa de imprevistos de mi-dorsal.{" "}
        <a href={dorsalswapUrl} target="_blank" rel="noopener noreferrer" className="text-swap-700 hover:underline">
          ¿Qué es esto?
        </a>
      </p>
    </div>
  );
}

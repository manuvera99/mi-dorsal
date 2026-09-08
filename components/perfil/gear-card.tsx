"use client";

/**
 * GearCard — card "Tus zapatillas" en el perfil.
 *
 * Lista el gear de running (zapatillas) del usuario, ordenado por km totales
 * descendente. Para cada par muestra:
 *  - Nombre del modelo (o el ID de Strava si no hay nombre)
 *  - Barra de progreso hacia el umbral de cambio (800 km por defecto)
 *  - Alerta visual cuando se acerca o supera el umbral
 *  - Última vez que se usaron (relative time)
 *
 * El umbral de 800 km es la regla clásica para zapatillas de running
 * (algunos modelos aguantan más, pero es un buen aviso para el popular).
 */

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Footprints, AlertTriangle, Check } from "lucide-react";

/** Umbral en km a partir del cual recomendamos cambiar de zapatillas. */
const SHOE_REPLACE_THRESHOLD_KM = 800;

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return "hoy";
  if (days < 7) return `hace ${days} día${days === 1 ? "" : "s"}`;
  if (days < 30) return `hace ${Math.floor(days / 7)} sem`;
  if (days < 365) return `hace ${Math.floor(days / 30)} mes`;
  return `hace ${Math.floor(days / 365)} año`;
}

export function GearCard() {
  const gear = useQuery(api.activities.queries.getMyGearSummary, {});

  if (gear === undefined) {
    return (
      <div className="card mb-6">
        <div className="h-6 w-40 bg-gray-100 rounded animate-pulse mb-3" />
        <div className="h-20 bg-gray-50 rounded animate-pulse" />
      </div>
    );
  }

  if (gear.length === 0) {
    return (
      <div className="card mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-2">
          <Footprints className="h-5 w-5 text-runner-primary" /> Tus zapatillas
        </h2>
        <p className="text-sm text-stone-600 leading-relaxed">
          Cuando Strava detecte con qué zapatillas corres, las verás aquí
          con los km que les llevas. Útil para saber cuándo toca cambiarlas.
        </p>
      </div>
    );
  }

  return (
    <div className="card mb-6">
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
        <Footprints className="h-5 w-5 text-runner-primary" /> Tus zapatillas
      </h2>
      <div className="space-y-3">
        {gear.map((g) => {
          const km = g.totalDistanceM / 1000;
          const pct = Math.min(100, (km / SHOE_REPLACE_THRESHOLD_KM) * 100);
          const overThreshold = km >= SHOE_REPLACE_THRESHOLD_KM;
          const nearThreshold = km >= SHOE_REPLACE_THRESHOLD_KM * 0.85;

          return (
            <div
              key={g.gearId}
              className="rounded-md border border-stone-200 p-3 bg-white"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">
                    {g.gearName ?? `Zapatillas (${g.gearId.slice(0, 6)}…)`}
                  </div>
                  <div className="text-xs text-stone-500">
                    {g.activityCount} actividad
                    {g.activityCount === 1 ? "" : "es"} ·{" "}
                    {formatRelativeTime(g.lastUsedAt)}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-base font-bold font-mono text-runner-dark">
                    {km.toFixed(0)} km
                  </div>
                  {overThreshold && (
                    <div className="text-[10px] uppercase tracking-wide font-semibold text-red-600 flex items-center gap-0.5 justify-end">
                      <AlertTriangle className="h-3 w-3" />
                      A cambiar
                    </div>
                  )}
                  {nearThreshold && !overThreshold && (
                    <div className="text-[10px] uppercase tracking-wide font-semibold text-amber-600 flex items-center gap-0.5 justify-end">
                      <AlertTriangle className="h-3 w-3" />
                      Casi
                    </div>
                  )}
                  {!nearThreshold && (
                    <div className="text-[10px] uppercase tracking-wide font-semibold text-emerald-600 flex items-center gap-0.5 justify-end">
                      <Check className="h-3 w-3" />
                      OK
                    </div>
                  )}
                </div>
              </div>
              {/* Barra de progreso hacia el umbral */}
              <div
                className="h-1.5 rounded-full bg-stone-100 overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.round(km)}
                aria-valuemin={0}
                aria-valuemax={SHOE_REPLACE_THRESHOLD_KM}
                aria-label={`${km.toFixed(0)} km de ${SHOE_REPLACE_THRESHOLD_KM} km`}
              >
                <div
                  className={
                    "h-full transition-all " +
                    (overThreshold
                      ? "bg-red-500"
                      : nearThreshold
                        ? "bg-amber-500"
                        : "bg-emerald-500")
                  }
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-stone-400 mt-3 leading-relaxed">
        Umbral de cambio orientativo: {SHOE_REPLACE_THRESHOLD_KM} km. Cada
        modelo es distinto, pero es un buen punto de partida. Solo se cuentan
        las actividades de running.
      </p>
    </div>
  );
}

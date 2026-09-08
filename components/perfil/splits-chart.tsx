"use client";

/**
 * SplitsChart — mini-gráfico de barras con el pace por km de una actividad.
 *
 * Cada barra es un km. La altura es relativa al pace más rápido (la barra
 * más alta = km más lento; la más baja = km más rápido). El color cambia:
 *  - Verde: pace más rápido (top 25%)
 *  - Stone: pace medio
 *  - Rojo: pace más lento (top 25% de lentitud)
 *
 * Pensado para ser compacto: ~24-32px de alto por barra, encaja en una
 * card de actividad o en la card de un PR. Hover/focus muestra el pace
 * exacto del km y el desnivel.
 *
 * Si no hay splits, devuelve null (no renderiza nada — la UI padre decide
 * si mostrar un fallback).
 */

import { useMemo } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

interface Split {
  split: number;
  distance: number;
  elapsed_time: number;
  moving_time: number;
  elevation_difference: number;
  average_speed: number;
  average_heartrate?: number;
  average_cadence?: number;
}

interface SplitsChartProps {
  splits: Split[];
  /** Altura máxima de cada barra en px. Default: 32. */
  barMaxHeight?: number;
  /** Mostrar labels de pace bajo cada barra. Default: true. */
  showLabels?: boolean;
  /** Mostrar la cabecera con km más rápido / más lento. Default: true. */
  showHeader?: boolean;
}

function formatPace(secPerKm: number): string {
  if (!isFinite(secPerKm) || secPerKm <= 0) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SplitsChart({
  splits,
  barMaxHeight = 32,
  showLabels = true,
  showHeader = true,
}: SplitsChartProps) {
  // Calcular pace por km (Strava da average_speed en m/s)
  const data = useMemo(() => {
    if (!splits || splits.length === 0) return [];
    return splits.map((s) => {
      const km = s.distance / 1000;
      // Si el split mide distinto de 1 km (p.ej. el último), normalizar
      // a pace por km: moving_time / km.
      const secPerKm = km > 0 ? s.moving_time / km : 0;
      return {
        split: s.split,
        secPerKm,
        elevationDiff: s.elevation_difference,
        hr: s.average_heartrate,
      };
    });
  }, [splits]);

  if (data.length === 0) return null;

  // Encontrar min/max para escalar y colorear
  const validPaces = data.map((d) => d.secPerKm).filter((p) => p > 0);
  if (validPaces.length === 0) return null;
  const minPace = Math.min(...validPaces);
  const maxPace = Math.max(...validPaces);
  const range = maxPace - minPace || 1;

  // Cuartiles para color
  const sortedPaces = [...validPaces].sort((a, b) => a - b);
  const q1 = sortedPaces[Math.floor(sortedPaces.length * 0.25)];
  const q3 = sortedPaces[Math.floor(sortedPaces.length * 0.75)];

  // Km más rápido y más lento
  const fastestKm = data.reduce((acc, d) =>
    d.secPerKm > 0 && d.secPerKm < acc.secPerKm ? d : acc,
  );
  const slowestKm = data.reduce((acc, d) =>
    d.secPerKm > acc.secPerKm ? d : acc,
  );

  return (
    <div className="w-full">
      {showHeader && (
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-stone-500 mb-1.5">
          <span className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-emerald-600" />
            Km {fastestKm.split}: {formatPace(fastestKm.secPerKm)}
          </span>
          <span className="text-stone-400">{data.length} km</span>
          <span className="flex items-center gap-1">
            {formatPace(slowestKm.secPerKm)}: Km {slowestKm.split}
            <TrendingUp className="h-3 w-3 text-red-600" />
          </span>
        </div>
      )}

      <div
        className="flex items-end gap-0.5"
        role="img"
        aria-label={`Splits por km: del más rápido ${formatPace(fastestKm.secPerKm)} al más lento ${formatPace(slowestKm.secPerKm)}`}
      >
        {data.map((d) => {
          if (d.secPerKm <= 0) return null;
          // Altura inversa: menor pace (más rápido) → barra más alta.
          // Pero los humanos leen "alto = más" intuitivamente, así que
          // invertimos: pace más rápido = barra más alta, más lento = baja.
          const normalized = (d.secPerKm - minPace) / range; // 0 = más rápido, 1 = más lento
          const heightPct = 100 - normalized * 60; // 100% (rápido) → 40% (lento)
          const heightPx = Math.max(6, (heightPct / 100) * barMaxHeight);

          let colorClass = "bg-stone-400";
          if (d.secPerKm <= q1) colorClass = "bg-emerald-500";
          else if (d.secPerKm >= q3) colorClass = "bg-red-400";

          return (
            <div
              key={d.split}
              className="flex-1 flex flex-col items-center justify-end min-w-0"
              title={`Km ${d.split}: ${formatPace(d.secPerKm)}${
                d.elevationDiff
                  ? ` (${d.elevationDiff > 0 ? "+" : ""}${d.elevationDiff.toFixed(0)} m)`
                  : ""
              }${d.hr ? ` · ${Math.round(d.hr)} bpm` : ""}`}
            >
              <div
                className={"w-full rounded-t-sm " + colorClass}
                style={{ height: heightPx }}
                aria-hidden="true"
              />
            </div>
          );
        })}
      </div>

      {showLabels && (
        <div className="flex gap-0.5 mt-1">
          {data.map((d) => (
            <div
              key={d.split}
              className="flex-1 text-center text-[9px] text-stone-400 font-mono min-w-0 truncate"
              aria-hidden="true"
            >
              {d.split}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

// =============================================================================
// mi-dorsal — DistanceModalityPicker
// =============================================================================
// Selector de modalidad/distancia para carreras con varias pruebas (ej.
// "Media Maratón de Albacete" con 10K y 21K). Se usa tanto al añadir una
// carrera al calendario (AddToCalendarWidget) como al editarla después
// (HiloNode). Construye las opciones a partir de la distancia principal
// de la carrera + `race.raceFormats`.
// =============================================================================

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { labelForDistanceKm } from "@/lib/prediction/effective-distance";

export interface DistanceOption {
  distanceKm: number;
  label: string;
  elevationGainM?: number;
}

interface RaceForPicker {
  distanceKm: number;
  elevationGainM?: number;
  raceFormats?: Array<{
    name: string;
    distanceKm: number;
    elevationGainM?: number;
  }>;
}

/**
 * Construye las opciones del selector: la distancia principal de la
 * carrera + cada entrada de raceFormats. Devuelve [] si la carrera no
 * tiene raceFormats (no hace falta selector, comportamiento actual).
 */
export function buildDistanceOptions(race: RaceForPicker): DistanceOption[] {
  if (!race.raceFormats || race.raceFormats.length === 0) return [];
  const options: DistanceOption[] = [
    {
      distanceKm: race.distanceKm,
      label: labelForDistanceKm(race.distanceKm),
      elevationGainM: race.elevationGainM,
    },
    ...race.raceFormats.map((f) => ({
      distanceKm: f.distanceKm,
      label: f.name,
      elevationGainM: f.elevationGainM,
    })),
  ];
  // Deduplicar por distanceKm (si raceFormats ya incluye la principal)
  const seen = new Set<number>();
  return options.filter((o) => {
    if (seen.has(o.distanceKm)) return false;
    seen.add(o.distanceKm);
    return true;
  });
}

interface DistanceModalityPickerProps {
  options: DistanceOption[];
  selected: DistanceOption | null;
  onSelect: (option: DistanceOption) => void;
  className?: string;
}

export function DistanceModalityPicker({
  options,
  selected,
  onSelect,
  className,
}: DistanceModalityPickerProps) {
  if (options.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <label className="label flex items-center justify-between">
        <span>¿A qué distancia te apuntas?</span>
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((opt) => {
          const isSelected = selected?.distanceKm === opt.distanceKm;
          return (
            <button
              key={opt.distanceKm}
              type="button"
              onClick={() => onSelect(opt)}
              className={cn(
                "rounded-lg border-2 px-3 py-2 text-left transition-colors",
                isSelected
                  ? "border-runner-primary bg-runner-primary/5"
                  : "border-gray-200 hover:border-runner-primary/50",
              )}
            >
              <div className="text-sm font-semibold text-runner-dark">{opt.label}</div>
              <div className="text-xs text-gray-500">
                {opt.distanceKm.toFixed(opt.distanceKm % 1 === 0 ? 0 : 1)} km
              </div>
            </button>
          );
        })}
      </div>
      <p className="flex items-start gap-1.5 text-xs text-gray-500">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-500" aria-hidden="true" />
        <span>
          Detectamos las modalidades de esta carrera automáticamente — puede
          faltar alguna o estar mal. Si es tu caso,{" "}
          <a href="/feedback" className="underline font-semibold">
            dínoslo
          </a>
          .
        </span>
      </p>
    </div>
  );
}

"use client";

/**
 * PrCardWithMap — versión extendida de una card de PR que muestra
 * el mini-mapa del recorrido si el PR viene de una actividad de Strava
 * (`sourceActivityId` presente en el PR).
 *
 * Si no hay actividad fuente (PR manual, o ingerido antes de este cambio),
 * se renderiza solo la card compacta con tiempo + distancia + fecha.
 *
 * Mantiene la misma estructura visual que la card simple del perfil para
 * que el grid se vea coherente.
 */

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PolylineMapWrapper } from "./polyline-map-wrapper";
import { formatTime, formatDate } from "@/lib/utils";
import { Trophy, ExternalLink, Trash2 } from "lucide-react";

interface PrCardWithMapProps {
  pr: {
    _id: string;
    distanceLabel: string;
    distanceM: number;
    timeSeconds: number;
    achievedAt?: string;
    sourceActivityId?: string;
    source?: string;
  };
  onRemove?: (id: string, distanceLabel: string) => void;
}

function StravaIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
    </svg>
  );
}

export function PrCardWithMap({ pr, onRemove }: PrCardWithMapProps) {
  // Solo consultamos si hay activityId. La query es null-safe por si
  // el PR es manual (sin sourceActivityId) o la actividad se borró.
  const activityMap = useQuery(
    api.activities.queries.getActivityMap,
    pr.sourceActivityId
      ? ({ id: pr.sourceActivityId as any } as any)
      : ("skip" as any),
  );

  const fromStrava =
    pr.source === "strava" || pr.source === "strava-export" || pr.source === "race_result";

  return (
    <div className="relative border border-gray-200 rounded-md p-3 group bg-white">
      {onRemove && (
        <button
          onClick={() => onRemove(pr._id, pr.distanceLabel)}
          className="absolute top-2 right-2 z-10 text-gray-300 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
          aria-label={`Eliminar marca de ${pr.distanceLabel}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
          <Trophy className="h-3 w-3 text-yellow-500" />
          {pr.distanceLabel}
        </div>
        {fromStrava && pr.sourceActivityId && (
          <a
            href={`https://www.strava.com/activities/${pr.sourceActivityId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-orange-600 hover:underline flex items-center gap-0.5"
            title="Ver en Strava"
          >
            <StravaIcon className="h-2.5 w-2.5" />
            Strava
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>

      <div className="text-2xl font-bold text-runner-primary font-mono">
        {formatTime(pr.timeSeconds)}
      </div>

      {pr.achievedAt && (
        <div className="text-xs text-gray-500 mt-0.5 mb-2">
          {formatDate(pr.achievedAt)}
        </div>
      )}

      {/* Mini-mapa: solo si la query devolvió polyline. activityMap puede
          ser undefined mientras carga; en ese caso no renderizamos nada
          (no fallback feo de "cargando…"). */}
      {activityMap?.mapPolyline && (
        <div className="mt-2 -mx-1">
          <PolylineMapWrapper
            polyline={activityMap.mapPolyline}
            height={120}
            alt={`Mapa del recorrido de tu ${pr.distanceLabel} PR`}
          />
          {activityMap.locationCity && (
            <div className="text-[10px] text-stone-400 mt-1 text-center">
              📍 {activityMap.locationCity}
              {activityMap.locationCountry
                ? `, ${activityMap.locationCountry}`
                : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

// =============================================================================
// mi-dorsal — Activity stats card
// =============================================================================
// Resumen de las actividades del usuario: total km, km/semana, cadencia,
// consistencia. Se muestra encima del feed.
// =============================================================================

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Activity, MapPin, TrendingUp, Heart, Clock } from "lucide-react";

export function ActivityStatsCard() {
  const stats = useQuery(api.activities.queries.getMyActivityStats, {});

  if (stats === undefined) {
    return <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />;
  }
  if (stats.totalActivities === 0) return null;

  return (
    <div className="card mb-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5 text-runner-primary" />
        Tu actividad
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat
          icon={<MapPin className="h-4 w-4" />}
          value={Math.round(stats.totalDistanceKm).toString()}
          unit="km"
          label="distancia total"
        />
        <Stat
          icon={<TrendingUp className="h-4 w-4" />}
          value={Math.round(stats.weeklyVolumeMedianKm).toString()}
          unit="km/sem"
          label="mediana semanal"
        />
        <Stat
          icon={<Clock className="h-4 w-4" />}
          value={`${(stats.consistencyPct * 100).toFixed(0)}`}
          unit="%"
          label="días con actividad"
        />
        <Stat
          icon={<Heart className="h-4 w-4" />}
          value={
            stats.avgCadenceSpm
              ? Math.round(stats.avgCadenceSpm).toString()
              : "—"
          }
          unit="spm"
          label="cadencia easy"
        />
      </div>
    </div>
  );
}

function Stat({
  icon,
  value,
  unit,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  unit: string;
  label: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-gray-500 mb-1">
        {icon}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold font-mono text-runner-primary">
          {value}
        </span>
        <span className="text-xs text-gray-500">{unit}</span>
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

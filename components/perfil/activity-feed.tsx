"use client";

// =============================================================================
// mi-dorsal — Activity feed
// =============================================================================
// Lista paginada de las actividades del usuario, con filtros por tipo
// (Todas / Carreras / Trail / Long runs / Series / Easy) y paginación simple.
// =============================================================================

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatDuration, formatDistanceKm } from "@/lib/utils";
import {
  Calendar,
  Mountain,
  TrendingUp,
  Activity as ActivityIcon,
  Zap,
  Heart,
  Clock,
  Filter,
} from "lucide-react";

const TYPE_FILTERS = [
  { value: null as null, label: "Todas", icon: ActivityIcon },
  { value: "race" as const, label: "Carreras", icon: Trophy },
  { value: "trail" as const, label: "Trail", icon: Mountain },
  { value: "long_run" as const, label: "Tiradas largas", icon: TrendingUp },
  { value: "interval" as const, label: "Series", icon: Zap },
  { value: "easy" as const, label: "Easy", icon: ActivityIcon },
];

const TYPE_BADGES: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  race: { label: "Carrera", color: "bg-runner-primary text-white", icon: <Trophy className="h-3 w-3" /> },
  trail: { label: "Trail", color: "bg-emerald-600 text-white", icon: <Mountain className="h-3 w-3" /> },
  long_run: { label: "Tirada larga", color: "bg-blue-600 text-white", icon: <TrendingUp className="h-3 w-3" /> },
  tempo: { label: "Tempo", color: "bg-orange-500 text-white", icon: <Zap className="h-3 w-3" /> },
  interval: { label: "Series", color: "bg-purple-600 text-white", icon: <Zap className="h-3 w-3" /> },
  easy: { label: "Easy", color: "bg-gray-500 text-white", icon: <ActivityIcon className="h-3 w-3" /> },
  recovery: { label: "Recuperación", color: "bg-gray-400 text-white", icon: <ActivityIcon className="h-3 w-3" /> },
};

function Trophy(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

export function ActivityFeed() {
  const [typeFilter, setTypeFilter] = useState<null | string>(null);
  const [showAll, setShowAll] = useState(false);
  const activities = useQuery(
    api.activities.queries.listMyActivities,
    typeFilter
      ? { limit: showAll ? 200 : 20, type: typeFilter as any }
      : { limit: showAll ? 200 : 20 },
  );
  const totalCount = useQuery(api.activities.queries.getMyActivityCount, {});

  if (activities === undefined) {
    return <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />;
  }

  // Empty state: usuario sin actividades. Le enseñamos cómo empezar.
  if (totalCount === 0) {
    return (
      <div className="card mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Calendar className="h-5 w-5 text-runner-primary" />
          Tu actividad
        </h2>
        <div className="text-center py-6 px-2">
          <div
            aria-hidden="true"
            className="inline-flex items-center justify-center mb-3 h-12 w-12 rounded-full bg-runner-warm text-runner-primary"
          >
            <ActivityIcon className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-stone-900 mb-1">
            Aún no has subido actividades
          </h3>
          <p className="text-sm text-stone-600 max-w-md mx-auto mb-4 leading-relaxed">
            Conecta Strava o sube tu export y verás aquí tus entrenamientos,
            tu progreso y tus carreras detectadas automáticamente.
          </p>
          <a
            href="#conexiones"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-runner-primary hover:underline"
          >
            Cómo empezar →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-runner-primary" />
          Actividad reciente
        </h2>
        <span className="text-xs text-gray-500">
          {totalCount.toLocaleString("es-ES")} total
        </span>
      </div>

      {/* Filtros por tipo */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {TYPE_FILTERS.map((f) => {
          const Icon = f.icon;
          const active = typeFilter === f.value;
          return (
            <button
              key={f.label}
              onClick={() => setTypeFilter(f.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                active
                  ? "bg-runner-primary text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {f.label}
            </button>
          );
        })}
      </div>

      {activities.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">
          No hay actividades con este filtro
        </p>
      ) : (
        <div className="space-y-2">
          {activities.map((a) => {
            const badge = TYPE_BADGES[a.type];
            return (
              <div
                key={a._id}
                className="flex items-center gap-3 p-3 border border-gray-100 rounded-md hover:bg-gray-50 transition-colors"
              >
                {/* Tipo badge */}
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${badge.color}`}
                >
                  {badge.icon}
                  {badge.label}
                </div>

                {/* Info principal */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {a.name ?? formatActivityType(a.type)}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                    <span>
                      {new Date(a.startedAt).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    {a.avgHeartRate && (
                      <span className="flex items-center gap-0.5">
                        <Heart className="h-3 w-3" />
                        {Math.round(a.avgHeartRate)}
                      </span>
                    )}
                    {a.matchedRaceId && (
                      <span className="text-emerald-600">· carrera</span>
                    )}
                  </div>
                </div>

                {/* Distancia + tiempo */}
                <div className="text-right flex-shrink-0">
                  <div className="font-mono font-semibold text-sm">
                    {formatDistanceKm(a.distanceM)}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                    {formatDuration(a.durationSec)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activities.length >= 20 && !showAll && totalCount > 20 && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-4 w-full text-sm text-runner-primary hover:underline"
        >
          Ver todas las {totalCount.toLocaleString("es-ES")} actividades
        </button>
      )}
    </div>
  );
}

function formatActivityType(type: string): string {
  return (
    {
      race: "Carrera",
      trail: "Trail",
      long_run: "Tirada larga",
      tempo: "Tempo",
      interval: "Series",
      easy: "Rodaje suave",
      recovery: "Recuperación",
    }[type] ?? type
  );
}

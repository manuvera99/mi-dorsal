"use client";

// =============================================================================
// mi-dorsal — Activity feed
// =============================================================================
// Lista paginada de las actividades del usuario, con filtros por tipo
// (Todas / Carreras / Trail / Long runs / Series / Easy) y paginación simple.
// Cada item se puede expandir para ver el mapa del recorrido, los splits
// por km, el dispositivo y las zapatillas.
// =============================================================================

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatDuration, formatDistanceKm } from "@/lib/utils";
import { PolylineMapWrapper } from "./polyline-map-wrapper";
import { SplitsChart } from "./splits-chart";
import {
  Calendar,
  Mountain,
  TrendingUp,
  Activity as ActivityIcon,
  Zap,
  Heart,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Watch,
  Footprints,
  MapPin,
} from "lucide-react";

const PAGE_SIZE = 10;

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
  const [page, setPage] = useState(0);
  // `cursors[i]` = startedAt del ÚLTIMO item de la página i, que se usa como
  // cursor (afterMs) para obtener la página i+1. La página 0 parte de
  // `afterMs: undefined` (las más recientes primero, ya que el query ordena
  // desc por startedAt). Cuando avanzamos a una nueva página y llegan los
  // datos, guardamos su cursor aquí.
  const [cursors, setCursors] = useState<number[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const afterMs = page === 0 ? undefined : cursors[page - 1];
  const activities = useQuery(api.activities.queries.listMyActivities, {
    limit: PAGE_SIZE,
    type: (typeFilter ?? undefined) as any,
    afterMs,
  });
  const totalCount = useQuery(api.activities.queries.getMyActivityCount, {});

  // Cuando llegan los datos de una página nueva, guardamos su cursor (último
  // startedAt) para que "Atrás" pueda volver. Solo si el cursor para esa
  // página aún no está registrado.
  useEffect(() => {
    if (!activities || activities.length === 0) return;
    if (cursors.length < page + 1) {
      const lastStartedAt = activities[activities.length - 1].startedAt;
      setCursors((c) => [...c, lastStartedAt]);
    }
  }, [activities, page, cursors.length]);

  // Reset paginación al cambiar el filtro
  useEffect(() => {
    setPage(0);
    setCursors([]);
  }, [typeFilter]);

  if (activities === undefined) {
    return <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />;
  }

  // `useQuery` puede devolver undefined en el primer render. Coerce a 0
  // para que las comparaciones y `.toLocaleString()` no rompan en SSR
  // (pre-existente; el componente ya usaba totalCount como si fuera number).
  const total = totalCount ?? 0;

  // Empty state: usuario sin actividades. Le enseñamos cómo empezar.
  if (total === 0) {
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
          {total.toLocaleString("es-ES")} total
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
            const expanded = expandedId === a._id;
            const hasDetail =
              a.mapPolyline || (a.splitsMetric && a.splitsMetric.length > 0) ||
              a.deviceName || a.gearName || a.locationCity;
            return (
              <div
                key={a._id}
                className="border border-gray-100 rounded-md hover:bg-gray-50 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => hasDetail && setExpandedId(expanded ? null : a._id)}
                  className={
                    "w-full flex items-center gap-3 p-3 text-left " +
                    (hasDetail ? "cursor-pointer" : "cursor-default")
                  }
                  aria-expanded={expanded}
                  disabled={!hasDetail}
                >
                  {/* Tipo badge */}
                  <div
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs flex-shrink-0 ${badge.color}`}
                  >
                    {badge.icon}
                    {badge.label}
                  </div>

                  {/* Info principal */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {a.name ?? formatActivityType(a.type)}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5 flex-wrap">
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
                      {a.gearName && (
                        <span className="flex items-center gap-0.5 text-stone-500">
                          <Footprints className="h-3 w-3" />
                          <span className="truncate max-w-[120px]">{a.gearName}</span>
                        </span>
                      )}
                      {a.deviceName && (
                        <span className="flex items-center gap-0.5 text-stone-500">
                          <Watch className="h-3 w-3" />
                          <span className="truncate max-w-[120px]">{a.deviceName}</span>
                        </span>
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

                  {hasDetail && (
                    <div className="flex-shrink-0 text-stone-400">
                      {expanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  )}
                </button>

                {expanded && hasDetail && (
                  <div className="px-3 pb-3 pt-1 space-y-3 border-t border-stone-100 bg-stone-50/50 rounded-b-md">
                    {/* Mapa del recorrido */}
                    {a.mapPolyline && (
                      <PolylineMapWrapper
                        polyline={a.mapPolyline}
                        height={180}
                        alt={`Mapa de ${a.name ?? formatActivityType(a.type)}`}
                      />
                    )}

                    {/* Splits por km */}
                    {a.splitsMetric && a.splitsMetric.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-stone-500 font-semibold mb-1.5">
                          Splits por km
                        </div>
                        <SplitsChart splits={a.splitsMetric} barMaxHeight={28} />
                      </div>
                    )}

                    {/* Metadata: ubicación */}
                    {a.locationCity && (
                      <div className="flex items-center gap-1 text-xs text-stone-600">
                        <MapPin className="h-3 w-3" />
                        {a.locationCity}
                        {a.locationCountry ? `, ${a.locationCountry}` : ""}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(() => {
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const hasPrev = page > 0;
        // `hasNext` = true si la página actual viene llena (señal de que
        // hay más) y aún no estamos en la última. Con la última página
        // parcial (activities.length < PAGE_SIZE), no hay siguiente.
        const hasNext = activities.length === PAGE_SIZE && page < totalPages - 1;
        if (totalPages <= 1) return null;
        return (
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-stone-100 pt-3">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={!hasPrev}
              className="inline-flex items-center gap-1 text-sm font-medium text-runner-primary disabled:text-stone-300 disabled:cursor-not-allowed hover:underline"
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
              Atrás
            </button>
            <span className="text-xs text-stone-500 font-mono">
              Página {page + 1} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNext}
              className="inline-flex items-center gap-1 text-sm font-medium text-runner-primary disabled:text-stone-300 disabled:cursor-not-allowed hover:underline"
              aria-label="Página siguiente"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        );
      })()}
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

"use client";

/**
 * PrDetailClient — vista de detalle de una marca personal (PR) del usuario.
 *
 * Carga:
 *  - El PR por id (personalRecords.getById)
 *  - La actividad fuente de Strava (activities.queries.getActivityFull), si el
 *    PR tiene sourceActivityId (los PRs manuales / heredados no lo tienen)
 *  - El historial completo de PRs en esa misma distancia
 *    (personalRecords.getMyDistanceHistory) — para mostrar la evolución
 *
 * Renderiza: header con tiempo + distancia + fecha, mapa grande, splits por
 * km, stats grid (pace medio, desnivel, HR, cadencia), device, gear, link a
 * Strava, y la lista de PRs anteriores para esa distancia.
 */

import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatTime, formatDate, formatPace } from "@/lib/utils";
import { PolylineMapWrapper } from "@/components/perfil/polyline-map-wrapper";
import { SplitsChart } from "@/components/perfil/splits-chart";
import { LinkStravaSection } from "@/components/perfil/link-strava-section";
import {
  ArrowLeft,
  Trophy,
  ExternalLink,
  Watch,
  Footprints,
  MapPin,
  Mountain,
  Heart,
  Activity as ActivityIcon,
  TrendingDown,
  Calendar,
  Unlink,
  Flag,
} from "lucide-react";

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

function StatTile({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-stone-200 bg-white p-3">
      <div className="text-[10px] uppercase tracking-widest text-stone-500 font-semibold flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-lg font-bold font-mono text-runner-dark mt-1">
        {value}
      </div>
      {sub && <div className="text-[10px] text-stone-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export function PrDetailClient({ prId }: { prId: string }) {
  const pr = useQuery(api.personalRecords.getById, { id: prId as any });
  const activity = useQuery(
    api.activities.queries.getActivityFull,
    pr?.sourceActivityId
      ? ({ id: pr.sourceActivityId as any } as any)
      : ("skip" as any),
  );
  const history = useQuery(
    api.personalRecords.getMyDistanceHistory,
    pr ? ({ distanceM: pr.distanceM } as any) : ("skip" as any),
  );
  // Best effort matching la distancia del PR dentro de la actividad.
  // Null si no hay actividad, o si la actividad no tiene best_efforts
  // con la distancia del PR (caso raro: PR manual, ultra, etc.).
  const bestEffortData = useQuery(
    api.personalRecords.getBestEffortForPr,
    pr ? ({ prId: pr._id } as any) : ("skip" as any),
  );

  // Estados de carga y error
  if (pr === undefined || history === undefined) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="h-8 w-32 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="h-48 bg-gray-50 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (pr === null) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="card">
          <h1 className="text-xl font-bold mb-2">PR no encontrado</h1>
          <p className="text-sm text-stone-600 mb-4">
            Esta marca no existe o no es tuya.
          </p>
          <Link
            href="/perfil"
            className="inline-flex items-center gap-1 text-sm font-semibold text-runner-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a tu perfil
          </Link>
        </div>
      </div>
    );
  }

  const isCurrent = pr.isCurrent !== false;
  const otherHistory = (history ?? []).filter((h) => h._id !== pr._id);

  // Pace medio: distanceM / timeSeconds → m/s, luego 1000 / m/s → seg/km
  const avgPaceSecPerKm =
    pr.timeSeconds > 0 && pr.distanceM > 0
      ? pr.timeSeconds / (pr.distanceM / 1000)
      : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/perfil"
        className="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-runner-primary mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a tu perfil
      </Link>

      {/* Hero: distancia + tiempo */}
      <div className="card mb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-stone-500 text-xs uppercase tracking-wider font-semibold">
              <Trophy className={`h-4 w-4 ${isCurrent ? "text-yellow-500" : "text-stone-400"}`} />
              {pr.distanceLabel}
              {!isCurrent && (
                <span className="ml-1 normal-case tracking-normal text-[10px] text-stone-400 font-normal">
                  (histórico)
                </span>
              )}
            </div>
            <div className="text-5xl md:text-6xl font-bold text-runner-primary font-mono leading-none mt-2">
              {formatTime(pr.timeSeconds)}
            </div>
          </div>
          {pr.achievedAt && (
            <div className="text-right text-sm text-stone-600 flex-shrink-0">
              <div className="flex items-center gap-1 justify-end">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(pr.achievedAt)}
              </div>
            </div>
          )}
        </div>

        {/* Si el PR se logró dentro de una actividad mayor, lo decimos
            explícitamente. El user popular no siempre sabe distinguir. */}
        {pr.sourceActivityDistanceLabel && (
          <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
            <Flag className="h-3 w-3" />
            Tu {pr.distanceLabel} se logró dentro de una {pr.sourceActivityDistanceLabel}
            {pr.sourceActivityIsRace ? " (carrera)" : ""}
          </div>
        )}

        {/* Pace medio + desnivel (si hay activity) */}
        {activity && (
          <div className="flex items-center gap-3 text-sm text-stone-600 flex-wrap">
            <span className="flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5" />
              {formatPace(avgPaceSecPerKm)} /km
            </span>
            {activity.elevationGainM != null && activity.elevationGainM > 0 && (
              <span className="flex items-center gap-1">
                <Mountain className="h-3.5 w-3.5" />
                +{activity.elevationGainM.toFixed(0)} m
              </span>
            )}
            {activity.locationCity && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {activity.locationCity}
                {activity.locationCountry ? `, ${activity.locationCountry}` : ""}
              </span>
            )}
            {activity.gearName && (
              <span className="flex items-center gap-1">
                <Footprints className="h-3.5 w-3.5" />
                <span className="truncate max-w-[160px]">{activity.gearName}</span>
              </span>
            )}
            {activity.deviceName && (
              <span className="flex items-center gap-1">
                <Watch className="h-3.5 w-3.5" />
                <span className="truncate max-w-[160px]">{activity.deviceName}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Si el PR aún no tiene actividad de Strava vinculada, mostramos
          el bloque de búsqueda. Si ya tiene, un botón pequeño para
          desvincular por si se equivocó. */}
      {!pr.sourceActivityId && (
        <LinkStravaSection
          prId={pr._id}
          distanceM={pr.distanceM}
          timeSeconds={pr.timeSeconds}
          achievedAt={pr.achievedAt}
        />
      )}

      {/* Mapa del recorrido (si hay polyline) */}
      {activity?.mapPolyline && (
        <div className="card mb-4">
          <h2 className="text-sm font-semibold text-stone-700 mb-2 flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-runner-primary" />
            Recorrido
          </h2>
          <PolylineMapWrapper
            polyline={activity.mapPolyline}
            height={320}
            showEndpoints={true}
            alt={`Mapa del recorrido de la PR de ${pr.distanceLabel}`}
          />
        </div>
      )}

      {/* Splits por km. Si el PR viene de una actividad mayor (best_effort),
          usamos solo los splits que caen dentro del esfuerzo — p.ej. para
          un 5K dentro de 10K mostramos los 5 primeros splits, no los 10. */}
      {(() => {
        // Prioridad: subset del best_effort > splits de la actividad.
        const splitsToShow =
          bestEffortData?.splits && bestEffortData.splits.length > 0
            ? bestEffortData.splits
            : activity?.splitsMetric;
        if (!splitsToShow || splitsToShow.length === 0) return null;
        return (
          <div className="card mb-4">
            <h2 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-1.5">
              <ActivityIcon className="h-4 w-4 text-runner-primary" />
              Splits por km
            </h2>
            <SplitsChart splits={splitsToShow} barMaxHeight={36} />
          </div>
        );
      })()}

      {/* Stats grid. Cuando hay best_effort (PR dentro de una actividad
          mayor), usamos distancia/tiempo del esfuerzo en vez de la
          actividad completa, para que el "5K" del PR no muestre 10K. */}
      {activity && (
        <div className="card mb-4">
          <h2 className="text-sm font-semibold text-stone-700 mb-3">Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <StatTile
              label="Distancia"
              value={`${((bestEffortData?.effort.distance ?? activity.distanceM) / 1000).toFixed(2)} km`}
            />
            <StatTile
              label="Tiempo"
              value={formatTime(bestEffortData?.effort.moving_time ?? activity.durationSec)}
            />
            <StatTile
              label="Pace medio"
              value={formatPace(
                (bestEffortData?.effort.moving_time ?? activity.durationSec) /
                  ((bestEffortData?.effort.distance ?? activity.distanceM) / 1000),
              )}
              sub="/km"
            />
            <StatTile
              label="Desnivel +"
              value={
                activity.elevationGainM != null
                  ? `+${activity.elevationGainM.toFixed(0)} m`
                  : "—"
              }
              icon={<Mountain className="h-3 w-3" />}
            />
            {activity.avgHeartrate != null && (
              <StatTile
                label="FC media"
                value={`${Math.round(activity.avgHeartrate)} bpm`}
                icon={<Heart className="h-3 w-3" />}
              />
            )}
            {activity.maxHeartrate != null && (
              <StatTile
                label="FC máx"
                value={`${Math.round(activity.maxHeartrate)} bpm`}
                icon={<Heart className="h-3 w-3" />}
              />
            )}
            {activity.avgCadence != null && (
              <StatTile
                label="Cadencia"
                value={`${Math.round(activity.avgCadence)} spm`}
              />
            )}
          </div>
        </div>
      )}

      {/* Botón a Strava */}
      {activity && (
        <a
          href={`https://www.strava.com/activities/${activity.providerActivityId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="card flex items-center justify-center gap-2 mb-4 bg-orange-50 border-orange-200 text-orange-700 font-semibold hover:bg-orange-100 transition-colors"
        >
          <StravaIcon className="h-5 w-5" />
          Ver la actividad completa en Strava
          <ExternalLink className="h-4 w-4" />
        </a>
      )}

      {/* Si ya hay actividad vinculada, mostramos un botón discreto para
          desvincular (por si el usuario se equivocó de actividad). */}
      {pr.sourceActivityId && activity && (
        <div className="mb-4 flex justify-end">
          <UnlinkActivityButton prId={pr._id} />
        </div>
      )}

      {/* Historial de PRs para esta distancia */}
      {otherHistory.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-1.5">
            <Trophy className="h-4 w-4 text-stone-500" />
            Tus {pr.distanceLabel} anteriores
          </h2>
          <ul className="space-y-1">
            {otherHistory.map((h) => (
              <li key={h._id}>
                <Link
                  href={`/perfil/pr/${h._id}`}
                  className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-stone-50 transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-semibold text-stone-700">
                      {formatTime(h.timeSeconds)}
                    </span>
                    {h.achievedAt && (
                      <span className="text-xs text-stone-500 truncate">
                        {formatDate(h.achievedAt)}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-stone-400">
                    {h.isCurrent === false ? "histórico" : "actual"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Si no hay activity de Strava (PR manual / heredado) */}
      {!activity && (
        <div className="card text-center text-sm text-stone-500">
          <p>
            Este PR no tiene una actividad de Strava asociada (es un PR
            manual o se añadió antes de vincular Strava).
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Sub-componente: botón pequeño "Desvincular" que aparece cuando el PR ya
 * tiene una actividad de Strava vinculada. Útil si el usuario se equivocó
 * de actividad y quiere volver a buscar/vincular otra.
 */
function UnlinkActivityButton({ prId }: { prId: string }) {
  const unlink = useMutation(api.personalRecords.unlinkFromActivity);

  const handleClick = async () => {
    if (
      !confirm(
        "¿Desvincular esta marca de su actividad de Strava? El PR seguirá existiendo, solo perderá el mapa, los splits y la asociación.",
      )
    ) {
      return;
    }
    try {
      await unlink({ prId: prId as any });
    } catch (e) {
      console.error("Error desvinculando:", e);
      alert("No se pudo desvincular. Inténtalo de nuevo.");
    }
  };

  return (
    <button
      onClick={handleClick}
      className="text-xs text-stone-500 hover:text-red-600 inline-flex items-center gap-1"
    >
      <Unlink className="h-3 w-3" />
      Desvincular de Strava
    </button>
  );
}

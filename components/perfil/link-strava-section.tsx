"use client";

/**
 * LinkStravaSection — bloque "Vincular a Strava" en la página de detalle
 * de un PR que aún no tiene actividad de Strava asociada.
 *
 * Ofrece dos vías:
 *  1. Buscar: query `findCandidateActivitiesForPr` devuelve hasta 20
 *     actividades del usuario con distancia y tiempo cercanos al PR.
 *  2. Pegar URL: si el usuario tiene la URL de Strava a mano, extraemos
 *     el ID y resolvemos contra `findActivityByProviderId`. Más rápido
 *     que buscar si ya sabe cuál es.
 *
 * Una vez vinculada, se navega al propio PR (donde se ve la sección de
 * actividad gracias al `pr.sourceActivityId`).
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatDistanceKm, formatDuration, formatDate } from "@/lib/utils";
import { Link2, Search, X, Check } from "lucide-react";

function parseStravaActivityId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Aceptamos:
  //   https://www.strava.com/activities/1234567890
  //   https://strava.com/activities/1234567890
  //   strava.com/activities/1234567890
  //   1234567890 (solo el id, por si acaso)
  const m = trimmed.match(/activities\/(\d+)/);
  if (m) return m[1];
  if (/^\d{6,}$/.test(trimmed)) return trimmed;
  return null;
}

interface LinkStravaSectionProps {
  prId: string;
  distanceM: number;
  timeSeconds: number;
  achievedAt?: string;
  onLinked?: () => void;
}

export function LinkStravaSection({
  prId,
  distanceM,
  timeSeconds,
  achievedAt,
  onLinked,
}: LinkStravaSectionProps) {
  const [mode, setMode] = useState<"search" | "url">("search");
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  // Query de candidatos: solo si el modo es "search" y el PR está cargado.
  const aroundMs = achievedAt ? new Date(achievedAt).getTime() : Date.now();
  const candidates = useQuery(
    api.activities.queries.findCandidateActivitiesForPr,
    mode === "search"
      ? ({
          distanceM,
          targetTimeSeconds: timeSeconds,
          aroundMs,
        } as any)
      : ("skip" as any),
  );

  // Si el usuario pegó una URL, intentamos resolverla.
  const parsedId = urlInput ? parseStravaActivityId(urlInput) : null;
  const urlResolved = useQuery(
    api.activities.queries.findActivityByProviderId,
    parsedId ? ({ providerActivityId: parsedId } as any) : ("skip" as any),
  );

  const linkMutation = useMutation(api.personalRecords.linkToActivity);

  const handleLink = async (activityId: string) => {
    setLinking(true);
    try {
      await linkMutation({ prId: prId as any, activityId: activityId as any });
      onLinked?.();
    } catch (e: any) {
      setUrlError(e?.message ?? "Error al vincular");
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="card mb-4 border-runner-primary/30 bg-runner-primary/5">
      <div className="flex items-start gap-2 mb-3">
        <Link2 className="h-5 w-5 text-runner-primary flex-shrink-0 mt-0.5" />
        <div>
          <h2 className="text-sm font-semibold text-runner-dark">
            Vincular a una actividad de Strava
          </h2>
          <p className="text-xs text-stone-600 mt-0.5">
            Así verás el mapa del recorrido, los splits por km y el resto de
            datos de Strava.
          </p>
        </div>
      </div>

      {/* Tabs: Buscar / Pegar URL */}
      <div className="flex gap-1 mb-3 border-b border-stone-200">
        <button
          onClick={() => setMode("search")}
          className={
            "px-3 py-1.5 text-sm font-medium -mb-px " +
            (mode === "search"
              ? "border-b-2 border-runner-primary text-runner-primary"
              : "text-stone-500 hover:text-stone-700")
          }
        >
          <Search className="h-3.5 w-3.5 inline mr-1" />
          Buscar
        </button>
        <button
          onClick={() => setMode("url")}
          className={
            "px-3 py-1.5 text-sm font-medium -mb-px " +
            (mode === "url"
              ? "border-b-2 border-runner-primary text-runner-primary"
              : "text-stone-500 hover:text-stone-700")
          }
        >
          Pegar URL
        </button>
      </div>

      {/* Modo: buscar */}
      {mode === "search" && (
        <div>
          {candidates === undefined ? (
            <div className="h-16 bg-stone-100 rounded animate-pulse" />
          ) : candidates.length === 0 ? (
            <p className="text-sm text-stone-600">
              No hemos encontrado actividades de Strava con una distancia
              parecida en las últimas {achievedAt ? "4 semanas alrededor de la fecha" : "4 semanas"}.
              Prueba a <button
                onClick={() => setMode("url")}
                className="text-runner-primary font-semibold hover:underline"
              >pegar la URL</button> si la tienes a mano, o sincroniza Strava para traer actividades más antiguas.
            </p>
          ) : (
            <ul className="space-y-2">
              {candidates.map((a) => (
                <li
                  key={a._id}
                  className="flex items-center gap-3 p-2 rounded-md border border-stone-200 bg-white"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {a.name ?? "Actividad sin nombre"}
                    </div>
                    <div className="text-xs text-stone-500 flex items-center gap-2 mt-0.5">
                      <span>
                        {new Date(a.startedAt).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className="font-mono">
                        {formatDistanceKm(a.distanceM)}
                      </span>
                      <span className="font-mono">
                        {formatDuration(a.durationSec)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleLink(a._id)}
                    disabled={linking}
                    className="btn-primary text-xs py-1.5 px-2.5"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Vincular
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Modo: pegar URL */}
      {mode === "url" && (
        <div>
          <div className="flex gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                setUrlError(null);
              }}
              placeholder="https://www.strava.com/activities/1234567890"
              className="flex-1 border border-stone-300 rounded-md px-3 py-2 text-sm font-mono"
            />
            {urlInput && (
              <button
                onClick={() => {
                  setUrlInput("");
                  setUrlError(null);
                }}
                className="text-stone-400 hover:text-stone-600 px-2"
                aria-label="Limpiar"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {urlError && (
            <p className="text-xs text-red-700 mt-1">{urlError}</p>
          )}

          {/* Resolución: si hemos detectado un id y la query lo encuentra
              en nuestro DB, mostramos el resultado y un botón "Vincular". */}
          {parsedId && urlResolved !== undefined && (
            <div className="mt-3">
              {urlResolved === null ? (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2">
                  No tenemos esta actividad en tu perfil. Sincroniza Strava
                  desde <span className="font-mono">/perfil</span> (botón
                  "Conectar Strava") y vuelve a intentarlo.
                </p>
              ) : (
                <div className="flex items-center gap-3 p-2 rounded-md border border-emerald-200 bg-emerald-50">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {urlResolved.name ?? "Actividad encontrada"}
                    </div>
                    <div className="text-xs text-stone-500 flex items-center gap-2 mt-0.5">
                      <span>
                        {new Date(urlResolved.startedAt).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className="font-mono">
                        {formatDistanceKm(urlResolved.distanceM)}
                      </span>
                      <span className="font-mono">
                        {formatDuration(urlResolved.durationSec)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleLink(urlResolved._id)}
                    disabled={linking}
                    className="btn-primary text-xs py-1.5 px-2.5"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Vincular
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

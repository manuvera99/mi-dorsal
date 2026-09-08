"use client";

/**
 * HiloNode — un nodo del "hilo" del calendario.
 *
 * Cada carrera es un nudo en el hilo que te une a tu dorsal. Visualmente:
 *  - Una "etiqueta" vertical con la fecha (estilo dorsal mini) se apoya sobre
 *    el hilo.
 *  - Un punto de estado (rojo = planeada, verde = hecha, gris = DNS/DNF) marca
 *    el color del nudo.
 *  - La tarjeta a la derecha contiene el detalle de la carrera.
 *
 * El contenedor padre (`HiloTimeline`) se encarga de dibujar la línea vertical
 * del hilo. Este componente solo posiciona el marker encima de esa línea.
 */

import Link from "next/link";
import { Calendar, Hash, MapPin, Trophy } from "lucide-react";
import { cn, formatRaceType, formatTime, formatPaceLong } from "@/lib/utils";
import { TimePaceCalculator } from "./time-pace-calculator";

type HiloNodeStatus = "planned" | "done" | "dns" | "dnf";

/** PR mínimo que necesitamos en este componente. Coincide con la forma
 *  que devuelve `api.personalRecords.listMine` (subset de campos). */
interface UserPR {
  distanceM: number;
  distanceLabel?: string;
  timeSeconds: number;
}

interface HiloNodeProps {
  /** Posición 1-based en el hilo (para "Hilo #01", "Hilo #02"…). */
  index: number;
  /** myRace con `.race` enriquecido (igual que devuelve `api.myRaces.listMine`). */
  myRace: any;
  /** Si es la próxima carrera a correr (énfasis visual). */
  isNext?: boolean;
  /** PRs actuales del usuario (uno por distancia). Opcional: si no se
   *  pasan, no se muestra el bloque "Tu PR en X" en la card. */
  userPRs?: UserPR[];
}

/**
 * Encuentra el PR del usuario que coincide con la distancia de la carrera.
 * Match EXACTO en metros (race.distanceKm * 1000 === pr.distanceM).
 * Si no hay match exacto, devuelve null y la card no muestra el bloque.
 *
 * El usuario pidió match exacto ("si tiene PR en esa distancia se la
 * muestra ahi") en vez de Riegel/tolerancia.
 */
function findMatchingPR(
  raceDistanceKm: number,
  prs: UserPR[] | undefined,
): UserPR | null {
  if (!prs || prs.length === 0) return null;
  const targetM = Math.round(raceDistanceKm * 1000);
  return prs.find((pr) => pr.distanceM === targetM) ?? null;
}

const STATUS: Record<
  HiloNodeStatus,
  {
    /** Color de la etiqueta de fecha. */
    tab: string;
    /** Color del punto de estado bajo la etiqueta. */
    dot: string;
    /** Anillo del punto. */
    ring: string;
    /** Badge de estado dentro de la tarjeta. */
    badge: string;
    /** Texto del badge. */
    badgeLabel: string;
  }
> = {
  planned: {
    tab: "bg-runner-primary",
    dot: "bg-runner-primary",
    ring: "ring-runner-primary/30",
    badge: "bg-red-100 text-red-800",
    badgeLabel: "Planeada",
  },
  done: {
    tab: "bg-runner-accent",
    dot: "bg-runner-accent",
    ring: "ring-runner-accent/30",
    badge: "bg-green-100 text-green-800",
    badgeLabel: "Hecha",
  },
  dns: {
    tab: "bg-stone-400",
    dot: "bg-stone-400",
    ring: "ring-stone-300",
    badge: "bg-stone-100 text-stone-600",
    badgeLabel: "No saliste",
  },
  dnf: {
    tab: "bg-stone-400",
    dot: "bg-stone-400",
    ring: "ring-stone-300",
    badge: "bg-stone-100 text-stone-600",
    badgeLabel: "No terminaste",
  },
};

function fmtShortDate(d: string | undefined): {
  day: string;
  month: string;
  year: string;
} {
  if (!d) return { day: "?", month: "—", year: "" };
  try {
    const date = new Date(d);
    return {
      day: date.toLocaleDateString("es-ES", { day: "2-digit" }),
      month: date
        .toLocaleDateString("es-ES", { month: "short" })
        .replace(".", "")
        .toUpperCase(),
      year: date.getFullYear().toString(),
    };
  } catch {
    return { day: "?", month: "—", year: "" };
  }
}

export function HiloNode({ index, myRace, isNext, userPRs }: HiloNodeProps) {
  const status: HiloNodeStatus =
    (myRace.status as HiloNodeStatus) || "planned";
  const s = STATUS[status];
  const race = myRace.race;
  // PR matching: solo si la distancia coincide exacta con la de la carrera.
  const matchingPR = race ? findMatchingPR(race.distanceKm, userPRs) : null;
  const { day, month, year } = fmtShortDate(race?.startDate);

  // "Sombra" del tab según el estado (rojo, verde o gris) para mantener el
  // lenguaje visual del brand (consistente con la "dorsal mini" del empty state
  // y del welcome overlay).
  const tabShadow =
    status === "done"
      ? "shadow-lg shadow-green-500/15"
      : status === "planned"
        ? "shadow-lg shadow-red-500/20"
        : "shadow-md shadow-stone-500/15";

  return (
    <div className="relative first:mt-0">
      {/* Etiqueta de fecha — "dorsal mini" en top-0 del HiloNode (queda
          DENTRO del gap de mt-24, sin chocar con la card de arriba).
          El dorsal mide ~80px; el mt-24 (96px) le deja 16px de aire
          respecto al borde inferior de la card anterior. */}
      <div
        className={cn(
          "absolute left-0 top-0 z-10 flex w-14 sm:w-[72px] flex-col items-center justify-center rounded-2xl px-1.5 py-1.5 text-white",
          s.tab,
          tabShadow,
          status === "planned" &&
            isNext &&
            "ring-4 ring-runner-primary/20 transition-transform",
        )}
        aria-hidden="true"
      >
        <span className="font-mono text-[9px] font-bold uppercase leading-none tracking-widest opacity-90">
          {month}
        </span>
        <span className="font-mono text-xl font-bold leading-none tracking-tighter">
          {day}
        </span>
      </div>

      {/* Punto de estado — anilla blanca alrededor del punto, centrada
          sobre el hilo. Va a top-[40px] para alinearse con el centro
          vertical del dorsal compacto (~50px de alto). */}
      <div
        className={cn(
          "absolute left-[22px] top-[40px] z-20 h-3 w-3 rounded-full ring-4 sm:left-[30px] sm:top-[44px]",
          s.dot,
          s.ring,
        )}
        aria-label={`Estado: ${s.badgeLabel}`}
      />

      {/* Tarjeta — vive a la derecha del hilo, con margen para no chocar
          con la etiqueta de fecha. El mt-20 empuja la card DEBAJO del
          dorsal (que mide ~80px y está en top-0 absolute). Así el dorsal
          queda flotando en el gap entre cards sin tocar ninguna. */}
      <article
        className={cn(
          "card relative ml-[80px] mt-6 sm:ml-[96px] sm:mt-8",
          status === "done" && "bg-stone-50/50",
          status === "planned" &&
            isNext &&
            "ring-2 ring-runner-primary/30 bg-red-50/40",
        )}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <Hash className="h-3 w-3 text-runner-primary" aria-hidden="true" />
            <span className="font-mono font-semibold text-runner-primary">
              Hilo #{String(index).padStart(2, "0")}
            </span>
            <span className="text-stone-300" aria-hidden="true">
              ·
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                s.badge,
              )}
            >
              {s.badgeLabel}
            </span>
            {isNext && status === "planned" && (
              <span className="rounded bg-runner-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Tu próxima
              </span>
            )}
          </div>
          {myRace.dorsalNumber && (
            <span className="font-mono text-xs font-bold text-stone-500">
              Dorsal #{myRace.dorsalNumber}
            </span>
          )}
        </div>

        {race ? (
          <Link
            href={`/carreras/${race.slug}`}
            className="block group/title rounded"
          >
            <h3 className="text-lg font-semibold leading-tight transition-colors group-hover/title:text-runner-primary">
              {race.name}
            </h3>
          </Link>
        ) : (
          <h3 className="text-lg font-semibold leading-tight text-stone-400">
            Carrera no disponible
          </h3>
        )}

        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-sm text-stone-600">
          {race?.startTime && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {race.startTime}h
            </span>
          )}
          {race?.locality && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {race.locality}
            </span>
          )}
          {race && (
            <span className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5" />
              {race.distanceKm.toFixed(race.distanceKm % 1 === 0 ? 0 : 1)} km
              · {formatRaceType(race.raceType)}
            </span>
          )}
        </div>

        {/*
          Bloque de "objetivo + calculadora":
          - Línea 1 (opcional): PR del usuario en la distancia de la carrera.
            Solo sale si hay match EXACTO en metros (PR 15000m = carrera 15K).
            Si tu PR es 21097m (media maratón oficial) y la carrera es 21K
            exactos, no hay match y la fila se oculta.
          - Línea 2 (siempre que haya distancia > 0): calculadora
            bidireccional tiempo ↔ pace. El usuario puede marcar objetivo
            aunque NO tenga PR en esa distancia.
          - Línea 3 (opcional, si la carrera ya pasó): tiempo oficial real.

          Decisión de producto: la predicción automática de Daniels/Riegel
          ya no se muestra. El usuario marca su propio objetivo desde la
          calculadora. Si hay un valor guardado (predictedTimeSeconds de
          cuando añadió la carrera, o de un guardado anterior), la
          calculadora arranca con él.
        */}
        {(race && race.distanceKm > 0) || myRace.actualTimeSeconds ? (
          <div className="mt-4 border-t border-stone-100 pt-3">
            {matchingPR && (
              <div className="mb-3 flex items-baseline justify-between gap-2 rounded-md bg-stone-50 px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                  Tu PR en {Math.round(matchingPR.distanceM / 1000)} km
                </span>
                <span className="font-mono text-sm font-bold text-stone-700">
                  {formatTime(matchingPR.timeSeconds)}
                  {race && race.distanceKm > 0 && (
                    <span className="ml-2 text-[11px] font-normal text-stone-500">
                      ({formatPaceLong(matchingPR.timeSeconds / race.distanceKm)})
                    </span>
                  )}
                </span>
              </div>
            )}

            {race && race.distanceKm > 0 && (
              <TimePaceCalculator
                myRaceId={myRace._id}
                distanceKm={race.distanceKm}
                initialTimeSeconds={myRace.predictedTimeSeconds}
              />
            )}

            {myRace.actualTimeSeconds && (
              <div className="mt-3 flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                  Tiempo oficial
                </span>
                <span className="text-right">
                  <span className="font-mono text-base font-bold text-runner-accent">
                    {formatTime(myRace.actualTimeSeconds)}
                  </span>
                  {myRace.actualPosition && (
                    <span className="ml-2 text-[10px] text-stone-500">
                      Pos #{myRace.actualPosition}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        ) : null}
      </article>
    </div>
  );
}

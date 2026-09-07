"use client";

/**
 * HiloTimeline — el "hilo" vertical del calendario personal.
 *
 * Dibuja una línea vertical discontinua (`border-l-2 border-dashed`) y va
 * colocando `HiloNode`s sobre ella en orden cronológico ascendente. Entre
 * las carreras pasadas y las futuras inserta un marcador "Hoy" que rompe
 * visualmente el hilo.
 *
 * Props:
 *  - `myRaces`: array con `.race` enriquecido, ya ordenado por fecha ASC.
 *  - `showTodayMarker`: muestra el nodo "Hoy" entre pasado y futuro.
 *    Pasar `false` cuando solo se muestran futuras (no tiene sentido partir
 *    el hilo si no hay pasado visible).
 */

import { HiloNode } from "./hilo-node";

interface HiloTimelineProps {
  myRaces: any[];
  /** Si true, inserta un marcador "Hoy" entre pasado y futuro. */
  showTodayMarker?: boolean;
}

export function HiloTimeline({
  myRaces,
  showTodayMarker = true,
}: HiloTimelineProps) {
  if (myRaces.length === 0) return null;

  // Encontrar el índice de la primera carrera con fecha estrictamente
  // posterior a hoy → ahí va el marcador "Hoy".
  const todayMs = Date.now();
  const todayIndex = showTodayMarker
    ? myRaces.findIndex(
        (mr) =>
          mr.race?.startDate &&
          new Date(mr.race.startDate).getTime() >= todayMs,
      )
    : -1;

  // Índice de la primera `planned` futura → marca "isNext" para el énfasis.
  const nextPlannedIndex = myRaces.findIndex(
    (mr) =>
      mr.status === "planned" &&
      mr.race?.startDate &&
      new Date(mr.race.startDate).getTime() >= todayMs,
  );

  // Enumeración 1-based de los nodos. Si hay marcador "Hoy" en medio, los
  // nodos DESPUÉS de él siguen con su índice real (no se reinicia).
  const renderNode = (mr: any, displayIndex: number) => {
    const isNext =
      mr.status === "planned" && displayIndex - 1 === nextPlannedIndex;
    return (
      <HiloNode
        key={mr._id}
        index={displayIndex}
        myRace={mr}
        isNext={isNext}
      />
    );
  };

  return (
    <div
      className="relative mx-auto max-w-3xl"
      role="list"
      aria-label="Línea de tiempo de tu hilo de carreras"
    >
      {/* El hilo — línea vertical discontinua que recorre toda la timeline.
          Posicionada en left-7 (móvil) / left-9 (sm+), que coincide con el
          centro de la etiqueta de fecha de cada HiloNode (w-14 / w-[72px]). */}
      <div
        className="pointer-events-none absolute bottom-0 left-7 top-0 border-l-2 border-dashed border-runner-primary/35 sm:left-9"
        aria-hidden="true"
      />

      {myRaces.map((mr, i) => {
        const isLast = i === myRaces.length - 1;
        // Insertar "Hoy" justo antes de la primera carrera futura
        const showHoyHere =
          showTodayMarker && i === todayIndex && todayIndex > 0;

        return (
          <div key={mr._id}>
            {showHoyHere && <TodayMarker pastCount={todayIndex} />}
            <div className={isLast ? "" : ""}>
              {renderNode(mr, i + 1)}
            </div>
          </div>
        );
      })}

      {/* Si no hay futuras pero sí pasadas, "Hoy" va al final */}
      {showTodayMarker && todayIndex === -1 && myRaces.length > 0 && (
        <TodayMarker pastCount={myRaces.length} atEnd />
      )}
    </div>
  );
}

function TodayMarker({
  pastCount,
  atEnd = false,
}: {
  pastCount: number;
  atEnd?: boolean;
}) {
  return (
    <div
      className="relative flex items-center pb-2 pt-2"
      role="presentation"
      aria-hidden="true"
    >
      {/* Pill "Hoy" centrada sobre el hilo. El fondo del page (warm) "corta"
          visualmente la línea vertical en este punto. */}
      <div className="absolute left-0 top-1/2 z-20 -translate-y-1/2">
        <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-runner-primary bg-runner-warm px-3 py-0.5 font-mono text-[11px] font-bold uppercase tracking-widest text-runner-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-runner-primary" />
          Hoy
        </span>
      </div>
      <div className="ml-[80px] text-xs text-stone-500 sm:ml-[96px]">
        {atEnd ? (
          <>
            <span className="font-semibold text-stone-700">
              Tu hilo está esperando.
            </span>{" "}
            {pastCount} {pastCount === 1 ? "carrera en tu historial" : "carreras en tu historial"}
            .
          </>
        ) : (
          <>
            <span className="font-semibold text-stone-700">
              {pastCount === 1
                ? "1 carrera en tu historial"
                : `${pastCount} carreras en tu historial`}
            </span>
            . Aquí empieza lo que viene.
          </>
        )}
      </div>
    </div>
  );
}

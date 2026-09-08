"use client";

/**
 * HiloTimeline — el "hilo" vertical del calendario personal.
 *
 * Dibuja un **SVG curvo** (estilo hilo de coser) que serpentea suavemente
 * por detrás de los `HiloNode`s. El curveo es sutil (apenas perceptible)
 * pero le quita la sensación de "línea recta de timeline" y refuerza la
 * metáfora de marca "El hilo que te une a tu dorsal".
 *
 * El SVG se mide con un ResizeObserver para que el path se regenere si
 * cambia el alto del contenedor (filtros, resize, etc.) sin tener que
 * hardcodear coordenadas.
 *
 * Props:
 *  - `myRaces`: array con `.race` enriquecido, ya ordenado por fecha ASC.
 *  - `showTodayMarker`: muestra el nodo "Hoy" entre pasado y futuro.
 *    Pasar `false` cuando solo se muestran futuras (no tiene sentido partir
 *    el hilo si no hay pasado visible).
 */

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
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

  // PRs actuales del usuario (uno por distancia). Se hace UNA query aquí
  // y se pasa a cada HiloNode, en vez de N queries por nodo. El HiloNode
  // hace match exacto en metros para decidir si muestra el bloque "Tu PR".
  // useQuery devuelve undefined mientras carga — eso es OK, el HiloNode
  // simplemente no muestra el bloque del PR hasta que llegue.
  const userPRs = useQuery(api.personalRecords.listMine, {});

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
        userPRs={userPRs as any}
      />
    );
  };

  return (
    <div
      className="relative mx-auto max-w-3xl"
      role="list"
      aria-label="Línea de tiempo de tu hilo de carreras"
    >
      {/* El hilo — SVG curvo, fino y semitransparente, serpentea por detrás
          de las cards. Se mide con ResizeObserver para regenerar el path
          cuando cambia el alto del contenedor. */}
      <HiloSvg />

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

/**
 * HiloSvg — dibuja el "hilo" como una **línea de dashes** simple y
 * vertical, que recorre la timeline por detrás de los dorsales.
 *
 * Diseño minimalista: línea recta, color brand semitransparente, con
 * dashes largos para evocar el pespunte de un hilo de coser. Lo
 * importante es que el "hilo" conecte visualmente las cards — no
 * necesita ser vistoso, solo coherente con el tagline "El hilo que te
 * une a tu dorsal".
 *
 * Implementación:
 *  - Un `<svg>` absoluto ocupa TODO el contenedor padre.
 *  - Mide el contenedor con ResizeObserver y vuelve a pintar cuando
 *    cambia (resize, toggle "Hoy", etc.).
 *  - El wrapper va con el mismo ancho que la etiqueta de fecha
 *    (w-14 / sm:w-[72px]) para que x=ancho/2 caiga justo en el centro
 *    del dorsal.
 */
function HiloSvg() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      setSize({ w: el.offsetWidth, h: el.offsetHeight });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute top-0 left-0 w-14 sm:w-[72px]"
      style={{ height: "100%" }}
      aria-hidden="true"
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${Math.max(1, size.w)} ${Math.max(1, size.h)}`}
        preserveAspectRatio="none"
        className="absolute inset-0"
        fill="none"
      >
        {size.h > 0 && (
          <line
            x1={size.w / 2}
            y1={0}
            x2={size.w / 2}
            y2={size.h}
            stroke="rgb(220 38 38 / 0.3)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeDasharray="5 7"
          />
        )}
      </svg>
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

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
 * HiloSvg — dibuja el "hilo" como una **senda de pisadas** de corredor.
 *
 * En lugar de una línea curva, generamos pares de huellas (pie izq + pie
 * der) que bajan en zigzag suave por el eje vertical del timeline. Esto
 * refuerza la metáfora de marca "El hilo que te une a tu dorsal" — el
 * corredor VA DEJANDO SU RASTRO carrera a carrera.
 *
 * Cada pisada es una elipse (~12x18 px) con un pequeño arco a un lado
 * (talón), rotada ±10° alternadamente para que parezca un paso natural.
 * El color es `runner-primary` al 22 % de opacidad: sutil, no distrae de
 * las cards, pero inequívocamente "el rastro de tu hilo".
 *
 * Las pisadas se dibujan EN EL ESPACIO ENTRE LAS CARDS (entre dorsal y
 * dorsal), no debajo del dorsal — para que el dorsal siga siendo el
 * ancla visual y las pisadas rellenen el aire.
 *
 * Implementación:
 *  - Un `<svg>` absoluto ocupa TODO el contenedor padre.
 *  - Mide el contenedor con ResizeObserver y vuelve a pintar cuando cambia
 *    (por resize, por aparición del toggle "Hoy", por carga de imágenes, etc.).
 *  - Las pisadas se colocan en `cx = w/2` (centro de la etiqueta de fecha)
 *    con offsets pequeños ±6 px para imitar un paso natural.
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

  const footprints = buildFootprints(size.h, size.w);

  return (
    <div
      ref={containerRef}
      // Wrapper absoluto con el mismo ancho que la etiqueta de fecha
      // (w-14 / sm:w-[72px]). El SVG dentro va absolute, ocupa todo el
      // wrapper. x=0 está en el borde izquierdo del timeline, x=ancho
      // está en el centro de la etiqueta — ahí caen las pisadas.
      className="pointer-events-none absolute top-0 left-0 w-14 sm:w-[72px]"
      style={{ height: "100%" }}
      aria-hidden="true"
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${Math.max(1, size.w)} ${Math.max(1, size.h)}`}
        preserveAspectRatio="none"
        className="absolute inset-0 overflow-visible"
        // No bloquea clicks: la timeline debajo sigue siendo interactiva.
        fill="none"
      >
        {footprints.map((fp, i) => (
          <Footprint key={i} {...fp} />
        ))}
      </svg>
    </div>
  );
}

/**
 * Footprint — una pisada minimalista de corredor.
 *
 * Forma: elipse principal (la planta del pie) con un pequeño arco a un
 * lado (el talón). Cuando va rotada, el talón marca la dirección del paso.
 *
 * Tamaño: 12x18 px. Color: runner-primary al 22% para que sea sutil.
 *
 * `isLeft`: true → pie izquierdo (talón a la derecha); false → pie derecho
 * (talón a la izquierda). Eso hace que las pisadas alternadas formen una
 * pisada "andando".
 */
function Footprint({
  cx,
  cy,
  isLeft,
}: {
  cx: number;
  cy: number;
  isLeft: boolean;
}) {
  // Rotación: el pie izq apunta a la derecha (hacia el centro del timeline)
  // y el pie der a la izquierda, alternando en cada paso.
  const rotation = isLeft ? 12 : -12;
  // El talón se coloca a un lado u otro según el pie.
  const heelDx = isLeft ? 5 : -5;
  const heelDy = -7;

  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rotation})`}>
      {/* Planta del pie — elipse ligeramente alargada hacia los dedos */}
      <ellipse
        cx={0}
        cy={0}
        rx={5}
        ry={8}
        fill="rgb(220 38 38 / 0.22)"
      />
      {/* Talón — arco pequeño detrás de la planta */}
      <ellipse
        cx={heelDx}
        cy={heelDy}
        rx={2.5}
        ry={3}
        fill="rgb(220 38 38 / 0.22)"
      />
    </g>
  );
}

/**
 * Genera el array de pisadas para la timeline. Estrategia:
 *  - Empezamos en y=0 (justo debajo del primer dorsal) y bajamos hasta h.
 *  - El paso vertical entre pisadas del mismo pie es 60 px; como alternamos
 *    pies, hay 30 px entre pisadas consecutivas (un paso natural).
 *  - Las pisadas se desplazan lateralmente ±5 px alternando para formar
 *    una línea en zigzag, como si el corredor avanzara por el centro del
 *    timeline.
 *  - Saltamos los primeros ~70 px y los últimos ~50 px para no chocar
 *    con los dorsales (que ocupan la parte de arriba de cada card).
 *
 * Devuelve un array vacío si h<=0.
 */
function buildFootprints(
  h: number,
  w: number,
): { cx: number; cy: number; isLeft: boolean }[] {
  if (h <= 0 || w <= 0) return [];
  const cx = w / 2;
  const step = 32; // px verticales entre pisadas consecutivas (paso natural)
  const startY = 70; // saltamos la zona del dorsal (la etiqueta ocupa ~80px)
  const endY = h - 30; // no pisamos el final
  const out: { cx: number; cy: number; isLeft: boolean }[] = [];

  for (let y = startY; y <= endY; y += step) {
    const i = out.length;
    const isLeft = i % 2 === 0;
    // Offset lateral: ±4 px alternando. Pequeño, para no salirse del
    // wrapper de la etiqueta de fecha.
    const dx = isLeft ? -3 : 3;
    out.push({ cx: cx + dx, cy: y, isLeft });
  }
  return out;
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

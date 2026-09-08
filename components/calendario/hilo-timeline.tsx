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
 * HiloSvg — dibuja el "hilo" curvo que recorre la timeline por detrás de
 * las cards. Estilo: línea fina (1.5 px), color brand semitransparente,
 * con dashes largos para evocar hilo de coser.
 *
 * Implementación:
 *  - Un `<svg>` absoluto ocupa TODO el contenedor padre.
 *  - Mide el contenedor con ResizeObserver y vuelve a pintar cuando cambia
 *    (por resize, por aparición del toggle "Hoy", por carga de imágenes, etc.).
 *  - El path se construye con curvas Bézier cúbicas (C) que se desvían
 *    ±6 px del eje vertical — suficiente para que se vea ondulado pero sin
 *    salirse del centro de la etiqueta de fecha.
 *  - Los puntos de control se colocan en x = 0.5·ancho (centro del SVG).
 *    Como el SVG va de left-0 a right-0 pero la etiqueta de fecha está
 *    en left-0..left-14 / sm:left-[72px], necesitamos el path **relativo
 *    a la posición real del hilo**, no al centro del SVG.
 *
 *  Para eso, el SVG también va posicionado en `left-0 right-auto` con
 *  `width` igual al ancho de la etiqueta de fecha (14 / 72 px), de modo
 *  que su x=0 está en el borde izquierdo del timeline y x=ancho está
 *  en el centro de la etiqueta. Así, el path a x=ancho/2 cae justo
 *  en el centro de la etiqueta de fecha.
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

  // El path se construye solo si tenemos dimensiones reales.
  const d = buildHiloPath(size.h, size.w);

  return (
    <div
      ref={containerRef}
      // El wrapper absoluto se ancla a la izquierda con el mismo ancho que
      // la etiqueta de fecha (w-14 / sm:w-[72px]). El SVG dentro va
      // absolute, ocupa todo el wrapper.
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
        // No bloquea clicks: la timeline debajo sigue siendo interactiva.
        fill="none"
      >
        {d && (
          <path
            d={d}
            // Hilo fino, semitransparente, con dashes largos
            // (8 6) para evocar un pespunte.
            stroke="rgb(220 38 38 / 0.28)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="6 6"
          />
        )}
      </svg>
    </div>
  );
}

/**
 * Construye un path SVG que va de (cx, 0) a (cx, h) serpenteando ±6 px
 * horizontalmente cada ~40 px de alto. El resultado es una onda suave.
 *
 * Si `w` o `h` valen 0 (antes del primer paint), devuelve null para
 * evitar paths degenerados.
 */
function buildHiloPath(h: number, w: number): string | null {
  if (h <= 0 || w <= 0) return null;
  const cx = w / 2; // centro horizontal del wrapper (= centro de la etiqueta)
  const amplitude = 6; // desviación lateral en px
  const step = 40; // longitud de cada "onda" en px verticales
  const segments = Math.max(1, Math.ceil(h / step));

  let d = `M ${cx} 0`;

  for (let i = 0; i < segments; i++) {
    const y0 = i * step;
    const y1 = Math.min(h, (i + 1) * step);
    // Onda alterna: par a la derecha, impar a la izquierda.
    const sign = i % 2 === 0 ? 1 : -1;
    const xCtrl = cx + sign * amplitude;
    // Curva cúbica simétrica: el control horizontal es el mismo en ambos
    // extremos, lo que produce una onda limpia tipo "seno".
    d += ` C ${xCtrl} ${y0 + step * 0.33}, ${xCtrl} ${y1 - step * 0.33}, ${cx} ${y1}`;
  }

  return d;
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

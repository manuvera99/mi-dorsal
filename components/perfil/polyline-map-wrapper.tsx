"use client";

/**
 * PolylineMapWrapper — wrapper con dynamic import para evitar SSR.
 * Leaflet toca `window` al importarse, así que NO se puede renderizar
 * en el servidor. Mismo patrón que `RaceMapWrapper`.
 *
 * Mantener este wrapper SEPARADO del componente `PolylineMap` permite
 * importar el wrapper desde Server Components y Client Components sin
 * arrastrar Leaflet al bundle de SSR.
 */

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const PolylineMap = dynamic(
  () => import("./polyline-map").then((m) => m.PolylineMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="rounded-md border border-stone-200 bg-stone-50 animate-pulse"
        style={{ height: 160 }}
        aria-hidden="true"
      />
    ),
  },
);

export function PolylineMapWrapper(props: ComponentProps<typeof PolylineMap>) {
  return <PolylineMap {...props} />;
}

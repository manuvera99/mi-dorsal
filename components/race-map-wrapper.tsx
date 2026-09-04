"use client";

/**
 * RaceMapWrapper — wrapper con dynamic import para evitar SSR.
 * Leaflet toca `window` al importarse, así que NO se puede renderizar
 * en el servidor.
 */

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const RaceMap = dynamic(
  () => import("./race-map").then((m) => m.RaceMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center"
        style={{ height: 500 }}
      >
        <div className="text-gray-500 text-sm">Cargando mapa…</div>
      </div>
    ),
  },
);

export function RaceMapWrapper(props: ComponentProps<typeof RaceMap>) {
  return <RaceMap {...props} />;
}

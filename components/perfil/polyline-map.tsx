"use client";

/**
 * PolylineMap — mini-mapa Leaflet que renderiza un track GPS a partir de
 * una `summary_polyline` de Strava (formato Google polyline encoding).
 *
 * Decodifica la polyline con `@googlemaps/polyline-codec` (decodificación
 * local, sin llamadas a la API de Google) y la pinta como `<Polyline>`
 * sobre tiles de OpenStreetMap (gratis, sin API key).
 *
 * Uso típico: card de un PR o de una actividad en el feed.
 *
 * IMPORTANTE: Leaflet toca `window` al importarse. El padre debe importar
 * este componente con `next/dynamic({ ssr: false })`, igual que `RaceMap`.
 */

import { useMemo } from "react";
import { MapContainer, TileLayer, Polyline, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";

// Icon del marcador de inicio/fin (Leaflet por defecto falla con bundlers
// porque apunta a assets locales que no se resuelven — lo creamos a mano).
const startIcon = L.divIcon({
  className: "polyline-map-marker polyline-map-marker--start",
  html: '<span style="display:block;width:14px;height:14px;border-radius:9999px;background:#16a34a;border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.2)"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});
const endIcon = L.divIcon({
  className: "polyline-map-marker polyline-map-marker--end",
  html: '<span style="display:block;width:14px;height:14px;border-radius:9999px;background:#dc2626;border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.2)"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

interface PolylineMapProps {
  /** String en formato Google polyline encoding. Si está vacío o es null, no se renderiza. */
  polyline: string | null | undefined;
  /** Altura del contenedor en CSS (ej. "h-32" o "160px"). Default: 160px. */
  height?: number;
  /** Mostrar marcadores de inicio (verde) y fin (rojo). Default: true. */
  showEndpoints?: boolean;
  /** Texto accesible para screen readers. */
  alt?: string;
}

/**
 * Decodifica un string en formato Google polyline encoding a un array de
 * [lat, lng]. Algoritmo del spec oficial de Google:
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 *
 * Evitamos la lib externa porque son ~80 líneas y este formato está
 * perfectamente especificado. Sin dependencias añadidas.
 */
function decodePolyline(str: string): [number, number][] {
  if (!str) return [];
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const len = str.length;

  while (index < len) {
    // Lat
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    // Lng
    shift = 0;
    result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coords.push([lat / 1e5, lng / 1e5]);
  }

  return coords;
}

export function PolylineMap({
  polyline,
  height = 160,
  showEndpoints = true,
  alt = "Mapa del recorrido",
}: PolylineMapProps) {
  const coords = useMemo(() => {
    if (!polyline) return [];
    try {
      return decodePolyline(polyline);
    } catch {
      return [];
    }
  }, [polyline]);

  if (coords.length < 2) {
    // Polyline vacía o corrupta — fallback visual honesto (no fingir un mapa).
    return (
      <div
        className="rounded-md border border-dashed border-stone-300 bg-stone-50 flex items-center justify-center text-stone-400 text-xs"
        style={{ height }}
        aria-label={alt}
      >
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" />
          Sin track GPS
        </span>
      </div>
    );
  }

  // Centro: media entre el primer y último punto. Suficiente para un
  // recorrido de un PR de 5K-Maratón (no necesitamos un fitBounds perfecto).
  const center: [number, number] = [
    (coords[0][0] + coords[coords.length - 1][0]) / 2,
    (coords[0][1] + coords[coords.length - 1][1]) / 2,
  ];

  return (
    <div
      className="rounded-md overflow-hidden border border-stone-200"
      style={{ height }}
      role="img"
      aria-label={alt}
    >
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        zoomControl={false}
        attributionControl={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline
          positions={coords}
          pathOptions={{
            color: "#dc2626",
            weight: 4,
            opacity: 0.85,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
        {showEndpoints && (
          <>
            <Marker position={coords[0]} icon={startIcon} />
            <Marker position={coords[coords.length - 1]} icon={endIcon} />
          </>
        )}
      </MapContainer>
    </div>
  );
}

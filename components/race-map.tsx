"use client";

/**
 * RaceMap — mapa visual con Leaflet + OpenStreetMap.
 *
 * - Pin central del usuario (si userCoords está activo)
 * - Pines de las carreras con coordenadas
 * - Círculo del radio de filtrado alrededor del usuario
 * - Click en pin → popover con nombre, fecha, distancia y link
 * - Tiles: OpenStreetMap (gratis, sin API key)
 *
 * IMPORTANTE: este componente usa `next/dynamic` con `ssr: false` en
 * el wrapper. Leaflet toca `window` al importarse, no funciona en SSR.
 */

import { useEffect, useState, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polyline,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { Navigation, MapPin, Calendar } from "lucide-react";
import { formatDistance, type Coords } from "@/lib/geo/distance";
import { formatDate } from "@/lib/utils";

interface Race {
  _id: string;
  name: string;
  slug: string;
  locality?: string;
  province?: string;
  startDate?: string;
  distanceKm: number;
  latitude: number;
  longitude: number;
}

interface RaceMapProps {
  races: Race[];
  userCoords: Coords | null;
  maxDistanceKm: number;
}

// Fix del icono por defecto de Leaflet (no carga bien en Next.js)
const userIcon = L.divIcon({
  html: `<div style="background:#dc2626;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
    <div style="width:8px;height:8px;background:white;border-radius:50%;"></div>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  className: "user-location-marker",
});

const raceIcon = L.divIcon({
  html: `<div style="background:#16a34a;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.5);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  className: "race-marker",
});

const outOfRangeIcon = L.divIcon({
  html: `<div style="background:#9ca3af;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);opacity:0.6;"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  className: "race-marker-out",
});

function haversine(a: Coords, b: { latitude: number; longitude: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function RaceMap({ races, userCoords, maxDistanceKm }: RaceMapProps) {
  // Calcular centro del mapa
  const center = useMemo<[number, number]>(() => {
    if (userCoords) return [userCoords.latitude, userCoords.longitude];
    if (races.length === 0) return [40.4168, -3.7038]; // Madrid por defecto
    // Centro = media de las latitudes/longitudes de las carreras
    const sumLat = races.reduce((s, r) => s + r.latitude, 0);
    const sumLng = races.reduce((s, r) => s + r.longitude, 0);
    return [sumLat / races.length, sumLng / races.length];
  }, [userCoords, races]);

  // Anotar las carreras con su distancia al usuario (si hay)
  const racesWithDistance = useMemo(() => {
    if (!userCoords) return races.map((r) => ({ ...r, distance: null as number | null }));
    return races.map((r) => ({
      ...r,
      distance: haversine(userCoords, r),
    }));
  }, [races, userCoords]);

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm" style={{ height: 500 }}>
      <MapContainer
        center={center}
        zoom={userCoords ? 9 : 6}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Pin del usuario + círculo de radio */}
        {userCoords && (
          <>
            <Marker position={[userCoords.latitude, userCoords.longitude]} icon={userIcon}>
              <Popup>
                <strong>Tu ubicación</strong>
                <br />
                {userCoords.latitude.toFixed(4)}, {userCoords.longitude.toFixed(4)}
              </Popup>
            </Marker>
            {maxDistanceKm < 300 && (
              <Circle
                center={[userCoords.latitude, userCoords.longitude]}
                radius={maxDistanceKm * 1000} // metros
                pathOptions={{
                  color: "#dc2626",
                  fillColor: "#dc2626",
                  fillOpacity: 0.08,
                  weight: 1.5,
                  dashArray: "6 4",
                }}
              />
            )}
          </>
        )}

        {/* Pines de carreras */}
        {racesWithDistance.map((r) => {
          const inRange = r.distance === null || r.distance <= maxDistanceKm;
          return (
            <Marker
              key={r._id}
              position={[r.latitude, r.longitude]}
              icon={inRange ? raceIcon : outOfRangeIcon}
            >
              <Popup>
                <div className="text-sm">
                  <strong className="block mb-1 text-base">{r.name}</strong>
                  <div className="flex items-center gap-1 text-gray-600 mb-0.5">
                    <MapPin className="h-3 w-3" /> {r.locality ?? "—"}
                  </div>
                  <div className="flex items-center gap-1 text-gray-600 mb-1">
                    <Calendar className="h-3 w-3" /> {formatDate(r.startDate)}
                  </div>
                  {r.distance !== null && (
                    <div className="flex items-center gap-1 text-runner-primary font-semibold mb-2">
                      <Navigation className="h-3 w-3" /> {formatDistance(r.distance)} de ti
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mb-2">
                    <strong>{r.distanceKm} km</strong> de carrera
                  </div>
                  <Link
                    href={`/carreras/${r.slug}`}
                    className="text-runner-primary hover:underline font-semibold"
                  >
                    Ver detalles →
                  </Link>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

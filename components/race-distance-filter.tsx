"use client";

/**
 * RaceDistanceFilter — geolocalización del usuario + slider de distancia máxima.
 *
 * Comportamiento:
 *  - Botón "Usar mi ubicación" pide permiso al navegador
 *  - Slider de 0 a 300km en pasos de 10km (default 200km)
 *  - Si el usuario rechaza permiso, puede seguir usando el slider sin geolocalizar
 *  - Estado en sessionStorage (no se guarda en BBDD — la ubicación es sensible)
 *  - Botón "Limpiar" para desactivar el filtro
 *
 * Props:
 *  - onChange: callback cuando cambia (userCoords, maxDistanceKm)
 *  - initial: valores iniciales (opcional)
 */

import { useState, useEffect, useCallback } from "react";
import { MapPin, X, Loader2, Navigation, AlertCircle } from "lucide-react";
import type { Coords } from "@/lib/geo/distance";

const STORAGE_KEY_USER = "mi-dorsal.userCoords";
const STORAGE_KEY_DIST = "mi-dorsal.maxDistanceKm";

const MIN_DISTANCE = 0;
const MAX_DISTANCE = 300;
const STEP_DISTANCE = 10;
const DEFAULT_DISTANCE = 200;

interface RaceDistanceFilterProps {
  onChange: (userCoords: Coords | null, maxDistanceKm: number) => void;
  initialMaxDistance?: number;
}

export function RaceDistanceFilter({ onChange, initialMaxDistance }: RaceDistanceFilterProps) {
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [maxDistance, setMaxDistance] = useState<number>(initialMaxDistance ?? DEFAULT_DISTANCE);
  const [requesting, setRequesting] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Cargar de sessionStorage al montar
  useEffect(() => {
    try {
      const savedCoords = sessionStorage.getItem(STORAGE_KEY_USER);
      if (savedCoords) {
        const parsed = JSON.parse(savedCoords);
        if (parsed?.latitude && parsed?.longitude) {
          setUserCoords(parsed);
        }
      }
      const savedDist = sessionStorage.getItem(STORAGE_KEY_DIST);
      if (savedDist) {
        const n = parseInt(savedDist, 10);
        if (!isNaN(n) && n >= MIN_DISTANCE && n <= MAX_DISTANCE) {
          setMaxDistance(n);
        }
      }
    } catch {
      // sessionStorage no disponible (modo incógnito extremo), ignorar
    }
  }, []);

  // Persistir en sessionStorage y notificar al padre
  useEffect(() => {
    try {
      if (userCoords) {
        sessionStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userCoords));
      } else {
        sessionStorage.removeItem(STORAGE_KEY_USER);
      }
    } catch {}
    onChange(userCoords, maxDistance);
  }, [userCoords, onChange, maxDistance]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY_DIST, String(maxDistance));
    } catch {}
  }, [maxDistance]);

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeoError("Tu navegador no soporta geolocalización");
      return;
    }
    setRequesting(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setRequesting(false);
      },
      (err) => {
        setRequesting(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setGeoError("Has denegado el permiso de ubicación");
            break;
          case err.POSITION_UNAVAILABLE:
            setGeoError("No se pudo determinar tu ubicación");
            break;
          case err.TIMEOUT:
            setGeoError("La petición de ubicación ha tardado demasiado");
            break;
          default:
            setGeoError("Error desconocido al obtener la ubicación");
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const clearLocation = useCallback(() => {
    setUserCoords(null);
    setGeoError(null);
  }, []);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3 flex-wrap">
        {/* Columna 1: botón geolocalización */}
        <div className="flex-1 min-w-[200px]">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
            <Navigation className="h-3 w-3" /> Tu ubicación
          </div>
          {userCoords ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-green-50 border border-green-200 rounded-md px-3 py-2 text-sm">
                <MapPin className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span className="font-mono text-green-800">
                  {userCoords.latitude.toFixed(3)}, {userCoords.longitude.toFixed(3)}
                </span>
              </div>
              <button
                type="button"
                onClick={clearLocation}
                className="p-2 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50"
                title="Quitar ubicación"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={requestLocation}
              disabled={requesting}
              className="inline-flex items-center gap-2 bg-runner-primary text-white px-3 py-2 rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {requesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              {requesting ? "Obteniendo…" : "Usar mi ubicación"}
            </button>
          )}
          {geoError && (
            <div className="mt-1.5 flex items-start gap-1 text-xs text-amber-700">
              <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
              <span>{geoError}</span>
            </div>
          )}
          <p className="mt-1 text-[10px] text-gray-400 leading-tight">
            Tu ubicación NO se guarda en ningún servidor. Solo se usa en tu navegador para filtrar.
          </p>
        </div>

        {/* Columna 2: slider de distancia */}
        <div className="flex-1 min-w-[260px]">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <span>Distancia máxima</span>
            </div>
            <span className="text-sm font-mono font-bold text-runner-primary">
              {maxDistance >= MAX_DISTANCE ? "Sin límite" : `${maxDistance} km`}
            </span>
          </div>
          <input
            type="range"
            min={MIN_DISTANCE}
            max={MAX_DISTANCE}
            step={STEP_DISTANCE}
            value={maxDistance}
            onChange={(e) => setMaxDistance(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-runner-primary"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
            <span>0 km</span>
            <span>150 km</span>
            <span>300+ km</span>
          </div>
        </div>
      </div>
    </div>
  );
}

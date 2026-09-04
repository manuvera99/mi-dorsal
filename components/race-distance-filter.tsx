"use client";

/**
 * RaceDistanceFilter — geolocalización del usuario + slider de distancia máxima.
 *
 * Comportamiento:
 *  - Botón "Activar ubicación" muestra un dialog explicativo
 *  - Solo tras confirmar, pide permiso al navegador
 *  - Usa navigator.permissions.query para detectar el estado
 *  - Si está denegado, muestra instrucciones para activarlo
 *  - Estado en sessionStorage (no se guarda en BBDD — privacidad)
 *  - Slider funciona independiente de la geolocalización
 *
 * Props:
 *  - onChange: callback cuando cambia (userCoords, maxDistanceKm)
 *  - initialMaxDistance: valor inicial del slider
 */

import { useState, useEffect, useCallback } from "react";
import { MapPin, X, Loader2, Navigation, AlertCircle, Info, ShieldCheck, ExternalLink, CheckCircle2 } from "lucide-react";
import type { Coords } from "@/lib/geo/distance";

const STORAGE_KEY_USER = "mi-dorsal.userCoords";
const STORAGE_KEY_DIST = "mi-dorsal.maxDistanceKm";

const MIN_DISTANCE = 0;
const MAX_DISTANCE = 300;
const STEP_DISTANCE = 10;
const DEFAULT_DISTANCE = 200;

type PermissionState = "unknown" | "granted" | "denied" | "prompt" | "unsupported" | "error";

interface RaceDistanceFilterProps {
  onChange: (userCoords: Coords | null, maxDistanceKm: number) => void;
  initialMaxDistance?: number;
}

export function RaceDistanceFilter({ onChange, initialMaxDistance }: RaceDistanceFilterProps) {
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [maxDistance, setMaxDistance] = useState<number>(initialMaxDistance ?? DEFAULT_DISTANCE);
  const [requesting, setRequesting] = useState(false);
  const [permission, setPermission] = useState<PermissionState>("unknown");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [showHelpDialog, setShowHelpDialog] = useState(false);

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
    } catch {}
  }, []);

  // Detectar estado del permiso (si la API Permissions está disponible)
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) {
      setPermission("unsupported");
      return;
    }
    let cancelled = false;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((result) => {
        if (cancelled) return;
        setPermission(result.state as PermissionState);
        // Escuchar cambios
        result.addEventListener("change", () => {
          if (!cancelled) setPermission(result.state as PermissionState);
        });
      })
      .catch(() => {
        if (!cancelled) setPermission("unsupported");
      });
    return () => {
      cancelled = true;
    };
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
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setErrorDetail("Tu navegador no soporta geolocalización (geolocation API no disponible).");
      setPermission("unsupported");
      return;
    }
    setRequesting(true);
    setErrorDetail(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setRequesting(false);
        setPermission("granted");
        setErrorDetail(null);
      },
      (err) => {
        setRequesting(false);
        // Diagnóstico detallado
        let detail = "";
        switch (err.code) {
          case err.PERMISSION_DENIED:
            detail = "El navegador ha bloqueado el permiso. Revisa el candado 🔒 en la barra de direcciones y permite la ubicación para este sitio.";
            setPermission("denied");
            break;
          case err.POSITION_UNAVAILABLE:
            detail = "No se pudo determinar tu ubicación. Activa el GPS o la Wi-Fi.";
            break;
          case err.TIMEOUT:
            detail = "La petición ha tardado demasiado (>10s). Reintenta con mejor señal.";
            break;
          default:
            detail = `Error desconocido (código ${err.code}): ${err.message || "sin detalles"}`;
        }
        setErrorDetail(detail);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const clearLocation = useCallback(() => {
    setUserCoords(null);
    setErrorDetail(null);
    setPermission("prompt");
  }, []);

  // Estado derivado
  const isBlocked = permission === "denied";
  const isGranted = userCoords !== null;
  const showExplainDialog = showHelpDialog && !isGranted;

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3 flex-wrap">
          {/* Columna 1: botón geolocalización */}
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Navigation className="h-3 w-3" /> Tu ubicación
            </div>
            {isGranted ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 bg-green-50 border border-green-200 rounded-md px-3 py-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-green-800">
                      {userCoords!.latitude.toFixed(4)}, {userCoords!.longitude.toFixed(4)}
                    </div>
                    <div className="text-[10px] text-green-600">Ubicación activa · {permission === "granted" ? "permiso concedido" : ""}</div>
                  </div>
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
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (isBlocked) {
                      // Si ya está denegado, mostrar dialog de ayuda
                      setShowHelpDialog(true);
                      return;
                    }
                    // Si está en prompt o unknown, abrir dialog explicativo
                    setShowHelpDialog(true);
                  }}
                  disabled={requesting}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold disabled:opacity-50 ${
                    isBlocked
                      ? "bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200"
                      : "bg-runner-primary text-white hover:opacity-90"
                  }`}
                >
                  {requesting ? <Loader2 className="h-4 w-4 animate-spin" /> :
                   isBlocked ? <ShieldCheck className="h-4 w-4" /> :
                   <MapPin className="h-4 w-4" />}
                  {requesting ? "Obteniendo…" :
                   isBlocked ? "Ubicación bloqueada — ver cómo activarla" :
                   "Activar ubicación"}
                </button>
                {isBlocked && (
                  <p className="mt-1.5 text-[11px] text-amber-700 leading-tight">
                    Has denegado el permiso antes. Para activarlo, pulsa el botón de arriba.
                  </p>
                )}
              </>
            )}
            {errorDetail && !isGranted && (
              <div className="mt-1.5 flex items-start gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                <span>{errorDetail}</span>
              </div>
            )}
            <p className="mt-1.5 text-[10px] text-gray-400 leading-tight">
              🔒 Tu ubicación NO se guarda en ningún servidor. Solo se usa en tu navegador para filtrar.
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

      {/* Modal explicativo / ayuda */}
      {showExplainDialog && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setShowHelpDialog(false)}
        >
          <div
            className="bg-white rounded-lg max-w-md w-full p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-3">
              {isBlocked ? (
                <ShieldCheck className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
              ) : (
                <Info className="h-6 w-6 text-runner-primary flex-shrink-0 mt-0.5" />
              )}
              <div>
                <h3 className="font-bold text-lg">
                  {isBlocked ? "Ubicación bloqueada" : "¿Por qué pedimos tu ubicación?"}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {isBlocked
                    ? "Has denegado el permiso antes. El navegador ya no pregunta de nuevo. Sigue estos pasos según tu navegador:"
                    : "Para mostrarte carreras cercanas a ti. Tu ubicación nunca se guarda en ningún servidor, solo se usa en tu navegador para filtrar la lista."}
                </p>
              </div>
            </div>

            {isBlocked ? (
              <div className="space-y-2 text-sm text-gray-700 bg-amber-50 border border-amber-200 rounded-md p-3">
                <p><strong>Chrome / Edge:</strong></p>
                <ol className="list-decimal list-inside space-y-0.5 text-xs">
                  <li>Click en el candado 🔒 o icono ⓘ a la izquierda de la URL</li>
                  <li>Busca "Ubicación" en el menú</li>
                  <li>Selecciona "Permitir"</li>
                  <li>Recarga la página (F5)</li>
                </ol>
                <p className="mt-2"><strong>Firefox:</strong></p>
                <ol className="list-decimal list-inside space-y-0.5 text-xs">
                  <li>Click en el candado 🔒 a la izquierda de la URL</li>
                  <li>Click en "Permisos"</li>
                  <li>Busca "Acceder a tu ubicación" y desmarca "Bloquear"</li>
                  <li>Recarga la página</li>
                </ol>
                <p className="mt-2"><strong>Safari:</strong></p>
                <ol className="list-decimal list-inside space-y-0.5 text-xs">
                  <li>Menú Safari → Configuración de este sitio web</li>
                  <li>Ubicación → Permitir</li>
                </ol>
              </div>
            ) : (
              <ul className="space-y-1.5 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-runner-primary">📍</span>
                  <span>Te mostraremos carreras dentro del radio que elijas</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-runner-primary">🧭</span>
                  <span>Verás la distancia a cada carrera en km</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-runner-primary">🔒</span>
                  <span>Tu ubicación NO se guarda en el servidor, solo en tu navegador</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-runner-primary">🗺️</span>
                  <span>En el mapa verás tu posición y el radio de filtrado</span>
                </li>
              </ul>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowHelpDialog(false)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
              >
                {isBlocked ? "Cerrar" : "Ahora no"}
              </button>
              {!isBlocked && (
                <button
                  type="button"
                  onClick={() => {
                    setShowHelpDialog(false);
                    requestLocation();
                  }}
                  className="px-3 py-1.5 text-sm bg-runner-primary text-white rounded font-semibold hover:opacity-90 flex items-center gap-1.5"
                >
                  <MapPin className="h-3.5 w-3.5" /> Permitir ubicación
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

/**
 * RaceDistanceFilter — geolocalización del usuario + slider de distancia máxima.
 *
 * 3 métodos para obtener coordenadas:
 *  - GPS del navegador (preferred, requiere permiso)
 *  - IP pública (fallback, no requiere permiso, ~50km precisión)
 *  - Coordenadas manuales (último recurso)
 *
 * Estado en sessionStorage (no se guarda en BBDD — privacidad).
 *
 * NOTA: NO usamos navigator.permissions.query porque algunos navegadores
 * reportan "denied" falsamente. Vamos directo a getCurrentPosition.
 */

import { useState, useEffect, useCallback } from "react";
import {
  MapPin, X, Loader2, Navigation, AlertCircle, Info, ShieldCheck,
  CheckCircle2, Globe, Edit3, Save, Trash2, AlertTriangle,
} from "lucide-react";
import type { Coords } from "@/lib/geo/distance";

const STORAGE_KEY_USER = "mi-dorsal.userCoords";
const STORAGE_KEY_DIST = "mi-dorsal.maxDistanceKm";
const STORAGE_KEY_ERROR = "mi-dorsal.geoError";

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
  const [requestingIp, setRequestingIp] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [coordsSource, setCoordsSource] = useState<"browser" | "ip" | "preset" | "manual" | null>(null);
  const [coordsSourceLabel, setCoordsSourceLabel] = useState<string | null>(null);
  const [isInIframe, setIsInIframe] = useState(false);
  const [attemptedButFailed, setAttemptedButFailed] = useState(false);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);

  // Detectar si estamos en iframe (problema común: el navegador no muestra
  // el prompt de geolocalización dentro de iframes sin allow="geolocation")
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsInIframe(window.self !== window.top);
  }, []);

  // Cargar de sessionStorage al montar
  useEffect(() => {
    try {
      const savedCoords = sessionStorage.getItem(STORAGE_KEY_USER);
      if (savedCoords) {
        const parsed = JSON.parse(savedCoords);
        if (parsed?.latitude && parsed?.longitude) {
          setUserCoords(parsed);
          setCoordsSource("ip");
          setCoordsSourceLabel("Tu IP (cargado de sesión)");
        }
      }
      const savedDist = sessionStorage.getItem(STORAGE_KEY_DIST);
      if (savedDist) {
        const n = parseInt(savedDist, 10);
        if (!isNaN(n) && n >= MIN_DISTANCE && n <= MAX_DISTANCE) {
          setMaxDistance(n);
        }
      }
      sessionStorage.removeItem(STORAGE_KEY_ERROR);
    } catch {}
  }, []);

  // Auto-detectar ubicación por IP al cargar la primera vez
  // (si no hay coords en sessionStorage). Funciona siempre, sin permisos.
  useEffect(() => {
    if (userCoords) return; // ya hay coords
    // Detectar si ya está en proceso
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/geo/ip", { method: "GET" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (typeof data.latitude === "number" && typeof data.longitude === "number") {
          // Guardar info del país detectado
          setDetectedCountry(data.country ?? null);
          setDetectedCity(data.city ?? null);
          // Solo autoload si NO hay coords en sessionStorage
          try {
            if (!sessionStorage.getItem(STORAGE_KEY_USER)) {
              setUserCoords({ latitude: data.latitude, longitude: data.longitude });
              setCoordsSource("ip");
              const label = [data.city, data.region, data.country].filter(Boolean).join(", ");
              setCoordsSourceLabel(label || "Tu IP pública");
            }
          } catch {}
        }
      } catch {
        // Silenciar errores de IP — no pasa nada, el usuario puede usar GPS o manual
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // solo al montar

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
      setErrorDetail("Tu navegador no soporta la API de geolocalización. Usa IP o coordenadas manuales.");
      return;
    }
    setRequesting(true);
    setErrorDetail(null);
    setAttemptedButFailed(false);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setRequesting(false);
        setErrorDetail(null);
        setCoordsSource("browser");
        setCoordsSourceLabel("GPS del navegador");
        setAttemptedButFailed(false);
      },
      (err) => {
        setRequesting(false);
        setAttemptedButFailed(true);
        // Diagnóstico detallado
        let detail = "";
        switch (err.code) {
          case err.PERMISSION_DENIED:
            detail = "El navegador dice que el permiso está denegado. Si lo tienes permitido en la web, prueba a recargar (Ctrl+Shift+R). Si sigue fallando, es probable que una extensión (uBlock, Privacy Badger) esté bloqueando la API.";
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
        try {
          sessionStorage.setItem(STORAGE_KEY_ERROR, detail);
        } catch {}
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }, // maximumAge: 0 = NO cache, queremos posición fresca
    );
  }, []);

  // Fallback: geolocalización por IP pública (city-level, ~50km precisión)
  const requestIpLocation = useCallback(async () => {
    setRequestingIp(true);
    setErrorDetail(null);
    try {
      const res = await fetch("/api/geo/ip", { method: "GET" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (typeof data.latitude !== "number" || typeof data.longitude !== "number") {
        throw new Error("Respuesta inválida");
      }
      setUserCoords({ latitude: data.latitude, longitude: data.longitude });
      setCoordsSource("ip");
      const label = [data.city, data.region, data.country].filter(Boolean).join(", ");
      setCoordsSourceLabel(label || "Tu IP pública");
      setAttemptedButFailed(false);
    } catch (e: any) {
      setErrorDetail(`No se pudo obtener ubicación por IP: ${e?.message ?? e}`);
    } finally {
      setRequestingIp(false);
    }
  }, []);

  // Input manual de coordenadas
  const applyManualCoords = useCallback(() => {
    const lat = parseFloat(manualLat.replace(",", "."));
    const lng = parseFloat(manualLng.replace(",", "."));
    if (!isFinite(lat) || lat < -90 || lat > 90) {
      setErrorDetail("Latitud inválida (rango -90 a 90)");
      return;
    }
    if (!isFinite(lng) || lng < -180 || lng > 180) {
      setErrorDetail("Longitud inválida (rango -180 a 180)");
      return;
    }
    setUserCoords({ latitude: lat, longitude: lng });
    setCoordsSource("manual");
    setCoordsSourceLabel("Coordenadas manuales");
    setShowManualDialog(false);
    setErrorDetail(null);
    setAttemptedButFailed(false);
  }, [manualLat, manualLng]);

  // Lista de ciudades españolas con sus coordenadas (preset)
  const SPANISH_CITIES: Array<{ name: string; lat: number; lng: number }> = [
    { name: "Elche", lat: 38.2622, lng: -0.6982 },
    { name: "Alicante", lat: 38.3452, lng: -0.4811 },
    { name: "Valencia", lat: 39.4699, lng: -0.3763 },
    { name: "Elx (Elche)", lat: 38.2622, lng: -0.6982 },
    { name: "Murcia", lat: 37.9922, lng: -1.1307 },
    { name: "Cartagena", lat: 37.6257, lng: -0.9963 },
    { name: "Albacete", lat: 38.9943, lng: -1.8585 },
    { name: "Madrid", lat: 40.4168, lng: -3.7038 },
    { name: "Barcelona", lat: 41.3851, lng: 2.1734 },
    { name: "Sevilla", lat: 37.3886, lng: -5.9823 },
    { name: "Bilbao", lat: 43.2630, lng: -2.9350 },
    { name: "Málaga", lat: 36.7213, lng: -4.4214 },
    { name: "Zaragoza", lat: 41.6488, lng: -0.8891 },
    { name: "Granada", lat: 37.1773, lng: -3.5986 },
  ];

  const applyCity = useCallback((name: string, lat: number, lng: number) => {
    setUserCoords({ latitude: lat, longitude: lng });
    setCoordsSource("preset");
    setCoordsSourceLabel(name);
    setErrorDetail(null);
  }, []);

  const clearLocation = useCallback(() => {
    setUserCoords(null);
    setErrorDetail(null);
    setCoordsSource(null);
    setCoordsSourceLabel(null);
    setAttemptedButFailed(false);
    setDetectedCountry(null);
    setDetectedCity(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY_USER);
      sessionStorage.removeItem(STORAGE_KEY_ERROR);
    } catch {}
  }, []);

  const clearAllCaches = useCallback(() => {
    try {
      sessionStorage.clear();
      localStorage.clear();
    } catch {}
    setUserCoords(null);
    setErrorDetail(null);
    setCoordsSource(null);
    setCoordsSourceLabel(null);
    setMaxDistance(DEFAULT_DISTANCE);
    setAttemptedButFailed(false);
    // Forzar recarga
    setTimeout(() => window.location.reload(), 100);
  }, []);

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
            {isInIframe && (
              <div className="mb-2 flex items-start gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                <span>Estás dentro de un iframe — el navegador no puede mostrar el prompt de permiso. Usa IP o coordenadas manuales.</span>
              </div>
            )}
            {isGranted ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 bg-green-50 border border-green-200 rounded-md px-3 py-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-green-800">
                      {userCoords!.latitude.toFixed(4)}, {userCoords!.longitude.toFixed(4)}
                    </div>
                    <div className="text-[10px] text-green-600">
                      {coordsSource === "browser" && "📍 GPS del navegador"}
                      {coordsSource === "ip" && `🌐 IP (ciudad): ${coordsSourceLabel ?? "detectada automáticamente"}`}
                      {coordsSource === "manual" && "✏️ Coordenadas manuales"}
                    </div>
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
              <div className="space-y-2">
                {/* Botón principal: GPS del navegador */}
                <button
                  type="button"
                  onClick={requestLocation}
                  disabled={requesting || requestingIp}
                  className="inline-flex items-center gap-2 bg-runner-primary text-white px-3 py-2 rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {requesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                  {requesting ? "Esperando permiso del navegador…" : "Activar GPS"}
                </button>
                {/* Alternativas: IP o manual */}
                <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                  <span>o</span>
                  <button
                    type="button"
                    onClick={requestIpLocation}
                    disabled={requesting || requestingIp}
                    className="inline-flex items-center gap-1 text-runner-primary hover:underline disabled:opacity-50"
                  >
                    {requestingIp ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
                    Usar mi IP
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => setShowManualDialog(true)}
                    className="inline-flex items-center gap-1 text-runner-primary hover:underline"
                  >
                    <Edit3 className="h-3 w-3" />
                    Coordenadas manuales
                  </button>
                </div>
              </div>
            )}
            {errorDetail && !isGranted && (
              <div className="mt-2 flex flex-col gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                <div className="flex items-start gap-1">
                  <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                  <span>{errorDetail}</span>
                </div>
                {attemptedButFailed && !isInIframe && (
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setShowHelpDialog(true)}
                      className="text-xs underline text-amber-800 hover:text-amber-900"
                    >
                      Ver cómo activarlo
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={clearAllCaches}
                      className="text-xs underline text-amber-800 hover:text-amber-900 flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" /> Limpiar caché y reintentar
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Si la IP detectada NO es España, mostramos selector de ciudades */}
            {isGranted && coordsSource === "ip" && detectedCountry && detectedCountry !== "Spain" && detectedCountry !== "España" && (
              <div className="mt-2 text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded p-2">
                <div className="flex items-start gap-1 mb-1.5">
                  <Globe className="h-3 w-3 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span>
                    Detectamos que tu IP está en <strong>{detectedCity ?? "?"}, {detectedCountry}</strong>. Si prefieres filtrar desde otra ciudad, elige una:
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {SPANISH_CITIES.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => applyCity(c.name, c.lat, c.lng)}
                      className="px-2 py-0.5 bg-white border border-blue-200 rounded text-xs text-blue-700 hover:bg-blue-100"
                    >
                      {c.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowManualDialog(true)}
                    className="px-2 py-0.5 bg-white border border-blue-200 rounded text-xs text-blue-700 hover:bg-blue-100"
                  >
                    ✏️ Otra...
                  </button>
                </div>
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

      {/* Modal input manual */}
      {showManualDialog && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setShowManualDialog(false)}
        >
          <div
            className="bg-white rounded-lg max-w-md w-full p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-3">
              <Edit3 className="h-6 w-6 text-runner-primary flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-lg">Coordenadas manuales</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Introduce las coordenadas de tu ciudad o pueblo. Puedes sacarlas de Google Maps haciendo click derecho en tu ubicación.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Latitud</label>
                <input
                  type="text"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  placeholder="38.3452"
                  className="input font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">Rango: -90 (sur) a 90 (norte). España: ~36 a ~44</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Longitud</label>
                <input
                  type="text"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                  placeholder="-0.4811"
                  className="input font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">Rango: -180 (oeste) a 180 (este). España: ~-9 a ~3</p>
              </div>
              <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded p-2">
                <strong>💡 Ejemplos:</strong> Alicante 38.3452, -0.4811 · Valencia 39.4699, -0.3763 ·
                Madrid 40.4168, -3.7038 · Murcia 37.9922, -1.1307 · Elche 38.2622, -0.6982
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowManualDialog(false)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={applyManualCoords}
                className="px-3 py-1.5 text-sm bg-runner-primary text-white rounded font-semibold hover:opacity-90 flex items-center gap-1.5"
              >
                <Save className="h-3.5 w-3.5" /> Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

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
              <ShieldCheck className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-lg">Activar ubicación</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Para filtrar las carreras por distancia desde ti. Tu ubicación nunca se guarda en ningún servidor.
                </p>
              </div>
            </div>

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

            <p className="mt-3 text-xs text-gray-600">
              💡 <strong>¿Sigue fallando?</strong> Prueba con "Usar mi IP" (no necesita permiso, precisión ~50km)
              o introduce tus coordenadas a mano.
            </p>

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowHelpDialog(false)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowHelpDialog(false);
                  requestLocation();
                }}
                className="px-3 py-1.5 text-sm bg-runner-primary text-white rounded font-semibold hover:opacity-90 flex items-center gap-1.5"
              >
                <MapPin className="h-3.5 w-3.5" /> Reintentar GPS
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

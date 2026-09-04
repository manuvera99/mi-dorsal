"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, AlertCircle, MapPin, ExternalLink } from "lucide-react";

type CheckStatus = "pending" | "ok" | "warn" | "fail";

interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
  hint?: string;
}

export default function TestGeoPage() {
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);

  const update = (name: string, status: CheckStatus, detail: string, hint?: string) => {
    setChecks((prev) => {
      const idx = prev.findIndex((c) => c.name === name);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { name, status, detail, hint };
        return next;
      }
      return [...prev, { name, status, detail, hint }];
    });
  };

  useEffect(() => {
    void runDiagnostics();
  }, []);

  async function runDiagnostics() {
    setRunning(true);
    setChecks([]);
    setCoords(null);
    setRawError(null);

    // 1) ¿Existe navigator?
    update("navigator", typeof navigator === "undefined" ? "fail" : "ok", typeof navigator === "undefined" ? "No existe navigator" : "Existe navigator");

    // 2) ¿Es secure context?
    if (typeof window !== "undefined") {
      const isSecure = window.isSecureContext;
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      update(
        "secure",
        isSecure ? "ok" : "fail",
        `isSecureContext=${isSecure}, protocol=${protocol}, host=${hostname}`,
        isSecure ? undefined : "La geolocalización SOLO funciona en HTTPS o localhost. Vercel ya sirve HTTPS, así que debería estar OK.",
      );
    }

    // 3) ¿Está en iframe?
    if (typeof window !== "undefined") {
      const inIframe = window.self !== window.top;
      update(
        "iframe",
        inIframe ? "fail" : "ok",
        inIframe ? "Sí, la página está dentro de un iframe" : "No, es top-level",
        inIframe
          ? "Los iframes no pueden mostrar el prompt de geolocalización sin allow='geolocation' en el iframe."
          : undefined,
      );
    }

    // 4) ¿La API existe?
    update(
      "api-exists",
      typeof navigator !== "undefined" && "geolocation" in navigator ? "ok" : "fail",
      typeof navigator !== "undefined" && "geolocation" in navigator
        ? "navigator.geolocation existe"
        : "navigator.geolocation NO existe",
    );

    // 5) Permission state via Permissions API
    if (typeof navigator !== "undefined" && "permissions" in navigator) {
      try {
        const perm = await navigator.permissions.query({ name: "geolocation" });
        update(
          "permission-state",
          perm.state === "granted" ? "ok" : perm.state === "denied" ? "fail" : "warn",
          `Permissions API: state = "${perm.state}"`,
          perm.state === "denied"
            ? "El permiso está denegado al nivel de navegador. Hay que ir a Configuración del sitio (candado 🔒) y poner Ubicación en 'Permitir', o usar la opción 'Restablecer permisos' del navegador."
            : perm.state === "prompt"
            ? "El permiso aún no se ha decidido. Si no ves el popup al pulsar el botón, una extensión (uBlock, Privacy Badger, Brave Shields) lo está bloqueando."
            : undefined,
        );
      } catch (e) {
        update("permission-state", "warn", `Permissions API no soporta geolocation: ${(e as Error).message}`);
      }
    } else {
      update("permission-state", "warn", "Permissions API no disponible en este navegador");
    }

    // 6) User agent
    const ua = navigator.userAgent;
    let browserHint = "";
    if (/Chrome\/(\d+)/.test(ua)) {
      const v = ua.match(/Chrome\/(\d+)/)?.[1];
      browserHint = `Chrome ${v}`;
    } else if (/Edg\/(\d+)/.test(ua)) {
      const v = ua.match(/Edg\/(\d+)/)?.[1];
      browserHint = `Edge ${v}`;
    } else if (/Firefox\/(\d+)/.test(ua)) {
      const v = ua.match(/Firefox\/(\d+)/)?.[1];
      browserHint = `Firefox ${v}`;
    } else if (/Safari\/(\d+)/.test(ua) && !/Chrome/.test(ua)) {
      browserHint = "Safari";
    } else if (/OPR\/(\d+)/.test(ua) || /Opera/.test(ua)) {
      browserHint = "Opera";
    } else if (/Brave/.test(ua) || /brave/.test(ua)) {
      browserHint = "Brave (Shields activado probablemente)";
    } else {
      browserHint = "Desconocido";
    }
    update("browser", "ok", browserHint, browserHint.includes("Brave") ? "Brave con Shields ACTIVOS bloquea geolocalización por defecto. Desactívalo para este sitio (icono del león en la barra)." : undefined);

    // 7) Permissions Policy
    if (typeof document !== "undefined") {
      const ppMeta = document.querySelector('meta[http-equiv="Permissions-Policy"]');
      const ppHeader = (document as unknown as { permissionsPolicy?: string }).permissionsPolicy;
      update(
        "policy",
        "ok",
        `Meta: ${ppMeta?.getAttribute("content") ?? "(none)"} | Doc: ${ppHeader ?? "(default)"}`,
      );
    }

    // 8) TEST REAL: getCurrentPosition
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 0,
        });
      });
      setCoords({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      update("real-test", "ok", `Coordenadas recibidas: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)} (precisión ±${Math.round(position.coords.accuracy)}m)`);
    }

    setRunning(false);
  }

  async function runRealTest() {
    setRunning(true);
    setRawError(null);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 0,
        });
      });
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      update("real-test", "ok", `✅ Coordenadas recibidas: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
    } catch (err) {
      const e = err as GeolocationPositionError;
      const detail = `code=${e.code} | message="${e.message}" | PERMISSION_DENIED=${e.PERMISSION_DENIED} | POSITION_UNAVAILABLE=${e.POSITION_UNAVAILABLE} | TIMEOUT=${e.TIMEOUT}`;
      setRawError(detail);
      update("real-test", "fail", `❌ ${detail}`);

      // Diagnóstico adicional
      if (e.message?.includes("secure origins")) {
        update("secure-hint", "fail", "El navegador dice 'Only secure origins are allowed'. La página debe estar en HTTPS.");
      }
      if (e.message?.includes("User denied") || e.message?.includes("denied")) {
        update("denied-hint", "fail", "El usuario (o una extensión) ha denegado el permiso. Comprueba:");
      }
    }
    setRunning(false);
  }

  const iconFor = (s: CheckStatus) =>
    s === "ok" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
    s === "fail" ? <XCircle className="h-4 w-4 text-red-600" /> :
    s === "warn" ? <AlertCircle className="h-4 w-4 text-amber-600" /> :
    <div className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-runner-primary flex items-center gap-2">
            <MapPin className="h-6 w-6" /> Diagnóstico de geolocalización
          </h1>
          <p className="text-sm text-gray-600 mt-2">
            Esta página ejecuta una batería de pruebas sobre la API de geolocalización
            y reporta exactamente qué falla y por qué. Útil cuando el botón "Activar GPS"
            del filtro de carreras no funciona.
          </p>

          {coords && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
              <div className="font-bold text-green-900">✅ GPS funcionando</div>
              <div className="font-mono text-sm text-green-800">
                {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
              </div>
            </div>
          )}

          {rawError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
              <div className="font-bold text-red-900">❌ Error real de getCurrentPosition:</div>
              <pre className="text-xs text-red-800 mt-1 whitespace-pre-wrap break-all">{rawError}</pre>
            </div>
          )}

          <div className="mt-6 space-y-2">
            {checks.map((c) => (
              <div key={c.name} className="flex items-start gap-3 p-3 border border-gray-200 rounded bg-gray-50">
                <div className="flex-shrink-0 mt-0.5">{iconFor(c.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{c.name}</div>
                  <div className="text-xs text-gray-700 break-all">{c.detail}</div>
                  {c.hint && (
                    <div className="text-xs text-amber-700 mt-1 break-words">
                      💡 {c.hint}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={runRealTest}
              disabled={running}
              className="inline-flex items-center gap-2 bg-runner-primary text-white px-4 py-2 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              <MapPin className="h-4 w-4" />
              Probar getCurrentPosition
            </button>
            <button
              onClick={runDiagnostics}
              disabled={running}
              className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              🔄 Re-ejecutar diagnóstico
            </button>
            <a
              href="https://www.google.com/maps"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-50"
            >
              <ExternalLink className="h-4 w-4" /> Probar Google Maps (control)
            </a>
          </div>

          <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded text-sm">
            <div className="font-bold text-amber-900 mb-2">🩺 Si ningún prompt aparece al pulsar "Probar getCurrentPosition":</div>
            <ol className="list-decimal list-inside space-y-1 text-amber-900">
              <li><strong>Comprueba el candado 🔒</strong> a la izquierda de la URL → Permisos del sitio → Ubicación → Permitir. Recarga con Ctrl+Shift+R después.</li>
              <li><strong>Desactiva extensiones del navegador</strong> (uBlock Origin, Privacy Badger, AdBlock, Brave Shields) para este sitio. Recarga y prueba.</li>
              <li><strong>Prueba en ventana incógnito</strong> (Ctrl+Shift+N) sin extensiones. Si ahí funciona, son las extensiones.</li>
              <li><strong>Comprueba la configuración del sistema</strong>:
                <ul className="list-disc list-inside ml-6 mt-1">
                  <li>Windows: Inicio → Configuración → Privacidad → Ubicación → "Permitir que las aplicaciones accedan a la ubicación" debe estar ON</li>
                  <li>macOS: Preferencias del sistema → Seguridad y privacidad → Ubicación → activa para tu navegador</li>
                </ul>
              </li>
              <li><strong>Prueba con otro navegador</strong> (Chrome, Edge, Firefox) para descartar problema del navegador actual.</li>
              <li><strong>Si todo falla</strong>, usa el selector de ciudades o las coordenadas manuales del filtro de carreras — funcionan siempre.</li>
            </ol>
          </div>

          <div className="mt-4 text-xs text-gray-500">
            🔒 Esta página no envía tu ubicación a ningún servidor. Solo se ejecuta en tu navegador.
          </div>
        </div>
      </div>
    </div>
  );
}

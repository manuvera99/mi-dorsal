"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2, XCircle, AlertCircle, MapPin, ExternalLink,
  Settings, RotateCcw, Shield, Globe, Chrome, Smartphone,
} from "lucide-react";

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
  const [permState, setPermState] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);
  const [browserName, setBrowserName] = useState("");

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
        isSecure ? undefined : "La geolocalización SOLO funciona en HTTPS o localhost.",
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
    let detectedState: string | null = null;
    if (typeof navigator !== "undefined" && "permissions" in navigator) {
      try {
        const perm = await navigator.permissions.query({ name: "geolocation" });
        detectedState = perm.state;
        setPermState(perm.state);
        update(
          "permission-state",
          perm.state === "granted" ? "ok" : perm.state === "denied" ? "fail" : "warn",
          `Permissions API: state = "${perm.state}"`,
          perm.state === "denied"
            ? "🚫 EL PERMISO ESTÁ DENEGADO. El navegador NO mostrará el popup hasta que lo 'restablezcas' abajo. Es estado 'sticky'."
            : perm.state === "prompt"
            ? "El permiso aún no se ha decidido. Si pulsas 'Probar' y no aparece el popup, una extensión lo está bloqueando."
            : undefined,
        );
      } catch (e) {
        update("permission-state", "warn", `Permissions API no soporta geolocation: ${(e as Error).message}`);
      }
    } else {
      update("permission-state", "warn", "Permissions API no disponible");
    }

    // 6) User agent
    const ua = navigator.userAgent;
    let browser = "Desconocido";
    if (/Edg\/(\d+)/.test(ua)) {
      browser = `Edge ${ua.match(/Edg\/(\d+)/)?.[1]}`;
    } else if (/Chrome\/(\d+)/.test(ua)) {
      browser = `Chrome ${ua.match(/Chrome\/(\d+)/)?.[1]}`;
    } else if (/Firefox\/(\d+)/.test(ua)) {
      browser = `Firefox ${ua.match(/Firefox\/(\d+)/)?.[1]}`;
    } else if (/OPR\/(\d+)/.test(ua) || /Opera/.test(ua)) {
      browser = "Opera";
    } else if (/Brave/.test(ua)) {
      browser = "Brave (Shields ON probablemente)";
    } else if (/Safari\/(\d+)/.test(ua) && !/Chrome/.test(ua)) {
      browser = "Safari";
    }
    setBrowserName(browser);
    update("browser", "ok", browser, browser.includes("Brave") ? "Brave con Shields ACTIVOS bloquea geolocalización por defecto." : undefined);

    // 7) revoke() disponible
    if (typeof navigator !== "undefined" && "permissions" in navigator) {
      const hasRevoke = typeof (navigator.permissions as { revoke?: unknown }).revoke === "function";
      update(
        "revoke-api",
        hasRevoke ? "ok" : "warn",
        hasRevoke
          ? "navigator.permissions.revoke() disponible (Chrome 116+). Útil para limpiar el estado 'denied' sin ir a settings."
          : "navigator.permissions.revoke() NO disponible. Usa el botón 'Restablecer permisos' manual.",
        hasRevoke
          ? undefined
          : "Si la API revoke no existe en tu navegador, usa el paso 2: chrome://settings/content/siteDetails?site=...",
      );
    }

    // 8) Permissions Policy
    if (typeof document !== "undefined") {
      const ppMeta = document.querySelector('meta[http-equiv="Permissions-Policy"]');
      const ppHeader = (document as unknown as { permissionsPolicy?: string }).permissionsPolicy;
      update(
        "policy",
        "ok",
        `Meta: ${ppMeta?.getAttribute("content") ?? "(none)"} | Doc: ${ppHeader ?? "(default)"}`,
      );
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
      update("real-test", "ok", `✅ Coordenadas recibidas: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)} (precisión ±${Math.round(position.coords.accuracy)}m)`);
    } catch (err) {
      const e = err as GeolocationPositionError;
      const detail = `code=${e.code} | message="${e.message}" | PERMISSION_DENIED=${e.PERMISSION_DENIED} | POSITION_UNAVAILABLE=${e.POSITION_UNAVAILABLE} | TIMEOUT=${e.TIMEOUT}`;
      setRawError(detail);
      update("real-test", "fail", `❌ ${detail}`);
    }
    setRunning(false);
  }

  async function revokeAndRetry() {
    if (typeof navigator === "undefined" || !("permissions" in navigator)) return;
    const permsApi = navigator.permissions as Navigator["permissions"] & {
      revoke?: (descriptor: { name: string }) => Promise<void>;
    };
    if (typeof permsApi.revoke !== "function") {
      update("revoke-result", "fail", "Tu navegador no soporta navigator.permissions.revoke(). Usa el paso 2 manual.");
      return;
    }
    try {
      await permsApi.revoke({ name: "geolocation" });
      setRevoked(true);
      setPermState("prompt");
      update(
        "revoke-result",
        "ok",
        "✅ Permiso revocado. Recarga la página y vuelve a pulsar 'Probar getCurrentPosition'. Ahora debería aparecer el popup.",
      );
    } catch (e) {
      update("revoke-result", "fail", `Error al revocar: ${(e as Error).message}`);
    }
  }

  const iconFor = (s: CheckStatus) =>
    s === "ok" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
    s === "fail" ? <XCircle className="h-4 w-4 text-red-600" /> :
    s === "warn" ? <AlertCircle className="h-4 w-4 text-amber-600" /> :
    <div className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />;

  const isChromeLike = browserName.startsWith("Chrome") || browserName.startsWith("Edge") || browserName.startsWith("Opera");
  const isFirefox = browserName.startsWith("Firefox");
  const isSafari = browserName === "Safari";

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-runner-primary flex items-center gap-2">
            <MapPin className="h-6 w-6" /> Diagnóstico de geolocalización
          </h1>
          <p className="text-sm text-gray-600 mt-2">
            Ejecuta pruebas sobre la API de geolocalización y te dice exactamente qué falla
            y cómo arreglarlo. Cuando arregles, pulsa "Re-ejecutar diagnóstico".
          </p>

          {coords && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
              <div className="font-bold text-green-900">✅ GPS funcionando</div>
              <div className="font-mono text-sm text-green-800">
                {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
              </div>
              <a href="/carreras" className="text-sm text-runner-primary underline mt-2 inline-block">
                ← Volver al filtro de carreras
              </a>
            </div>
          )}

          {rawError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
              <div className="font-bold text-red-900">❌ Error real de getCurrentPosition:</div>
              <pre className="text-xs text-red-800 mt-1 whitespace-pre-wrap break-all">{rawError}</pre>
            </div>
          )}

          {/* FIX RÁPIDO cuando el estado es "denied" */}
          {permState === "denied" && (
            <div className="mt-4 p-5 bg-red-50 border-2 border-red-300 rounded-lg">
              <div className="flex items-start gap-2 mb-3">
                <Shield className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-bold text-red-900 text-lg">Permiso denegado — hay que resetearlo</h2>
                  <p className="text-sm text-red-800 mt-1">
                    El navegador tiene guardado "no" para este sitio y NO te volverá a preguntar.
                    Es estado <strong>sticky</strong> (se queda así hasta que pulses uno de los botones de abajo).
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Paso 1: programático (Chrome 116+) */}
                <div className="bg-white border border-red-200 rounded p-3">
                  <div className="font-semibold text-sm flex items-center gap-1">
                    <span className="bg-red-600 text-white rounded-full w-5 h-5 inline-flex items-center justify-center text-xs">1</span>
                    Opción rápida: revocar programáticamente
                    <span className="text-xs text-gray-500 font-normal">(Chrome 116+, Edge)</span>
                  </div>
                  <button
                    onClick={revokeAndRetry}
                    className="mt-2 inline-flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded text-sm font-semibold hover:bg-red-700"
                  >
                    <RotateCcw className="h-4 w-4" /> Restablecer permiso de ubicación
                  </button>
                  {revoked && (
                    <div className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2">
                      ✅ Hecho. Ahora <strong>recarga esta página (Ctrl+Shift+R)</strong> y vuelve a pulsar
                      "Probar getCurrentPosition". Debería aparecer el popup nativo.
                    </div>
                  )}
                </div>

                {/* Paso 2: chrome://settings manual */}
                <div className="bg-white border border-red-200 rounded p-3">
                  <div className="font-semibold text-sm flex items-center gap-1">
                    <span className="bg-red-600 text-white rounded-full w-5 h-5 inline-flex items-center justify-center text-xs">2</span>
                    Opción manual: Configuración del sitio
                  </div>
                  <ol className="list-decimal list-inside text-xs text-gray-700 mt-2 space-y-1">
                    <li>Click en el candado 🔒 o icono ⓘ a la izquierda de la URL</li>
                    <li>Busca "Ubicación" y cámbialo a <strong>"Permitir"</strong></li>
                    <li>Pulsa el botón <strong>"Restablecer permisos"</strong> que aparece justo debajo</li>
                    <li>Recarga la página con <strong>Ctrl+Shift+R</strong></li>
                    <li>Vuelve a pulsar "Probar getCurrentPosition" aquí abajo</li>
                  </ol>

                  {isChromeLike && (
                    <a
                      href="chrome://settings/content/siteDetails?site=https%3A%2F%2Fmi-dorsal.vercel.app"
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 underline"
                    >
                      <Settings className="h-3 w-3" /> Abrir configuración directa de este sitio
                    </a>
                  )}
                </div>

                {/* Paso 3: extensions */}
                <div className="bg-white border border-red-200 rounded p-3">
                  <div className="font-semibold text-sm flex items-center gap-1">
                    <span className="bg-red-600 text-white rounded-full w-5 h-5 inline-flex items-center justify-center text-xs">3</span>
                    Si lo anterior no funciona: desactiva extensiones
                  </div>
                  <p className="text-xs text-gray-700 mt-2">
                    uBlock Origin, Privacy Badger, AdBlock, DuckDuckGo Privacy Essentials y Brave Shields
                    <strong> interceptan navigator.geolocation</strong> aunque el permiso esté permitido.
                    Desactívalas para este sitio (icono de la extensión en la barra → "Desactivar en este sitio")
                    y recarga.
                  </p>
                </div>

                {/* Paso 4: ventana incógnito */}
                <div className="bg-white border border-red-200 rounded p-3">
                  <div className="font-semibold text-sm flex items-center gap-1">
                    <span className="bg-red-600 text-white rounded-full w-5 h-5 inline-flex items-center justify-center text-xs">4</span>
                    Test definitivo: ventana incógnito
                  </div>
                  <p className="text-xs text-gray-700 mt-2">
                    <strong>Ctrl+Shift+N</strong> en Chrome/Edge. La incógnito NO carga extensiones por defecto.
                    Si en incógnito funciona, es 100% cosa de una extensión. Si no funciona ni en incógnito,
                    es cosa del navegador o del sistema.
                  </p>
                </div>
              </div>
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
            <a
              href="/carreras"
              className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-50"
            >
              ← Volver a /carreras
            </a>
          </div>

          {/* Instrucciones específicas del navegador */}
          {(isChromeLike || isFirefox || isSafari) && permState !== "denied" && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded text-sm">
              <div className="font-bold text-blue-900 mb-2 flex items-center gap-1">
                {isChromeLike && <Chrome className="h-4 w-4" />}
                {isFirefox && <Globe className="h-4 w-4" />}
                {isSafari && <Smartphone className="h-4 w-4" />}
                Instrucciones para {browserName}
              </div>
              {isChromeLike && (
                <ol className="list-decimal list-inside space-y-1 text-blue-900 text-xs">
                  <li>Click en el candado 🔒 a la izquierda de la URL</li>
                  <li>Busca "Ubicación" → cámbialo a "Permitir"</li>
                  <li>Recarga con <strong>Ctrl+Shift+R</strong></li>
                  <li>Si sigue fallando, ve a <code className="bg-white px-1 rounded">chrome://settings/content/location</code> y comprueba que no esté en "No permitir que ningún sitio rastree tu ubicación"</li>
                </ol>
              )}
              {isFirefox && (
                <ol className="list-decimal list-inside space-y-1 text-blue-900 text-xs">
                  <li>Click en el candado 🔒 a la izquierda de la URL</li>
                  <li>Click en "Permisos" → "Acceder a tu ubicación" → desmarca "Bloquear"</li>
                  <li>Recarga con <strong>Ctrl+Shift+R</strong></li>
                </ol>
              )}
              {isSafari && (
                <ol className="list-decimal list-inside space-y-1 text-blue-900 text-xs">
                  <li>Ajustes → Privacidad y seguridad → Localización</li>
                  <li>Activa "Localización" general</li>
                  <li>Safari Websites → "Preguntar la próxima vez" o "Mientras se usa"</li>
                  <li>Recarga esta página</li>
                </ol>
              )}
            </div>
          )}

          <div className="mt-4 text-xs text-gray-500">
            🔒 Esta página no envía tu ubicación a ningún servidor. Solo se ejecuta en tu navegador.
          </div>
        </div>
      </div>
    </div>
  );
}

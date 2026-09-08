"use client";

// =============================================================================
// mi-dorsal — Sección "Conexiones" en /perfil
// =============================================================================
// Concentra las opciones de Strava (y en el futuro Garmin, Apple Health, etc.)
// en una sola card. Muestra:
//   - Resumen del estado (subidas OAuth, export, totales)
//   - Botón de OAuth con Strava
//   - Drop-zone para subir el export
//   - Card de "Garmin" deshabilitado con explicación
// =============================================================================

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  StravaIcon,
  GarminIcon,
  Upload,
  X,
  ExternalLink,
  Clock,
  Info,
} from "./icons";
import { StravaExportUploader } from "./strava-export-uploader";
import { StravaOauthConnect } from "./strava-oauth-connect";
import { PremiumFeatureLock } from "@/components/billing/premium-feature-lock";

export function ConnectionsSection() {
  const summary = useQuery(api.stravaExport.getMyStravaSummary, {});
  const oauthStatus = useQuery(api.stravaOauth.getMyStravaOauthStatus, {});
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  // Detectar query params de redirect del callback OAuth
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("strava") === "connected") {
      // Limpiar el query param
      window.history.replaceState({}, "", "/perfil");
    } else if (params.get("strava") === "denied" || params.get("strava") === "error") {
      window.history.replaceState({}, "", "/perfil");
    }
  }, []);

  // Cuando el upload termina (done o failed), limpiamos el activeUploadId
  // tras 5 segundos para mostrar el resumen
  useEffect(() => {
    if (!activeUploadId) return;
    const timer = setTimeout(() => {
      setActiveUploadId(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [activeUploadId]);

  return (
    <div id="conexiones" className="card mb-6 scroll-mt-20">
      <h2 className="text-lg font-semibold mb-4">Conexiones</h2>

      {/* Strava */}
      <div className="border border-gray-200 rounded-lg p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <StravaIcon className="h-6 w-6 text-[#FC4C02]" />
            <div>
              <h3 className="font-medium flex items-center gap-2">
                Strava
                <button
                  type="button"
                  onClick={() => setShowInfo(true)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Info sobre cómo se sincroniza Strava en mi-dorsal"
                >
                  <Info className="h-4 w-4" aria-hidden="true" />
                </button>
              </h3>
              <p className="text-xs text-gray-500">
                {summary?.total
                  ? `${summary.total} actividades · ${summary.racesMatched} carreras detectadas`
                  : oauthStatus?.connected
                    ? "Conectado, sincronizando…"
                    : "Aún no has conectado Strava"}
              </p>
            </div>
          </div>
          {!oauthStatus?.connected && (
            <button
              onClick={() => setShowInstructions(true)}
              className="text-xs text-runner-primary hover:underline flex items-center gap-1"
            >
              <Upload className="h-3.5 w-3.5" />
              Subir export
            </button>
          )}
        </div>

        {/* Resumen histórico */}
        {summary && (summary.lastExportAt || summary.fromOAuth > 0) && (
          <div className="text-xs text-gray-500 mb-3 flex flex-wrap gap-3">
            {summary.fromExport > 0 && (
              <span>{summary.fromExport} desde el export</span>
            )}
            {summary.fromOAuth > 0 && (
              <span>{summary.fromOAuth} desde OAuth</span>
            )}
            {summary.lastExportAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Última subida: {timeAgo(summary.lastExportAt)}
              </span>
            )}
          </div>
        )}

        {/* OAuth — solo Pro (sesión 8 sep 2026).
            Free puede seguir subiendo el export ZIP, pero NO consumir
            la API de Strava (OAuth + webhook). El gate usa
            <PremiumFeatureLock> con variant="banner" para mostrar el
            upsell claro en lugar del botón de OAuth. */}
        <PremiumFeatureLock
          feature="Sincronización con Strava"
          description="Conecta tu cuenta de Strava y tus actividades se importan solas. Detectamos carreras, actualizamos tus PRs automáticamente. El export manual sigue funcionando en free."
          variant="banner"
        >
          {/* Si el user es Pro, renderiza el OAuth connect. La
              <StravaOauthConnect> ya muestra el estado correcto
              (conectado/desconectado) y el botón de OAuth. */}
          <div className="mb-4">
            <StravaOauthConnect />
          </div>
        </PremiumFeatureLock>

        {/* Divider entre OAuth y export */}
        {!oauthStatus?.connected && summary?.fromExport === 0 && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">
              o sube el export
            </span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        )}

        {/* Uploader (solo si no hay upload activo, o si lo hay, muestra su estado) */}
        {!oauthStatus?.connected && (
          <StravaExportUploader
            activeUploadId={activeUploadId}
            onUploadComplete={setActiveUploadId}
            onClearActive={() => setActiveUploadId(null)}
            onDeleted={() => setActiveUploadId(null)}
          />
        )}
      </div>

      {/* Garmin */}
      <div className="border border-gray-200 rounded-lg p-4 opacity-60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GarminIcon className="h-6 w-6 text-gray-400" />
            <div>
              <h3 className="font-medium">Garmin Connect</h3>
              <p className="text-xs text-gray-500">
                Próximamente — Garmin no acepta nuevas apps de terceros
              </p>
            </div>
          </div>
          <button
            disabled
            className="text-xs text-gray-400 cursor-not-allowed"
          >
            Próximamente
          </button>
        </div>
      </div>

      {/* Modal de instrucciones */}
      {showInstructions && (
        <InstructionsModal onClose={() => setShowInstructions(false)} />
      )}

      {/* Modal de info general sobre Strava en mi-dorsal */}
      {showInfo && (
        <InfoModal
          onClose={() => setShowInfo(false)}
          summary={summary}
          oauthConnected={!!oauthStatus?.connected}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal de instrucciones
// ---------------------------------------------------------------------------

function InstructionsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Cómo subir tu export de Strava</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ol className="space-y-3 text-sm text-gray-700 list-decimal list-inside mb-6">
          <li>
            Abre{" "}
            <a
              href="https://www.strava.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-runner-primary hover:underline inline-flex items-center gap-1"
            >
              strava.com/dashboard <ExternalLink className="h-3 w-3" />
            </a>{" "}
            en otra pestaña
          </li>
          <li>
            Ve a tu perfil → <strong>Settings</strong> →{" "}
            <strong>"Download all your data"</strong>
          </li>
          <li>
            Confirma con tu email. Strava te mandará el ZIP cuando esté listo
            (puede tardar minutos u horas, según tu volumen)
          </li>
          <li>
            Vuelve aquí y arrastra el ZIP a la zona de drop, o haz click
            para seleccionarlo
          </li>
        </ol>

        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 mb-4">
          ⚠ Tu ZIP se procesa y se borra inmediatamente. Solo guardamos las
          actividades, no el archivo.
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-800">
          ¿Cómo se calcula tu tipo de corredor?{" "}
          <a
            href="/legal/privacidad"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Ver política de privacidad
          </a>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full btn-primary"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal de info: cómo se sincroniza Strava en mi-dorsal
// ---------------------------------------------------------------------------

interface InfoModalProps {
  onClose: () => void;
  summary:
    | {
        fromExport: number;
        fromOAuth: number;
        total: number;
        racesMatched: number;
        lastExportAt: number | null;
        lastExportActivityCount: number | null;
        lastExportRaceCount: number | null;
        lastExportPRCount: number | null;
        oauthConnected: boolean;
        oauthConnectedAt: number | null;
        lastOAuthSyncAt: number | null;
        oldestActivityAt: number | null;
        newestActivityAt: number | null;
      }
    | null
    | undefined;
  oauthConnected: boolean;
}

function InfoModal({ onClose, summary, oauthConnected }: InfoModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Strava en mi-dorsal</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-gray-700 mb-4">
          Tienes <strong>dos formas</strong> de traerte tus actividades a
          mi-dorsal. Puedes usar una, las dos, o cambiar entre ellas cuando
          quieras.
        </p>

        {/* OAuth */}
        <section className="mb-5">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#FC4C02]" />
            Conexión OAuth (recomendada)
          </h3>
          <ul className="text-xs text-gray-700 space-y-1.5 list-disc list-inside">
            <li>
              Autorizas a mi-dorsal a leer tus actividades. No publicamos
              nada en tu nombre ni modificamos tu Strava.
            </li>
            <li>
              <strong>Se actualiza automáticamente</strong>: cuando subes una
              actividad a Strava, llega a mi-dorsal en pocos minutos
              (Strava nos avisa por webhook).
            </li>
            <li>
              <strong>Sincronización inicial</strong>: al conectar,
              descargamos los últimos 90 días por defecto. Si quieres más
              histórico, sube también un export (ver abajo).
            </li>
            <li>
              <strong>Caducidad del token</strong>: cada ~6 horas el token
              se renueva solo. No tienes que hacer nada.
            </li>
          </ul>
          {oauthConnected && (
            <div className="text-xs text-gray-500 mt-2 space-y-0.5">
              {summary?.oauthConnectedAt && (
                <div>
                  Conectado {timeAgo(summary.oauthConnectedAt)}
                </div>
              )}
              {summary?.lastOAuthSyncAt && (
                <div>
                  Última sincronización: {timeAgo(summary.lastOAuthSyncAt)}
                </div>
              )}
              {summary?.fromOAuth !== undefined && (
                <div>
                  {summary.fromOAuth} actividades ingestadas por esta vía
                </div>
              )}
            </div>
          )}
        </section>

        {/* Export */}
        <section className="mb-5">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
            Subir export de Strava
          </h3>
          <ul className="text-xs text-gray-700 space-y-1.5 list-disc list-inside">
            <li>
              Descarga el ZIP desde{" "}
              <a
                href="https://www.strava.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-runner-primary hover:underline"
              >
                strava.com/dashboard
              </a>{" "}
              → Settings → "Download all your data".
            </li>
            <li>
              <strong>NO se actualiza solo</strong>: cada vez que quieras
              traer actividades nuevas, sube otro ZIP.
            </li>
            <li>
              <strong>Ventaja</strong>: trae TODO tu histórico de Strava
              desde que te creaste la cuenta, no solo los últimos 90 días.
            </li>
            <li>
              El ZIP se procesa y se borra inmediatamente. Solo guardamos las
              actividades, no el archivo.
            </li>
          </ul>
          {summary?.lastExportAt && (
            <div className="text-xs text-gray-500 mt-2">
              Última subida: {timeAgo(summary.lastExportAt)}
              {summary.lastExportActivityCount != null && (
                <> · {summary.lastExportActivityCount} actividades en ese lote</>
              )}
            </div>
          )}
        </section>

        {/* Resumen global */}
        {summary && (
          <section className="mb-5 bg-gray-50 border border-gray-200 rounded-md p-3 text-xs text-gray-700">
            <h4 className="font-semibold mb-1">Tu resumen</h4>
            <ul className="space-y-0.5">
              <li>
                Total: <strong>{summary.total} actividades</strong> (
                {summary.racesMatched} carreras detectadas)
              </li>
              {summary.oldestActivityAt && (
                <li>
                  Actividad más antigua:{" "}
                  {new Date(summary.oldestActivityAt).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </li>
              )}
              {summary.newestActivityAt && (
                <li>
                  Actividad más reciente:{" "}
                  {new Date(summary.newestActivityAt).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </li>
              )}
            </ul>
          </section>
        )}

        {/* Privacidad */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-800">
          Tus datos solo se usan para calcular tu tipo de corredor, detectar
          carreras, mandarte el resultado oficial por email, y el análisis
          con IA. Nunca los vendemos ni los compartimos.{" "}
          <a
            href="/legal/privacidad"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Política de privacidad completa
          </a>
        </div>

        <button onClick={onClose} className="mt-6 w-full btn-primary">
          Entendido
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d}d`;
  return new Date(ms).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

"use client";

// =============================================================================
// mi-dorsal — Sección "Conexiones" en /perfil
// =============================================================================
// Concentra las opciones de Strava (y en el futuro Garmin, Apple Health, etc.)
// en una sola card. Muestra:
//   - Resumen del estado (subidas OAuth, export, totales)
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
} from "./icons";
import { StravaExportUploader } from "./strava-export-uploader";

export function ConnectionsSection() {
  const summary = useQuery(api.stravaExport.getMyStravaSummary, {});
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

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
    <div className="card mb-6">
      <h2 className="text-lg font-semibold mb-4">Conexiones</h2>

      {/* Strava */}
      <div className="border border-gray-200 rounded-lg p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <StravaIcon className="h-6 w-6 text-[#FC4C02]" />
            <div>
              <h3 className="font-medium">Strava</h3>
              <p className="text-xs text-gray-500">
                {summary?.total
                  ? `${summary.total} actividades · ${summary.racesMatched} carreras detectadas`
                  : "Aún no has subido tu export"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowInstructions(true)}
            className="text-xs text-runner-primary hover:underline flex items-center gap-1"
          >
            <Upload className="h-3.5 w-3.5" />
            Subir export
          </button>
        </div>

        {/* Resumen histórico */}
        {summary && (summary.lastExportAt || summary.fromOAuth > 0) && (
          <div className="text-xs text-gray-500 mb-3 flex flex-wrap gap-3">
            {summary.fromExport > 0 && (
              <span>
                {summary.fromExport} desde el export
              </span>
            )}
            {summary.fromOAuth > 0 && (
              <span>
                {summary.fromOAuth} desde OAuth
              </span>
            )}
            {summary.lastExportAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Última subida: {timeAgo(summary.lastExportAt)}
              </span>
            )}
          </div>
        )}

        {/* Uploader (solo si no hay upload activo, o si lo hay, muestra su estado) */}
        <StravaExportUploader
          activeUploadId={activeUploadId}
          onUploadComplete={setActiveUploadId}
          onClearActive={() => setActiveUploadId(null)}
          onDeleted={() => setActiveUploadId(null)}
        />
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

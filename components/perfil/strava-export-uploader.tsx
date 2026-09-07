"use client";

// =============================================================================
// mi-dorsal — Strava export uploader (drop-zone + progreso)
// =============================================================================
// Componente cliente que:
//   1) Muestra la drop-zone con un botón "Seleccionar archivo" como fallback
//   2) Valida tamaño y MIME client-side
//   3) Sube el archivo al endpoint API /api/connect/strava-export/upload
//   4) Hace polling del estado del upload con useQuery
//   5) Muestra el progreso y el resultado final
//   6) Permite re-subir otro archivo o borrar los datos (RGPD)
// =============================================================================

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Upload, X, CheckCircle2, AlertCircle, Loader2, Trash2, Info } from "lucide-react";

const MAX_SIZE = 200 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface UploaderProps {
  // Si hay un uploadId activo (por ejemplo, recién subido o aún procesándose)
  // se muestra el estado. Si es null, se muestra la drop-zone vacía.
  activeUploadId: string | null;
  onUploadComplete: (uploadId: string) => void;
  onClearActive: () => void;
  onDeleted: () => void;
}

export function StravaExportUploader({
  activeUploadId,
  onUploadComplete,
  onClearActive,
  onDeleted,
}: UploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Polling del estado del upload
  const uploadStatus = useQuery(
    api.stravaExport.getUploadStatus,
    activeUploadId ? { uploadId: activeUploadId as any } : "skip",
  );

  const deleteMyData = useMutation(api.stravaExport.deleteMyStravaExportData);

  // Cuando termina el upload (status = done o failed), limpiamos el estado
  // local de "subiendo" pero mantenemos el uploadId para mostrar el resultado.
  useEffect(() => {
    if (uploadStatus?.status === "done" || uploadStatus?.status === "failed") {
      setIsUploading(false);
    }
  }, [uploadStatus?.status]);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      // Validaciones client-side
      if (file.size > MAX_SIZE) {
        setError(
          `El archivo pesa ${formatBytes(file.size)}, máximo 200 MB`,
        );
        return;
      }
      if (file.size < 1024) {
        setError("El archivo es demasiado pequeño para ser un export de Strava");
        return;
      }

      setIsUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/connect/strava-export/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? "Error al subir el archivo");
        }

        onUploadComplete(data.uploadId);
      } catch (e: any) {
        setError(e?.message ?? "Error al subir el archivo");
        setIsUploading(false);
      }
    },
    [onUploadComplete],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset para permitir re-subir el mismo archivo
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFile],
  );

  const handleDelete = useCallback(async () => {
    if (
      !confirm(
        "¿Borrar TODOS los datos que importamos de tu export de Strava? Esta acción no se puede deshacer.",
      )
    ) {
      return;
    }
    try {
      await deleteMyData({});
      onDeleted();
    } catch (e: any) {
      setError(e?.message ?? "Error al borrar los datos");
    }
  }, [deleteMyData, onDeleted]);

  // Mostrar estado del upload (procesando / done / failed)
  if (activeUploadId && uploadStatus) {
    return (
      <UploadStatusView
        status={uploadStatus}
        onClearActive={onClearActive}
        onDelete={handleDelete}
      />
    );
  }

  // Drop-zone vacía
  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-colors
          ${
            isDragging
              ? "border-runner-primary bg-runner-primary/5"
              : "border-gray-300 hover:border-runner-primary/50 hover:bg-gray-50"
          }
          ${isUploading ? "pointer-events-none opacity-60" : ""}
        `}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          onChange={handleInputChange}
          className="hidden"
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 text-runner-primary animate-spin" />
            <p className="text-sm text-gray-600">Subiendo el ZIP…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">
              Arrastra tu ZIP aquí
            </p>
            <p className="text-xs text-gray-500">
              o haz click para seleccionar (max 200 MB)
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-3 flex items-start gap-2 text-xs text-gray-500">
        <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>
          Tu ZIP se procesa y se borra inmediatamente. Solo guardamos las
          actividades, no el archivo.
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponente: estado del upload
// ---------------------------------------------------------------------------

interface UploadStatusViewProps {
  status: {
    _id: string;
    status: "pending" | "processing" | "done" | "failed";
    fileName: string;
    fileSizeBytes: number;
    totalActivities: number;
    processedActivities: number;
    matchedRaces: number;
    newPRs: number;
    candidatesAdded: number;
    profileFieldsUpdated: number;
    error?: string;
  };
  onClearActive: () => void;
  onDelete: () => void;
}

function UploadStatusView({ status, onClearActive, onDelete }: UploadStatusViewProps) {
  const progress =
    status.totalActivities > 0
      ? Math.min(100, (status.processedActivities / status.totalActivities) * 100)
      : 0;

  if (status.status === "failed") {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-md">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700">Error al procesar el export</p>
            <p className="text-xs text-red-600 mt-1">
              {status.error ?? "Error desconocido"}
            </p>
          </div>
          <button
            onClick={onClearActive}
            className="text-red-500 hover:text-red-700"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={onClearActive}
          className="text-sm text-runner-primary hover:underline"
        >
          Probar con otro archivo
        </button>
      </div>
    );
  }

  if (status.status === "done") {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 p-4 bg-green-50 border border-green-200 rounded-md">
          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-700">
              ¡Listo! {status.processedActivities} actividades procesadas
            </p>
            <p className="text-xs text-green-600 mt-1">
              {status.matchedRaces > 0 && (
                <>· {status.matchedRaces} carreras detectadas</>
              )}
              {status.newPRs > 0 && (
                <> · {status.newPRs} PRs nuevos</>
              )}
              {status.candidatesAdded > 0 && (
                <> · {status.candidatesAdded} candidatas a añadir al catálogo</>
              )}
              {status.profileFieldsUpdated > 0 && (
                <> · {status.profileFieldsUpdated} datos de perfil actualizados</>
              )}
            </p>
          </div>
        </div>

        <div className="flex gap-2 text-sm">
          <button
            onClick={onClearActive}
            className="text-runner-primary hover:underline"
          >
            Subir otro ZIP
          </button>
          <span className="text-gray-300">·</span>
          <button
            onClick={onDelete}
            className="text-red-600 hover:underline flex items-center gap-1"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Borrar mis datos
          </button>
        </div>
      </div>
    );
  }

  // pending o processing
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <Loader2 className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5 animate-spin" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-700">
            {status.status === "pending"
              ? "Encolado para procesar…"
              : `Procesando ${status.processedActivities}${status.totalActivities > 0 ? ` de ${status.totalActivities}` : ""} actividades`}
          </p>
          <p className="text-xs text-blue-600 mt-1">{status.fileName}</p>
        </div>
      </div>

      {status.totalActivities > 0 && (
        <div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-runner-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1 text-right">
            {progress.toFixed(0)}%
          </p>
        </div>
      )}

      {status.status === "processing" && (
        <p className="text-xs text-gray-500">
          Esto puede tardar unos segundos. No cierres esta pestaña.
        </p>
      )}
    </div>
  );
}

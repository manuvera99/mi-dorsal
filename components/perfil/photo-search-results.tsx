"use client";

// =============================================================================
// mi-dorsal — Resultado de una búsqueda de "Encuentra tus fotos"
// =============================================================================
// Convex es reactivo: useQuery(getJob/getResults) se re-renderiza solo
// cuando el documento cambia (de "running" a "done", por ejemplo) — no
// hace falta un setInterval de polling manual.
// =============================================================================

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Loader2, ImageOff, RotateCcw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useState } from "react";

export function PhotoSearchResults({
  jobId,
  onSearchAgain,
}: {
  jobId: Id<"photoSearchJobs">;
  onSearchAgain: () => void;
}) {
  const job = useQuery(api.photoSearch.getJob, { jobId });
  const cancelJob = useMutation(api.photoSearch.cancel);
  const [cancelling, setCancelling] = useState(false);

  if (job === undefined) {
    return (
      <div className="card flex items-center gap-3 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando…
      </div>
    );
  }

  if (job === null) {
    return (
      <div className="card text-center text-gray-500 py-8">
        No encontramos esta búsqueda.
      </div>
    );
  }

  if (job.status === "pending" || job.status === "running") {
    return (
      <div className="card text-center py-10">
        <Loader2 className="h-8 w-8 text-runner-primary animate-spin mx-auto mb-3" />
        <p className="font-medium">Buscando tus fotos en el álbum…</p>
        <p className="text-sm text-gray-500 mt-1">
          Puede tardar 1-2 minutos, dependiendo de cuántas fotos tenga la carrera.
        </p>
        <button
          type="button"
          disabled={cancelling}
          onClick={async () => {
            setCancelling(true);
            await cancelJob({ jobId });
          }}
          className="btn-secondary mt-4"
        >
          Cancelar
        </button>
      </div>
    );
  }

  if (job.status === "cancelled") {
    return (
      <div className="card text-center text-gray-500 py-8">
        Búsqueda cancelada.
        <button type="button" onClick={onSearchAgain} className="btn-secondary mt-4 mx-auto flex">
          <RotateCcw className="h-4 w-4 mr-2" />
          Buscar de nuevo
        </button>
      </div>
    );
  }

  if (job.status === "error") {
    return (
      <div className="card text-center py-10">
        <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-3" />
        <p className="font-medium">No se pudo completar la búsqueda</p>
        {job.error && <p className="text-sm text-gray-500 mt-1">{job.error}</p>}
        {job.rejectedSelfies && job.rejectedSelfies.length > 0 && (
          <ul className="text-sm text-gray-500 mt-2 text-left inline-block">
            {job.rejectedSelfies.map((r) => (
              <li key={r.index}>
                Selfie {r.index + 1}: {r.reasons.join(", ")}
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onSearchAgain}
          className="btn-primary mt-4 mx-auto flex"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Intentar de nuevo
        </button>
      </div>
    );
  }

  // status === "done"
  return <DoneResults jobId={jobId} onSearchAgain={onSearchAgain} />;
}

function DoneResults({
  jobId,
  onSearchAgain,
}: {
  jobId: Id<"photoSearchJobs">;
  onSearchAgain: () => void;
}) {
  const full = useQuery(api.photoSearch.getResults, { jobId });

  if (full === undefined) {
    return (
      <div className="card flex items-center gap-3 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando resultados…
      </div>
    );
  }

  if (!full || full.results.length === 0) {
    return (
      <div className="card text-center py-10">
        <ImageOff className="h-8 w-8 text-gray-300 mx-auto mb-3" />
        <p className="font-medium">No te encontramos en ninguna foto</p>
        <p className="text-sm text-gray-500 mt-1">
          {full?.stats
            ? `Revisamos ${full.stats.photosScanned} fotos del álbum sin encontrar tu cara.`
            : "Prueba con una selfie más clara, de frente y con buena luz."}
        </p>
        <button type="button" onClick={onSearchAgain} className="btn-secondary mt-4 mx-auto flex">
          <RotateCcw className="h-4 w-4 mr-2" />
          Buscar con otra selfie
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-runner-accent">
          <CheckCircle2 className="h-4 w-4" />
          {full.results.length} foto{full.results.length === 1 ? "" : "s"} encontrada
          {full.results.length === 1 ? "" : "s"}
        </p>
        <button type="button" onClick={onSearchAgain} className="text-xs text-gray-500 hover:underline">
          Buscar de nuevo
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {full.results.map((r, i) => (
          <a
            key={`${r.photoUrl}-${i}`}
            href={r.photoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative block rounded-lg overflow-hidden border border-gray-200 group"
          >
            <img
              src={r.photoUrl}
              alt={`Foto encontrada ${i + 1}`}
              className="aspect-square w-full object-cover group-hover:opacity-90 transition-opacity"
              loading="lazy"
            />
            {r.identityConfirmed && (
              <span className="absolute top-1.5 right-1.5 rounded-full bg-runner-accent text-white p-1">
                <CheckCircle2 className="h-3 w-3" />
              </span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}

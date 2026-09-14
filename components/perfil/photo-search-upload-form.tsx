"use client";

// =============================================================================
// mi-dorsal — Formulario de subida de selfies para "Encuentra tus fotos"
// =============================================================================
// Sube 1-3 selfies a Convex Storage (generateSelfieUploadUrl + fetch, mismo
// patrón que app/editor-sticker/[myRaceId]/client.tsx), luego llama a
// photoSearch.create. El servicio (findmyrace/reference_quality.py) exige
// una PRIMERA selfie frontal y trata el resto como laterales — por eso el
// slot 1 lleva la etiqueta "de frente" y el resto "de perfil".
// =============================================================================

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/components/ui/toast";
import { Camera, Loader2, X, Upload } from "lucide-react";

const MAX_SELFIES = 3;

interface SelfieSlot {
  file: File;
  previewUrl: string;
}

export function PhotoSearchUploadForm({
  raceId,
  initialDorsal,
  onJobCreated,
}: {
  raceId: Id<"races">;
  initialDorsal?: string;
  onJobCreated: (jobId: Id<"photoSearchJobs">) => void;
}) {
  const toast = useToast();
  const generateSelfieUploadUrl = useMutation(api.photoSearch.generateSelfieUploadUrl);
  const createJob = useMutation(api.photoSearch.create);

  const [slots, setSlots] = useState<SelfieSlot[]>([]);
  const [dorsal, setDorsal] = useState(initialDorsal ?? "");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = MAX_SELFIES - slots.length;
    const picked = Array.from(files).slice(0, remaining);
    const newSlots = picked.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    setSlots((prev) => [...prev, ...newSlots]);
  }

  function removeSlot(index: number) {
    setSlots((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit() {
    if (slots.length === 0) {
      toast.show({ title: "Sube al menos una selfie", variant: "warning" });
      return;
    }
    setSubmitting(true);
    try {
      const storageIds: Id<"_storage">[] = [];
      for (const slot of slots) {
        const uploadUrl = await generateSelfieUploadUrl({});
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": slot.file.type || "image/jpeg" },
          body: slot.file,
        });
        if (!res.ok) {
          throw new Error(`No se pudo subir la selfie (${res.status})`);
        }
        const { storageId } = await res.json();
        storageIds.push(storageId);
      }

      const jobId = await createJob({
        raceId,
        dorsal: dorsal.trim() || undefined,
        selfieStorageIds: storageIds,
      });

      onJobCreated(jobId);
    } catch (e: any) {
      toast.show({
        title: "No se pudo iniciar la búsqueda",
        description: e?.message,
        variant: "warning",
      });
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold mb-1">Sube tus selfies</h2>
      <p className="text-sm text-gray-600 mb-4">
        La primera foto debe ser <strong>de frente</strong>, con buena luz y sin gafas de
        sol. Si añades más, que sean <strong>de perfil</strong> — ayuda a encontrarte en
        fotos donde no mires a cámara.
      </p>

      <div className="flex gap-3 mb-4">
        {slots.map((slot, i) => (
          <div key={slot.previewUrl} className="relative">
            <img
              src={slot.previewUrl}
              alt={i === 0 ? "Selfie de frente" : `Selfie de perfil ${i}`}
              className="h-24 w-24 rounded-lg object-cover border border-gray-200"
            />
            <button
              type="button"
              onClick={() => removeSlot(i)}
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-50"
              aria-label="Quitar esta selfie"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <span className="absolute bottom-1 left-1 rounded bg-black/60 text-white text-[10px] px-1.5 py-0.5">
              {i === 0 ? "De frente" : "De perfil"}
            </span>
          </div>
        ))}

        {slots.length < MAX_SELFIES && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-24 w-24 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-runner-primary hover:text-runner-primary transition-colors"
          >
            <Camera className="h-6 w-6" />
            <span className="text-[10px] font-medium">Añadir</span>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="user"
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />

      <div className="mb-4">
        <label htmlFor="photo-search-dorsal" className="label mb-1 block">
          Dorsal (opcional, ayuda a acertar más)
        </label>
        <input
          id="photo-search-dorsal"
          type="text"
          inputMode="numeric"
          value={dorsal}
          onChange={(e) => setDorsal(e.target.value)}
          placeholder="Ej. 1282"
          className="input max-w-[160px]"
        />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || slots.length === 0}
        className="btn-primary w-full"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Iniciando búsqueda…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Buscar mis fotos
          </>
        )}
      </button>
    </div>
  );
}

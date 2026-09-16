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
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/components/ui/toast";
import {
  Camera,
  Loader2,
  X,
  Upload,
  Plus,
  Link as LinkIcon,
  Search,
  ImageIcon,
} from "lucide-react";

const MAX_SELFIES = 3;
const MAX_ALBUMS = 3;

// Espejo en cliente del regex de findmyrace/sources/flickr.py
// (_PROFILE_ALBUMS_URL_RE) — solo para decidir si mostrar el botón "Ver
// álbumes", la validación real vive en el backend.
const FLICKR_PROFILE_ALBUMS_RE = /flickr\.com\/photos\/[^/]+\/albums\/?$/i;

interface SelfieSlot {
  file: File;
  previewUrl: string;
}

interface FlickrAlbum {
  id: string;
  title: string;
  photoCount: number;
  url: string;
}

export function PhotoSearchUploadForm({
  raceId,
  initialDorsal,
  initialAlbumUrl,
  onJobCreated,
}: {
  raceId: Id<"races">;
  initialDorsal?: string;
  /** Álbum ya conocido de la carrera (puesto por el admin), si existe —
   *  se usa como primer valor prellenado pero editable: esta búsqueda es
   *  personal, no cambia el álbum de la carrera para nadie más. */
  initialAlbumUrl?: string;
  onJobCreated: (jobId: Id<"photoSearchJobs">) => void;
}) {
  const toast = useToast();
  const generateSelfieUploadUrl = useMutation(api.photoSearch.generateSelfieUploadUrl);
  const createJob = useMutation(api.photoSearch.create);
  const listFlickrAlbums = useAction(api.photoSearchActions.listFlickrAlbums);

  const [slots, setSlots] = useState<SelfieSlot[]>([]);
  const [dorsal, setDorsal] = useState(initialDorsal ?? "");
  const [albumUrls, setAlbumUrls] = useState<string[]>([initialAlbumUrl ?? ""]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selector de álbumes: al pegar la URL de PERFIL de un fotógrafo (no de
  // un álbum concreto), se ofrece cargar la lista completa de sus álbumes
  // públicos y marcar cuáles buscar, en vez de copiar cada enlace a mano.
  // `picker.slotIndex` identifica qué slot de texto disparó la carga —
  // al confirmar, ese slot se reemplaza por las URLs elegidas.
  const [picker, setPicker] = useState<{
    slotIndex: number;
    loading: boolean;
    albums: FlickrAlbum[] | null;
    selected: Set<string>;
    error: string | null;
  } | null>(null);

  function setAlbumUrl(index: number, value: string) {
    setAlbumUrls((prev) => prev.map((u, i) => (i === index ? value : u)));
    if (picker?.slotIndex === index) setPicker(null);
  }

  function addAlbumSlot() {
    setAlbumUrls((prev) => (prev.length < MAX_ALBUMS ? [...prev, ""] : prev));
  }

  function removeAlbumSlot(index: number) {
    setAlbumUrls((prev) => prev.filter((_, i) => i !== index));
    if (picker?.slotIndex === index) setPicker(null);
  }

  async function openAlbumPicker(index: number) {
    const profileUrl = albumUrls[index]?.trim() ?? "";
    setPicker({ slotIndex: index, loading: true, albums: null, selected: new Set(), error: null });
    try {
      const { albums } = await listFlickrAlbums({ profileUrl });
      setPicker({ slotIndex: index, loading: false, albums, selected: new Set(), error: null });
    } catch (e: any) {
      setPicker({
        slotIndex: index,
        loading: false,
        albums: null,
        selected: new Set(),
        error: e?.message ?? "No se pudieron cargar los álbumes",
      });
    }
  }

  function toggleAlbumSelection(url: string) {
    setPicker((prev) => {
      if (!prev) return prev;
      const next = new Set(prev.selected);
      if (next.has(url)) {
        next.delete(url);
      } else {
        // Límite global de MAX_ALBUMS entre todos los slots: los ya
        // rellenos en otros slots + los que se vayan marcando aquí.
        const otherSlotsFilled = albumUrls.filter((u, i) => i !== prev.slotIndex && u.trim()).length;
        if (otherSlotsFilled + next.size >= MAX_ALBUMS) return prev;
        next.add(url);
      }
      return { ...prev, selected: next };
    });
  }

  function confirmAlbumSelection() {
    if (!picker || picker.selected.size === 0) return;
    const chosen = Array.from(picker.selected);
    setAlbumUrls((prev) => {
      const next = [...prev];
      next[picker.slotIndex] = chosen[0];
      // Los álbumes adicionales elegidos ocupan huecos vacíos o se añaden
      // como slots nuevos, respetando MAX_ALBUMS.
      for (const url of chosen.slice(1)) {
        const emptyIndex = next.findIndex((u) => !u.trim());
        if (emptyIndex !== -1) {
          next[emptyIndex] = url;
        } else if (next.length < MAX_ALBUMS) {
          next.push(url);
        }
      }
      return next;
    });
    setPicker(null);
  }

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

    const trimmedAlbumUrls = albumUrls.map((u) => u.trim()).filter(Boolean);
    if (trimmedAlbumUrls.length === 0) {
      toast.show({ title: "Añade el enlace del álbum de fotos", variant: "warning" });
      return;
    }
    for (const url of trimmedAlbumUrls) {
      try {
        new URL(url);
      } catch {
        toast.show({ title: `"${url}" no es un enlace válido`, variant: "warning" });
        return;
      }
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
        albumUrls: trimmedAlbumUrls,
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
        <label className="label mb-1 block">Álbum(es) de fotos</label>
        <p className="text-xs text-gray-500 mb-2">
          Pega el enlace del álbum de Flickr de tu carrera (o el del perfil del
          fotógrafo, ej. flickr.com/photos/usuario/albums/, para elegir álbumes de una
          lista), el enlace de la página de resultados de ChipLevante
          (chiplevante.com/es/prueba/...), el enlace del álbum de fotos de Grupo
          Brotons (grupobrotons.com/fotografias/nggallery/album/...), o el enlace del
          álbum de Lumepic (lumepic.com/es/album/...) — en Lumepic las fotos que te
          encontremos llevan marca de agua y tendrás que comprarlas ahí para
          descargarlas sin ella. Esta búsqueda solo te afecta a ti, no cambia nada
          para nadie más.
        </p>
        <div className="flex flex-col gap-2">
          {albumUrls.map((url, i) => {
            const looksLikeProfile = FLICKR_PROFILE_ALBUMS_RE.test(url.trim());
            return (
              <div key={i}>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setAlbumUrl(i, e.target.value)}
                      placeholder="https://www.flickr.com/photos/..."
                      className="input pl-9"
                    />
                  </div>
                  {looksLikeProfile && (
                    <button
                      type="button"
                      onClick={() => openAlbumPicker(i)}
                      className="btn-secondary h-10 flex-shrink-0 whitespace-nowrap"
                    >
                      <Search className="h-3.5 w-3.5 mr-1.5" />
                      Ver álbumes
                    </button>
                  )}
                  {albumUrls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAlbumSlot(i)}
                      className="h-10 w-10 flex-shrink-0 rounded-md border border-gray-300 flex items-center justify-center text-gray-400 hover:bg-gray-50"
                      aria-label="Quitar este álbum"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {picker?.slotIndex === i && (
                  <AlbumPickerPanel
                    picker={picker}
                    onToggle={toggleAlbumSelection}
                    onConfirm={confirmAlbumSelection}
                    onCancel={() => setPicker(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
        {albumUrls.length < MAX_ALBUMS && (
          <button
            type="button"
            onClick={addAlbumSlot}
            className="mt-2 inline-flex items-center gap-1 text-sm text-runner-primary hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Añadir otro álbum
          </button>
        )}
      </div>

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

function AlbumPickerPanel({
  picker,
  onToggle,
  onConfirm,
  onCancel,
}: {
  picker: {
    loading: boolean;
    albums: FlickrAlbum[] | null;
    selected: Set<string>;
    error: string | null;
  };
  onToggle: (url: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3">
      {picker.loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando álbumes de este perfil…
        </div>
      )}

      {picker.error && (
        <p className="text-sm text-red-600 py-1">{picker.error}</p>
      )}

      {picker.albums && picker.albums.length === 0 && (
        <p className="text-sm text-gray-500 py-1">Este perfil no tiene álbumes públicos.</p>
      )}

      {picker.albums && picker.albums.length > 0 && (
        <>
          <p className="text-xs text-gray-500 mb-2">
            Elige hasta {MAX_ALBUMS} álbumes (puedes combinarlos con otros ya añadidos):
          </p>
          <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
            {picker.albums.map((album) => {
              const checked = picker.selected.has(album.url);
              return (
                <label
                  key={album.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm ${
                    checked ? "bg-runner-primary/10" : "hover:bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(album.url)}
                    className="flex-shrink-0"
                  />
                  <ImageIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  <span className="flex-1 truncate">{album.title || "(sin título)"}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {album.photoCount} fotos
                  </span>
                </label>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={onConfirm}
              disabled={picker.selected.size === 0}
              className="btn-primary text-sm px-3 py-1.5"
            >
              Usar {picker.selected.size || ""} álbum{picker.selected.size === 1 ? "" : "es"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-gray-500 hover:underline"
            >
              Cancelar
            </button>
          </div>
        </>
      )}

      {picker.error && (
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:underline mt-1">
          Cerrar
        </button>
      )}
    </div>
  );
}

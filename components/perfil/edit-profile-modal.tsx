"use client";

// =============================================================================
// mi-dorsal — Modal para editar el perfil (displayName, club, birthDate, bio)
// =============================================================================
// Cubre el caso que ya tenía el `<a href="/sign-in?...">` del header de
// /perfil: el usuario quiere ajustar su nombre visible, club, fecha de
// nacimiento o bio. Sigue el mismo patrón visual que `pr-form-modal.tsx`
// (backdrop, panel, `X`, `btn-primary`/`btn-secondary`, errores rojos).
//
// Decisión de UX: la fecha de nacimiento se guarda exacta (YYYY-MM-DD) para
// poder calcular la edad dinámicamente y para uso futuro (categorías de
// carrera, ranking por edad), pero en el resto de la app solo se muestra la
// edad. El input `type="date"` da una UX nativa consistente iOS/Android.
// =============================================================================

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { mockApi, isMockMode } from "@/lib/mock/provider";
import { X, Loader2 } from "lucide-react";
import { ClubSelect } from "./club-select";

const BIO_MAX = 280;
const DISPLAY_NAME_MAX = 60;
const CLUB_MAX = 80;

// YYYY-MM-DD estricto: rechaza "1991-5-1", "1991/05/01", etc. Devuelve "" si no encaja.
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidBirthDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  // No permitimos fechas futuras.
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return parsed.getTime() <= todayUtc.getTime();
}

export interface ProfileDraft {
  displayName?: string;
  club?: string;
  birthDate?: string;
  bio?: string;
}

export interface ProfileForEdit {
  displayName?: string;
  club?: string;
  birthDate?: string;
  bio?: string;
}

export function EditProfileModal({
  profile,
  onClose,
}: {
  profile: ProfileForEdit;
  onClose: () => void;
}) {
  const updateProfileConvex = useMutation(api.users.upsertMyProfile);
  const useMock = isMockMode();

  // Estado local del formulario. Inicializamos desde el profile actual.
  // `useState` con un inicializador lazy para no reconstruir strings en cada render.
  const [displayName, setDisplayName] = useState<string>(profile.displayName ?? "");
  const [club, setClub] = useState<string>(profile.club ?? "");
  const [birthDate, setBirthDate] = useState<string>(profile.birthDate ?? "");
  const [bio, setBio] = useState<string>(profile.bio ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Cerrar con Escape (accesibilidad básica; el backdrop ya cierra por click).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = displayName.trim();
    const trimmedClub = club.trim();
    const trimmedBio = bio.trim();
    const finalBirthDate = birthDate.trim();

    if (!trimmedName) {
      setError("Tu nombre no puede estar vacío.");
      return;
    }
    if (trimmedName.length > DISPLAY_NAME_MAX) {
      setError(`Tu nombre no puede pasar de ${DISPLAY_NAME_MAX} caracteres.`);
      return;
    }
    if (trimmedClub.length > CLUB_MAX) {
      setError(`El club no puede pasar de ${CLUB_MAX} caracteres.`);
      return;
    }
    if (trimmedBio.length > BIO_MAX) {
      setError(`La bio no puede pasar de ${BIO_MAX} caracteres.`);
      return;
    }
    if (finalBirthDate && !isValidBirthDate(finalBirthDate)) {
      setError("La fecha de nacimiento no es válida o está en el futuro.");
      return;
    }

    setSaving(true);
    try {
      // Solo mandamos birthDate si el usuario escribió algo; si no, mandamos
      // "" para que el backend la borre (en el flujo real). birthDate undefined
      // en el patch significaría "no tocar", que no es lo que queremos aquí.
      const patch = {
        displayName: trimmedName,
        club: trimmedClub,
        bio: trimmedBio,
        // string vacío → backend lo interpreta como borrar; string con fecha → guarda.
        birthDate: finalBirthDate === "" ? "" : finalBirthDate,
      };

      if (useMock) {
        await mockApi.users.updateMyProfile(patch);
      } else {
        await updateProfileConvex(patch);
      }
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Error al guardar el perfil");
      setSaving(false);
    }
  };

  return (
    // z-[2000] + isolation: isolate para superar a los mapas de Leaflet
    // (z-index 400 en sus controles). Sin esto, los mapas se renderizan
    // ENCIMA del modal y el usuario acaba clickeando el mapa pensando
    // que clickea el botón del modal.
    <div
      className="fixed inset-0 z-[2000] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
      style={{ isolation: "isolate" }}
    >
      <div
        className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Editar perfil"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Editar tu perfil</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Cerrar"
            disabled={saving}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={saving} className="space-y-4 m-0 p-0 border-0">
            <div>
              <label htmlFor="ep-name" className="block text-sm font-medium text-gray-700 mb-1">
                Nombre
              </label>
              <input
                id="ep-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={DISPLAY_NAME_MAX}
                placeholder="Cómo te ven los demás"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                required
              />
            </div>

            <div>
              <label htmlFor="ep-club" className="block text-sm font-medium text-gray-700 mb-1">
                Club <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <ClubSelect
                value={club}
                onChange={setClub}
                disabled={saving}
                maxLength={CLUB_MAX}
              />
            </div>

            <div>
              <label htmlFor="ep-birth" className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de nacimiento <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                id="ep-birth"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                Solo la usaremos para calcular tu edad y, más adelante, las categorías de carrera.
                No la mostramos en tu perfil público.
              </p>
            </div>

            <div>
              <label htmlFor="ep-bio" className="block text-sm font-medium text-gray-700 mb-1">
                Bio <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                id="ep-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={BIO_MAX}
                rows={3}
                placeholder="Una línea sobre ti como corredor."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed resize-none"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">
                {bio.length}/{BIO_MAX}
              </p>
            </div>
          </fieldset>

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={saving}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
                </span>
              ) : (
                "Guardar"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// Helper público: calcula la edad a partir de un YYYY-MM-DD.
// Devuelve null si el input es inválido o no hay fecha.
// Usado en la cabecera del perfil para no exponer la fecha exacta.
// =============================================================================
export function ageFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate || !DATE_REGEX.test(birthDate)) return null;
  const parsed = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - parsed.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - parsed.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < parsed.getUTCDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

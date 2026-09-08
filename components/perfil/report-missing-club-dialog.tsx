"use client";

// =============================================================================
// mi-dorsal — Dialog "No encuentro mi club"
// =============================================================================
// Se abre desde el ClubSelect cuando el usuario busca un club que no existe
// en la lista RFEA. Le pide: nombre del club, CCAA opcional, nota opcional,
// y email opcional (por si quiere que le avisemos cuando se añada).
//
// Llama a `api.clubSuggestions.submit` (o al mock en dev) y muestra un
// estado de éxito antes de cerrar.
//
// Decisión de UX: el backdrop NO cierra el dialog al hacer click fuera
// (rompía el flujo: un click accidental cerraba el dialog antes de que la
// mutation terminara, dando sensación de "se cierra sin hacer nada"). Solo
// X y Cancelar cierran.
// =============================================================================

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { mockApi, isMockMode } from "@/lib/mock/provider";
import { X, Loader2, CheckCircle2 } from "lucide-react";

const NOTE_MAX = 500;
const NAME_MAX = 120;
const CCAA_MAX = 60;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Lista de CCAA para el <select>. Mismo set que lib/geo/region.ts (19 CCAA +
// Ceuta + Melilla), pero como string libre para que el admin pueda
// identificar la solicitud sin necesidad de tener la clave exacta.
const CCAA_OPTIONS = [
  "Andalucía",
  "Aragón",
  "Asturias",
  "Islas Baleares",
  "Canarias",
  "Cantabria",
  "Castilla y León",
  "Castilla-La Mancha",
  "Cataluña",
  "Comunidad Valenciana",
  "Extremadura",
  "Galicia",
  "La Rioja",
  "Madrid",
  "Murcia",
  "Navarra",
  "País Vasco",
  "Ceuta",
  "Melilla",
];

export function ReportMissingClubDialog({
  initialQuery,
  onClose,
}: {
  initialQuery: string;
  onClose: () => void;
}) {
  const submitConvex = useMutation(api.clubSuggestions.submit);
  const useMock = isMockMode();

  const [clubName, setClubName] = useState(initialQuery.trim().slice(0, NAME_MAX));
  const [ccaa, setCcaa] = useState("");
  const [note, setNote] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Cierra con Escape (mientras no esté enviando).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, sending]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = clubName.trim();
    if (trimmedName.length < 2) {
      setError("El nombre del club es demasiado corto.");
      return;
    }
    const trimmedNote = note.trim();
    if (trimmedNote.length > NOTE_MAX) {
      setError(`La nota no puede pasar de ${NOTE_MAX} caracteres.`);
      return;
    }
    const trimmedEmail = contactEmail.trim();
    if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) {
      setError("El email no es válido.");
      return;
    }

    setSending(true);
    const payload = {
      clubName: trimmedName,
      ccaa: ccaa || undefined,
      note: trimmedNote || undefined,
      contactEmail: trimmedEmail || undefined,
    };
    // Log diagnóstico: si el usuario reporta otro bug, podemos ver en la
    // consola del navegador exactamente qué payload se mandó y qué devolvió.
    // eslint-disable-next-line no-console
    console.info("[report-missing-club] submitting", payload);
    try {
      if (useMock) {
        await mockApi.clubSuggestions.submit(payload);
      } else {
        const result = await submitConvex(payload);
        // eslint-disable-next-line no-console
        console.info("[report-missing-club] submitted OK", result);
      }
      setSent(true);
      // Cierra a los 1.5s para que el usuario vea la confirmación.
      setTimeout(() => onClose(), 1500);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[report-missing-club] submit failed", e);
      // Convex a veces devuelve solo "Server Error" sin detalle. Mostramos
      // un mensaje útil para que el usuario sepa qué pasó.
      const raw = e?.message ?? String(e);
      setError(
        raw && raw !== "Server Error"
          ? `No se pudo enviar: ${raw}`
          : "No se pudo enviar la sugerencia. Inténtalo de nuevo en unos segundos.",
      );
      setSending(false);
    }
  };

  return (
    // Backdrop SIN onClick: el dialog solo se cierra con X o Cancelar. Evita
    // que un click accidental cierre el dialog antes de que la mutation
    // termine, dando sensación de "se cierra sin hacer nada".
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Reportar club no encontrado"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Avisa al admin</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Cerrar"
            disabled={sending}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {sent ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
            <p className="font-medium">¡Gracias! Hemos enviado la sugerencia.</p>
            <p className="text-sm text-gray-500 mt-1">
              El admin la revisará y, si procede, la añadirá al próximo
              re-ingest de la lista RFEA.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">
              Dinos el nombre del club que no encuentras. Lo revisaremos y,
              si es un club de atletismo registrado, lo añadiremos a la lista.
            </p>

            <fieldset disabled={sending} className="space-y-4 m-0 p-0 border-0">
              <div>
                <label htmlFor="rmc-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del club
                </label>
                <input
                  id="rmc-name"
                  type="text"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value.slice(0, NAME_MAX))}
                  maxLength={NAME_MAX}
                  placeholder="Ej. Club Atletismo Bull Runners"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  required
                />
              </div>

              <div>
                <label htmlFor="rmc-ccaa" className="block text-sm font-medium text-gray-700 mb-1">
                  CCAA <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <select
                  id="rmc-ccaa"
                  value={ccaa}
                  onChange={(e) => setCcaa(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed bg-white"
                >
                  <option value="">— No estoy seguro —</option>
                  {CCAA_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="rmc-note" className="block text-sm font-medium text-gray-700 mb-1">
                  Nota <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  id="rmc-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
                  maxLength={NOTE_MAX}
                  rows={2}
                  placeholder="Es un club nuevo, sección de atletismo de un colegio, etc."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">
                  {note.length}/{NOTE_MAX}
                </p>
              </div>

              <div>
                <label htmlFor="rmc-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email de contacto <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  id="rmc-email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="Te avisaremos cuando lo añadamos"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                />
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
                disabled={sending}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary flex-1"
                disabled={sending}
                onClick={() => {
                  // Diagnóstico: si el form submit no se triggerea por
                  // algún motivo, este log confirma que el click sí
                  // llegó al botón.
                  // eslint-disable-next-line no-console
                  console.info("[report-missing-club] submit button clicked");
                }}
              >
                {sending ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
                  </span>
                ) : (
                  "Enviar sugerencia"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

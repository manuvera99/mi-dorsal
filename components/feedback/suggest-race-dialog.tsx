// =============================================================================
// mi-dorsal — SuggestRaceDialog
// =============================================================================
// Modal que aparece cuando un usuario logueado quiere sugerir una carrera
// que no encuentra en el catálogo. Pega la URL de la web oficial y opcionalmente
// añade una nota. Se envía a la mutation `raceSuggestions.submit`.
//
// El admin ve las sugerencias en /admin/race-suggestions y, al aprobarlas,
// aterriza en /admin/races/from-url con la URL pre-rellena para extraer con IA.
// =============================================================================

"use client";

import { useState, type FormEvent, useEffect } from "react";
import { useMutation } from "convex/react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { PROVINCE_LIST } from "@/lib/utils";
import { isMockMode } from "@/lib/mock/provider";
import { Plus, Loader2, Check, AlertCircle, X, Sparkles, ExternalLink, Link as LinkIcon } from "lucide-react";

const IS_MOCK = typeof window !== "undefined" && isMockMode();

type Status = "idle" | "submitting" | "success" | "error";

export function SuggestRaceDialog({
  triggerLabel = "¿No encuentras tu carrera? Sugiérela",
  triggerClassName = "",
}: {
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-sm font-semibold text-runner-primary hover:underline ${triggerClassName}`}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {triggerLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="suggest-race-title"
          >
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-runner-primary" aria-hidden="true" />
                <h2 id="suggest-race-title" className="text-lg font-bold text-runner-dark">
                  Sugerir una carrera
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <SignedOut>
              <div className="p-6 text-center">
                <p className="text-sm text-gray-600 mb-4">
                  Para sugerir una carrera necesitas tener cuenta en mi-dorsal. Así
                  sabemos quién la pidió y te avisamos cuando la añadamos al catálogo.
                </p>
                <SignInButton mode="modal">
                  <button className="inline-flex items-center gap-2 bg-runner-primary text-white px-5 py-2 rounded-md font-semibold hover:opacity-90">
                    Entrar o crear cuenta
                  </button>
                </SignInButton>
              </div>
            </SignedOut>

            <SignedIn>
              <SuggestRaceForm onSuccess={() => setOpen(false)} />
            </SignedIn>
          </div>
        </div>
      )}
    </>
  );
}

function SuggestRaceForm({ onSuccess }: { onSuccess: () => void }) {
  const submit = useMutation(api.raceSuggestions.submit);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [locality, setLocality] = useState("");
  const [province, setProvince] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Escape cierra
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSuccess();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onSuccess]);

  const canSubmit = url.trim().length > 0 && status !== "submitting";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus("submitting");
    setErrorMsg("");
    try {
      await submit({
        url: url.trim(),
        suggestedName: name.trim() || undefined,
        suggestedDate: date || undefined,
        suggestedLocality: locality.trim() || undefined,
        suggestedProvince: province || undefined,
        note: note.trim() || undefined,
      });
      setStatus("success");
      // Cierra el modal a los 2s
      setTimeout(onSuccess, 2200);
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Error al enviar. Inténtalo de nuevo.");
    }
  }

  if (status === "success") {
    return (
      <div className="p-6 text-center">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-3">
          <Check className="h-6 w-6 text-green-600" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-bold text-runner-dark mb-1">¡Sugerencia enviada!</h3>
        <p className="text-sm text-gray-600">
          Manu la revisará y, si la aprueba, la añadirá al catálogo. Te avisaremos
          si quieres (déjanos tu email en la nota).
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-4">
      <p className="text-sm text-gray-600">
        Pega la URL de la web oficial de la carrera. Cuantos más datos rellenes, más
        rápido la añadiremos.
      </p>

      <div>
        <label htmlFor="sug-url" className="block text-sm font-semibold text-gray-700 mb-1">
          <LinkIcon className="inline h-3.5 w-3.5 mr-0.5" aria-hidden="true" /> URL <span className="text-runner-primary">*</span>
        </label>
        <input
          id="sug-url"
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.organizador.com/carrera-2026"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="sug-name" className="block text-xs font-semibold text-gray-700 mb-1">
            Nombre <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            id="sug-name"
            type="text"
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="15K Nocturna Valencia"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
          />
        </div>
        <div>
          <label htmlFor="sug-date" className="block text-xs font-semibold text-gray-700 mb-1">
            Fecha <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            id="sug-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="sug-locality" className="block text-xs font-semibold text-gray-700 mb-1">
            Localidad <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            id="sug-locality"
            type="text"
            value={locality}
            onChange={(e) => setLocality(e.target.value)}
            placeholder="Valencia"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
          />
        </div>
        <div>
          <label htmlFor="sug-province" className="block text-xs font-semibold text-gray-700 mb-1">
            Provincia <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <select
            id="sug-province"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
          >
            <option value="">—</option>
            {PROVINCE_LIST.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="sug-note" className="block text-xs font-semibold text-gray-700 mb-1">
          Nota <span className="text-gray-400 font-normal">(opcional, máx 1000)</span>
        </label>
        <textarea
          id="sug-note"
          rows={3}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Algo que ayude al admin a localizarla: 'es la 5K de mi pueblo', 'organiza Running.es', 'carrera con dorsal personalizado'…"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary resize-y"
        />
        <p className="text-xs text-gray-400 mt-1 text-right">{note.length}/1000</p>
      </div>

      {status === "error" && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2 border-t">
        <p className="text-xs text-gray-500">
          <ExternalLink className="inline h-3 w-3 mr-0.5" aria-hidden="true" />
          Manu la revisará y, si la aprueba, la añadirá al catálogo.
        </p>
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 bg-runner-primary text-white px-4 py-2 rounded-md font-semibold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {status === "submitting" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" /> Enviar sugerencia
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function Send(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden="true"
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

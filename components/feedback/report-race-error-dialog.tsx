// =============================================================================
// mi-dorsal — ReportRaceErrorDialog
// =============================================================================
// Botón "Reportar error en esta carrera" que aparece en cada ficha de carrera.
// Reutiliza el sistema de feedback: envía a `feedbackReports` con el campo
// `raceId` pre-rellenado, así el admin ve el contexto directamente en
// /admin/feedback y puede saltar a la carrera en un click.
// =============================================================================

"use client";

import { useState, type FormEvent, useEffect } from "react";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { isMockMode } from "@/lib/mock/provider";
import {
  Bug,
  Loader2,
  Check,
  AlertCircle,
  X,
  Flag,
  Send,
} from "lucide-react";

type Status = "idle" | "submitting" | "success" | "error";

export function ReportRaceErrorDialog({
  raceId,
  raceName,
  className = "",
}: {
  raceId: Id<"races">;
  raceName: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-runner-primary transition-colors ${className}`}
        title="Reportar un error en los datos de esta carrera"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        ¿Ves algo raro? Reportar error
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
            aria-labelledby="report-race-title"
          >
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <Bug className="h-5 w-5 text-runner-primary" aria-hidden="true" />
                <h2 id="report-race-title" className="text-lg font-bold text-runner-dark">
                  Reportar error
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

            <ReportForm
              raceId={raceId}
              raceName={raceName}
              onSuccess={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}

function ReportForm({
  raceId,
  raceName,
  onSuccess,
}: {
  raceId: Id<"races">;
  raceName: string;
  onSuccess: () => void;
}) {
  const useMock = isMockMode();
  const userResult = useMock ? null : useUser();
  const isSignedIn = userResult?.isSignedIn ?? false;
  const userEmail = userResult?.user?.emailAddresses?.[0]?.emailAddress ?? null;

  const submit = useMutation(api.feedback.submit);

  const [title, setTitle] = useState(`Error en ${raceName}`);
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
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

  // Si el usuario ya tenía un título largo y empieza a editar, le quitamos el
  // prefijo auto-puesto para que no tenga que borrarlo a mano.
  useEffect(() => {
    if (title.startsWith("Error en ") && title.length > `Error en ${raceName}`.length) {
      // ya está editado
    }
  }, [title, raceName]);

  const canSubmit = title.trim().length >= 4 && description.trim().length >= 10 && status !== "submitting";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus("submitting");
    setErrorMsg("");
    try {
      await submit({
        type: "bug",
        title: title.trim(),
        description: description.trim(),
        pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        contactEmail: !isSignedIn && contactEmail.trim() ? contactEmail.trim() : undefined,
        raceId,
      });
      setStatus("success");
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
        <h3 className="text-lg font-bold text-runner-dark mb-1">¡Gracias por avisar!</h3>
        <p className="text-sm text-gray-600">
          Manu revisa los reportes cada día. Si lo necesitamos, te escribimos a tu email.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-900">
        <p>
          Vas a reportar un error en:{" "}
          <strong className="font-semibold">{raceName}</strong>. Lo usaremos para corregir
          los datos. Si quieres sugerir una carrera nueva, usa{" "}
          <a href="/carreras" className="underline font-semibold">"Sugerir carrera"</a> en
          el catálogo.
        </p>
      </div>

      <div>
        <label htmlFor="rep-title" className="block text-sm font-semibold text-gray-700 mb-1">
          ¿Qué está mal? <span className="text-runner-primary">*</span>
        </label>
        <input
          id="rep-title"
          type="text"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="La fecha está mal, el lugar es otro, el organizador es X…"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
        />
      </div>

      <div>
        <label htmlFor="rep-description" className="block text-sm font-semibold text-gray-700 mb-1">
          Detalles <span className="text-runner-primary">*</span>
        </label>
        <textarea
          id="rep-description"
          required
          rows={5}
          maxLength={5000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Cuéntanos qué dato está mal y, si lo sabes, cuál sería el correcto. Si tienes un link a la web oficial con la info buena, pégalo aquí también."
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary resize-y"
        />
        <p className="text-xs text-gray-400 mt-1 text-right">{description.length}/5000</p>
      </div>

      {!isSignedIn && (
        <div>
          <label htmlFor="rep-email" className="block text-sm font-semibold text-gray-700 mb-1">
            Tu email <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            id="rep-email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="Para preguntarte si necesitamos más contexto"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
          />
        </div>
      )}

      {isSignedIn && userEmail && (
        <p className="text-xs text-gray-500 bg-runner-warm rounded-md p-2">
          Lo enviaremos asociado a tu cuenta <strong>{userEmail}</strong>.
        </p>
      )}

      {status === "error" && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2 border-t">
        <button
          type="button"
          onClick={onSuccess}
          className="text-sm text-gray-500 hover:underline"
        >
          Cancelar
        </button>
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
              <Send className="h-4 w-4" /> Enviar reporte
            </>
          )}
        </button>
      </div>
    </form>
  );
}

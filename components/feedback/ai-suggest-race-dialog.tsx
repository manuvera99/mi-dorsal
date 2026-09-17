"use client";

// =============================================================================
// mi-dorsal — AiSuggestRaceDialog
// =============================================================================
// Wizard "Crear carrera con IA" para usuarios logueados. Replica el flujo del
// admin /admin/races/from-url pero expuesto al público: pega URL → la IA
// extrae → usuario revisa/edita → envía borrador.
//
// El borrador queda como `race` con isPublished=false + scraperAdapter=
// "user-suggested". El admin lo revisa en /admin/race-suggestions (filtro
// "Borradores IA") y publica en 1 click.
//
// Diferencia con SuggestRaceDialog (legacy): este muestra la extracción en
// vivo y crea un borrador editable. El otro solo manda una URL y el admin hace
// todo el trabajo a mano.
// =============================================================================

import { useState, type FormEvent, useEffect, useTransition } from "react";
import { useMutation } from "convex/react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { PROVINCE_LIST } from "@/lib/utils";
import { isMockMode } from "@/lib/mock/provider";
import { extractFromUrl, type ExtractResult } from "@/lib/ai/extract-from-url-action";
import {
  Wand2,
  Loader2,
  Check,
  AlertCircle,
  X,
  Sparkles,
  ExternalLink,
  Link as LinkIcon,
  Save,
} from "lucide-react";

type Step = "url" | "extracting" | "preview" | "submitting" | "success" | "error";

// Forma del form editable (subset de ExtractedRace + los campos validados que
// la mutation espera). Todos los opcionales son "" si vacíos para que el form
// los maneje como string vacío, y la mutation los convierte a undefined.
type FormState = {
  name: string;
  province: string; // "" = sin seleccionar (será obligatorio en preview)
  distanceKm: string;
  elevationGainM: string;
  startDate: string;
  locality: string;
  organizer: string;
  description: string;
  officialUrl: string;
  registrationUrl: string;
  raceType: "road" | "trail" | "mixed" | "obstacle";
};

const RACE_TYPES: { value: FormState["raceType"]; label: string }[] = [
  { value: "road", label: "Asfalto" },
  { value: "trail", label: "Trail" },
  { value: "mixed", label: "Mixta" },
  { value: "obstacle", label: "Obstáculos" },
];

const EMPTY_FORM: FormState = {
  name: "",
  province: "",
  distanceKm: "",
  elevationGainM: "",
  startDate: "",
  locality: "",
  organizer: "",
  description: "",
  officialUrl: "",
  registrationUrl: "",
  raceType: "road",
};

export function AiSuggestRaceDialog({
  triggerLabel = "✨ Crear con IA",
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
        className={`inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-runner-primary hover:opacity-90 px-3 py-1.5 rounded-md ${triggerClassName}`}
      >
        <Wand2 className="h-4 w-4" aria-hidden="true" />
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
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-suggest-title"
          >
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-runner-primary" aria-hidden="true" />
                <h2 id="ai-suggest-title" className="text-lg font-bold text-runner-dark">
                  Crear carrera con IA
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
                  Para crear una carrera necesitas tener cuenta en mi-dorsal. Así
                  sabemos quién la pidió y te avisamos cuando la publiquemos.
                </p>
                <SignInButton mode="modal">
                  <button className="inline-flex items-center gap-2 bg-runner-primary text-white px-5 py-2 rounded-md font-semibold hover:opacity-90">
                    Entrar o crear cuenta
                  </button>
                </SignInButton>
              </div>
            </SignedOut>

            <SignedIn>
              <AiSuggestRaceForm onSuccess={() => setOpen(false)} />
            </SignedIn>
          </div>
        </div>
      )}
    </>
  );
}

function AiSuggestRaceForm({ onSuccess }: { onSuccess: () => void }) {
  const submitDraft = useMutation(api.raceSuggestions.submitWithAiExtraction);
  const [step, setStep] = useState<Step>("url");
  const [url, setUrl] = useState("");
  const [extractedUrl, setExtractedUrl] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errorMsg, setErrorMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  // Escape cierra
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && step !== "extracting" && step !== "submitting") {
        onSuccess();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onSuccess, step]);

  const handleExtract = () => {
    setErrorMsg("");
    setStep("extracting");
    startTransition(async () => {
      const res: ExtractResult = await extractFromUrl(url);
      if ("error" in res) {
        setErrorMsg(res.error);
        setStep("url");
        return;
      }
      setExtractedUrl(res.url);
      // Pre-rellenar el form con lo que devolvió la IA
      const d = res.data;
      setForm({
        name: d.name ?? "",
        province: d.province ?? "",
        distanceKm: d.distanceKm ? String(d.distanceKm) : "",
        elevationGainM: d.elevationGainM ? String(d.elevationGainM) : "",
        startDate: d.startDate ?? "",
        locality: d.locality ?? "",
        organizer: d.organizer ?? "",
        description: d.description ?? "",
        officialUrl: d.officialUrl ?? res.url,
        registrationUrl: d.registrationUrl ?? "",
        raceType: (d.raceType as FormState["raceType"]) ?? "road",
      });
      setStep("preview");
    });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    // Validación mínima antes de enviar (la mutation también valida)
    if (!form.name.trim() || form.name.trim().length < 3) {
      setErrorMsg("El nombre es obligatorio (mín. 3 caracteres)");
      return;
    }
    if (!form.province) {
      setErrorMsg("Selecciona la provincia");
      return;
    }
    const distance = Number(form.distanceKm);
    if (!distance || distance <= 0) {
      setErrorMsg("La distancia es obligatoria y debe ser > 0");
      return;
    }

    setStep("submitting");
    submitDraft({
      url: extractedUrl,
      name: form.name.trim(),
      province: form.province as any,
      raceType: form.raceType,
      distanceKm: distance,
      elevationGainM: form.elevationGainM ? Number(form.elevationGainM) : undefined,
      startDate: form.startDate || undefined,
      locality: form.locality.trim() || undefined,
      organizer: form.organizer.trim() || undefined,
      description: form.description.trim() || undefined,
      officialUrl: form.officialUrl.trim() || undefined,
      registrationUrl: form.registrationUrl.trim() || undefined,
    })
      .then(() => {
        setStep("success");
        setTimeout(onSuccess, 2800);
      })
      .catch((err: unknown) => {
        setErrorMsg(err instanceof Error ? err.message : "Error al enviar el borrador");
        setStep("preview");
      });
  };

  // ===== PASO 1: pedir URL =====
  if (step === "url") {
    return (
      <div className="p-5 space-y-4">
        <div className="bg-gradient-to-br from-runner-primary/10 to-purple-50 border border-runner-primary/20 rounded-lg p-4">
          <p className="text-sm text-gray-700">
            <Sparkles className="inline h-4 w-4 text-runner-primary mr-1" aria-hidden="true" />
            <strong>Cómo funciona:</strong> pegas la URL de la web oficial → la IA
            extrae nombre, fecha, distancia y demás datos → tú revisas y envías
            un <strong>borrador</strong>. Manu lo verifica y lo publica en el
            catálogo (suele tardar menos de 24h).
          </p>
        </div>

        <div>
          <label htmlFor="ai-url" className="block text-sm font-semibold text-gray-700 mb-1">
            <LinkIcon className="inline h-3.5 w-3.5 mr-0.5" aria-hidden="true" /> URL de la carrera
            <span className="text-runner-primary"> *</span>
          </label>
          <input
            id="ai-url"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.organizador.com/carrera-2026"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
          />
          <p className="text-xs text-gray-500 mt-1">
            Mejor la web del organizador que la de un cronometrador: tiene más info estructurada.
          </p>
        </div>

        {errorMsg && (
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
            type="button"
            onClick={handleExtract}
            disabled={isPending || !url.trim()}
            className="inline-flex items-center gap-2 bg-runner-primary text-white px-4 py-2 rounded-md font-semibold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Wand2 className="h-4 w-4" />
            Extraer con IA
          </button>
        </div>
      </div>
    );
  }

  // ===== PASO 2: extrayendo =====
  if (step === "extracting") {
    return (
      <div className="p-10 text-center">
        <Loader2 className="h-10 w-10 animate-spin mx-auto text-runner-primary mb-3" />
        <p className="text-sm font-semibold text-gray-700">Extrayendo datos con IA…</p>
        <p className="text-xs text-gray-500 mt-1">
          Leyendo <span className="font-mono break-all">{extractedUrl || url}</span>
        </p>
        <p className="text-xs text-gray-400 mt-3">~2-3 segundos</p>
      </div>
    );
  }

  // ===== PASO 3: éxito =====
  if (step === "success") {
    return (
      <div className="p-6 text-center">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-3">
          <Check className="h-6 w-6 text-green-600" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-bold text-runner-dark mb-1">¡Borrador enviado!</h3>
        <p className="text-sm text-gray-600 mb-3">
          Manu ha recibido tu borrador con la información extraída. Lo revisa y, si
          todo está bien, lo publica en el catálogo.
        </p>
        <p className="text-xs text-gray-500">
          Si quieres ver el estado, mira en{" "}
          <a href="/perfil" className="underline font-semibold">tu perfil</a> o
          en <a href="/carreras" className="underline font-semibold">el catálogo</a>.
        </p>
      </div>
    );
  }

  // ===== PASO 4: form editable (preview) | submitting =====
  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-4">
      <div className="bg-purple-50 border border-purple-200 rounded-md p-3 text-sm text-purple-900">
        <p>
          <strong>Revisa y corrige</strong> lo que la IA haya podido despistar. Lo que
          dejes en blanco lo rellenaremos nosotros.
        </p>
        {extractedUrl && (
          <p className="text-xs mt-1">
            <ExternalLink className="inline h-3 w-3 mr-0.5" />
            <a href={extractedUrl} target="_blank" rel="noopener noreferrer" className="underline break-all">
              {extractedUrl}
            </a>
          </p>
        )}
      </div>

      <div>
        <label htmlFor="ai-name" className="block text-sm font-semibold text-gray-700 mb-1">
          Nombre <span className="text-runner-primary">*</span>
        </label>
        <input
          id="ai-name"
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="ai-prov" className="block text-xs font-semibold text-gray-700 mb-1">
            Provincia <span className="text-runner-primary">*</span>
          </label>
          <select
            id="ai-prov"
            value={form.province}
            onChange={(e) => setForm({ ...form, province: e.target.value })}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
          >
            <option value="">— selecciona —</option>
            {PROVINCE_LIST.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ai-locality" className="block text-xs font-semibold text-gray-700 mb-1">
            Localidad
          </label>
          <input
            id="ai-locality"
            type="text"
            value={form.locality}
            onChange={(e) => setForm({ ...form, locality: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label htmlFor="ai-dist" className="block text-xs font-semibold text-gray-700 mb-1">
            Distancia (km) <span className="text-runner-primary">*</span>
          </label>
          <input
            id="ai-dist"
            type="number"
            step="0.1"
            min="0.1"
            required
            value={form.distanceKm}
            onChange={(e) => setForm({ ...form, distanceKm: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
          />
        </div>
        <div>
          <label htmlFor="ai-elev" className="block text-xs font-semibold text-gray-700 mb-1">
            Desnivel (m)
          </label>
          <input
            id="ai-elev"
            type="number"
            min="0"
            value={form.elevationGainM}
            onChange={(e) => setForm({ ...form, elevationGainM: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
          />
        </div>
        <div>
          <label htmlFor="ai-type" className="block text-xs font-semibold text-gray-700 mb-1">
            Tipo
          </label>
          <select
            id="ai-type"
            value={form.raceType}
            onChange={(e) => setForm({ ...form, raceType: e.target.value as FormState["raceType"] })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
          >
            {RACE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ai-date" className="block text-xs font-semibold text-gray-700 mb-1">
            Fecha
          </label>
          <input
            id="ai-date"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
          />
        </div>
      </div>

      <div>
        <label htmlFor="ai-org" className="block text-xs font-semibold text-gray-700 mb-1">
          Organizador
        </label>
        <input
          id="ai-org"
          type="text"
          value={form.organizer}
          onChange={(e) => setForm({ ...form, organizer: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
        />
      </div>

      <div>
        <label htmlFor="ai-desc" className="block text-xs font-semibold text-gray-700 mb-1">
          Descripción
        </label>
        <textarea
          id="ai-desc"
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary resize-y"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="ai-official" className="block text-xs font-semibold text-gray-700 mb-1">
            Web oficial
          </label>
          <input
            id="ai-official"
            type="url"
            value={form.officialUrl}
            onChange={(e) => setForm({ ...form, officialUrl: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
          />
        </div>
        <div>
          <label htmlFor="ai-reg" className="block text-xs font-semibold text-gray-700 mb-1">
            URL inscripción
          </label>
          <input
            id="ai-reg"
            type="url"
            value={form.registrationUrl}
            onChange={(e) => setForm({ ...form, registrationUrl: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
          />
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2 border-t">
        <button
          type="button"
          onClick={() => {
            setStep("url");
            setErrorMsg("");
          }}
          disabled={step === "submitting"}
          className="text-sm text-gray-500 hover:underline disabled:opacity-40"
        >
          ← Cambiar URL
        </button>
        <button
          type="submit"
          disabled={step === "submitting"}
          className="inline-flex items-center gap-2 bg-runner-primary text-white px-4 py-2 rounded-md font-semibold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {step === "submitting" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Enviando borrador…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Enviar borrador
            </>
          )}
        </button>
      </div>
    </form>
  );
}

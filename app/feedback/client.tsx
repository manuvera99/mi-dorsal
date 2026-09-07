// =============================================================================
// mi-dorsal — FeedbackForm (client component)
// =============================================================================
// Formulario que llama directamente a la mutation `api.feedback.submit`.
// Captura automáticamente el userId si el usuario está logueado y la URL
// de la página actual (window.location.href) para ayudar a reproducir bugs.
// =============================================================================

"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import {
  Bug,
  Lightbulb,
  MessageSquare,
  Loader2,
  Check,
  AlertCircle,
  Send,
} from "lucide-react";

type FeedbackType = "bug" | "idea" | "feedback";

const TYPES: { value: FeedbackType; label: string; emoji: string; Icon: typeof Bug; hint: string }[] = [
  {
    value: "bug",
    label: "Hay algo roto",
    emoji: "🐛",
    Icon: Bug,
    hint: "La página no carga, un botón no hace nada, ves algo raro…",
  },
  {
    value: "idea",
    label: "Se me ocurre una idea",
    emoji: "💡",
    Icon: Lightbulb,
    hint: "Una feature que te gustaría tener, un cambio que ayudaría…",
  },
  {
    value: "feedback",
    label: "Otro comentario",
    emoji: "💬",
    Icon: MessageSquare,
    hint: "Lo que te apetezca decirnos. Te leemos.",
  },
];

export function FeedbackForm() {
  const useMock = isMockMode();
  const userResult = useMock ? null : useUser();
  const isSignedIn = userResult?.isSignedIn ?? false;
  const userEmail = userResult?.user?.emailAddresses?.[0]?.emailAddress ?? null;

  const myProfile = useMock ? null : useQuery(api.users.getMyProfile);
  const isAdmin = myProfile?.role === "admin";

  const submit = useMock ? null : useMutation(api.feedback.submit);

  const [type, setType] = useState<FeedbackType>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const canSubmit =
    title.trim().length >= 4 &&
    description.trim().length >= 10 &&
    status !== "submitting" &&
    !!submit;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !submit) return;
    setStatus("submitting");
    setErrorMsg("");

    try {
      await submit({
        type,
        title: title.trim(),
        description: description.trim(),
        pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        contactEmail: !isSignedIn && contactEmail.trim() ? contactEmail.trim() : undefined,
      });
      setStatus("success");
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Error al enviar. Inténtalo de nuevo.");
    }
  }

  if (useMock) {
    return (
      <div className="bg-runner-warm border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center text-gray-500">
        Modo mock — el formulario de feedback necesita Convex configurado.
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-3">
          <Check className="h-6 w-6 text-green-600" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-green-900 mb-2">¡Recibido! Gracias 🙏</h2>
        <p className="text-green-800 text-sm mb-4">
          Tu mensaje ha llegado al panel del admin. Si es un bug, intentamos reproducirlo
          y arreglarlo lo antes posible.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setTitle("");
            setDescription("");
            setContactEmail("");
          }}
          className="text-sm text-green-700 hover:text-green-900 font-semibold underline"
        >
          Enviar otro
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="bg-white border rounded-2xl p-6 md:p-8 space-y-5 shadow-sm">
      {/* Tipo */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">¿Qué quieres contarnos?</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {TYPES.map((t) => {
            const Icon = t.Icon;
            const active = type === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                aria-pressed={active}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-md border-2 text-left text-sm transition-colors ${
                  active
                    ? "border-runner-primary bg-runner-primary/5 text-runner-dark"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${active ? "text-runner-primary" : "text-gray-500"}`} aria-hidden="true" />
                <span className="font-semibold">{t.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 mt-2">{TYPES.find((t) => t.value === type)?.hint}</p>
      </div>

      {/* Título */}
      <div>
        <label htmlFor="fb-title" className="block text-sm font-semibold text-gray-700 mb-1">
          Título <span className="text-runner-primary">*</span>
        </label>
        <input
          id="fb-title"
          type="text"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            type === "bug"
              ? "La página de /carreras no carga en Safari"
              : type === "idea"
              ? "Poder filtrar carreras por fecha de inscripción"
              : "Me encanta la app, pero…"
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
        />
        <p className="text-xs text-gray-400 mt-1">{title.length}/200</p>
      </div>

      {/* Descripción */}
      <div>
        <label htmlFor="fb-description" className="block text-sm font-semibold text-gray-700 mb-1">
          Cuéntanos más <span className="text-runner-primary">*</span>
        </label>
        <textarea
          id="fb-description"
          required
          rows={6}
          maxLength={5000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            type === "bug"
              ? "Pasos para reproducir: 1) … 2) … Qué esperabas: … Qué pasó: …"
              : type === "idea"
              ? "Qué te gustaría poder hacer. Por qué te ayudaría."
              : "Lo que te apetezca."
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary resize-y"
        />
        <p className="text-xs text-gray-400 mt-1">{description.length}/5000</p>
      </div>

      {/* Email de contacto (solo si no está logueado) */}
      {!isSignedIn && (
        <div>
          <label htmlFor="fb-email" className="block text-sm font-semibold text-gray-700 mb-1">
            Tu email <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            id="fb-email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="Para que podamos responderte si necesitamos más datos"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
          />
          <p className="text-xs text-gray-500 mt-1">
            Solo lo usamos para responderte. Nunca te suscribimos a la newsletter sin
            que lo pidas.
          </p>
        </div>
      )}

      {isSignedIn && userEmail && (
        <p className="text-xs text-gray-500 bg-runner-warm rounded-md p-2">
          Lo enviaremos asociado a tu cuenta <strong>{userEmail}</strong>. Si prefieres
          otro email, <a href="/perfil" className="underline">cámbialo en tu perfil</a>.
        </p>
      )}

      {/* Submit */}
      {status === "error" && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full inline-flex items-center justify-center gap-2 bg-runner-primary text-white px-5 py-3 rounded-md font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        {status === "submitting" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
          </>
        ) : (
          <>
            <Send className="h-4 w-4" /> Enviar feedback
          </>
        )}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Al enviar aceptas que revisemos tu mensaje para mejorar mi-dorsal. No lo usamos
        para marketing ni lo compartimos con terceros.{" "}
        <a href="/legal/privacidad" className="underline" target="_blank" rel="noopener">
          Política de privacidad
        </a>
        .
      </p>
    </form>
  );
}

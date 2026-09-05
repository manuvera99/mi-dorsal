// =============================================================================
// mi-dorsal — NewsletterForm (formulario de suscripción al blog)
// =============================================================================
// Form público que se incrusta en /newsletter, footer del blog y secciones
// "apúntate a la newsletter". Hace POST a /api/newsletter/subscribe y
// muestra feedback inline (éxito / pendiente de confirmar / error).
// =============================================================================

"use client";

import { useState, type FormEvent } from "react";
import { Mail, Loader2, Check, AlertCircle } from "lucide-react";

type Status = "idle" | "submitting" | "success" | "already" | "error";

export function NewsletterForm({
  source,
  variant = "default",
  className = "",
  placeholder = "tu@email.com",
  buttonText = "Apúntate a la newsletter",
}: {
  source: "blog" | "landing" | "footer";
  variant?: "default" | "inline" | "compact";
  className?: string;
  placeholder?: string;
  buttonText?: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("submitting");
    setMessage("");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Error al suscribirse. Inténtalo de nuevo.");
        return;
      }
      if (data.alreadyExisted && data.status === "active") {
        setStatus("already");
        setMessage("Ya estabas apuntado. Te tenemos en la lista. 🏃");
      } else {
        setStatus("success");
        setMessage(
          "¡Hecho! Te hemos enviado un email de confirmación. Haz click en el link para empezar a recibir la newsletter.",
        );
        setEmail("");
      }
    } catch (e) {
      setStatus("error");
      setMessage("Error de red. Inténtalo de nuevo.");
    }
  }

  if (variant === "compact") {
    return (
      <form onSubmit={onSubmit} className={`flex flex-col sm:flex-row gap-2 ${className}`}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
          disabled={status === "submitting"}
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="inline-flex items-center justify-center gap-2 bg-runner-primary text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {status === "submitting" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          Apúntate
        </button>
        {message && (
          <p
            className={`text-xs mt-1 sm:mt-0 sm:absolute sm:translate-y-full ${
              status === "error" ? "text-red-600" : "text-green-700"
            }`}
          >
            {message}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className={className}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-md text-base focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
            disabled={status === "submitting"}
          />
          <button
            type="submit"
            disabled={status === "submitting"}
            className="inline-flex items-center justify-center gap-2 bg-runner-primary text-white px-5 py-3 rounded-md font-semibold hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
          >
            {status === "submitting" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" /> {buttonText}
              </>
            )}
          </button>
        </div>

        {message && (
          <div
            className={`flex items-start gap-2 p-3 rounded-md text-sm ${
              status === "error"
                ? "bg-red-50 border border-red-200 text-red-800"
                : status === "already"
                ? "bg-blue-50 border border-blue-200 text-blue-800"
                : "bg-green-50 border border-green-200 text-green-800"
            }`}
            role="status"
          >
            {status === "error" ? (
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <Check className="h-4 w-4 mt-0.5 shrink-0" />
            )}
            <span>{message}</span>
          </div>
        )}

        <p className="text-xs text-gray-500">
          Sin spam. Solo historias y guías que merecen tu tiempo. Doble opt-in
          (confirmas con un click). Te das de baja con un click en cualquier
          email.{" "}
          <a href="/legal/privacidad" className="underline">
            Política de privacidad
          </a>
          .
        </p>
      </form>
    </div>
  );
}

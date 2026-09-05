// =============================================================================
// mi-dorsal — NewsletterForm (formulario de suscripción con single opt-in)
// =============================================================================
// Form público con checkbox de consentimiento RGPD. El botón de submit está
// deshabilitado hasta que el email es válido Y el checkbox está marcado.
// Hace POST a /api/newsletter/subscribe con consent=true y muestra feedback
// inline (éxito / ya suscrito / error).
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
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  const canSubmit = isValidEmail(email.trim()) && consent && status !== "submitting";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus("submitting");
    setMessage("");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source, consent: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Error al suscribirse. Inténtalo de nuevo.");
        return;
      }
      if (data.alreadyExisted && !data.reactivated) {
        setStatus("already");
        setMessage("Ya estabas apuntado. Te tenemos en la lista. 🏃");
      } else {
        setStatus("success");
        setMessage(
          "¡Bienvenido a la familia del dorsal! Te acabamos de enviar un email de bienvenida. Si no lo ves, mira en Promociones o Spam.",
        );
        setEmail("");
        setConsent(false);
      }
    } catch (e) {
      setStatus("error");
      setMessage("Error de red. Inténtalo de nuevo.");
    }
  }

  // Checkbox compartido entre variantes
  const consentCheckbox = (
    <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={consent}
        onChange={(e) => setConsent(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-runner-primary focus:ring-runner-primary/20 cursor-pointer shrink-0"
        required
      />
      <span>
        Acepto recibir emails de mi-dorsal. Puedo darme de baja con 1 click en cualquier email.{" "}
        <a href="/legal/privacidad" className="underline" target="_blank" rel="noopener">
          Política de privacidad
        </a>
        .
      </span>
    </label>
  );

  if (variant === "compact") {
    return (
      <form onSubmit={onSubmit} className={`flex flex-col gap-2 ${className}`}>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
            disabled={status === "submitting"}
          />
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center justify-center gap-2 bg-runner-primary text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === "submitting" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            Apúntate
          </button>
        </div>
        {consentCheckbox}
        {message && (
          <p
            className={`text-xs mt-1 ${
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
            className="flex-1 px-4 py-3 border border-gray-300 rounded-md text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary"
            disabled={status === "submitting"}
          />
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center justify-center gap-2 bg-runner-primary text-white px-5 py-3 rounded-md font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
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

        {consentCheckbox}

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
      </form>
    </div>
  );
}

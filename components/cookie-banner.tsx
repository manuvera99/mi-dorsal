"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";

const COOKIE_CONSENT_KEY = "mi-dorsal-cookie-consent";

type Consent = "accepted" | "rejected" | null;

// Tipo para gtag de Google
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export function CookieBanner() {
  const [consent, setConsent] = useState<Consent>(null);
  const [showBanner, setShowBanner] = useState(false);

  // Lee el consentimiento almacenado al montar
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(COOKIE_CONSENT_KEY) as Consent;
    if (stored === "accepted" || stored === "rejected") {
      setConsent(stored);
      setShowBanner(false);
    } else {
      // Pequeño delay para que no aparezca en el primer paint
      const t = setTimeout(() => setShowBanner(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  // Aplica/quita scripts según consentimiento
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (consent === "accepted") {
      // Habilita cookies analíticas y de marketing
      window.gtag?.("consent", "update", {
        analytics_storage: "granted",
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
      });
    } else if (consent === "rejected") {
      // Solo cookies técnicas
      window.gtag?.("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
    }
  }, [consent]);

  const handleAccept = () => {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setConsent("accepted");
    setShowBanner(false);
  };

  const handleReject = () => {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, "rejected");
    setConsent("rejected");
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de cookies"
      className="fixed bottom-4 left-4 right-4 md:left-6 md:right-auto md:max-w-md z-50 animate-fade-in"
    >
      <div className="bg-white border border-gray-200 rounded-lg shadow-2xl p-4 md:p-5">
        <div className="flex items-start gap-3">
          <Cookie className="h-5 w-5 text-runner-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1">Usamos cookies</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Usamos cookies técnicas para que la web funcione y, si nos das tu consentimiento,
              también cookies analíticas (Google Analytics) y de marketing (Google AdSense) para
              entender cómo usas la web y mostrarte anuncios relevantes.{" "}
              <Link href="/legal/cookies" className="text-runner-primary hover:underline">
                Más info
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={handleReject}
            aria-label="Cerrar"
            className="text-gray-400 hover:text-gray-600 -mt-1 -mr-1 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={handleReject}
            className="flex-1 text-xs font-medium px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="flex-1 text-xs font-semibold px-3 py-2 bg-runner-primary text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Aceptar todas
          </button>
        </div>
      </div>
    </div>
  );
}

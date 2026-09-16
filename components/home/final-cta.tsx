"use client";

/**
 * FinalCTA — el último empujón antes de que el visitante se vaya (v3.1).
 *
 * Cambio respecto a v3.0:
 *  - Se elimina el lede largo y el segundo CTA "Solo quiero curiosear
 *    carreras". Solo queda: H2 + un botón primario "Empieza gratis".
 *  - Se mantiene la lógica de useUser para ocultar el bloque si el
 *    visitante ya tiene cuenta (igual que v3.0).
 *  - Se mantiene el fondo rojo de v3.0 (la home ya tiene hero rojo;
 *    cerrar con el mismo color refuerza la marca).
 */

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { isMockMode } from "@/lib/mock/provider";

export function FinalCta() {
  // Mock mode: no hay ClerkProvider real montado, useUser crashearía.
  if (isMockMode()) return <FinalCtaSection />;
  return <RealFinalCta />;
}

function RealFinalCta() {
  const { isLoaded, isSignedIn } = useUser();
  // Mientras carga, no mostramos nada — evita el parpadeo para usuarios
  // logueados.
  if (!isLoaded || isSignedIn) return null;
  return <FinalCtaSection />;
}

function FinalCtaSection() {
  return (
    <section
      className="text-center"
      aria-labelledby="final-cta-title"
      style={{
        background:
          "radial-gradient(800px 400px at 50% 50%, rgba(220, 38, 38, 0.08), transparent 60%), #fafaf9",
        padding: "5rem 1.25rem",
      }}
    >
      <div className="max-w-2xl mx-auto">
        <h2
          id="final-cta-title"
          className="mb-8"
          style={{
            fontFamily: "var(--font-display, 'Sora', system-ui)",
            fontWeight: 700,
            fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
            color: "#0a0a0a",
            letterSpacing: "-0.02em",
            lineHeight: 1.12,
            margin: 0,
          }}
        >
          Tu próxima línea de salida empieza aquí.
        </h2>

        <Link
          href="/sign-up"
          className="inline-flex items-center gap-2 font-semibold transition-colors"
          style={{
            background: "#dc2626",
            color: "#fff",
            padding: "1rem 2rem",
            borderRadius: "9999px",
            fontSize: "1rem",
          }}
        >
          Empieza gratis
        </Link>
      </div>
    </section>
  );
}
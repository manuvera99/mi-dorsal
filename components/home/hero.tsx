"use client";

/**
 * Hero de la home — v3.2 (restyling + minimal, fondo rojo estilo Pro).
 *
 * Cambios frente a v3.1:
 *  - Se elimina el DorsalVisual de la columna lateral. El hero queda solo
 *    con texto (H1 + lede + CTAs + micro-quiet), full-width dentro del
 *    wrapper. El usuario ya ve dorsales reales en la sección DiplomaPreview
 *    justo debajo (en el diploma y el sticker), no hace falta uno mas en
 *    el hero. Resultado: hero mas limpio, mejor escaneabilidad del H1.
 *
 * Cambios acumulados desde v3.0:
 *  - Fondo rojo asfalto (linear-gradient) en lugar del crema plano.
 *  - Eliminados los 4 trust badges (CreditCard, Lock, ShieldCheck, Sparkles).
 *    La info "Free completo / Pro 14 días" se mantiene como micro-quiet de
 *    una sola línea bajo los CTAs.
 *  - CTAs: primario blanco con texto rojo, secundario (Empieza gratis) en
 *    ghost con borde blanco translúcido.
 *
 * Se preserva: ProBadgeIsland (lanzamiento Pro), RegionSwitcher flotante,
 * accesibilidad (aria-labelledby).
 */

import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  MapPin,
} from "lucide-react";
import { RegionSwitcher } from "@/components/region-switcher";
import { ProBadgeIsland } from "./client-only-islands";

export function Hero() {
  return (
    <section
      className="relative overflow-hidden rounded-3xl text-white"
      aria-labelledby="hero-title"
      style={{
        background:
          "linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #9f1239 100%)",
      }}
    >
      {/* Halos decorativos: dan textura sin añadir ruido visual */}
      <div
        aria-hidden="true"
        className="absolute -right-20 -top-20 h-96 w-96 rounded-full blur-3xl"
        style={{ background: "rgba(255,255,255,0.18)" }}
      />
      <div
        aria-hidden="true"
        className="absolute -left-20 -bottom-20 h-72 w-72 rounded-full blur-3xl"
        style={{ background: "rgba(127,29,29,0.5)" }}
      />

      {/* Region switcher flotante */}
      <div className="absolute top-4 right-4 md:top-6 md:right-6 z-10">
        <RegionSwitcher variant="hero" />
      </div>

      <div className="relative px-6 py-16 md:px-12 md:py-20">
        {/* Single column, full width dentro del wrapper */}
        <div className="max-w-2xl">
          {/* Badge Pro: refleja el lanzamiento real del plan de pago.
              Se oculta si el usuario ya es Pro (ver ProBadgeIsland). */}
          <ProBadgeIsland />

          <h1
            id="hero-title"
            className="font-bold tracking-tight leading-[1.05] mb-5"
            style={{
              fontFamily: "var(--font-display, 'Sora', system-ui)",
              fontSize: "clamp(2.5rem, 6vw, 3.5rem)",
              letterSpacing: "-0.025em",
            }}
          >
            Tu dorsal,
            <br />
            <span style={{ textDecoration: "underline", textDecorationColor: "rgba(255,255,255,0.45)", textUnderlineOffset: "8px", textDecorationThickness: "2px" }}>
              de principio a fin.
            </span>
          </h1>

          <p className="text-lg md:text-xl mb-4 leading-relaxed" style={{ color: "rgba(255,255,255,0.92)" }}>
            Apúntate a las carreras que te motivan y, al cruzar la meta, recibe
            tu resultado oficial con diploma PDF directamente en tu buzón.
          </p>

          {/* Micro-bloque: features Pro (fotos) integrado en el hero */}
          <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.85)" }}>
            Te avisamos cuando salen las fotos y te encontramos con un selfie
            <span style={{ color: "rgba(255,255,255,0.6)" }}> · Pro</span>
          </p>

          <div className="flex flex-wrap gap-3 mb-5">
            <Link
              href="/carreras"
              className="inline-flex items-center gap-2 font-semibold px-5 py-3 rounded-full transition-colors shadow-sm"
              style={{ background: "#fff", color: "#dc2626" }}
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Ver carreras
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href="#"
              className="inline-flex items-center gap-2 font-semibold px-5 py-3 rounded-full transition-colors"
              style={{
                background: "transparent",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.4)",
              }}
            >
              Empieza gratis
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>

          {/* Micro-quiet: una sola línea, sin saturar */}
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
            <span style={{ color: "#fff", fontWeight: 600 }}>47 corredores</span>{" "}
            ya lo usan
          </p>
        </div>
      </div>
    </section>
  );
}
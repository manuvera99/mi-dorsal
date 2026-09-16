"use client";

/**
 * Hero de la home — v3.1 (restyling + minimal, fondo rojo estilo Pro).
 *
 * Cambios frente a v3.0:
 *  - Fondo rojo asfalto (linear-gradient) en lugar del crema plano.
 *  - Dorsal card minimal: solo "Dorsal / número / tiempo / PR".
 *    Se elimina la cabecera con carrera+fecha y el footer rojo del card.
 *  - Se eliminan los 4 trust badges (CreditCard, Lock, ShieldCheck, Sparkles)
 *    para reducir densidad visual. La info de "Free completo / Pro 14 días"
 *    se mantiene como micro-quiet de una sola línea bajo los CTAs.
 *  - CTAs: primario blanco con texto rojo, secundario (Empieza gratis) en
 *    ghost con borde blanco translúcido.
 *
 * Se preserva: ProBadgeIsland (lanzamiento Pro), RegionSwitcher flotante,
 * accesibilidad (aria-labelledby, role/aria-label en la dorsal).
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

      <div className="relative grid md:grid-cols-5 gap-8 md:gap-10 px-6 py-16 md:px-12 md:py-20">
        {/* COLUMNA TEXTO (60% en desktop) */}
        <div className="md:col-span-3 max-w-2xl">
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

          <p className="text-lg md:text-xl mb-8 leading-relaxed" style={{ color: "rgba(255,255,255,0.92)" }}>
            Apúntate a las carreras que te motivan y, al cruzar la meta, recibe
            tu resultado oficial con diploma PDF directamente en tu buzón.
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
            ya lo usan · sin tarjeta
          </p>
        </div>

        {/* COLUMNA VISUAL (40% en desktop) — dorsal card blanco minimal */}
        <div className="md:col-span-2 flex items-center justify-center md:justify-end">
          <DorsalVisual />
        </div>
      </div>
    </section>
  );
}

/**
 * DorsalVisual minimal — réplica del prototipo.
 * Solo muestra lo esencial: etiqueta "Dorsal", número grande, separador,
 * tiempo oficial y badge "Nuevo PR". Sin cabecera con carrera ni footer rojo.
 */
function DorsalVisual() {
  return (
    <div
      className="relative w-full max-w-sm aspect-[3/4] animate-fade-in"
      role="img"
      aria-label="Dorsal de ejemplo con el número 4213 y tiempo oficial 01:26:14, nuevo PR"
    >
      {/* Sombra cálida */}
      <div
        aria-hidden="true"
        className="absolute inset-0 translate-x-3 translate-y-3 rounded-2xl blur-xl"
        style={{ background: "rgba(0,0,0,0.30)" }}
      />

      {/* El dorsal: blanco limpio, sobre el rojo del hero */}
      <div
        className="relative h-full w-full rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "#ffffff",
          color: "#0a0a0a",
          boxShadow: "0 18px 40px -12px rgba(0,0,0,0.20)",
        }}
      >
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: "#525252" }}
          >
            Dorsal
          </p>
          <p
            className="font-extrabold tracking-tighter leading-none mb-6"
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: "clamp(4rem, 8vw, 5rem)",
              letterSpacing: "-0.04em",
            }}
          >
            4213
          </p>

          <div className="w-full pt-5 border-t" style={{ borderColor: "rgba(10,10,10,0.08)" }}>
            <p
              className="font-bold mb-2"
              style={{
                fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                fontSize: "1.75rem",
                letterSpacing: "-0.02em",
              }}
            >
              01:26:14
            </p>
            <span
              className="inline-flex items-center text-xs font-semibold"
              style={{ color: "#16a34a" }}
            >
              Nuevo PR
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
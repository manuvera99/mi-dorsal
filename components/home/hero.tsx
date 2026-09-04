"use client";

/**
 * Hero de la home.
 *
 * Layout: split en desktop (60% texto / 40% visual), full-width en móvil.
 *
 * Estructura:
 *  - Pre-título (eyebrow) con icono de ubicación
 *  - H1 (la frase que se recuerda)
 *  - Subtítulo (promesa)
 *  - Sub-subtítulo (diferenciador, "sin smartwatch")
 *  - Trust badges (gratis, sin tarjeta, RGPD)
 *  - CTAs primario + secundario
 *  - Lado derecho: simulación 3D de dorsal (versión estática, sin JS)
 *
 * El RegionSwitcher aparece como pill flotante en la esquina superior derecha.
 */

import Link from "next/link";
import { ArrowRight, ChevronDown, MapPin, Sparkles, ShieldCheck, CreditCard, Lock } from "lucide-react";
import { RegionSwitcher } from "@/components/region-switcher";

export function Hero() {
  return (
    <section
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-runner-primary via-red-600 to-rose-700 text-white"
      aria-labelledby="hero-title"
    >
      {/* Decoración: línea de meta diagonal en el fondo */}
      <div
        aria-hidden="true"
        className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-white/5 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-rose-900/30 blur-3xl"
      />

      {/* Region switcher flotante */}
      <div className="absolute top-4 right-4 md:top-6 md:right-6 z-10">
        <RegionSwitcher variant="hero" />
      </div>

      <div className="relative grid md:grid-cols-5 gap-8 md:gap-10 px-6 py-16 md:px-12 md:py-20">
        {/* COLUMNA TEXTO (60% en desktop) */}
        <div className="md:col-span-3 max-w-2xl">
          <p className="inline-flex items-center gap-2 text-sm font-medium bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 mb-5">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Para corredores populares de toda España
          </p>

          <h1
            id="hero-title"
            className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] mb-4"
          >
            Tu dorsal,
            <br />
            de principio a fin.
          </h1>

          <p className="text-lg md:text-xl text-red-50 mb-3 leading-relaxed">
            Apúntate a las carreras que te motivan, predice tu tiempo y recibe el resultado oficial
            con diploma PDF directamente en tu buzón.
          </p>

          <p className="text-sm md:text-base text-red-100/90 mb-7 font-medium">
            Sin pulseras, sin GPS, sin conectar tu smartwatch.
            <br className="hidden sm:block" />
            Solo tú, tu dorsal y la línea de meta. 🏁
          </p>

          <div className="flex flex-wrap gap-3 mb-6">
            <Link
              href="/carreras"
              className="inline-flex items-center gap-2 bg-white text-runner-primary font-semibold px-5 py-3 rounded-md hover:bg-red-50 transition-colors shadow-sm"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Ver carreras cerca de mí
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white font-semibold px-5 py-3 rounded-md hover:bg-white/20 transition-colors border border-white/20"
            >
              ¿Cómo funciona?
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>

          {/* Trust badges */}
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-red-50/90">
            <li className="inline-flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Gratis · sin tarjeta</span>
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tus datos en la UE</span>
            </li>
            <li className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Cumplimos RGPD</span>
            </li>
          </ul>
        </div>

        {/* COLUMNA VISUAL (40% en desktop) — dorsal estilizado */}
        <div className="md:col-span-2 flex items-center justify-center md:justify-end">
          <DorsalVisual />
        </div>
      </div>
    </section>
  );
}

/**
 * DorsalVisual — representación CSS/SVG de un dorsal real.
 * No usa JS, es 100% declarativo. Animación sutil de "respiración".
 */
function DorsalVisual() {
  return (
    <div
      className="relative w-full max-w-sm aspect-[3/4] animate-fade-in"
      role="img"
      aria-label="Dorsal de ejemplo con el número 4213 y tiempo 01:26:14"
    >
      {/* Sombra */}
      <div
        aria-hidden="true"
        className="absolute inset-0 translate-x-3 translate-y-3 rounded-2xl bg-black/30 blur-xl"
      />

      {/* El dorsal (blanco sobre fondo rojo) */}
      <div className="relative h-full w-full rounded-2xl bg-white text-runner-dark shadow-2xl overflow-hidden flex flex-col">
        {/* Header con nombre popular */}
        <div className="bg-runner-warm px-4 py-3 border-b border-gray-200">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
            Carrera
          </p>
          <p className="text-sm font-bold leading-tight">Behobia-San Sebastián</p>
          <p className="text-[11px] text-gray-500">12 nov 2026 · 17:00h</p>
        </div>

        {/* Centro: dorsal number gigante */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-2">
            Dorsal
          </p>
          <p className="font-mono text-6xl md:text-7xl font-bold tracking-tighter text-runner-primary">
            4213
          </p>

          <div className="mt-4 pt-4 border-t border-dashed border-gray-300 w-full text-center">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-1">
              Tiempo oficial
            </p>
            <p className="font-mono text-2xl font-bold text-runner-dark">01:26:14</p>
            <p className="text-[10px] text-green-600 font-semibold mt-1">🎉 Nuevo PR</p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-runner-primary text-white px-4 py-2 text-center">
          <p className="text-[10px] font-semibold tracking-wider uppercase">mi-dorsal</p>
        </div>
      </div>

      {/* Alfiler arriba (decoración) */}
      <div
        aria-hidden="true"
        className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-gray-300 border-2 border-white shadow"
      />
    </div>
  );
}

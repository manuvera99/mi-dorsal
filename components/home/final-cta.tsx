"use client";

/**
 * FinalCTA — el último empujón antes de que el visitante se vaya.
 *
 * Bloque grande con fondo runner-primary, texto blanco. Una sola frase,
 * un solo botón. El segundo CTA es discreto para los que no están listos.
 *
 * Es un CTA de REGISTRO ("Empieza gratis" → /sign-up), no de upgrade a
 * Pro — no tiene sentido para NINGÚN usuario ya logueado (free o
 * premium), ya tiene cuenta. Se oculta entera si hay sesión activa (bug
 * reportado sesión 10 sep 2026, tras corregir los upsells de Pro del
 * hero y el teaser de precios — este bloque tenía el mismo problema
 * pero por un motivo distinto: nunca comprobó sesión, ni de premium ni
 * de free).
 *
 * Ya se monta vía FinalCtaLazy (dynamic ssr:false, ver lazy-sections.tsx),
 * así que useUser() es seguro aquí sin necesitar un island propio — el
 * ISR de la home nunca intenta prerenderizar este componente server-side.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { isMockMode } from "@/lib/mock/provider";

export function FinalCta() {
  // Mock mode: no hay ClerkProvider real montado, useUser crashearía.
  // Sin sesión real que detectar, se muestra siempre (comportamiento
  // anterior sin cambios en mock).
  if (isMockMode()) return <FinalCtaSection />;
  return <RealFinalCta />;
}

function RealFinalCta() {
  const { isLoaded, isSignedIn } = useUser();
  // Mientras carga, no mostramos nada — evita el parpadeo de "aparece
  // y luego desaparece" para usuarios logueados.
  if (!isLoaded || isSignedIn) return null;
  return <FinalCtaSection />;
}

function FinalCtaSection() {
  return (
    <section
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-runner-primary via-red-600 to-rose-700 text-white px-6 py-12 md:px-12 md:py-16 text-center"
      aria-labelledby="final-cta-title"
    >
      <div
        aria-hidden="true"
        className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-rose-900/30 blur-3xl"
      />

      <div className="relative max-w-2xl mx-auto">
        <p className="text-base md:text-lg text-red-50/90 mb-3">🏁</p>
        <h2
          id="final-cta-title"
          className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-4"
        >
          Tu temporada empieza con un dorsal.
        </h2>
        <p className="text-base md:text-lg text-red-50/90 mb-3 max-w-xl mx-auto">
          Únete a los primeros corredores que ya planifican su año con mi-dorsal. Sin pagar, sin
          trampa, sin excusas.
        </p>
        <p className="text-sm md:text-base text-yellow-100/95 mb-8 max-w-xl mx-auto font-semibold">
          Cuando cruces tu próxima meta, te esperamos en tu buzón con el diploma PDF y la imagen
          para tus redes. 📬
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-white text-runner-primary font-semibold px-6 py-3 rounded-md hover:bg-red-50 transition-colors shadow-lg"
          >
            Empieza gratis
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/carreras"
            className="text-sm font-medium text-white/90 hover:text-white underline underline-offset-4"
          >
            Solo quiero curiosear carreras
          </Link>
        </div>
      </div>
    </section>
  );
}

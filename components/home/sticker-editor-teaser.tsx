"use client";

/**
 * StickerEditorTeaser — reclamo del editor de sticker personalizable
 * como feature premium, en la home.
 *
 * Continúa la narrativa de DiplomaAndSharePreview (4b, justo antes en
 * app/page.tsx): esa sección muestra QUÉ llega automáticamente al cruzar
 * la meta (diploma + sticker con la plantilla por defecto); esta sección
 * explica que ese mismo sticker se puede personalizar — mover, redimensionar,
 * elegir qué datos mostrar — desde /editor-sticker, y que es una feature Pro.
 *
 * Mismo patrón que ProTeaser (components/home/pro-teaser.tsx): se oculta
 * entera si el usuario ya es Pro (useHasPremium), y usa el branch de
 * isMockMode() porque en mock no hay providers de Clerk/Convex montados.
 * Se monta como client-only island (ver client-only-islands.tsx) porque
 * el prerender ISR de la home no tiene esos providers en el árbol.
 *
 * CTA: /premium (no al editor real — ese requiere una carrera concreta
 * de un usuario logueado, que no existe en el contexto de un visitante
 * anónimo en la home).
 */

import Link from "next/link";
import { ArrowRight, Move, Palette, Sparkles } from "lucide-react";
import { useHasPremium } from "@/components/billing/use-has-premium";
import { isMockMode } from "@/lib/mock/provider";

const PERKS = [
  { icon: Move, label: "Mueve y redimensiona cada dato a tu gusto" },
  { icon: Palette, label: "Elige qué mostrar: tiempo, pace, PR, dorsal, ruta…" },
  { icon: Sparkles, label: "Descarga en PNG transparente o mándatelo por email" },
];

export function StickerEditorTeaser() {
  const useMock = isMockMode();
  return useMock ? <StickerEditorTeaserSection /> : <RealStickerEditorTeaser />;
}

function RealStickerEditorTeaser() {
  const { hasAccess } = useHasPremium();
  if (hasAccess) return null;
  return <StickerEditorTeaserSection />;
}

function StickerEditorTeaserSection() {
  return (
    <section className="py-8 md:py-12" aria-labelledby="sticker-teaser-title">
      <div className="rounded-2xl border border-runner-primary/20 bg-gradient-to-br from-runner-warm to-white p-6 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 md:gap-8 items-center max-w-4xl mx-auto">
          <div>
            <p className="text-sm font-semibold text-runner-primary uppercase tracking-wider mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Editor de sticker
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5">
                Pro
              </span>
            </p>
            <h2
              id="sticker-teaser-title"
              className="text-2xl md:text-3xl font-bold text-runner-dark mb-3"
            >
              El sticker de tu resultado, a tu manera
            </h2>
            <ul className="space-y-2 mb-5">
              {PERKS.map((perk) => {
                const Icon = perk.icon;
                return (
                  <li key={perk.label} className="flex items-start gap-2 text-sm text-gray-700">
                    <Icon className="h-4 w-4 text-runner-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{perk.label}</span>
                  </li>
                );
              })}
            </ul>
            <Link
              href="/premium"
              className="inline-flex items-center gap-1.5 bg-runner-primary text-white font-semibold text-sm px-4 py-2.5 rounded-md hover:bg-red-700 transition-colors"
            >
              Probar el editor
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          {/* Mini mockup: 2 miniaturas del sticker con distinta composición,
              para transmitir "personalizable" sin duplicar el mockup grande
              de DiplomaAndSharePreview. */}
          <div className="hidden md:flex items-end gap-3" aria-hidden="true">
            <div
              className="w-20 rounded-xl border border-gray-200 shadow-md bg-white/90 flex flex-col items-center justify-center gap-1.5 py-3"
              style={{ aspectRatio: "1080 / 1920" }}
            >
              <div className="rounded-full bg-green-100 px-1.5 py-0.5">
                <span className="text-[6px] font-bold text-green-700">PR</span>
              </div>
              <p
                className="text-[9px] font-bold text-green-600"
                style={{ fontFamily: "JetBrains Mono, monospace" }}
              >
                01:26:14
              </p>
              <div className="rounded bg-stone-100 px-1.5 py-0.5">
                <span className="text-[6px] text-stone-600">4:18/km</span>
              </div>
            </div>
            <div
              className="w-20 rounded-xl border border-gray-200 shadow-md bg-white/90 flex flex-col items-center justify-center gap-1.5 py-3 -mb-2"
              style={{ aspectRatio: "1080 / 1920" }}
            >
              <p
                className="text-[10px] font-bold text-green-600"
                style={{ fontFamily: "JetBrains Mono, monospace" }}
              >
                01:26:14
              </p>
              <div className="rounded bg-red-600 px-1.5 py-0.5">
                <span className="text-[6px] text-white font-bold">2501</span>
              </div>
              <div className="rounded bg-stone-100 px-1.5 py-0.5">
                <span className="text-[6px] text-stone-600">10,000km</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

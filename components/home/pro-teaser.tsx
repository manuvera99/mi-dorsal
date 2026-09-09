/**
 * ProTeaser — teaser del plan Pro en la home.
 *
 * Renderiza 3 cards (Free / Pro Mensual / Pro Anual) con copy de
 * marketing orientado a "qué te llevas", no a "qué features tiene".
 *
 * En lugar de ser un duplicado de /premium (que tiene la tabla
 * comparativa completa), esta sección es una PASADA RÁPIDA para
 * captar al usuario curioso y mandarlo a /premium. El checkout real
 * de Clerk vive en /cuenta/suscripcion, al que se llega desde /premium.
 *
 * La fuente de verdad del pricing es /premium/page.tsx. Si cambian
 * los precios, hay que tocar AMBOS archivos (o refactorizarlo a un
 * componente compartido — pendiente).
 */

import Link from "next/link";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tier {
  id: "free" | "pro-monthly" | "pro-annual";
  name: string;
  price: string;
  period: string;
  highlight?: string;
  badge?: { label: string; color: "amber" | "primary" };
  tagline: string;
  features: string[];
  cta: { label: string; href: string };
  emphasis?: boolean;
}

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    price: "0 €",
    period: "para siempre",
    tagline: "Para empezar tu hilo de dorsal sin pagar.",
    features: [
      "Catálogo completo y predicción VDOT",
      "Voto 8D y resultados por email",
      "1 export de Strava (ZIP) por cuenta",
      "Calendario personal sin límite",
    ],
    cta: { label: "Crear cuenta gratis", href: "/sign-up" },
  },
  {
    id: "pro-monthly",
    name: "Pro Mensual",
    price: "2,99 €",
    period: "/ mes",
    tagline: "Pruébalo sin compromiso. Cancela cuando quieras.",
    features: [
      "Strava OAuth en tiempo real (webhook)",
      "Analisis de tu perfil de corredor (ilimitado)",
      "Re-subir Strava export sin límite",
      "Alertas personalizadas y export a calendario",
    ],
    cta: { label: "Probar 14 días gratis", href: "/premium" },
  },
  {
    id: "pro-annual",
    name: "Pro Anual",
    price: "24,99 €",
    period: "/ año",
    highlight: "2,08 € / mes",
    badge: { label: "Más popular", color: "amber" },
    tagline: "Para el corredor que planifica toda la temporada.",
    features: [
      "Todo lo de Pro Mensual",
      "Ahorras un 30% (≈ 11 € al año)",
      "Prioridad en features nuevas",
      'Badge de "fundador" en tu perfil',
    ],
    cta: { label: "Hacerme Pro anual", href: "/premium" },
    emphasis: true,
  },
];

const BADGE_COLORS = {
  amber: "bg-amber-100 text-amber-800 border-amber-200",
  primary: "bg-runner-primary/10 text-runner-primary border-runner-primary/30",
};

export function ProTeaser() {
  return (
    <section className="py-8 md:py-12" aria-labelledby="pro-teaser-title">
      <div className="text-center mb-8 md:mb-10">
        <p className="text-sm font-semibold text-runner-primary uppercase tracking-wider mb-2 flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Planes
        </p>
        <h2
          id="pro-teaser-title"
          className="text-3xl md:text-4xl font-bold text-runner-dark"
        >
          Empieza gratis. Mejora cuando lo necesites.
        </h2>
        <p className="text-gray-600 mt-2 max-w-2xl mx-auto">
          El 90% de los corredores usa el plan Free sin pagar nada. Pro
          es para los que quieren Strava en tiempo real y el analisis de tu perfil de corredor
          sin límites.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 max-w-5xl mx-auto">
        {TIERS.map((tier) => {
          const isEmphasis = tier.emphasis;
          return (
            <article
              key={tier.id}
              className={cn(
                "relative rounded-2xl p-6 flex flex-col",
                isEmphasis
                  ? "bg-gradient-to-br from-runner-primary to-red-700 text-white border-2 border-runner-primary shadow-xl shadow-runner-primary/20 md:scale-[1.03]"
                  : "bg-white border border-gray-200 hover:border-runner-primary/40 transition-colors"
              )}
            >
              {tier.badge && (
                <span
                  className={cn(
                    "absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-0.5 border whitespace-nowrap",
                    isEmphasis
                      ? "bg-yellow-300 text-runner-dark border-yellow-400"
                      : BADGE_COLORS[tier.badge.color]
                  )}
                >
                  {tier.badge.label}
                </span>
              )}

              <header className="mb-4">
                <h3
                  className={cn(
                    "text-base font-bold uppercase tracking-wider",
                    isEmphasis ? "text-yellow-200" : "text-runner-primary"
                  )}
                >
                  {tier.name}
                </h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{tier.price}</span>
                  <span
                    className={cn(
                      "text-sm",
                      isEmphasis ? "text-red-100" : "text-gray-500"
                    )}
                  >
                    {tier.period}
                  </span>
                </div>
                {tier.highlight && (
                  <p
                    className={cn(
                      "text-xs font-mono mt-1",
                      isEmphasis ? "text-yellow-200" : "text-runner-primary"
                    )}
                  >
                    {tier.highlight}
                  </p>
                )}
                <p
                  className={cn(
                    "text-xs mt-2",
                    isEmphasis ? "text-red-100" : "text-gray-600"
                  )}
                >
                  {tier.tagline}
                </p>
              </header>

              <ul
                className={cn(
                  "space-y-2 text-sm flex-1 mb-5",
                  isEmphasis ? "text-white" : "text-gray-700"
                )}
              >
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check
                      className={cn(
                        "h-4 w-4 flex-shrink-0 mt-0.5",
                        isEmphasis ? "text-yellow-200" : "text-runner-primary"
                      )}
                      aria-hidden="true"
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={tier.cta.href}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 font-semibold rounded-md px-4 py-2.5 text-sm transition-colors",
                  isEmphasis
                    ? "bg-white text-runner-primary hover:bg-yellow-50"
                    : tier.id === "free"
                    ? "bg-runner-warm text-runner-dark border border-gray-200 hover:border-runner-primary hover:text-runner-primary"
                    : "bg-runner-primary text-white hover:bg-red-700"
                )}
              >
                {tier.cta.label}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </article>
          );
        })}
      </div>

      <p className="text-center text-xs text-gray-500 mt-6">
        ¿Quieres ver la comparativa completa feature por feature?{" "}
        <Link href="/premium" className="font-semibold text-runner-primary hover:underline">
          Página de Pro →
        </Link>
      </p>
    </section>
  );
}

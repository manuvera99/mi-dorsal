// =============================================================================
// mi-dorsal — <Paywall />
// =============================================================================
// Componente que envuelve una feature premium. Muestra los children si el
// usuario tiene premium; muestra un bloque de upsell si no.
//
// Uso típico:
//   <Paywall feature="predicciones ilimitadas">
//     <Button>Calcular predicción avanzada</Button>
//   </Paywall>
//
// Características:
//   - Re-renderiza automáticamente cuando el usuario se suscribe (gracias
//     a useHasPremium → useQuery reactivo).
//   - El CTA apunta a /premium (la landing de marketing con 3 tiers
//     y FAQ) — el checkout real vive en /cuenta/suscripcion (que es
//     donde está el <PricingTable /> de Clerk). Sesión 9 sep 2026:
//     cambiamos el routing para que el usuario SIEMPRE vea el contexto
//     de marketing antes del checkout, no salte directo al pago.
//   - Variante `inline` (default) para incrustar dentro de un card o
//     sección; `card` para una sección más prominente; `modal` no
//     implementado aún (sería un UpgradeDialog para abrir desde botones).
//   - Compatible con modo mock: si no hay auth, asume free y muestra
//     upsell con un mensaje neutro.
// =============================================================================

"use client";

import Link from "next/link";
import { Sparkles, Lock, ArrowRight } from "lucide-react";
import { useHasPremium } from "./use-has-premium";
import { ReactNode } from "react";

type PaywallProps = {
  /** Nombre legible de la feature, mostrado en el upsell. ej: "predicciones
   *  ilimitadas", "sincronización con Strava". */
  feature: string;
  /** Descripción opcional de lo que se desbloquea. */
  description?: string;
  /** Variante visual:
   *  - "inline"  → bloque discreto, ideal para un card existente.
   *  - "card"    → card destacado con borde y gradiente, ideal como CTA.
   *  - "subtle"  → solo un texto pequeño con link. */
  variant?: "inline" | "card" | "subtle";
  /** Contenido premium. Se renderiza solo si el usuario tiene acceso. */
  children: ReactNode;
  /** Fallback opcional cuando el usuario NO tiene premium. Si no se pasa,
   *  se usa el upsell por defecto según la variante. Útil cuando quieres
   *  un mensaje específico para tu feature. */
  fallback?: ReactNode;
};

export function Paywall({
  feature,
  description,
  variant = "inline",
  children,
  fallback,
}: PaywallProps) {
  const { hasAccess } = useHasPremium();

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (variant === "subtle") {
    return (
      <p className="text-sm text-stone-600">
        <Lock className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
        {feature} es premium.{" "}
        <Link href="/premium" className="text-runner-primary hover:underline font-medium">
          Ver planes
        </Link>
        .
      </p>
    );
  }

  if (variant === "card") {
    return (
      <div className="rounded-xl border-2 border-dashed border-runner-primary/30 bg-gradient-to-br from-runner-primary/5 to-amber-50 p-6 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-runner-primary/10 text-runner-primary mb-3">
          <Sparkles className="h-5 w-5" />
        </div>
        <h3 className="font-semibold text-stone-900 mb-1">
          {feature} es Premium
        </h3>
        {description && (
          <p className="text-sm text-stone-600 max-w-sm mx-auto mb-4">
            {description}
          </p>
        )}
        <Link
          href="/premium"
          className="inline-flex items-center gap-1.5 rounded-md bg-runner-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-runner-primary/90 transition-colors"
        >
          Ver planes
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  // variant === "inline" (default)
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-sm">
      <div className="flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-stone-800">
            <strong>{feature}</strong> es Premium.
            {description && (
              <span className="text-stone-600"> {description}</span>
            )}
          </p>
          <Link
            href="/premium"
            className="inline-flex items-center gap-1 text-runner-primary hover:underline font-medium mt-1.5"
          >
            Ver planes
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Helper para usar en mutaciones server-side: este es el componente
 *  cliente que se ocupa del UI; la lógica real de "tienes premium" se
 *  hace en Convex con `hasPremiumAccess(ctx, clerkUserId)`. */
export { useHasPremium } from "./use-has-premium";

"use client";

// =============================================================================
// mi-dorsal — <PremiumFeatureLock />
// =============================================================================
// Componente hermano de <Paywall> (más general, con 3 variantes) pero
// específico para features de DATOS (Strava sync, calendario, diploma,
// export, etc.). No muestra el children si el usuario no tiene premium;
// en su lugar muestra un upsell contextual con la feature que se está
// bloqueando.
//
// A diferencia de <Paywall>, este componente está pensado para BLOQUEAR
// un botón o sección de UI (no para envolver una feature opcional).
// El copy es más directo: "Esto es Pro" + CTA a /cuenta/suscripcion.
//
// Variantes:
//   - "subtle"  → solo texto pequeño con link a Pro. Para inline junto
//                  a un botón que YA está visible (ej. "Diploma (Pro)").
//   - "banner"  → banner amarillo/ámbar visible. Para secciones
//                  enteras bloqueadas (ej. bloque Strava OAuth).
//   - "inline"  → bloque compacto entre contenido. Para el caso "ya
//                  tienes 5 carreras, aquí está el upsell".
//
// Para features más blandas (contenido que se muestra igual con
// upsell al lado), usa <Paywall variant="card"> en su lugar.
// =============================================================================

import Link from "next/link";
import { Lock, Sparkles, ArrowRight } from "lucide-react";
import { ReactNode } from "react";
import { useHasPremium } from "./use-has-premium";

type PremiumFeatureLockProps = {
  /** Nombre legible de la feature. ej: "Sincronizar Strava", "Diploma PDF" */
  feature: string;
  /** Descripción opcional de lo que se desbloquea. */
  description?: string;
  /** Variante visual (ver doc del componente). Default: "banner". */
  variant?: "subtle" | "banner" | "inline";
  /** Contenido premium. Se renderiza solo si el usuario tiene acceso. */
  children: ReactNode;
  /** Fallback opcional cuando el usuario NO tiene premium. */
  fallback?: ReactNode;
};

export function PremiumFeatureLock({
  feature,
  description,
  variant = "banner",
  children,
  fallback,
}: PremiumFeatureLockProps) {
  const { hasAccess, role, bypassed } = useHasPremium();

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (variant === "subtle") {
    return (
      <p className="text-xs text-stone-600 inline-flex items-center gap-1">
        <Lock className="h-3 w-3" />
        <span>{feature} es Pro.</span>
        <Link
          href="/cuenta/suscripcion"
          className="text-runner-primary hover:underline font-medium"
        >
          Hazte Pro
        </Link>
      </p>
    );
  }

  if (variant === "inline") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 my-3">
        <div className="flex items-start gap-3">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-stone-900 mb-1">
              {feature} es Pro
            </p>
            {description && (
              <p className="text-xs text-stone-600 mb-2">{description}</p>
            )}
            <Link
              href="/cuenta/suscripcion"
              className="inline-flex items-center gap-1 text-xs font-semibold text-runner-primary hover:underline"
            >
              Ver planes Pro
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // variant === "banner" (default)
  return (
    <div className="rounded-xl border-2 border-dashed border-runner-primary/30 bg-gradient-to-br from-runner-primary/5 to-amber-50 p-5 text-center">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-runner-primary/10 text-runner-primary mb-2">
        <Lock className="h-5 w-5" />
      </div>
      <h3 className="font-semibold text-stone-900 mb-1">
        {feature} es Pro
      </h3>
      {description && (
        <p className="text-sm text-stone-600 max-w-sm mx-auto mb-3">
          {description}
        </p>
      )}
      <Link
        href="/cuenta/suscripcion"
        className="inline-flex items-center gap-1.5 rounded-md bg-runner-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-runner-primary/90 transition-colors"
      >
        Ver planes Pro
        <ArrowRight className="h-4 w-4" />
      </Link>
      {bypassed && (
        <p className="text-[10px] text-stone-400 mt-2">
          Tienes bypass por rol ({role}). El bloqueo no aplica.
        </p>
      )}
    </div>
  );
}

/** Helper para usar en mutaciones server-side: este es el componente
 *  cliente que se ocupa del UI; la lógica real de "tienes premium" se
 *  hace en Convex con `hasPremiumAccess(ctx, clerkUserId)`. */
export { useHasPremium } from "./use-has-premium";

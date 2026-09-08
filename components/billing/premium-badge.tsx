// =============================================================================
// mi-dorsal — <PremiumBadge />
// =============================================================================
// Pequeño indicador visual de "Premium" para colocar junto al nombre del
// usuario, en headers, o donde se quiera destacar que alguien es premium.
//
// Variantes:
//   - "badge"  → pill con gradiente dorado (default)
//   - "subtle" → texto plano "Premium" en gris
//   - "icon"   → solo el icono Sparkles, sin texto
// =============================================================================

"use client";

import { Sparkles } from "lucide-react";
import { useHasPremium } from "./use-has-premium";

type PremiumBadgeProps = {
  variant?: "badge" | "subtle" | "icon";
  className?: string;
};

export function PremiumBadge({ variant = "badge", className = "" }: PremiumBadgeProps) {
  const { hasAccess } = useHasPremium();

  // No premium → no renderizar nada (el componente es invisible si no
  // aplica). Esto evita tener que envolver con `{isPremium && <...>}`
  // en cada sitio.
  if (!hasAccess) return null;

  if (variant === "icon") {
    return (
      <span className={`inline-flex ${className}`} title="Usuario Premium">
        <Sparkles
          className="h-4 w-4 text-amber-500"
          aria-label="Premium"
        />
      </span>
    );
  }

  if (variant === "subtle") {
    return (
      <span
        className={`text-xs font-medium text-amber-700 ${className}`}
        title="Usuario Premium"
      >
        Premium
      </span>
    );
  }

  // variant === "badge" (default)
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-950 shadow-sm ${className}`}
      title="Usuario Premium"
    >
      <Sparkles className="h-3 w-3" />
      Premium
    </span>
  );
}

"use client";

/**
 * ProBadge — badge "Nuevo · Pro desde 2,99 €/mes" del hero.
 *
 * Bug encontrado en auditoría (sesión 10 sep 2026): antes vivía como JSX
 * estático dentro de hero.tsx, así que se mostraba SIEMPRE, incluso a
 * usuarios que ya son Pro — un upsell sin sentido para alguien que ya paga.
 * Extraído a su propio componente para poder consultar useHasPremium() y
 * ocultarlo cuando el usuario ya tiene acceso premium.
 *
 * Mock mode: no hay Clerk/Convex providers montados (ver
 * lib/mock/provider.tsx), así que useHasPremium (que usa useQuery de
 * Convex) no se puede llamar sin crashear. En mock siempre mostramos el
 * badge, igual que el comportamiento anterior — no hay estado de
 * suscripción real que consultar.
 */

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { useHasPremium } from "@/components/billing/use-has-premium";
import { isMockMode } from "@/lib/mock/provider";

function BadgeLink() {
  return (
    <Link
      href="/premium"
      className="inline-flex items-center gap-1.5 bg-yellow-300/95 text-runner-dark text-xs font-bold rounded-full px-3 py-1 mb-5 hover:bg-yellow-200 transition-colors"
    >
      <Sparkles className="h-3 w-3 text-runner-primary" aria-hidden="true" />
      Nuevo · Pro desde 2,99 €/mes
      <ArrowRight className="h-3 w-3" aria-hidden="true" />
    </Link>
  );
}

function RealProBadge() {
  const { hasAccess } = useHasPremium();
  if (hasAccess) return null;
  return <BadgeLink />;
}

export function ProBadge() {
  if (isMockMode()) return <BadgeLink />;
  return <RealProBadge />;
}

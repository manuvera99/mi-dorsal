// =============================================================================
// mi-dorsal — useHasPremium
// =============================================================================
// Hook reactivo que consulta el estado de subscripción del usuario en Convex
// y devuelve si tiene acceso premium. Re-renderiza automáticamente cuando el
// webhook de Clerk actualiza la fila (tras pagar, cancelar, etc.).
//
// Devuelve también el estado completo para que los componentes puedan
// mostrar el mensaje correcto (gratis, en trial, próximo a vencer, etc.).
// =============================================================================

"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export type PremiumStatus = {
  /** ¿El usuario tiene acceso premium AHORA MISMO? */
  hasAccess: boolean;
  /** Tier lógico: "free" | "premium". */
  tier: "free" | "premium";
  /** Estado reportado por Clerk (active, trialing, past_due, canceled, ...).
   *  Null si nunca ha tenido suscripción. "bypassed" si es admin/test. */
  status: string | null;
  /** Unix ms del próximo cobro. Null si está cancelado sin periodo pendiente
   *  o si nunca ha pagado. Útil para mostrar "Tu plan se renueva el X". */
  currentPeriodEnd: number | null;
  /** Rol del profile. "admin" y "test" bypassean todo el paywall.
   *  Null si no hay profile (no logueado). */
  role: string | null;
  /** True si el acceso premium viene de un bypass de rol (admin/test),
   *  no de una suscripción real. Útil para mostrar copy distinto. */
  bypassed: boolean;
};

const DEFAULT_STATUS: PremiumStatus = {
  hasAccess: false,
  tier: "free",
  status: null,
  currentPeriodEnd: null,
  role: null,
  bypassed: false,
};

/** Hook principal. Devuelve el estado premium reactivo del usuario actual.
 *  En modo mock o sin auth, devuelve el estado "free" (sin premium).
 *
 *  Coste: 1 query Convex (índice by_clerk_user_id, sub-ms). El componente
 *  que use este hook se re-renderiza automáticamente cuando la fila
 *  `subscriptions` se actualiza (ej: tras pagar o cancelar). */
export function useHasPremium(): PremiumStatus {
  // useQuery devuelve undefined mientras carga. Tratamos undefined como
  // "free" (no premium) para que la UI no parpadee con un estado vacío
  // en el primer render.
  const status = useQuery(api.subscriptions.getMyPremiumStatus, {});

  if (!status) {
    // Mientras carga, devolvemos "free" sin premium — UI asume defaults
    // hasta que llegue la respuesta. El render posterior reemplaza el
    // estado si el usuario realmente es premium.
    return DEFAULT_STATUS;
  }
  return status;
}

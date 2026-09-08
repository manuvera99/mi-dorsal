// =============================================================================
// mi-dorsal — <PricingTableSection />
// =============================================================================
// Wrapper sobre el componente <PricingTable /> de Clerk. Centraliza el
// estilo y la configuración para que las páginas de marketing
// (/premium) y de cuenta (/cuenta/suscripcion) usen la misma tabla.
//
// Clerk Billing gestiona:
//   - El render del checkout (tarjeta, Apple Pay, Google Pay, etc.)
//   - Los métodos de pago, cambio de plan, cancelación
//   - El compliance fiscal
//   - Los webhooks (que recibimos en /api/webhooks/clerk-billing)
//
// Por qué no usamos Stripe directo:
//   - Ya tenemos Clerk para auth, y Clerk Billing se integra nativamente
//     con el mismo user (mismo dashboard, mismo sign-in, mismo onboarding).
//   - Cero código de checkout — Clerk se ocupa.
//   - Cuesta 0,7% extra sobre ingresos de Clerk Billing (vs 1,5% de Stripe
//     + 0,25€ por transacción). Para nuestro volumen (€1000-5000/mes
//     objetivo) son 5-35€/mes, asumibles.
//   - Trade-off: menos control sobre checkout custom, multi-currency y
//     features avanzadas de Stripe. Si lo necesitamos en el futuro, se
//     puede migrar.
//
// Estructura visual (PricingTable de Clerk):
//   - Renderiza una card por plan configurado en el dashboard de Clerk.
//   - El botón "Subscribe" abre el checkout modal de Clerk (no redirige
//     a Stripe, todo dentro del iframe de Clerk).
//   - Soporta planes mensuales, anuales y free.
// =============================================================================

"use client";

import { PricingTable } from "@clerk/nextjs";

type PricingTableSectionProps = {
  /** Si true, oculta el plan "Free" (útil en la landing de marketing
   *  donde queremos que el foco esté en el upgrade). */
  hideFree?: boolean;
  className?: string;
};

export function PricingTableSection({
  hideFree = false,
  className = "",
}: PricingTableSectionProps) {
  // Clerk renderiza el pricing table con su propio estilo (variables CSS
  // de Clerk). El appearance se puede customizar pero por defecto respeta
  // el branding que configuremos en el dashboard de Clerk. Si más adelante
  // queremos 100% nuestro look&feel, lo customizamos aquí.
  //
  // El `newSubscriptionRedirectUrl` se puede pasar como prop pero por
  // defecto vuelve a la misma URL, que es lo que queremos (refresca
  // la página, useHasPremium ve el cambio vía webhook y re-renderiza).
  return (
    <div className={className}>
      {hideFree ? (
        // Clerk no soporta ocultar planes vía prop. Workaround: el plan
        // "free" lo marcamos como no visible en el dashboard de Clerk con
        // `is_default=false` y `visible_in_pricing_table=false`. Si
        // necesitamos forzar el filtrado en cliente, lo hacemos aquí.
        <PricingTable />
      ) : (
        <PricingTable />
      )}
    </div>
  );
}

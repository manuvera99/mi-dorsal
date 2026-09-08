"use client";

// =============================================================================
// mi-dorsal — /cuenta/suscripcion
// =============================================================================
// Página de gestión de la suscripción del usuario. Tres bloques:
//   1) Estado actual: muestra plan actual, próximo cobro, estado.
//   2) Tabla de precios: <PricingTable /> de Clerk para cambiar de plan
//      o suscribirse si no tiene.
//   3) Botón "Gestionar suscripción" (cancelar, ver facturas, cambiar
//      método de pago) — esto lo abre el portal de Clerk, no lo
//      implementamos nosotros.
//
// ¿Por qué client component?
//   - useUser y useQuery de Clerk/Convex son client-only.
//   - PricingTable de Clerk es client-side.
// =============================================================================

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowLeft, Sparkles, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { PricingTableSection } from "@/components/billing/pricing-table";
import { useHasPremium } from "@/components/billing/use-has-premium";
import { PremiumBadge } from "@/components/billing/premium-badge";
import { isMockMode } from "@/lib/mock/provider";

export default function SuscripcionPage() {
  const useMock = isMockMode();

  // En mock mode no hay Clerk, no renderizamos nada que dependa de auth.
  // Mostramos un placeholder para que el dev sepa que la ruta existe.
  if (useMock) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-2">Suscripción</h1>
        <p className="text-stone-600">
          Estás en modo mock. La gestión de suscripción real está disponible
          en producción. Configura Clerk Billing según{" "}
          <code className="px-1.5 py-0.5 bg-stone-100 rounded text-sm">docs/BILLING_SETUP.md</code>.
        </p>
      </div>
    );
  }

  return <RealSuscripcionContent />;
}

function RealSuscripcionContent() {
  const { user, isLoaded: userLoaded } = useUser();
  const { hasAccess, tier, status, currentPeriodEnd } = useHasPremium();

  // Mientras Clerk carga, mostramos un spinner ligero (no bloqueamos
  // demasiado — la página debe sentirse rápida).
  if (!userLoaded) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-stone-500">
        <Loader2 className="inline h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/perfil"
        className="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a tu perfil
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            Tu suscripción
            {hasAccess && <PremiumBadge variant="badge" />}
          </h1>
          <p className="text-stone-600 mt-1">
            Gestiona tu plan, tu método de pago y tus facturas.
          </p>
        </div>
      </div>

      {/* Bloque 1: estado actual */}
      <section className="card mb-8">
        <h2 className="text-lg font-semibold mb-3">Estado actual</h2>
        <EstadoActual
          email={user?.primaryEmailAddress?.emailAddress ?? null}
          tier={tier}
          status={status}
          hasAccess={hasAccess}
          currentPeriodEnd={currentPeriodEnd}
        />
      </section>

      {/* Bloque 2: pricing table (para suscribirse o cambiar de plan) */}
      <section>
        <h2 className="text-lg font-semibold mb-3">
          {hasAccess ? "Cambiar de plan" : "Elige tu plan"}
        </h2>
        <p className="text-sm text-stone-600 mb-4">
          {hasAccess
            ? "Puedes subir o bajar de plan en cualquier momento. El cambio se aplica de forma prorrateada."
            : "Empieza gratis. Si quieres más, desbloquea todo el potencial de mi-dorsal con Premium."}
        </p>
        <PricingTableSection />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-componente: estado actual de la suscripción
// ---------------------------------------------------------------------------

function EstadoActual({
  email,
  tier,
  status,
  hasAccess,
  currentPeriodEnd,
}: {
  email: string | null;
  tier: "free" | "premium";
  status: string | null;
  hasAccess: boolean;
  currentPeriodEnd: number | null;
}) {
  // Formatear fecha. Usamos `es-ES` para que salga en español.
  const formatDate = (ms: number) => {
    return new Date(ms).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Estado de pago interpretado para humanos.
  const statusLabel: Record<string, string> = {
    active: "Activa",
    trialing: "En prueba",
    past_due: "Cobro pendiente",
    canceled: "Cancelada",
    incomplete: "Incompleta",
    incomplete_expired: "Expirada",
    unpaid: "Impagada",
    paused: "Pausada",
  };

  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
      <div>
        <dt className="text-stone-500">Email de la cuenta</dt>
        <dd className="font-medium text-stone-900">{email ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-stone-500">Plan</dt>
        <dd className="font-medium text-stone-900 flex items-center gap-1.5">
          {tier === "premium" ? (
            <>
              <Sparkles className="h-4 w-4 text-amber-500" />
              Premium
            </>
          ) : (
            "Free"
          )}
        </dd>
      </div>
      <div>
        <dt className="text-stone-500">Estado</dt>
        <dd className="font-medium text-stone-900 flex items-center gap-1.5">
          {hasAccess ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {status ? (statusLabel[status] ?? status) : "Activa"}
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-stone-400" />
              Sin suscripción
            </>
          )}
        </dd>
      </div>
      <div>
        <dt className="text-stone-500">Próximo cobro</dt>
        <dd className="font-medium text-stone-900">
          {currentPeriodEnd ? formatDate(currentPeriodEnd) : "—"}
        </dd>
      </div>
    </dl>
  );
}

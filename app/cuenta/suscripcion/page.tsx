"use client";

// =============================================================================
// mi-dorsal — /cuenta/suscripcion
// =============================================================================
// Página de gestión de la suscripción del usuario. Migrada de Clerk Billing
// a Stripe directo el 9 sep 2026 (Clerk Billing solo soporta USD y no
// tiene 3DS — incompatible con mercado EU).
//
// Tres bloques:
//   1) Estado actual: muestra plan actual, próximo cobro, estado.
//   2) Botón "Hazte Pro" (si no tiene) o "Cambiar de plan" (si tiene) →
//      llama a /api/stripe/checkout y redirige a Stripe.
//   3) Botón "Gestionar suscripción" → llama a /api/stripe/portal y
//      abre el Customer Portal hospedado de Stripe (cancelar, cambiar
//      tarjeta, descargar facturas).
//
// ¿Por qué client component?
//   - useUser y useQuery son client-only.
//   - Los botones hacen fetch al endpoint y luego location.href.
// =============================================================================

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowLeft, Sparkles, CheckCircle2, XCircle, Loader2, ExternalLink, Shield } from "lucide-react";
import { useHasPremium } from "@/components/billing/use-has-premium";
import { PremiumBadge } from "@/components/billing/premium-badge";
import { isMockMode } from "@/lib/mock/provider";

export default function SuscripcionPage() {
  const useMock = isMockMode();

  // En mock mode no hay Clerk, no renderizamos nada que dependa de auth.
  if (useMock) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-2">Suscripción</h1>
        <p className="text-stone-600">
          Estás en modo mock. La gestión de suscripción real está disponible
          en producción. Configura Stripe según{" "}
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
  const [isCheckoutLoading, setIsCheckoutLoading] = useState<"monthly" | "yearly" | null>(null);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mientras Clerk carga, mostramos un spinner ligero.
  if (!userLoaded) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-stone-500">
        <Loader2 className="inline h-5 w-5 animate-spin" />
      </div>
    );
  }

  /**
   * Helper: llama a un endpoint y redirige a la URL devuelta. Si falla,
   * muestra el error inline.
   */
  async function postAndRedirect(url: string, body: object, onLoading: (loading: boolean) => void) {
    setErrorMsg(null);
    onLoading(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.hint ?? data.error ?? `HTTP ${res.status}`);
      }
      // Redirigir a Stripe (checkout o portal)
      window.location.href = data.url;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error desconocido");
      onLoading(false);
    }
  }

  function startCheckout(plan: "premium_monthly" | "premium_yearly") {
    // Mapeamos el alias del front al estado de loading (que solo conoce
    // "monthly" / "yearly", no los aliases).
    const loadingKey: "monthly" | "yearly" =
      plan === "premium_monthly" ? "monthly" : "yearly";
    postAndRedirect(
      "/api/stripe/checkout",
      { priceId: plan },
      (loading) => setIsCheckoutLoading(loading ? loadingKey : null),
    );
  }

  function openPortal() {
    postAndRedirect(
      "/api/stripe/portal",
      {},
      (loading) => setIsPortalLoading(loading),
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

      {/* Bloque 2: elegir/cambiar plan (botones que llaman a Stripe Checkout) */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">
          {hasAccess ? "Cambiar de plan" : "Hazte Pro"}
        </h2>
        <p className="text-sm text-stone-600 mb-4">
          {hasAccess
            ? "Sube o baja de plan. El cambio se aplica desde el siguiente ciclo de cobro."
            : "Empieza con 14 días gratis. Sin tarjeta, sin compromiso. Cancela cuando quieras."}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CheckoutButton
            label="Hacerme Pro Mensual — 2,99 €/mes"
            sublabel="Cobro inmediato. Sin compromiso."
            loading={isCheckoutLoading === "monthly"}
            disabled={isCheckoutLoading !== null || isPortalLoading}
            onClick={() => startCheckout("premium_monthly")}
            variant="primary"
          />
          <CheckoutButton
            label="Probar Pro Anual — 24,99 €/año"
            sublabel="14 días gratis sin tarjeta · ahorra 30%"
            loading={isCheckoutLoading === "yearly"}
            disabled={isCheckoutLoading !== null || isPortalLoading}
            onClick={() => startCheckout("premium_yearly")}
            variant="amber"
          />
        </div>
        <p className="text-xs text-stone-500 mt-3 flex items-start gap-1.5">
          <Shield className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          Pagos seguros por Stripe en EUR (PSD2 / 3D Secure). Cancela
          cuando quieras desde el portal de gestión.
        </p>
      </section>

      {/* Bloque 3: gestionar suscripción (cancelar, cambiar tarjeta, facturas) */}
      {hasAccess && (
        <section className="card">
          <h2 className="text-lg font-semibold mb-2">Gestionar suscripción</h2>
          <p className="text-sm text-stone-600 mb-4">
            Cambia de método de pago, descarga facturas o cancela tu plan
            desde el portal de Stripe. Si cancelas, mantienes el acceso
            hasta que termine el periodo que ya pagaste.
          </p>
          <button
            type="button"
            onClick={openPortal}
            disabled={isPortalLoading || isCheckoutLoading !== null}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPortalLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Abriendo portal...
              </>
            ) : (
              <>
                Abrir portal de gestión
                <ExternalLink className="h-4 w-4" />
              </>
            )}
          </button>
        </section>
      )}

      {/* Error global (si el endpoint falla) */}
      {errorMsg && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <strong>No se pudo abrir el checkout:</strong> {errorMsg}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function CheckoutButton({
  label,
  sublabel,
  loading,
  disabled,
  onClick,
  variant,
}: {
  label: string;
  sublabel: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  variant: "primary" | "amber";
}) {
  const className =
    variant === "amber"
      ? "rounded-lg border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100 px-4 py-3 text-left hover:border-amber-400 transition-colors"
      : "rounded-lg border-2 border-runner-primary bg-gradient-to-br from-runner-primary/5 to-amber-50 px-4 py-3 text-left hover:border-runner-primary/80 transition-colors";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${className} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-stone-900">{label}</div>
          <div className="text-xs text-stone-600 mt-0.5">{sublabel}</div>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />}
      </div>
    </button>
  );
}

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
  const formatDate = (ms: number) => {
    return new Date(ms).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Mapeo de status de Stripe → etiqueta humana.
  const statusLabel: Record<string, string> = {
    active: "Activa",
    trialing: "En prueba (14 días)",
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

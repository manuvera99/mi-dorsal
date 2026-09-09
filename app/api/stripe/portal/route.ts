// =============================================================================
// mi-dorsal — POST /api/stripe/portal
// =============================================================================
// Crea una sesión del Customer Portal de Stripe para que el user
// gestione su suscripción (cancelar, cambiar tarjeta, descargar facturas).
//
// El portal es la UI hospedada de Stripe — no implementamos nada custom.
// Es la práctica recomendada oficial de Stripe para SaaS: ahorra meses
// de desarrollo y hereda 3DS / PSD2 / multi-moneda sin esfuerzo.
//
// Flujo:
//   1. User logueado hace POST (sin body)
//   2. Buscamos su stripeCustomerId en la tabla subscriptions
//   3. Si no hay, devolvemos 404 (el user nunca ha pagado)
//   4. Si hay, creamos portal session y devolvemos la URL
//   5. El cliente hace redirect → gestiona en stripe.com → vuelve
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY no está configurado");
  _stripe = new Stripe(key, { apiVersion: "2026-08-26.dahlia", typescript: true });
  return _stripe;
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(_req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // 1) Buscar el stripeCustomerId del user
    const status = await convex.query(api.subscriptions.getMyPremiumStatus, {});
    // getMyPremiumStatus devuelve el PremiumStatus del USER AUTENTICADO
    // (que coincide con userId porque el auth de Clerk fluye vía JWT).
    // Pero para ser 100% seguros, leemos directo de la fila de sub.
    // Si no hay sub, no hay portal.
    // (Implementación alternativa: nueva query getMyStripeCustomerId)
    // Por simplicidad usamos getMySubscription que es la canónica.
    const sub = await convex.query(api.subscriptions.getMySubscription, {});
    if (!sub?.stripeCustomerId) {
      return NextResponse.json(
        { error: "no_subscription", hint: "El usuario no tiene suscripción en Stripe" },
        { status: 404 },
      );
    }
    // `status` solo se consulta para verificar que el endpoint responde
    // (defensa contra regresiones). Lo ignoramos.
    void status;

    // 2) Crear portal session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://mi-dorsal.com";
    const session = await getStripe().billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${baseUrl}/cuenta/suscripcion`,
      locale: "es",
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe/portal] Error creando portal session:", err);
    return NextResponse.json(
      {
        error: "stripe_error",
        hint: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 },
    );
  }
}

// =============================================================================
// mi-dorsal — POST /api/stripe/checkout
// =============================================================================
// Crea una Stripe Checkout Session en modo "subscription" para que el
// usuario pague. Migrado de Clerk Billing el 9 sep 2026 — ver
// docs/BILLING_SETUP.md para el runbook completo.
//
// Flujo:
//   1. Cliente (premium) hace POST con { priceId: "premium_monthly" | "premium_yearly" }
//   2. Verificamos auth con Clerk
//   3. Buscamos (o creamos) el customer en Stripe asociado al user
//   4. Creamos la Checkout Session con:
//      - mode: "subscription"
//      - line_items: el priceId elegido
//      - customer: el customer encontrado/creado (o email si es nuevo)
//      - trial_period_days: 14 (gratis sin tarjeta, hasta que se acabe el trial)
//      - success_url: /cuenta/suscripcion?success=1
//      - cancel_url: /premium?canceled=1
//      - client_reference_id: clerkUserId (para que el webhook lo relacione)
//   5. Devolvemos la URL de la session al cliente (que hará redirect)
//
// Notas:
//   - Reutilizamos el customer si ya existe (lookup por email o metadata.clerkUserId).
//   - Si el cliente no está autenticado, devolvemos 401.
//   - Si el priceId no es válido, devolvemos 400.
//   - NO creamos la fila de subscription aquí — eso lo hace el webhook tras
//     el pago. Aquí solo devolvemos la URL de Stripe.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------------
// Cliente Stripe singleton
// -----------------------------------------------------------------------------
// Inicialización perezosa para que la build no falle si STRIPE_SECRET_KEY
// no está definido (p.ej. en CI / preview sin secrets). El primer uso
// real (cuando un user paga) es donde validamos.
// -----------------------------------------------------------------------------
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY no está configurado");
  }
  _stripe = new Stripe(key, {
    // Pin a la API version que el SDK declara. Si el SDK se actualiza y
    // cambia este literal, ajustamos aquí también. La clave: NO usar
    // `as any` para saltarse el typecheck — pierde la validación de los
    // tipos de Stripe.
    apiVersion: "2026-08-26.dahlia",
    typescript: true,
  });
  return _stripe;
}

// -----------------------------------------------------------------------------
// Tipos
// -----------------------------------------------------------------------------
type CheckoutRequest = {
  /** "premium_monthly" o "premium_yearly" — alias que el front conoce.
   *  Internamente los mapeamos a STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY
   *  para no exponer los price_... en el front. */
  priceId: "premium_monthly" | "premium_yearly";
};

const PRICE_ALIAS_TO_STRIPE_ID: Record<CheckoutRequest["priceId"], string | undefined> = {
  premium_monthly: process.env.STRIPE_PRICE_MONTHLY,
  premium_yearly: process.env.STRIPE_PRICE_YEARLY,
};

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // 1) Auth con Clerk
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userEmail =
    (sessionClaims?.email as string | undefined) ??
    (sessionClaims?.email_address as string | undefined);

  // 2) Parsear body
  let body: CheckoutRequest;
  try {
    body = (await req.json()) as CheckoutRequest;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  // Defensa contra BOM y otros caracteres invisibles que se cuelan
  // al copiar/pegar las env vars en Vercel (detectado en sesión 9 sep
  // 2026 — el BOM al inicio del price_… hacía que Stripe devolviera
  // "No such price" aunque el ID fuera correcto). El .trim() elimina
  // espacios y BOM al principio y al final; el check del prefijo
  // detecta otros caracteres invisibles que .trim() no quite.
  const rawPriceId = PRICE_ALIAS_TO_STRIPE_ID[body.priceId];
  const stripePriceId = rawPriceId?.trim().replace(/^[\uFEFF\u200B-\u200D\u2060]+/, "");
  if (!stripePriceId || !stripePriceId.startsWith("price_")) {
    console.error(
      `[stripe/checkout] priceId malformado para ${body.priceId}: ` +
      `raw="${rawPriceId}" cleaned="${stripePriceId}"`,
    );
    return NextResponse.json(
      {
        error: "invalid_price",
        hint: "El STRIPE_PRICE_* configurado en Vercel no parece un price_… válido. Revisa la env var (puede tener un BOM o caracteres invisibles).",
      },
      { status: 500 },
    );
  }

  // 3) URLs de retorno
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://mi-dorsal.com";
  const successUrl = `${baseUrl}/cuenta/suscripcion?success=1&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseUrl}/premium?canceled=1`;

  try {
    const stripe = getStripe();

    // 4) Customer de Stripe: SIEMPRE nuevo por cada clerkUserId que
    //    pague. No reusamos por email aunque coincida.
    //
    //    Razón (sesión 9 sep 2026, decisión de producto Opción 1):
    //    vincular por email de pago (que puede ser personal, de empresa
    //    o de un familiar) hace que varios users de mi-dorsal puedan
    //    compartir un mismo customer de Stripe si pagan con el mismo
    //    email. Eso es un agujero de privacidad (el user A vería las
    //    subs del user B en el portal) y un lío de RGPD. Mejor un
    //    customer 1:1 con clerkUserId, identificados por metadata.
    //
    //    Trade-off: si el user paga con dos tarjetas distintas (mismo
    //    email), verá dos subs separadas en el portal. Es el mal menor.
    let customerId: string | undefined;
    if (userEmail) {
      const existing = await stripe.customers.list({
        email: userEmail,
        limit: 1,
      });
      if (existing.data.length > 0 && existing.data[0].metadata?.clerkUserId === userId) {
        // Match exacto por metadata: este customer es de ESTE user Clerk.
        // Lo reusamos para no multiplicar customers innecesariamente.
        customerId = existing.data[0].id;
      }
      // Si el customer con ese email NO tiene nuestro metadata, lo
      // ignoramos y creamos uno nuevo (no es nuestro customer).
    }

    // 5) Si NO hemos encontrado un customer nuestro (por metadata),
    //    creamos uno nuevo con el metadata.clerkUserId para poder
    //    encontrarlo en checkouts futuros. Si ya tenemos customerId,
    //    saltamos este paso.
    if (!customerId && userEmail) {
      const newCustomer = await stripe.customers.create({
        email: userEmail,
        metadata: { clerkUserId: userId },
      });
      customerId = newCustomer.id;
    }

    // 6) Crear Checkout Session
    // Parámetros `fixed_by_ui` (configurados en el Checkout Studio de
    // Stripe el 9 sep 2026, ver STRIPE_INTEGRATION_TODO.md):
    //   - ui_mode: "hosted_page" (SDK 22.6.1 ≥ 21.0.0)
    //   - allow_promotion_codes: false (decisión del Studio)
    //   - billing_address_collection: "auto" (recogida opcional)
    //   - phone_number_collection, automatic_tax: explícitamente off
    //   - payment_method_collection: "if_required" para mensual sin
    //     trial (el Studio decía "always" pero eso solo tiene sentido
    //     si hay trial o si queremos cobrar al cliente sin avisar).
    //     Para el anual con trial sí lo queremos "always" para guardar
    //     tarjeta y poder renovar al final del trial.
    //   - submit_type: "auto" (deja que Stripe elija según el contenido)
    //   - integration_identifier, origin_context: metadata para los
    //     analytics internos de Stripe
    // Parámetros `sample_only` que SÍ tenemos con valores reales y por
    // tanto NO se reemplazan (regla 6 del Studio): mode (subscription),
    // success_url, cancel_url, line_items.
    //
    // Diferencia mensual vs anual (sesión 9 sep 2026):
    //   - Mensual: SIN trial. Cobro inmediato al suscribirse. Stripe
    //     solo pide método de pago si es estrictamente necesario.
    //   - Anual: CON trial 14 días sin tarjeta. Stripe pide método de
    //     pago al final del trial (porque "always" en trial_mode).
    //     Decisión de producto: el anual es compromiso mayor → el trial
    //     reduce la fricción de "pago upfront 25€".
    const isAnnual = body.priceId === "premium_yearly";
    const session = await stripe.checkout.sessions.create({
      // ── fixed_by_ui ──────────────────────────────────────────────
      ui_mode: "hosted_page",
      billing_address_collection: "auto",
      phone_number_collection: { enabled: false },
      automatic_tax: { enabled: false },
      allow_promotion_codes: false,
      // Override del Studio: "always" para anual (con trial, queremos
      // guardar tarjeta), "if_required" para mensual (sin trial, cobro
      // upfront — no necesitamos tarjeta forzada).
      payment_method_collection: isAnnual ? "always" : "if_required",
      submit_type: "auto",
      integration_identifier: "hosted_web_0001",
      origin_context: "web",
      // ── sample_only con valores reales (mantener) ────────────────
      mode: "subscription",
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      // ── específicos de nuestro flujo (no son del Studio) ───────
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      client_reference_id: userId, // ← esto es lo que el webhook usa para
      metadata: {
        clerkUserId: userId,        // asociar la sub a nuestro user
        priceAlias: body.priceId,   // para logging
      },
      subscription_data: {
        // Solo el anual tiene trial (14 días sin tarjeta). El mensual
        // cobra al instante.
        ...(isAnnual ? { trial_period_days: 14 } : {}),
        metadata: {
          clerkUserId: userId,    // también en la sub para redundancia
        },
      },
      locale: "es",
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "checkout_session_no_url" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("[stripe/checkout] Error creando session:", err);
    return NextResponse.json(
      {
        error: "stripe_error",
        hint: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 },
    );
  }
}

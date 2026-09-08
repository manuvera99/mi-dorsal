// =============================================================================
// mi-dorsal — POST /api/webhooks/clerk-billing
// =============================================================================
// Recibe webhooks push de Clerk Billing cuando algo cambia en una
// subscripción de un usuario. Sincroniza el estado en Convex
// (tabla `subscriptions`).
//
// ¿Por qué un webhook y no polling?
//   Clerk Billing nos notifica al instante cuando el usuario se suscribe,
//   se le renueva, falla un cobro, cancela, etc. Sin el webhook, el
//   feature gating en Convex quedaría desincronizado hasta el próximo
//   login del usuario.
//
// Seguridad (CRÍTICA):
//   Clerk firma los webhooks con Svix. La firma usa el
//   "webhook signing secret" que Clerk nos da al crear el endpoint
//   en su dashboard. Sin verificar, cualquiera podría inyectar eventos
//   y falsificar suscripciones premium. Usamos `svix.Webhook.verify()`
//   que ya está en package.json (transitive dep de @clerk/nextjs).
//
// Configuración (ver docs/BILLING_SETUP.md):
//   1. Dashboard Clerk → Webhooks → Add Endpoint
//   2. URL: https://<tu-dominio>/api/webhooks/clerk-billing
//   3. Eventos: subscription.* (created/updated/active/past_due/canceled/trialing)
//      + subscriptionItem.* si los necesitas
//   4. Copiar el "Signing Secret" (whsec_...) a CLERK_WEBHOOK_SIGNING_SECRET
//   5. Hacer deploy y probar con "Send test event" desde el dashboard
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

// Clerk envía los webhooks como JSON. Forzamos nodejs runtime porque
// svix.Webhook usa crypto nativo de Node y edge runtime no lo soporta.
export const runtime = "nodejs";
// Clerk puede llamar en cualquier momento — no cachear.
export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------------
// Convex client
// -----------------------------------------------------------------------------
// Patrón: el webhook handler (que corre en Next.js) llama a una
// `internalMutation` de Convex vía ConvexHttpClient. Necesita la URL pública
// de Convex (NEXT_PUBLIC_CONVEX_URL) y no necesita auth de Clerk (el handler
// no actúa en nombre de un usuario, dispara la mutation interna directamente).
// -----------------------------------------------------------------------------
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// -----------------------------------------------------------------------------
// Svix verification helpers
// -----------------------------------------------------------------------------
// Clerk usa los headers Svix estándar. Ver:
// https://docs.svix.com/receiving/verifying-payloads/how
// https://clerk.com/docs/webhooks/sync-data
// -----------------------------------------------------------------------------
function getSvixHeaders(req: NextRequest) {
  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signature = req.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return null;
  return { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": signature };
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  // 1) ¿Está configurado el signing secret?
  //    Mientras Clerk Billing no esté activado en producción, esto fallará
  //    rápido. En dev, el dev secret viene de `ngrok` o el dashboard de Clerk
  //    (ver docs/BILLING_SETUP.md).
  const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error(
      "[clerk-billing/webhook] CLERK_WEBHOOK_SIGNING_SECRET no está configurado. " +
      "El webhook se rechaza para evitar procesar eventos sin firma. " +
      "Ver docs/BILLING_SETUP.md para activarlo.",
    );
    return NextResponse.json(
      { error: "webhook_not_configured" },
      { status: 503 },
    );
  }

  // 2) Verificar headers Svix presentes
  const svixHeaders = getSvixHeaders(request);
  if (!svixHeaders) {
    return NextResponse.json(
      { error: "missing_svix_headers" },
      { status: 400 },
    );
  }

  // 3) Verificar firma
  //    Importante: leer el body como TEXTO (no JSON), porque svix firma
  //    los bytes exactos del payload. Si lo parseamos y re-serializamos,
  //    la firma no valida.
  const payload = await request.text();
  const wh = new Webhook(signingSecret);
  let event: ClerkBillingEvent;
  try {
    event = wh.verify(payload, svixHeaders) as ClerkBillingEvent;
  } catch (err) {
    console.warn(
      "[clerk-billing/webhook] Firma Svix inválida, petición rechazada:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: "invalid_signature" },
      { status: 401 },
    );
  }

  // 4) Despachar el evento a la action correspondiente en Convex.
  //    Devolvemos 200 siempre que la firma sea válida, aunque la lógica
  //    interna falle. Si no, Clerk reintentará y acabaremos con duplicados.
  //    Para errores reales (evento mal formado), logueamos y devolvemos 200
  //    igualmente — Clerk reintenta con eventos mal formados es ruido.
  try {
    await dispatchEvent(event);
  } catch (err) {
    console.error(
      `[clerk-billing/webhook] Error procesando ${event.type} (id=${event.data?.id}):`,
      err,
    );
    // Aún así devolvemos 200 para evitar el reintento infinito. El error
    // queda en logs de Vercel y en logs de Convex (la action también
    // loguea si falla).
  }

  return NextResponse.json({ ok: true });
}

// -----------------------------------------------------------------------------
// Dispatcher
// -----------------------------------------------------------------------------
// Mapea cada tipo de evento de Clerk Billing a la acción correspondiente en
// Convex. La action es el entrypoint público que el webhook puede llamar
// (ConvexHttpClient.action). La action valida y delega en la internal
// mutation que es la que realmente escribe en la tabla.
//
// Estructura del evento (referencia: docs.clerk.com):
//   {
//     "type": "subscription.updated",
//     "data": {
//       "id": "sub_xxx",
//       "user_id": "user_xxx",         // puede no venir
//       "customer_id": "cus_xxx",
//       "status": "active",
//       "plan_id": "premium_monthly",
//       "plan_name": "Premium Monthly",
//       "current_period_start": 1700000000,
//       "current_period_end": 1702592000,
//       "cancel_at_period_end": false,
//       "amount_cents": 499,
//       "currency": "EUR",
//       ...
//     }
//   }
// -----------------------------------------------------------------------------
async function dispatchEvent(event: ClerkBillingEvent): Promise<void> {
  const eventType = event.type;
  const sub = event.data;

  // Ignorar eventos que no nos interesan. Clerk puede enviar más tipos
  // de los que necesitamos (ej: subscriptionItem.*) y no queremos spamear logs.
  const isSubscriptionEvent = eventType.startsWith("subscription.") || eventType.startsWith("subscriptionItem.");
  if (!isSubscriptionEvent) {
    return;
  }

  // Llamamos a la action pública (no a la internal mutation directamente).
  // Patrón idéntico al webhook de Strava (app/api/webhooks/strava/route.ts).
  // El path en el namespace es "subscriptions/handleClerkBillingEvent" porque
  // Convex agrupa por archivo.
  await convex.action(api.subscriptions.handleClerkBillingEvent, {
    eventType,
    eventId: event.evt_id ?? `unknown-${Date.now()}`,
    subscription: {
      id: sub.id,
      user_id: sub.user_id,
      customer_id: sub.customer_id,
      customer_email: sub.customer_email,
      status: sub.status,
      plan_id: sub.plan_id,
      plan_name: sub.plan_name,
      current_period_start: sub.current_period_start,
      current_period_end: sub.current_period_end,
      cancel_at_period_end: sub.cancel_at_period_end,
      canceled_at: sub.canceled_at,
      amount_cents: sub.amount_cents,
      currency: sub.currency,
    },
  });
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
// No usamos `zod` aquí porque la forma del evento la valida Svix al firmar
// y el validator de Convex al insertar. Si Clerk añade un campo nuevo,
// simplemente lo ignoramos.
// -----------------------------------------------------------------------------
type ClerkBillingEvent = {
  type: string;
  data: {
    id: string;
    user_id?: string;
    customer_id?: string;
    customer_email?: string;
    status: string;
    plan_id?: string;
    plan_name?: string;
    current_period_start?: number;
    current_period_end?: number;
    cancel_at_period_end?: boolean;
    canceled_at?: number;
    amount_cents?: number;
    currency?: string;
  };
  // Algunos eventos de Clerk llevan un id propio para idempotencia.
  // No lo usamos aún pero lo guardamos en log para debug.
  evt_id?: string;
};

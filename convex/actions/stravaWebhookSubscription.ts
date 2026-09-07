// =============================================================================
// mi-dorsal — Strava webhook subscription (renueva cada 24h)
// =============================================================================
// Strava desactiva las suscripciones que no reciben eventos en 24h. Si el
// usuario no sube nada a Strava, debemos renovar la suscripción para que
// siga activa.
//
// Strava envía un evento de "athlete" cada 24h (el devalidation ping) que
// nuestro webhook handler ya ignora pero que cuenta como actividad y
// resetea el timer. Aún así, defensivamente renovamos la suscripción.
//
// En la práctica: este cron corre cada 12h, busca suscripciones que
// llevan >12h sin renovarse, y las re-suscribe.
// =============================================================================

"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";

const STRAVA_WEBHOOK_BASE = "https://www.strava.com/api/v3/push_subscriptions";

interface PushSubscription {
  id: number;
  application_id: number;
  callback_url: string;
  created_at: string;
  updated_at: string;
}

/** Lista las suscripciones push actuales en Strava para esta app. */
async function listSubscriptions(
  clientId: string,
  clientSecret: string,
): Promise<PushSubscription[]> {
  const res = await fetch(`${STRAVA_WEBHOOK_BASE}?client_id=${clientId}&client_secret=${clientSecret}`);
  if (!res.ok) {
    throw new Error(`listSubscriptions failed: ${res.status}`);
  }
  return (await res.json()) as PushSubscription[];
}

/** Crea una nueva suscripción. */
async function createSubscription(
  clientId: string,
  clientSecret: string,
  callbackUrl: string,
): Promise<PushSubscription> {
  const res = await fetch(STRAVA_WEBHOOK_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      callback_url: callbackUrl,
      verify_token: "mi-dorsal-strava-webhook", // Strava ignora este campo en la creación
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`createSubscription failed: ${res.status} ${text}`);
  }
  return (await res.json()) as PushSubscription;
}

/** Elimina una suscripción. */
async function deleteSubscription(
  clientId: string,
  clientSecret: string,
  subscriptionId: number,
): Promise<void> {
  const res = await fetch(
    `${STRAVA_WEBHOOK_BASE}/${subscriptionId}?client_id=${clientId}&client_secret=${clientSecret}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    throw new Error(`deleteSubscription failed: ${res.status}`);
  }
}

/**
 * Action: asegura que tenemos una suscripción activa a webhooks de Strava.
 * Idempotente: si ya hay una, no hace nada.
 */
export const ensureWebhookSubscription = action({
  args: {},
  handler: async (ctx) => {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    const callbackUrl = process.env.STRAVA_WEBHOOK_CALLBACK_URL;
    const desiredSubscriptionId = process.env.STRAVA_WEBHOOK_SUBSCRIPTION_ID;

    if (!clientId || !clientSecret || !callbackUrl) {
      console.warn(
        "[stravaWebhookSubscription] Faltan env vars. No se puede renovar la suscripción.",
      );
      return { ok: false, reason: "missing_env_vars" };
    }

    // 1) Listar suscripciones existentes
    let existing: PushSubscription[] = [];
    try {
      existing = await listSubscriptions(clientId, clientSecret);
    } catch (e: any) {
      console.error(`[stravaWebhookSubscription] list failed: ${e?.message}`);
      return { ok: false, reason: "list_failed" };
    }

    // 2) Buscar la nuestra (mismo callback_url)
    const mine = existing.find((s) => s.callback_url === callbackUrl);

    if (mine) {
      // Ya existe. No hay nada que hacer (Strava resetea el timer en cada
      // evento, así que si estamos aquí es porque hay actividad).
      console.log(`[stravaWebhookSubscription] ✓ ya activa (id=${mine.id})`);
      return { ok: true, subscriptionId: mine.id, action: "kept" };
    }

    // 3) Si teníamos una guardada en env y Strava no la lista, la recreamos
    // (caso raro: Strava purgó la suscripción por inactividad).
    if (desiredSubscriptionId) {
      console.log(
        `[stravaWebhookSubscription] Strava no tiene la suscripción ${desiredSubscriptionId}, recreando`,
      );
    }

    // 4) Si hay suscripciones huérfanas (callback distinto), las borramos
    for (const s of existing) {
      if (s.callback_url !== callbackUrl) {
        console.log(`[stravaWebhookSubscription] borrando suscripción huérfana ${s.id}`);
        try {
          await deleteSubscription(clientId, clientSecret, s.id);
        } catch (e: any) {
          console.warn(`[stravaWebhookSubscription] no pude borrar ${s.id}: ${e?.message}`);
        }
      }
    }

    // 5) Crear nueva
    try {
      const newSub = await createSubscription(clientId, clientSecret, callbackUrl);
      console.log(`[stravaWebhookSubscription] ✓ creada suscripción id=${newSub.id}`);
      return { ok: true, subscriptionId: newSub.id, action: "created" };
    } catch (e: any) {
      console.error(`[stravaWebhookSubscription] create failed: ${e?.message}`);
      return { ok: false, reason: "create_failed", error: e?.message };
    }
  },
});

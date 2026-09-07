// =============================================================================
// mi-dorsal — POST /api/webhooks/strava
// =============================================================================
// Recibe webhooks push de Strava. Strava envía eventos cuando:
//   - Se crea una actividad (activity:create → object_type="activity")
//   - Se actualiza una actividad (activity:update)
//   - Se borra una actividad (activity:delete)
//
// Strava también envía un evento de "subscription devalidation" cada 24h
// aunque no haya actividad. Si no renovamos, perdemos la subscripción.
//
// Seguridad (comportamiento REAL de la API de Strava, verificado 2026-09-07):
//   Strava NO firma los eventos POST con HMAC — no existe ningún
//   "webhook secret" que Strava devuelva al crear la suscripción (el POST
//   a /push_subscriptions solo devuelve `{ id }`). La única validación que
//   ofrece es el `verify_token`: nosotros lo elegimos al crear la
//   suscripción (ver convex/actions/stravaWebhookSubscription.ts,
//   VERIFY_TOKEN) y Strava nos lo devuelve en el query param
//   `hub.verify_token` del GET de validación inicial — si no coincide, no
//   es una petición legítima de Strava confirmando esta suscripción. Los
//   eventos POST posteriores no llevan firma verificable; la única
//   protección ahí es que la URL del callback no es pública.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

// Debe coincidir exactamente con VERIFY_TOKEN en
// convex/actions/stravaWebhookSubscription.ts (mismo valor, dos sitios
// porque uno corre en Convex y el otro en Next.js).
const VERIFY_TOKEN = "mi-dorsal-strava-webhook";

export const runtime = "nodejs";
// Strava envía GET con un challenge al suscribirse por primera vez
export const dynamic = "force-dynamic";

function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, "");
}

// ---------------------------------------------------------------------------
// GET: validación inicial de la suscripción al webhook
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && challenge) {
    if (token !== VERIFY_TOKEN) {
      console.warn("[strava/webhook] verify_token no coincide, petición rechazada");
      return NextResponse.json({ error: "invalid_verify_token" }, { status: 403 });
    }
    return NextResponse.json({ "hub.challenge": challenge });
  }

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// POST: eventos push de Strava
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const body = await request.text();

  let event: {
    aspect_type?: string; // "create" | "update" | "delete"
    event_time?: number; // unix seconds
    object_id?: number; // activity id
    object_type?: string; // "activity" | "athlete"
    owner_id?: number; // strava athlete id
    subscription_id?: number;
    updates?: Record<string, unknown>;
  };
  try {
    event = JSON.parse(body);
  } catch (e) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Evento de "subscription devalidation" (Strava ping cada 24h sin actividad)
  if (event.object_type === "athlete") {
    return NextResponse.json({ ok: true, ack: "athlete_ping" });
  }

  // Evento de actividad
  if (event.object_type === "activity" && event.owner_id && event.object_id && event.aspect_type) {
    try {
      const convexUrl = stripBom(process.env.NEXT_PUBLIC_CONVEX_URL || "");
      if (!convexUrl) {
        return NextResponse.json({ error: "convex_not_configured" }, { status: 500 });
      }
      const convex = new ConvexHttpClient(convexUrl);

      // Disparar la action que procesa el evento
      // No esperamos a que termine (Strava espera 200 rápido)
      // La action vive en convex/actions/stravaWebhookHandler.ts, por lo que su
      // path en el namespace es "actions/stravaWebhookHandler" (con prefijo).
      convex
        .action((api as any)["actions/stravaWebhookHandler"].handleEvent, {
          stravaAthleteId: event.owner_id,
          stravaActivityId: event.object_id,
          aspectType: event.aspect_type,
          eventTime: event.event_time ?? Math.floor(Date.now() / 1000),
        })
        .catch((e: any) => {
          console.error("[strava/webhook] handleEvent failed:", e);
        });
    } catch (e: any) {
      console.error("[strava/webhook] dispatch failed:", e?.message);
      // Aún así devolvemos 200 a Strava para que no reintente
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, ack: "unknown_event" });
}

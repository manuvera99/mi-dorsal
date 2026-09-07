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
// Validación de firma:
//   Strava manda header "HUB-Signature" con HMAC-SHA256(secret, body).
//   STRAVA_WEBHOOK_SECRET es la clave que Strava nos da al suscribirnos.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createHmac, timingSafeEqual } from "crypto";

export const runtime = "nodejs";
// Strava envía GET con un challenge al suscribirse por primera vez
export const dynamic = "force-dynamic";

function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, "");
}

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(signature, "utf8"),
    );
  } catch {
    return false;
  }
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
    // Strava pide que respondamos con el challenge para confirmar la subscripción
    // (no validamos el verify_token porque Strava genera el challenge, no lo esperamos)
    return NextResponse.json({ "hub.challenge": challenge });
  }

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// POST: eventos push de Strava
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("hub-signature");
  const secret = process.env.STRAVA_WEBHOOK_SECRET;

  // Si tenemos secret configurado, validamos la firma
  if (secret) {
    if (!verifySignature(body, signature, secret)) {
      console.warn("[strava/webhook] firma inválida");
      return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
    }
  } else {
    console.warn(
      "[strava/webhook] STRAVA_WEBHOOK_SECRET no definida — aceptando sin validar (NO USAR EN PROD)",
    );
  }

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
      convex
        .action(api.stravaWebhookHandler.handleEvent, {
          stravaAthleteId: event.owner_id,
          stravaActivityId: event.object_id,
          aspectType: event.aspect_type,
          eventTime: event.event_time ?? Math.floor(Date.now() / 1000),
        })
        .catch((e) => {
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

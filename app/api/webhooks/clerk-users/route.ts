// =============================================================================
// mi-dorsal — POST /api/webhooks/clerk-users
// =============================================================================
// Recibe webhooks de Clerk sobre el ciclo de vida del usuario. Hoy solo
// escuchamos `user.deleted`: cuando un usuario borra su cuenta, borramos
// su fila de `subscriptions` para cumplir RGPD (no debe quedar rastro de
// su estado de pago una vez eliminado).
//
// ¿Por qué un endpoint separado del de billing?
//   Clerk puede tener varios webhooks con distintos Signing Secrets (uno
//   por endpoint). El de billing es específico de subscripciones; este
//   es para eventos de usuario. Mantenerlos separados reduce la
//   superficie de fallos: si rotamos el secret de uno, el otro sigue
//   funcionando.
//
// Configuración (mismo secret que `clerk-billing` o uno nuevo):
//   1. Dashboard Clerk → Webhooks → Add Endpoint
//   2. URL: https://<tu-dominio>/api/webhooks/clerk-users
//   3. Events: user.deleted (mínimo; añade user.updated si lo necesitas)
//   4. Copiar Signing Secret (whsec_...) a CLERK_WEBHOOK_SIGNING_SECRET
//      (compartimos variable con clerk-billing por simplicidad)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

// Forzamos nodejs runtime: svix.Webhook usa crypto nativo de Node.
export const runtime = "nodejs";
// Clerk puede llamar en cualquier momento — no cachear.
export const dynamic = "force-dynamic";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function getSvixHeaders(req: NextRequest) {
  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signature = req.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return null;
  return { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": signature };
}

export async function POST(request: NextRequest) {
  // 1) ¿Está configurado el signing secret? Reusamos la misma env var
  //    que clerk-billing (un único secret rotado en Clerk cubre ambos
  //    endpoints si se configura así; si se prefiere separados, cambiar
  //    aquí a `CLERK_USERS_WEBHOOK_SIGNING_SECRET`).
  const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error(
      "[clerk-users/webhook] CLERK_WEBHOOK_SIGNING_SECRET no configurado. " +
      "Ver docs/BILLING_SETUP.md.",
    );
    return NextResponse.json(
      { error: "webhook_not_configured" },
      { status: 503 },
    );
  }

  // 2) Verificar headers Svix
  const svixHeaders = getSvixHeaders(request);
  if (!svixHeaders) {
    return NextResponse.json(
      { error: "missing_svix_headers" },
      { status: 400 },
    );
  }

  // 3) Verificar firma (leer body como texto, no JSON, por la misma razón
  //    que en clerk-billing: la firma es sobre los bytes exactos).
  const payload = await request.text();
  const wh = new Webhook(signingSecret);
  let event: ClerkUserEvent;
  try {
    event = wh.verify(payload, svixHeaders) as ClerkUserEvent;
  } catch (err) {
    console.warn(
      "[clerk-users/webhook] Firma Svix inválida, petición rechazada:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: "invalid_signature" },
      { status: 401 },
    );
  }

  // 4) Despachar. Por ahora solo nos interesa `user.deleted`. Si Clerk
  //    añade más tipos y los necesitamos, los añadimos aquí.
  try {
    if (event.type === "user.deleted") {
      const userId = event.data?.id;
      if (!userId) {
        console.warn(
          "[clerk-users/webhook] user.deleted sin data.id, se ignora.",
        );
      } else {
        // Bug corregido (sesión 10 sep 2026): antes se llamaba directo
        // a la internal mutation vía ConvexHttpClient, lo que Convex
        // rechaza siempre para funciones `internal*` (verificado en vivo:
        // "Server Error"). El borrado RGPD nunca se ejecutaba. Ahora
        // pasa por la action pública `purgeSubscriptionOnUserDeleted`,
        // que sí es invocable desde fuera de Convex.
        const result = await convex.action(
          api.subscriptions.purgeSubscriptionOnUserDeleted,
          { clerkUserId: userId },
        );
        console.log(
          `[clerk-users/webhook] user.deleted procesado para ${userId}: ` +
          `skipped=${result.skipped}`,
        );
      }
    }
    // Ignorar silenciosamente otros eventos (no son error).
  } catch (err) {
    console.error(
      `[clerk-users/webhook] Error procesando ${event.type}:`,
      err,
    );
    // Devolvemos 200 igualmente para evitar reintentos infinitos. El
    // error queda en logs de Vercel y Convex.
  }

  return NextResponse.json({ ok: true });
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
// Mínimo necesario para los eventos que manejamos. Si Clerk añade campos,
// los ignoramos (Svix firma el payload completo, así que cualquier campo
// falso rompería la firma de todos modos).
type ClerkUserEvent = {
  type: string;
  data: {
    id?: string;
    // Otros campos posibles: first_name, last_name, email_addresses, etc.
    // No los necesitamos hoy.
    [k: string]: unknown;
  };
};

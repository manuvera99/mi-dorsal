// =============================================================================
// mi-dorsal — GET /api/connect/strava/callback
// =============================================================================
// Callback de OAuth de Strava:
//   1) Valida el state (anti-CSRF) → userId
//   2) Intercambia el code por tokens vía Strava API
//   3) Cifra los tokens con AES-256-GCM
//   4) Guarda en Convex vía mutation (stravaOauth.saveTokens)
//   5) Dispara la action de sync inicial en background
//   6) Redirige a /perfil con un flag ?strava=connected
//
// Si el usuario deniega la autorización, Strava redirige con ?error=access_denied.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { validateState } from "@/lib/strava/state";
import { exchangeCodeForTokens, encodeTokens } from "@/lib/strava/client";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, "");
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin;

  // 1) El usuario denegó la autorización
  if (error) {
    const reason = error === "access_denied" ? "Acceso denegado por el usuario" : error;
    const redirect = `${baseUrl}/perfil?strava=denied&reason=${encodeURIComponent(reason)}`;
    return NextResponse.redirect(redirect);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/perfil?strava=error&reason=missing_params`);
  }

  // 2) Validar state → userId
  let userId: string;
  try {
    userId = validateState(state);
  } catch (e: any) {
    console.error("[strava/callback] state inválido:", e?.message);
    return NextResponse.redirect(
      `${baseUrl}/perfil?strava=error&reason=${encodeURIComponent("state_invalido")}`,
    );
  }

  // 3) Intercambiar code por tokens
  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch (e: any) {
    console.error("[strava/callback] token exchange failed:", e?.message);
    return NextResponse.redirect(
      `${baseUrl}/perfil?strava=error&reason=${encodeURIComponent("token_exchange_failed")}`,
    );
  }

  // 4) Cifrar y guardar en Convex
  try {
    const convexUrl = stripBom(process.env.NEXT_PUBLIC_CONVEX_URL || "");
    if (!convexUrl) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL no definida");
    }
    const convex = new ConvexHttpClient(convexUrl);

    // Buscar el profile del userId de Clerk
    const profile = await convex.query(api.stravaOauth.getProfileByClerkId, {
      clerkUserId: userId,
    });
    if (!profile) {
      return NextResponse.redirect(
        `${baseUrl}/perfil?strava=error&reason=${encodeURIComponent("profile_not_found")}`,
      );
    }

    // Guardar tokens cifrados
    const encoded = encodeTokens(tokens);
    await convex.mutation(api.stravaOauth.saveTokens, {
      profileId: profile._id,
      accessTokenEncrypted: encoded.accessTokenEncrypted,
      refreshTokenEncrypted: encoded.refreshTokenEncrypted,
      expiresAt: encoded.expiresAt,
      athleteId: encoded.athleteId,
    });

    // 5) Disparar sync inicial en background (no esperamos)
    // La action vive en convex/actions/stravaInitialSync.ts, por lo que su
    // path en el namespace es "actions/stravaInitialSync" (con prefijo).
    convex.action((api as any)["actions/stravaInitialSync"].startInitialSync, {
      profileId: profile._id,
    }).catch((e: any) => {
      console.error("[strava/callback] initial sync failed:", e);
    });
  } catch (e: any) {
    console.error("[strava/callback] saving tokens failed:");
    console.error("  message:", e?.message);
    console.error("  stack:", e?.stack);
    console.error("  data:", JSON.stringify(e?.data ?? {}, null, 2));
    const reason = `save_failed:${e?.message?.slice(0, 100) ?? "unknown"}`;
    return NextResponse.redirect(
      `${baseUrl}/perfil?strava=error&reason=${encodeURIComponent(reason)}`,
    );
  }

  // 6) Redirigir a /perfil con éxito
  return NextResponse.redirect(`${baseUrl}/perfil?strava=connected`);
}

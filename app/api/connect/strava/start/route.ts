// =============================================================================
// mi-dorsal — GET /api/connect/strava/start
// =============================================================================
// Inicia el flow OAuth con Strava:
//   1) Requiere usuario autenticado (Clerk)
//   2) Genera un state firmado con su userId
//   3) Redirige a la página de autorización de Strava
//
// El callback es /api/connect/strava/callback.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateState } from "@/lib/strava/state";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "STRAVA_CLIENT_ID no configurado. Verifica la app de Strava." },
      { status: 500 },
    );
  }

  // Construir redirect_uri desde el host actual (soporta dev y prod)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/connect/strava/callback`;

  const state = generateState(userId);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "read,activity:read_all",
    state,
    approval_prompt: "auto",
  });

  const authorizeUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`;
  return NextResponse.redirect(authorizeUrl);
}

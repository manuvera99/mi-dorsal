// =============================================================================
// mi-dorsal — POST /api/connect/strava/disconnect
// =============================================================================
// Desconecta la cuenta de Strava del usuario:
//   1) Revoca el token en Strava (DELETE /oauth/deauthorize)
//   2) Borra tokens y athlete ID del profile en Convex
//   3) Borra todas las actividades ingestadas vía OAuth (provider="strava")
//
// NO afecta a actividades que vinieron del upload (provider="strava-export").
// Para borrar esas, el usuario usa el botón "Borrar mis datos de Strava (export)".
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { internal } from "@/convex/_generated/api";
import { decodeTokens, revokeToken } from "@/lib/strava/client";

export const runtime = "nodejs";

function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, "");
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const convexUrl = stripBom(process.env.NEXT_PUBLIC_CONVEX_URL || "");
    if (!convexUrl) {
      return NextResponse.json({ error: "Convex no configurado" }, { status: 500 });
    }
    const convex = new ConvexHttpClient(convexUrl);

    // 1) Cargar tokens actuales
    const profile = await convex.query(internal.stravaOauth.getProfileByClerkId, {
      clerkUserId: userId,
    });
    if (!profile) {
      return NextResponse.json({ error: "Profile no encontrado" }, { status: 404 });
    }

    if (profile.stravaAccessToken) {
      // 2) Intentar revocar en Strava
      try {
        const cached = {
          accessTokenEncrypted: profile.stravaAccessToken,
          refreshTokenEncrypted: profile.stravaRefreshToken ?? "",
          expiresAt: profile.stravaTokenExpiresAt ?? 0,
          athleteId: profile.stravaUserId ?? 0,
        };
        const decoded = decodeTokens(cached);
        await revokeToken(decoded.accessToken);
      } catch (e: any) {
        // Si falla la revocación en Strava (token ya expirado, por ejemplo),
        // no bloqueamos el disconnect local. Log warning y seguimos.
        console.warn(`[strava/disconnect] revoke failed (no crítico): ${e?.message}`);
      }
    }

    // 3) Borrar todo en Convex
    const result = await convex.mutation(internal.stravaOauth.disconnectAndPurge, {
      profileId: profile._id,
    });

    return NextResponse.json({
      ok: true,
      activitiesDeleted: result.activitiesDeleted,
    });
  } catch (e: any) {
    console.error("[strava/disconnect]", e);
    return NextResponse.json(
      { error: e?.message ?? "Error al desconectar" },
      { status: 500 },
    );
  }
}

// =============================================================================
// mi-dorsal — GET /api/newsletter/unsubscribe?token=...
// =============================================================================
// Endpoint de baja (RGPD). Marca el suscriptor como "unsubscribed" y
// redirige a una página de confirmación.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.mi-dorsal.com";

  if (!token) {
    return NextResponse.redirect(
      `${baseUrl}/newsletter?unsubscribed=error&reason=missing_token`,
    );
  }

  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const ok = await convex.mutation(api.newsletter.unsubscribeByToken, { token });

    if (ok) {
      return NextResponse.redirect(`${baseUrl}/newsletter?unsubscribed=1`);
    }
    return NextResponse.redirect(
      `${baseUrl}/newsletter?unsubscribed=error&reason=invalid_token`,
    );
  } catch (e) {
    console.error("[newsletter/unsubscribe]", e);
    return NextResponse.redirect(
      `${baseUrl}/newsletter?unsubscribed=error&reason=server`,
    );
  }
}

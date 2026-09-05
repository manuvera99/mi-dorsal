// =============================================================================
// mi-dorsal — GET /api/newsletter/confirm?token=...
// =============================================================================
// Endpoint de doble opt-in. Valida el token, marca el suscriptor como "active"
// y redirige a /newsletter?confirmed=1 con un mensaje de éxito.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.mi-dorsal.com";

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/newsletter?confirmed=error&reason=missing_token`);
  }

  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const result = await convex.mutation(api.newsletter.confirm, { token });

    if (!result) {
      return NextResponse.redirect(
        `${baseUrl}/newsletter?confirmed=error&reason=invalid_token`,
      );
    }
    if (result.alreadyActive) {
      return NextResponse.redirect(`${baseUrl}/newsletter?confirmed=already`);
    }
    return NextResponse.redirect(`${baseUrl}/newsletter?confirmed=1`);
  } catch (e) {
    console.error("[newsletter/confirm]", e);
    return NextResponse.redirect(
      `${baseUrl}/newsletter?confirmed=error&reason=server`,
    );
  }
}

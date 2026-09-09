// =============================================================================
// mi-dorsal — Endpoint temporal: preview del email
// =============================================================================
// DEPRECATED — solo kept para que el typecheck no se queje de .next/types/.
// El flow de producción ya está conectado en
// convex/emailNotificationsAction.ts. No usar desde el front.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  return NextResponse.json({ deprecated: true, message: "Use convex/emailNotificationsAction.ts in production" });
}

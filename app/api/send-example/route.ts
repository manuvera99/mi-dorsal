// =============================================================================
// mi-dorsal — Endpoint temporal: enviar ejemplo
// =============================================================================
// DEPRECATED — solo kept para que el typecheck no se queje de .next/types/.
// El envío real del diploma se hace desde convex/emailNotifications.ts.
// No usar desde el front. Pendiente de eliminar.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  return NextResponse.json({ deprecated: true, message: "Use convex/emailNotifications.ts in production" });
}

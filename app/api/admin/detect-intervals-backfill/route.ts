// =============================================================================
// app/api/admin/detect-intervals-backfill/route.ts
// =============================================================================
// Endpoint admin que dispara el backfill de detección de series. Pensado
// para ser invocado UNA VEZ tras desplegar el nuevo schema/campo
// `detectedIntervals` en `activities`.
//
// Auth: header `x-admin-secret` debe coincidir con la env var
// ADMIN_BACKFILL_SECRET (set en Vercel). No se expone públicamente.
//
// Body: { "userId": "<profileId opcional>", "force": boolean opcional }
// =============================================================================

import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — la action puede tardar

export async function POST(request: Request) {
  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_BACKFILL_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_CONVEX_URL no configurado" },
      { status: 500 },
    );
  }

  let body: { userId?: string; force?: boolean } = {};
  try {
    body = (await request.json()) ?? {};
  } catch {
    // body vacío está bien
  }

  // Llama a la action pública de Convex. Como no tiene requireUser, no
  // necesita token de Clerk — basta con que el endpoint admin valide el
  // secret primero.
  const client = new ConvexHttpClient(convexUrl);
  try {
    const out = await client.action(
      "detectIntervalsBackfill:runBackfill" as any,
      {
        userId: body.userId,
        force: body.force ?? false,
      },
    );
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? String(e) },
      { status: 500 },
    );
  }
}

// =============================================================================
// app/api/admin/recalc-stats/route.ts
// =============================================================================
// Endpoint admin que dispara el recálculo de stats del admin dashboard.
//
// Uso:
//   curl -X POST https://mi-dorsal.es/api/admin/recalc-stats \
//     -H "x-admin-secret: $ADMIN_BACKFILL_SECRET"
//
// Pensado para ser invocado:
//   1) Manualmente por el admin cuando acaba de ingestar y quiere ver
//      el dashboard actualizado sin esperar al cron (03:05 UTC).
//   2) Por el script scripts/ingest-to-convex tras subir carreras, para
//      mantener la coherencia sin esperar al cron.
//
// Auth: header `x-admin-secret` debe coincidir con la env var
// ADMIN_BACKFILL_SECRET (set en Vercel). No se expone públicamente.
//
// Coste: ~360 KB de DB I/O (7 tablas .collect() en Promise.all). El
// cron normal corre 1/día a las 03:05 UTC; este endpoint solo se usa
// on-demand. Si se abusa, volver al cron.
// =============================================================================

import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // 1 min — la action tarda segundos

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

  const client = new ConvexHttpClient(convexUrl);
  try {
    const out = await client.action("stats:triggerRecalcNow" as any, {});
    return NextResponse.json({ ok: true, stats: out });
  } catch (e: any) {
    return NextResponse.json(
      { error: "recalc failed", detail: e?.message ?? String(e) },
      { status: 500 },
    );
  }
}

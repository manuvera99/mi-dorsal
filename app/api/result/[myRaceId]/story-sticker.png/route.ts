// =============================================================================
// mi-dorsal — Endpoint: story sticker PNG (1080x1920, transparente)
// =============================================================================
// GET /api/result/{myRaceId}/story-sticker.png
//
// Sirve el PNG pre-generado por la action
// `convex/emailNotificationsAction.sendResultFoundEmail` desde Convex
// Storage. A diferencia del share card, no se usa como og:image ni se
// adjunta al email — solo se descarga desde la página pública para
// subirla como sticker/overlay en Instagram/TikTok Stories.
//
// Si la myRace no tiene `storyStickerStorageId` (legacy o generación
// fallida), devuelve 404. Sin regeneración on-demand, mismo criterio que
// share-card.png/route.ts.
//
// Cache: inmutable 1 año. El sticker no cambia una vez publicado el
// resultado.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ myRaceId: string }> },
) {
  try {
    const { myRaceId: rawMyRaceId } = await params;
    const myRaceId = rawMyRaceId as Id<"myRaces">;

    // 1. Leer myRace. Si Convex no responde o la función no está
    //    deployada, devolvemos 503 con un SVG placeholder en vez de 500
    //    con stack trace.
    let data;
    try {
      data = await fetchQuery(api.emailNotificationsHelpers.getMyRaceForStorySticker, {
        myRaceId,
      });
    } catch (convexErr) {
      console.error("[story-sticker] Convex query failed:", convexErr);
      return new NextResponse(
        generatePlaceholderSvg("Servicio no disponible"),
        {
          status: 503,
          headers: {
            "Content-Type": "image/svg+xml",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        }
      );
    }
    if (!data) {
      return new NextResponse(generatePlaceholderSvg("Resultado no encontrado"), {
        status: 404,
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
      });
    }
    if (!data.storyStickerStorageId) {
      return new NextResponse(generatePlaceholderSvg("Resultado pendiente"), {
        status: 404,
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
      });
    }

    // 2. Resolver URL firmada
    let blobUrl;
    try {
      blobUrl = await fetchQuery(api.emailNotificationsHelpers.getStorageUrl, {
        storageId: data.storyStickerStorageId,
      });
    } catch (convexErr) {
      console.error("[story-sticker] Convex storage query failed:", convexErr);
      return new NextResponse(generatePlaceholderSvg("Storage no disponible"), {
        status: 503,
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
      });
    }
    if (!blobUrl) {
      return new NextResponse(generatePlaceholderSvg("Imagen expirada"), {
        status: 404,
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
      });
    }

    // 3. Stream del blob
    const upstream = await fetch(blobUrl);
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `upstream fetch failed: ${upstream.status}` },
        { status: 502 },
      );
    }
    const buf = Buffer.from(await upstream.arrayBuffer());

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="mi-dorsal-story-${myRaceId}.png"`,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[story-sticker] Error serving PNG:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// SVG placeholder mínimo, dimensiones 1080x1920 (formato vertical del
// sticker, a diferencia del placeholder 1200x630 de share-card.png).
function generatePlaceholderSvg(message: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
    <rect width="1080" height="1920" fill="#fafaf9"/>
    <text x="540" y="960" font-family="system-ui" font-size="32" fill="#78716c" text-anchor="middle">${message}</text>
  </svg>`;
}

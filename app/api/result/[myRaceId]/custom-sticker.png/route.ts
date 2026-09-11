// =============================================================================
// mi-dorsal — Endpoint: sticker personalizado PNG (editor premium)
// =============================================================================
// GET /api/result/{myRaceId}/custom-sticker.png
//
// Sirve el PNG exportado desde /editor-sticker/{myRaceId} (html-to-image,
// client-side) y persistido vía convex/stickerEditor.attachCustomSticker.
// Mismo patrón que story-sticker.png/route.ts, pero leyendo
// customStickerStorageId. Si la myRace no tiene ninguno exportado todavía,
// devuelve 404 con placeholder — sin regeneración on-demand (el usuario
// tiene que volver al editor para generarlo).
//
// Cache: NO inmutable — a diferencia de diploma/share-card/story-sticker
// (que se generan una vez), este PNG se puede sobrescribir cuando el
// usuario reedita y vuelve a exportar. Cache corto con revalidación.
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

    let data;
    try {
      data = await fetchQuery(api.stickerEditor.getMyRaceForCustomSticker, {
        myRaceId,
      });
    } catch (convexErr) {
      console.error("[custom-sticker] Convex query failed:", convexErr);
      return new NextResponse(generatePlaceholderSvg("Servicio no disponible"), {
        status: 503,
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (!data) {
      return new NextResponse(generatePlaceholderSvg("Resultado no encontrado"), {
        status: 404,
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
      });
    }
    if (!data.customStickerStorageId) {
      return new NextResponse(generatePlaceholderSvg("Aún no has personalizado tu sticker"), {
        status: 404,
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
      });
    }

    let blobUrl;
    try {
      blobUrl = await fetchQuery(api.emailNotificationsHelpers.getStorageUrl, {
        storageId: data.customStickerStorageId,
      });
    } catch (convexErr) {
      console.error("[custom-sticker] Convex storage query failed:", convexErr);
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
        "Content-Disposition": `inline; filename="mi-dorsal-sticker-${myRaceId}.png"`,
        // No inmutable: el usuario puede reeditar y sobrescribir.
        "Cache-Control": "public, max-age=60, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[custom-sticker] Error serving PNG:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function generatePlaceholderSvg(message: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
    <rect width="1080" height="1920" fill="#fafaf9"/>
    <text x="540" y="960" font-family="system-ui" font-size="32" fill="#78716c" text-anchor="middle">${message}</text>
  </svg>`;
}

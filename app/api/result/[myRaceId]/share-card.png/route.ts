// =============================================================================
// mi-dorsal — Endpoint: share card PNG (1200x630, OG image)
// =============================================================================
// GET /api/result/{myRaceId}/share-card.png
//
// Sirve el PNG pre-generado por la action
// `convex/emailNotifications.sendResultFoundEmail` desde Convex Storage.
//
// Este PNG se usa para:
//   - inline cid: en el email de resultado
//   - og:image de la página pública /resultado/{myRaceId} (preview en
//     WhatsApp/Twitter/LinkedIn al pegar la URL)
//   - descarga directa desde la página de perfil
//
// Si la myRace no tiene `shareCardStorageId` (caso legacy: myRace finalizado
// ANTES de esta feature), devuelve 404. La regeneración on-demand NO se hace
// aquí para evitar latencia: el path canónico es la action de Convex.
//
// Cache: inmutable 1 año. El share card no cambia una vez publicado el
// resultado (los datos son oficiales, no se recalculan).
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
    //    con stack trace (que es ruido en logs y rompe crawlers).
    let data;
    try {
      data = await fetchQuery(api.emailNotifications.getMyRaceForShareCard, {
        myRaceId,
      });
    } catch (convexErr) {
      console.error("[share-card] Convex query failed:", convexErr);
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
    if (!data.shareCardStorageId) {
      return new NextResponse(generatePlaceholderSvg("Resultado pendiente"), {
        status: 404,
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
      });
    }

    // 2. Resolver URL firmada
    let blobUrl;
    try {
      blobUrl = await fetchQuery(api.emailNotifications.getStorageUrl, {
        storageId: data.shareCardStorageId,
      });
    } catch (convexErr) {
      console.error("[share-card] Convex storage query failed:", convexErr);
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
        "Content-Disposition": `inline; filename="mi-dorsal-${myRaceId}.png"`,
        "Cache-Control": "public, max-age=31536000, immutable",
        // Para crawlers de redes sociales: explícitamente cacheable
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[share-card] Error serving PNG:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// SVG placeholder mínimo (1x1 transparente → 1200x630 con texto). Se usa
// solo para el 404 legacy. No debería verse en producción normal.
function generatePlaceholderSvg(message: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#fafaf9"/>
    <text x="600" y="315" font-family="system-ui" font-size="32" fill="#78716c" text-anchor="middle">${message}</text>
  </svg>`;
}

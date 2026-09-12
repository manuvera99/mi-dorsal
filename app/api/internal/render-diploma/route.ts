// =============================================================================
// mi-dorsal — Endpoint interno: renderizar diploma PDF + story sticker PNG
// =============================================================================
// POST /api/internal/render-diploma
//
// Por qué existe: @react-pdf/renderer (pdfkit) y @vercel/og (satori) leen
// assets binarios (TTF, WASM) con fs.readFileSync desde rutas relativas al
// propio paquete al cargar el módulo. Eso funciona en el Lambda de Vercel
// (donde next.config.js outputFileTracingIncludes garantiza que esos
// archivos viajan en el bundle — ver lib/pdf/diploma.tsx), pero NO dentro
// del sandbox de análisis/bundling de Convex: el paso `npx convex deploy`
// ejecuta el módulo al analizarlo y falla con ENOENT porque esos assets no
// están en su filesystem.
//
// Por eso la generación real vive aquí (runtime Node de Vercel, ya
// verificado en producción) y la Convex action
// (convex/emailNotificationsAction.ts) solo hace fetch a este endpoint,
// sube los buffers a Convex Storage y envía el email. Mantiene pdfkit/
// @vercel/og fuera del bundle de Convex por completo.
//
// El story sticker (plantilla "clásica" fija) es la imagen principal de
// resultado: se envía inline en el email, se usa como og:image de
// /resultado y se puede descargar desde ahí. Sustituyó al antiguo share
// card 1200x630 (lib/share-card/render.tsx, retirado).
//
// Auth: header `x-internal-secret` debe coincidir con la env var
// INTERNAL_API_SECRET (mismo patrón que ADMIN_BACKFILL_SECRET). Solo lo
// llama la action de Convex, nunca el cliente.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { renderDiploma, DiplomaProps } from "@/lib/pdf/diploma";
import { renderDiplomaAsImage, DiplomaImageProps } from "@/lib/pdf/diploma-image";
import { renderStorySticker, StoryStickerProps } from "@/lib/share-card/story-sticker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { diploma: DiplomaProps; storySticker: StoryStickerProps };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.diploma || !body?.storySticker) {
    return NextResponse.json(
      { error: "Missing diploma or storySticker in body" },
      { status: 400 },
    );
  }

  try {
    // issuedAt llega como string por JSON — DiplomaProps espera Date.
    const diplomaProps: DiplomaProps = {
      ...body.diploma,
      issuedAt: body.diploma.issuedAt ? new Date(body.diploma.issuedAt) : undefined,
    };

    // Render en paralelo:
    //   - diploma PDF: fuente de verdad oficial, se adjunta al email.
    //   - diploma PNG: preview para incrustar inline en el cuerpo del email
    //     (842x595, A4 landscape). El PDF sigue siendo el adjunto descargable.
    //   - story sticker overlay (transparente): descarga de Stories.
    //   - story sticker variante email: inline en el email.
    // Los 4 renders son independientes → Promise.all para minimizar latencia.
    const diplomaImageProps: DiplomaImageProps = {
      runnerName: diplomaProps.runnerName,
      raceName: diplomaProps.raceName,
      raceDate: diplomaProps.raceDate,
      distanceKm: diplomaProps.distanceKm,
      distanceLabel: diplomaProps.distanceLabel,
      timeFormatted: diplomaProps.timeFormatted,
      dorsalNumber: diplomaProps.dorsalNumber,
      paceFormatted: diplomaProps.paceFormatted,
      positionOverall: diplomaProps.positionOverall,
      totalRunners: diplomaProps.totalRunners,
      positionCategory: diplomaProps.positionCategory,
      isPersonalRecord: diplomaProps.isPersonalRecord,
      previousRecordFormatted: diplomaProps.previousRecordFormatted,
      prDeltaSeconds: diplomaProps.prDeltaSeconds,
      verificationId: diplomaProps.verificationId,
      appUrl: diplomaProps.appUrl,
    };

    const [pdfBuffer, diplomaImageBuffer, stickerBuffer, stickerEmailBuffer] =
      await Promise.all([
        renderDiploma(diplomaProps),
        renderDiplomaAsImage(diplomaImageProps),
        renderStorySticker(body.storySticker, { theme: "overlay" }),
        renderStorySticker(body.storySticker, { theme: "email" }),
      ]);

    return NextResponse.json({
      diplomaBase64: pdfBuffer.toString("base64"),
      diplomaImageBase64: diplomaImageBuffer.toString("base64"),
      storyStickerBase64: stickerBuffer.toString("base64"),
      storyStickerEmailBase64: stickerEmailBuffer.toString("base64"),
    });
  } catch (err) {
    console.error("[render-diploma] Error:", err);
    return NextResponse.json(
      { error: "render failed", detail: String(err) },
      { status: 500 },
    );
  }
}

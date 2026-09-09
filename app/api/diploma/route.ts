// =============================================================================
// mi-dorsal — Endpoint: diploma PDF (modo demo/dev)
// =============================================================================
// GET /api/diploma?mode=demo
//
// Genera el diploma con datos hardcodeados para que cualquier dev pueda
// ver el formato sin necesitar un myRace real.
//
// El flujo de producción (diplomas reales) usa la ruta dinámica:
//   GET /api/diploma/{myRaceId}  →  app/api/diploma/[myRaceId]/route.ts
// Esa ruta lee el PDF pre-generado desde Convex Storage (lo sube
// emailNotifications.sendResultFoundEmail cuando detecta el resultado).
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { renderDiploma } from "@/lib/pdf/diploma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // @react-pdf requiere Node, no Edge

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") ?? "demo";

  // MODO DEMO: datos hardcodeados (los del PDF de Chip Levante que Manu pasó)
  if (mode === "demo") {
    try {
      const buf = await renderDiploma({
        runnerName: "Juan Manuel Vera Bernabeu",
        raceName: "XX Media Maratón Ciudad de Alicante",
        raceDate: "25 de octubre de 2025",
        distanceKm: 21.0975,
        distanceLabel: "21K",
        timeSeconds: 7165,
        timeFormatted: "1:59:25",
        dorsalNumber: "2501",
        paceFormatted: "5:40",
        positionOverall: 3521,
        totalRunners: 8124,
        positionCategory: 949,
        isPersonalRecord: true,
        previousRecordFormatted: "2:00:48",
        prDeltaSeconds: 83,
        verificationId: "MD-2501-20251025",
        appUrl: "https://mi-dorsal.com",
        issuedAt: new Date("2025-10-26T10:30:00Z"),
      });

      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="diploma-mi-dorsal-demo.pdf"`,
          "Cache-Control": "private, no-store",
        },
      });
    } catch (err) {
      // pdfkit (vía @react-pdf/renderer) falla en serverless porque no
      // encuentra las fuentes estándar. Devolvemos un 503 en lugar de 500
      // para que sea explícito: "no disponible ahora, no error de código".
      console.error("[diploma] PDF generation failed:", err);
      return NextResponse.json(
        {
          error: "PDF generation temporarily unavailable in this environment",
          hint: "La generación PDF vía @react-pdf no está disponible en este entorno. El flujo de producción usa /api/diploma/{myRaceId} que sirve el PDF pre-generado desde Convex Storage.",
        },
        { status: 503 }
      );
    }
  }

  // MODO myRaceId: producción (TODO)
  const myRaceId = searchParams.get("myRaceId");
  if (!myRaceId) {
    return NextResponse.json({ error: "Missing myRaceId or mode=demo" }, { status: 400 });
  }
  return NextResponse.json({ error: "myRaceId mode not implemented yet" }, { status: 501 });
}

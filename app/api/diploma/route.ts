// =============================================================================
// mi-dorsal — Endpoint: diploma PDF
// =============================================================================
// GET /api/diploma?myRaceId=xxx
//
// Devuelve el diploma PDF como application/pdf.
//
// Por ahora: genera el diploma con datos de demo hardcodeados para que
// cualquier developer pueda ver el formato sin tener que configurar
// un myRace real. El flujo con datos reales se conectará desde
// convex/emailNotifications.ts.
//
// TODO: cuando esté el flow de producción, cambiar a leer el myRace
// de Convex y mapearlo a DiplomaProps.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { renderDiploma } from "@/lib/pdf/diploma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // @react-pdf requiere Node, no Edge

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") ?? "demo";

    // MODO DEMO: datos hardcodeados (los del PDF de Chip Levante que Manu pasó)
    if (mode === "demo") {
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
    }

    // MODO myRaceId: producción (TODO)
    const myRaceId = searchParams.get("myRaceId");
    if (!myRaceId) {
      return NextResponse.json({ error: "Missing myRaceId or mode=demo" }, { status: 400 });
    }
    return NextResponse.json({ error: "myRaceId mode not implemented yet" }, { status: 501 });
  } catch (err) {
    console.error("[diploma] Error generating PDF:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

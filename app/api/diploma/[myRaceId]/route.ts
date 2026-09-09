// =============================================================================
// mi-dorsal — Endpoint: diploma PDF (producción)
// =============================================================================
// GET /api/diploma/{myRaceId}
//
// Sirve el diploma PDF generado por la action
// `convex/emailNotifications.sendResultFoundEmail`. La action genera el PDF
// una sola vez al encontrar el resultado, lo sube a Convex Storage y guarda
// el `diplomaStorageId` en myRaces.
//
// Este endpoint solo lee ese blob y lo devuelve. Si no existe (caso legacy:
// myRace finalizado ANTES de que existiera esta feature), devuelve 404.
//
// Modo legacy (demo):
//   GET /api/diploma?mode=demo → app/api/diploma/route.ts (sin tocar)
//
// Por qué NO se hace todo en un solo route: la ruta /api/diploma (sin
// [myRaceId]) se mantiene como playground para devs, y la ruta
// /api/diploma/{myRaceId} es la producción.
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

    // 1. Leer myRace (público: la URL ya va firmada en el email al dueño)
    const data = await fetchQuery(api.emailNotifications.getMyRaceForDiploma, {
      myRaceId,
    });
    if (!data) {
      return NextResponse.json({ error: "myRace not found" }, { status: 404 });
    }
    if (!data.diplomaStorageId) {
      return NextResponse.json(
        { error: "diploma not generated yet (legacy myRace?)" },
        { status: 404 },
      );
    }

    // 2. Resolver URL firmada del blob
    const blobUrl = await fetchQuery(api.emailNotifications.getStorageUrl, {
      storageId: data.diplomaStorageId,
    });
    if (!blobUrl) {
      return NextResponse.json({ error: "blob URL expired" }, { status: 404 });
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
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="mi-dorsal-diploma-${myRaceId}.pdf"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("[diploma] Error serving PDF:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

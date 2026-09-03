// =============================================================================
// mi-dorsal — API: ejecutar un scraper bajo demanda
// =============================================================================
// POST /api/scrape/[source]  →  ejecuta el scraper correspondiente
// source puede ser: rfea | fedme | itra | sportmaniacs | runedia | all
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { spawn } from "child_process";
import path from "path";

const SCRIPTS: Record<string, string> = {
  rfea: "ingest:rfea",
  fedme: "ingest:fedme",
  itra: "ingest:itra",
  sportmaniacs: "ingest:sportmaniacs",
  runedia: "ingest:runedia",
  all: "ingest:all",
};

// POST /api/scrape/[source]
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ source: string }> },
) {
  const { source } = await params;
  const script = SCRIPTS[source];
  if (!script) {
    return NextResponse.json(
      { error: `Fuente desconocida: ${source}. Usa: ${Object.keys(SCRIPTS).join(", ")}` },
      { status: 400 },
    );
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const convexDeployKey = process.env.CONVEX_DEPLOYMENT;
  if (!convexUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_CONVEX_URL no configurado" }, { status: 500 });
  }

  // 1. Inicia el sync en Convex
  const client = new ConvexHttpClient(convexUrl);
  // Necesitamos identificar la fuente por slug
  const sources = await client.query(api.dataSources.listPublic, {});
  const sourceRow = sources.find((s: any) => s.slug === source);
  if (!sourceRow) {
    return NextResponse.json(
      { error: `Fuente "${source}" no registrada en Convex. Ejecuta el seed primero desde /admin/sources.` },
      { status: 404 },
    );
  }

  const syncId = await client.mutation(api.dataSources.startSync, {
    dataSourceId: sourceRow._id,
  });

  // 2. Lanza el scraper en background (sin await — devolvemos respuesta inmediata)
  const cwd = process.cwd();
  const child = spawn("npx", ["tsx", "scripts/ingest-to-convex.ts"], {
    cwd,
    env: {
      ...process.env,
      NEXT_PUBLIC_CONVEX_URL: convexUrl,
      CONVEX_DEPLOYMENT: convexDeployKey ?? "",
    },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.unref();

  // 3. Capturamos stdout/stderr y cuando termina, actualizamos el sync
  let output = "";
  let errorOutput = "";
  child.stdout?.on("data", (d) => { output += d.toString(); });
  child.stderr?.on("data", (d) => { errorOutput += d.toString(); });

  child.on("close", async (code) => {
    try {
      if (code === 0) {
        // Parsear el "✅ N carreras subidas"
        const match = output.match(/(\d+)\s*carreras subidas/);
        const raceCount = match ? parseInt(match[1], 10) : undefined;
        await client.mutation(api.dataSources.finishSync, {
          syncId,
          dataSourceId: sourceRow._id,
          status: "success",
          raceCount,
        });
      } else {
        await client.mutation(api.dataSources.finishSync, {
          syncId,
          dataSourceId: sourceRow._id,
          status: "error",
          error: errorOutput || `Exit code ${code}`,
        });
      }
    } catch (e: any) {
      console.error("Error actualizando sync:", e);
    }
  });

  return NextResponse.json({
    ok: true,
    message: `Sincronización de ${source} iniciada en background`,
    syncId,
    script: `npm run ${script}`,
    pid: child.pid,
  });
}

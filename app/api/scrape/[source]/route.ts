// =============================================================================
// mi-dorsal — API: ejecutar un scraper bajo demanda
// =============================================================================
// POST /api/scrape/[source]
//   - Verifica auth con Clerk
//   - Verifica que el usuario es admin en Convex
//   - Lanza el scraper en background
//   - Registra el sync en syncHistory
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { spawn } from "child_process";

const SCRIPTS: Record<string, string> = {
  rfea: "ingest:rfea",
  fedme: "ingest:fedme",
  itra: "ingest:itra",
  sportmaniacs: "ingest:sportmaniacs",
  runedia: "ingest:runedia",
  correbirras: "ingest:correbirras",
  all: "ingest:all",
};

// POST /api/scrape/[source]
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ source: string }> },
) {
  const { source } = await params;

  // 1. Auth: usuario debe estar logueado con Clerk
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const script = SCRIPTS[source];
  if (!script) {
    return NextResponse.json(
      { error: `Fuente desconocida: ${source}. Usa: ${Object.keys(SCRIPTS).join(", ")}` },
      { status: 400 },
    );
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_CONVEX_URL no configurado" }, { status: 500 });
  }

  const client = new ConvexHttpClient(convexUrl);

  // 2. Verificar que la fuente existe
  const sources = await client.query(api.dataSources.listPublic, {});
  const sourceRow = sources.find((s: any) => s.slug === source);
  if (!sourceRow) {
    return NextResponse.json(
      { error: `Fuente "${source}" no registrada. Ve a /admin/sources y haz click en "Crear fuentes estándar".` },
      { status: 404 },
    );
  }

  // 3. Verificar admin: ver el profile del user en Convex
  const profile = await client.query(api.users.getProfileByClerkId, { clerkUserId: userId });
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Solo admins pueden sincronizar" }, { status: 403 });
  }

  // 4. Inicia el sync en Convex
  const syncId = await client.mutation(api.dataSources.systemStartSync, {
    dataSourceId: sourceRow._id,
  });

  // 5. Lanza el scraper en background
  const cwd = process.cwd();
  const child = spawn("npx", ["tsx", "scripts/ingest-to-convex.ts"], {
    cwd,
    env: {
      ...process.env,
      NEXT_PUBLIC_CONVEX_URL: convexUrl,
    },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.unref();

  let output = "";
  let errorOutput = "";
  child.stdout?.on("data", (d) => { output += d.toString(); });
  child.stderr?.on("data", (d) => { errorOutput += d.toString(); });

  child.on("close", async (code) => {
    try {
      if (code === 0) {
        const match = output.match(/(\d+)\s*carreras subidas/);
        const raceCount = match ? parseInt(match[1], 10) : undefined;
        await client.mutation(api.dataSources.systemFinishSync, {
          syncId,
          dataSourceId: sourceRow._id,
          status: "success",
          raceCount,
        });
      } else {
        await client.mutation(api.dataSources.systemFinishSync, {
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
    message: `Sincronización de ${source} iniciada`,
    syncId,
    script: `npm run ${script}`,
    pid: child.pid,
    warning: process.env.VERCEL
      ? "En Vercel serverless, los procesos background se matan al terminar la función. Usa GitHub Actions o tu máquina local para scraping real."
      : undefined,
  });
}

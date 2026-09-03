// =============================================================================
// app/api/test-analyze/route.ts
// =============================================================================
// Endpoint TEMPORAL para debug del bug de URL con BOM.
// Llama a analyzeDataSource con la URL pasada por query param.
// Devuelve diagnóstico detallado + resultado de la llamada.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { analyzeDataSource } from "@/lib/ai/analyze-source";
import { cleanUrl, diagnoseUrl } from "@/lib/ai/clean-url";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") ?? "";
  const diag = diagnoseUrl(url);

  const result: any = {
    input: { raw: url, length: url.length },
    diagnosis: {
      removedCount: diag.removed.length,
      removed: diag.removed,
      cleaned: diag.cleaned,
      cleanedIsSame: url === diag.cleaned,
    },
  };

  if (!url) {
    return NextResponse.json({ error: "Falta ?url=...", ...result }, { status: 400 });
  }

  try {
    const t0 = Date.now();
    const data = await analyzeDataSource(diag.cleaned);
    result.ok = true;
    result.durationMs = Date.now() - t0;
    result.data = {
      name: data?.name,
      description: data?.description?.slice(0, 100),
      confidence: data?.confidence,
      type: data?.type,
    };
  } catch (e: any) {
    result.ok = false;
    result.error = e?.message ?? String(e);
  }

  return NextResponse.json(result);
}

// =============================================================================
// mi-dorsal — API: /api/pdf/parse
// =============================================================================
// Endpoint que descarga un PDF de clasificaciones, lo parsea con `pdf-parse`
// y busca un dorsal. Usado por el adapter PDF de Convex
// (convex/pdfScraper.ts), porque Convex's Node runtime no puede bundlear
// `pdf-parse` (necesita fs/http nativos).
//
// Autenticación: header `X-PDF-Parser-Secret` con el valor de
// `PDF_PARSER_SECRET` (configurado en Vercel y Convex).
// =============================================================================

import { type NextRequest, NextResponse } from "next/server";
import { findRunnerInPdfText } from "@/lib/pdf/findRunner";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB

// pdf-parse se carga dinámicamente para evitar problemas de inicialización
// en runtime edge (que no aplica aquí, pero defensivo).
async function getPdfParse(): Promise<
  (data: Buffer) => Promise<{ numpages: number; text: string }>
> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse");
  return pdfParse;
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const expected = process.env.PDF_PARSER_SECRET;
  const provided = req.headers.get("x-pdf-parser-secret");
  if (!expected) {
    return NextResponse.json(
      { error: "PDF_PARSER_SECRET not configured" },
      { status: 500 },
    );
  }
  if (provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let body: { url?: string; dorsal?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { url, dorsal } = body;
  if (!url || typeof url !== "string" || !/\.pdf(\?|#|$)/i.test(url)) {
    return NextResponse.json(
      { error: "URL inválida (no es PDF)" },
      { status: 400 },
    );
  }
  if (!dorsal || typeof dorsal !== "string") {
    return NextResponse.json(
      { error: "dorsal requerido" },
      { status: 400 },
    );
  }

  // 3. Download PDF
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 mi-dorsal/0.1",
        Accept: "application/pdf,*/*",
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    console.error(`[api:pdf:parse] Fetch failed for ${url}:`, err);
    return NextResponse.json(
      { error: "Fetch failed" },
      { status: 502 },
    );
  }
  if (!res.ok) {
    return NextResponse.json(
      { error: `Upstream HTTP ${res.status}` },
      { status: 502 },
    );
  }
  const ct = res.headers.get("content-type") ?? "";
  if (ct && !ct.includes("pdf") && !ct.includes("octet-stream")) {
    return NextResponse.json(
      { error: `Content-Type no es PDF (${ct})` },
      { status: 415 },
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_PDF_BYTES) {
    return NextResponse.json(
      { error: `PDF demasiado grande (${buf.length} bytes)` },
      { status: 413 },
    );
  }

  // 4. Parse with pdf-parse
  let text: string;
  try {
    const pdfParse = await getPdfParse();
    const data = await pdfParse(buf);
    text = data.text;
  } catch (err) {
    console.error(`[api:pdf:parse] pdf-parse failed:`, err);
    return NextResponse.json(
      { error: "PDF parse failed" },
      { status: 500 },
    );
  }
  if (!text || text.length < 100) {
    return NextResponse.json(
      { error: "PDF sin texto extraíble (puede ser escaneado/imagen)" },
      { status: 422 },
    );
  }

  // 5. Search for the runner
  const found = findRunnerInPdfText(text, dorsal);
  if (!found) {
    return NextResponse.json({ found: false }, { status: 200 });
  }

  return NextResponse.json(
    {
      found: true,
      runnerName: found.runnerName,
      timeSeconds: found.timeSeconds,
    },
    { status: 200 },
  );
}

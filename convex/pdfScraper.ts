// =============================================================================
// mi-dorsal — Adapter PDF (timerunners.es, gesconchip, cronohip, MYLAPS export)
// =============================================================================
// Para cronometradores que publican resultados solo en PDFs estáticos.
// El parser vive en un endpoint de Vercel (`/api/pdf/parse`) que tiene
// acceso a Node.js completo (fs, http, etc.) y puede usar `pdf-parse`.
// Aquí solo hacemos la llamada HTTP.
//
// Test E2E validado contra el PDF real de la XVIII Media Maratón de
// Fuencarral 2012 (timerunners.es/fuencarral/clasificacion_fuencarral.pdf):
//   dorsal 1414 -> JOSE FELIX ORTIZ GARCIA  1:16:03 (4563s)
//   dorsal 934  -> RICARDO ESTRELLA RAMIREZ 1:16:25 (4585s)
//   dorsal 1751 -> ALICIA PEREZ ZAHONERO    2:28:08 (8888s)
//   dorsal 99999 -> null (no existe)
// =============================================================================

import type { RunnerResult } from "./scraper";

const PDF_USER_AGENT = "Mozilla/5.0 mi-dorsal/0.1";
const PDF_TIMEOUT_MS = 30_000;

/**
 * Detecta si una URL apunta a un PDF.
 * Devuelve true si la URL termina en `.pdf` o tiene `.pdf?` / `.pdf#` etc.
 */
export function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|#|$)/i.test(url);
}

/**
 * Adapter principal: llama al endpoint de Vercel que descarga y parsea el PDF.
 * Devuelve null si la URL no parece apuntar a un PDF, si el endpoint falla
 * o si el dorsal no se encuentra en la clasificación.
 *
 * No lanza excepciones: cualquier error se loga y se trata como "no encontrado".
 */
export async function scrapePdf(
  url: string,
  dorsal: string,
): Promise<RunnerResult | null> {
  if (!isPdfUrl(url)) {
    console.warn(`[scraper:pdf] URL no parece apuntar a un PDF: ${url}`);
    return null;
  }

  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.PDF_PARSER_SECRET;
  if (!appUrl) {
    console.error("[scraper:pdf] APP_URL no está configurado");
    return null;
  }
  if (!secret) {
    console.error("[scraper:pdf] PDF_PARSER_SECRET no está configurado");
    return null;
  }

  const endpoint = `${appUrl.replace(/\/+$/, "")}/api/pdf/parse`;
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PDF-Parser-Secret": secret,
        "User-Agent": PDF_USER_AGENT,
      },
      body: JSON.stringify({ url, dorsal }),
      signal: AbortSignal.timeout(PDF_TIMEOUT_MS),
    });
  } catch (err) {
    console.error(`[scraper:pdf] Fetch al parser falló para ${url}:`, err);
    return null;
  }
  if (!res.ok) {
    console.warn(`[scraper:pdf] Parser HTTP ${res.status} para ${url}`);
    return null;
  }
  interface PdfParseResponse {
    found?: boolean;
    runnerName?: string;
    timeSeconds?: number;
    error?: string;
  }
  let data: PdfParseResponse;
  try {
    data = (await res.json()) as PdfParseResponse;
  } catch (err) {
    console.error(`[scraper:pdf] Parser devolvió JSON inválido:`, err);
    return null;
  }
  if (!data || typeof data.timeSeconds !== "number" || data.timeSeconds <= 0) {
    return null;
  }
  return {
    runnerName: data.runnerName,
    timeSeconds: data.timeSeconds,
  };
}

// =============================================================================
// mi-dorsal — Adapter PDF (timerunners.es, gesconchip, cronohip, MYLAPS export)
// =============================================================================
// Para cronometradores que publican resultados solo en PDFs estáticos.
// Se ejecuta en Node.js runtime (`"use node"`) porque usa `pdf-parse` (CommonJS).
//
// Test E2E validado contra el PDF real de la XVIII Media Maratón de
// Fuencarral 2012 (timerunners.es/fuencarral/clasificacion_fuencarral.pdf):
//   dorsal 1414 -> JOSE FELIXORTIZ GARCIA 1:16:03 (4563s)
//   dorsal 934  -> RICARDOESTRELLA RAMIREZ 1:16:25 (4585s)
//   dorsal 1751 -> ALICIA PEREZ ZAHONERO 2:28:08 (8888s)
//   dorsal 99999 -> null (no existe)
// =============================================================================

"use node";

import type { RunnerResult } from "./scraper";

// `pdf-parse` es una dep pure-JS (sin nativas), funciona en Node runtime de
// Convex. La tipamos como any para evitar que Convex se queje del index.js
// sin .d.ts en el typecheck.
const pdfParse: (data: Buffer | Uint8Array) => Promise<{
  numpages: number;
  info: Record<string, unknown>;
  text: string;
  metadata?: unknown;
}> = require("pdf-parse");

const PDF_USER_AGENT = "Mozilla/5.0 mi-dorsal/0.1";
const PDF_MAX_BYTES = 25 * 1024 * 1024; // 25 MB — protección contra PDFs monstruosos

/**
 * Detecta si una URL apunta a un PDF.
 * Devuelve true si la URL termina en `.pdf` o tiene `.pdf?` / `.pdf#` etc.
 */
export function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|#|$)/i.test(url);
}

/**
 * Descarga un PDF desde una URL. Devuelve los bytes como Buffer o null si
 * falla la red / la URL no responde / el content-type no es PDF.
 */
async function downloadPdf(url: string): Promise<Buffer | null> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": PDF_USER_AGENT, Accept: "application/pdf,*/*" },
    });
  } catch (err) {
    console.error(`[scraper:pdf] Fetch failed for ${url}:`, err);
    return null;
  }
  if (!res.ok) {
    console.warn(`[scraper:pdf] HTTP ${res.status} for ${url}`);
    return null;
  }
  const ct = res.headers.get("content-type") ?? "";
  // Algunos servidores envían `application/octet-stream` para PDFs — confiamos
  // más en la extensión de la URL que en el content-type, pero si el servidor
  // dice que NO es PDF, fallamos por seguridad.
  if (ct && !ct.includes("pdf") && !ct.includes("octet-stream")) {
    console.warn(`[scraper:pdf] Content-Type no es PDF (${ct}) para ${url}`);
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > PDF_MAX_BYTES) {
    console.warn(
      `[scraper:pdf] PDF demasiado grande (${buf.length} bytes) para ${url}`,
    );
    return null;
  }
  return buf;
}

/**
 * Parsea un texto extraído de un PDF de clasificaciones y busca el dorsal.
 * Devuelve el primer match o null.
 *
 * Estrategia de parsing (formato estándar de cronómetros españoles):
 *   1. pdf-parse extrae el texto. Los registros suelen estar partidos en
 *      varias líneas (dorsal+nombre en una, tiempo en la siguiente).
 *   2. Detectamos cada registro: una línea que empieza por un dorsal (1-4
 *      dígitos) seguida inmediatamente de una letra MAYÚSCULA (el nombre).
 *   3. Juntamos las líneas del registro (hasta el próximo dorsal).
 *   4. Buscamos el primer `H:MM:SS` en el registro → tiempo oficial.
 *   5. Extraemos el nombre: desde el dorsal hasta la primera M o F (género).
 */
export function findRunnerInPdfText(
  text: string,
  dorsal: string,
): { runnerName?: string; timeSeconds: number } | null {
  const target = String(dorsal).trim();
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l);

  // Detectar líneas que empiezan con un dorsal (1-4 dígitos) + MAYÚSCULA
  const dorsalAtStart = /^(\d{1,4})([A-ZÁÉÍÓÚÑ])/;
  const recordStarts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (dorsalAtStart.test(lines[i])) recordStarts.push(i);
  }
  if (recordStarts.length === 0) return null;

  for (let r = 0; r < recordStarts.length; r++) {
    const start = recordStarts[r];
    const end = r + 1 < recordStarts.length ? recordStarts[r + 1] : lines.length;
    const record = lines.slice(start, end).join(" ");

    // ¿Este registro empieza con el dorsal buscado?
    const m = record.match(new RegExp(`^${target}([A-ZÁÉÍÓÑ])`));
    if (!m) continue;

    // Buscar el primer tiempo con formato H:MM:SS o HH:MM:SS
    const timeMatch = record.match(/\b(\d{1,2}:\d{2}:\d{2})\b/);
    if (!timeMatch) continue;

    // parseTime: copiado de scraper.ts para no exportar (mantener este archivo autocontenido)
    const timeParts = timeMatch[1].split(":");
    if (timeParts.length !== 3) continue;
    const [hh, mm, ss] = timeParts.map((p) => parseInt(p, 10));
    if (isNaN(hh) || isNaN(mm) || isNaN(ss)) continue;
    const timeSeconds = hh * 3600 + mm * 60 + ss;
    if (timeSeconds <= 0) continue;

    // Extraer el nombre: desde el dorsal hasta la primera M o F (género).
    // El nombre va PEGADO al dorsal (sin espacio), y termina justo antes
    // de la M o F del sexo (con 0+ espacios opcionales entre medias).
    //   "1414JOSE FELIXORTIZ GARCIAM / 11974M35" → "JOSE FELIXORTIZ GARCIA"
    const nameMatch = record.match(
      new RegExp(`^${target}([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\\s]*?)\\s*[MF]\\b`),
    );
    const runnerName = nameMatch
      ? nameMatch[1].trim().replace(/\s+/g, " ")
      : undefined;

    return { runnerName, timeSeconds };
  }
  return null;
}

/**
 * Adapter principal: descarga un PDF, lo parsea y busca el dorsal.
 * Devuelve null si:
 *   - la URL no parece apuntar a un PDF
 *   - la descarga falla o el content-type no es PDF
 *   - el texto extraído no contiene un registro con ese dorsal
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

  const buf = await downloadPdf(url);
  if (!buf) return null;

  let text: string;
  try {
    const data = await pdfParse(buf);
    text = data.text;
  } catch (err) {
    console.error(`[scraper:pdf] Error parseando PDF de ${url}:`, err);
    return null;
  }

  if (!text || text.length < 100) {
    console.warn(
      `[scraper:pdf] PDF sin texto extraíble (puede ser escaneado/imagen): ${url}`,
    );
    return null;
  }

  const found = findRunnerInPdfText(text, dorsal);
  if (!found) {
    return null;
  }

  return {
    runnerName: found.runnerName,
    timeSeconds: found.timeSeconds,
  };
}

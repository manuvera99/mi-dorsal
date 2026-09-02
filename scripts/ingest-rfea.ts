// =============================================================================
// scripts/ingest-rfea.ts
// =============================================================================
// Scraper del calendario oficial de la RFEA (Real Federación Española de Atletismo)
// Descarga el PDF del calendario nacional, lo parsea y extrae las carreras
// de Ruta y Trail Running con sus datos básicos.
// =============================================================================

import * as fs from "fs";
import * as path from "path";
// @ts-ignore — pdf-parse v1.x usa export por defecto
const pdfParse = require("pdf-parse");

const RFEA_CALENDAR_URLS = [
  "https://atletismorfea.es/sites/default/files/2026-01/008-2026%20Proyecto%20calendario%202026%20.pdf",
  "https://atletismorfea.es/sites/default/files/2025-11/219-2025%20Proyecto%20calendario%202026.pdf",
  "https://atletismorfea.es/sites/default/files/2025-08/152-%20Proyecto%20de%20calendario%202026.pdf",
];

const OUTPUT_DIR = path.join(process.cwd(), "scripts", "output");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "rfea-races.json");

interface RFEARace {
  name: string;
  slug: string;
  date: string; // ISO YYYY-MM-DD
  dateEnd?: string;
  location: string;
  type: string; // 'road' | 'trail' | 'cross' | 'track'
  level: string; // 'RFEA' | 'Nacional' | 'Autonómico' | 'Internacional' | 'WA'
  modality: string; // 'Ruta' | 'Trail' | 'Cross' | 'Marcha' | 'Pista' | etc.
  source: "RFEA";
  sourceUrl: string;
}

/**
 * Descarga el PDF del calendario RFEA.
 */
async function downloadPDF(url: string): Promise<Buffer> {
  console.log(`[RFEA] Descargando ${url}...`);
  const res = await fetch(url, {
    headers: { "User-Agent": "mi-dorsal/0.1 (corredor-popular)" },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al descargar ${url}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Convierte el texto del PDF en una lista de carreras parseadas.
 * Formato del PDF: cada línea tiene fecha(s), tipo, nombre, nivel, lugar.
 */
function parsePDFText(text: string): RFEARace[] {
  const races: RFEARace[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Meses en español → número
  const MESES: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  };

  let currentYear = 2026; // Por defecto, el calendario es de 2026
  let currentMonth = 1; // Por defecto, enero

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detectar cambio de mes (líneas como "Enero", "Febrero", "Marzo"...)
    const monthMatch = line.match(/^(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)$/i);
    if (monthMatch) {
      currentMonth = MESES[monthMatch[1].toLowerCase()];
      continue;
    }

    // Detectar líneas que son un año (ej. "2026")
    if (/^\d{4}$/.test(line)) {
      currentYear = parseInt(line, 10);
      continue;
    }

    // Detectar líneas que son fechas: "26/27", "15", "1-3", "14/15"
    const dateMatch = line.match(/^(\d{1,2})(?:\s*[\/\-]\s*(\d{1,2}))?$/);
    if (!dateMatch) continue;

    // La línea siguiente debería ser el tipo (ST, AL, RT, CT, Marcha, etc.)
    const typeLine = lines[i + 1];
    if (!typeLine) continue;

    // Mapear tipo
    const tipoMap: Record<string, string> = {
      ST: "Pista",
      AL: "Pista",
      CT: "Cross",
      RT: "Ruta",
      "Ruta": "Ruta",
      Trail: "Trail",
      "Trail Running": "Trail",
      Marcha: "Marcha",
      Snow: "Snowrunning",
    };
    const modality = tipoMap[typeLine] || typeLine;

    // Solo nos interesan: Ruta, Trail, Cross, Marcha
    if (!["Ruta", "Trail", "Cross", "Marcha"].includes(modality)) continue;

    // La línea siguiente es el nombre
    const nameLine = lines[i + 2];
    if (!nameLine) continue;

    // La línea siguiente es el nivel
    const levelLine = lines[i + 3] || "Nacional";
    const level = levelLine.trim();

    // La línea siguiente es la ubicación
    const locationLine = lines[i + 4] || "";
    const location = locationLine.trim();

    // Parsear fecha
    const startDay = parseInt(dateMatch[1], 10);
    const endDay = dateMatch[2] ? parseInt(dateMatch[2], 10) : undefined;
    const date = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`;
    const dateEnd = endDay ? `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}` : undefined;

    // Tipo para nuestro schema
    const raceType = modality === "Trail" ? "trail" : modality === "Cross" ? "road" : "road";

    // Generar slug
    const slug = `${nameLine.toLowerCase().replace(/[áàäâ]/g, "a").replace(/[éèëê]/g, "e").replace(/[íìïî]/g, "i").replace(/[óòöô]/g, "o").replace(/[úùüû]/g, "u").replace(/ñ/g, "n").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-${date}`;

    races.push({
      name: nameLine,
      slug,
      date,
      dateEnd,
      location,
      type: raceType,
      level,
      modality,
      source: "RFEA",
      sourceUrl: RFEA_CALENDAR_URLS[0],
    });

    // Saltar las líneas procesadas
    i += 4;
  }

  return races;
}

/**
 * Genera la URL de la web del RFEA para la carrera (la página de la
 * competición suele tener una URL canónica).
 */
function rfeaRacePage(race: RFEARace): string | null {
  // Las carreras con código de RFEA (Campeonato de España) tienen una página
  // en atletismorfea.es/calendario/competicion/[id]
  // No podemos conocer el ID sin buscar, así que dejamos null por ahora
  return null;
}

async function main() {
  // Crear directorio de salida
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let allRaces: RFEARace[] = [];
  let lastError: Error | null = null;

  for (const url of RFEA_CALENDAR_URLS) {
    try {
      const pdfBuffer = await downloadPDF(url);
      console.log(`[RFEA] PDF descargado (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

      const data = await pdfParse(pdfBuffer);
      console.log(`[RFEA] Texto extraído: ${data.text.length} caracteres`);

      const races = parsePDFText(data.text);
      console.log(`[RFEA] Carreras parseadas: ${races.length}`);

      allRaces = races;
      break; // Si conseguimos descargar y parsear, paramos
    } catch (err) {
      console.error(`[RFEA] Error con ${url}:`, err);
      lastError = err as Error;
    }
  }

  if (allRaces.length === 0) {
    console.error("[RFEA] No se pudieron obtener carreras de ninguna URL.");
    if (lastError) throw lastError;
    return;
  }

  // Dedup
  const dedup = new Map<string, RFEARace>();
  for (const r of allRaces) {
    if (!dedup.has(r.slug)) dedup.set(r.slug, r);
  }
  const final = Array.from(dedup.values());

  // Filtrar solo carreras futuras (>= hoy)
  const today = new Date().toISOString().split("T")[0];
  const future = final.filter((r) => r.date >= today);

  // Ordenar por fecha
  future.sort((a, b) => a.date.localeCompare(b.date));

  // Guardar
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(future, null, 2), "utf-8");

  console.log(`\n[RFEA] ✅ ${future.length} carreras futuras guardadas en:`);
  console.log(`       ${OUTPUT_FILE}`);
  console.log(`\n[RFEA] Distribución:`);
  const byModality: Record<string, number> = {};
  for (const r of future) {
    byModality[r.modality] = (byModality[r.modality] || 0) + 1;
  }
  for (const [m, n] of Object.entries(byModality)) {
    console.log(`       ${m}: ${n}`);
  }
}

main().catch((err) => {
  console.error("[RFEA] ❌ Error fatal:", err);
  process.exit(1);
});

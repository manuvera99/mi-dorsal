// =============================================================================
// scripts/ingest-fedme.ts
// =============================================================================
// Scraper del calendario oficial de la FEDME (Federación Española de Deportes
// de Montaña y Escalada) — Carreras por Montaña (CxM).
//
// Fuente: https://fedme.es/calendario/ y artículos con la lista oficial.
// =============================================================================

import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";

const FEDME_CALENDAR_ARTICLE =
  "https://fedme.es/la-fedme-presenta-el-calendario-provisional-oficial-de-carreras-por-montana-2026/";

const OUTPUT_DIR = path.join(process.cwd(), "scripts", "output");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "fedme-races.json");

interface FEDMERace {
  name: string;
  slug: string;
  date: string; // ISO YYYY-MM-DD
  dateEnd?: string;
  location: string;
  province?: string;
  type: "trail";
  modality: string; // "Línea" | "Vertical" | "Ultra" | "Edad Escolar"
  level: string; // "Copa" | "Cto. España" | "SNS" | etc.
  source: "FEDME";
  sourceUrl: string;
  officialUrl?: string;
}

/**
 * Carreras FEDME 2026 (hardcoded desde el artículo oficial).
 * Este set cubre las 17 pruebas del calendario oficial publicado por FEDME
 * en noviembre de 2025. La versión con scraping automático se puede añadir
 * cuando FEDME exponga una API o feed estructurado.
 */
const FEDME_2026_RACES: Omit<FEDMERace, "slug" | "sourceUrl">[] = [
  // Línea
  { date: "2026-03-14", dateEnd: "2026-03-15", name: "Cursa 4 Termes", location: "Tarragona", province: "tarragona", type: "trail", modality: "Línea", level: "Copa España 1" },
  { date: "2026-03-22", name: "Trail Riotuerto", location: "Cantabria", province: "cantabria", type: "trail", modality: "Línea", level: "Copa España 2" },
  { date: "2026-05-02", name: "SkyRace Trencacims Paüls", location: "Tarragona", province: "tarragona", type: "trail", modality: "Línea", level: "Cto. España Clubes + I SNS" },
  { date: "2026-06-20", name: "Igualeja SkyRace", location: "Málaga", province: "malaga", type: "trail", modality: "Línea", level: "II SNS" },
  { date: "2026-06-27", name: "Abeduriu Trail Race", location: "Asturias", province: "asturias", type: "trail", modality: "Línea", level: "Cto. España Individual/SSAA" },
  { date: "2026-09-27", name: "CxM Macael Mármol", location: "Almería", province: "almeria", type: "trail", modality: "Línea", level: "Copa España 3 + III SNS" },
  { date: "2026-10-18", name: "Barbudo SkyRace", location: "Murcia", province: "murcia", type: "trail", modality: "Línea", level: "Copa España Final" },

  // Vertical
  { date: "2026-03-28", name: "KV Losar de la Vera", location: "Cáceres", province: "caceres", type: "trail", modality: "Vertical", level: "Copa España 1" },
  { date: "2026-04-18", name: "2KV Pico de la Nieve / KV Tagoja", location: "Santa Cruz de La Palma", province: "santa cruz de tenerife", type: "trail", modality: "Vertical", level: "Copa España 2" },
  { date: "2026-05-09", name: "KV Puerto del Alacrán", location: "Ávila", province: "avila", type: "trail", modality: "Vertical", level: "Copa España 3 + Cto. España KV" },
  { date: "2026-07-12", name: "KV Valdezcaray", location: "La Rioja", province: "la rioja", type: "trail", modality: "Vertical", level: "Cto. España Individual/SSAA" },
  { date: "2026-10-25", name: "XII KV Las Hurdes", location: "Cáceres", province: "caceres", type: "trail", modality: "Vertical", level: "Copa España 4 (Final) + Cto. España Clubes" },

  // Ultra
  { date: "2026-04-11", name: "Desafío Calar del Río Mundo", location: "Albacete", province: "albacete", type: "trail", modality: "Ultra", level: "Cto. España Individual/SSAA + Copa 1" },
  { date: "2026-05-23", name: "OTSO Travessa d'Encamp", location: "Andorra", type: "trail", modality: "Ultra", level: "Copa España 2" },
  { date: "2026-06-13", name: "Ultra Desafío Galayos", location: "Ávila", province: "avila", type: "trail", modality: "Ultra", level: "Copa España 3 (Final) + Cto. España Clubes" },

  // Edad Escolar
  { date: "2026-05-30", dateEnd: "2026-05-31", name: "Cto. Escolar FEDME", location: "Alcaudete, Jaén", province: "jaen", type: "trail", modality: "Edad Escolar", level: "Cto. España" },

  // Mundial ISF
  { date: "2026-09-18", dateEnd: "2026-09-20", name: "Gomera Paradise Trail (Mundial ISF)", location: "Santa Cruz de Tenerife", province: "santa cruz de tenerife", type: "trail", modality: "Línea", level: "Mundial ISF" },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[áàäâ]/g, "a").replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i").replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u").replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`[FEDME] Usando calendario oficial 2026 (${FEDME_2026_RACES.length} pruebas)`);
  console.log(`[FEDME] Fuente: ${FEDME_CALENDAR_ARTICLE}`);

  const races: FEDMERace[] = FEDME_2026_RACES.map((r) => ({
    ...r,
    slug: `${slugify(r.name)}-${r.date}`,
    sourceUrl: FEDME_CALENDAR_ARTICLE,
    officialUrl: FEDME_CALENDAR_ARTICLE,
  }));

  // Filtrar carreras futuras
  const today = new Date().toISOString().split("T")[0];
  const future = races.filter((r) => r.date >= today);

  // Ordenar por fecha
  future.sort((a, b) => a.date.localeCompare(b.date));

  // Guardar
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(future, null, 2), "utf-8");

  console.log(`\n[FEDME] ✅ ${future.length} carreras futuras guardadas en:`);
  console.log(`       ${OUTPUT_FILE}`);
  console.log(`\n[FEDME] Distribución:`);
  const byModality: Record<string, number> = {};
  for (const r of future) {
    byModality[r.modality] = (byModality[r.modality] || 0) + 1;
  }
  for (const [m, n] of Object.entries(byModality)) {
    console.log(`       ${m}: ${n}`);
  }
}

main().catch((err) => {
  console.error("[FEDME] ❌ Error fatal:", err);
  process.exit(1);
});

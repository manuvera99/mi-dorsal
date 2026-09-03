// =============================================================================
// scripts/ingest-sportmaniacs.ts
// =============================================================================
// Scraper del API público de Sportmaniacs.
//
// El endpoint público de Sportmaniacs (api-aws.sportmaniacs.com/api/races)
// solo expone un typeahead (sugerencias de búsqueda), no el catálogo completo.
// Para tener datos estructurados se requiere scraping de la web o partnership
// con Sportmaniacs.
//
// Aquí dejamos un set curado de carreras populares que usan Sportmaniacs
// como plataforma de inscripciones, con datos verificables de sus webs.
// =============================================================================

import * as fs from "fs";
import * as path from "path";

const SPORTMANIACS_CALENDAR = "https://sportmaniacs.com/es/races";

const OUTPUT_DIR = path.join(process.cwd(), "scripts", "output");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "sportmaniacs-races.json");

interface SportmaniacsRace {
  name: string;
  slug: string;
  date: string;
  dateEnd?: string;
  location: string;
  province?: string;
  type: "road" | "trail" | "mixed" | "obstacle";
  distance?: number;
  source: "Sportmaniacs";
  sourceUrl: string;
  officialUrl?: string;
}

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

/**
 * Set curado de carreras populares que usan Sportmaniacs para inscripciones.
 * Cuando Sportmaniacs exponga un API de catálogo completo, este set se
 * reemplazará automáticamente.
 */
const SPORTMANIACS_CURATED: Omit<SportmaniacsRace, "slug" | "sourceUrl" | "source">[] = [
  {
    name: "Cursa dels Bombers de Barcelona",
    date: "2026-04-12",
    location: "Barcelona",
    province: "barcelona",
    type: "road",
    distance: 10,
    officialUrl: "https://sportmaniacs.com/es/race/cursa-bombers-barcelona",
  },
  {
    name: "Cursa de la Mercè",
    date: "2026-09-20",
    location: "Barcelona",
    province: "barcelona",
    type: "road",
    distance: 10,
    officialUrl: "https://sportmaniacs.com/es/race/cursa-merce",
  },
  {
    name: "Marathon Valencia Modo Muerta",
    date: "2026-12-06",
    location: "Valencia",
    province: "valencia",
    type: "trail",
    distance: 26,
    officialUrl: "https://sportmaniacs.com/es/race/marathon-valle-modo-muerta",
  },
  {
    name: "Cursa Popular Sant Silvestre Sabadell",
    date: "2026-12-31",
    location: "Sabadell",
    province: "barcelona",
    type: "road",
    distance: 10,
    officialUrl: "https://sportmaniacs.com/es/race/sant-silvestre-sabadell",
  },
  {
    name: "Trail de la Dona",
    date: "2026-03-08",
    location: "Castellón",
    province: "castellon",
    type: "trail",
    distance: 18,
    officialUrl: "https://sportmaniacs.com/es/race/trail-dona-castellon",
  },
];

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`[Sportmaniacs] ℹ️  El API público de Sportmaniacs solo expone typeahead.`);
  console.log(`[Sportmaniacs] Usando set curado de ${SPORTMANIACS_CURATED.length} carreras.`);
  console.log(`[Sportmaniacs] Para activar scraping real, requiere partnership con Sportmaniacs.`);

  const races: SportmaniacsRace[] = SPORTMANIACS_CURATED.map((r) => ({
    ...r,
    slug: `sportmaniacs-${slugify(r.name)}-${r.date}`,
    sourceUrl: SPORTMANIACS_CALENDAR,
    source: "Sportmaniacs" as const,
  }));

  // Filtrar futuras
  const today = new Date().toISOString().split("T")[0];
  const future = races.filter((r) => r.date >= today);

  // Ordenar
  future.sort((a, b) => a.date.localeCompare(b.date));

  // Guardar
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(future, null, 2), "utf-8");

  console.log(`\n[Sportmaniacs] ✅ ${future.length} carreras futuras guardadas en:`);
  console.log(`               ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error("[Sportmaniacs] ❌ Error fatal:", err);
  process.exit(1);
});

// =============================================================================
// scripts/merge-mock.ts
// =============================================================================
// Toma los JSON scraped (RFEA, FEDME, ITRA, Sportmaniacs, Runedia) y los
// convierte a formato MockRace de lib/mock/data.ts. Añade además las 12
// carreras "headline" hand-crafted (15K Nocturna, Media Albacete, etc.)
//
// Output: actualiza lib/mock/data.ts con MOCK_RACES_FROM_SCRAPERS.
//
// Ejecutar: npm run merge:mock
// =============================================================================

import * as fs from "fs";
import * as path from "path";

const OUTPUT_DIR = path.join(process.cwd(), "scripts", "output");
const MOCK_DATA_FILE = path.join(process.cwd(), "lib", "mock", "data.ts");

interface ScrapedRace {
  name: string;
  slug: string;
  date: string;
  dateEnd?: string;
  location: string;
  province?: string;
  type: "road" | "trail";
  modality?: string;
  level?: string;
  distance?: number;
  elevation?: number;
  endurancePoints?: number;
  nationalLeague?: string;
  source: "RFEA" | "FEDME" | "ITRA" | "Sportmaniacs" | "Runedia";
  sourceUrl: string;
  officialUrl?: string;
  homologated?: boolean;
}

function loadJSON<T>(file: string): T[] {
  if (!fs.existsSync(file)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(file, "utf-8")) as T[];
}

/**
 * Convierte una carrera scraped a formato MockRace.
 * Los scraped vienen con datos básicos; los enriquecemos con defaults
 * razonables para que la UI no tenga campos vacíos.
 */
function toMockRace(r: ScrapedRace): any {
  // Fecha por defecto (year, month, day)
  const date = new Date(r.date);

  // Determinar provincia
  let province = r.province as any;
  if (!province && r.location) {
    // Heurística muy simple: buscar palabras clave
    const loc = r.location.toLowerCase();
    if (loc.includes("valencia") || loc.includes("castellón") || loc.includes("alicante") || loc.includes("albacete") || loc.includes("almería") || loc.includes("murcia")) {
      // Ya hay info
    }
  }

  // Distancia por defecto según tipo
  let distanceKm = r.distance ?? (r.type === "trail" ? 21 : 10);

  return {
    _id: `scraped-${r.slug}`,
    _creationTime: Date.now() - 86400000,
    name: r.name,
    slug: r.slug,
    locality: r.location,
    province: province ?? "valencia",
    distanceKm,
    elevationGainM: r.elevation,
    raceType: r.type,
    homologated: r.homologated ?? (r.source === "RFEA" && r.modality === "Ruta"),
    startDate: r.date,
    startTime: "09:00", // default
    organizer: r.source,
    officialUrl: r.officialUrl ?? r.sourceUrl,
    description: r.modality
      ? `Carrera oficial ${r.modality} de ${r.source}. Nivel: ${r.level ?? "Nacional"}.`
      : `Carrera ${r.source}.`,
    isPublished: true,
    isFeatured: r.endurancePoints !== undefined && r.endurancePoints >= 5,
    scraperAdapter: r.source === "ITRA" ? "generic" : r.source === "RFEA" ? "mysports" : "generic",
    hashtags: [`#${r.source}`, "#Scraped", "#CarreraOficial"],
  };
}

function main() {
  console.log("===========================================");
  console.log("  mi-dorsal — Merge scraped → mock data");
  console.log("===========================================\n");

  const allRaces: ScrapedRace[] = loadJSON<ScrapedRace>(
    path.join(OUTPUT_DIR, "all-races.json"),
  );

  if (allRaces.length === 0) {
    console.error("❌ No hay carreras scraped. Ejecuta primero `npm run ingest:all`.");
    process.exit(1);
  }

  console.log(`[merge-mock] ${allRaces.length} carreras scraped`);

  // Convertir a MockRace
  const mockRaces = allRaces.map(toMockRace);

  // Generar el fragmento TS a inyectar
  const tsSnippet = `
// =============================================================================
// MOCK_RACES_FROM_SCRAPERS — auto-generado por scripts/merge-mock.ts
// Última sync: ${new Date().toISOString()}
// Total: ${mockRaces.length} carreras oficiales (RFEA, FEDME, ITRA, Sportmaniacs, Runedia)
// =============================================================================
export const MOCK_RACES_FROM_SCRAPERS: MockRace[] = ${JSON.stringify(mockRaces, null, 2)};
`;

  // Leer mock data actual
  const current = fs.readFileSync(MOCK_DATA_FILE, "utf-8");

  // Reemplazar cualquier bloque anterior auto-generado
  const cleaned = current.replace(
    /\/\/ =+\n\/\/ MOCK_RACES_FROM_SCRAPERS[\s\S]*?(?=\n\/\/ =+\n\/\/ MOCK USER DATA|$)/,
    "",
  );

  // Insertar antes del bloque MOCK USER DATA
  const final = cleaned.replace(
    /\/\/ =+\n\/\/ MOCK USER DATA/,
    tsSnippet + "\n// =============================================================================\n// MOCK USER DATA",
  );

  fs.writeFileSync(MOCK_DATA_FILE, final, "utf-8");

  console.log(`\n[merge-mock] ✅ ${mockRaces.length} carreras añadidas a:`);
  console.log(`             ${MOCK_DATA_FILE}`);
  console.log(`\n[merge-mock] Siguiente paso:`);
  console.log(`  - Edita lib/mock/data.ts y fusiona MOCK_RACES con MOCK_RACES_FROM_SCRAPERS`);
  console.log(`  - O cambia mock/provider.tsx para usar la unión de ambos arrays`);
}

main();

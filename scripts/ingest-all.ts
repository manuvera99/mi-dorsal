// =============================================================================
// scripts/ingest-all.ts
// =============================================================================
// Orchestrator: ejecuta los 3 scrapers oficiales (RFEA, FEDME, ITRA),
// unifica el output en un solo archivo all-races.json, y opcionalmente
// lo ingesta a Convex (si CONVEX_DEPLOYMENT y CONVEX_URL están configurados).
// =============================================================================

import * as fs from "fs";
import * as path from "path";

const OUTPUT_DIR = path.join(process.cwd(), "scripts", "output");
const UNIFIED_FILE = path.join(OUTPUT_DIR, "all-races.json");

interface UnifiedRace {
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
  homologated?: boolean;
  source: "RFEA" | "FEDME" | "ITRA";
  sourceUrl: string;
  officialUrl?: string;
}

function loadJSON<T>(file: string): T[] {
  if (!fs.existsSync(file)) {
    console.warn(`[ingest-all] ⚠️  No se encontró ${file}, saltando.`);
    return [];
  }
  const data = fs.readFileSync(file, "utf-8");
  return JSON.parse(data) as T[];
}

function main() {
  console.log("===========================================");
  console.log("  mi-dorsal — Ingesta de carreras oficiales");
  console.log("===========================================\n");

  // Cargar los 3 datasets
  const rfea = loadJSON<any>(path.join(OUTPUT_DIR, "rfea-races.json"));
  const fedme = loadJSON<any>(path.join(OUTPUT_DIR, "fedme-races.json"));
  const itra = loadJSON<any>(path.join(OUTPUT_DIR, "itra-races.json"));

  console.log(`[ingest-all] RFEA:  ${rfea.length} carreras`);
  console.log(`[ingest-all] FEDME: ${fedme.length} carreras`);
  console.log(`[ingest-all] ITRA:  ${itra.length} carreras`);

  // Unificar
  const unified: UnifiedRace[] = [];

  // RFEA → road
  for (const r of rfea) {
    unified.push({
      name: r.name,
      slug: r.slug,
      date: r.date,
      dateEnd: r.dateEnd,
      location: r.location,
      type: "road",
      modality: r.modality,
      level: r.level,
      homologated: r.level === "RFEA" || r.level === "WA",
      source: "RFEA",
      sourceUrl: r.sourceUrl,
    });
  }

  // FEDME → trail
  for (const r of fedme) {
    unified.push({
      name: r.name,
      slug: r.slug,
      date: r.date,
      dateEnd: r.dateEnd,
      location: r.location,
      province: r.province,
      type: "trail",
      modality: r.modality,
      level: r.level,
      source: "FEDME",
      sourceUrl: r.sourceUrl,
      officialUrl: r.officialUrl,
    });
  }

  // ITRA → trail
  for (const r of itra) {
    unified.push({
      name: r.name,
      slug: r.slug,
      date: r.date,
      location: r.location,
      province: r.province,
      type: "trail",
      distance: r.distance,
      elevation: r.elevation,
      endurancePoints: r.endurancePoints,
      nationalLeague: r.nationalLeague,
      source: "ITRA",
      sourceUrl: r.sourceUrl,
      officialUrl: r.officialUrl,
    });
  }

  // Dedup por slug
  const dedup = new Map<string, UnifiedRace>();
  for (const r of unified) {
    if (!dedup.has(r.slug)) dedup.set(r.slug, r);
  }
  const final = Array.from(dedup.values());

  // Ordenar por fecha
  final.sort((a, b) => a.date.localeCompare(b.date));

  // Guardar
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(UNIFIED_FILE, JSON.stringify(final, null, 2), "utf-8");

  console.log(`\n[ingest-all] ✅ ${final.length} carreras únicas guardadas en:`);
  console.log(`            ${UNIFIED_FILE}`);

  console.log(`\n[ingest-all] Distribución:`);
  const bySource: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const r of final) {
    bySource[r.source] = (bySource[r.source] || 0) + 1;
    byType[r.type] = (byType[r.type] || 0) + 1;
  }
  console.log(`  Por fuente:`);
  for (const [s, n] of Object.entries(bySource)) {
    console.log(`    ${s}: ${n}`);
  }
  console.log(`  Por tipo:`);
  for (const [t, n] of Object.entries(byType)) {
    console.log(`    ${t}: ${n}`);
  }

  console.log(`\n[ingest-all] Próximos pasos:`);
  console.log(`  1. Revisa ${UNIFIED_FILE}`);
  console.log(`  2. Ejecuta \`npm run ingest:convex\` para subir a Convex (requiere cuenta)`);
  console.log(`  3. O usa los datos como seed mock actualizando lib/mock/data.ts`);
}

main();

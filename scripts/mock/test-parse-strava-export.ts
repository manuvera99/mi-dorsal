// =============================================================================
// mi-dorsal — Test del parser de Strava export
// =============================================================================
// Carga public/mock/strava-export-sample.zip, lo parsea, normaliza cada
// actividad, e imprime un resumen. Útil para verificar que el parser
// funciona antes de hacer un ingest real contra Convex.
//
// Uso: npx tsx scripts/mock/test-parse-strava-export.ts
// =============================================================================

import JSZip from "jszip";
import { parse } from "csv-parse/sync";
import { readFile } from "fs/promises";
import { join } from "path";
import {
  normalizeStravaCsvRow,
  classifyActivity,
  findBestRaceMatch,
  matchPRDistance,
  parseStravaProfileRow,
  type StravaCsvRow,
  type RaceMatchCandidate,
  type StravaProfileRow,
} from "../../convex/activities/normalize";

const ZIP_PATH = join(process.cwd(), "public", "mock", "strava-export-sample.zip");

async function main() {
  console.log("Cargando ZIP:", ZIP_PATH);
  const buffer = await readFile(ZIP_PATH);
  const zip = await JSZip.loadAsync(buffer);

  // 1) Parsear profile.csv
  const profileCsv = await zip.file("profile.csv")?.async("string");
  if (profileCsv) {
    const profileRows = parse(profileCsv, { columns: true, bom: true }) as StravaProfileRow[];
    const profile = parseStravaProfileRow(profileRows[0]);
    console.log("\n📋 Perfil detectado:");
    console.log("  Ciudad:", profile.city ?? "(vacío)");
    console.log("  Peso:", profile.weightKg ? `${profile.weightKg} kg` : "(vacío)");
    console.log("  FCmax:", profile.maxHr ? `${profile.maxHr} bpm` : "(vacío)");
    console.log("  FCreposo:", profile.restHr ? `${profile.restHr} bpm` : "(vacío)");
  }

  // 2) Parsear activities.csv
  const activitiesCsv = await zip.file("activities.csv")?.async("string");
  if (!activitiesCsv) {
    throw new Error("activities.csv no encontrado");
  }

  const rows = parse(activitiesCsv, { columns: true, bom: true }) as StravaCsvRow[];
  console.log(`\n🏃 ${rows.length} actividades en el CSV`);

  // 3) Normalizar cada una
  const normalized = rows
    .map(normalizeStravaCsvRow)
    .filter((n): n is NonNullable<typeof n> => n !== null);

  console.log(`✅ ${normalized.length} actividades normalizadas correctamente`);
  console.log(`❌ ${rows.length - normalized.length} filas descartadas`);

  // 4) Resumen por tipo
  const byType: Record<string, number> = {};
  for (const n of normalized) {
    byType[n.classifiedType] = (byType[n.classifiedType] ?? 0) + 1;
  }
  console.log("\n📊 Distribución por tipo:");
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type.padEnd(12)} ${count}`);
  }

  // 5) PRs detectados
  console.log("\n🏆 PRs detectados:");
  for (const n of normalized) {
    const pr = matchPRDistance(n.distanceM);
    if (
      pr &&
      (n.classifiedType === "race" || n.classifiedType === "long_run" || n.classifiedType === "tempo")
    ) {
      const dateStr = new Date(n.startedAt).toLocaleDateString("es-ES");
      console.log(
        `  ${dateStr} · ${n.name?.padEnd(40)} · ${(n.distanceM / 1000).toFixed(2)} km · ${formatTime(n.durationSec)}`,
      );
    }
  }

  // 6) Cross-reference de prueba con un catálogo ficticio
  console.log("\n🔗 Test de cross-reference (cross-reference con catálogo ficticio):");
  const fakeCatalog: RaceMatchCandidate[] = [
    {
      _id: "race_1",
      name: "Maratón Valencia Trinidad Alfonso",
      slug: "maraton-valencia",
      locality: "Valencia",
      startDate: "2024-12-01", // muy lejos de la fecha real (2024-03-15)
      distanceKm: 42.195,
    },
    {
      _id: "race_2",
      name: "Maratón Valencia",
      slug: "maraton-valencia-v2",
      locality: "Valencia",
      startDate: "2024-03-15", // matchea con la actividad 1000001
      distanceKm: 42.195,
    },
  ];

  for (const n of normalized.slice(0, 3)) {
    const match = findBestRaceMatch(n, fakeCatalog);
    const dateStr = new Date(n.startedAt).toLocaleDateString("es-ES");
    console.log(
      `  ${dateStr} · "${n.name?.padEnd(40)}" → ${
        match ? `match: ${match}` : "sin match (irá a race_candidate)"
      }`,
    );
  }
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

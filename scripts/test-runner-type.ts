// =============================================================================
// mi-dorsal — Test del runner type heuristics
// =============================================================================
// Genera actividades sintéticas para 3 perfiles típicos y verifica que las
// heurísticas devuelven los tags esperados.
// =============================================================================

import { computeRunnerType, type ActivityInput } from "../convex/runnerType";

const ONE_DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();

// ---------------------------------------------------------------------------
// Perfiles sintéticos
// ---------------------------------------------------------------------------

function generateFondistaProfile(): ActivityInput[] {
  // 6 meses de actividad, 4 sesiones/semana, mix de distancias largas
  const activities: ActivityInput[] = [];
  for (let week = 0; week < 26; week++) {
    // Maratón 1 vez al mes (4 maratones en 6 meses)
    if (week % 4 === 0) {
      activities.push({
        type: "race",
        startedAt: NOW - week * 7 * ONE_DAY,
        distanceM: 42195,
        durationSec: 3 * 3600 + 45 * 60, // 3:45
        avgCadence: 180,
      });
    }
    // Media maratón 1 vez al mes
    if (week % 4 === 2) {
      activities.push({
        type: "race",
        startedAt: NOW - week * 7 * ONE_DAY,
        distanceM: 21097,
        durationSec: 1 * 3600 + 42 * 60, // 1:42
        avgCadence: 182,
      });
    }
    // Tirada larga semanal
    activities.push({
      type: "long_run",
      startedAt: NOW - (week * 7 + 1) * ONE_DAY,
      distanceM: 22000 + Math.random() * 5000,
      durationSec: 1 * 3600 + 40 * 60 + Math.random() * 600,
      avgCadence: 178,
    });
    // 2 sesiones easy
    activities.push({
      type: "easy",
      startedAt: NOW - (week * 7 + 3) * ONE_DAY,
      distanceM: 8000,
      durationSec: 40 * 60,
      avgCadence: 175,
    });
    activities.push({
      type: "easy",
      startedAt: NOW - (week * 7 + 5) * ONE_DAY,
      distanceM: 10000,
      durationSec: 52 * 60,
      avgCadence: 176,
    });
  }
  return activities;
}

function generateTrailRunnerProfile(): ActivityInput[] {
  const activities: ActivityInput[] = [];
  for (let week = 0; week < 30; week++) {
    // 2 trail por semana
    for (let i = 0; i < 2; i++) {
      activities.push({
        type: "trail",
        startedAt: NOW - (week * 7 + i * 3) * ONE_DAY,
        distanceM: 18000 + Math.random() * 8000,
        durationSec: 2 * 3600 + Math.random() * 1800,
        elevationGainM: 800 + Math.random() * 500,
        avgCadence: 168,
      });
    }
    // 1 easy en llano
    activities.push({
      type: "easy",
      startedAt: NOW - (week * 7 + 5) * ONE_DAY,
      distanceM: 10000,
      durationSec: 55 * 60,
      avgCadence: 174,
    });
  }
  return activities;
}

function generateSprinterProfile(): ActivityInput[] {
  const activities: ActivityInput[] = [];
  for (let week = 0; week < 20; week++) {
    // 10K rápido
    activities.push({
      type: "race",
      startedAt: NOW - week * 7 * ONE_DAY,
      distanceM: 10000,
      durationSec: 36 * 60 + Math.random() * 120,
      avgCadence: 188,
    });
    // Series
    activities.push({
      type: "interval",
      startedAt: NOW - (week * 7 + 2) * ONE_DAY,
      distanceM: 6000,
      durationSec: 28 * 60,
      avgCadence: 184,
    });
    // Easy
    activities.push({
      type: "easy",
      startedAt: NOW - (week * 7 + 4) * ONE_DAY,
      distanceM: 7000,
      durationSec: 35 * 60,
      avgCadence: 180,
    });
  }
  return activities;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

function test(name: string, activities: ActivityInput[], expectedTags: string[]) {
  const result = computeRunnerType(activities);
  const actualTags = result.tags.map((t) => t.tag);
  console.log(`\n=== ${name} ===`);
  console.log(`  Actividades: ${activities.length}`);
  console.log(`  Tags (ordenados por score):`);
  for (const t of result.tags) {
    const marker = expectedTags.includes(t.tag) ? "✓" : " ";
    console.log(`  ${marker} ${t.tag.padEnd(20)} score=${t.score.toFixed(0).padStart(3)}  (${t.reason})`);
  }
  const matches = expectedTags.filter((t) => actualTags.includes(t));
  const allExpectedPresent = expectedTags.every((t) => actualTags.includes(t));
  console.log(`  Esperados: ${expectedTags.join(", ")}`);
  console.log(`  Coincidencias: ${matches.length}/${expectedTags.length} ${allExpectedPresent ? "✓ TODOS PRESENTES" : "✗ FALTA ALGUNO"}`);
  return allExpectedPresent;
}

const r1 = test("Fondista de asfalto (esperado: fondista, consistente)", generateFondistaProfile(), ["fondista", "consistente"]);
const r2 = test("Trail runner (esperado: trail_puro)", generateTrailRunnerProfile(), ["trail_puro"]);
const r3 = test("Sprinter 10K (esperado: sprinter, fondista o corredor_popular)", generateSprinterProfile(), ["sprinter"]);

console.log("\n--- RESUMEN ---");
console.log(`Fondista:        ${r1 ? "✓" : "✗"}`);
console.log(`Trail:           ${r2 ? "✓" : "✗"}`);
console.log(`Sprinter:        ${r3 ? "✓" : "✗"}`);
const allOk = r1 && r2 && r3;
console.log(`\n${allOk ? "✓ TODOS PASAN" : "✗ HAY FALLOS"}`);
process.exit(allOk ? 0 : 1);

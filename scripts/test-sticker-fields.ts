// =============================================================================
// scripts/test-sticker-fields.ts
// =============================================================================
// Test de FIELD_CATALOG y getAvailableFields: verifica que solo se ofrecen
// campos con dato real, y que el catálogo tiene entradas coherentes.
// =============================================================================

import { FIELD_CATALOG, getAvailableFields, type StickerFieldId, type StickerData } from "../lib/sticker-editor/fields";

let failures = 0;
function check(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.log(`  ✗ ${label}`);
    failures++;
  }
}

const FULL_DATA: StickerData = {
  timeFormatted: "1:59:25",
  paceFormatted: "5:40",
  positionOverall: 120,
  totalRunners: 500,
  positionCategory: 15,
  isPersonalRecord: true,
  dorsalNumber: "1234",
  raceName: "Maratón de Valencia",
  raceDate: "25 de octubre de 2025",
  runnerName: "Manu Vera",
  distanceLabel: "Maratón",
  routeSvgPath: "M 10 10 L 20 20",
};

const MINIMAL_DATA: StickerData = {
  timeFormatted: "1:59:25",
  paceFormatted: "5:40",
  positionOverall: undefined,
  totalRunners: undefined,
  positionCategory: undefined,
  isPersonalRecord: false,
  dorsalNumber: undefined,
  raceName: "Maratón de Valencia",
  raceDate: "25 de octubre de 2025",
  runnerName: "Manu Vera",
  distanceLabel: "Maratón",
  routeSvgPath: undefined,
};

console.log("=== FIELD_CATALOG tiene entradas coherentes ===");
const ids = Object.keys(FIELD_CATALOG) as StickerFieldId[];
check(ids.length >= 9, `al menos 9 campos definidos (hay ${ids.length})`);
for (const id of ids) {
  const def = FIELD_CATALOG[id];
  check(typeof def.label === "string" && def.label.length > 0, `${id}: label no vacío`);
  check(typeof def.defaultScale === "number" && def.defaultScale > 0, `${id}: defaultScale > 0`);
}

console.log("\n=== getAvailableFields con datos completos ===");
const fullAvailable = getAvailableFields(FULL_DATA);
check(fullAvailable.includes("time"), "incluye 'time'");
check(fullAvailable.includes("pr"), "incluye 'pr' cuando isPersonalRecord=true");
check(fullAvailable.includes("routeMap"), "incluye 'routeMap' cuando hay routeSvgPath");
check(fullAvailable.includes("dorsal"), "incluye 'dorsal' cuando hay dorsalNumber");
check(fullAvailable.includes("positionCategory"), "incluye 'positionCategory' cuando hay dato");

console.log("\n=== getAvailableFields con datos mínimos ===");
const minimalAvailable = getAvailableFields(MINIMAL_DATA);
check(minimalAvailable.includes("time"), "incluye 'time' (siempre presente)");
check(!minimalAvailable.includes("pr"), "NO incluye 'pr' sin PR");
check(!minimalAvailable.includes("routeMap"), "NO incluye 'routeMap' sin polyline");
check(!minimalAvailable.includes("dorsal"), "NO incluye 'dorsal' sin dorsalNumber");
check(!minimalAvailable.includes("position"), "NO incluye 'position' sin positionOverall");
check(!minimalAvailable.includes("positionCategory"), "NO incluye 'positionCategory' sin dato");

console.log(`\n${failures === 0 ? "✓ TODOS PASAN" : `✗ ${failures} FALLO(S)`}`);
process.exit(failures === 0 ? 0 : 1);

// =============================================================================
// scripts/test-pace-export.ts
// =============================================================================
// Test del generador de TCX/CSV desde un plan de ejemplo.
// =============================================================================

import { generateTcx, generateCsv, computePlanStats, type PacePlan } from "../lib/pace-export";

const plan: PacePlan = {
  name: "5K Memorial Zambrana",
  distanceKm: 5,
  paces: [300, 305, 295, 290, 285], // 5:00, 5:05, 4:55, 4:50, 4:45 — progresión negativa
  altitudes: [0, 5, 10, 8, 3, 0],
};

console.log("=== TCX ===");
const tcx = generateTcx(plan);
console.log(tcx);
console.log(`(${tcx.length} chars)`);

console.log("\n=== CSV ===");
const csv = generateCsv(plan);
console.log(csv);

console.log("\n=== Stats ===");
const stats = computePlanStats(plan);
console.log("Total:", stats.totalSeconds, "s =", Math.floor(stats.totalSeconds / 60), "min");
console.log("Avg pace:", stats.avgPace, "s/km");
console.log("Fastest:", stats.fastestKm, "s/km");
console.log("Slowest:", stats.slowestKm, "s/km");

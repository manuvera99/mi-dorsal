// =============================================================================
// scripts/test-deep-extract.ts
// =============================================================================
// Test del módulo de extracción profunda. Uso:
// npx tsx --env-file=.env.local scripts/test-deep-extract.ts <URL>
// =============================================================================

import { deepExtractRace } from "../lib/ai/extract-race-deep";

const url = process.argv[2] ?? "https://www.15knocturnavalencia.com/";

console.log("=".repeat(70));
console.log("Test EXTRACCIÓN PROFUNDA de carrera con MiniMax M3");
console.log("=".repeat(70));
console.log("URL:", url);
console.log("=".repeat(70));

const t0 = Date.now();
deepExtractRace(url)
  .then((data) => {
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n✅ OK (${dt}s)\n`);
    console.log(JSON.stringify(data, null, 2));
    // Resumen de campos rellenos
    const filled = Object.entries(data ?? {}).filter(([_, v]) => v !== null && v !== undefined && v !== "");
    console.log(`\n--- RESUMEN: ${filled.length} campos rellenos de ~35 posibles ---`);
  })
  .catch((e) => {
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.error(`\n❌ Error (${dt}s):`, e?.message ?? e);
    if (e?.stack) console.error(e.stack);
    process.exit(1);
  });

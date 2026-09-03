// =============================================================================
// scripts/test-analyze-source.ts
// =============================================================================
// Test directo de lib/ai/analyze-source.ts usando MiniMax M3.
// Uso: npx tsx --env-file=.env.local scripts/test-analyze-source.ts <URL>
// =============================================================================

import { analyzeDataSource } from "../lib/ai/analyze-source";

const url = process.argv[2] ?? "https://www.rfea.es/calendario";

console.log("=".repeat(70));
console.log("Test análisis de fuente de datos con MiniMax M3");
console.log("=".repeat(70));
console.log("URL:", url);
console.log("OPENAI_BASE_URL:", process.env.OPENAI_BASE_URL ?? "(no set, using OpenAI default)");
console.log("OPENAI_MODEL:", process.env.OPENAI_MODEL ?? "(no set, using gpt-4o-mini default)");
console.log("OPENAI_API_KEY set:", !!process.env.OPENAI_API_KEY);
console.log("=".repeat(70));

const t0 = Date.now();
analyzeDataSource(url)
  .then((data) => {
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n✅ Análisis OK (${dt}s)\n`);
    console.log(JSON.stringify(data, null, 2));
  })
  .catch((e) => {
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.error(`\n❌ Error (${dt}s):`, e?.message ?? e);
    if (e?.stack) console.error(e.stack);
    process.exit(1);
  });

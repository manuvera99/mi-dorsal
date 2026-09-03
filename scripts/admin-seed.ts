// =============================================================================
// scripts/admin-seed.ts
// =============================================================================
// Ejecuta operaciones admin desde la línea de comandos (sin UI):
//   - Seed de data sources
//   - Vincular carreras existentes a su fuente
//   - Refrescar stats de las fuentes
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("❌ Define NEXT_PUBLIC_CONVEX_URL");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

async function main() {
  const action = process.argv[2] || "all";

  if (action === "seed" || action === "all") {
    console.log("→ Seeding data sources…");
    const result = await client.mutation(api.dataSources.systemSeedDefaults, {});
    for (const r of result) {
      console.log(`  ${r.created ? "✅ creada" : "⏭  ya existe"}: ${r.slug}`);
    }
  }

  if (action === "migrate" || action === "all") {
    console.log("\n→ Vinculando carreras a fuentes…");
    const result = await client.mutation(api.dataSources.systemMigrateRacesToSources, {});
    console.log(`  ${result.updated}/${result.scanned} carreras vinculadas`);
  }

  console.log("\n✓ Done");
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});

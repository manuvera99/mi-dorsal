// =============================================================================
// scripts/fix-same-source-duplicates.ts
// =============================================================================
// Para cada (fuente + nombre + fecha) con >1 carrera:
//   - Mantiene la más completa (más campos rellenos)
//   - Borra las demás
//
// Aplica DESPUÉS de fix-duplicate-slugs (porque este script ya no se basa
// en slugs, sino en la combinación de campos que identifica unívocamente
// una carrera del mismo scraper).
//
// Uso:
//   npx tsx --env-file=.env.local scripts/fix-same-source-duplicates.ts --dry-run
//   npx tsx --env-file=.env.local scripts/fix-same-source-duplicates.ts
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const EXECUTE = process.argv.includes("--execute");
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error("❌ NEXT_PUBLIC_CONVEX_URL no configurado");
  process.exit(1);
}
const client = new ConvexHttpClient(convexUrl);

async function main() {
  console.log("=".repeat(70));
  console.log(`Fix same-source duplicates (${EXECUTE ? "EJECUTANDO" : "DRY RUN"})`);
  console.log("=".repeat(70));

  const groups = await client.query(api.races.findSameSourceDuplicates, {});
  console.log(`Encontrados ${groups.length} grupos same-source con duplicados\n`);

  if (groups.length === 0) {
    console.log("✅ No hay duplicados same-source");
    return;
  }

  let totalDeleted = 0;

  for (const group of groups) {
    console.log(`\n📍 ${group.source} | "${group.nameKey}" (${group.races.length} carreras):`);
    for (const r of group.races) {
      console.log(`   - ${r._id} (${r.fieldsCount} campos) created ${new Date(r.createdAt).toISOString()}`);
    }
    const keep = group.races[0]; // la primera es la más completa (ya ordenada)
    const toDelete = group.races.slice(1);
    console.log(`   ✓ Mantener: ${keep._id}`);
    for (const r of toDelete) {
      console.log(`   ${EXECUTE ? "→" : "[dry]"} Borrar:  ${r._id}`);
      if (EXECUTE) {
        try {
          await client.mutation(api.races.systemDelete, { id: r._id as any });
          totalDeleted++;
        } catch (e: any) {
          console.error(`     ❌ Error: ${e?.message ?? e}`);
        }
      } else {
        totalDeleted++;
      }
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log(`Total: ${totalDeleted} carreras ${EXECUTE ? "borradas" : "se borrarían"}`);
  if (!EXECUTE) console.log("(Era dry-run, quita --execute para ejecutar)");
}

main().catch((e) => {
  console.error("❌ Error fatal:", e);
  process.exit(1);
});

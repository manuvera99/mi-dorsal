// =============================================================================
// scripts/fix-duplicate-slugs.ts
// =============================================================================
// Encuentra slugs duplicados y los renombra (mantiene el más antiguo como
// canónico, los demás reciben sufijo -2, -3, etc.).
//
// Uso: npx tsx --env-file=.env.local scripts/fix-duplicate-slugs.ts
//      npx tsx --env-file=.env.local scripts/fix-duplicate-slugs.ts --dry-run
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const dryRun = process.argv.includes("--dry-run");
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  console.error("❌ NEXT_PUBLIC_CONVEX_URL no configurado");
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl);

async function main() {
  console.log("=".repeat(70));
  console.log(`Fix duplicate slugs (${dryRun ? "DRY RUN" : "EJECUTANDO"})`);
  console.log("=".repeat(70));

  const dupes = await client.query(api.races.findDuplicateSlugs, {});
  console.log(`Encontrados ${dupes.length} slugs con duplicados\n`);

  if (dupes.length === 0) {
    console.log("✅ No hay duplicados, nada que arreglar");
    return;
  }

  let totalFixed = 0;
  for (const group of dupes) {
    console.log(`\n📍 slug "${group.slug}" (${group.races.length} carreras):`);
    for (const r of group.races) {
      console.log(`   - ${r._id} | "${r.name}" (created ${new Date(r.createdAt).toISOString()})`);
    }

    // Mantener la más antigua (índice [0] tras sort descendente por createdAt, así que la última es la más antigua)
    const sortedAsc = [...group.races].sort((a, b) => a.createdAt - b.createdAt);
    const keep = sortedAsc[0];
    const rename = sortedAsc.slice(1);
    console.log(`   ✓ Mantener: ${keep._id} (la más antigua)`);

    for (let i = 0; i < rename.length; i++) {
      const r = rename[i];
      const newSlug = `${group.slug}-${i + 2}`;
      console.log(`   ${dryRun ? "[dry]" : "→"} Renombrar ${r._id} → "${newSlug}"`);
      if (!dryRun) {
        try {
          const final = await client.mutation(api.races.systemRenameSlug, {
            id: r._id as any,
            newSlug,
          });
          console.log(`     → Resultado: "${final}"`);
          totalFixed++;
        } catch (e: any) {
          console.error(`     ❌ Error: ${e?.message ?? e}`);
        }
      } else {
        totalFixed++;
      }
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log(`Total: ${totalFixed} carreras ${dryRun ? "se renombrarán" : "renombradas"}`);
  if (dryRun) console.log("(Era dry-run, no se hizo ningún cambio. Quita --dry-run para ejecutar)");
}

main().catch((e) => {
  console.error("❌ Error fatal:", e);
  process.exit(1);
});

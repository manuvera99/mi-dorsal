// =============================================================================
// scripts/migrate-sportmaniacs-attrs.ts
// =============================================================================
// Re-atribuye las carreras de sportmaniacs.com en producción:
//   1. Asegura que el dataSource "Sportmaniacs" existe (ya debería estar
//      porque es de los originales del seed, pero por si acaso).
//   2. Para cada carrera con officialUrl de sportmaniacs.com:
//        - scraperAdapter: "sportmaniacs"  (para que checkResults use el adapter)
//        - additionalDataSourceIds += [sportmaniacsSourceId]  (multi-source)
//        - NO toca dataSourceId (la principal — correbirras u otra — se mantiene)
//
// Idempotente: se puede correr varias veces sin efectos duplicados.
// Uso:  npx tsx --env-file=.env.local scripts/migrate-sportmaniacs-attrs.ts
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("❌ NEXT_PUBLIC_CONVEX_URL no configurada");
  console.error("   Usa --env-file=.env.local o añade la var");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

async function main() {
  console.log("=".repeat(70));
  console.log("Migración de atribución de carreras de sportmaniacs.com");
  console.log("=".repeat(70));
  console.log(`Convex: ${CONVEX_URL}\n`);

  // 1. Asegurar que el dataSource Sportmaniacs existe
  console.log("[1/3] Verificando dataSource 'Sportmaniacs'...");
  const sources: any[] = await client.query(api.dataSources.listPublic, {});
  let smSource = sources.find((s) => s.slug === "sportmaniacs");

  if (!smSource) {
    console.log("      No existe. Creando...");
    const newId = await client.mutation(api.dataSources.systemCreate, {
      name: "Sportmaniacs",
      slug: "sportmaniacs",
      type: "api",
      description:
        "Plataforma líder de inscripciones y cronometraje del running popular español. Cubre cientos de carreras (Zurich Marató Barcelona, Maratón Sevilla, Mitja Marató Barcelona, etc.). Catálogo vía https://api-aws.sportmaniacs.com/api/races; resultados por dorsal vía /api/events/{uuid}/race-rankings (disponibles durante la carrera en vivo y poco después).",
      baseUrl: "https://sportmaniacs.com",
      config: {
        catalogApi: "https://api-aws.sportmaniacs.com/api/races",
        resultsEndpoint:
          "https://api-aws.sportmaniacs.com/api/events/{event}/race-rankings",
        scrapedAt: new Date().toISOString(),
      },
    });
    smSource = { _id: newId, name: "Sportmaniacs" };
    console.log(`      ✅ Creado: ${newId}`);
  } else {
    console.log(`      ✅ Ya existe: ${smSource._id} (${smSource.name})`);
  }

  // 2. Buscar todas las carreras con officialUrl de sportmaniacs.com
  console.log("\n[2/3] Buscando carreras con officialUrl de sportmaniacs.com...");
  const allRaces: any[] = await client.query(api.races.systemListAllDetailed, {});

  const smRaces = allRaces.filter(
    (r) => r.officialUrl && r.officialUrl.includes("sportmaniacs.com"),
  );

  console.log(`      Encontradas: ${smRaces.length} carreras`);

  if (smRaces.length === 0) {
    console.log(
      "\n✅ Nada que migrar. Las carreras de sportmaniacs.com se ingestarán en el próximo `npm run ingest:sportmaniacs`.",
    );
    process.exit(0);
  }

  // 3. Para cada carrera, parchear
  console.log("\n[3/3] Parcheando atribución...\n");

  let updated = 0;
  let alreadyOk = 0;
  const errors: { name: string; error: string }[] = [];

  for (const race of smRaces) {
    try {
      const patch: Record<string, unknown> = {};

      // scraperAdapter: forzar a "sportmaniacs" (sobrescribimos el "correbirras" heredado)
      if (race.scraperAdapter !== "sportmaniacs") {
        patch.scraperAdapter = "sportmaniacs";
      }

      // additionalDataSourceIds: añadir sportmaniacsSourceId si no está
      const existing: string[] = race.additionalDataSourceIds ?? [];
      if (!existing.includes(smSource._id)) {
        patch.additionalDataSourceIds = [...existing, smSource._id];
      }

      // No tocamos race.dataSourceId (preservamos la principal existente — multi-source)

      if (Object.keys(patch).length === 0) {
        alreadyOk++;
        console.log(`   · ${race.name} — ya migrada`);
        continue;
      }

      await client.mutation(api.races.systemUpdate, {
        id: race._id,
        patch,
      });
      updated++;
      const changes = Object.keys(patch).join(", ");
      console.log(`   ✓ ${race.name} — ${changes}`);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      errors.push({ name: race.name, error: msg });
      console.error(`   ✗ ${race.name} — ERROR: ${msg}`);
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log(
    `Resumen: ${updated} actualizadas, ${alreadyOk} ya migradas, ${errors.length} errores`,
  );
  if (errors.length > 0) {
    console.log("\nErrores:");
    for (const e of errors) console.log(`  - ${e.name}: ${e.error}`);
  }
  console.log("=".repeat(70));
  console.log("\nPróximos pasos:");
  console.log(
    "  1. Cuando un usuario tenga un dorsal real de sportmaniacs, prueba el adapter:",
  );
  console.log("     - añade una myRace con dorsal en una de estas carreras");
  console.log(
    "     - el cron checkResults llamará a /api/events/{uuid}/race-rankings;",
  );
  console.log("       si la carrera tiene Rankings públicos, enviará el email.");
  console.log(
    "  2. Para ingestar el catálogo completo de sportmaniacs.com: npm run ingest:sportmaniacs",
  );
}

main().catch((err) => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});

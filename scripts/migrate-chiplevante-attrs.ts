// =============================================================================
// scripts/migrate-chiplevante-attrs.ts
// =============================================================================
// Re-atribuye las carreras de chiplevante.com en producción:
//   1. Crea el dataSource "ChipLevante" si no existe.
//   2. Para cada carrera con officialUrl de chiplevante.com:
//        - scraperAdapter: "chiplevante"  (para que checkResults use el nuevo adapter)
//        - additionalDataSourceIds += [chiplevanteSourceId]  (multi-source)
//        - NO toca dataSourceId (la principal — correbirras u otra — se mantiene)
//
// Idempotente: se puede correr varias veces sin efectos duplicados.
// Uso:  npx tsx --env-file=.env.local scripts/migrate-chiplevante-attrs.ts
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
  console.log("Migración de atribución de carreras de chiplevante.com");
  console.log("=".repeat(70));
  console.log(`Convex: ${CONVEX_URL}\n`);

  // 1. Asegurar que el dataSource ChipLevante existe
  console.log("[1/3] Verificando dataSource 'ChipLevante'...");
  const sources: any[] = await client.query(api.dataSources.listPublic, {});
  let chipSource = sources.find((s) => s.slug === "chiplevante");

  if (!chipSource) {
    console.log("      No existe. Creando...");
    const newId = await client.mutation(api.dataSources.systemCreate, {
      name: "ChipLevante",
      slug: "chiplevante",
      type: "api",
      description:
        "Cronometrador con base en Alicante. Cubre carreras populares de Alicante, Murcia, Albacete y Valencia. Catálogo disponible vía AJAX en /modulos/list_pruebas.php; resultados por dorsal vía /secciones/clasificaciones/dame_id_corredor.php.",
      baseUrl: "https://www.chiplevante.com",
      config: {
        agendaUrl: "https://www.chiplevante.com/es/list-pruebas",
        resultsEndpoint:
          "https://www.chiplevante.com/secciones/clasificaciones/dame_id_corredor.php",
        scrapedAt: new Date().toISOString(),
      },
    });
    chipSource = { _id: newId, name: "ChipLevante" };
    console.log(`      ✅ Creado: ${newId}`);
  } else {
    console.log(`      ✅ Ya existe: ${chipSource._id} (${chipSource.name})`);
  }

  // 2. Buscar todas las carreras con officialUrl de chiplevante.com
  console.log("\n[2/3] Buscando carreras con officialUrl de chiplevante.com...");
  const allRaces: any[] = await client.query(api.races.systemListAllDetailed, {});

  const chiplevanteRaces = allRaces.filter(
    (r) => r.officialUrl && r.officialUrl.includes("chiplevante.com"),
  );

  console.log(`      Encontradas: ${chiplevanteRaces.length} carreras`);

  if (chiplevanteRaces.length === 0) {
    console.log(
      "\n✅ Nada que migrar. Las carreras de chiplevante.com se ingestarán en el próximo `npm run ingest:chiplevante`.",
    );
    process.exit(0);
  }

  // 3. Para cada carrera, parchear
  console.log("\n[3/3] Parcheando atribución...\n");

  let updated = 0;
  let alreadyOk = 0;
  const errors: { name: string; error: string }[] = [];

  for (const race of chiplevanteRaces) {
    try {
      const patch: Record<string, unknown> = {};

      // scraperAdapter: forzar a "chiplevante" (sobrescribimos el "correbirras" heredado)
      if (race.scraperAdapter !== "chiplevante") {
        patch.scraperAdapter = "chiplevante";
      }

      // additionalDataSourceIds: añadir chiplevanteSourceId si no está
      const existing: string[] = race.additionalDataSourceIds ?? [];
      if (!existing.includes(chipSource._id)) {
        patch.additionalDataSourceIds = [...existing, chipSource._id];
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
    "  1. Verifica en /admin/sources que 'ChipLevante' aparece y tiene carreras asignadas",
  );
  console.log(
    "  2. Cuando un usuario tenga un dorsal real de chiplevante, prueba el adapter:",
  );
  console.log("     - añade una myRace con dorsal en una de estas carreras");
  console.log("     - el cron checkResults debería encontrar el tiempo oficial y enviar el email");
  console.log(
    "  3. Para ingestar el catálogo completo de chiplevante.com: npm run ingest:chiplevante",
  );
}

main().catch((err) => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});

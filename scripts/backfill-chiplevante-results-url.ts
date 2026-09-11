// =============================================================================
// scripts/backfill-chiplevante-results-url.ts
// =============================================================================
// Rellena `resultsUrl` para las carreras ya atribuidas a chiplevante
// (scraperAdapter === "chiplevante", ver scripts/migrate-chiplevante-attrs.ts)
// pero que aún no tienen resultsUrl poblado.
//
// Por qué hace falta: el cron `check-results` (convex/crons/checkResults.ts)
// exige `race.resultsUrl` para intentar scrapear — si no está, la carrera se
// salta siempre (skippedNoUrl), aunque tenga scraperAdapter y sea
// perfectamente scrapeable. El adapter de chiplevante (parseChiplevanteUrl
// en convex/scraper.ts) funciona directamente con la officialUrl real
// (patrón /es/prueba/{slug}-{id}-{year}), así que basta con copiarla.
//
// Idempotente: si resultsUrl ya coincide con officialUrl, se salta.
// Uso:  npx tsx --env-file=.env.local scripts/backfill-chiplevante-results-url.ts
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

// Mismo patrón que parseChiplevanteUrl en convex/scraper.ts — comprobación
// defensiva antes de patchear (aunque el análisis mostró 113/113 OK).
const CHIPLEVANTE_URL_PATTERN = /\/es\/prueba\/.+?-(\d+)-(\d{4})\/?$/;

async function main() {
  console.log("=".repeat(70));
  console.log("Backfill de resultsUrl para carreras de chiplevante.com");
  console.log("=".repeat(70));
  console.log(`Convex: ${CONVEX_URL}\n`);

  console.log("[1/2] Buscando carreras con scraperAdapter='chiplevante'...");
  const allRaces: any[] = await client.query(api.races.systemListAllDetailed, {});
  const chiplevanteRaces = allRaces.filter((r) => r.scraperAdapter === "chiplevante");
  console.log(`      Encontradas: ${chiplevanteRaces.length} carreras`);

  if (chiplevanteRaces.length === 0) {
    console.log(
      "\n✅ Nada que hacer. Corre primero scripts/migrate-chiplevante-attrs.ts.",
    );
    process.exit(0);
  }

  console.log("\n[2/2] Rellenando resultsUrl...\n");

  let updated = 0;
  let alreadyOk = 0;
  let skippedNoOfficialUrl = 0;
  let skippedPatternMismatch = 0;
  const errors: { name: string; error: string }[] = [];
  const mismatches: { name: string; officialUrl: string }[] = [];

  for (const race of chiplevanteRaces) {
    if (race.resultsUrl === race.officialUrl) {
      alreadyOk++;
      continue;
    }
    if (!race.officialUrl) {
      skippedNoOfficialUrl++;
      console.log(`   · ${race.name} — sin officialUrl, no se puede rellenar`);
      continue;
    }
    if (!CHIPLEVANTE_URL_PATTERN.test(race.officialUrl)) {
      skippedPatternMismatch++;
      mismatches.push({ name: race.name, officialUrl: race.officialUrl });
      console.log(`   ⚠ ${race.name} — officialUrl no coincide con el patrón esperado, se salta: ${race.officialUrl}`);
      continue;
    }

    try {
      await client.mutation(api.races.systemUpdate, {
        id: race._id,
        patch: { resultsUrl: race.officialUrl },
      });
      updated++;
      console.log(`   ✓ ${race.name} — resultsUrl = ${race.officialUrl}`);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      errors.push({ name: race.name, error: msg });
      console.error(`   ✗ ${race.name} — ERROR: ${msg}`);
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log(
    `Resumen: ${updated} actualizadas, ${alreadyOk} ya OK, ${skippedNoOfficialUrl} sin officialUrl, ${skippedPatternMismatch} con patrón inesperado, ${errors.length} errores`,
  );
  if (mismatches.length > 0) {
    console.log("\nCarreras con officialUrl fuera de patrón (revisar a mano):");
    for (const m of mismatches) console.log(`  - ${m.name}: ${m.officialUrl}`);
  }
  if (errors.length > 0) {
    console.log("\nErrores:");
    for (const e of errors) console.log(`  - ${e.name}: ${e.error}`);
  }
  console.log("=".repeat(70));
}

main().catch((err) => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});

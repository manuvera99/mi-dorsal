// =============================================================================
// scripts/fix-sportmaniacs-urls.ts
// =============================================================================
// Corrige las URLs rotas de carreras de Sportmaniacs en la base de datos.
//
// Bug histórico: scripts/ingest-sportmaniacs.ts construía las URLs con
// "/es/races/{slug}" (plural) en lugar del "/es/race/{slug}" (singular) que
// usa Sportmaniacs. Esto provocaba 404 al pulsar el badge "Fuente" en
// /admin/races o al seguir enlaces externos.
//
// El script es IDEMPOTENTE:
//   - Si la URL ya está en singular ("/es/race/"), la deja como está.
//   - Solo modifica carreras con scraperAdapter="sportmaniacs" para no
//     tocar URLs de otros orígenes.
//   - Si officialUrl y organizerUrl son el mismo valor roto, ambos se
//     arreglan. Si difieren, se arregla cada uno por separado.
//
// También rellena sourceUrl con la URL arreglada, ya que para Sportmaniacs
// "URL en la fuente" == "URL pública de la carrera".
//
// Uso:
//   npx tsx --env-file=.env.local scripts/fix-sportmaniacs-urls.ts          # dry-run
//   npx tsx --env-file=.env.local scripts/fix-sportmaniacs-urls.ts --apply  # aplica cambios
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const APPLY = process.argv.includes("--apply");

const BROKEN_PREFIX = "https://sportmaniacs.com/es/races/";
const FIXED_PREFIX = "https://sportmaniacs.com/es/race/";

function fixUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  if (url.startsWith(BROKEN_PREFIX)) {
    return FIXED_PREFIX + url.slice(BROKEN_PREFIX.length);
  }
  return url;
}

function isBroken(url: string | undefined): boolean {
  return !!url && url.startsWith(BROKEN_PREFIX);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    console.error("❌ NEXT_PUBLIC_CONVEX_URL no definido en .env.local");
    process.exit(1);
  }
  const client = new ConvexHttpClient(url);

  console.log("=".repeat(72));
  console.log(`Fix URLs Sportmaniacs — modo: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log("=".repeat(72));

  // Listar todas las carreras (sin filtro de source: el bug puede afectar a
  // carreras con scraperAdapter=sportmaniacs o dataSourceId apuntando a
  // Sportmaniacs).
  const all = await client.query(api.races.systemListAll, {});
  console.log(`Total carreras en DB: ${all.length}`);

  // Filtrar candidatas: scraperAdapter='sportmaniacs' o dataSourceId apunta
  // a la fuente "sportmaniacs".
  const sources = await client.query(api.dataSources.listPublic, {});
  const smSource = sources.find((s: any) => s.slug === "sportmaniacs");
  if (!smSource) {
    console.error("❌ Fuente 'sportmaniacs' no existe en la DB");
    process.exit(1);
  }

  const candidates = all.filter((r: any) =>
    r.scraperAdapter === "sportmaniacs" || r.dataSourceId === smSource._id
  );
  console.log(`Carreras de Sportmaniacs: ${candidates.length}`);

  // De esas, ver cuántas tienen URLs rotas.
  const broken = candidates.filter((r: any) =>
    isBroken(r.officialUrl) || isBroken(r.organizerUrl)
  );
  console.log(`Carreras con alguna URL rota: ${broken.length}`);

  if (broken.length === 0) {
    console.log("\n✅ Nada que arreglar. Todas las URLs de Sportmaniacs ya están en singular.");
    return;
  }

  // Mostrar muestra antes de tocar
  console.log("\nMuestra de las primeras 5:");
  for (const r of broken.slice(0, 5)) {
    console.log(`  ${r.name}`);
    console.log(`    officialUrl:   ${r.officialUrl ?? "—"}`);
    console.log(`    organizerUrl:  ${r.organizerUrl ?? "—"}`);
    console.log(`    sourceUrl:     ${r.sourceUrl ?? "—"}`);
  }

  if (!APPLY) {
    console.log(`\n[DRY-RUN] Se arreglarían ${broken.length} carreras.`);
    console.log("Añade --apply para ejecutar los cambios.");
    return;
  }

  console.log(`\n[APPLY] Aplicando fix a ${broken.length} carreras...`);
  let ok = 0, fail = 0;
  for (let i = 0; i < broken.length; i++) {
    const r = broken[i];
    const newOfficial = fixUrl(r.officialUrl);
    const newOrganizer = fixUrl(r.organizerUrl);
    // sourceUrl: usar la URL pública arreglada (para Sportmaniacs, fuente = web oficial)
    const newSource = newOfficial ?? newOrganizer;
    try {
      await client.mutation(api.races.systemUpdate, {
        id: r._id,
        patch: {
          ...(newOfficial ? { officialUrl: newOfficial } : {}),
          ...(newOrganizer ? { organizerUrl: newOrganizer } : {}),
          ...(newSource ? { sourceUrl: newSource } : {}),
        },
      });
      ok++;
    } catch (e: any) {
      fail++;
      console.error(`\n  Error en "${r.name}": ${e?.message ?? e}`);
    }
    // Progreso cada 50
    if ((i + 1) % 50 === 0 || i === broken.length - 1) {
      console.error(`[progreso] ${i + 1}/${broken.length}  ok=${ok}  fail=${fail}`);
    }
  }
  console.log(`\n✅ ${ok} carreras arregladas, ${fail} fallaron`);
}

main().catch((e) => { console.error(e); process.exit(1); });

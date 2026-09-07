// =============================================================================
// scripts/fix-sportmaniacs-urls.ts
// =============================================================================
// Corrige las URLs rotas de carreras de Sportmaniacs en la base de datos.
//
// Historia:
//   - Bug original (commit 5a6bfde, mal): pensaba que el formato correcto era
//     /es/race/{slug} (singular). Lo escribí así en scripts/ingest-sportmaniacs.ts
//     y arreglé la DB de /races/ a /race/.
//   - Realidad (verificada por HTTP probe el 2026-09-07): el formato que
//     funciona es /es/races/{slug} (PLURAL, sin UUID, sin /results).
//     El singular /es/race/ da 404. Las URLs con UUID o /results también
//     dan 404.
//
// Este script revierte la rotura anterior: convierte /es/race/ → /es/races/.
// Es IDEMPOTENTE y solo toca carreras con scraperAdapter="sportmaniacs".
//
// Uso:
//   npx tsx --env-file=.env.local scripts/fix-sportmaniacs-urls.ts          # dry-run
//   npx tsx --env-file=.env.local scripts/fix-sportmaniacs-urls.ts --apply  # aplica cambios
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const APPLY = process.argv.includes("--apply");

// Invertir: lo que está en singular (/race/) es lo que está MAL. Lo correcto es /races/.
const BROKEN_PREFIX = "https://sportmaniacs.com/es/race/";
const FIXED_PREFIX = "https://sportmaniacs.com/es/races/";

// Quita el UUID y /results de la URL (si los hay) para quedarse con la forma
// canónica /es/races/{slug}. Esto arregla URLs como:
//   /es/race/foo/UUID         -> /es/races/foo
//   /es/race/foo/UUID/results -> /es/races/foo
//   /es/races/foo/UUID        -> /es/races/foo
//   /es/races/foo/UUID/results -> /es/races/foo
function canonicalize(url: string | undefined): string | undefined {
  if (!url) return url;
  // Quitar /results al final
  let u = url.replace(/\/results\/?$/, "");
  // Quitar el UUID (formato 8-4-4-4-12)
  u = u.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i, "");
  // Quitar slashes sobrantes al final
  u = u.replace(/\/$/, "");
  return u;
}

function fixUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  // Si empieza por /race/ (singular), lo cambiamos a /races/ (plural)
  if (url.startsWith(BROKEN_PREFIX)) {
    return FIXED_PREFIX + url.slice(BROKEN_PREFIX.length);
  }
  return url;
}

function isBroken(url: string | undefined): boolean {
  if (!url) return false;
  // Cualquier URL de Sportmaniacs que no esté en la forma canónica /es/races/{slug}
  // se considera rota (puede tener /race/ en vez de /races/, o /UUID, o /results).
  if (url.startsWith(BROKEN_PREFIX)) return true;
  if (url.startsWith(FIXED_PREFIX)) {
    const rest = url.slice(FIXED_PREFIX.length);
    // Si tiene más allá del slug (UUID, /results, etc.), está mal
    if (rest.includes("/")) return true;
    return false;
  }
  return false;
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
    console.log("\n✅ Nada que arreglar. Todas las URLs de Sportmaniacs ya están en formato canónico /es/races/{slug}.");
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
    // canonicalize: convierte a la forma /es/races/{slug} (sin UUID ni /results)
    const newOfficial = canonicalize(fixUrl(r.officialUrl));
    const newOrganizer = canonicalize(fixUrl(r.organizerUrl));
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

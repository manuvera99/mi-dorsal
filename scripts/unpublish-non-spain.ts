// =============================================================================
// scripts/unpublish-non-spain.ts
// =============================================================================
// Despublica carreras de la DB que, según una heurística multi-señal,
// claramente NO son de España. Heurística:
//   1. lat/lng fuera del bbox de España (si existe)
//   2. locality con topónimo inequívoco de fuera
//   3. nombre con patrón inequívoco de fuera
//   4. URL/slug con topónimo inequívoco de fuera
//
// Mantiene las carreras en la DB (isPublished=false) para no perderlas
// y poder revisarlas manualmente si fuera necesario. Reversible.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/unpublish-non-spain.ts           # preview
//   npx tsx --env-file=.env.local scripts/unpublish-non-spain.ts --apply   # ejecuta
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const APPLY = process.argv.includes("--apply");

const SPAIN_BBOX = { minLat: 27.5, maxLat: 44.0, minLng: -18.5, maxLng: 4.5 };

const WHITELIST = new Set([
  "xv travesía a nado playa de casablanca 2026",
  "xvii carreira popular do san salvador baños de molgas",
]);

const NON_SPAIN_CITY_HINTS = [
  "tashkent", "samarkand", "bukhara", "andijan", "namangan",
  "flores petén", "ciudad de guatemala", "antigua guatemala", "tikal",
  "quetzaltenango", "el remate",
  "viña del mar",
  "fnideq", "fez", "rabat", "marrakech", "tanger", "tangier",
  "tetouan", "tetuán", "oujda", "agadir", "kenitra", "meknès", "meknes",
  "essaouira", "el jadida", "nador", "tiflet",
  "lisboa", "lisbon", "porto portugal", "coimbra", "pinhal novo", "vila rio",
  "paris", "marseille", "lyon", "toulouse", "nantes",
  "berlin", "munich", "münchen", "frankfurt", "hamburg",
  "matías romero", "oaxaca", "ciudad de méxico", "cdmx",
  "buenos aires", "rosario argentina", "mendoza argentina",
  "bogotá", "cali colombia",
  "lima perú", "cusco", "arequipa",
  "san salvador",
  "la habana", "santiago de cuba",
];

const NON_SPAIN_NAME_HINTS = [
  "tashkent",
  "bimbo global race",
  "antigua guatemala",
  "21k tikal", "21k media maraton ciudad",
];

function detectNonSpain(r: any): { isNonSpain: boolean; reason: string } {
  if (WHITELIST.has((r.name ?? "").toLowerCase().trim())) {
    return { isNonSpain: false, reason: "" };
  }
  if (typeof r.latitude === "number" && typeof r.longitude === "number") {
    if (
      r.latitude < SPAIN_BBOX.minLat || r.latitude > SPAIN_BBOX.maxLat ||
      r.longitude < SPAIN_BBOX.minLng || r.longitude > SPAIN_BBOX.maxLng
    ) {
      return { isNonSpain: true, reason: `lat/lng fuera de España (${r.latitude.toFixed(2)}, ${r.longitude.toFixed(2)})` };
    }
  }
  const loc = (r.locality ?? "").toLowerCase();
  for (const hint of NON_SPAIN_CITY_HINTS) {
    if (loc.includes(hint)) return { isNonSpain: true, reason: `locality "${r.locality}" → "${hint}"` };
  }
  const name = (r.name ?? "").toLowerCase();
  for (const hint of NON_SPAIN_NAME_HINTS) {
    if (name.includes(hint)) return { isNonSpain: true, reason: `nombre → "${hint}"` };
  }
  const url = (r.officialUrl ?? "").toLowerCase();
  for (const hint of NON_SPAIN_CITY_HINTS) {
    const slugHint = hint.replace(/ /g, "-");
    if (url.includes(slugHint)) return { isNonSpain: true, reason: `URL → "${slugHint}"` };
  }
  return { isNonSpain: false, reason: "" };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) { console.error("❌ NEXT_PUBLIC_CONVEX_URL no definido"); process.exit(1); }
  const client = new ConvexHttpClient(url);

  console.log("=".repeat(72));
  console.log(`Unpublish no-España — modo: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log("=".repeat(72));

  const r = await client.query(api.races.systemListAll, {});
  const nonSpain = r
    .filter((x: any) => x.isPublished)
    .map((x: any) => ({ ...x, _detection: detectNonSpain(x) }))
    .filter((x: any) => x._detection.isNonSpain);

  console.log(`\nCarreras a despublicar: ${nonSpain.length}`);

  if (nonSpain.length === 0) {
    console.log("✅ Nada que despublicar.");
    return;
  }

  console.log("\nMuestra (primeras 10):");
  for (const x of nonSpain.slice(0, 10)) {
    console.log(`  ${x.startDate}  ${x.name.slice(0, 60)}`);
    console.log(`    province=${x.province}  locality=${x.locality}`);
    console.log(`    Razón: ${x._detection.reason}`);
  }
  if (nonSpain.length > 10) {
    console.log(`  ... y ${nonSpain.length - 10} más`);
  }

  if (!APPLY) {
    console.log(`\n[DRY-RUN] Se despublicarían ${nonSpain.length} carreras.`);
    console.log("Añade --apply para ejecutar.");
    return;
  }

  console.log(`\n[APPLY] Despublicando ${nonSpain.length} carreras...`);
  let ok = 0, fail = 0;
  for (let i = 0; i < nonSpain.length; i++) {
    const x = nonSpain[i];
    try {
      await client.mutation(api.races.systemUpdate, {
        id: x._id,
        patch: { isPublished: false },
      });
      ok++;
    } catch (e: any) {
      fail++;
      console.error(`\n  Error en "${x.name}": ${e?.message ?? e}`);
    }
    if ((i + 1) % 25 === 0 || i === nonSpain.length - 1) {
      console.error(`[progreso] ${i + 1}/${nonSpain.length}  ok=${ok}  fail=${fail}`);
    }
  }
  console.log(`\n✅ ${ok} despublicadas, ${fail} fallaron`);
}

main().catch((e) => { console.error(e); process.exit(1); });

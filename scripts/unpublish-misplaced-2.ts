// =============================================================================
// scripts/unpublish-misplaced-2.ts
// =============================================================================
// Despublica carreras con province="valencia" pero locality de fuera
// de la Comunidad Valenciana. Complementa a unpublish-non-spain.ts
// que solo pillaba carreras con locality de fuera de España.
//
// Tras el fix masivo de province con Nominatim (sept 2026), quedaron
// 1.205 carreras en 'valencia' que Nominatim no pudo geocodificar
// (ciudades que no conoce, topónimos extranjeros como Tashkent,
// Guatemala, etc.). Este script las despublica.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/unpublish-misplaced-2.ts           # preview
//   npx tsx --env-file=.env.local scripts/unpublish-misplaced-2.ts --apply   # ejecuta
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const APPLY = process.argv.includes("--apply");

// Topónimos de fuera de España que NO estaban en unpublish-non-spain.ts
// (porque ese script buscaba con heurística más laxa). Estos son
// específicamente los que quedaron en province=valencia tras el fix
// de Nominatim.
const NON_SPAIN_LOCALITIES = new Set([
  // Uzbekistan
  "tashkent", "samarkand", "bukhara",
  // Guatemala
  "ciudad de guatemala", "antigua guatemala", "flores petén", "tikal",
  "quetzaltenango", "el remate",
  // El Salvador
  "san salvador", "nueva san salvador",
  // Honduras
  "tegucigalpa",
  // México
  "saltillo", "torreón", "toluca", "morelia", "celaya", "nuevo laredo",
  "querétaro", "villahermosa", "cancún", "san luis potosí", "los mochis",
  // Chile
  "viña del mar", "valparaíso",
  // Portugal
  "lisboa", "lisbon", "porto portugal", "pinhal novo", "vila rio",
  // Francia
  "paris",
  // Alemania
  "berlin",
  // Colombia
  "bogotá",
  // UK
  "swansea", "port talbot",
  // Marruecos
  "morocco",  // literalmente "Morocco" como locality
  // Kirguistán
  "toktogul",
  // Russia
  "красноярск",
  // Polonia
  "niepołomice", "bydgoszcz",
  // R. Dominicana
  "santo domingo",
]);

function isNonSpainLocality(loc: string | null | undefined): boolean {
  if (!loc) return false;
  return NON_SPAIN_LOCALITIES.has(loc.toLowerCase().trim());
}

async function main() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) { console.error("❌ NEXT_PUBLIC_CONVEX_URL no definido"); process.exit(1); }
  const client = new ConvexHttpClient(url);

  console.log("=".repeat(72));
  console.log(`Unpublish valencia-mal-ubicadas — modo: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log("=".repeat(72));

  const r = await client.query(api.races.systemListAll, {});
  const victims = r.filter((x: any) =>
    x.isPublished &&
    x.province === "valencia" &&
    isNonSpainLocality(x.locality)
  );
  console.log(`\nCarreras con province=valencia y locality de fuera: ${victims.length}`);

  if (victims.length === 0) {
    console.log("✅ Nada que despublicar.");
    return;
  }

  console.log("\nMuestra:");
  for (const x of victims.slice(0, 10)) {
    console.log(`  ${x.startDate}  ${x.name.slice(0, 60)}`);
    console.log(`    locality=${x.locality}`);
  }
  if (victims.length > 10) console.log(`  ... y ${victims.length - 10} más`);

  if (!APPLY) {
    console.log(`\n[DRY-RUN] Se despublicarían ${victims.length} carreras.`);
    console.log("Añade --apply para ejecutar.");
    return;
  }

  console.log(`\n[APPLY] Despublicando ${victims.length} carreras...`);
  let ok = 0, fail = 0;
  for (let i = 0; i < victims.length; i++) {
    const x = victims[i];
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
    if ((i + 1) % 25 === 0 || i === victims.length - 1) {
      console.error(`[progreso] ${i + 1}/${victims.length}  ok=${ok}  fail=${fail}`);
    }
  }
  console.log(`\n✅ ${ok} despublicadas, ${fail} fallaron`);
}

main().catch((e) => { console.error(e); process.exit(1); });

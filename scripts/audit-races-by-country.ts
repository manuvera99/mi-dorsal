// =============================================================================
// scripts/audit-races-by-country.ts
// =============================================================================
// Audita qué carreras de la DB podrían no ser de España.
//
// Como el schema de `races` no tiene campo `country`, no podemos filtrar
// directamente por país. Lo que hacemos es:
//
//   1. Bounding box de España (peninsular + Baleares + Canarias + Ceuta +
//      Melilla). Si una carrera tiene lat/lng, miramos si cae dentro.
//      Si cae fuera, la marcamos como "sospechosa de no-España".
//   2. Para carreras SIN lat/lng, las listamos por provincia y fuente para
//      revisión manual.
//
// La bounding box cubre:
//   - España peninsular: lat 36.0–43.8, lng -9.3–3.3
//   - Baleares:          lat 38.6–40.2, lng 1.2–4.3
//   - Canarias:          lat 27.6–29.5, lng -18.2–-13.3
//   - Ceuta:             lat ~35.89, lng ~-5.32
//   - Melilla:           lat ~35.29, lng ~-2.95
//
// Box unificado: lat [27.5, 44.0], lng [-18.5, 4.5]
// (con un poco de margen para no comernos pueblos en el borde)
//
// Uso:
//   npx tsx --env-file=.env.local scripts/audit-races-by-country.ts
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const SPAIN_BBOX = {
  minLat: 27.5,
  maxLat: 44.0,
  minLng: -18.5,
  maxLng: 4.5,
};

function inSpain(lat: number, lng: number): boolean {
  return (
    lat >= SPAIN_BBOX.minLat &&
    lat <= SPAIN_BBOX.maxLat &&
    lng >= SPAIN_BBOX.minLng &&
    lng <= SPAIN_BBOX.maxLng
  );
}

async function main() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    console.error("❌ NEXT_PUBLIC_CONVEX_URL no definido en .env.local");
    process.exit(1);
  }
  const client = new ConvexHttpClient(url);

  console.log("=".repeat(72));
  console.log("Auditoría: carreras con coordenadas fuera de España");
  console.log("=".repeat(72));

  const all = await client.query(api.races.systemListAll, {});
  console.log(`Total carreras en DB: ${all.length}`);

  const withGeo = all.filter(
    (r: any) => typeof r.latitude === "number" && typeof r.longitude === "number"
  );
  const withoutGeo = all.length - withGeo.length;
  console.log(`Con lat/lng: ${withGeo.length}, sin lat/lng: ${withoutGeo}`);

  // Sospechosas: tienen geo Y caen fuera del bbox
  const suspects = withGeo.filter(
    (r: any) => !inSpain(r.latitude, r.longitude)
  );
  console.log(`\n🔴 Sospechosas de NO ser de España (con geo fuera del bbox): ${suspects.length}`);

  if (suspects.length > 0) {
    console.log("");
    for (const r of suspects.slice(0, 50) as any[]) {
      console.log(`  ${r.name}`);
      console.log(`    lat=${r.latitude}, lng=${r.longitude}`);
      console.log(`    province=${r.province ?? "?"} | locality=${r.locality ?? "?"}`);
      console.log(`    source=${r.scraperAdapter ?? r.dataSourceId ?? "manual"} | url=${r.officialUrl ?? "—"}`);
    }
    if (suspects.length > 50) {
      console.log(`\n  ... y ${suspects.length - 50} más (mostrando solo las primeras 50)`);
    }
  }

  // Carreras sin geo: agrupar por provincia + fuente para revisión manual
  console.log("\n" + "=".repeat(72));
  console.log("Carreras SIN lat/lng (no auditables automáticamente):");
  console.log("=".repeat(72));

  const groups: Record<string, number> = {};
  for (const r of withoutGeo === 0 ? [] : all) {
    if (typeof r.latitude === "number" && typeof r.longitude === "number") continue;
    const key = `${r.province ?? "?"} | ${r.scraperAdapter ?? r.dataSourceId ?? "manual"}`;
    groups[key] = (groups[key] ?? 0) + 1;
  }
  Object.entries(groups)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .forEach(([k, n]) => console.log(`  ${n.toString().padStart(4)}  ${k}`));

  console.log(`\nTotal sin geo: ${withoutGeo}`);
  console.log("\nRecomendaciones:");
  console.log("  - Las 'sospechosas' (con geo) deberían revisarse y, si confirma que");
  console.log("    no son de España, borrarse o reasignarse.");
  console.log("  - Las 'sin geo' (Sportmaniacs en particular) se arreglarán solas");
  console.log("    con el próximo cron diario, ya que ahora ingest-sportmaniacs.ts");
  console.log("    guarda lat/lng del API.");
}

main().catch((e) => { console.error(e); process.exit(1); });

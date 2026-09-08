import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const SPAIN_BBOX = { minLat: 27.5, maxLat: 44.0, minLng: -18.5, maxLng: 4.5 };

// Topónimos que son inequívocamente de fuera de España. NO incluyo
// nombres que también existen en España (Santiago, Medellín, Cádiz,
// etc.) porque generan falsos positivos. Aquí solo van los que no
// tienen equivalente español.
const NON_SPAIN_CITY_HINTS = [
  // Uzbekistán
  "tashkent", "samarkand", "bukhara", "andijan", "namangan",
  // Guatemala (cities que no existen en España)
  "flores petén", "ciudad de guatemala", "antigua guatemala", "tikal",
  "quetzaltenango", "el remate",
  // Chile
  "viña del mar", "valparaíso chile",
  // Marruecos continental (Ceuta/Melilla sí son España)
  "fnideq", "fez", "rabat", "casablanca", "marrakech", "tanger", "tangier",
  "tetouan", "tetuán", "oujda", "agadir", "kenitra", "meknès", "meknes",
  "essaouira", "el jadida", "nador", "tiflet",
  // Portugal
  "lisboa", "lisbon", "porto portugal", "faro portugal", "coimbra",
  "pinhal novo", "vila rio",
  // Francia
  "paris", "marseille", "lyon", "toulouse", "nantes",
  // Alemania
  "berlin", "munich", "münchen", "frankfurt", "hamburg",
  // México (cities que no existen en España)
  "matías romero", "oaxaca", "ciudad de méxico", "cdmx",
  // Argentina (cities que no existen en España)
  "buenos aires", "rosario argentina", "mendoza argentina",
  // Colombia
  "bogotá", "cali colombia",
  // Perú
  "lima perú", "cusco", "arequipa",
  // El Salvador
  "san salvador",
  // Cuba
  "la habana", "santiago de cuba",
];

// Patrones en el nombre que son inequívocos de fuera
const NON_SPAIN_NAME_HINTS = [
  "maratón ciudad de guatemala",
  "media maraton ciudad de guatemala",
  "bimbo global race", // carrera internacional patrocinada por Bimbo
  "tashkent",
  "antigua guatemala",
  "21k tikal", "21k media maraton ciudad",
];

function detectNonSpain(r: any): { isNonSpain: boolean; reason: string } {
  // 1. Lat/lng (autoritativo si está)
  if (typeof r.latitude === "number" && typeof r.longitude === "number") {
    const { latitude, longitude } = r;
    if (
      latitude < SPAIN_BBOX.minLat ||
      latitude > SPAIN_BBOX.maxLat ||
      longitude < SPAIN_BBOX.minLng ||
      longitude > SPAIN_BBOX.maxLng
    ) {
      return { isNonSpain: true, reason: `lat/lng fuera de España (${latitude.toFixed(2)}, ${longitude.toFixed(2)})` };
    }
  }
  // 2. Locality (topónimos inequívocos)
  const loc = (r.locality ?? "").toLowerCase();
  for (const hint of NON_SPAIN_CITY_HINTS) {
    if (loc.includes(hint)) return { isNonSpain: true, reason: `locality "${r.locality}" → "${hint}"` };
  }
  // 3. Nombre (patrones inequívocos)
  const name = (r.name ?? "").toLowerCase();
  for (const hint of NON_SPAIN_NAME_HINTS) {
    if (name.includes(hint)) return { isNonSpain: true, reason: `nombre → "${hint}"` };
  }
  // 4. Slug en URL (topónimos inequívocos)
  const url = (r.officialUrl ?? "").toLowerCase();
  for (const hint of NON_SPAIN_CITY_HINTS) {
    const slugHint = hint.replace(/ /g, "-");
    if (url.includes(slugHint)) return { isNonSpain: true, reason: `URL → "${slugHint}"` };
  }
  return { isNonSpain: false, reason: "" };
}

async function main() {
  const c = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const r = await c.query(api.races.systemListAll, {});

  console.log("=".repeat(72));
  console.log("Auditoría final (v2, sin falsos positivos)");
  console.log("=".repeat(72));

  const all = r.map((x: any) => ({ ...x, _detection: detectNonSpain(x) }));
  const nonSpain = all.filter((x: any) => x._detection.isNonSpain);
  console.log(`Total carreras: ${r.length}`);
  console.log(`Marcadas como NO-España: ${nonSpain.length}`);

  const bySource: Record<string, number> = {};
  for (const x of nonSpain) bySource[x.scraperAdapter ?? "?"] = (bySource[x.scraperAdapter ?? "?"] ?? 0) + 1;
  console.log("\nPor scraperAdapter:");
  Object.entries(bySource).forEach(([k, n]) => console.log(`  ${k}: ${n}`));

  console.log("\nDetalle:");
  for (const x of nonSpain) {
    console.log(`  ${x.startDate}  ${x.name.slice(0, 60)}`);
    console.log(`    province=${x.province}  locality=${x.locality}  isPublished=${x.isPublished}  adapter=${x.scraperAdapter}`);
    console.log(`    Razón: ${x._detection.reason}`);
  }

  const publishedNonSpain = nonSpain.filter((x: any) => x.isPublished);
  console.log(`\n🔴 Publicadas y NO-España: ${publishedNonSpain.length}`);
  console.log(`   Borrador y NO-España: ${nonSpain.length - publishedNonSpain.length}`);
}
main().catch((e) => { console.error(e); process.exit(1); });

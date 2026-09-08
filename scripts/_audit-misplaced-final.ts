import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const SPAIN_BBOX = { minLat: 27.5, maxLat: 44.0, minLng: -18.5, maxLng: 4.5 };

// Lista curada manualmente tras el primer audit.
// IDs (al final del slug) o nombre exacto que SÍ están en España
// y fueron marcados por error en la heurística.
const WHITELIST = new Set([
  // "XV TRAVESÍA A NADO PLAYA DE CASABLANCA 2026" — es en Almenara (Castellón),
  // "Playa de Casablanca" es el nombre de la playa, no Casablanca (Marruecos).
  // Whitelist por nombre exacto.
  "xv travesía a nado playa de casablanca 2026",
  // "XVII Carreira Popular do San Salvador Baños de Molgas" — es en Orense.
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
  // Pongo San Salvador sólo si NO es Baños de Molgas. La whitelist corrige.
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
  const c = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const r = await c.query(api.races.systemListAll, {});

  const nonSpain = r
    .map((x: any) => ({ ...x, _detection: detectNonSpain(x) }))
    .filter((x: any) => x._detection.isNonSpain);

  console.log("=".repeat(72));
  console.log("CANDIDATOS FINALES para despublicar (no-España confirmados)");
  console.log("=".repeat(72));
  console.log(`Total: ${nonSpain.length}`);

  // Agrupar por país inferido (por la razón)
  const byCountry: Record<string, any[]> = {};
  for (const x of nonSpain) {
    let country = "?";
    if (/pet[ée]n|guatemala|tikal/.test(x._detection.reason)) country = "Guatemala";
    else if (/san salvador/.test(x._detection.reason)) country = "El Salvador";
    else if (/tashkent/.test(x._detection.reason)) country = "Uzbekistán";
    else if (/lisboa|lisbon/.test(x._detection.reason)) country = "Portugal";
    else if (/paris/.test(x._detection.reason)) country = "Francia";
    else if (/berlin/.test(x._detection.reason)) country = "Alemania";
    else if (/cdmx|oaxaca|matías/.test(x._detection.reason)) country = "México";
    else if (/valparaíso|chile/.test(x._detection.reason)) country = "Chile";
    else if (/bogotá|cali colombia/.test(x._detection.reason)) country = "Colombia";
    else if (/tanger|tetu|fnideq|fez|rabat|casablanca/.test(x._detection.reason)) country = "Marruecos";
    else if (/lat\/lng/.test(x._detection.reason)) country = "Desconocido (lat/lng)";
    if (!byCountry[country]) byCountry[country] = [];
    byCountry[country].push(x);
  }
  Object.entries(byCountry)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([country, list]) => {
      console.log(`\n  ${country}: ${list.length} carreras`);
    });

  // Mostrar todas
  console.log("\nDetalle completo:");
  for (const x of nonSpain) {
    const pub = x.isPublished ? "🟢 PUB" : "⚪ BRR";
    console.log(`  ${pub}  ${x.startDate}  ${x.name.slice(0, 60)}`);
    console.log(`         province=${x.province}  locality=${x.locality}`);
  }

  // Solo publicadas
  const published = nonSpain.filter((x: any) => x.isPublished);
  console.log(`\n🔴 A despublicar (publicadas): ${published.length}`);
  console.log(`   Ya en borrador: ${nonSpain.length - published.length}`);
}
main().catch((e) => { console.error(e); process.exit(1); });

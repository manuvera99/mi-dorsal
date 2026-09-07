// =============================================================================
// scripts/fix-province-from-geo.ts
// =============================================================================
// Reasigna la province correcta a carreras que tienen province="valencia"
// por el fallback del systemUpsert, usando Nominatim (OpenStreetMap, gratis).
//
// Para cada carrera:
//   1. Geocodifica "${locality}, ${province}, España" con countrycodes=es.
//      Si locality no es de Valencia (heurística simple), busca la province real.
//   2. Usa el campo "address" del resultado para sacar la province real.
//   3. Actualiza el doc con la province correcta.
//
// Rate limit: 1.1 req/s (Nominatim ToS). Para 2.000+ carreras son ~40 min.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/fix-province-from-geo.ts           # dry-run
//   npx tsx --env-file=.env.local scripts/fix-province-from-geo.ts --apply   # ejecuta
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const APPLY = process.argv.includes("--apply");

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "mi-dorsal/1.0 (https://mi-dorsal.com; manu@mi-dorsal.app)";
const DELAY_MS = 1100;

// Mapeo de nombres de provincia que devuelve Nominatim (en `address.state`
// o `address.county`) al enum literal del schema de Convex (`province`).
// Si Nominatim devuelve un nombre que no está aquí, el script loguea WARN
// y deja la province como está.
const NOMINATIM_TO_PROVINCE: Record<string, string> = {
  // España — provincias más comunes que devuelve Nominatim
  "madrid": "madrid",
  "barcelona": "barcelona",
  "valencia": "valencia",  // puede ser la ciudad o la provincia; si locality es "Valencia", probablemente provincia
  "valenciana": "valencia",  // a veces devuelve "Comunidad Valenciana"
  "alicante": "alicante",
  "castellón": "castellon",
  "castellon": "castellon",
  "sevilla": "sevilla",
  "granada": "granada",
  "córdoba": "cordoba",
  "cordoba": "cordoba",
  "málaga": "malaga",
  "malaga": "malaga",
  "murcia": "murcia",
  "almería": "almeria",
  "almeria": "almeria",
  "zaragoza": "zaragoza",
  "huesca": "huesca",
  "teruel": "teruel",
  "tarragona": "tarragona",
  "girona": "girona",
  "gerona": "girona",
  "lleida": "lleida",
  "lérida": "lleida",
  "vizcaya": "vizcaya",
  "bizkaia": "vizcaya",
  "gipuzkoa": "gipuzkoa",
  "guipúzcoa": "gipuzkoa",
  "álava": "alava",
  "alava": "alava",
  "navarra": "navarra",
  "asturias": "asturias",
  "cantabria": "cantabria",
  "la rioja": "la rioja",
  "rioja": "la rioja",
  "burgos": "burgos",
  "león": "leon",
  "leon": "leon",
  "palencia": "palencia",
  "valladolid": "valladolid",
  "zamora": "zamora",
  "salamanca": "salamanca",
  "segovia": "segovia",
  "soria": "soria",
  "ávila": "avila",
  "avila": "avila",
  "toledo": "toledo",
  "ciudad real": "ciudad real",
  "guadalajara": "guadalajara",
  "cuenca": "cuenca",
  "albacete": "albacete",
  "cáceres": "caceres",
  "caceres": "caceres",
  "badajoz": "badajoz",
  "cádiz": "cadiz",
  "cadiz": "cadiz",
  "huelva": "huelva",
  "jaén": "jaen",
  "jaen": "jaen",
  "málaga": "malaga",
  "illes balears": "mallorca",
  "baleares": "mallorca",
  "mallorca": "mallorca",
  "menorca": "menorca",
  "ibiza": "ibiza",
  "eivissa": "ibiza",
  "formentera": "ibiza",
  "a coruña": "a coruna",
  "a coruna": "a coruna",
  "coruña": "a coruna",
  "lugo": "lugo",
  "ourense": "ourense",
  "orense": "ourense",
  "pontevedra": "pontevedra",
  "las palmas": "las palmas",
  "santa cruz de tenerife": "santa cruz de tenerife",
  "tenerife": "santa cruz de tenerife",
  "ceuta": "ceuta",
  "melilla": "melilla",
};

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  state_district?: string;
  region?: string;
  country?: string;
  country_code?: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
}

export async function geocode(query: string): Promise<NominatimResult | null> {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=es&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "es" },
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const data = (await res.json()) as NominatimResult[];
  return data[0] ?? null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function extractProvince(addr: NominatimAddress | undefined): string | null {
  if (!addr) return null;
  // Orden de preferencia:
  //   1. state_district (en España es la provincia dentro de la CCAA, ej. "Barcelona")
  //   2. state (la CCAA, ej. "Cataluña" — generalmente queremos la provincia, no la comunidad)
  //   3. county (comarca)
  //   4. region
  const candidates = [
    addr.state_district,
    addr.state,
    addr.county,
    addr.region,
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    const key = c.toLowerCase().trim();
    if (NOMINATIM_TO_PROVINCE[key]) return NOMINATIM_TO_PROVINCE[key];
  }
  return null;
}

// (Whitelist eliminada 2026-09-07 — ver comentario en main())

async function main() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) { console.error("❌ NEXT_PUBLIC_CONVEX_URL no definido"); process.exit(1); }
  const client = new ConvexHttpClient(convexUrl);

  console.log("=".repeat(72));
  console.log(`Reasignar province con Nominatim — modo: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log("=".repeat(72));

  const r = await client.query(api.races.systemListAll, {});
  // Solo carreras con province='valencia' y locality no vacía. Sin whitelist
  // de ciudades de Valencia: si Nominatim devuelve "valencia" para una ciudad
  // realmente valenciana, el script la deja igual (noChange). Más robusto
  // que intentar hacer una whitelist manual de 200+ pueblos.
  const valenciaSuspects = r.filter((x: any) =>
    x.province === "valencia" &&
    x.locality &&
    x.locality.length >= 2
  );
  console.log(`\nCarreras con province='valencia': ${valenciaSuspects.length}`);
  console.log("(El script geocodifica TODAS y solo actualiza si Nominatim devuelve una province distinta)");

  if (valenciaSuspects.length === 0) {
    console.log("✅ Nada que reasignar.");
    return;
  }

  if (!APPLY) {
    console.log("\nMuestra (primeras 10):");
    for (const x of valenciaSuspects.slice(0, 10)) {
      console.log(`  ${x.startDate}  ${x.name.slice(0, 50)} | locality=${x.locality}`);
    }
    console.log(`\n[DRY-RUN] Se geocodificarían ${valenciaSuspects.length} carreras (~${Math.round(valenciaSuspects.length * 1.1 / 60)} min).`);
    console.log("Añade --apply para ejecutar.");
    return;
  }

  console.log(`\n[APPLY] Geocodificando ${valenciaSuspects.length} carreras...`);
  let ok = 0, noChange = 0, noResult = 0, fail = 0;
  const samples: { name: string; old: string; new: string; query: string }[] = [];

  for (let i = 0; i < valenciaSuspects.length; i++) {
    const x = valenciaSuspects[i];
    const query = [x.locality, "España"].filter(Boolean).join(", ");
    process.stdout.write(`\r[${i + 1}/${valenciaSuspects.length}]  ok=${ok}  noChange=${noChange}  noResult=${noResult}  fail=${fail}  `);
    try {
      const result = await geocode(query);
      if (!result) {
        noResult++;
        await sleep(DELAY_MS);
        continue;
      }
      const newProvince = extractProvince(result.address);
      if (!newProvince) {
        noResult++;
        if (samples.length < 5) samples.push({ name: x.name, old: x.province, new: "?", query: `${query} → ${result.display_name.slice(0, 60)}` });
        await sleep(DELAY_MS);
        continue;
      }
      if (newProvince === x.province) {
        noChange++;
        await sleep(DELAY_MS);
        continue;
      }
      await client.mutation(api.races.systemUpdate, {
        id: x._id,
        patch: { province: newProvince as any },
      });
      if (samples.length < 5) samples.push({ name: x.name, old: x.province, new: newProvince, query: `${query} → ${result.display_name.slice(0, 60)}` });
      ok++;
    } catch (e: any) {
      fail++;
      console.error(`\n  Error en "${x.name}": ${e?.message ?? e}`);
    }
    if (i < valenciaSuspects.length - 1) await sleep(DELAY_MS);
  }
  console.log(`\n\n✅ ${ok} reasignadas, ${noChange} ya correctas, ${noResult} sin resultado, ${fail} fallaron`);
  console.log("\nMuestra de cambios:");
  for (const s of samples) console.log(`  ${s.name}: ${s.old} → ${s.new}`);
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

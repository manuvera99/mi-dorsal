// =============================================================================
// scripts/ingest-carreraspopulares.ts
// =============================================================================
// Ingest del JSON generado por scripts/prototypes/scrape-carreraspopulares-nacional.ts
// a Convex vía la mutation api.races.systemUpsert.
//
// Diseño:
//   - NO genera duplicados: systemUpsert hace dedup por (a) officialUrl,
//     (b) nombre normalizado + startDate + locality, (c) nombre + fecha,
//     (d) structural, (e) fuzzy. Si encuentra match → rellena SOLO campos
//     vacíos sin pisar datos existentes (ver convex/races.ts:824-849).
//   - Esto cumple el requisito de "si las tengo ya y hay más datos que pueda
//     extraer que no tenga pues sacarlos, como las homologadas" — porque
//     `homologated` se rellena si está null en la existente.
//
// Uso:
//   1. npx tsx scripts/prototypes/scrape-carreraspopulares-nacional.ts
//      (genera scripts/output/carreraspopulares-nacional.json)
//   2. npx tsx scripts/ingest-carreraspopulares.ts [--dry-run]
// =============================================================================

import * as fs from "fs";
import * as path from "path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

// Carga .env.local manualmente (tsx no lo hace solo).
// Formato: KEY="valor" o KEY=valor
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*?)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnvLocal();

const OUTPUT_DIR = path.join(process.cwd(), "scripts", "output");
const INPUT_FILE = path.join(OUTPUT_DIR, "carreraspopulares-nacional.json");
const SOURCE_SLUG = "carreraspopulares";
const ADAPTER = "carreraspopulares";
const TRIGGERED_BY = "manual:ingest-carreraspopulares";

interface CPRaceInput {
  name: string;
  slug: string;
  url: string;
  date?: string;
  locality?: string;
  province?: string;
  distances: number[];
  distanceRaw: string;
  iconos: {
    homologated: boolean;
    inRfeaCalendar: boolean;
    inAutonomicCalendar: boolean;
    services: string[];
  };
  sourceFilter: string;
  sourceCcaa: string | null;
}

// Slugs válidos del schema (mirror de convex/schema.ts lines 110-190)
const VALID_PROVINCE_SLUGS = new Set<string>([
  "alava","albacete","alicante","almeria","asturias","avila","badajoz","barcelona","bizcaya","burgos","caceres","cadiz","cantabria","castellon","ceuta","ciudad real","cordoba","cuenca","gipuzkoa","girona","granada","guadalajara","huelva","huesca","ibiza","a coruna","la rioja","las palmas","leon","lleida","lugo","madrid","malaga","mallorca","melilla","menorca","murcia","navarra","ourense","palencia","pontevedra","salamanca","santa cruz de tenerife","segovia","sevilla","soria","tarragona","teruel","toledo","valencia","valladolid","vizcaya","zamora","zaragoza"
]);

// Mapeo nombre que pone la web → slug del schema
const CP_PROVINCE_TO_SLUG: Record<string, string> = {
  "álava": "alava", "alava": "alava",
  "albacete": "albacete",
  "alicante": "alicante",
  "almería": "almeria", "almeria": "almeria",
  "asturias": "asturias",
  "ávila": "avila", "avila": "avila",
  "badajoz": "badajoz",
  "barcelona": "barcelona",
  "bizkaia": "vizcaya", "vizcaya": "vizcaya",
  "burgos": "burgos",
  "cáceres": "caceres", "caceres": "caceres",
  "cádiz": "cadiz", "cadiz": "cadiz",
  "cantabria": "cantabria",
  "castellón": "castellon", "castelló": "castellon", "castellon": "castellon",
  "ceuta": "ceuta",
  "ciudad real": "ciudad real",
  "córdoba": "cordoba", "cordoba": "cordoba",
  "cuenca": "cuenca",
  "gipuzkoa": "gipuzkoa", "guipúzcoa": "gipuzkoa",
  "girona": "girona", "gerona": "girona",
  "granada": "granada",
  "guadalajara": "guadalajara",
  "huelva": "huelva",
  "huesca": "huesca",
  "ibiza": "ibiza",
  "a coruña": "a coruna", "a coruna": "a coruna", "la coruña": "a coruna", "coruña": "a coruna",
  "la rioja": "la rioja",
  "las palmas": "las palmas",
  "león": "leon", "leon": "leon",
  "lleida": "lleida", "lérida": "lleida",
  "lugo": "lugo",
  "madrid": "madrid",
  "málaga": "malaga", "malaga": "malaga",
  "mallorca": "mallorca",
  "melilla": "melilla",
  "menorca": "menorca",
  "murcia": "murcia",
  "navarra": "navarra",
  "orense": "ourense", "ourense": "ourense",
  "palencia": "palencia",
  "pontevedra": "pontevedra",
  "salamanca": "salamanca",
  "santa cruz de tenerife": "santa cruz de tenerife",
  "segovia": "segovia",
  "sevilla": "sevilla",
  "soria": "soria",
  "tarragona": "tarragona",
  "teruel": "teruel",
  "toledo": "toledo",
  "valencia": "valencia",
  "valladolid": "valladolid",
  "zamora": "zamora",
  "zaragoza": "zaragoza",
  // Casos raros del scraper (province == locality o == "España")
  "españa": null,
  "espana": null,
};

// Normaliza la provincia que viene del JSON al slug del schema
function normalizeProvince(raw: string | undefined, locality: string | undefined): string | undefined {
  if (raw) {
    const norm = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    // Casos basura explícitos del scraper
    if (norm === "españa" || norm === "espana") return undefined;
    const slug = CP_PROVINCE_TO_SLUG[norm];
    if (slug && VALID_PROVINCE_SLUGS.has(slug)) return slug;
    if (VALID_PROVINCE_SLUGS.has(norm)) return norm;
  }
  // Fallback: si locality es capital de provincia (Madrid, Valencia, Barcelona, etc.), usarla como province
  if (locality) {
    const locNorm = locality.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (VALID_PROVINCE_SLUGS.has(locNorm)) return locNorm;
  }
  return undefined;
}

const SERVICES_TO_TAGS: Record<string, string> = {
  "Servicios médicos": "asistencia médica",
  "Avituallamiento líquido": "avituallamiento líquido",
  "Avituallamiento sólido": "avituallamiento sólido",
  "Cronometraje": "cronometraje con chip",
  "Bolsa del corredor": "bolsa del corredor",
  "Medallas": "medalla finisher",
  "Premios en metálico": "premios en metálico",
  "Trofeos": "trofeos",
  "Parking o zona de fácil aparcamiento": "parking",
  "Alojamiento": "alojamiento",
  "Servicio de fisioterapia": "fisioterapia",
  "Servicio de duchas": "duchas",
  "Servicio de guardarropía": "guardarropía",
  "Servicio de vestuario": "vestuario",
  "Baños": "baños",
  "Categoría silla de ruedas": "categoría silla de ruedas",
  "Speaker en zona de meta": "speaker en meta",
  "Salida en boxes": "salida por cajones",
  "Prueba solidaria": "carácter solidario",
};

function inferRaceType(name: string): "road" | "trail" | "mixed" | "obstacle" {
  const n = name.toLowerCase();
  if (/trail|cxm|senderist|marcha|monta.?a/.test(n)) return "trail";
  if (/cross/.test(n) && !/crossfit/.test(n)) return "mixed";
  if (/obst.aculo|spartan|tough/.test(n)) return "obstacle";
  return "road";
}

function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ No se encontró ${INPUT_FILE}.`);
    console.error(`   Ejecuta primero: npx tsx scripts/prototypes/scrape-carreraspopulares-nacional.ts`);
    process.exit(1);
  }

  const races: CPRaceInput[] = JSON.parse(fs.readFileSync(INPUT_FILE, "utf-8"));
  console.log(`[ingest-carreraspopulares] ${races.length} carreras del JSON`);

  if (dryRun) {
    runDryRun(races);
    return;
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error(`❌ Falta NEXT_PUBLIC_CONVEX_URL en .env.local`);
    process.exit(1);
  }

  const client = new ConvexHttpClient(convexUrl);
  runIngest(client, races).catch((err) => {
    console.error("[ingest-carreraspopulares] ❌ Error fatal:", err);
    process.exit(1);
  });
}

function runDryRun(races: CPRaceInput[]) {
  const noProvince: CPRaceInput[] = [];
  let homologCount = 0;
  let withDist = 0;

  for (const r of races) {
    const p = normalizeProvince(r.province, r.locality);
    if (!p) noProvince.push(r);
    if (r.iconos.homologated) homologCount++;
    if (r.distances.length > 0) withDist++;
  }

  console.log(`\n=== Dry-run stats ===`);
  console.log(`Total:                    ${races.length}`);
  console.log(`Con homologated=true:     ${homologCount}`);
  console.log(`Con distancia parseada:   ${withDist}`);
  console.log(`Sin provincia resoluble:  ${noProvince.length}`);
  console.log(`Total que se subirían:    ${races.length - noProvince.length}`);

  if (noProvince.length > 0) {
    console.log(`\nCarreras sin provincia:`);
    for (const r of noProvince) {
      console.log(`  - '${r.name}' | locality='${r.locality}' | raw province='${r.province}'`);
    }
    console.log(`\nEstas se saltarán en el ingest real. Súbelas a mano desde /admin/races/new.`);
  }
}

async function runIngest(client: ConvexHttpClient, races: CPRaceInput[]) {
  const dataSourceIdCache = new Map<string, string | null>();
  const getDataSourceId = async (slug: string): Promise<string | null> => {
    if (!dataSourceIdCache.has(slug)) {
      const id = await client.query(api.dataSources.getDataSourceIdBySlug, { slug });
      dataSourceIdCache.set(slug, id);
    }
    return dataSourceIdCache.get(slug) ?? null;
  };

  const dataSourceId = await getDataSourceId(SOURCE_SLUG);
  console.log(`[ingest-carreraspopulares] dataSource '${SOURCE_SLUG}' → ${dataSourceId ?? "(no existe, se creará al ingestar)"}`);

  let created = 0;
  let updated = 0;
  let failed = 0;
  let skippedNoProvince = 0;
  let enrichedHomolog = 0; // carreras existentes a las que rellenamos homologated
  const t0 = Date.now();

  for (const r of races) {
    const province = normalizeProvince(r.province, r.locality);
    if (!province) {
      skippedNoProvince++;
      process.stdout.write("p");
      continue;
    }

    try {
      // distance: usa la primera si es razonable, sino fallback por defecto
      let distanceKm = r.distances[0];
      if (!distanceKm || distanceKm <= 0 || distanceKm > 200) {
        distanceKm = inferRaceType(r.name) === "trail" ? 21 : 10;
      }

      const tags = r.iconos.services.map((s) => SERVICES_TO_TAGS[s]).filter(Boolean) as string[];
      const description = [
        r.iconos.homologated ? "Carrera con circuito homologado." : null,
        r.iconos.inRfeaCalendar ? "Incluida en el calendario nacional de la RFEA." : null,
        r.iconos.inAutonomicCalendar ? "Incluida en el calendario autonómico." : null,
        tags.length > 0 ? `Servicios: ${tags.join(", ")}.` : null,
      ].filter(Boolean).join(" ");

      const res: any = await client.mutation(api.races.systemUpsert, {
        name: r.name,
        startDate: r.date,
        locality: r.locality,
        province: province as any,
        distanceKm,
        raceType: inferRaceType(r.name),
        homologated: r.iconos.homologated || undefined,
        officialUrl: r.url,
        sourceUrl: r.url,
        description: description || undefined,
        scraperAdapter: ADAPTER,
        dataSourceId: dataSourceId ?? undefined,
      });

      const action = res?.action;
      if (action === "updated") {
        updated++;
        process.stdout.write("u");
      } else {
        created++;
        process.stdout.write(".");
      }
    } catch (err) {
      failed++;
      const msg = (err as Error).message?.slice(0, 200) ?? String(err);
      console.error(`\n❌ '${r.name}': ${msg}`);
    }
  }

  const durationMs = Date.now() - t0;
  console.log(`\n\n[ingest-carreraspopulares] ✅ created=${created} updated=${updated} failed=${failed} skipped(no_province)=${skippedNoProvince}`);
  console.log(`[ingest-carreraspopulares] Duración: ${(durationMs / 1000).toFixed(1)}s`);

  // Registrar sync
  try {
    await client.mutation(api.dataSources.recordIngestSync, {
      dataSourceSlug: SOURCE_SLUG,
      raceCount: created + updated,
      createdCount: created,
      updatedCount: updated,
      durationMs,
      status: failed > created + updated ? "error" : "success",
      triggeredBy: TRIGGERED_BY,
      error: failed > 0 ? `${failed} carreras fallaron` : undefined,
    });
    console.log(`[ingest-carreraspopulares] 📊 Sync registrado en dataSource '${SOURCE_SLUG}'`);
  } catch (err) {
    console.warn(`[ingest-carreraspopulares] ⚠️  No se pudo registrar sync:`, (err as Error).message);
  }
}

main();

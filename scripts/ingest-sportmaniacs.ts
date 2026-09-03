// =============================================================================
// scripts/ingest-sportmaniacs.ts
// =============================================================================
// Scraper del API público de Sportmaniacs (api-aws.sportmaniacs.com/api/races).
//
// ¡IMPORTANTE! Esta API no está documentada pero devuelve el catálogo COMPLETO
// de carreras gestionadas por Sportmaniacs. La API está ordenada por fecha
// descendente y devuelve ~25.000 carreras totales. Solo la página 1 contiene
// carreras futuras; las siguientes son todas pasadas.
//
// Lo que conseguimos vs el HTML scraper:
//   - 25.000 carreras scrapeables vs 5 curadas
//   - Datos estructurados (JSON) vs parsing HTML frágil
//   - Filtros por idRaceType (running/trail vs cycling/triathlon/swim)
//   - Velocidad: 1-2 requests por ejecución (paramos al no encontrar futuras)
//
// Filtros aplicados:
//   - Solo carreras en España (country_id = "ESP")
//   - Solo running/trail (idRaceType 0 y 1); descartamos cycling/triathlon/swim
//   - Carreras futuras (paramos de paginar al encontrar 0 futuras)
//
// Reemplaza al viejo ingest-sportmaniacs.ts (ahora ingest-sportmaniacs-curated.ts)
// que solo tenía 5 carreras hardcodeadas.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/ingest-sportmaniacs.ts            # dry-run
//   npx tsx --env-file=.env.local scripts/ingest-sportmaniacs.ts --upload   # sube a Convex
//   npx tsx --env-file=.env.local scripts/ingest-sportmaniacs.ts --limit=10 # máx 10 páginas
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const BASE = "https://api-aws.sportmaniacs.com/api";
const UPLOAD = process.argv.includes("--upload");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const MAX_PAGES = limitArg ? parseInt(limitArg.split("=")[1], 10) : 999;
const PAGE_SIZE = 500; // 500 carreras por request = mínimo # de requests
const DELAY_MS = 200; // pausa entre páginas para no saturar

// =============================================================================
// Tipos y constantes
// =============================================================================

interface SportmaniacsRace {
  index: number;
  id: string;
  name: string;
  date: string;          // YYYY-MM-DD
  end_date?: string;     // YYYY-MM-DD
  slug: string;
  idRaceType: string;    // "0" running, "1" trail/xtreme, "2" cycling, "3" MTB, "4" tri, "5" duat, "6" acuat, "7" swim
  country_id: string;    // "ESP"
  country: string;       // "España"
  province_id: string;
  province: string;      // "Valencia", "Albacete", etc.
  city_id: string;
  city: string;          // "Villarrobledo", etc.
  photos: { xs?: string; sm?: string; md?: string; title?: string };
  status: number;
  showRankings: boolean;
  latitude: string;
  longitude: string;
}

interface ApiResponse {
  data: SportmaniacsRace[];
  status: string;
  totalPages: number;
  pastPages: number;
  futurePages: number;
}

// =============================================================================
// Mapeos
// =============================================================================

/**
 * Mapea la provincia de Sportmaniacs al union literal del schema de Convex.
 * Si no encaja, devuelve undefined (la carrera se descarta).
 */
const PROV_NORMALIZE: Record<string, string> = {
  "valencia": "valencia",
  "alicante": "alicante",
  "alacant": "alicante",
  "castellón": "castellon",
  "castellon": "castellon",
  "murcia": "murcia",
  "albacete": "albacete",
  "almería": "almeria",
  "almeria": "almeria",
  "ciudad real": "ciudad real",
  "cuenca": "cuenca",
  "guadalajara": "guadalajara",
  "toledo": "toledo",
  "granada": "granada",
  "jaén": "jaen",
  "jaen": "jaen",
  "málaga": "malaga",
  "malaga": "malaga",
  "córdoba": "cordoba",
  "cordoba": "cordoba",
  "sevilla": "sevilla",
  "huelva": "huelva",
  "cádiz": "cadiz",
  "cadiz": "cadiz",
  "huesca": "huesca",
  "zaragoza": "zaragoza",
  "teruel": "teruel",
  "barcelona": "barcelona",
  "girona": "girona",
  "gerona": "girona",
  "tarragona": "tarragona",
  "lleida": "lleida",
  "lérida": "lleida",
  "lerida": "lleida",
  "illes balears": "mallorca",
  "baleares (illes)": "mallorca",
  "mallorca": "mallorca",
  "menorca": "menorca",
  "ibiza": "ibiza",
  "eivissa": "ibiza",
  "formentera": "ibiza",
  "las palmas": "las palmas",
  "santa cruz de tenerife": "santa cruz de tenerife",
  "tenerife": "santa cruz de tenerife",
  "madrid": "madrid",
  "bizkaia": "vizcaya",
  "vizcaya": "vizcaya",
  "gipuzkoa": "gipuzkoa",
  "guipúzcoa": "gipuzkoa",
  "guipuzcoa": "gipuzkoa",
  "álava": "alava",
  "alava": "alava",
  "araba": "alava",
  "navarra": "navarra",
  "nafarroa": "navarra",
  "asturias": "asturias",
  "cantabria": "cantabria",
  "a coruña": "a coruna",
  "a coruna": "a coruna",
  "coruña": "a coruna",
  "coruna": "a coruna",
  "lugo": "lugo",
  "ourense": "ourense",
  "orense": "ourense",
  "pontevedra": "pontevedra",
  "la rioja": "la rioja",
  "rioja": "la rioja",
  "cáceres": "caceres",
  "caceres": "caceres",
  "badajoz": "badajoz",
  "león": "leon",
  "leon": "leon",
  "zamora": "zamora",
  "salamanca": "salamanca",
  "valladolid": "valladolid",
  "palencia": "palencia",
  "burgos": "burgos",
  "soria": "soria",
  "ávila": "avila",
  "avila": "avila",
  "segovia": "segovia",
  "ceuta": "ceuta",
  "melilla": "melilla",
};

function normalizeProvince(s: string | undefined): string | undefined {
  if (!s) return undefined;
  return PROV_NORMALIZE[s.toLowerCase().trim()];
}

/**
 * Mapea idRaceType de Sportmaniacs a (raceType, incluir).
 * - 0 = running (mixto road/trail, inferimos por nombre)
 * - 1 = trail/xtreme → siempre trail
 * - 2-7 = otros deportes (cycling, triathlon, swim...) → descartamos
 */
function mapRaceType(r: SportmaniacsRace): "road" | "trail" | null {
  const t = String(r.idRaceType);
  if (t === "0") {
    // Running: inferir por nombre
    const n = r.name.toLowerCase();
    if (/\btrail\b|\bxtreme\b|\bcross\b|\bmont(aña|ana)\b|\bultra\b/.test(n)) return "trail";
    return "road";
  }
  if (t === "1") return "trail"; // trail/xtreme
  return null; // descartada
}

/**
 * Quita la coletilla " 2026", " 2027" del final del nombre para evitar duplicados
 * con años distintos. Pero ojo: algunas carreras cambian de nombre, así que
 * la coletilla se usa para calcular el slug, no para el nombre.
 */
function buildSlug(name: string, date: string, id: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `sportmaniacs-${base}-${date}-${id.slice(0, 8)}`;
}

// =============================================================================
// Fetch
// =============================================================================

async function fetchPage(page: number): Promise<ApiResponse> {
  const url = `${BASE}/races?page=${page}&limit=${PAGE_SIZE}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json();
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("=".repeat(70));
  console.log("Sportmaniacs API scraper (api-aws.sportmaniacs.com/api/races)");
  console.log("=".repeat(70));
  console.log(`Modo: ${UPLOAD ? "UPLOAD a Convex" : "DRY-RUN (solo mostrar)"}`);
  console.log(`Tamaño página: ${PAGE_SIZE}, máx páginas: ${MAX_PAGES}`);

  const today = new Date().toISOString().split("T")[0];

  // La API está ordenada por fecha descendente. Las carreras futuras están
  // concentradas en las primeras páginas. Paramos cuando encontremos una
  // página sin carreras futuras (o llegamos al límite).
  console.log("\n→ Páginas 1+ (parando al no encontrar futuras)...");
  const all: SportmaniacsRace[] = [];
  let foundFuture = true;
  let p = 0;
  while (foundFuture && p < MAX_PAGES) {
    p++;
    const data = await fetchPage(p);
    const futureInPage = data.data.filter((r) => r.date >= today);
    if (futureInPage.length === 0) {
      foundFuture = false;
      console.log(`  Página ${p}: 0 futuras — parando`);
      break;
    }
    all.push(...futureInPage); // solo nos quedamos las futuras, ahorra memoria
    process.stdout.write(`  Página ${p}: ${futureInPage.length} futuras (acumulado: ${all.length})\n`);
    if (p < MAX_PAGES) await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  console.log(`\nTotal carreras futuras descargadas: ${all.length} (en ${p} página${p > 1 ? "s" : ""})`);

  // Filtrar (ya solo tenemos futuras, ahora quitamos no-ESP y no-running)
  const filtered = all.filter((r) => {
    if (r.country_id !== "ESP") return false; // solo España
    if (mapRaceType(r) === null) return false; // solo running/trail
    return true;
  });
  console.log(`Filtradas (ESP + running/trail): ${filtered.length}`);

  // Stats
  const byProv: Record<string, number> = {};
  const byType: Record<string, number> = { road: 0, trail: 0 };
  const byYearMonth: Record<string, number> = {};
  let unmappedProv = 0;
  for (const r of filtered) {
    const p = normalizeProvince(r.province) ?? "?";
    if (p === "?") unmappedProv++;
    byProv[p] = (byProv[p] ?? 0) + 1;
    const t = mapRaceType(r);
    if (t) byType[t]++;
    const ym = r.date.slice(0, 7);
    byYearMonth[ym] = (byYearMonth[ym] ?? 0) + 1;
  }

  console.log(`\nPor tipo:`);
  console.log(`  road: ${byType.road}, trail: ${byType.trail}`);
  console.log(`\nPor mes (próximos):`);
  Object.entries(byYearMonth).sort().slice(0, 12).forEach(([m, n]) => console.log(`  ${m}: ${n}`));
  console.log(`\nTop 20 provincias:`);
  Object.entries(byProv).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([k, v]) => console.log(`  ${v.toString().padStart(4)} → ${k}`));
  console.log(`\nProvincias sin mapear: ${unmappedProv}`);

  if (!UPLOAD) {
    console.log(`\nPara subir a Convex: añade --upload`);
    return;
  }

  // Subir a Convex
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error("❌ NEXT_PUBLIC_CONVEX_URL no configurado");
    process.exit(1);
  }
  const client = new ConvexHttpClient(convexUrl);

  // Asegurar fuente "sportmaniacs"
  const sources = await client.query(api.dataSources.listPublic, {});
  let smSrc = sources.find((s: any) => s.slug === "sportmaniacs");
  if (!smSrc) {
    const id: any = await client.mutation(api.dataSources.systemCreate, {
      name: "Sportmaniacs",
      slug: "sportmaniacs",
      type: "api",
      description: "Plataforma de inscripciones deportivas — API REST pública con 25.000+ carreras (api-aws.sportmaniacs.com)",
      baseUrl: "https://sportmaniacs.com",
      config: {
        apiUrl: BASE,
        scrapedAt: new Date().toISOString(),
      },
    });
    smSrc = { _id: id } as any;
    console.log("\n✅ Fuente 'sportmaniacs' creada (tipo: api)");
  } else {
    console.log(`\nFuente 'sportmaniacs' ya existe (${smSrc._id})`);
  }

  console.log(`\nSubiendo ${filtered.length} carreras (idempotente)...`);
  let created = 0, updated = 0, failed = 0;
  const errors: string[] = [];
  const sourceId = smSrc._id;
  for (let i = 0; i < filtered.length; i++) {
    const r = filtered[i];
    const prov = normalizeProvince(r.province);
    if (!prov) {
      failed++;
      process.stdout.write("p"); // p = provincia no mapeada
      continue;
    }
    const raceType = mapRaceType(r);
    if (!raceType) {
      failed++;
      process.stdout.write("t"); // t = tipo no soportado
      continue;
    }
    const slug = buildSlug(r.name, r.date, r.id);
    const officialUrl = `https://sportmaniacs.com/es/races/${r.slug}`;
    const photoUrl = r.photos?.md ?? r.photos?.sm ?? r.photos?.xs;

    try {
      const res: any = await client.mutation(api.races.systemUpsert, {
        name: r.name,
        locality: r.city || r.province,
        province: prov as any,
        distanceKm: 10, // Sportmaniacs no da distancia en el listado; se afina con deep-extract
        raceType,
        startDate: r.date,
        officialUrl,
        organizer: "Sportmaniacs",
        organizerUrl: officialUrl,
        imageUrl: photoUrl,
        isPublished: true,
        isFeatured: false,
        scraperAdapter: "sportmaniacs",
        dataSourceId: sourceId,
      });
      if (res?.action === "created") {
        created++;
        process.stdout.write(".");
      } else {
        updated++;
        process.stdout.write("u");
      }
    } catch (e: any) {
      failed++;
      process.stdout.write("x");
      if (errors.length < 5) errors.push(`${r.name}: ${e?.message ?? e}`);
    }
    // Pausa cada 50 para no saturar Convex
    if (i % 50 === 49) {
      process.stdout.write(` [${i + 1}/${filtered.length}]`);
      await new Promise((res) => setTimeout(res, 100));
    }
  }

  console.log(`\n\n✅ ${created} creadas, ${updated} actualizadas, ${failed} fallaron`);
  if (errors.length) console.log("Errores:", errors);
}

main().catch((e) => {
  console.error("❌ Error fatal:", e);
  process.exit(1);
});

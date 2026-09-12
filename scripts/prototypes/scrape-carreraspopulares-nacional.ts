// =============================================================================
// scripts/prototypes/scrape-carreraspopulares-nacional.ts
// =============================================================================
// Scraper NACIONAL de panel.carreraspopulares.com — versión de producción.
// Itera por TODAS las comunidades autónomas (17) + filtro "con circuito
// homologado" nacional. Dedup intra-resultados por slug.
//
// Uso:
//   tsx scripts/prototypes/scrape-carreraspopulares-nacional.ts
//
// Argumentos opcionales:
//   --maxPagesPerFilter N   (def: 1)
//   --no-homologadas       (salta el filtro de homologadas)
//   --only-homologadas      (solo homologadas, sin barrido CCAA)
//
// Output: scripts/output/carreraspopulares-nacional.json
// =============================================================================

import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";

const BASE = "https://carreraspopulares.com";
const OUT = path.join(process.cwd(), "scripts", "output", "carreraspopulares-nacional.json");

// 17 comunidades + 2 ciudades autónomas + 1 filtro nacional (homologadas)
// IDs y slugs descubiertos en auditoría 2026-09-12 (panel /calendario_carreras)
const FILTERS: { id: string; slug: string; label: string; ccaa: string | null }[] = [
  { id: "CuVPow", slug: "carreras_espa\u00f1a_proximos_30_dias", label: "España próximos 30 días", ccaa: null },
  { id: "lh9TIw", slug: "carreras_comunidad_valenciana_proximos_30_dias", label: "C. Valenciana próximos 30 días", ccaa: "valencia" },
  { id: "Hchm2g", slug: "carreras_catalu\u00f1a_proximos_30_dias", label: "Cataluña próximos 30 días", ccaa: "barcelona" },
  { id: "GzZ6MA", slug: "carreras_comunidad_de_madrid_proximos_30_dias", label: "Madrid próximos 30 días", ccaa: "madrid" },
  { id: "y66dbA", slug: "carreras_andalucia_proximos_30_dias", label: "Andalucía próximos 30 días", ccaa: null },
  { id: "ilr.Tw", slug: "carreras_castilla_la_mancha_proximos_30_dias", label: "Castilla La Mancha próximos 30 días", ccaa: null },
  { id: "CMzVQQ", slug: "carreras_castilla_y_leon_proximos_30_dias", label: "Castilla y León próximos 30 días", ccaa: null },
  { id: "x3aE0g", slug: "carreras_pais_vasco_proximos_30_dias", label: "País Vasco próximos 30 días", ccaa: null },
  { id: "2yrBSA", slug: "carreras_aragon_proximos_30_dias", label: "Aragón próximos 30 días", ccaa: null },
  { id: "KZRU5g", slug: "carreras_galicia_proximos_30_dias", label: "Galicia próximos 30 días", ccaa: null },
  { id: "MxE3Ig", slug: "carreras_islas_canarias_proximos_30_dias", label: "Islas Canarias próximos 30 días", ccaa: null },
  { id: "5TGoSA", slug: "carreras_asturias_proximos_30_dias", label: "Asturias próximos 30 días", ccaa: null },
  { id: "8TOlzw", slug: "carreras_murcia_proximos_30_dias", label: "Murcia próximos 30 días", ccaa: "murcia" },
  { id: "uvKTiA", slug: "carreras_navarra_proximos_30_dias", label: "Navarra próximos 30 días", ccaa: null },
  { id: "9B6prw", slug: "carreras_baleares_proximos_30_dias", label: "Baleares próximos 30 días", ccaa: null },
  { id: "8DgL5A", slug: "carreras_extremadura_proximos_30_dias", label: "Extremadura próximos 30 días", ccaa: null },
  { id: "OzoN-Q", slug: "carreras_cantabria_proximos_30_dias", label: "Cantabria próximos 30 días", ccaa: null },
  { id: "6PqqUw", slug: "carreras_la_rioja_proximos_30_dias", label: "La Rioja próximos 30 días", ccaa: null },
  { id: "Tm5KsQ", slug: "carreras_melilla_proximos_30_dias", label: "Melilla próximos 30 días", ccaa: null },
  { id: "4a0qcA", slug: "carreras_ceuta_proximos_30_dias", label: "Ceuta próximos 30 días", ccaa: null },
  { id: "jtNyeA", slug: "carreras_con_circuito_homologado", label: "Nacional con circuito homologado", ccaa: null },
];

// ============================================================================
// Tipos
// ============================================================================
interface CPIconos {
  homologated: boolean;
  inRfeaCalendar: boolean;
  inAutonomicCalendar: boolean;
  services: string[];
}
interface CPRace {
  name: string;
  slug: string;
  url: string;
  date?: string;
  locality?: string;
  province?: string;
  distances: number[];
  distanceRaw: string;
  iconos: CPIconos;
  sourceFilter: string; // para auditoría
  sourceCcaa: string | null;
}

const SPANISH_MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

// ============================================================================
// Utilidades
// ============================================================================
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
function jitter(base: number, spread = 250): number {
  return base + Math.floor(Math.random() * spread);
}
function parseDateAny(s: string): string | undefined {
  const m1 = s.match(/(\d{1,2})\s+([a-záéíóúñ]+)\s+(\d{4})/i);
  if (m1) {
    const dd = parseInt(m1[1], 10);
    const monthName = m1[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const mm = SPANISH_MONTHS[monthName];
    const yyyy = m1[3];
    if (mm) return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  const m2 = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m2) {
    const [, dd, mm, yyyy] = m2;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return undefined;
}
function parseDistancesKm(s: string): number[] {
  const re = /(\d+(?:[.,]\d+)?)\s*(?:mts?|m|km)/gi;
  return [...s.matchAll(re)]
    .map((m) => {
      let n = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
      if (/(?:^|\s)(?:mts?|m)\b/i.test(m[0]) && n > 100) n = n / 1000;
      return n;
    })
    .filter((n) => n > 0);
}

function parseOneRace(el: cheerio.Element, $: cheerio.CheerioAPI, sourceFilter: string, sourceCcaa: string | null): CPRace | null {
  const $h4 = $(el).find("h4 a");
  const href = $h4.attr("href");
  if (!href) return null;
  const name = $h4.text().trim();
  const slugMatch = href.match(/\/carrera\/([^/?#]+)/);
  const slug = slugMatch ? slugMatch[1] : "";

  const $info = $(el).find(".infoPruebaListaKK p").first();
  const infoText = $info.text();
  const date = parseDateAny(infoText);

  let locality: string | undefined;
  let province: string | undefined;
  const innerHtml = $info.html() ?? "";
  const lines = innerHtml.split(/<\/br>|<br\s*\/?>/i);
  for (const line of lines) {
    if (/map-marker/.test(line)) {
      const cleaned = line.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const provMatch = cleaned.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (provMatch) {
        locality = provMatch[1].trim();
        province = provMatch[2].trim();
      } else if (cleaned) {
        locality = cleaned;
      }
      break;
    }
  }

  const distMatch = infoText.match(/(\d+(?:[.,]\d+)?(?:\s*y\s*\d+(?:[.,]\d+)?)*\s*(?:mts?|m|km))/i);
  const distanceRaw = distMatch ? distMatch[1].trim() : "";
  const distances = distMatch ? parseDistancesKm(distMatch[1]) : [];

  const iconos: CPIconos = {
    homologated: false,
    inRfeaCalendar: false,
    inAutonomicCalendar: false,
    services: [],
  };
  $(el)
    .find("img.feature-icon")
    .each((_, img) => {
      const title = $(img).attr("title")?.trim() ?? "";
      if (title === "Circuito homologado") iconos.homologated = true;
      else if (title.includes("calendario nacional de la R.F.E.A")) iconos.inRfeaCalendar = true;
      else if (title.includes("calendario Autonómico")) iconos.inAutonomicCalendar = true;
      else if (title) iconos.services.push(title);
    });

  return {
    name,
    slug,
    url: href.startsWith("http") ? href : `${BASE}${href}`,
    date,
    locality,
    province,
    distances,
    distanceRaw,
    iconos,
    sourceFilter,
    sourceCcaa,
  };
}

async function scrapePage(filter: { id: string; slug: string; label: string; ccaa: string | null }, page: number): Promise<CPRace[]> {
  const url = filter.id === ""
    ? `${BASE}/calendario_carreras?page=${page}`
    : `${BASE}/calendario_carreras/lista/${filter.id}/${filter.slug}?page=${page}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "es-ES,es;q=0.9",
    },
  });
  if (!res.ok) {
    console.error(`    ERROR HTTP ${res.status} en ${url}`);
    return [];
  }
  const html = await res.text(); // ya UTF-8 (ver audit-encoding.mjs)
  const $ = cheerio.load(html, { decodeEntities: true });
  const races: CPRace[] = [];
  $("div.fichaEdicion").each((_, el) => {
    const r = parseOneRace(el, $, filter.label, filter.ccaa);
    if (r && r.slug) races.push(r);
  });
  return races;
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  const args = process.argv.slice(2);
  const maxPages = (() => {
    const i = args.indexOf("--maxPagesPerFilter");
    return i >= 0 ? parseInt(args[i + 1], 10) || 1 : 1;
  })();
  const skipHomologadas = args.includes("--no-homologadas");
  const onlyHomologadas = args.includes("--only-homologadas");

  let filters = FILTERS;
  if (onlyHomologadas) {
    filters = FILTERS.filter((f) => f.slug === "carreras_con_circuito_homologado");
  } else if (skipHomologadas) {
    filters = FILTERS.filter((f) => f.slug !== "carreras_con_circuito_homologado");
  }

  console.log(`\nScrapeando ${filters.length} filtros × ${maxPages} página(s) cada uno\n`);

  const bySlug = new Map<string, CPRace>();
  let totalRequests = 0;
  for (const filter of filters) {
    console.log(`▶ ${filter.label}`);
    for (let p = 1; p <= maxPages; p++) {
      const url = filter.id === ""
        ? `${BASE}/calendario_carreras?page=${p}`
        : `${BASE}/calendario_carreras/lista/${filter.id}/${filter.slug}?page=${p}`;
      console.log(`    GET ${url}`);
      const races = await scrapePage(filter, p);
      console.log(`      → ${races.length} carreras`);
      totalRequests++;
      for (const r of races) {
        // Dedup intra: si ya está por slug, preferimos la entrada que tenga homologated=true
        const existing = bySlug.get(r.slug);
        if (!existing) {
          bySlug.set(r.slug, r);
        } else if (!existing.iconos.homologated && r.iconos.homologated) {
          // upgrade: la nueva versión tiene dato homologated que la anterior no
          bySlug.set(r.slug, { ...existing, iconos: r.iconos });
        }
      }
      if (races.length === 0) break; // fin de paginación
      if (p < maxPages) await sleep(jitter(1100));
    }
    await sleep(jitter(500));
  }

  const allRaces = [...bySlug.values()];
  const homologadas = allRaces.filter((r) => r.iconos.homologated).length;
  const conFecha = allRaces.filter((r) => r.date).length;
  const ccaaCount = new Set(allRaces.map((r) => r.province).filter(Boolean)).size;

  console.log(`\n=== Resumen ===`);
  console.log(`Requests HTTP realizados: ${totalRequests}`);
  console.log(`Carreras únicas (dedup por slug): ${allRaces.length}`);
  console.log(`Con icono "Circuito homologado":   ${homologadas}`);
  console.log(`Con fecha parseada:                ${conFecha}`);
  console.log(`Provincias distintas detectadas:   ${ccaaCount}`);

  const outDir = path.dirname(OUT);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(allRaces, null, 2), "utf8");
  console.log(`\nGuardado en: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

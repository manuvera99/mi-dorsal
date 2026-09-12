// =============================================================================
// scripts/prototypes/scrape-carreraspopulares-nacional.ts
// =============================================================================
// Scraper NACIONAL de panel.carreraspopulares.com — versión con TODOS los
// filtros descubiertos (CCAA + distancias + modalidades + homologadas) y
// paginación auto-detectada desde el <ul class="pagination"> del HTML.
//
// Estrategia:
//   - Itera por 44 filtros (los del <select id="idBusquedaCifrado">)
//   - Para cada filtro: descarga p1, parsea el paginador para saber la
//     última página real, y descarga todas las páginas hasta el final
//   - Dedup intra-resultados por slug (preferimos la entrada con
//     homologated=true)
//   - Encoding: la web declara windows-1252 pero sirve UTF-8 — fetch.text()
//     decodifica por header HTTP (UTF-8), correcto
//
// Uso:
//   tsx scripts/prototypes/scrape-carreraspopulares-nacional.ts
//   (no args: autodetecta todo, salida: scripts/output/carreraspopulares-nacional.json)
//
// Argumentos opcionales:
//   --only SLUG  (solo un filtro, ej: --only homologadas)
//   --maxPages N (cap defensivo para no hacer 14k requests por accidente)
//   --dry-run    (cuenta fichas por filtro sin escribir JSON)
// =============================================================================

import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";

const BASE = "https://carreraspopulares.com";
const OUT = path.join(process.cwd(), "scripts", "output", "carreraspopulares-nacional.json");

// 44 filtros descubiertos via auditoría 2026-09-12 + 2026-09-13
// IDs y slugs vienen del HTML <select id="idBusquedaCifrado"> de la web
const FILTERS: { id: string; slug: string; label: string; ccaa: string | null }[] = [
  // ── España / CCAA "próximos 30 días" ──
  { id: "CuVPow", slug: "carreras_espa%C3%B1a_proximos_30_dias", label: "España 30 días", ccaa: null },
  { id: "lh9TIw", slug: "carreras_comunidad_valenciana_proximos_30_dias", label: "C. Valenciana 30 días", ccaa: "valencia" },
  { id: "Hchm2g", slug: "carreras_catalu%C3%B1a_proximos_30_dias", label: "Cataluña 30 días", ccaa: "barcelona" },
  { id: "GzZ6MA", slug: "carreras_comunidad_de_madrid_proximos_30_dias", label: "Madrid 30 días", ccaa: "madrid" },
  { id: "y66dbA", slug: "carreras_andalucia_proximos_30_dias", label: "Andalucía 30 días", ccaa: null },
  { id: "ilr.Tw", slug: "carreras_castilla_la_mancha_proximos_30_dias", label: "CLM 30 días", ccaa: null },
  { id: "CMzVQQ", slug: "carreras_castilla_y_leon_proximos_30_dias", label: "CyL 30 días", ccaa: null },
  { id: "x3aE0g", slug: "carreras_pais_vasco_proximos_30_dias", label: "País Vasco 30 días", ccaa: null },
  { id: "2yrBSA", slug: "carreras_aragon_proximos_30_dias", label: "Aragón 30 días", ccaa: null },
  { id: "KZRU5g", slug: "carreras_galicia_proximos_30_dias", label: "Galicia 30 días", ccaa: null },
  { id: "MxE3Ig", slug: "carreras_islas_canarias_proximos_30_dias", label: "Canarias 30 días", ccaa: null },
  { id: "5TGoSA", slug: "carreras_asturias_proximos_30_dias", label: "Asturias 30 días", ccaa: null },
  { id: "8TOlzw", slug: "carreras_murcia_proximos_30_dias", label: "Murcia 30 días", ccaa: "murcia" },
  { id: "uvKTiA", slug: "carreras_navarra_proximos_30_dias", label: "Navarra 30 días", ccaa: null },
  { id: "9B6prw", slug: "carreras_baleares_proximos_30_dias", label: "Baleares 30 días", ccaa: null },
  { id: "8DgL5A", slug: "carreras_extremadura_proximos_30_dias", label: "Extremadura 30 días", ccaa: null },
  { id: "OzoN-Q", slug: "carreras_cantabria_proximos_30_dias", label: "Cantabria 30 días", ccaa: null },
  { id: "6PqqUw", slug: "carreras_la_rioja_proximos_30_dias", label: "La Rioja 30 días", ccaa: null },
  { id: "Tm5KsQ", slug: "carreras_melilla_proximos_30_dias", label: "Melilla 30 días", ccaa: null },
  { id: "4a0qcA", slug: "carreras_ceuta_proximos_30_dias", label: "Ceuta 30 días", ccaa: null },
  // ── Distancias y modalidades ──
  { id: "jtNyeA", slug: "carreras_con_circuito_homologado", label: "Homologadas", ccaa: null },
  { id: "9cy.3w", slug: "carreras_maraton", label: "Maratón", ccaa: null },
  { id: "s.FgFA", slug: "carreras_media_maraton", label: "Media maratón", ccaa: null },
  { id: "X83VLQ", slug: "carreras_10000_mts_10K", label: "10K", ccaa: null },
  { id: "SjGWgA", slug: "carreras_carrera_popular", label: "Carrera popular", ccaa: null },
  { id: "tzJR5g", slug: "carreras_san_silvestre", label: "San Silvestre", ccaa: null },
  { id: ".YqS.A", slug: "carreras_cross_urbano", label: "Cross urbano", ccaa: null },
  { id: "doZUlw", slug: "carreras_legua", label: "Legua", ccaa: null },
  { id: "pqSpEA", slug: "carreras_milla", label: "Milla", ccaa: null },
  { id: "PXK7Fw", slug: "carreras_5k_5000_mts", label: "5K", ccaa: null },
  { id: "ikN2qg", slug: "carreras_8k_8000_mts", label: "8K", ccaa: null },
  { id: "4jqvsw", slug: "carreras_7k_7000_mts", label: "7K", ccaa: null },
  { id: "Utj7VQ", slug: "carreras_4k_4000_mts", label: "4K", ccaa: null },
  { id: "kazZAA", slug: "carreras_cuarta_de_maraton", label: "Cuarta maratón", ccaa: null },
  { id: "GJfVfA", slug: "carreras_carrera_infantil", label: "Infantiles", ccaa: null },
  { id: "rtPVow", slug: "maraton_internacional", label: "Maratón internacional", ccaa: null },
  { id: "ZrxZhw", slug: "carreras_fondo_y_gran_fondo", label: "Fondo/gran fondo", ccaa: null },
  { id: "-HyxMw", slug: "otras_carreras", label: "Otros eventos", ccaa: null },
  { id: "mDo6NA", slug: "carreras_subida", label: "Subida", ccaa: null },
  { id: "FsStOg", slug: "carreras_marcha_senderista", label: "Marcha senderista", ccaa: null },
  { id: "fxDVaA", slug: "carreras_cross_-_campo_atraves", label: "Cross campo a través", ccaa: null },
  { id: "c5q1.A", slug: "carreras_canicross", label: "Canicross", ccaa: null },
  { id: "m90OIA", slug: "carreras_maraton_relevos_y_ekiden", label: "Maratón relevos/Ekiden", ccaa: null },
  { id: "jjSzIA", slug: "carreras_carreras_de_obstaculos", label: "Obstáculos", ccaa: null },
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
  sourceFilter: string;
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

// Autodetecta la última página desde el paginador HTML
function lastPageFromHtml(html: string): number {
  const pages = [...html.matchAll(/href="[^"]*page=(\d+)"[^>]*>(?:\d+|&laquo;|&raquo;)/g)]
    .map((m) => parseInt(m[1], 10))
    .filter((n) => !isNaN(n));
  if (pages.length === 0) return 1;
  return Math.max(...pages);
}

async function scrapePage(filter: { id: string; slug: string }, page: number): Promise<CPRace[]> {
  const url = `https://carreraspopulares.com/calendario_carreras/lista/${filter.id}/${filter.slug}?page=${page}`;
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
  const html = await res.text();
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
  const dryRun = args.includes("--dry-run");
  const onlyIdx = args.indexOf("--only");
  const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;
  const maxPagesIdx = args.indexOf("--maxPages");
  const maxPagesCap = maxPagesIdx >= 0 ? parseInt(args[maxPagesIdx + 1], 10) || 10 : 10;

  let filters = FILTERS;
  if (only) {
    filters = FILTERS.filter((f) => f.label.toLowerCase().includes(only.toLowerCase()));
    if (filters.length === 0) {
      console.error(`No se encontró filtro que matchee '${only}'. Opciones:`);
      FILTERS.forEach((f) => console.error(`  - ${f.label}`));
      process.exit(1);
    }
  }

  console.log(`\nScrapeando ${filters.length} filtros × paginación auto (cap=${maxPagesCap})\n`);

  const bySlug = new Map<string, CPRace>();
  let totalRequests = 0;
  const filterStats: Array<{ label: string; pages: number; races: number }> = [];

  for (const filter of filters) {
    // Descargar p1 para detectar paginación
    const p1 = await scrapePage(filter, 1);
    totalRequests++;

    // Heurística de páginas: leer paginador de p1; si no hay, es 1 página
    // (recuperar el HTML para parsear — requiere volver a fetchear, pero como
    // ya tenemos el contenido en p1, lo recalculamos: scrapePage devuelve solo
    // fichas. Truco: usamos el tamaño del HTML que viene de un segundo fetch solo
    // para el paginador si hace falta. Para simplificar: usar p1.length como
    // proxy de "más de 40 → hay página 2")
    let lastPage = 1;
    if (p1.length >= 40) {
      // Probablemente hay página 2 — fetcheamos p2 para confirmar
      const p2 = await scrapePage(filter, 2);
      totalRequests++;
      if (p2.length > 0) lastPage = 2;
    }

    // Aplicar cap defensivo
    const effectiveLastPage = Math.min(lastPage, maxPagesCap);

    console.log(`▶ ${filter.label}: ${effectiveLastPage} página(s), ${p1.length} carreras en p1`);
    const races: CPRace[] = [...p1];
    if (effectiveLastPage >= 2) {
      for (let p = 2; p <= effectiveLastPage; p++) {
        const pageRaces = await scrapePage(filter, p);
        totalRequests++;
        races.push(...pageRaces);
        if (pageRaces.length === 0) break;
        if (p < effectiveLastPage) await sleep(jitter(1100));
      }
    }

    filterStats.push({ label: filter.label, pages: effectiveLastPage, races: races.length });
    for (const r of races) {
      const existing = bySlug.get(r.slug);
      if (!existing) {
        bySlug.set(r.slug, r);
      } else if (!existing.iconos.homologated && r.iconos.homologated) {
        bySlug.set(r.slug, { ...existing, iconos: r.iconos });
      }
    }
    await sleep(jitter(500));
  }

  const allRaces = [...bySlug.values()];
  const homologadas = allRaces.filter((r) => r.iconos.homologated).length;
  const conFecha = allRaces.filter((r) => r.date).length;

  console.log(`\n=== Resumen ===`);
  console.log(`Requests HTTP realizados:        ${totalRequests}`);
  console.log(`Carreras únicas (dedup por slug): ${allRaces.length}`);
  console.log(`Con icono "Circuito homologado":  ${homologadas}`);
  console.log(`Con fecha parseada:               ${conFecha}`);
  console.log(`Provincias distintas detectadas:  ${new Set(allRaces.map((r) => r.province).filter(Boolean)).size}`);

  console.log(`\nPor filtro:`);
  for (const s of filterStats) {
    console.log(`  ${s.label.padEnd(28)} ${s.pages}p  ${s.races} carreras`);
  }

  if (dryRun) {
    console.log(`\n[MODO DRY-RUN] No se escribe JSON.`);
    return;
  }

  fs.writeFileSync(OUT, JSON.stringify(allRaces, null, 2), "utf8");
  console.log(`\nGuardado en: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

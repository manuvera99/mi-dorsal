// =============================================================================
// scripts/prototypes/scrape-carreraspopulares.ts
// =============================================================================
// PROTOTIPO de scraper para panel.carreraspopulares.com
//
// Objetivo: validar que podemos extraer carreras con metadatos útiles
// (especialmente el icono "Circuito homologado") de la web de carreraspopulares.com.
//
// Estrategia (basada en auditoría 2026-09-12):
//   - Sin API REST → scraping HTML directo (Laravel + Bootstrap 3 server-side)
//   - robots.txt permite todo (Disallow vacío)
//   - Encoding declarado: windows-1252, servido como UTF-8 → normalizar a UTF-8
//   - Selector estable: <div class="fichaEdicion"> por carrera
//   - Paginación: ?page=N (probado en auditoría)
//   - Rate limit: sin bloqueos en 5 GETs/4s → usar 1 req/seg con jitter
//
// Uso:
//   tsx scripts/prototypes/scrape-carreraspopulares.ts [filter] [maxPages]
//
// Ejemplos:
//   tsx scripts/prototypes/scrape-carreraspopulares.ts homologadas 1
//   tsx scripts/prototypes/scrape-carreraspopulares.ts cvalenciana 3
//   tsx scripts/prototypes/scrape-carreraspopulares.ts all 5
// =============================================================================

import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";

const BASE = "https://carreraspopulares.com";

// Filtros pre-armados de la auditoría (URLs ya probadas y funcionales).
// Cada filtro tiene un idBusquedaCifrado y un slug que la web acepta.
const FILTERS: Record<string, { id: string; slug: string; label: string }> = {
  homologadas: {
    id: "jtNyeA",
    slug: "carreras_con_circuito_homologado",
    label: "Carreras con circuito homologado",
  },
  cvalenciana: {
    id: "lh9TIw",
    slug: "carreras_comunidad_valenciana_proximos_30_dias",
    label: "Carreras Comunidad Valenciana próximos 30 días",
  },
  cataluña: {
    id: "Hchm2g",
    slug: "carreras_catalu\u00f1a_proximos_30_dias",
    label: "Carreras Cataluña próximos 30 días",
  },
  madrid: {
    id: "GzZ6MA",
    slug: "carreras_comunidad_de_madrid_proximos_30_dias",
    label: "Carreras Comunidad de Madrid próximos 30 días",
  },
  andalucia: {
    id: "y66dbA",
    slug: "carreras_andalucia_proximos_30_dias",
    label: "Carreras Andalucía próximos 30 días",
  },
  all: {
    id: "",
    slug: "",
    label: "Calendario general",
  },
};

interface CPHomologacionesIcon {
  homologated: boolean;
  inRfeaCalendar: boolean;
  inAutonomicCalendar: boolean;
  services: string[];
}

interface CPRace {
  name: string;
  slug: string;
  url: string;
  date?: string; // YYYY-MM-DD
  locality?: string;
  province?: string;
  distances: number[]; // km
  distanceRaw: string;
  iconos: CPHomologacionesIcon;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(base: number, spread = 200): number {
  return base + Math.floor(Math.random() * spread);
}

// Convierte fechas en español tipo "Domingo 08 noviembre 2026" o "dd/mm/yyyy" → "yyyy-mm-dd".
// Devuelve undefined si no encaja.
const SPANISH_MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
function parseDateAny(s: string): string | undefined {
  // Formato 1: "Domingo 08 noviembre 2026" (texto)
  const m1 = s.match(/(\d{1,2})\s+([a-záéíóúñ]+)\s+(\d{4})/i);
  if (m1) {
    const dd = parseInt(m1[1], 10);
    const monthName = m1[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const mm = SPANISH_MONTHS[monthName];
    const yyyy = m1[3];
    if (mm) return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  // Formato 2: "dd/mm/yyyy"
  const m2 = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m2) {
    const [, dd, mm, yyyy] = m2;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return undefined;
}

// Parsea "21.097 mts" o "21.000 y 11.000 m" → [21.097, 11]
function parseDistancesM(s: string): number[] {
  // Extrae todos los números seguidos de "m", "mts" o "km"
  const re = /(\d+(?:[.,]\d+)?)\s*(?:mts?|m|km)/gi;
  const matches = [...s.matchAll(re)];
  const out: number[] = [];
  for (const m of matches) {
    let n = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
    // Si la unidad es "mts" o "m", está en metros → convertir a km si > 100
    // (heurística: 21.097 → 21.097, pero "5000 mts" → 5 km, "5000 m" → 5 km)
    if (/(?:^|\s)(?:mts?|m)\b/i.test(m[0])) {
      if (n > 100) n = n / 1000;
    }
    out.push(n);
  }
  return out;
}

function parseOneRace(html: string, $: cheerio.CheerioAPI): CPRace | null {
  const $h4 = $(html).find("h4 a");
  const href = $h4.attr("href");
  if (!href) return null;
  const name = $h4.text().trim();
  const slugMatch = href.match(/\/carrera\/([^/?#]+)/);
  const slug = slugMatch ? slugMatch[1] : "";

  // infoPruebaListaKK contiene <p> con <span> glyphicons:
  //   glyphicon-calendar  → dd/mm/yyyy
  //   glyphicon-map-marker → "Localidad (Provincia)" (a veces solo Localidad)
  //   glyphicon-resize-horizontal → "21.000 y 11.000 m"
  const $info = $(html).find(".infoPruebaListaKK p").first();
  const infoText = $info.text();

  // Fecha: viene como "Domingo 08 noviembre 2026" (texto) o "dd/mm/yyyy"
  const date = parseDateAny(infoText);

  // Localidad/Provincia: extraer del texto del <p> la línea tras glyphicon-map-marker
  // Estrategia robusta: split por líneas tras \n (cheerio a veces preserva saltos)
  let locality: string | undefined;
  let province: string | undefined;
  // El HTML tiene saltos entre </br>. En .text() se pierde, así que usamos el HTML:
  const innerHtml = $info.html() ?? "";
  const lines = innerHtml.split(/<\/br>|<br\s*\/?>/i);
  for (const line of lines) {
    if (/map-marker/.test(line)) {
      // Limpiar el span y quedarnos con el texto
      const cleaned = line
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      // cleaned = "Gandia (Valencia)"
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

  // Distancias: extraer todos los números seguidos de "m", "mts" o "km"
  const distMatch = infoText.match(/(\d+(?:[.,]\d+)?(?:\s*y\s*\d+(?:[.,]\d+)?)*\s*(?:mts?|m|km))/i);
  const distanceRaw = distMatch ? distMatch[1].trim() : "";
  const distances = distMatch ? parseDistancesM(distMatch[1]) : [];

  // Iconos de servicios (feature-icon)
  const iconos: CPHomologacionesIcon = {
    homologated: false,
    inRfeaCalendar: false,
    inAutonomicCalendar: false,
    services: [],
  };
  $(html)
    .find("img.feature-icon")
    .each((_, img) => {
      const title = $(img).attr("title")?.trim() ?? "";
      const alt = $(img).attr("alt")?.trim() ?? "";
      const label = title || alt;
      if (label === "Circuito homologado") iconos.homologated = true;
      else if (label.includes("calendario nacional de la R.F.E.A")) iconos.inRfeaCalendar = true;
      else if (label.includes("calendario Autonómico")) iconos.inAutonomicCalendar = true;
      else if (label) iconos.services.push(label);
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
  };
}

function buildListUrl(filter: { id: string; slug: string }, page: number): string {
  if (!filter.id) {
    // Calendario general
    return `${BASE}/calendario_carreras?page=${page}`;
  }
  return `${BASE}/calendario_carreras/lista/${filter.id}/${filter.slug}?page=${page}`;
}

async function scrapePage(filter: { id: string; slug: string }, page: number): Promise<CPRace[]> {
  const url = buildListUrl(filter, page);
  console.log(`  GET ${url}`);

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "es-ES,es;q=0.9",
    },
  });

  if (!res.ok) {
    console.error(`    ERROR HTTP ${res.status}`);
    return [];
  }

  // El servidor declara `charset=windows-1252` en el <meta> pero en realidad
  // envía UTF-8 (verificado con debug-encoding.mjs: bytes c3 93 = UTF-8 "Ó").
  // fetch.text() decodifica según el header HTTP (UTF-8) → correcto.
  // NOTA: el <meta charset=windows-1252> es una MENTIRA del sitio. Forzamos UTF-8.
  const html = await res.text();
  const $ = cheerio.load(html, { decodeEntities: true });

  const races: CPRace[] = [];
  $("div.fichaEdicion").each((_, el) => {
    const race = parseOneRace(el, $);
    if (race && race.slug) races.push(race);
  });
  return races;
}

async function main() {
  const filterKey = (process.argv[2] ?? "homologadas").toLowerCase();
  const maxPages = parseInt(process.argv[3] ?? "1", 10);
  const filter = FILTERS[filterKey];
  if (!filter) {
    console.error(`Filtro desconocido: ${filterKey}. Opciones: ${Object.keys(FILTERS).join(", ")}`);
    process.exit(1);
  }

  console.log(`\nScrapeando "${filter.label}" (max ${maxPages} página(s))…\n`);

  const allRaces: CPRace[] = [];
  for (let p = 1; p <= maxPages; p++) {
    const races = await scrapePage(filter, p);
    console.log(`    → ${races.length} carreras extraídas`);
    allRaces.push(...races);
    if (races.length === 0) break; // paginación agotada
    if (p < maxPages) await sleep(jitter(1000));
  }

  // Resumen
  const homologadas = allRaces.filter((r) => r.iconos.homologated).length;
  const inRfea = allRaces.filter((r) => r.iconos.inRfeaCalendar).length;
  const withDate = allRaces.filter((r) => r.date).length;
  console.log(`\n=== Resumen ===`);
  console.log(`Total carreras: ${allRaces.length}`);
  console.log(`Con icono "Circuito homologado": ${homologadas}`);
  console.log(`En calendario RFEA: ${inRfea}`);
  console.log(`Con fecha parseada: ${withDate}`);

  // Guardar
  const outDir = path.join(process.cwd(), "scripts", "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `carreraspopulares-${filterKey}.json`);
  fs.writeFileSync(outFile, JSON.stringify(allRaces, null, 2), "utf8");
  console.log(`\nGuardado en: ${outFile}`);

  // Mostrar 3 ejemplos
  console.log(`\n=== Ejemplos (primeras 3) ===`);
  for (const r of allRaces.slice(0, 3)) {
    console.log(`\n  · ${r.name}`);
    console.log(`    slug: ${r.slug}`);
    console.log(`    url:  ${r.url}`);
    console.log(`    fecha: ${r.date ?? "(sin fecha)"}`);
    console.log(`    lugar: ${r.locality ?? "?"}${r.province ? ` (${r.province})` : ""}`);
    console.log(`    distancias: [${r.distances.join(", ")}] km`);
    console.log(`    homologado: ${r.iconos.homologated} | RFEA: ${r.iconos.inRfeaCalendar} | auton.: ${r.iconos.inAutonomicCalendar}`);
    console.log(`    servicios: ${r.iconos.services.slice(0, 5).join(", ")}${r.iconos.services.length > 5 ? "…" : ""}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

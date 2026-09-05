// =============================================================================
// scripts/ingest-chiplevante.ts
// =============================================================================
// Ingesta del catálogo de carreras de ChipLevante (chiplevante.com) desde su
// endpoint AJAX público:
//
//   POST https://www.chiplevante.com/modulos/list_pruebas.php
//   body: hist=S (histórico) & sch_txt= & sch_lugar= & sch_fecha= & sch_tipo= & pg=N
//   resp: { resultado_html: "<article id='evento_1100'>…</article>…", last: 1|0 }
//
// Pagina hasta que `last === 1`. Parsea cada <article> para sacar evento_id,
// nombre, fecha, localidad, provincia y URL canónica de la prueba.
//
// Luego sube cada carrera a Convex vía `api.races.systemUpsert`, que:
//   - Dedupa por officialUrl
//   - Auto-asigna scraperAdapter: "chiplevante" si la URL es de chiplevante.com
//   - Si ya existe en correbirras, añade chiplevante a additionalDataSourceIds
//     sin tocar dataSourceId (multi-source)
//
// Uso:
//   npx tsx --env-file=.env.local scripts/ingest-chiplevante.ts            # dry-run
//   npx tsx --env-file=.env.local scripts/ingest-chiplevante.ts --upload   # sube a Convex
//   npx tsx --env-file=.env.local scripts/ingest-chiplevante.ts --limit=20 # máx 20 páginas
// =============================================================================

import * as cheerio from "cheerio";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const ENDPOINT = "https://www.chiplevante.com/modulos/list_pruebas.php";
const BASE_URL = "https://www.chiplevante.com";
const UPLOAD = process.argv.includes("--upload");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const MAX_PAGES = limitArg ? parseInt(limitArg.split("=")[1], 10) : 200;
const PAGE_DELAY_MS = 250; // cortesía con chiplevante

// =============================================================================
// Tipos
// =============================================================================

interface ChiplevanteEvent {
  eventoId: string;
  name: string;
  date: string;     // YYYY-MM-DD
  locality: string;
  province: string; // tal como viene de la web (ej. "ALICANTE")
  url: string;      // https://www.chiplevante.com/es/prueba/{slug}-{id}-{year}
  year: number;
}

// =============================================================================
// Helpers
// =============================================================================

const MONTHS_ES: Record<string, number> = {
  ene: 1, enero: 1,
  feb: 2, febrero: 2,
  mar: 3, marzo: 3,
  abr: 4, abril: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6,
  jul: 7, julio: 7,
  ago: 8, agosto: 8,
  sep: 9, sept: 9, set: 9, septiembre: 9, setiembre: 9,
  oct: 10, octubre: 10,
  nov: 11, noviembre: 11,
  dic: 12, diciembre: 12,
};

const PROV_NORMALIZE: Record<string, string> = {
  "alicante": "alicante", "alacant": "alicante",
  "murcia": "murcia",
  "albacete": "albacete",
  "valencia": "valencia", "valencia": "valencia",
  "castellon": "castellon", "castello": "castellon",
  "almeria": "almeria",
  // Fallback razonable: si no reconocemos la provincia, asumimos valencia (centro
  // histórico de mi-dorsal). El admin puede corregirlo manualmente.
};

function normalizeProvince(p: string): string {
  const norm = (p ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  return PROV_NORMALIZE[norm] ?? "valencia";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchChiplevantePage(page: number): Promise<{ html: string; last: boolean }> {
  const body = new URLSearchParams({
    hist: "S",
    sch_txt: "",
    sch_lugar: "",
    sch_fecha: "",
    sch_tipo: "",
    pg: String(page),
  }).toString();

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "Mozilla/5.0 mi-dorsal/0.1",
      Accept: "application/json, text/javascript, */*; q=0.01",
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching page ${page}`);
  }

  const data: any = await res.json();
  return {
    html: typeof data?.resultado_html === "string" ? data.resultado_html : "",
    last: data?.last === 1 || data?.last === "1",
  };
}

function parseEvents(html: string): ChiplevanteEvent[] {
  if (!html || !html.trim()) return [];
  const $ = cheerio.load(html);
  const events: ChiplevanteEvent[] = [];

  $("article[id^='evento_']").each((_, el) => {
    try {
      const id = $(el).attr("id") ?? "";
      const eventoId = id.replace(/^evento_/, "");
      if (!/^\d+$/.test(eventoId)) return;

      // Link: <h2><a href="/es/prueba/slug-id-year">NAME</a></h2>
      const a = $(el).find("h2 a").first();
      const href = a.attr("href") ?? "";
      const name = a.text().trim();
      if (!href || !name) return;

      // URL pattern: /es/prueba/{slug}-{evento_id}-{year}
      const urlMatch = href.match(/\/es\/prueba\/(.+?)-(\d+)-(\d{4})/);
      if (!urlMatch) return;
      const urlYear = parseInt(urlMatch[3], 10);

      // Fecha
      const mesTxt = $(el).find(".mes_calendario-grande strong").text().trim().toLowerCase();
      const diaTxt = $(el).find(".dia_calendario-grande").text().trim();
      const anoTxt = $(el).find(".ano_calendario-grande strong").text().trim();
      const mesNum = MONTHS_ES[mesTxt];
      const dia = parseInt(diaTxt, 10);
      const ano = parseInt(anoTxt, 10);
      if (!mesNum || isNaN(dia) || isNaN(ano)) return;
      const date = `${ano}-${String(mesNum).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

      // Locality + province
      const locText = $(el)
        .find(".tg-localizacion")
        .text()
        .replace(/\s+/g, " ")
        .trim();
      // Típico: "ELCHE - ALICANTE" o "ALICANTE - ALICANTE" o solo "ALICANTE"
      const locMatch = locText.match(/^(.+?)\s*-\s*(.+)$/);
      const locality = locMatch ? locMatch[1].trim() : locText;
      const province = locMatch ? locMatch[2].trim() : "";

      events.push({
        eventoId,
        name,
        date,
        locality,
        province,
        url: `${BASE_URL}${href}`,
        year: urlYear,
      });
    } catch {
      // Si una card falla, seguimos con las demás
    }
  });

  return events;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("=".repeat(70));
  console.log("Ingest de carreras de ChipLevante");
  console.log("=".repeat(70));
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Max páginas: ${MAX_PAGES}`);
  console.log(`Modo: ${UPLOAD ? "UPLOAD A PROD" : "DRY-RUN (añade --upload para subir)"}\n`);

  // 1. Descargar todas las páginas
  const allEvents: ChiplevanteEvent[] = [];
  let page = 1;
  let isLast = false;
  let emptyStreak = 0;

  while (!isLast && page <= MAX_PAGES) {
    process.stdout.write(`\rDescargando página ${page}…`);
    try {
      const { html, last } = await fetchChiplevantePage(page);
      const events = parseEvents(html);
      if (events.length === 0) {
        emptyStreak++;
        if (emptyStreak >= 3) {
          console.log(`\n   3 páginas vacías seguidas → fin.`);
          break;
        }
      } else {
        emptyStreak = 0;
        allEvents.push(...events);
      }
      isLast = last;
      page++;
      await sleep(PAGE_DELAY_MS);
    } catch (err: any) {
      console.error(`\n   Error en página ${page}: ${err?.message ?? err}`);
      break;
    }
  }

  console.log(`\n\nTotal eventos descargados: ${allEvents.length}\n`);

  if (allEvents.length === 0) {
    console.log("No se descargaron eventos. Abortando.");
    process.exit(0);
  }

  // 1b. Filtrar por año: solo carreras del año en curso en adelante.
  // El usuario no quiere histórico lejano en el catálogo público; si alguien
  // necesita una carrera de 2018, que la pida explícitamente.
  const MIN_YEAR = new Date().getFullYear(); // ej. 2026
  const minDate = `${MIN_YEAR}-01-01`;
  const beforeCount = allEvents.length;
  for (let i = allEvents.length - 1; i >= 0; i--) {
    if (allEvents[i].date < minDate) allEvents.splice(i, 1);
  }
  if (allEvents.length < beforeCount) {
    console.log(
      `\nFiltro aplicado: solo carreras de ${MIN_YEAR} en adelante. ` +
        `Eliminadas ${beforeCount - allEvents.length} de años anteriores.`,
    );
  }

  // 2. Stats
  const byProv: Record<string, number> = {};
  const byYear: Record<number, number> = {};
  let futureCount = 0;
  const today = new Date().toISOString().split("T")[0];
  for (const e of allEvents) {
    const p = normalizeProvince(e.province);
    byProv[p] = (byProv[p] ?? 0) + 1;
    byYear[e.year] = (byYear[e.year] ?? 0) + 1;
    if (e.date >= today) futureCount++;
  }
  console.log(`Futuras: ${futureCount}  |  Pasadas: ${allEvents.length - futureCount}`);
  console.log("\nPor provincia:");
  for (const [p, n] of Object.entries(byProv).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${p}: ${n}`);
  }
  console.log("\nPor año:");
  for (const [y, n] of Object.entries(byYear).sort()) {
    console.log(`  ${y}: ${n}`);
  }
  console.log();

  // 3. Mostrar una muestra
  console.log("Primeras 5 futuras:");
  const futures = allEvents.filter((e) => e.date >= today).slice(0, 5);
  for (const e of futures) {
    console.log(`  ${e.date}  ${e.name.slice(0, 50).padEnd(52)}  ${e.locality.slice(0, 25).padEnd(25)} (${e.province})`);
    console.log(`    → ${e.url}`);
  }
  console.log();

  if (!UPLOAD) {
    console.log("Para subir a Convex: añade --upload");
    return;
  }

  // 4. Subir a Convex
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error("❌ NEXT_PUBLIC_CONVEX_URL no configurado");
    process.exit(1);
  }
  const client = new ConvexHttpClient(convexUrl);

  console.log("Asegurando dataSource 'chiplevante'…");
  const sources = await client.query(api.dataSources.listPublic, {});
  let src = sources.find((s: any) => s.slug === "chiplevante");
  if (!src) {
    const id = await client.mutation(api.dataSources.systemCreate, {
      name: "ChipLevante",
      slug: "chiplevante",
      type: "api",
      description:
        "Cronometrador con base en Alicante. Cubre carreras populares de Alicante, Murcia, Albacete y Valencia. Catálogo vía /modulos/list_pruebas.php; resultados por dorsal vía /secciones/clasificaciones/dame_id_corredor.php.",
      baseUrl: "https://www.chiplevante.com",
      config: { scrapedAt: new Date().toISOString() },
    });
    src = { _id: id };
    console.log(`   ✅ Fuente 'chiplevante' creada: ${id}`);
  } else {
    console.log(`   ✅ Fuente 'chiplevante' ya existe: ${src._id}`);
  }
  const sourceId = src._id;

  console.log(`\nSubiendo ${allEvents.length} carreras (idempotente)…\n`);
  let created = 0,
    updated = 0,
    failed = 0;
  const errors: string[] = [];

  for (const e of allEvents) {
    try {
      const res: any = await client.mutation(api.races.systemUpsert, {
        name: e.name,
        locality: e.locality,
        province: normalizeProvince(e.province) as any,
        distanceKm: 10, // genérico; el deep-extract puede afinar
        raceType: "road",
        startDate: e.date,
        organizer: "ChipLevante",
        officialUrl: e.url,
        isPublished: true,
        isFeatured: false,
        // NO pasamos scraperAdapter: systemUpsert lo auto-asigna por URL.
        dataSourceId: sourceId,
      });
      if (res?.action === "created") {
        created++;
        process.stdout.write(".");
      } else {
        updated++;
        process.stdout.write("u");
      }
    } catch (err: any) {
      failed++;
      process.stdout.write("x");
      if (errors.length < 3) errors.push(`${e.name}: ${err?.message ?? err}`);
    }
  }

  console.log(`\n\n✅ ${created} creadas, ${updated} actualizadas, ${failed} fallaron`);
  if (errors.length) console.log("Errores (max 3):", errors);
}

main().catch((err) => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});

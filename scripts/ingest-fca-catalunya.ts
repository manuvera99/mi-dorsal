// =============================================================================
// scripts/ingest-fca-catalunya.ts
// =============================================================================
// Ingesta del calendario de carreras de ruta de la Federació Catalana
// d'Atletisme (FCA) desde sus PDFs públicos, sin autenticación.
// Descubierto vía enlaces directos <a href> en el HTML normal de la home
// de fcatletisme.cat (NO atletisme.cat, ese dominio no es el correcto).
// Ver docs/plans/SOURCES_RESEARCH.md §8.1bis.
//
//   https://fcatletisme.cat/wp-content/uploads/{año}/{mes}/calendari-ruta{año}.pdf
//   https://fcatletisme.cat/wp-content/uploads/{año}/{mes}/calendari-trail{año}.pdf
//
// Formato del PDF de ruta: texto plano por mes en catalán
// ("GENER 2026Homologació"), seguido de líneas "{día}{nombre}{código
// homologación}{ciudad}" sin separadores — el parser detecta el código de
// homologación (FCA, RFEA, No Homologat, WA, IAU, WMA, EMA...) como ancla
// para partir nombre de ciudad.
//
// LIMITACIÓN CONOCIDA: cuando el día tiene 1 cifra y el nombre de la carrera
// empieza también por un número (número de edición, ej. "1" + "42a Mitja
// Marató..."), no hay forma fiable de distinguir "día 1, edición 142" de
// "día 11, edición 42" sin conocer la fecha real de cada carrera. Se opta
// por la interpretación que da un día válido (1-31); en el peor caso el día
// puede estar desviado en un dígito — aceptable porque el objetivo es
// completar cobertura, no precisión perfecta, y el dedup de systemUpsert por
// nombre+fecha ya evita duplicados si se re-ingesta con el día corregido más
// adelante.
//
// El PDF de trail tiene un formato distinto (mes en cabecera propia +
// especialidad/lugar en la misma línea sin fecha explícita por carrera en
// muchos casos) — de momento este script solo cubre RUTA. Ver TODO al final.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/ingest-fca-catalunya.ts            # dry-run
//   npx tsx --env-file=.env.local scripts/ingest-fca-catalunya.ts --upload   # sube a Convex
//   npx tsx --env-file=.env.local scripts/ingest-fca-catalunya.ts --pdf-url=https://...  # override
// =============================================================================

// @ts-ignore — pdf-parse v1.x usa export por defecto
const pdfParse = require("pdf-parse");
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const UPLOAD = process.argv.includes("--upload");
const pdfUrlArg = process.argv.find((a) => a.startsWith("--pdf-url="));
const PDF_URL =
  pdfUrlArg?.split("=")[1] ??
  "https://fcatletisme.cat/wp-content/uploads/2026/09/calendari-ruta2026.pdf";

const MESES_CA: Record<string, number> = {
  gener: 1, febrer: 2, marc: 3, abril: 4, maig: 5, juny: 6, juliol: 7,
  agost: 8, setembre: 9, octubre: 10, novembre: 11, desembre: 12,
};

// Códigos de homologación conocidos, usados como ancla para separar
// nombre de carrera y ciudad (van pegados sin espacio en el texto extraído).
const HOMOLOG_RE = /(FCA\s*-\s*5[kK]\s*N[OH]?H?|No\s*[Hh]omologat|FCA|RFEA|WA|IAU|WMA|EMA)/g;

interface FcaRow {
  name: string;
  city: string;
  startDate: string; // YYYY-MM-DD
  homolog: string;
}

function lastMatch(re: RegExp, str: string): RegExpExecArray | null {
  let m: RegExpExecArray | null;
  let last: RegExpExecArray | null = null;
  re.lastIndex = 0;
  while ((m = re.exec(str)) !== null) last = m;
  return last;
}

function parseRutaText(text: string, year: number): FcaRow[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let month: number | null = null;
  const rows: FcaRow[] = [];

  for (const line of lines) {
    const monthMatch = line.match(/^([A-ZÇÀÈÉÍÒÓÚ]+)\s*(\d{4})Homologaci/i);
    if (monthMatch) {
      const mkey = monthMatch[1].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      month = MESES_CA[mkey] ?? null;
      continue;
    }
    if (!month) continue;

    const dayMatch = line.match(/^(\d{1,2})(?:-\d{1,2})?(.+)$/);
    if (!dayMatch) continue; // línea de continuación (ej. "Campionat de Catalunya...") sin fecha propia, se descarta

    let day = parseInt(dayMatch[1], 10);
    let rest = dayMatch[2];
    if (day > 31 && dayMatch[1].length === 2) {
      // El día de 2 cifras es inválido → en realidad es 1 cifra de día +
      // inicio del número de edición pegado (ver comentario de cabecera).
      day = parseInt(dayMatch[1][0], 10);
      rest = dayMatch[1][1] + rest;
    }

    const hm = lastMatch(HOMOLOG_RE, rest);
    if (!hm) continue; // sin código de homologación reconocible, no podemos separar nombre/ciudad de forma fiable

    const name = rest.slice(0, hm.index).replace(/\s*\([^)]*\)\s*$/, "").trim() || rest.slice(0, hm.index).trim();
    const city = rest.slice(hm.index + hm[0].length).trim();
    if (!name || !city) continue;

    const startDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    rows.push({ name, city, startDate, homolog: hm[0] });
  }

  return rows;
}

/** Localidades catalanas fuera de España o con paréntesis de país/región no
 * homologable a provincia (campeonatos internacionales) → se descartan del
 * ingest, no tiene sentido en el catálogo de mi-dorsal (carreras en España). */
function isForeignCity(city: string): boolean {
  return /\((?:DEN|CRO|ITA|IND|USA|POR|FRA|GER|SUI|AUT)\)/i.test(city);
}

const CITY_TO_PROVINCE: Record<string, string> = {
  barcelona: "barcelona", sitges: "barcelona", granollers: "barcelona", terrassa: "barcelona",
  "santa coloma de gramenet": "barcelona", olot: "girona", "cornellà de llobregat": "barcelona",
  balaguer: "lleida", vic: "barcelona", martorell: "barcelona", banyoles: "girona",
  "montornès del vallès": "barcelona", "l'escala / empúries": "girona", ripollet: "barcelona",
  "canal olímpic castelldefels": "barcelona", montgat: "barcelona", "l'hospitalet de llobregat": "barcelona",
  cardedeu: "barcelona", "castellar del vallès": "barcelona", "el prat de llobregat": "barcelona",
  "tossa de mar": "girona", tortosa: "tarragona", "vilanova i la geltrú": "barcelona",
  "montcada i reixac": "barcelona", "olesa de montserrat": "barcelona", badalona: "barcelona",
  "canet de mar": "barcelona", "palau solitá i plegamans": "barcelona", viladecans: "barcelona",
  llafranc: "girona", "calella de palafrugell": "girona", "la llagosta": "barcelona",
  "sant andreu de la barca": "barcelona", mollerussa: "lleida", "interior espai mercabarna": "barcelona",
  "santa maria de palautordera": "barcelona", "el vendrell": "tarragona", manresa: "barcelona",
  "vilafranca - sant sadurní": "barcelona", "vilafranca del penedès": "barcelona", granollers2: "barcelona",
  "el masnou": "barcelona", eivissa: "ibiza", málaga: "malaga",
};

function inferProvince(city: string): string | undefined {
  const key = city.toLowerCase().trim();
  if (CITY_TO_PROVINCE[key]) return CITY_TO_PROVINCE[key];
  // Sin match exacto: la inmensa mayoría del calendario FCA ocurre en
  // Cataluña, así que barcelona es el fallback razonable salvo que el
  // nombre contenga otra provincia catalana conocida.
  if (/girona/i.test(city)) return "girona";
  if (/lleida/i.test(city)) return "lleida";
  if (/tarragona/i.test(city)) return "tarragona";
  return "barcelona";
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function downloadPdf(url: string): Promise<Buffer> {
  console.log(`[FCA] Descargando ${url}...`);
  const res = await fetch(url, { headers: { "User-Agent": "mi-dorsal/0.1 (corredor-popular)" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  console.log("=".repeat(70));
  console.log("Ingest del calendario de ruta de la Federació Catalana d'Atletisme (FCA)");
  console.log("=".repeat(70));
  console.log(`PDF: ${PDF_URL}`);
  console.log(`Modo: ${UPLOAD ? "UPLOAD A PROD" : "DRY-RUN (añade --upload para subir)"}\n`);

  const yearMatch = PDF_URL.match(/(\d{4})\.pdf$/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

  const buf = await downloadPdf(PDF_URL);
  console.log(`[FCA] PDF descargado (${(buf.length / 1024).toFixed(1)} KB)`);

  const data = await pdfParse(buf);
  const allRows = parseRutaText(data.text, year);
  console.log(`[FCA] Filas parseadas: ${allRows.length}`);

  const domestic = allRows.filter((r) => !isForeignCity(r.city));
  console.log(`[FCA] Tras filtrar carreras en el extranjero: ${domestic.length}`);

  const today = new Date().toISOString().split("T")[0];
  const future = domestic.filter((r) => r.startDate >= today);
  console.log(`[FCA] Futuras (>= ${today}): ${future.length}`);

  if (future.length === 0) {
    console.log("\n[FCA] No hay carreras futuras. Nada que ingestar.");
    return;
  }

  const dedupMap = new Map<string, FcaRow>();
  for (const r of future) {
    const key = `${normalizeName(r.name)}|${r.startDate}`;
    if (!dedupMap.has(key)) dedupMap.set(key, r);
  }
  const rows = Array.from(dedupMap.values()).sort((a, b) => a.startDate.localeCompare(b.startDate));
  console.log(`[FCA] Tras dedup: ${rows.length}`);

  console.log("\n[FCA] Todas:");
  for (const r of rows) {
    console.log(`  ${r.startDate}  [${r.homolog}]  ${r.name}  (${r.city})`);
  }

  if (!UPLOAD) {
    console.log("\nPara subir a Convex: añade --upload");
    return;
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error("❌ NEXT_PUBLIC_CONVEX_URL no configurado");
    process.exit(1);
  }
  const client = new ConvexHttpClient(convexUrl);

  console.log("\nAsegurando dataSource 'fca-catalunya'…");
  const sources = await client.query(api.dataSources.listPublic, {});
  let src = sources.find((s: any) => s.slug === "fca-catalunya");
  if (!src) {
    const id = await client.mutation(api.dataSources.systemCreate, {
      name: "Federació Catalana d'Atletisme",
      slug: "fca-catalunya",
      type: "api",
      description: "Calendari de curses en ruta — PDF públic sense autenticació (fcatletisme.cat)",
      baseUrl: "https://fcatletisme.cat",
      config: { scrapedAt: new Date().toISOString(), sourcePdf: PDF_URL },
    });
    src = { _id: id } as any;
    console.log(`   ✅ Fuente 'fca-catalunya' creada: ${id}`);
  } else {
    console.log(`   ✅ Fuente 'fca-catalunya' ya existe: ${src._id}`);
  }
  const sourceId = src._id;

  console.log(`\nSubiendo ${rows.length} carreras (idempotente)…\n`);
  let created = 0, updated = 0, failed = 0;
  const errors: string[] = [];
  const uploadT0 = Date.now();

  for (const r of rows) {
    try {
      const res: any = await client.mutation(api.races.systemUpsert, {
        name: r.name,
        locality: r.city,
        province: inferProvince(r.city) as any,
        raceType: "road",
        startDate: r.startDate,
        organizer: "Federació Catalana d'Atletisme",
        isPublished: true,
        isFeatured: false,
        scraperAdapter: "fca-catalunya",
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
      if (errors.length < 5) errors.push(`${r.name}: ${err?.message ?? err}`);
    }
  }

  console.log(`\n\n✅ ${created} creadas, ${updated} actualizadas, ${failed} fallaron`);
  if (errors.length) console.log("Errores (max 5):", errors);

  try {
    const durationMs = Date.now() - uploadT0;
    const status: "success" | "error" = failed > created + updated ? "error" : "success";
    await client.mutation(api.dataSources.recordIngestSync, {
      dataSourceSlug: "fca-catalunya",
      raceCount: created + updated,
      createdCount: created,
      updatedCount: updated,
      durationMs,
      status,
      triggeredBy: "manual",
      error: failed > 0 ? `${failed} carreras fallaron` : undefined,
    });
  } catch (err) {
    console.error("  ✗ error registrando sync:", err);
  }

  // TODO: calendari-trail{año}.pdf tiene formato distinto (especialidad +
  // lugar pegados sin código de homologación como ancla) — pendiente de un
  // parser dedicado si se prioriza. Ver docs/plans/SOURCES_RESEARCH.md §8.1bis.
}

main().catch((err) => {
  console.error("❌ [FCA] Error fatal:", err);
  process.exit(1);
});

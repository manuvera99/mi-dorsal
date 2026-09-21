// =============================================================================
// scripts/ingest-faib-baleares.ts
// =============================================================================
// Ingesta del calendario de la Federació d'Atletisme de les Illes Balears
// (FAIB) desde su listado HTML público, sin autenticación.
// Ver docs/plans/SOURCES_RESEARCH.md §8.1quater.
//
//   GET https://www.faib.es/competicions/?temporada={año}&mes=tots&illa=&modalitat=&tipus=
//   → HTML server-rendered, cada carrera es un bloque
//     <div class="event-container only-popular|content-popular"
//          event-date="dd/mm/yyyy" ...>
//       ...<div class="event_prova" data-evento-id="...">
//         <a href="https://www.faib.es/competicions/{id}">{nombre}</a>
//       </div>...
//       <div class="illa_prova">{isla}</div>
//       <div class="modalitat_prova">{Ruta|Trail|Pista|...}</div>
//     </div>
//
// Solo se ingestan bloques con clase "only-popular" o "content-popular"
// (carreras populares reales) — se descartan "has-end-date" (suelen ser
// ligas/circuitos de varias jornadas sin fecha única) y cualquier bloque
// sin esas clases. También se filtra por modalitat "Ruta" o "Trail"
// (se descartan Pista, Cross, Marcha — fuera del scope de carreras a pie
// en calle/montaña que interesa a mi-dorsal).
//
// Uso:
//   npx tsx --env-file=.env.local scripts/ingest-faib-baleares.ts            # dry-run
//   npx tsx --env-file=.env.local scripts/ingest-faib-baleares.ts --upload   # sube a Convex
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const UPLOAD = process.argv.includes("--upload");
const seasonArg = process.argv.find((a) => a.startsWith("--season="));
const SEASON = seasonArg ? seasonArg.split("=")[1] : String(new Date().getFullYear());

const LIST_URL = `https://www.faib.es/competicions/?temporada=${SEASON}&mes=tots&illa=&modalitat=&tipus=`;

interface FaibRow {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  illa: string;
  modalitat: string;
}

const ILLA_TO_PROVINCE: Record<string, string> = {
  mallorca: "mallorca",
  menorca: "menorca",
  eivissa: "ibiza",
  ibiza: "ibiza",
  formentera: "ibiza", // el schema de mi-dorsal no tiene provincia "formentera" propia; Ibiza es la más cercana administrativamente (mismo partido judicial/provincia)
};

function ddmmyyyyToIso(s: string): string | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function inferRaceType(modalitat: string): "road" | "trail" | null {
  const m = modalitat.toLowerCase();
  if (m === "trail") return "trail";
  if (m === "ruta") return "road";
  return null; // Pista, Cross, Marcha, etc. — se descartan en el filtro previo
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchHtml(url: string): Promise<string> {
  console.log(`[FAIB] Descargando ${url}...`);
  const res = await fetch(url, { headers: { "User-Agent": "mi-dorsal/0.1 (corredor-popular)" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${url}`);
  return await res.text();
}

function parseHtml(html: string): FaibRow[] {
  const blocks = html.split('<div class="event-container').slice(1);
  const rows: FaibRow[] = [];

  for (const raw of blocks) {
    const block = '<div class="event-container' + raw;
    const isPopular = /event-container (only-popular|content-popular)/.test(block);
    if (!isPopular) continue;

    const dateMatch = block.match(/event-date="([^"]*)"/);
    const nameMatch = block.match(/<a href="https:\/\/www\.faib\.es\/competicions\/\d+">([^<]*)<\/a>/);
    const illaMatch = block.match(/<div class="illa_prova">([^<]*)<\/div>/);
    const modalitatMatch = block.match(/<div class="modalitat_prova">([^<]*)<\/div>/);
    const idMatch = block.match(/data-evento-id="(\d+)"/);

    if (!dateMatch || !nameMatch || !idMatch) continue;
    const startDate = ddmmyyyyToIso(dateMatch[1]);
    if (!startDate) continue;

    rows.push({
      id: idMatch[1],
      name: nameMatch[1].trim(),
      startDate,
      illa: (illaMatch?.[1] ?? "").trim(),
      modalitat: (modalitatMatch?.[1] ?? "").trim(),
    });
  }
  return rows;
}

async function main() {
  console.log("=".repeat(70));
  console.log("Ingest del calendario de la Federació d'Atletisme de les Illes Balears (FAIB)");
  console.log("=".repeat(70));
  console.log(`Temporada: ${SEASON}`);
  console.log(`Modo: ${UPLOAD ? "UPLOAD A PROD" : "DRY-RUN (añade --upload para subir)"}\n`);

  const html = await fetchHtml(LIST_URL);
  const allRows = parseHtml(html);
  console.log(`[FAIB] Bloques "populares" parseados: ${allRows.length}`);

  const roadOrTrail = allRows.filter((r) => inferRaceType(r.modalitat) !== null);
  console.log(`[FAIB] De tipo Ruta/Trail: ${roadOrTrail.length}`);

  const today = new Date().toISOString().split("T")[0];
  const future = roadOrTrail.filter((r) => r.startDate >= today);
  console.log(`[FAIB] Futuras (>= ${today}): ${future.length}`);

  if (future.length === 0) {
    console.log("\n[FAIB] No hay carreras futuras de tipo Ruta/Trail. Nada que ingestar.");
    return;
  }

  const dedupMap = new Map<string, FaibRow>();
  for (const r of future) {
    const key = `${normalizeName(r.name)}|${r.startDate}`;
    if (!dedupMap.has(key)) dedupMap.set(key, r);
  }
  const rows = Array.from(dedupMap.values()).sort((a, b) => a.startDate.localeCompare(b.startDate));
  console.log(`[FAIB] Tras dedup: ${rows.length}`);

  console.log("\n[FAIB] Todas:");
  for (const r of rows) {
    console.log(`  ${r.startDate}  [${r.modalitat}]  ${r.name}  (${r.illa})`);
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

  console.log("\nAsegurando dataSource 'faib-baleares'…");
  const sources = await client.query(api.dataSources.listPublic, {});
  let src = sources.find((s: any) => s.slug === "faib-baleares");
  if (!src) {
    const id = await client.mutation(api.dataSources.systemCreate, {
      name: "Federació d'Atletisme de les Illes Balears",
      slug: "faib-baleares",
      type: "api",
      description: "Calendario de competiciones — HTML público con filtros GET (faib.es/competicions)",
      baseUrl: "https://www.faib.es",
      config: { scrapedAt: new Date().toISOString() },
    });
    src = { _id: id } as any;
    console.log(`   ✅ Fuente 'faib-baleares' creada: ${id}`);
  } else {
    console.log(`   ✅ Fuente 'faib-baleares' ya existe: ${src._id}`);
  }
  const sourceId = src._id;

  console.log(`\nSubiendo ${rows.length} carreras (idempotente)…\n`);
  let created = 0, updated = 0, failed = 0;
  const errors: string[] = [];
  const uploadT0 = Date.now();

  for (const r of rows) {
    const province = ILLA_TO_PROVINCE[r.illa.toLowerCase()];
    try {
      const res: any = await client.mutation(api.races.systemUpsert, {
        name: r.name,
        locality: r.illa || undefined,
        province: (province as any) ?? undefined,
        raceType: inferRaceType(r.modalitat) as any,
        startDate: r.startDate,
        organizer: "Federació d'Atletisme de les Illes Balears",
        officialUrl: `https://www.faib.es/competicions/${r.id}`,
        sourceUrl: `https://www.faib.es/competicions/${r.id}`,
        isPublished: true,
        isFeatured: false,
        scraperAdapter: "faib-baleares",
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
      dataSourceSlug: "faib-baleares",
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
}

main().catch((err) => {
  console.error("❌ [FAIB] Error fatal:", err);
  process.exit(1);
});

// =============================================================================
// scripts/ingest-fra-larioja.ts
// =============================================================================
// Ingesta del calendario de la Federación Riojana de Atletismo (FRA) desde
// su listado HTML público, sin autenticación. Ver
// docs/plans/SOURCES_RESEARCH.md §8.1quinquies.
//
//   GET https://www.fratletismo.com/competiciones
//   → HTML server-rendered con TODO el histórico desde temporada 2011/2012,
//   cada competición es un bloque:
//     <div class="competicion clearfix ... {temporada}">
//       <h3>{nombre}</h3>
//       <p class="provincia">{lugar}</p>
//       <p class="cuando">{dd} <abbr>{MES}</abbr> <span>{yyyy}</span></p>
//     </div>
//
// LIMITACIÓN CONOCIDA (volumen esperado bajo): la inmensa mayoría del
// calendario son campeonatos federados internos (pista, jornadas
// escolares JJDD, control de federación). Solo un puñado son carreras
// populares/trail reales (ej. "Ogro Trail", "Najera Xtrem", "Foncea
// Trail", "San Silvestre de Logroño"). Se filtra por heurística de nombre
// — cualquier título con "trail", "xtrem", "silvestre", "popular",
// "carrera", "km vertical" y SIN palabras de campeonato/jornada federada.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/ingest-fra-larioja.ts            # dry-run
//   npx tsx --env-file=.env.local scripts/ingest-fra-larioja.ts --upload   # sube a Convex
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const UPLOAD = process.argv.includes("--upload");
const LIST_URL = "https://www.fratletismo.com/competiciones";

const MESES: Record<string, number> = {
  ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6,
  JUL: 7, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12,
};

interface FraRow {
  name: string;
  locality: string;
  startDate: string; // YYYY-MM-DD
}

function looksLikePopularRace(title: string): boolean {
  const t = title.toLowerCase();
  const hasRaceWord = /\b(trail|xtrem|silvestre|popular|km vertical|10k|carrera)\b/i.test(t);
  const isFederatedInternal =
    /\b(cto\.|cto de|campeonato|jornada|jjdd|control|clasificatorio|clubes|final|programa|combinadas)\b/i.test(t);
  return hasRaceWord && !isFederatedInternal;
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseHtml(html: string): FraRow[] {
  const blocks = html.split('<div class="competicion clearfix').slice(1);
  const rows: FraRow[] = [];

  for (const raw of blocks) {
    const h3 = raw.match(/<h3>([^<]*)<\/h3>/);
    const provincia = raw.match(/<p class="provincia">([^<]*)<\/p>/);
    const cuando = raw.match(
      /<p class="cuando">\s*(\d{1,2})\s*<abbr[^>]*>([^<]*)<\/abbr>\s*<span[^>]*>(\d{4})<\/span>/,
    );
    if (!h3 || !cuando) continue;

    const [, dd, mesStr, yyyy] = cuando;
    const mes = MESES[mesStr.toUpperCase().trim()];
    if (!mes) continue;

    const startDate = `${yyyy}-${String(mes).padStart(2, "0")}-${dd.padStart(2, "0")}`;
    rows.push({
      name: h3[1].trim(),
      locality: (provincia?.[1] ?? "").trim(),
      startDate,
    });
  }
  return rows;
}

async function fetchHtml(url: string): Promise<string> {
  console.log(`[FRA] Descargando ${url}...`);
  const res = await fetch(url, { headers: { "User-Agent": "mi-dorsal/0.1 (corredor-popular)" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${url}`);
  return await res.text();
}

async function main() {
  console.log("=".repeat(70));
  console.log("Ingest del calendario de la Federación Riojana de Atletismo (FRA)");
  console.log("=".repeat(70));
  console.log(`Modo: ${UPLOAD ? "UPLOAD A PROD" : "DRY-RUN (añade --upload para subir)"}\n`);

  const html = await fetchHtml(LIST_URL);
  const allRows = parseHtml(html);
  console.log(`[FRA] Bloques totales parseados (todo el histórico): ${allRows.length}`);

  const popular = allRows.filter((r) => looksLikePopularRace(r.name));
  console.log(`[FRA] Con pinta de carrera popular/trail: ${popular.length}`);

  const today = new Date().toISOString().split("T")[0];
  const future = popular.filter((r) => r.startDate >= today);
  console.log(`[FRA] Futuras (>= ${today}): ${future.length}`);

  if (future.length === 0) {
    console.log("\n[FRA] No hay carreras futuras. Nada que ingestar.");
    return;
  }

  const dedupMap = new Map<string, FraRow>();
  for (const r of future) {
    const key = `${normalizeName(r.name)}|${r.startDate}`;
    if (!dedupMap.has(key)) dedupMap.set(key, r);
  }
  const rows = Array.from(dedupMap.values()).sort((a, b) => a.startDate.localeCompare(b.startDate));
  console.log(`[FRA] Tras dedup: ${rows.length}`);

  console.log("\n[FRA] Todas:");
  for (const r of rows) {
    console.log(`  ${r.startDate}  ${r.name}  (${r.locality})`);
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

  console.log("\nAsegurando dataSource 'fra-larioja'…");
  const sources = await client.query(api.dataSources.listPublic, {});
  let src = sources.find((s: any) => s.slug === "fra-larioja");
  if (!src) {
    const id = await client.mutation(api.dataSources.systemCreate, {
      name: "Federación Riojana de Atletismo",
      slug: "fra-larioja",
      type: "scraper",
      description: "Calendario histórico — HTML público server-rendered (fratletismo.com/competiciones)",
      baseUrl: "https://www.fratletismo.com",
      config: { scrapedAt: new Date().toISOString() },
    });
    src = { _id: id } as any;
    console.log(`   ✅ Fuente 'fra-larioja' creada: ${id}`);
  } else {
    console.log(`   ✅ Fuente 'fra-larioja' ya existe: ${src._id}`);
  }
  const sourceId = src._id;

  console.log(`\nSubiendo ${rows.length} carreras (idempotente)…\n`);
  let created = 0, updated = 0, failed = 0;
  const errors: string[] = [];
  const uploadT0 = Date.now();

  for (const r of rows) {
    const raceType = /trail|xtrem|vertical/i.test(r.name) ? "trail" : "road";
    try {
      const res: any = await client.mutation(api.races.systemUpsert, {
        name: r.name,
        locality: r.locality || undefined,
        province: "la rioja" as any,
        raceType,
        startDate: r.startDate,
        organizer: "Federación Riojana de Atletismo",
        isPublished: true,
        isFeatured: false,
        scraperAdapter: "fra-larioja",
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
      dataSourceSlug: "fra-larioja",
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
  console.error("❌ [FRA] Error fatal:", err);
  process.exit(1);
});

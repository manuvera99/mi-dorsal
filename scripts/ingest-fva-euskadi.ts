// =============================================================================
// scripts/ingest-fva-euskadi.ts
// =============================================================================
// Ingesta del calendario de la Euskadiko Atletismo Federazioa / Federación
// Vasca de Atletismo (FVA) desde su endpoint AJAX público, sin autenticación.
// Ver docs/plans/SOURCES_RESEARCH.md §8.1ter.
//
//   GET https://fvaeaf.org/wp-admin/admin-ajax.php?action=WP_FullCalendar&start={ISO}&end={ISO}
//   Respuesta: JSON [{title, color, start, end, url, post_id, nonce}, ...]
//   — plugin estándar de WordPress "WP Full Calendar". El patrón
//   admin-ajax.php?action=WP_FullCalendar es genérico del plugin, no
//   específico de este sitio.
//
// LIMITACIÓN CONOCIDA: el calendario mezcla campeonatos federados internos
// (pista, clubes, lanzamientos) con carreras populares reales — no hay un
// campo de "tipo" en la respuesta JSON, solo el título. Se filtra por
// heurística de nombre (igual que inferRaceType() en otros ingests: busca
// palabras clave de carrera popular/distancia/maratón). Volumen esperado
// bajo: en la investigación previa, de 43 eventos totales del año solo 4
// tenían pinta de carrera popular real.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/ingest-fva-euskadi.ts            # dry-run
//   npx tsx --env-file=.env.local scripts/ingest-fva-euskadi.ts --upload   # sube a Convex
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const UPLOAD = process.argv.includes("--upload");
const yearArg = process.argv.find((a) => a.startsWith("--year="));
const YEAR = yearArg ? yearArg.split("=")[1] : String(new Date().getFullYear());

const AJAX_URL = `https://fvaeaf.org/wp-admin/admin-ajax.php?action=WP_FullCalendar&start=${YEAR}-01-01&end=${YEAR}-12-31`;

interface FvaEvent {
  title: string;
  start: string; // ISO datetime
  url: string;
  post_id: number;
}

interface FvaRow {
  name: string;
  startDate: string; // YYYY-MM-DD
  url: string;
}

/** Heurística: ¿este título de evento parece una carrera popular a pie
 * (no un campeonato de pista/lanzamientos/clubes)? Basado en los 4 ejemplos
 * reales conocidos ("MEDIA MARATON DEL BIDASOA Y 10K",
 * "BASAURIKO HERRI LASTERKETA... Maratoi Erdia eta 10km eta 5km") y
 * exclusión explícita de palabras de campeonato federado interno. */
function looksLikePopularRace(title: string): boolean {
  const t = title.toLowerCase();
  const hasDistanceOrRaceWord =
    /\b(maraton|marató|maratoi|media maraton|10k|10km|5k|5km|21k|42k|herri lasterketa|popular|carrera|lasterketa)\b/i.test(
      t,
    );
  const isFederatedChampionship =
    /\b(campeonato de euskadi|copa de|jornada|lanzamiento|pértiga|control|cto\.|clubes)\b/i.test(t);
  return hasDistanceOrRaceWord && !isFederatedChampionship;
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  console.log("=".repeat(70));
  console.log("Ingest del calendario de la Federación Vasca de Atletismo (FVA/EAF)");
  console.log("=".repeat(70));
  console.log(`Año: ${YEAR}`);
  console.log(`Modo: ${UPLOAD ? "UPLOAD A PROD" : "DRY-RUN (añade --upload para subir)"}\n`);

  console.log(`[FVA] Descargando ${AJAX_URL}...`);
  const res = await fetch(AJAX_URL, {
    headers: { "User-Agent": "mi-dorsal/0.1 (corredor-popular)", "X-Requested-With": "XMLHttpRequest" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar el calendario FVA`);
  const events: FvaEvent[] = await res.json();
  console.log(`[FVA] Eventos totales: ${events.length}`);

  const popular = events.filter((e) => looksLikePopularRace(e.title));
  console.log(`[FVA] Con pinta de carrera popular: ${popular.length}`);

  const rows: FvaRow[] = popular.map((e) => ({
    name: e.title.trim(),
    startDate: e.start.split("T")[0],
    url: e.url,
  }));

  const today = new Date().toISOString().split("T")[0];
  const future = rows.filter((r) => r.startDate >= today);
  console.log(`[FVA] Futuras (>= ${today}): ${future.length}`);

  if (future.length === 0) {
    console.log("\n[FVA] No hay carreras futuras. Nada que ingestar.");
    return;
  }

  const dedupMap = new Map<string, FvaRow>();
  for (const r of future) {
    const key = `${normalizeName(r.name)}|${r.startDate}`;
    if (!dedupMap.has(key)) dedupMap.set(key, r);
  }
  const finalRows = Array.from(dedupMap.values()).sort((a, b) => a.startDate.localeCompare(b.startDate));
  console.log(`[FVA] Tras dedup: ${finalRows.length}`);

  console.log("\n[FVA] Todas:");
  for (const r of finalRows) {
    console.log(`  ${r.startDate}  ${r.name}`);
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

  console.log("\nAsegurando dataSource 'fva-euskadi'…");
  const sources = await client.query(api.dataSources.listPublic, {});
  let src = sources.find((s: any) => s.slug === "fva-euskadi");
  if (!src) {
    const id = await client.mutation(api.dataSources.systemCreate, {
      name: "Federación Vasca de Atletismo / Euskadiko Atletismo Federazioa",
      slug: "fva-euskadi",
      type: "api",
      description: "Calendario — endpoint AJAX público del plugin WP Full Calendar (fvaeaf.org)",
      baseUrl: "https://fvaeaf.org",
      config: { scrapedAt: new Date().toISOString() },
    });
    src = { _id: id } as any;
    console.log(`   ✅ Fuente 'fva-euskadi' creada: ${id}`);
  } else {
    console.log(`   ✅ Fuente 'fva-euskadi' ya existe: ${src._id}`);
  }
  const sourceId = src._id;

  console.log(`\nSubiendo ${finalRows.length} carreras (idempotente)…\n`);
  let created = 0, updated = 0, failed = 0;
  const errors: string[] = [];
  const uploadT0 = Date.now();

  for (const r of finalRows) {
    try {
      const res2: any = await client.mutation(api.races.systemUpsert, {
        name: r.name,
        province: "gipuzkoa" as any, // fallback razonable: la mayoría de carreras conocidas de esta fuente son en Gipuzkoa (Bidasoa/San Sebastián); el admin puede corregir localidad/provincia caso a caso
        raceType: "road",
        startDate: r.startDate,
        organizer: "Federación Vasca de Atletismo",
        officialUrl: r.url,
        sourceUrl: r.url,
        isPublished: true,
        isFeatured: false,
        scraperAdapter: "fva-euskadi",
        dataSourceId: sourceId,
      });
      if (res2?.action === "created") {
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
      dataSourceSlug: "fva-euskadi",
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
  console.error("❌ [FVA] Error fatal:", err);
  process.exit(1);
});

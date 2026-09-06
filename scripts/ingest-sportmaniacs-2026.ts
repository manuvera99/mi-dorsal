// =============================================================================
// scripts/ingest-sportmaniacs-2026.ts
// =============================================================================
// Ingesta del catálogo de carreras de Sportmaniacs (sportmaniacs.com) desde su
// API pública:
//
//   GET https://api-aws.sportmaniacs.com/api/races?page=N&pageSize=25
//   resp: { data: [{id (UUID), name, slug, date, idRace, ...}], status: "ok" }
//
// Páginas hasta que `data.length == 0`. Filtra por año en curso en adelante.
//
// Luego sube cada carrera a Convex vía `api.races.systemUpsert`, que:
//   - Dedupa por officialUrl
//   - Auto-asigna scraperAdapter: "sportmaniacs" si la URL es de sportmaniacs.com
//   - Si ya existe en correbirras, añade sportmaniacs a additionalDataSourceIds
//     sin tocar dataSourceId (multi-source)
//
// Uso:
//   npx tsx --env-file=.env.local scripts/ingest-sportmaniacs-2026.ts            # dry-run
//   npx tsx --env-file=.env.local scripts/ingest-sportmaniacs-2026.ts --upload   # sube a Convex
//   npx tsx --env-file=.env.local scripts/ingest-sportmaniacs-2026.ts --limit=20 # máx 20 páginas
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const API_BASE = "https://api-aws.sportmaniacs.com/api/races";
const WEB_BASE = "https://sportmaniacs.com";
const UPLOAD = process.argv.includes("--upload");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const MAX_PAGES = limitArg ? parseInt(limitArg.split("=")[1], 10) : 200;
const PAGE_DELAY_MS = 200; // cortesía con sportmaniacs

interface SportmaniacsRace {
  id: string;          // UUID del evento
  name: string;
  slug: string;
  date: string;        // YYYY-MM-DD
  idRace: string;
  idRaceType: string;
  province?: string | null;
  country?: string | null;
  city?: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(page: number): Promise<SportmaniacsRace[]> {
  const url = `${API_BASE}?page=${page}&pageSize=25`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 mi-dorsal/0.1",
      "X-Requested-With": "XMLHttpRequest",
      Origin: "https://sportmaniacs.com",
      Referer: "https://sportmaniacs.com/",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching page ${page}`);
  }
  const data: any = await res.json();
  if (data.status !== "ok" || !Array.isArray(data.data)) return [];
  return data.data as SportmaniacsRace[];
}

async function main() {
  console.log("=".repeat(70));
  console.log("Ingest de carreras de Sportmaniacs (2026+)");
  console.log("=".repeat(70));
  console.log(`API: ${API_BASE}`);
  console.log(`Max páginas: ${MAX_PAGES} (${MAX_PAGES * 25} carreras máx)`);
  console.log(`Modo: ${UPLOAD ? "UPLOAD A PROD" : "DRY-RUN (añade --upload para subir)"}\n`);

  // 1. Descargar todas las páginas
  const allRaces: SportmaniacsRace[] = [];
  let page = 1;
  let emptyStreak = 0;

  while (page <= MAX_PAGES) {
    process.stdout.write(`\rDescargando página ${page}…`);
    try {
      const races = await fetchPage(page);
      if (races.length === 0) {
        emptyStreak++;
        if (emptyStreak >= 2) {
          console.log(`\n   2 páginas vacías seguidas → fin.`);
          break;
        }
      } else {
        emptyStreak = 0;
        allRaces.push(...races);
      }
      page++;
      await sleep(PAGE_DELAY_MS);
    } catch (err: any) {
      console.error(`\n   Error en página ${page}: ${err?.message ?? err}`);
      break;
    }
  }

  console.log(`\n\nTotal carreras descargadas: ${allRaces.length}\n`);

  if (allRaces.length === 0) {
    console.log("No se descargaron carreras. Abortando.");
    process.exit(0);
  }

  // 2. Filtrar por año: solo carreras del año en curso en adelante
  const MIN_YEAR = new Date().getFullYear();
  const minDate = `${MIN_YEAR}-01-01`;
  const beforeCount = allRaces.length;
  for (let i = allRaces.length - 1; i >= 0; i--) {
    if (allRaces[i].date < minDate) allRaces.splice(i, 1);
  }
  if (allRaces.length < beforeCount) {
    console.log(
      `\nFiltro aplicado: solo carreras de ${MIN_YEAR} en adelante. ` +
        `Eliminadas ${beforeCount - allRaces.length} de años anteriores.`,
    );
  }

  // 3. Stats
  const byProv: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  let futureCount = 0;
  const today = new Date().toISOString().split("T")[0];
  for (const r of allRaces) {
    const p = (r.province ?? "?").toLowerCase();
    byProv[p] = (byProv[p] ?? 0) + 1;
    const month = r.date.substring(0, 7);
    byMonth[month] = (byMonth[month] ?? 0) + 1;
    if (r.date >= today) futureCount++;
  }
  console.log(`Futuras: ${futureCount}  |  Pasadas: ${allRaces.length - futureCount}`);
  console.log("\nPor provincia (top 10):");
  for (const [p, n] of Object.entries(byProv).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${p}: ${n}`);
  }
  console.log("\nPor mes:");
  for (const [m, n] of Object.entries(byMonth).sort()) {
    console.log(`  ${m}: ${n}`);
  }
  console.log();

  // 4. Muestra
  console.log("Primeras 5 futuras:");
  const futures = allRaces.filter((r) => r.date >= today).slice(0, 5);
  for (const r of futures) {
    console.log(
      `  ${r.date}  ${r.name.slice(0, 50).padEnd(52)}  ${(r.city ?? "?").slice(0, 25).padEnd(25)} (${r.province ?? "?"})`,
    );
    console.log(`    → ${WEB_BASE}/es/races/${r.slug}/${r.id}/results`);
  }
  console.log();

  if (!UPLOAD) {
    console.log("Para subir a Convex: añade --upload");
    return;
  }

  // 5. Subir a Convex
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error("❌ NEXT_PUBLIC_CONVEX_URL no configurado");
    process.exit(1);
  }
  const client = new ConvexHttpClient(convexUrl);

  console.log("Asegurando dataSource 'sportmaniacs'…");
  const sources: any[] = await client.query(api.dataSources.listPublic, {});
  let src = sources.find((s: any) => s.slug === "sportmaniacs");
  if (!src) {
    const id = await client.mutation(api.dataSources.systemCreate, {
      name: "Sportmaniacs",
      slug: "sportmaniacs",
      type: "api",
      description:
        "Plataforma líder de inscripciones y cronometraje del running popular español. Cubre cientos de carreras (Zurich Marató Barcelona, Maratón Sevilla, Mitja Marató Barcelona, etc.). Catálogo vía https://api-aws.sportmaniacs.com/api/races; resultados por dorsal vía /api/events/{uuid}/race-rankings (disponibles durante la carrera en vivo y poco después).",
      baseUrl: "https://sportmaniacs.com",
      config: { scrapedAt: new Date().toISOString() },
    });
    src = { _id: id };
    console.log(`   ✅ Fuente 'sportmaniacs' creada: ${id}`);
  } else {
    console.log(`   ✅ Fuente 'sportmaniacs' ya existe: ${src._id}`);
  }
  const sourceId = src._id;

  console.log(`\nSubiendo ${allRaces.length} carreras (idempotente)…\n`);
  let created = 0,
    updated = 0,
    failed = 0;
  const errors: string[] = [];

  for (const r of allRaces) {
    try {
      const res: any = await client.mutation(api.races.systemUpsert, {
        name: r.name,
        locality: r.city ?? undefined,
        startDate: r.date,
        organizer: "Sportmaniacs",
        officialUrl: `${WEB_BASE}/es/races/${r.slug}/${r.id}/results`,
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
      if (errors.length < 3) errors.push(`${r.name}: ${err?.message ?? err}`);
    }
  }

  console.log(`\n\n✅ ${created} creadas, ${updated} actualizadas, ${failed} fallaron`);
  if (errors.length) console.log("Errores (max 3):", errors);
}

main().catch((err) => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});

// =============================================================================
// scripts/ingest-cruzandolameta.ts
// =============================================================================
// Ingesta del catálogo de Cruzando la Meta (rankings.cruzandolameta.es) desde
// su API REST pública (SPA React/Vite sin SSR, sin auth, descubierta
// inspeccionando el bundle JS de la web — no hay documentación pública):
//
//   GET https://rankings.cruzandolameta.es/api/pruebas
//   Respuesta: { pruebas: [{ id, nombre, fecha, lugar, provincia, estado,
//                             distancias: [{ slug, nombre, estado }, ...] }] }
//
//   GET https://rankings.cruzandolameta.es/api/e/{slug}
//   Respuesta: { evento: { checkpoints, distancia_m, disciplinas, ... },
//                prueba: {...}, resultados: [...] }
//
// Cada "distancia" dentro de una prueba es en realidad una CATEGORÍA/MODALIDAD
// (absoluta, sub-10, sub-12, alevín, benjamín, etc.), cada una con su propio
// slug y su propia tabla de resultados independiente — mismo patrón que un
// event-card de sportmaniacs. Aquí cada distancia se sube como una carrera
// independiente en mi-dorsal.
//
// Filtros aplicados:
//   - Solo pruebas futuras (prueba.fecha >= hoy). La API no expone fecha por
//     distancia, solo por prueba — todas las distancias de una misma prueba
//     comparten la misma fecha.
//   - Solo disciplina "carrera" (a pie) — se excluyen las travesías a nado
//     ("natacion"): el schema de mi-dorsal (raceType road/trail/mixed/obstacle)
//     no tiene categoría de natación y la app es de running.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/ingest-cruzandolameta.ts            # dry-run
//   npx tsx --env-file=.env.local scripts/ingest-cruzandolameta.ts --upload   # sube a Convex
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const BASE_URL = "https://rankings.cruzandolameta.es";
const PRUEBAS_ENDPOINT = `${BASE_URL}/api/pruebas`;
const USER_AGENT = "Mozilla/5.0 mi-dorsal/0.1";
const UPLOAD = process.argv.includes("--upload");
const DETAIL_DELAY_MS = 150; // cortesía con CLM al pedir el detalle de cada distancia

// =============================================================================
// Tipos
// =============================================================================

interface ClmDistancia {
  slug: string;
  nombre: string;
  estado: string;
}

interface ClmPrueba {
  id: number;
  nombre: string;
  fecha: string; // YYYY-MM-DD
  lugar: string;
  provincia: string | null;
  estado: string;
  distancias: ClmDistancia[];
}

interface ClmEventoDetalle {
  evento: {
    slug: string;
    nombre: string;
    estado: string;
    distancia_m?: number;
    disciplinas?: Record<string, string>;
  };
}

interface IngestRow {
  name: string;
  locality: string;
  province: string;
  distanceKm: number;
  raceType: "road" | "trail";
  startDate: string;
  officialUrl: string;
  sourceUrl: string;
  resultsUrl: string;
}

// =============================================================================
// Mapeo de localidad → provincia (todo el catálogo visto es Almería/Granada;
// `provincia` viene siempre null desde la API, así que inferimos por `lugar`).
// =============================================================================

const LOCALITY_TO_PROVINCE: Record<string, string> = {
  "roquetas de mar": "almeria",
  "los guajares": "granada",
  "macael": "almeria",
  "tijola": "almeria",
  "el ejido": "almeria",
  "nivar": "granada",
  "alfacar": "granada",
  "motril": "granada",
  "velez de benahudalla": "granada",
  "alamedilla": "granada",
  "sorbas": "almeria",
  "garrucha": "almeria",
  "vicar": "almeria",
  "castell de ferro": "granada",
  "villaricos": "almeria",
  "almeria": "almeria",
};

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Fallback: "almeria" — es la región dominante del catálogo actual. */
function inferProvince(lugar: string): string {
  const key = normalizeKey(lugar);
  return LOCALITY_TO_PROVINCE[key] ?? "almeria";
}

/** Heurístico simple por nombre, igual que mapRaceType() en ingest-sportmaniacs.ts. */
function inferRaceType(name: string): "road" | "trail" {
  return /\btrail\b|\bmont(aña|ana)\b|\bxtreme\b|\bcross\b/i.test(name) ? "trail" : "road";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// =============================================================================
// Fetch
// =============================================================================

async function fetchPruebas(): Promise<ClmPrueba[]> {
  const res = await fetch(PRUEBAS_ENDPOINT, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${PRUEBAS_ENDPOINT}`);
  const data = await res.json();
  return Array.isArray(data?.pruebas) ? data.pruebas : [];
}

async function fetchEventoDetalle(slug: string): Promise<ClmEventoDetalle | null> {
  const url = `${BASE_URL}/api/e/${slug}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("=".repeat(70));
  console.log("Ingest de carreras de Cruzando la Meta (rankings.cruzandolameta.es)");
  console.log("=".repeat(70));
  console.log(`Endpoint: ${PRUEBAS_ENDPOINT}`);
  console.log(`Modo: ${UPLOAD ? "UPLOAD A PROD" : "DRY-RUN (añade --upload para subir)"}\n`);

  const allPruebas = await fetchPruebas();
  console.log(`Total pruebas descargadas: ${allPruebas.length}`);

  // 1. Filtro de fecha: solo pruebas futuras (>= hoy). La API no da fecha
  // por distancia, solo por prueba.
  const today = new Date().toISOString().split("T")[0];
  const futurePruebas = allPruebas.filter((p) => p.fecha >= today);
  console.log(
    `Futuras (fecha >= ${today}): ${futurePruebas.length} de ${allPruebas.length}`,
  );

  if (futurePruebas.length === 0) {
    console.log(
      "\nNo hay pruebas futuras en el catálogo de Cruzando la Meta ahora mismo. Nada que ingestar.",
    );
    return;
  }

  // 2. Para cada prueba futura, mirar el detalle de cada distancia y
  // descartar natación.
  const rows: IngestRow[] = [];
  let excludedSwim = 0;
  let excludedNoDetail = 0;
  const multiDistancia = new Set<number>();
  for (const prueba of futurePruebas) {
    if (prueba.distancias.length > 1) multiDistancia.add(prueba.id);
    for (const distancia of prueba.distancias) {
      process.stdout.write(`\rConsultando detalle: ${distancia.slug.slice(0, 60).padEnd(60)}`);
      const detalle = await fetchEventoDetalle(distancia.slug);
      await sleep(DETAIL_DELAY_MS);

      if (!detalle?.evento) {
        excludedNoDetail++;
        continue;
      }

      const disciplinas = Object.values(detalle.evento.disciplinas ?? {});
      const isSwim = disciplinas.some((d) => d === "natacion");
      if (isSwim) {
        excludedSwim++;
        continue;
      }

      const distanciaM = detalle.evento.distancia_m;
      if (!distanciaM || distanciaM <= 0) {
        excludedNoDetail++;
        continue;
      }

      const name =
        prueba.distancias.length > 1
          ? `${prueba.nombre} - ${distancia.nombre}`
          : prueba.nombre;

      rows.push({
        name,
        locality: prueba.lugar,
        province: inferProvince(prueba.lugar),
        distanceKm: Math.round((distanciaM / 1000) * 1000) / 1000,
        raceType: inferRaceType(name),
        startDate: prueba.fecha,
        officialUrl: `${BASE_URL}/${distancia.slug}`,
        sourceUrl: `${BASE_URL}/${distancia.slug}`,
        resultsUrl: `${BASE_URL}/api/e/${distancia.slug}`,
      });
    }
  }
  console.log(`\n`);

  console.log(`Distancias válidas (carrera a pie): ${rows.length}`);
  console.log(`Excluidas por ser natación: ${excludedSwim}`);
  console.log(`Excluidas por falta de detalle/distancia: ${excludedNoDetail}`);
  console.log(`Pruebas con varias categorías: ${multiDistancia.size}`);

  if (rows.length === 0) {
    console.log("\nNada que subir tras aplicar filtros.");
    return;
  }

  // 3. Stats
  const byProv: Record<string, number> = {};
  const byType: Record<string, number> = { road: 0, trail: 0 };
  for (const r of rows) {
    byProv[r.province] = (byProv[r.province] ?? 0) + 1;
    byType[r.raceType]++;
  }
  console.log("\nPor provincia:");
  for (const [p, n] of Object.entries(byProv).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${p}: ${n}`);
  }
  console.log(`\nPor tipo: road=${byType.road}, trail=${byType.trail}`);

  console.log("\nPrimeras 5:");
  for (const r of rows.slice(0, 5)) {
    console.log(`  ${r.startDate}  ${r.name.slice(0, 60).padEnd(62)}  ${r.distanceKm}km  ${r.locality} (${r.province})`);
    console.log(`    → ${r.officialUrl}`);
  }

  if (!UPLOAD) {
    console.log("\nPara subir a Convex: añade --upload");
    return;
  }

  // 4. Subir a Convex
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error("❌ NEXT_PUBLIC_CONVEX_URL no configurado");
    process.exit(1);
  }
  const client = new ConvexHttpClient(convexUrl);

  console.log("\nAsegurando dataSource 'cruzandolameta'…");
  const sources = await client.query(api.dataSources.listPublic, {});
  let src = sources.find((s: any) => s.slug === "cruzandolameta");
  if (!src) {
    const id = await client.mutation(api.dataSources.systemCreate, {
      name: "Cruzando la Meta",
      slug: "cruzandolameta",
      type: "api",
      description:
        "Cronometrador de Almería/Granada — API REST pública con resultados por dorsal (rankings.cruzandolameta.es)",
      baseUrl: BASE_URL,
      config: { scrapedAt: new Date().toISOString() },
    });
    src = { _id: id } as any;
    console.log(`   ✅ Fuente 'cruzandolameta' creada: ${id}`);
  } else {
    console.log(`   ✅ Fuente 'cruzandolameta' ya existe: ${src._id}`);
  }
  const sourceId = src._id;

  console.log(`\nSubiendo ${rows.length} carreras (idempotente)…\n`);
  let created = 0,
    updated = 0,
    failed = 0;
  const errors: string[] = [];
  const uploadT0 = Date.now();

  for (const r of rows) {
    try {
      const res: any = await client.mutation(api.races.systemUpsert, {
        name: r.name,
        locality: r.locality,
        province: r.province as any,
        distanceKm: r.distanceKm,
        raceType: r.raceType,
        startDate: r.startDate,
        organizer: "Cruzando la Meta",
        officialUrl: r.officialUrl,
        sourceUrl: r.sourceUrl,
        resultsUrl: r.resultsUrl,
        isPublished: true,
        isFeatured: false,
        scraperAdapter: "cruzandolameta",
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

  // Registrar el sync (para que el admin dashboard vea "última sync: hace
  // Xh, +N carreras" y el desglose creadas/actualizadas) — mismo patrón que
  // ingest-sportmaniacs.ts.
  try {
    const durationMs = Date.now() - uploadT0;
    const status: "success" | "error" = failed > created + updated ? "error" : "success";
    await client.mutation(api.dataSources.recordIngestSync, {
      dataSourceSlug: "cruzandolameta",
      raceCount: created + updated,
      createdCount: created,
      updatedCount: updated,
      durationMs,
      status,
      triggeredBy: "github-action-daily-ingest",
      error: failed > 0 ? `${failed} carreras fallaron` : undefined,
    });
  } catch (err) {
    console.error("  ✗ error registrando sync:", err);
  }
}

main().catch((err) => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});

// =============================================================================
// scripts/ingest-to-convex.ts
// =============================================================================
// Lee scripts/output/all-races.json y sube cada carrera a Convex vía la
// mutation api.races.systemUpsert. Al final, registra el sync de cada
// fuente en api.dataSources.recordIngestSync para que el admin dashboard
// vea "última sync: hace Xh, +N carreras".
//
// Uso:
//   1. Configurar .env.local con NEXT_PUBLIC_CONVEX_URL y CONVEX_DEPLOYMENT
//   2. Tener el schema desplegado (`npx convex dev`)
//   3. Ejecutar: npm run ingest:to-convex
//
// Si no hay Convex configurado, el script avisa y termina.
// =============================================================================

import * as fs from "fs";
import * as path from "path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const OUTPUT_DIR = path.join(process.cwd(), "scripts", "output");
const UNIFIED_FILE = path.join(OUTPUT_DIR, "all-races.json");

interface UnifiedRace {
  name: string;
  slug: string;
  date: string;
  dateEnd?: string;
  location: string;
  province?: string;
  type: "road" | "trail" | "mixed" | "obstacle";
  modality?: string;
  level?: string;
  distance?: number;
  elevation?: number;
  endurancePoints?: number;
  nationalLeague?: string;
  homologated?: boolean;
  surface?: "asfalto" | "tierra" | "montaña" | "cross" | "pista";
  source: "RFEA" | "FEDME" | "ITRA" | "Sportmaniacs" | "Runedia";
  sourceUrl: string;
  officialUrl?: string;
}

// Mapeo del campo `source` del JSON al slug de la dataSource en Convex.
// Coincide con la tabla dataSources (ver convex/dataSources.ts).
const SOURCE_NAME_TO_SLUG: Record<UnifiedRace["source"], string> = {
  RFEA: "rfea",
  FEDME: "fedme",
  ITRA: "itra",
  Sportmaniacs: "sportmaniacs",
  Runedia: "runedia",
};

// 2026-09-11: eliminado el fallback silencioso a "valencia" cuando la
// localidad no matchea el mapa (mismo bug ya corregido en
// convex/races.ts systemUpsert el 7 sept — este script client-side lo
// seguía teniendo, enmascarando carreras mal ubicadas). Ahora devuelve
// undefined y el caller salta la carrera en vez de subirla con una
// provincia inventada.
function inferProvince(location: string): string | undefined {
  if (!location) return undefined;
  const loc = location.toLowerCase();
  const map: Record<string, string> = {
    "valencia": "valencia", "castellón": "castellon", "castelló": "castellon", "alicante": "alicante", "albacete": "albacete",
    "murcia": "murcia", "almería": "almeria", "elche": "alicante", "santa pola": "alicante", "tarragona": "tarragona",
    "cantabria": "cantabria", "asturias": "asturias", "málaga": "malaga", "cáceres": "caceres", "ávila": "avila",
    "huesca": "huesca", "jaén": "jaen", "zaragoza": "zaragoza", "teruel": "teruel", "barcelona": "barcelona",
    "girona": "girona", "lleida": "lleida", "madrid": "madrid", "gipuzkoa": "gipuzkoa", "vizcaya": "vizcaya",
    "navarra": "navarra", "granada": "granada", "córdoba": "cordoba", "sevilla": "sevilla", "huelva": "huelva",
    "cádiz": "cadiz", "alava": "alava", "álava": "alava", "la rioja": "la rioja", "burgos": "burgos",
  };
  for (const [key, value] of Object.entries(map)) {
    if (loc.includes(key)) return value;
  }
  return undefined;
}

function inferRaceType(t: string): "road" | "trail" | "mixed" | "obstacle" {
  if (t === "trail" || t === "mixed" || t === "obstacle") return t;
  return "road";
}

async function main() {
  if (!fs.existsSync(UNIFIED_FILE)) {
    console.error(`❌ No se encontró ${UNIFIED_FILE}.`);
    console.error(`   Ejecuta primero: npm run ingest:all`);
    process.exit(1);
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const deployment = process.env.CONVEX_DEPLOYMENT;

  if (!convexUrl || !deployment) {
    console.error(`❌ Convex no está configurado.`);
    console.error(`   Añade a .env.local:`);
    console.error(`     NEXT_PUBLIC_CONVEX_URL=https://tu-proyecto.convex.cloud`);
    console.error(`     CONVEX_DEPLOYMENT=prod:tu-proyecto`);
    console.error(``);
    console.error(`   Alternativa: usa las carreras como mock data con:`);
    console.error(`     npm run ingest:merge-mock`);
    process.exit(1);
  }

  const races: UnifiedRace[] = JSON.parse(fs.readFileSync(UNIFIED_FILE, "utf-8"));
  console.log(`[ingest-to-convex] ${races.length} carreras a subir a Convex...`);

  const client = new ConvexHttpClient(convexUrl);

  // -------------------------------------------------------------------
  // Resolver dataSourceId por slug al inicio (1 query por source).
  // Cache en memoria para no repetir la query por cada carrera.
  // -------------------------------------------------------------------
  const dataSourceIdCache = new Map<string, string | null>();
  const getDataSourceId = async (sourceName: UnifiedRace["source"]): Promise<string | null> => {
    const slug = SOURCE_NAME_TO_SLUG[sourceName];
    if (!slug) return null;
    if (!dataSourceIdCache.has(slug)) {
      const id = await client.query(api.dataSources.getDataSourceIdBySlug, { slug });
      dataSourceIdCache.set(slug, id);
    }
    return dataSourceIdCache.get(slug) ?? null;
  };

  // Conteos por source para reportar al final
  const sourceStats: Record<string, { created: number; updated: number; errors: number }> = {};
  let success = 0;
  let failed = 0;
  const t0 = Date.now();

  let skippedNoProvince = 0;
  for (const r of races) {
    try {
      const province = inferProvince(r.location);
      if (!province) {
        // No forzamos un fallback: sin provincia resoluble, no subimos la
        // carrera (ver comentario en inferProvince). Se queda pendiente
        // de revisión manual desde /admin/races/new.
        skippedNoProvince++;
        process.stdout.write("p");
        continue;
      }
      const dataSourceId = await getDataSourceId(r.source);
      // systemUpsert: idempotente. Si ya existe (mismo officialUrl o
      // mismo nombre+fecha), actualiza los campos vacíos. Si no, crea.
      const res: any = await client.mutation(api.races.systemUpsert, {
        name: r.name,
        locality: r.location,
        province: province as any,
        distanceKm: r.distance ?? (r.type === "trail" ? 21 : 10),
        elevationGainM: r.elevation,
        raceType: inferRaceType(r.type),
        homologated: r.homologated,
        startDate: r.date,
        startTime: "09:00",
        organizer: r.sourceUrl,
        officialUrl: r.officialUrl,
        description: r.modality
          ? `Carrera ${r.modality} de ${r.sourceUrl ? new URL(r.sourceUrl).hostname : "origen oficial"}. ${r.level ? "Nivel: " + r.level + "." : ""}`
          : `Carrera de ${new URL(r.sourceUrl).hostname}.`,
        scraperAdapter: r.sourceUrl ? new URL(r.sourceUrl).hostname.split(".")[0] : undefined,
        // 8 sep 2026: pasamos dataSourceId para que systemUpsert vincule
        // la carrera a su fuente (antes la dataSourceId quedaba vacía).
        dataSourceId: dataSourceId ?? undefined,
      });

      success++;
      const action = res?.action === "updated" ? "u" : ".";
      process.stdout.write(action);

      // Acumular por source
      const stat = sourceStats[r.source] ?? { created: 0, updated: 0, errors: 0 };
      if (res?.action === "updated") stat.updated++;
      else stat.created++;
      sourceStats[r.source] = stat;
    } catch (err) {
      failed++;
      const stat = sourceStats[r.source] ?? { created: 0, updated: 0, errors: 0 };
      stat.errors++;
      sourceStats[r.source] = stat;
      console.error(`\n[ingest-to-convex] ❌ Falló "${r.name}":`, err);
    }
  }

  const totalDurationMs = Date.now() - t0;

  console.log(`\n\n[ingest-to-convex] ✅ ${success} carreras procesadas (created+updated)`);
  if (failed > 0) console.log(`[ingest-to-convex] ⚠️  ${failed} carreras fallaron`);
  if (skippedNoProvince > 0) console.log(`[ingest-to-convex] ⚠️  ${skippedNoProvince} carreras saltadas por provincia no resoluble (revisar a mano)`);
  console.log(`[ingest-to-convex] Duración total: ${(totalDurationMs / 1000).toFixed(1)}s`);
  console.log(`[ingest-to-convex] Verifica en https://dashboard.convex.dev`);
  console.log(`[ingest-to-convex] Re-ejecuta este script y verás solo "u" (updates) si no hay carreras nuevas.`);

  // -------------------------------------------------------------------
  // Registrar el sync por cada fuente (para que el admin dashboard
  // muestre "última sync: hace Xh, +N carreras").
  // -------------------------------------------------------------------
  console.log(`\n[ingest-to-convex] Registrando sync en dataSources...`);
  for (const [sourceName, stat] of Object.entries(sourceStats)) {
    const slug = SOURCE_NAME_TO_SLUG[sourceName as UnifiedRace["source"]];
    if (!slug) continue;
    const totalForSource = stat.created + stat.updated;
    if (totalForSource === 0 && stat.errors === 0) continue;
    try {
      // Estimamos la duración por source como proporcional al total
      // (no medimos por source individual porque el loop es secuencial).
      // Para sources con 0 carreras, prorrateamos 0; para sources con
      // muchas, prorrateamos ~durationMs * (count / total).
      const totalAll = success || 1;
      const sourceDuration = Math.round((totalForSource / totalAll) * totalDurationMs);
      const status: "success" | "error" = stat.errors > stat.created + stat.updated ? "error" : "success";
      await client.mutation(api.dataSources.recordIngestSync, {
        dataSourceSlug: slug,
        raceCount: totalForSource,
        createdCount: stat.created,
        updatedCount: stat.updated,
        durationMs: sourceDuration,
        status,
        triggeredBy: "github-action-daily-ingest",
        error: stat.errors > 0 ? `${stat.errors} carreras fallaron` : undefined,
      });
      console.log(
        `  ✓ ${sourceName} (${slug}): ${totalForSource} carreras, ${sourceDuration}ms, ${status}` +
          (stat.errors > 0 ? `, ${stat.errors} errores` : ""),
      );
    } catch (err) {
      console.error(`  ✗ ${sourceName} (${slug}): error registrando sync:`, err);
    }
  }

  // -------------------------------------------------------------------
  // Email de resumen al admin. Este script corre como el último paso del
  // workflow que registra sync (7/9 en daily-ingest.yml, después de
  // Sportmaniacs y Agenda Sureste en los pasos 1/9 y 2/9) — por eso es el
  // punto correcto para disparar el resumen de TODA la corrida nocturna,
  // no solo de las 4 fuentes que procesa este script.
  // -------------------------------------------------------------------
  try {
    await client.mutation(api.dataSources.sendIngestSummaryEmail, {
      totalDurationMs,
    });
    console.log(`\n[ingest-to-convex] 📧 Email de resumen enviado al admin.`);
  } catch (err) {
    console.error(`\n[ingest-to-convex] ⚠️  No se pudo enviar el email de resumen:`, err);
  }
}

main().catch((err) => {
  console.error("[ingest-to-convex] ❌ Error fatal:", err);
  process.exit(1);
});

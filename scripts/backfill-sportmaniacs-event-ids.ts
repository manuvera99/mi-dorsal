// =============================================================================
// scripts/backfill-sportmaniacs-event-ids.ts
// =============================================================================
// Descubre y cachea los UUID de modalidad ("event-card") de cada carrera
// de sportmaniacs.com, para que convex/scraper.ts (scrapeSportmaniacs)
// pueda scrapear resultados sin volver a parsear HTML en cada check del
// cron. Ver la nota larga al inicio del bloque "Adapter: Sportmaniacs" en
// convex/scraper.ts para el contexto completo del hallazgo.
//
// Qué hace:
//   1. Lista todas las carreras con scraperAdapter === "sportmaniacs".
//   2. Para cada una, hace fetch(sourceUrl) — la URL /es/races/{slug} que
//      apunta a sportmaniacs.com — y extrae cada <div class="event-card"
//      data-event-id="{uuid}"> del HTML server-rendered. Se usa sourceUrl
//      y NO officialUrl porque otras sesiones (homologación) sobrescriben
//      officialUrl con la web propia del organizador cuando existe,
//      dejándolo con una URL que ya no es de sportmaniacs.com — sourceUrl
//      (enlace al dataSource original) sí se mantiene siempre apuntando
//      ahí para este adapter (verificado 2026-09-11, 2379/2379 carreras).
//   3. Guarda `sportmaniacsEventIds` con esos UUID (+ nombre/distancia de
//      la modalidad cuando se puede parsear, solo para debugging).
//   4. Si la carrera tiene un único event-card, además establece
//      `resultsUrl` a la URL pública de resultados de esa modalidad
//      (informativa/clickable — el scraping real usa el nuevo endpoint,
//      no esta URL).
//
// Throttle 250ms entre requests (2379 carreras ⇒ ~10 min) para no golpear
// sportmaniacs.com de golpe — mismo espíritu que scripts/ingest-sportmaniacs.ts.
//
// Idempotente: si sportmaniacsEventIds ya coincide, se salta.
// Uso:  npx tsx --env-file=.env.local scripts/backfill-sportmaniacs-event-ids.ts
//       npx tsx --env-file=.env.local scripts/backfill-sportmaniacs-event-ids.ts --limit=20   (prueba rápida)
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import {
  extractSportmaniacsEventCards,
  type SportmaniacsEventRef,
} from "../convex/scraper";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("❌ NEXT_PUBLIC_CONVEX_URL no configurada");
  console.error("   Usa --env-file=.env.local o añade la var");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const MAX_RACES = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;
const THROTTLE_MS = 250;
const USER_AGENT = "Mozilla/5.0 mi-dorsal/0.1";

type DiscoveredEvent = SportmaniacsEventRef;

function sameEventIds(a: DiscoveredEvent[] | undefined, b: DiscoveredEvent[]): boolean {
  if (!a || a.length !== b.length) return false;
  const aIds = new Set(a.map((e) => e.eventId));
  return b.every((e) => aIds.has(e.eventId));
}

async function main() {
  console.log("=".repeat(70));
  console.log("Backfill de sportmaniacsEventIds (UUID de modalidad por carrera)");
  console.log("=".repeat(70));
  console.log(`Convex: ${CONVEX_URL}\n`);

  console.log("[1/2] Buscando carreras con scraperAdapter='sportmaniacs'...");
  const allRaces: any[] = await client.query(api.races.systemListAllDetailed, {});
  let smRaces = allRaces.filter(
    (r) => r.scraperAdapter === "sportmaniacs" && r.sourceUrl?.includes("sportmaniacs.com"),
  );
  console.log(`      Encontradas: ${smRaces.length} carreras con sourceUrl de sportmaniacs.com`);

  // Solo importan las carreras que aún pueden generar un check del cron:
  // las pasadas nunca van a dispararlo, así que no vale la pena gastar
  // requests en ellas. Margen de 7 días hacia atrás para cubrir la
  // ventana real de checkResults.getCheckFrequency ([-7d, +7d]).
  const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  const beforeFilter = smRaces.length;
  smRaces = smRaces.filter((r) => r.startDate && new Date(r.startDate).getTime() >= cutoff);
  // Las más próximas primero — si el script se corta a mitad, lo que ya
  // se procesó es lo que más importa.
  smRaces.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  console.log(`      Filtradas a futuras/recientes (>= hoy-7d): ${smRaces.length} (descartadas ${beforeFilter - smRaces.length} pasadas)`);

  if (Number.isFinite(MAX_RACES)) {
    smRaces = smRaces.slice(0, MAX_RACES);
    console.log(`      Limitado a ${smRaces.length} (--limit)`);
  }

  console.log("\n[2/2] Descubriendo event-card por carrera...\n");

  let updated = 0;
  let alreadyOk = 0;
  let noEventCard = 0;
  let fetchFailed = 0;
  const failures: { name: string; url: string; reason: string }[] = [];

  for (let i = 0; i < smRaces.length; i++) {
    const race = smRaces[i];
    if (i > 0) await new Promise((r) => setTimeout(r, THROTTLE_MS));

    let html: string;
    try {
      const res = await fetch(race.sourceUrl, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      });
      if (!res.ok) {
        fetchFailed++;
        failures.push({ name: race.name, url: race.sourceUrl, reason: `HTTP ${res.status}` });
        process.stdout.write("x");
        continue;
      }
      html = await res.text();
    } catch (err: any) {
      fetchFailed++;
      failures.push({ name: race.name, url: race.sourceUrl, reason: err?.message ?? String(err) });
      process.stdout.write("x");
      continue;
    }

    const events = extractSportmaniacsEventCards(html);
    if (events.length === 0) {
      noEventCard++;
      process.stdout.write("-");
      continue;
    }

    if (sameEventIds(race.sportmaniacsEventIds, events)) {
      alreadyOk++;
      process.stdout.write(".");
      continue;
    }

    const patch: Record<string, unknown> = { sportmaniacsEventIds: events };
    // Si hay una sola modalidad, resultsUrl informativa apunta directo a
    // sus resultados públicos. Con varias, no elegimos una — el scraper
    // real las prueba todas vía sportmaniacsEventIds.
    if (events.length === 1 && !race.resultsUrl) {
      patch.resultsUrl = `${race.sourceUrl}/${events[0].eventId}/results`;
    }

    try {
      await client.mutation(api.races.systemUpdate, { id: race._id, patch });
      updated++;
      process.stdout.write("u");
    } catch (err: any) {
      fetchFailed++;
      failures.push({ name: race.name, url: race.sourceUrl, reason: `mutation failed: ${err?.message ?? err}` });
      process.stdout.write("x");
    }

    if ((i + 1) % 50 === 0) {
      process.stdout.write(` [${i + 1}/${smRaces.length}]\n`);
    }
  }

  console.log("\n\n" + "=".repeat(70));
  console.log(
    `Resumen: ${updated} actualizadas, ${alreadyOk} ya OK, ${noEventCard} sin event-card, ${fetchFailed} fallos`,
  );
  if (failures.length > 0) {
    console.log(`\nFallos (primeros 20 de ${failures.length}):`);
    for (const f of failures.slice(0, 20)) console.log(`  - ${f.name}: ${f.reason} (${f.url})`);
  }
  console.log("=".repeat(70));
}

main().catch((err) => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});

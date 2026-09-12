// =============================================================================
// mi-dorsal — Cron: check-results
// =============================================================================
// Cada 30 min: busca resultados de carreras en ventana [-7d, +7d] y
// notifica al usuario por email cuando se encuentra su dorsal.
//
// Frecuencia adaptativa (Sprint 2): cuando una carrera está en [-1h, +6h]
// respecto a su hora de salida, se chequea más a menudo. La idea es que con
// el cron a 30 min y la lógica adaptativa dentro, nos ahorramos configurar
// múltiples crons. Si una carrera es muy popular y tarda en publicar, se
// reintenta hasta 7 días después.
// =============================================================================

import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import {
  scrapeResults,
  discoverSportmaniacsEventIds,
  type RunnerResult,
  type SportmaniacsEventRef,
} from "../scraper";
import { Doc, Id } from "../_generated/dataModel";
import { formatTime } from "../_helpers";
import { getEffectiveDistance } from "../../lib/prediction/effective-distance";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type Item = {
  myRaceId: string;
  raceId: string;
  dorsalNumber: string;
  resultsUrl: string | undefined;
  // Preferimos sourceUrl a officialUrl para el discovery de sportmaniacs:
  // otras sesiones (homologación) sobrescriben officialUrl con la web
  // propia del organizador cuando existe, dejándolo con una URL que NO es
  // de sportmaniacs.com. sourceUrl (el enlace al dataSource original) sí
  // se mantiene siempre apuntando a sportmaniacs.com para este adapter —
  // verificado 2026-09-11 contra las 2379 carreras del catálogo.
  sportmaniacsDiscoveryUrl: string | undefined;
  scraperAdapter: string | undefined;
  sportmaniacsEventIds: SportmaniacsEventRef[] | undefined;
  userId: string;
  raceName: string;
  raceDate: string | undefined;
  raceStartTime: string | undefined;
};

type RaceToCheck = {
  item: Item;
  frequency: "aggressive" | "normal" | "sparse";
  raceTime: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Devuelve la frecuencia con la que hay que chequear esta carrera.
 * - "aggressive" (cada 30 min): ventana [-1h, +6h] desde la salida
 * - "normal" (cada 6h): ventana [-7d, -1h] o [+6h, +48h]
 * - "sparse" (cada 24h): [+48h, +7d]
 * - "skip": fuera de ventana, no chequear
 */
function getCheckFrequency(raceTimeMs: number, nowMs: number): "skip" | "aggressive" | "normal" | "sparse" {
  const diffH = (raceTimeMs - nowMs) / 3600_000;
  if (diffH > 7 * 24) return "skip";
  if (diffH > 48) return "sparse";
  if (diffH > 6) return "normal";
  if (diffH > -1) return "aggressive";
  // post-carrera
  const elapsedH = (nowMs - raceTimeMs) / 3600_000;
  if (elapsedH < 6) return "aggressive";
  if (elapsedH < 48) return "normal";
  if (elapsedH < 7 * 24) return "sparse";
  return "skip";
}

// ---------------------------------------------------------------------------
// Construye el Item de un myRace+race — compartido entre el cron
// (getRacesToCheck) y el escaneo manual admin (adminResultsScan.ts). Requiere
// myRace.dorsalNumber ya validado como truthy por el caller.
// ---------------------------------------------------------------------------

export function buildItem(myRace: Doc<"myRaces">, race: Doc<"races">): Item {
  // sourceUrl es la URL real de sportmaniacs.com para este adapter;
  // officialUrl puede haber sido sobrescrito con la web del organizador
  // por otra sesión (homologación) — solo lo usamos si sourceUrl no
  // sirve (no es de sportmaniacs.com).
  const sourceUrl = (race as any).sourceUrl as string | undefined;
  const officialUrl = race.officialUrl ?? undefined;
  const sportmaniacsDiscoveryUrl =
    sourceUrl?.includes("sportmaniacs.com")
      ? sourceUrl
      : officialUrl?.includes("sportmaniacs.com")
        ? officialUrl
        : undefined;

  return {
    myRaceId: myRace._id,
    raceId: race._id,
    dorsalNumber: myRace.dorsalNumber!,
    resultsUrl: race.resultsUrl ?? undefined,
    sportmaniacsDiscoveryUrl,
    scraperAdapter: (race as any).scraperAdapter ?? undefined,
    sportmaniacsEventIds: (race as any).sportmaniacsEventIds ?? undefined,
    userId: myRace.userId,
    raceName: race.name,
    raceDate: race.startDate,
    raceStartTime: (race as any).startTime ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Query: devuelve las carreras que hay que chequear, agrupadas por frecuencia
// ---------------------------------------------------------------------------

export const getRacesToCheck = internalQuery({
  args: {},
  handler: async (ctx: any): Promise<{ races: RaceToCheck[]; skipped: number }> => {
    const now = Date.now();
    const all = await ctx.db
      .query("myRaces")
      .withIndex("by_status", (q) => q.eq("status", "planned"))
      .collect();

    const races: RaceToCheck[] = [];
    let skipped = 0;

    for (const myRace of all) {
      // Skip si ya se procesó
      if (myRace.resultScrapedAt) {
        skipped++;
        continue;
      }

      const race = await ctx.db.get(myRace.raceId);
      if (!race?.startDate || !myRace.dorsalNumber) {
        skipped++;
        continue;
      }

      const raceTime = new Date(race.startDate).getTime();
      if (isNaN(raceTime)) {
        skipped++;
        continue;
      }

      const frequency = getCheckFrequency(raceTime, now);
      if (frequency === "skip") {
        skipped++;
        continue;
      }

      races.push({ item: buildItem(myRace, race), frequency, raceTime });
    }

    return { races, skipped };
  },
});

// ---------------------------------------------------------------------------
// Query: devuelve un myRace concreto con su profile + race + email
// (usado por la action para tener todo en uno)
// ---------------------------------------------------------------------------

export const getMyRaceForNotification = internalQuery({
  args: { myRaceId: v.id("myRaces") },
  handler: async (ctx, { myRaceId }) => {
    const myRace = await ctx.db.get(myRaceId);
    if (!myRace) return null;
    const profile = await ctx.db.get(myRace.userId);
    if (!profile) return null;
    const race = await ctx.db.get(myRace.raceId);
    if (!race) return null;
    return { myRace, profile, race };
  },
});

// ---------------------------------------------------------------------------
// Procesamiento de un item — compartido entre el cron y el escaneo manual
// admin (convex/adminResultsScan.ts). Toda la lógica delicada (discovery de
// sportmaniacs, orden scrape→cachear→actualizar myRace→email→PR, qué cuenta
// como "no encontrado" vs "error") vive AQUÍ UNA SOLA VEZ.
// ---------------------------------------------------------------------------

export type ProcessItemOutcome =
  | { outcome: "found"; timeSeconds: number }
  | { outcome: "not_found" }
  | { outcome: "skipped_no_url" }
  | { outcome: "error"; message: string };

export async function processResultCheckItem(
  ctx: any,
  item: Item,
): Promise<ProcessItemOutcome> {
  let sportmaniacsEventIds = item.sportmaniacsEventIds;

  // Fallback de descubrimiento: si el backfill masivo (script offline)
  // aún no cacheó los eventIds de esta carrera — típicamente porque se
  // corrió antes de que sportmaniacs activara la página de resultados
  // con event-card, algo que pasa con carreras muy próximas en fecha —
  // intentamos parsear sportmaniacsDiscoveryUrl aquí mismo, una vez por
  // check. Si sportmaniacs ya lo publicó, lo cacheamos y seguimos con
  // el scrape normal en la misma pasada; si no, seguimos sin poder
  // chequear esta carrera y lo reintentaremos en el siguiente cron.
  if (
    item.scraperAdapter === "sportmaniacs" &&
    !sportmaniacsEventIds?.length &&
    item.sportmaniacsDiscoveryUrl
  ) {
    const discovered = await discoverSportmaniacsEventIds(item.sportmaniacsDiscoveryUrl);
    if (discovered.length > 0) {
      sportmaniacsEventIds = discovered;
      await ctx.runMutation(internal.crons.checkResults.cacheSportmaniacsEventIds, {
        raceId: item.raceId as Id<"races">,
        sportmaniacsEventIds: discovered,
      });
    }
  }

  // Sportmaniacs no necesita resultsUrl para scrapear (usa
  // sportmaniacsEventIds, cacheados por el backfill o descubiertos
  // arriba) — solo el resto de adapters lo requieren.
  const hasSportmaniacsIds =
    item.scraperAdapter === "sportmaniacs" && !!sportmaniacsEventIds?.length;
  if (!item.resultsUrl && !hasSportmaniacsIds) {
    // No podemos scrapear sin URL (ni sin eventIds cacheados/descubiertos).
    return { outcome: "skipped_no_url" };
  }

  try {
    const result = await scrapeResults(
      item.resultsUrl ?? "",
      item.dorsalNumber,
      item.scraperAdapter,
      { sportmaniacsEventIds },
    );

    if (!result) {
      // No encontrado todavía. No marcamos resultScrapedAt, queremos
      // que se reintente en el siguiente cron/escaneo.
      return { outcome: "not_found" };
    }

    console.log(
      `[check-results] ✓ Encontrado ${item.raceName} dorsal ${item.dorsalNumber}: ${formatTime(result.timeSeconds)}`,
    );

    // 1) Cachear el resultado
    await ctx.runMutation(internal.crons.checkResults.cacheResult, {
      raceId: item.raceId as Id<"races">,
      dorsalNumber: item.dorsalNumber,
      runnerName: result.runnerName,
      positionOverall: result.positionOverall,
      positionCategory: result.positionCategory,
      timeSeconds: result.timeSeconds,
      sourceUrl: item.resultsUrl,
    });

    // 2) Actualizar myRace (status → done)
    await ctx.runMutation(internal.crons.checkResults.updateMyRace, {
      myRaceId: item.myRaceId as Id<"myRaces">,
      timeSeconds: result.timeSeconds,
      position: result.positionOverall,
      positionCategory: result.positionCategory,
    });

    // 3) Enviar email al usuario
    const notifData = await ctx.runQuery(
      internal.crons.checkResults.getMyRaceForNotification,
      { myRaceId: item.myRaceId as Id<"myRaces"> },
    );

    if (notifData) {
      await ctx.runAction(internal.emailNotificationsAction.sendResultFoundEmail, {
        userId: notifData.profile._id,
        myRaceId: item.myRaceId as Id<"myRaces">,
        raceName: item.raceName,
        raceDate: item.raceDate ?? "",
        timeSeconds: result.timeSeconds,
        positionOverall: result.positionOverall,
        positionCategory: result.positionCategory,
        predictedTimeSeconds: notifData.myRace.predictedTimeSeconds,
      });

      // 4) Persistir el PR si el nuevo tiempo bate el récord anterior.
      // Se hace DESPUÉS del email para que el email haya leído el PR
      // "viejo" como referencia. La próxima vez, este PR nuevo será
      // el current y ya no se mostrará como badge.
      try {
        const effectiveDistance = getEffectiveDistance(notifData.myRace, notifData.race);
        const distanceM = Math.round(effectiveDistance.distanceKm * 1000);
        const prResult = await ctx.runMutation(
          internal.personalRecords.updateIfBetter,
          {
            userId: notifData.profile._id,
            distanceM,
            timeSeconds: result.timeSeconds,
            raceId: notifData.race._id,
            achievedAt: notifData.race.startDate,
          },
        );
        if (prResult.updated) {
          console.log(
            `[check-results] ✓ Nuevo PR para ${notifData.profile.email} ` +
              `en ${distanceM}m: ${prResult.previousTimeSeconds}s → ${result.timeSeconds}s`,
          );
        }
      } catch (e) {
        // No bloqueamos el flujo principal si falla el PR update.
        // El email ya se envió. Log para investigar después.
        console.error(
          `[check-results] PR update failed for myRaceId=${item.myRaceId}:`,
          e,
        );
      }
    }

    return { outcome: "found", timeSeconds: result.timeSeconds };
  } catch (err) {
    console.error(
      `[check-results] Error scraping ${item.raceName} (dorsal ${item.dorsalNumber}):`,
      err,
    );
    return { outcome: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Action principal del cron
// ---------------------------------------------------------------------------

export const checkResults = internalAction({
  args: {},
  handler: async (ctx: any) => {
    const { races, skipped } = await ctx.runQuery(internal.crons.checkResults.getRacesToCheck);
    console.log(
      `[check-results] ${races.length} carreras a chequear, ${skipped} saltadas`,
    );

    // Estadísticas para el log final
    let foundCount = 0;
    let skippedNoUrl = 0;
    let skippedNoDorsal = 0;
    let scrapeErrors = 0;

    for (const { item } of races) {
      if (!item.dorsalNumber) {
        skippedNoDorsal++;
        continue;
      }

      const outcome = await processResultCheckItem(ctx, item);
      if (outcome.outcome === "found") foundCount++;
      else if (outcome.outcome === "skipped_no_url") skippedNoUrl++;
      else if (outcome.outcome === "error") scrapeErrors++;
      // "not_found" no cuenta para nada — se reintentará en el siguiente cron.
    }

    console.log(
      `[check-results] Resumen: ${foundCount} resultados nuevos, ${scrapeErrors} errores, ${skippedNoUrl} sin URL, ${skippedNoDorsal} sin dorsal`,
    );
  },
});

// ---------------------------------------------------------------------------
// Mutations internas
// ---------------------------------------------------------------------------

/**
 * Cachea los sportmaniacsEventIds descubiertos al vuelo por
 * `discoverSportmaniacsEventIds` (fallback del cron cuando el backfill
 * masivo offline aún no los tenía). Mismo campo que puebla
 * `scripts/backfill-sportmaniacs-event-ids.ts`.
 */
export const cacheSportmaniacsEventIds = internalMutation({
  args: {
    raceId: v.id("races"),
    sportmaniacsEventIds: v.array(
      v.object({
        eventId: v.string(),
        name: v.optional(v.string()),
        distanceKm: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { raceId, sportmaniacsEventIds }) => {
    await ctx.db.patch(raceId, { sportmaniacsEventIds });
  },
});

export const cacheResult = internalMutation({
  args: {
    raceId: v.id("races"),
    dorsalNumber: v.string(),
    runnerName: v.optional(v.string()),
    positionOverall: v.optional(v.number()),
    positionCategory: v.optional(v.number()),
    timeSeconds: v.number(),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("raceResultsCache")
      .withIndex("by_race_dorsal", (q) =>
        q.eq("raceId", args.raceId).eq("dorsalNumber", args.dorsalNumber),
      )
      .unique();

    const data = {
      runnerName: args.runnerName,
      positionOverall: args.positionOverall,
      positionCategory: args.positionCategory,
      timeSeconds: args.timeSeconds,
      sourceUrl: args.sourceUrl,
      scrapedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("raceResultsCache", {
        raceId: args.raceId,
        dorsalNumber: args.dorsalNumber,
        ...data,
      });
    }
  },
});

export const updateMyRace = internalMutation({
  args: {
    myRaceId: v.id("myRaces"),
    timeSeconds: v.number(),
    position: v.optional(v.number()),
    positionCategory: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.myRaceId, {
      actualTimeSeconds: args.timeSeconds,
      actualPosition: args.position,
      actualPositionCategory: args.positionCategory,
      resultSource: "auto_scrape",
      resultScrapedAt: Date.now(),
      status: "done",
    });
  },
});

/**
 * Marca una myRace como "no encontrada tras todos los reintentos".
 * Llamado desde el flujo de result_not_found email.
 */
export const markAsNotFound = internalMutation({
  args: { myRaceId: v.id("myRaces") },
  handler: async (ctx, { myRaceId }) => {
    await ctx.db.patch(myRaceId, {
      resultSource: "auto_scrape",
      resultScrapedAt: Date.now(),
      // No cambiamos status, sigue planned por si el usuario quiere meterlo a mano
    });
  },
});

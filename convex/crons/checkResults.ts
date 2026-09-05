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
import { scrapeResults, type RunnerResult } from "../scraper";
import { Doc, Id } from "../_generated/dataModel";
import { formatTime } from "../_helpers";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type Item = {
  myRaceId: string;
  raceId: string;
  dorsalNumber: string;
  resultsUrl: string | undefined;
  scraperAdapter: string | undefined;
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

      const item: Item = {
        myRaceId: myRace._id,
        raceId: race._id,
        dorsalNumber: myRace.dorsalNumber,
        resultsUrl: race.resultsUrl ?? undefined,
        scraperAdapter: (race as any).scraperAdapter ?? undefined,
        userId: myRace.userId,
        raceName: race.name,
        raceDate: race.startDate,
        raceStartTime: (race as any).startTime ?? undefined,
      };

      races.push({ item, frequency, raceTime });
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
// Action principal del cron
// ---------------------------------------------------------------------------

export const checkResults = internalAction({
  args: {},
  handler: async (ctx) => {
    const { races, skipped } = await ctx.runQuery(internal.crons.checkResults.getRacesToCheck);
    console.log(
      `[check-results] ${races.length} carreras a chequear, ${skipped} saltadas`,
    );

    // Estadísticas para el log final
    let foundCount = 0;
    let errorCount = 0;
    let skippedNoUrl = 0;
    let skippedNoDorsal = 0;
    let scrapeErrors = 0;

    for (const { item } of races) {
      if (!item.dorsalNumber) {
        skippedNoDorsal++;
        continue;
      }
      if (!item.resultsUrl) {
        // No podemos scrapear sin URL. Marcamos como intentado para no
        // machacar el log con warnings en cada cron. El admin puede
        // re-activarlo cambiando el estado a "planned" desde el panel admin.
        skippedNoUrl++;
        continue;
      }

      try {
        const result = await scrapeResults(
          item.resultsUrl,
          item.dorsalNumber,
          item.scraperAdapter,
        );

        if (!result) {
          // No encontrado todavía. No marcamos resultScrapedAt, queremos
          // que se reintente en el siguiente cron.
          continue;
        }

        foundCount++;
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
          await ctx.runAction(internal.emailNotifications.sendResultFoundEmail, {
            userId: notifData.profile._id,
            myRaceId: item.myRaceId as Id<"myRaces">,
            raceName: item.raceName,
            raceDate: item.raceDate ?? "",
            timeSeconds: result.timeSeconds,
            positionOverall: result.positionOverall,
            positionCategory: result.positionCategory,
            predictedTimeSeconds: notifData.myRace.predictedTimeSeconds,
          });
        }
      } catch (err) {
        errorCount++;
        scrapeErrors++;
        console.error(
          `[check-results] Error scraping ${item.raceName} (dorsal ${item.dorsalNumber}):`,
          err,
        );
      }
    }

    console.log(
      `[check-results] Resumen: ${foundCount} resultados nuevos, ${scrapeErrors} errores, ${skippedNoUrl} sin URL, ${skippedNoDorsal} sin dorsal`,
    );
  },
});

// ---------------------------------------------------------------------------
// Mutations internas
// ---------------------------------------------------------------------------

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

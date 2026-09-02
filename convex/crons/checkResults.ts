// =============================================================================
// mi-dorsal — Cron: check-results
// =============================================================================
// Cada 6 horas: busca resultados de carreras en ventana [-1d, +7d] y
// notifica al usuario por email cuando se encuentra su dorsal.
// =============================================================================

import { internalAction, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { scrapeResults } from "../scraper";

/**
 * Query: carreras planificadas con startDate en ventana [-1d, +7d].
 */
export const getRacesToCheck = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oneDayAgo = now - 86400 * 1000;
    const sevenDaysLater = now + 7 * 86400 * 1000;

    const all = await ctx.db
      .query("myRaces")
      .withIndex("by_status", (q) => q.eq("status", "planned"))
      .collect();

    const result: Array<{
      myRaceId: string;
      raceId: string;
      dorsalNumber: string;
      resultsUrl: string | undefined;
      scraperAdapter: string | undefined;
      userEmail: string;
      userName: string;
      userId: string;
      raceName: string;
      raceDate: string | undefined;
    }> = [];

    for (const myRace of all) {
      const race = await ctx.db.get(myRace.raceId);
      if (!race?.startDate || !myRace.dorsalNumber) continue;
      const raceTime = new Date(race.startDate).getTime();
      if (raceTime < oneDayAgo || raceTime > sevenDaysLater) continue;

      const profile = await ctx.db.get(myRace.userId);
      if (!profile) continue;

      // Skip si ya se procesó
      if (myRace.resultScrapedAt) continue;

      const identity = await ctx.auth.getUserIdentity();
      // No podemos acceder a email directamente desde profile, se necesita un join
      // En una versión más completa, esto vendría de Clerk
      result.push({
        myRaceId: myRace._id,
        raceId: race._id,
        dorsalNumber: myRace.dorsalNumber,
        resultsUrl: race.resultsUrl,
        scraperAdapter: race.scraperAdapter,
        userEmail: "user@example.com", // TODO: obtener de Clerk
        userName: profile.displayName ?? "Corredor",
        userId: profile._id,
        raceName: race.name,
        raceDate: race.startDate,
      });
    }
    return result;
  },
});

/**
 * Acción principal del cron: scrapear resultados y notificar.
 */
export const checkResults = internalAction({
  args: {},
  handler: async (ctx) => {
    const racesToCheck = await ctx.runQuery(internal.crons.checkResults.getRacesToCheck);

    console.log(`[check-results] Checking ${racesToCheck.length} races`);

    for (const item of racesToCheck) {
      if (!item.resultsUrl || !item.dorsalNumber) continue;

      try {
        console.log(`[check-results] Scraping ${item.raceName} for dorsal ${item.dorsalNumber}`);

        const result = await scrapeResults(
          item.resultsUrl,
          item.dorsalNumber,
          item.scraperAdapter,
        );

        if (result) {
          console.log(`[check-results] Found result for ${item.raceName}: ${result.timeSeconds}s`);

          // Guardar en cache
          await ctx.runMutation(internal.crons.checkResults.cacheResult, {
            raceId: item.raceId as any,
            dorsalNumber: item.dorsalNumber,
            runnerName: result.runnerName,
            positionOverall: result.positionOverall,
            positionCategory: result.positionCategory,
            timeSeconds: result.timeSeconds,
            sourceUrl: item.resultsUrl,
          });

          // Actualizar myRace
          await ctx.runMutation(internal.crons.checkResults.updateMyRace, {
            myRaceId: item.myRaceId as any,
            timeSeconds: result.timeSeconds,
            position: result.positionOverall,
            positionCategory: result.positionCategory,
          });

          // TODO: enviar email
          // await ctx.runAction(internal.emails.sendResultFound, { ... });
        }
      } catch (err) {
        console.error(`[check-results] Error for ${item.raceName}:`, err);
      }
    }
  },
});

// Mutations internas llamadas desde la action
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

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
    // Verificar si ya existe
    const existing = await ctx.db
      .query("raceResultsCache")
      .withIndex("by_race_dorsal", (q) =>
        q.eq("raceId", args.raceId).eq("dorsalNumber", args.dorsalNumber),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        runnerName: args.runnerName,
        positionOverall: args.positionOverall,
        positionCategory: args.positionCategory,
        timeSeconds: args.timeSeconds,
        sourceUrl: args.sourceUrl,
        scrapedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("raceResultsCache", {
        raceId: args.raceId,
        dorsalNumber: args.dorsalNumber,
        runnerName: args.runnerName,
        positionOverall: args.positionOverall,
        positionCategory: args.positionCategory,
        timeSeconds: args.timeSeconds,
        sourceUrl: args.sourceUrl,
        scrapedAt: Date.now(),
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

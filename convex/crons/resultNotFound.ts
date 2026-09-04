// =============================================================================
// mi-dorsal — Cron: result-not-found
// =============================================================================
// Diario 14h UTC: para carreras que terminaron hace >=48h y siguen sin
// resultado scrapeado, manda email "no hemos encontrado tu tiempo" y
// marca la myRace para que el siguiente cron la salte (evita spam).
// =============================================================================

import { internalAction, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

const FORTY_EIGHT_HOURS = 48 * 3600 * 1000;

/**
 * Query: carreras que llevan >=48h terminadas sin resultado
 */
export const getRacesWithoutResult = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const all = await ctx.db
      .query("myRaces")
      .withIndex("by_status", (q) => q.eq("status", "planned"))
      .collect();

    const out: Array<{ myRaceId: string; userId: string; raceId: string; raceName: string; raceDate: string }> = [];

    for (const myRace of all) {
      const race = await ctx.db.get(myRace.raceId);
      if (!race?.startDate) continue;
      const raceTime = new Date(race.startDate).getTime();
      const elapsed = now - raceTime;
      if (elapsed < FORTY_EIGHT_HOURS) continue;
      if (elapsed > 7 * 24 * 3600 * 1000) continue; // muy viejas, no molestar

      // Skip si ya se marcó como scraped
      if (myRace.resultScrapedAt) continue;

      // Skip si ya se envió el email result_not_found
      const alreadySent = await ctx.db
        .query("notificationLog")
        .withIndex("by_user_type", (q) =>
          q.eq("userId", myRace.userId).eq("type", "result_not_found"),
        )
        .filter((q) => q.eq(q.field("relatedMyRaceId"), myRace._id))
        .first();
      if (alreadySent) continue;

      out.push({
        myRaceId: myRace._id,
        userId: myRace.userId,
        raceId: race._id,
        raceName: race.name,
        raceDate: race.startDate,
      });
    }

    return out;
  },
});

export const resultNotFound = internalAction({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.runQuery(
      internal.crons.resultNotFound.getRacesWithoutResult,
    );

    console.log(`[result-not-found] ${items.length} carreras sin resultado tras 48h`);

    let sent = 0;
    let errors = 0;
    let skippedNoEmail = 0;

    for (const item of items) {
      const profile = await ctx.db.get(item.userId as any);
      if (!profile?.email) {
        skippedNoEmail++;
        continue;
      }
      if (profile.emailResultsEnabled === false) continue;

      try {
        await ctx.runAction(internal.emails.sendResultNotFoundEmail, {
          userId: profile._id,
          myRaceId: item.myRaceId as any,
          raceName: item.raceName,
          raceDate: item.raceDate,
        });
        sent++;
      } catch (err) {
        errors++;
        console.error(
          `[result-not-found] Error enviando para ${item.raceName}:`,
          err,
        );
      }
    }

    console.log(
      `[result-not-found] Resumen: enviados=${sent}, sin-email=${skippedNoEmail}, errores=${errors}`,
    );
  },
});

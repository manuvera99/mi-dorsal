// =============================================================================
// mi-dorsal — Cron: reminder-pre-race
// =============================================================================
// Diario 9am UTC: envía recordatorios 7d y 1d antes de cada carrera.
//
// Se apoya en notificationLog para idempotencia: si ya se envió el
// recordatorio 7d para esta myRace, no se vuelve a enviar.
// =============================================================================

import { internalAction, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Query: carreras que necesitan recordatorio hoy
// ---------------------------------------------------------------------------

export const getRacesNeedingReminder = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const target7d = now + 7 * 86400 * 1000;
    const target1d = now + 1 * 86400 * 1000;
    const oneDayWindow = 6 * 3600 * 1000; // ±6h

    const all = await ctx.db
      .query("myRaces")
      .withIndex("by_status", (q) => q.eq("status", "planned"))
      .collect();

    const needs7d: any[] = [];
    const needs1d: any[] = [];

    for (const myRace of all) {
      const race = await ctx.db.get(myRace.raceId);
      if (!race?.startDate) continue;
      const raceTime = new Date(race.startDate).getTime();

      // 7 días
      if (Math.abs(raceTime - target7d) < oneDayWindow) {
        const alreadySent = await ctx.db
          .query("notificationLog")
          .withIndex("by_user_type", (q) =>
            q.eq("userId", myRace.userId).eq("type", "reminder_7d"),
          )
          .filter((q) => q.eq(q.field("relatedMyRaceId"), myRace._id))
          .first();
        if (!alreadySent) {
          needs7d.push({ myRace, race });
        }
      }

      // 1 día
      if (Math.abs(raceTime - target1d) < oneDayWindow) {
        const alreadySent = await ctx.db
          .query("notificationLog")
          .withIndex("by_user_type", (q) =>
            q.eq("userId", myRace.userId).eq("type", "reminder_1d"),
          )
          .filter((q) => q.eq(q.field("relatedMyRaceId"), myRace._id))
          .first();
        if (!alreadySent) {
          needs1d.push({ myRace, race });
        }
      }
    }

    return { needs7d, needs1d };
  },
});

// ---------------------------------------------------------------------------
// Action principal
// ---------------------------------------------------------------------------

export const reminderPreRace = internalAction({
  args: {},
  handler: async (ctx) => {
    const { needs7d, needs1d } = await ctx.runQuery(
      internal.crons.reminderPreRace.getRacesNeedingReminder,
    );

    console.log(
      `[reminder-pre-race] 7d: ${needs7d.length}, 1d: ${needs1d.length}`,
    );

    let sent7d = 0;
    let sent1d = 0;
    let skippedNoEmail = 0;
    let errorCount = 0;

    // 7 días
    for (const { myRace, race } of needs7d) {
      const profile = await ctx.runQuery(
        internal.crons.reminderPreRace.getProfile,
        { userId: myRace.userId },
      );
      if (!profile?.email) {
        skippedNoEmail++;
        continue;
      }
      if (profile.emailRemindersEnabled === false) continue;

      try {
        await ctx.runAction(internal.emails.sendReminderEmail, {
          userId: profile._id,
          myRaceId: myRace._id,
          raceName: race.name,
          dorsalNumber: myRace.dorsalNumber,
          predictedTimeSeconds: myRace.predictedTimeSeconds,
          daysUntil: 7,
        });
        sent7d++;
      } catch (err) {
        errorCount++;
        console.error(
          `[reminder-pre-race] Error enviando 7d para ${race.name}:`,
          err,
        );
      }
    }

    // 1 día
    for (const { myRace, race } of needs1d) {
      const profile = await ctx.runQuery(
        internal.crons.reminderPreRace.getProfile,
        { userId: myRace.userId },
      );
      if (!profile?.email) {
        skippedNoEmail++;
        continue;
      }
      if (profile.emailRemindersEnabled === false) continue;

      try {
        await ctx.runAction(internal.emails.sendReminderEmail, {
          userId: profile._id,
          myRaceId: myRace._id,
          raceName: race.name,
          dorsalNumber: myRace.dorsalNumber,
          predictedTimeSeconds: myRace.predictedTimeSeconds,
          daysUntil: 1,
        });
        sent1d++;
      } catch (err) {
        errorCount++;
        console.error(
          `[reminder-pre-race] Error enviando 1d para ${race.name}:`,
          err,
        );
      }
    }

    console.log(
      `[reminder-pre-race] Resumen: 7d=${sent7d}, 1d=${sent1d}, sin-email=${skippedNoEmail}, errores=${errorCount}`,
    );
  },
});

/**
 * Query interna: devuelve el profile con su email.
 */
export const getProfile = internalQuery({
  args: { userId: v.id("profiles") },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId);
  },
});

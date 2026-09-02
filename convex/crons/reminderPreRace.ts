// =============================================================================
// mi-dorsal — Cron: reminder-pre-race
// =============================================================================
// Diario 9am UTC: envía recordatorios 7d y 1d antes de cada carrera.
// =============================================================================

import { internalAction, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

/**
 * Query: carreras que necesitan recordatorio hoy.
 */
export const getRacesNeedingReminder = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const target7d = now + 7 * 86400 * 1000;
    const target1d = now + 1 * 86400 * 1000;
    const oneDayWindow = 6 * 3600 * 1000; // +/- 6h

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
        // Verificar que no se haya enviado ya
        const alreadySent = await ctx.db
          .query("notificationLog")
          .withIndex("by_user_type", (q) =>
            q
              .eq("userId", myRace.userId)
              .eq("type", "reminder_7d"),
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
            q
              .eq("userId", myRace.userId)
              .eq("type", "reminder_1d"),
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

/**
 * Acción principal.
 */
export const reminderPreRace = internalAction({
  args: {},
  handler: async (ctx) => {
    const { needs7d, needs1d } = await ctx.runQuery(
      internal.crons.reminderPreRace.getRacesNeedingReminder,
    );

    console.log(
      `[reminder-pre-race] 7d: ${needs7d.length}, 1d: ${needs1d.length}`,
    );

    // TODO: send emails via Resend
    // For now, just log
    for (const { myRace, race } of needs7d) {
      console.log(`[reminder-pre-race] Would send 7d reminder for ${race.name}`);
    }
    for (const { myRace, race } of needs1d) {
      console.log(`[reminder-pre-race] Would send 1d reminder for ${race.name}`);
    }
  },
});

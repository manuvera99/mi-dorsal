// =============================================================================
// mi-dorsal — Cron: weekly-digest
// =============================================================================
// Lunes 9am UTC: resumen semanal.
// =============================================================================

import { internalAction, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";

export const getActiveUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Usuarios con al menos 1 myRace en últimos 30 días
    const thirtyDaysAgo = Date.now() - 30 * 86400 * 1000;
    const all = await ctx.db.query("profiles").collect();
    const active: any[] = [];

    for (const profile of all) {
      const recent = await ctx.db
        .query("myRaces")
        .withIndex("by_user", (q) => q.eq("userId", profile._id))
        .filter((q) => q.gt(q.field("_creationTime"), thirtyDaysAgo))
        .first();
      if (recent && profile.emailWeeklyDigestEnabled !== false) {
        active.push(profile);
      }
    }
    return active;
  },
});

export const weeklyDigest = internalAction({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.runQuery(internal.crons.weeklyDigest.getActiveUsers);
    console.log(`[weekly-digest] Would send to ${users.length} users`);
    // TODO: send emails
  },
});

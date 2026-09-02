// =============================================================================
// mi-dorsal — Cron: year-review
// =============================================================================
// 1 enero 10am UTC: genera year in review del año anterior.
// =============================================================================

import { internalAction, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";

export const getUsersForYearReview = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("profiles").collect();
    const year = new Date().getFullYear() - 1;
    const yearStart = new Date(`${year}-01-01`).getTime();
    const yearEnd = new Date(`${year}-12-31`).getTime();

    const eligible: any[] = [];
    for (const profile of all) {
      const racesThisYear = await ctx.db
        .query("myRaces")
        .withIndex("by_user", (q) => q.eq("userId", profile._id))
        .filter((q) =>
          q.and(
            q.gte(q.field("_creationTime"), yearStart),
            q.lte(q.field("_creationTime"), yearEnd),
          ),
        )
        .collect();
      if (racesThisYear.length > 0) {
        eligible.push({ profile, count: racesThisYear.length });
      }
    }
    return eligible;
  },
});

export const yearReview = internalAction({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.runQuery(internal.crons.yearReview.getUsersForYearReview);
    console.log(`[year-review] Would generate for ${users.length} users`);
    // TODO: send year in review emails
  },
});

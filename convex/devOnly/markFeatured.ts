// =============================================================================
// mi-dorsal — Dev/admin: markFeaturedBulk
// =============================================================================
// Marca las N carreras más próximas como isFeatured=true. Usar:
// `npx convex run --deployment precious-goshawk-41
// 'devOnly/markFeaturedBulk:markFeaturedBulk' '{"limit": 12}'`
// =============================================================================

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const markFeaturedBulk = internalMutation({
  args: { limit: v.number() },
  handler: async (ctx: any, { limit }) => {
    const all = await ctx.db
      .query("races")
      .withIndex("by_published_date")
      .filter((q) => q.eq(q.field("isPublished"), true))
      .collect();

    // Ordenar por fecha (próximas primero) y tomar las N
    const sorted = all
      .filter((r) => r.startDate)
      .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));

    const toFeature = sorted.slice(0, limit);
    let updated = 0;
    for (const race of toFeature) {
      await ctx.db.patch(race._id, { isFeatured: true });
      updated++;
    }
    return { updated, total: all.length };
  },
});

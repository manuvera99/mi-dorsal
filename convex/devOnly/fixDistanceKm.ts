// =============================================================================
// mi-dorsal — Dev/admin: fixDistanceKm
// =============================================================================
// Corrige el `distanceKm` de una o varias carreras por slug. Pensado para
// limpieza tras el bug del scraper de carreraspopulares.com (que matcheaba
// el día/año de la fecha como si fuera la distancia) y del de sportmaniacs
// (que parece devolver un valor por defecto incorrecto).
//
// Usar (uno):
//   npx convex run --prod devOnly/fixDistanceKm:fixBySlug \
//     '{"slug":"zurich-marato-barcelona","distanceKm":42.195}'
//
// Usar (lote):
//   npx convex run --prod devOnly/fixDistanceKm:fixBulk \
//     '{"items":[{"slug":"x","distanceKm":42.195}, ...]}'
//
// Solo sobreescribe `distanceKm`. NO toca description, raceType, ni otros
// campos. Devuelve { updated, skipped, errors, before, after }.
// =============================================================================

import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const fixBySlug = mutation({
  args: {
    slug: v.string(),
    distanceKm: v.number(),
  },
  handler: async (ctx, { slug, distanceKm }) => {
    const race = await ctx.db
      .query("races")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!race) throw new Error(`Race not found: ${slug}`);

    const before = race.distanceKm;
    await ctx.db.patch(race._id, { distanceKm });

    return {
      updated: true,
      before,
      after: distanceKm,
      race: {
        _id: String(race._id),
        slug: race.slug,
        name: race.name,
        distanceKm,
        startDate: race.startDate,
        locality: race.locality,
      },
    };
  },
});

export const fixBulk = mutation({
  args: {
    items: v.array(
      v.object({
        slug: v.string(),
        distanceKm: v.number(),
      })
    ),
  },
  handler: async (ctx, { items }) => {
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ slug: string; message: string }> = [];
    const before: Record<string, number> = {};
    const after: Record<string, number> = {};

    for (const it of items) {
      try {
        const race = await ctx.db
          .query("races")
          .withIndex("by_slug", (q) => q.eq("slug", it.slug))
          .unique();
        if (!race) {
          errors.push({ slug: it.slug, message: "not found" });
          skipped++;
          continue;
        }
        before[it.slug] = race.distanceKm;
        await ctx.db.patch(race._id, { distanceKm: it.distanceKm });
        after[it.slug] = it.distanceKm;
        updated++;
      } catch (e: any) {
        errors.push({ slug: it.slug, message: String(e?.message ?? e) });
      }
    }

    return { updated, skipped, errors, before, after };
  },
});

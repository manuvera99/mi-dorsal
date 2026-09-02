// =============================================================================
// mi-dorsal — Ratings (votaciones 8D)
// =============================================================================

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireUser, getOptionalUser } from "./_helpers";

/**
 * Lista ratings de una carrera (público).
 */
export const listForRace = query({
  args: { raceId: v.id("races") },
  handler: async (ctx, { raceId }) => {
    return await ctx.db
      .query("raceRatings")
      .withIndex("by_race", (q) => q.eq("raceId", raceId))
      .collect();
  },
});

/**
 * Resumen agregado de ratings para una carrera (medias por dimensión).
 * Lectura pública.
 */
export const summary = query({
  args: { raceId: v.id("races") },
  handler: async (ctx, { raceId }) => {
    const ratings = await ctx.db
      .query("raceRatings")
      .withIndex("by_race", (q) => q.eq("raceId", raceId))
      .collect();

    if (ratings.length === 0) {
      return {
        totalRatings: 0,
        avgOrganization: null,
        avgPrice: null,
        avgSwag: null,
        avgAidStations: null,
        avgCourse: null,
        avgAtmosphere: null,
        avgPostRace: null,
        avgTrophies: null,
        avgGlobal: null,
      };
    }

    const sum = (key: keyof typeof ratings[0]) => {
      const values = ratings
        .map((r) => r[key])
        .filter((v): v is number => typeof v === "number");
      return values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null;
    };

    const avgs = {
      avgOrganization: sum("organization"),
      avgPrice: sum("price"),
      avgSwag: sum("swag"),
      avgAidStations: sum("aidStations"),
      avgCourse: sum("course"),
      avgAtmosphere: sum("atmosphere"),
      avgPostRace: sum("postRace"),
      avgTrophies: sum("trophies"),
    };

    const validAvgs = Object.values(avgs).filter(
      (v): v is number => v !== null,
    );
    const avgGlobal =
      validAvgs.length > 0
        ? validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length
        : null;

    return {
      totalRatings: ratings.length,
      ...avgs,
      avgGlobal,
    };
  },
});

/**
 * Top 10 carreras por media global (mínimo 3 ratings).
 */
export const topRaces = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const races = await ctx.db
      .query("races")
      .withIndex("by_published_date")
      .filter((q) => q.eq(q.field("isPublished"), true))
      .collect();

    const result = await Promise.all(
      races.map(async (race) => {
        const ratings = await ctx.db
          .query("raceRatings")
          .withIndex("by_race", (q) => q.eq("raceId", race._id))
          .collect();
        if (ratings.length < 3) return null;

        const sum = (key: keyof typeof ratings[0]) => {
          const values = ratings
            .map((r) => r[key])
            .filter((v): v is number => typeof v === "number");
          return values.length > 0
            ? values.reduce((a, b) => a + b, 0) / values.length
            : 0;
        };

        const avgs = [
          sum("organization"),
          sum("price"),
          sum("swag"),
          sum("aidStations"),
          sum("course"),
          sum("atmosphere"),
          sum("postRace"),
          sum("trophies"),
        ].filter((v) => v > 0);

        const avgGlobal =
          avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : 0;

        return {
          ...race,
          totalRatings: ratings.length,
          avgGlobal: Math.round(avgGlobal * 100) / 100,
        };
      }),
    );

    return result
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => {
        if (b.avgGlobal !== a.avgGlobal) return b.avgGlobal - a.avgGlobal;
        return b.totalRatings - a.totalRatings;
      })
      .slice(0, limit ?? 10);
  },
});

/**
 * Mi rating en una carrera (null si no he votado).
 */
export const myRating = query({
  args: { raceId: v.id("races") },
  handler: async (ctx, { raceId }) => {
    const profile = await getOptionalUser(ctx);
    if (!profile) return null;
    return await ctx.db
      .query("raceRatings")
      .withIndex("by_user_race", (q) =>
        q.eq("userId", profile._id).eq("raceId", raceId),
      )
      .unique();
  },
});

/**
 * Upsert del rating del usuario en una carrera.
 */
export const upsert = mutation({
  args: {
    raceId: v.id("races"),
    organization: v.optional(v.number()),
    price: v.optional(v.number()),
    swag: v.optional(v.number()),
    aidStations: v.optional(v.number()),
    course: v.optional(v.number()),
    atmosphere: v.optional(v.number()),
    postRace: v.optional(v.number()),
    trophies: v.optional(v.number()),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Validar rangos
    for (const [key, val] of Object.entries(args)) {
      if (
        key !== "raceId" &&
        key !== "comment" &&
        typeof val === "number" &&
        (val < 0 || val > 10)
      ) {
        throw new Error(`Invalid ${key}: must be 0-10`);
      }
    }

    const existing = await ctx.db
      .query("raceRatings")
      .withIndex("by_user_race", (q) =>
        q.eq("userId", user._id).eq("raceId", args.raceId),
      )
      .unique();

    const data = {
      userId: user._id,
      raceId: args.raceId,
      organization: args.organization,
      price: args.price,
      swag: args.swag,
      aidStations: args.aidStations,
      course: args.course,
      atmosphere: args.atmosphere,
      postRace: args.postRace,
      trophies: args.trophies,
      comment: args.comment,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    } else {
      return await ctx.db.insert("raceRatings", data);
    }
  },
});

// =============================================================================
// mi-dorsal — Votos 👍/👎 sobre carreras
// =============================================================================

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser, getOptionalUser } from "./_helpers";

/**
 * Vota en una carrera (👍 o 👎).
 * Si el usuario ya votó, sobreescribe su voto anterior.
 * Solo usuarios autenticados.
 */
export const vote = mutation({
  args: {
    raceId: v.id("races"),
    vote: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const existing = await ctx.db
      .query("raceVotes")
      .withIndex("by_user_race", (q) =>
        q.eq("userId", user._id).eq("raceId", args.raceId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { vote: args.vote });
      return existing._id;
    }
    return await ctx.db.insert("raceVotes", {
      userId: user._id,
      raceId: args.raceId,
      vote: args.vote,
    });
  },
});

/**
 * Quita el voto del usuario en una carrera.
 */
export const unvote = mutation({
  args: { raceId: v.id("races") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("raceVotes")
      .withIndex("by_user_race", (q) =>
        q.eq("userId", user._id).eq("raceId", args.raceId),
      )
      .unique();
    if (!existing) return null;
    await ctx.db.delete(existing._id);
    return existing._id;
  },
});

/**
 * Resumen de votos para una carrera: total de up, down, y net score.
 */
export const summary = query({
  args: { raceId: v.id("races") },
  handler: async (ctx, { raceId }) => {
    const votes = await ctx.db
      .query("raceVotes")
      .withIndex("by_race", (q) => q.eq("raceId", raceId))
      .collect();

    let ups = 0;
    let downs = 0;
    for (const v of votes) {
      if (v.vote === "up") ups++;
      else if (v.vote === "down") downs++;
    }
    return {
      total: votes.length,
      ups,
      downs,
      net: ups - downs,
    };
  },
});

/**
 * Voto del usuario actual en una carrera (null si no ha votado).
 */
export const myVote = query({
  args: { raceId: v.id("races") },
  handler: async (ctx, { raceId }) => {
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    const vote = await ctx.db
      .query("raceVotes")
      .withIndex("by_user_race", (q) =>
        q.eq("userId", user._id).eq("raceId", raceId),
      )
      .unique();
    return vote?.vote ?? null;
  },
});

/**
 * Resumen de votos para múltiples carreras (batch).
 * Útil para la card del catálogo.
 */
export const summaryBatch = query({
  args: { raceIds: v.array(v.id("races")) },
  handler: async (ctx, { raceIds }) => {
    const result: Record<string, { ups: number; downs: number; net: number }> = {};
    for (const id of raceIds) {
      const votes = await ctx.db
        .query("raceVotes")
        .withIndex("by_race", (q) => q.eq("raceId", id))
        .collect();
      let ups = 0, downs = 0;
      for (const v of votes) {
        if (v.vote === "up") ups++;
        else downs++;
      }
      result[id] = { ups, downs, net: ups - downs };
    }
    return result;
  },
});

// =============================================================================
// mi-dorsal — Personal Records
// =============================================================================

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser, getOptionalUser } from "./_helpers";

/**
 * Lista todos los PRs del usuario actual.
 * Devuelve [] si no hay usuario (en vez de throw) para no romper la UI.
 */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("personalRecords")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

/**
 * Upsert de un PR. Marca el antiguo como `isCurrent=false` y el nuevo como true.
 */
export const upsert = mutation({
  args: {
    distanceM: v.number(),
    distanceLabel: v.string(),
    timeSeconds: v.number(),
    achievedAt: v.optional(v.string()),
    raceId: v.optional(v.id("races")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Buscar PR actual para esta distancia
    const current = await ctx.db
      .query("personalRecords")
      .withIndex("by_user_distance_current", (q) =>
        q
          .eq("userId", user._id)
          .eq("distanceM", args.distanceM)
          .eq("isCurrent", true),
      )
      .unique();

    if (current) {
      // Si el nuevo tiempo es peor, no hacer nada
      if (args.timeSeconds >= current.timeSeconds) {
        return current._id;
      }
      // Marcar el antiguo como histórico
      await ctx.db.patch(current._id, { isCurrent: false });
    }

    return await ctx.db.insert("personalRecords", {
      userId: user._id,
      distanceM: args.distanceM,
      distanceLabel: args.distanceLabel,
      timeSeconds: args.timeSeconds,
      achievedAt: args.achievedAt,
      raceId: args.raceId,
      source: "manual",
      isCurrent: true,
    });
  },
});

/**
 * Elimina un PR.
 */
export const remove = mutation({
  args: { id: v.id("personalRecords") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const pr = await ctx.db.get(id);
    if (!pr) throw new Error("PR not found");
    if (pr.userId !== user._id) throw new Error("Forbidden");
    await ctx.db.delete(id);
  },
});

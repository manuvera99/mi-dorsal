// =============================================================================
// mi-dorsal — Personal Records
// =============================================================================

import { v } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { requireUser, getOptionalUser, getDistanceLabel } from "./_helpers";

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

/**
 * PR actual del usuario en una distancia (para emails: detectar si un
 * nuevo resultado bate el récord antes de enviar el email).
 * Devuelve null si no hay PR en esa distancia.
 */
export const getCurrentForUserAndDistance = internalQuery({
  args: {
    userId: v.id("profiles"),
    distanceM: v.number(),
  },
  handler: async (ctx, { userId, distanceM }) => {
    return await ctx.db
      .query("personalRecords")
      .withIndex("by_user_distance_current", (q) =>
        q.eq("userId", userId).eq("distanceM", distanceM).eq("isCurrent", true),
      )
      .unique();
  },
});

/**
 * Versión server-side de `upsert` para usar desde crons.
 * Si el nuevo tiempo mejora el PR actual (o no hay PR), lo persiste.
 * Marca el antiguo como isCurrent=false e inserta el nuevo con source="race_result".
 * Devuelve { updated, previousTimeSeconds } para que el caller sepa si batió récord.
 *
 * Pensado para llamarse DESPUÉS de enviar el email de resultado, para que
 * el email pueda leer el PR "viejo" como referencia y mostrar el badge
 * correctamente (siguiente vez, el PR nuevo ya es el current).
 */
export const updateIfBetter = internalMutation({
  args: {
    userId: v.id("profiles"),
    distanceM: v.number(),
    timeSeconds: v.number(),
    raceId: v.optional(v.id("races")),
    achievedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const current = await ctx.db
      .query("personalRecords")
      .withIndex("by_user_distance_current", (q) =>
        q
          .eq("userId", args.userId)
          .eq("distanceM", args.distanceM)
          .eq("isCurrent", true),
      )
      .unique();

    // Si el nuevo tiempo es igual o peor que el actual, no tocar nada.
    if (current && args.timeSeconds >= current.timeSeconds) {
      return { updated: false, previousTimeSeconds: current.timeSeconds };
    }

    const previousTimeSeconds = current?.timeSeconds;

    if (current) {
      await ctx.db.patch(current._id, { isCurrent: false });
    }

    const id = await ctx.db.insert("personalRecords", {
      userId: args.userId,
      distanceM: args.distanceM,
      distanceLabel: getDistanceLabel(args.distanceM),
      timeSeconds: args.timeSeconds,
      achievedAt: args.achievedAt,
      raceId: args.raceId,
      source: "race_result",
      isCurrent: true,
    });

    return { updated: true, id, previousTimeSeconds };
  },
});

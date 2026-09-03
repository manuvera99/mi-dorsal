// =============================================================================
// mi-dorsal — Predictions queries
// =============================================================================

import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUser, getOptionalUser } from "./_helpers";

/**
 * Historial de predicciones del usuario.
 * Devuelve [] si no hay usuario.
 */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    const preds = await ctx.db
      .query("predictions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    return await Promise.all(
      preds.map(async (p) => {
        const race = await ctx.db.get(p.raceId);
        return { ...p, race };
      }),
    );
  },
});

/**
 * Estadísticas de accuracy del usuario (Ola 2).
 */
export const myAccuracy = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const preds = await ctx.db
      .query("predictions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.neq(q.field("actualTimeSeconds"), undefined))
      .collect();

    if (preds.length === 0) {
      return {
        totalPredictions: 0,
        withResults: 0,
        avgErrorPct: null,
        bestPrediction: null,
        worstPrediction: null,
      };
    }

    const errors = preds
      .map((p) => p.errorPct)
      .filter((e): e is number => e !== undefined);

    return {
      totalPredictions: preds.length,
      withResults: preds.length,
      avgErrorPct:
        errors.length > 0
          ? Math.round(
              (errors.reduce((a, b) => a + b, 0) / errors.length) * 100,
            ) / 100
          : null,
      bestPrediction: preds.reduce((best, p) =>
        Math.abs(p.errorPct ?? Infinity) < Math.abs(best.errorPct ?? Infinity)
          ? p
          : best,
      ),
      worstPrediction: preds.reduce((worst, p) =>
        Math.abs(p.errorPct ?? -Infinity) > Math.abs(worst.errorPct ?? -Infinity)
          ? p
          : worst,
      ),
    };
  },
});

// =============================================================================
// mi-dorsal — Strava export ingest helpers
// =============================================================================
// Queries y mutations internas que la action de ingest necesita pero que
// se mantienen fuera de la action para evitar que se infle el bundle.
// =============================================================================

import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { parseStravaProfileRow, type StravaProfileRow } from "./activities/normalize";

/** Carga un upload por id (uso interno). */
export const getUpload = internalQuery({
  args: { uploadId: v.id("uploads") },
  handler: async (ctx, { uploadId }) => {
    return await ctx.db.get(uploadId);
  },
});

/**
 * Lista carreras publicadas en un rango de fechas (para cross-reference).
 * Devuelve solo los campos mínimos para el matching.
 */
export const listRacesInRange = internalQuery({
  args: {
    fromDateMs: v.number(),
    toDateMs: v.number(),
  },
  handler: async (ctx, { fromDateMs, toDateMs }) => {
    // Convertir ms a strings "YYYY-MM-DD" para el índice by_date
    const fromDate = new Date(fromDateMs);
    const toDate = new Date(toDateMs);
    const fromStr = `${fromDate.getUTCFullYear()}-${String(fromDate.getUTCMonth() + 1).padStart(2, "0")}-${String(fromDate.getUTCDate()).padStart(2, "0")}`;
    const toStr = `${toDate.getUTCFullYear()}-${String(toDate.getUTCMonth() + 1).padStart(2, "0")}-${String(toDate.getUTCDate()).padStart(2, "0")}`;

    // Traer todas las publicadas en ese rango
    const races = await ctx.db
      .query("races")
      .withIndex("by_published_date", (q) =>
        q
          .eq("isPublished", true)
          .gte("startDate", fromStr)
          .lte("startDate", toStr),
      )
      .collect();

    return races;
  },
});

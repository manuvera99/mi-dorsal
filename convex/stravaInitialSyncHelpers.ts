// =============================================================================
// mi-dorsal — Helpers para el sync inicial de Strava
// =============================================================================
// Mutations internas que la action de sync llama para reportar progreso
// y marcarse como completa.
// =============================================================================

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

/** Actualiza lastSyncAt y contadores en el profile. */
export const updateSyncProgress = internalMutation({
  args: {
    profileId: v.id("profiles"),
    lastSyncAt: v.number(),
    processedCount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profileId, {
      stravaLastSyncAt: args.lastSyncAt,
    });
    // No guardamos processedCount en el profile porque no es útil entre
    // sesiones. Está en el log de la action.
  },
});

/** Marca el sync como completo. */
export const markSyncComplete = internalMutation({
  args: {
    profileId: v.id("profiles"),
    totalActivities: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profileId, {
      stravaLastSyncAt: Date.now(),
    });
    console.log(
      `[stravaInitialSync] ✓ sync completo: ${args.totalActivities} actividades para ${args.profileId}`,
    );
  },
});

/** Devuelve la lista de profiles con OAuth conectado (para el cron de webhook subscription). */
export const getOauthConnectedProfiles = internalQuery({
  args: {},
  handler: async (ctx) => {
    // No hay índice por "tiene stravaAccessToken", así que iteramos todos los
    // profiles. En PRO con muchos usuarios esto se debería indexar.
    const profiles = await ctx.db.query("profiles").collect();
    return profiles
      .filter((p) => !!p.stravaAccessToken)
      .map((p) => ({
        profileId: p._id,
        athleteId: p.stravaUserId ?? null,
      }));
  },
});

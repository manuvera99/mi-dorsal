// =============================================================================
// mi-dorsal — Strava webhook handler: queries y mutations internas
// =============================================================================
// Funciones que la action `stravaWebhookHandler.handleEvent` necesita.
// =============================================================================

import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

/** Busca un profile por stravaUserId (athlete id de Strava). */
export const findProfileByAthleteId = internalQuery({
  args: { stravaAthleteId: v.number() },
  handler: async (ctx, { stravaAthleteId }) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_strava_user_id", (q) => q.eq("stravaUserId", stravaAthleteId))
      .unique();
    if (!profile || !profile.stravaAccessToken) return null;
    return {
      profileId: profile._id,
      accessTokenEncrypted: profile.stravaAccessToken,
      refreshTokenEncrypted: profile.stravaRefreshToken,
      expiresAt: profile.stravaTokenExpiresAt,
      athleteId: profile.stravaUserId,
    };
  },
});

/** Borra una actividad por (provider, providerActivityId). */
export const deleteActivity = internalMutation({
  args: { stravaActivityId: v.string() },
  handler: async (ctx, { stravaActivityId }) => {
    // Buscar la actividad por (provider="strava", providerActivityId)
    const activities = await ctx.db
      .query("activities")
      .withIndex("by_provider_activity", (q) =>
        q
          .eq("provider", "strava")
          .eq("providerActivityId", stravaActivityId),
      )
      .collect();
    for (const a of activities) {
      await ctx.db.delete(a._id);
    }
    return { deleted: activities.length };
  },
});

// =============================================================================
// mi-dorsal — Strava OAuth: queries, mutations, gestión de tokens
// =============================================================================
// API pública para el flow OAuth con Strava (Ola 1).
// - saveTokens: guardar tokens cifrados tras el callback
// - disconnectAndPurge: revocar + borrar tokens + borrar actividades OAuth
// - getProfileByClerkId: para que el callback encuentre al user
// - getMyStravaOauthStatus: estado de la conexión (para la UI)
// =============================================================================

import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { requireUser, getOptionalUser } from "./_helpers";

// ---------------------------------------------------------------------------
// Helper interno: refresca el token si está a <5min de expirar
// ---------------------------------------------------------------------------

/**
 * Carga los tokens del usuario y los descifra. Si están a punto de expirar,
 * se le pasa un callback de refresh (implementado en la action).
 *
 * ESTA QUERY SOLO DEVUELVE LOS TOKENS CIFRADOS. El descifrado y refresh
 * se hace en la action que llama.
 */
export const getMyTokensEncrypted = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user.stravaAccessToken) return null;
    return {
      profileId: user._id,
      accessTokenEncrypted: user.stravaAccessToken,
      refreshTokenEncrypted: user.stravaRefreshToken ?? "",
      expiresAt: user.stravaTokenExpiresAt ?? 0,
      athleteId: user.stravaUserId ?? 0,
    };
  },
});

/**
 * Actualiza los tokens (llamado por las actions tras un refresh o revoke).
 */
export const updateTokens = internalMutation({
  args: {
    profileId: v.id("profiles"),
    accessTokenEncrypted: v.string(),
    refreshTokenEncrypted: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profileId, {
      stravaAccessToken: args.accessTokenEncrypted,
      stravaRefreshToken: args.refreshTokenEncrypted,
      stravaTokenExpiresAt: args.expiresAt,
    });
  },
});

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Busca un profile por clerkUserId. Usado por el callback OAuth (que solo
 * tiene el userId de Clerk del state).
 */
export const getProfileByClerkId = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    return await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();
  },
});

/**
 * Guarda los tokens cifrados tras el callback OAuth. Idempotente: si ya
 * había una conexión, actualiza los tokens.
 */
export const saveTokens = mutation({
  args: {
    profileId: v.id("profiles"),
    accessTokenEncrypted: v.string(),
    refreshTokenEncrypted: v.optional(v.string()),
    expiresAt: v.number(),
    athleteId: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Verificar que el profileId coincide con el user autenticado
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Profile not found");
    if (profile.clerkUserId !== identity.subject) {
      throw new Error("Forbidden: profileId no coincide con el usuario");
    }

    await ctx.db.patch(args.profileId, {
      stravaUserId: args.athleteId,
      stravaAccessToken: args.accessTokenEncrypted,
      stravaRefreshToken: args.refreshTokenEncrypted,
      stravaTokenExpiresAt: args.expiresAt,
      stravaScope: "read,activity:read_all",
      stravaConnectedAt: Date.now(),
    });

    return { ok: true };
  },
});

/**
 * Desconecta y borra todas las actividades ingestadas vía OAuth.
 * Las actividades del upload (strava-export) NO se tocan.
 */
export const disconnectAndPurge = mutation({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, { profileId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const profile = await ctx.db.get(profileId);
    if (!profile) throw new Error("Profile not found");
    if (profile.clerkUserId !== identity.subject) {
      throw new Error("Forbidden");
    }

    // 1) Borrar actividades con provider="strava" (OAuth)
    const activities = await ctx.db
      .query("activities")
      .withIndex("by_user_started", (q) => q.eq("userId", profileId))
      .collect();

    let activitiesDeleted = 0;
    for (const act of activities) {
      if (act.provider === "strava") {
        await ctx.db.delete(act._id);
        activitiesDeleted++;
      }
    }

    // 2) Limpiar campos OAuth del profile
    await ctx.db.patch(profileId, {
      stravaUserId: undefined,
      stravaAccessToken: undefined,
      stravaRefreshToken: undefined,
      stravaTokenExpiresAt: undefined,
      stravaScope: undefined,
      stravaConnectedAt: undefined,
      stravaLastSyncAt: undefined,
    });

    return { activitiesDeleted };
  },
});

/**
 * Estado de la conexión OAuth para mostrar en /perfil.
 */
export const getMyStravaOauthStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return null;

    return {
      connected: !!user.stravaAccessToken,
      athleteId: user.stravaUserId ?? null,
      scope: user.stravaScope ?? null,
      connectedAt: user.stravaConnectedAt ?? null,
      lastSyncAt: user.stravaLastSyncAt ?? null,
      tokenExpiresAt: user.stravaTokenExpiresAt ?? null,
    };
  },
});

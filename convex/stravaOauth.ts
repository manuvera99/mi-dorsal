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
import { internal } from "./_generated/api";

// ---------------------------------------------------------------------------
// Helper interno: refresca el token si está a <5min de expirar
// ---------------------------------------------------------------------------

/**
 * Carga los tokens de un perfil y los descifra. Si están a punto de expirar,
 * se le pasa un callback de refresh (implementado en la action).
 *
 * ESTA QUERY SOLO DEVUELVE LOS TOKENS CIFRADOS. El descifrado y refresh
 * se hace en la action que llama.
 *
 * Internal: recibe `profileId` explícito en vez de usar requireUser(ctx),
 * porque la llama stravaInitialSync (una action en background, sin sesión
 * de Clerk adjunta) — requireUser ahí siempre lanzaría "Unauthorized:
 * no user identity" aunque el profileId ya se validó antes de agendar
 * el sync (en triggerSyncNow o en el callback OAuth).
 */
export const getMyTokensEncrypted = internalQuery({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, { profileId }) => {
    const user = await ctx.db.get(profileId);
    if (!user) throw new Error(`Profile ${profileId} no encontrado`);
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
 * tiene el userId de Clerk del state). Query pública porque el cliente
 * también la usa para resolver su propio profile.
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
 *
 * IMPORTANTE: esta mutation NO requiere check de Clerk porque la identidad
 * ya está validada por el state HMAC firmado en el API route que la llama.
 * El API route (callback) verifica el state y resuelve el profileId correcto.
 * Si la llamamos desde el cliente web, el userId de Clerk de la sesión
 * debe coincidir con el profile.clerkUserId (esa verificación la hace el
 * caller; aquí no podemos hacerlo porque el ConvexHttpClient del server
 * no tiene sesión Clerk).
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
    // Verificar que el profile existe (defensivo)
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Profile not found");

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
 *
 * Misma nota que saveTokens: la identidad la valida el API route.
 */
export const disconnectAndPurge = mutation({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, { profileId }) => {
    const profile = await ctx.db.get(profileId);
    if (!profile) throw new Error("Profile not found");

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

/**
 * Dispara manualmente un sync inicial de Strava para el usuario actual.
 * Útil si el usuario quiere forzar la actualización sin tener que
 * desconectar y reconectar.
 *
 * Limitamos a 1 cada 5 minutos para evitar rate limits y abuso.
 */
export const triggerSyncNow = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    if (!user.stravaAccessToken) {
      throw new Error("No tienes Strava conectado");
    }

    // Rate limit: no permitir sync más de 1 vez cada 5 minutos
    const COOLDOWN_MS = 5 * 60 * 1000;
    if (
      user.stravaLastSyncAt &&
      Date.now() - user.stravaLastSyncAt < COOLDOWN_MS
    ) {
      const waitMs = COOLDOWN_MS - (Date.now() - user.stravaLastSyncAt);
      const waitMin = Math.ceil(waitMs / 60000);
      throw new Error(
        `Espera ${waitMin} min antes de sincronizar otra vez`,
      );
    }

    // Programar la action de sync para que se ejecute inmediatamente
    // (las mutations no pueden llamar a actions directamente; hay que
    // pasarlas por el scheduler).
    // La action vive en convex/actions/stravaInitialSync.ts, por lo que
    // su path en el namespace es "actions/stravaInitialSync" (con prefijo).
    await ctx.scheduler.runAfter(
      0,
      (internal as any)["actions/stravaInitialSync"].startInitialSync,
      { profileId: user._id },
    );

    return { ok: true, message: "Sync iniciado en background" };
  },
});

// =============================================================================
// mi-dorsal — Users / Profiles
// =============================================================================

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getOptionalUser, requireUser, requireAdmin } from "./_helpers";

/**
 * Crea o actualiza el profile del usuario autenticado.
 * Se llama desde el frontend tras login (Clerk webhook o useEffect en root).
 */
export const upsertMyProfile = mutation({
  args: {
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    club: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.displayName !== undefined && { displayName: args.displayName }),
        ...(args.avatarUrl !== undefined && { avatarUrl: args.avatarUrl }),
        ...(args.bio !== undefined && { bio: args.bio }),
        ...(args.club !== undefined && { club: args.club }),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("profiles", {
        clerkUserId: identity.subject,
        displayName: args.displayName ?? identity.name ?? identity.email,
        avatarUrl: args.avatarUrl ?? identity.pictureUrl,
        emailResultsEnabled: true,
        emailRemindersEnabled: true,
        emailWeeklyDigestEnabled: true,
      });
    }
  },
});

/**
 * Obtiene el profile del usuario actual.
 */
export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    return await getOptionalUser(ctx);
  },
});

/**
 * Obtiene el profile por clerkUserId (público).
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
 * ⚠️ DEPRECATED — El bootstrap del primer admin está desactivado.
 * Solo los admins existentes pueden promover usuarios (vía setUserRole).
 * Si necesitas reinicializar, crea un nuevo proyecto Convex.
 */
export const bootstrapFirstAdmin = mutation({
  args: {},
  handler: async () => {
    throw new Error("Bootstrap desactivado. Pide a un admin que te promueva.");
  },
});

/**
 * Cambia el rol de un usuario. Solo admins pueden.
 */
export const setUserRole = mutation({
  args: {
    profileId: v.id("profiles"),
    role: v.union(v.literal("user"), v.literal("admin")),
  },
  handler: async (ctx, { profileId, role }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(profileId, { role });
    return profileId;
  },
});

/**
 * Lista todos los profiles (admin).
 */
export const adminListProfiles = query({
  args: {
    search: v.optional(v.string()),
    role: v.optional(v.union(v.literal("user"), v.literal("admin"))),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    let q = ctx.db.query("profiles");
    const all = await q.collect();
    let filtered = all;
    if (args.role) {
      filtered = filtered.filter((p) => p.role === args.role);
    }
    if (args.search) {
      const s = args.search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.displayName ?? "").toLowerCase().includes(s) ||
          p.clerkUserId.toLowerCase().includes(s),
      );
    }
    return filtered.sort((a, b) => (a.displayName ?? "").localeCompare(b.displayName ?? ""));
  },
});

/**
 * Detalle de un profile (admin): incluye PRs, myRaces, votes, ratings.
 */
export const adminGetProfile = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, { profileId }) => {
    await requireAdmin(ctx);
    const profile = await ctx.db.get(profileId);
    if (!profile) return null;
    const [prs, myRaces, votes, ratings] = await Promise.all([
      ctx.db.query("personalRecords").withIndex("by_user", (q) => q.eq("userId", profileId)).collect(),
      ctx.db.query("myRaces").withIndex("by_user", (q) => q.eq("userId", profileId)).collect(),
      ctx.db.query("raceVotes").withIndex("by_user", (q) => q.eq("userId", profileId)).collect(),
      ctx.db.query("raceRatings").withIndex("by_user", (q) => q.eq("userId", profileId)).collect(),
    ]);
    return { profile, prs, myRaces, votes, ratings };
  },
});

/**
 * Stats globales del admin dashboard.
 * OPTIMIZADO: lee de `statsCache` (1 fila ~200 bytes) en vez de hacer
 * .collect() de 7 tablas. La cache la mantiene un cron cada 5 min
 * (ver convex/stats.ts). Reduce Database I/O de ~GB/mes a ~MB/mes.
 *
 * Devuelve zeros si no hay user/admin (en vez de throw).
 */
export const adminGetStats = query({
  args: {},
  handler: async (ctx) => {
    const profile = await getOptionalUser(ctx);
    if (!profile || profile.role !== "admin") {
      // Devuelve estructura vacía para no romper la UI del admin
      return {
        computedAt: 0,
        totalRaces: 0, publishedRaces: 0, featuredRaces: 0,
        totalUsers: 0, adminUsers: 0,
        totalVotes: 0, totalRatings: 0,
        totalMyRaces: 0, totalPRs: 0, totalNotifications: 0,
        racesByProvince: {} as Record<string, number>,
      };
    }
    return await ctx.runQuery(api.stats.getCachedStats, {});
  },
});

/**
 * Stats públicas (sin auth) — para mostrar contadores sin exponer PII.
 * Útil para marketing, dashboard inicial, y para que cualquiera verifique
 * cuántos admins hay sin necesidad de estar logueado.
 *
 * OPTIMIZADO: igual que adminGetStats, lee de statsCache.
 */
export const getPublicStats = query({
  args: {},
  handler: async (ctx) => {
    const stats = await ctx.runQuery(api.stats.getCachedStats, {});
    return {
      totalUsers: stats.totalUsers,
      adminCount: stats.adminUsers,
      totalRaces: stats.totalRaces,
      publishedRaces: stats.publishedRaces,
      totalVotes: stats.totalVotes,
      totalRatings: stats.totalRatings,
      totalMyRaces: stats.totalMyRaces,
    };
  },
});

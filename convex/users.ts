// =============================================================================
// mi-dorsal — Users / Profiles
// =============================================================================

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
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
 * Bootstrap del primer admin: si NO hay admins, el caller se hace admin.
 * Pensado para que el primer usuario del sistema se pueda promover a sí mismo.
 * Después de que exista al menos un admin, hay que usar `setUserRole` con permisos.
 */
export const bootstrapFirstAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // ¿Ya hay algún admin? (escaneo simple, OK para MVP con pocos usuarios)
    const allProfiles = await ctx.db.query("profiles").collect();
    const anyAdmin = allProfiles.find((p) => p.role === "admin");
    if (anyAdmin) {
      throw new Error("Ya existe un admin. Pide a un admin existente que te promueva.");
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!profile) {
      throw new Error("Profile not found. Crea el profile primero con upsertMyProfile.");
    }
    await ctx.db.patch(profile._id, { role: "admin" });
    return profile._id;
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
 */
export const adminGetStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [races, profiles, votes, ratings, myRaces, prs, notifications] = await Promise.all([
      ctx.db.query("races").collect(),
      ctx.db.query("profiles").collect(),
      ctx.db.query("raceVotes").collect(),
      ctx.db.query("raceRatings").collect(),
      ctx.db.query("myRaces").collect(),
      ctx.db.query("personalRecords").collect(),
      ctx.db.query("notificationLog").collect(),
    ]);
    const published = races.filter((r) => r.isPublished).length;
    const featured = races.filter((r) => r.isFeatured).length;
    const admins = profiles.filter((p) => p.role === "admin").length;
    const byProvince: Record<string, number> = {};
    races.forEach((r) => {
      byProvince[r.province] = (byProvince[r.province] || 0) + 1;
    });
    return {
      totalRaces: races.length,
      publishedRaces: published,
      featuredRaces: featured,
      totalUsers: profiles.length,
      adminUsers: admins,
      totalVotes: votes.length,
      totalRatings: ratings.length,
      totalMyRaces: myRaces.length,
      totalPRs: prs.length,
      totalNotifications: notifications.length,
      racesByProvince: byProvince,
    };
  },
});

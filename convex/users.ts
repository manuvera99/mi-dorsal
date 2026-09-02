// =============================================================================
// mi-dorsal — Users / Profiles
// =============================================================================

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getOptionalUser, requireUser } from "./_helpers";

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

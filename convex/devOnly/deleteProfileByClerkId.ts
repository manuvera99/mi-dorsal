// =============================================================================
// mi-dorsal — Dev/admin: deleteProfileByClerkId
// =============================================================================
// BORRA un profile huérfano, migrando antes su contenido al perfil principal
// de Manu (el de manuvera08@gmail.com). Útil para limpiar duplicados de
// Clerk que se generan al cambiar de instancia o reautenticar.
//
// Usar con `npx convex run --deployment precious-goshawk-41
// 'devOnly/deleteProfileByClerkId:deleteProfileByClerkId' '{"clerkUserId":"user_xxx"}'`
//
// Comportamiento:
//   1. Busca el profile por clerkUserId.
//   2. Cuenta su contenido en todas las tablas vinculadas.
//   3. Si hay raceVotes y el perfil destino (manuvera08) NO ha votado esa
//      misma carrera, los migra al perfil destino. Si ya hay un voto del
//      destino en la misma carrera, el voto del duplicado se descarta
//      (no se duplica).
//   4. Borra el profile.
//
// Para otras tablas (activities, PRs, etc.) NO migra automáticamente —
// si las tiene, aborta y pide acción manual.
// =============================================================================

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

const TARGET_CLERK_USER_ID = "user_3IsfuPHklYwXAyl22GQIU5uWli6"; // manuvera08

export const deleteProfileByClerkId = internalMutation({
  args: {
    clerkUserId: v.string(),
    targetClerkUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const targetClerkId = args.targetClerkUserId ?? TARGET_CLERK_USER_ID;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();

    if (!profile) {
      return { success: false, reason: "profile_not_found" as const };
    }

    const target = await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", targetClerkId))
      .unique();

    if (!target) {
      return {
        success: false,
        reason: "target_profile_not_found" as const,
        targetClerkId,
      };
    }

    if (profile._id === target._id) {
      return {
        success: false,
        reason: "source_equals_target" as const,
        profileId: profile._id,
      };
    }

    const userId = profile._id;
    const targetUserId = target._id;

    // 1. Migra raceVotes: solo si el target NO ha votado la misma carrera.
    const dupeVotes = await ctx.db
      .query("raceVotes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let migratedVotes = 0;
    let discardedVotes = 0;
    for (const v of dupeVotes) {
      const existing = await ctx.db
        .query("raceVotes")
        .withIndex("by_user_race", (q) =>
          q.eq("userId", targetUserId).eq("raceId", v.raceId),
        )
        .first();
      if (existing) {
        discardedVotes++;
        await ctx.db.delete(v._id);
        continue;
      }
      await ctx.db.patch(v._id, { userId: targetUserId });
      migratedVotes++;
    }

    // 2. Chequea el resto de tablas. Si tienen contenido, aborta (no migra
    // automáticamente — son tablas más sensibles).
    const otherChecks: Array<[string, any]> = [
      ["myRaces", ctx.db.query("myRaces").withIndex("by_user", (q: any) => q.eq("userId", userId))],
      ["personalRecords", ctx.db.query("personalRecords").withIndex("by_user", (q: any) => q.eq("userId", userId))],
      ["raceRatings", ctx.db.query("raceRatings").withIndex("by_user", (q: any) => q.eq("userId", userId))],
      ["predictions", ctx.db.query("predictions").withIndex("by_user", (q: any) => q.eq("userId", userId))],
      ["activities", ctx.db.query("activities").withIndex("by_user_started", (q: any) => q.eq("userId", userId))],
      ["uploads", ctx.db.query("uploads").withIndex("by_user", (q: any) => q.eq("userId", userId))],
      ["notificationLog", ctx.db.query("notificationLog").withIndex("by_user", (q: any) => q.eq("userId", userId))],
      ["photoSearchJobs", ctx.db.query("photoSearchJobs").withIndex("by_user", (q: any) => q.eq("userId", userId))],
      ["raceCandidates", ctx.db.query("raceCandidates").withIndex("by_user", (q: any) => q.eq("userId", userId))],
      ["raceSuggestions", ctx.db.query("raceSuggestions").withIndex("by_user", (q: any) => q.eq("userId", userId))],
    ];

    const nonEmptyTables: Array<{ table: string; count: number }> = [];
    for (const [table, query] of otherChecks) {
      const rows = await query.collect();
      if (rows.length > 0) nonEmptyTables.push({ table, count: rows.length });
    }

    // clubMemberships usa profileId.
    const memberships = await ctx.db
      .query("clubMemberships")
      .withIndex("by_profile", (q: any) => q.eq("profileId", userId))
      .collect();
    if (memberships.length > 0) nonEmptyTables.push({ table: "clubMemberships", count: memberships.length });

    // subscriptions usa clerkUserId.
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", args.clerkUserId))
      .collect();
    if (subs.length > 0) nonEmptyTables.push({ table: "subscriptions", count: subs.length });

    if (nonEmptyTables.length > 0) {
      return {
        success: false,
        reason: "profile_has_unmigrated_content" as const,
        profileId: userId,
        email: profile.email,
        displayName: profile.displayName,
        nonEmptyTables,
        migratedVotes,
        discardedVotes,
        hint: "Tablas con contenido que NO migran automáticamente. Migrar a mano antes de borrar.",
      };
    }

    // 3. Borra el profile.
    await ctx.db.delete(userId);

    return {
      success: true,
      profileId: userId,
      email: profile.email,
      displayName: profile.displayName,
      deleted: true,
      targetProfileId: targetUserId,
      migratedVotes,
      discardedVotes,
    };
  },
});
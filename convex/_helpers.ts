// =============================================================================
// mi-dorsal — Convex helpers
// =============================================================================

import { v } from "convex/values";
import { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export async function requireUser(
  ctx: QueryCtx | MutationCtx | ActionCtx,
): Promise<Doc<"profiles">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized: no user identity");
  }
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
    .unique();
  if (!profile) {
    throw new Error(`Profile not found for clerkUserId ${identity.subject}`);
  }
  return profile;
}

export async function getOptionalUser(
  ctx: QueryCtx | MutationCtx | ActionCtx,
): Promise<Doc<"profiles"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("profiles")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
    .unique();
}

export function assertOwner<T extends { userId: Id<"profiles"> }>(
  resource: T | null,
  userId: Id<"profiles">,
  resourceName: string,
): asserts resource is T {
  if (!resource) {
    throw new Error(`${resourceName} not found`);
  }
  if (resource.userId !== userId) {
    throw new Error(`Forbidden: ${resourceName} belongs to another user`);
  }
}

// ---------------------------------------------------------------------------
// Validators reusables
// ---------------------------------------------------------------------------

export const provinceValidator = v.union(
  v.literal("alicante"),
  v.literal("valencia"),
  v.literal("castellon"),
  v.literal("murcia"),
  v.literal("albacete"),
  v.literal("almeria"),
);

export const raceTypeValidator = v.union(
  v.literal("road"),
  v.literal("trail"),
  v.literal("mixed"),
  v.literal("obstacle"),
);

export const raceStatusValidator = v.union(
  v.literal("planned"),
  v.literal("done"),
  v.literal("dns"),
  v.literal("dnf"),
);

export const predictionConfidenceValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
);

// ---------------------------------------------------------------------------
// Reusable queries
// ---------------------------------------------------------------------------

export async function getCurrentPR(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"profiles">,
  distanceM: number,
): Promise<Doc<"personalRecords"> | null> {
  return await ctx.db
    .query("personalRecords")
    .withIndex("by_user_distance_current", (q) =>
      q.eq("userId", userId).eq("distanceM", distanceM).eq("isCurrent", true),
    )
    .unique();
}

export async function findClosestPR(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"profiles">,
  targetDistanceM: number,
): Promise<Doc<"personalRecords"> | null> {
  const all = await ctx.db
    .query("personalRecords")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("isCurrent"), true))
    .collect();
  if (all.length === 0) return null;
  return all.reduce((closest, pr) =>
    Math.abs(pr.distanceM - targetDistanceM) <
    Math.abs(closest.distanceM - targetDistanceM)
      ? pr
      : closest,
  );
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[áàäâ]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

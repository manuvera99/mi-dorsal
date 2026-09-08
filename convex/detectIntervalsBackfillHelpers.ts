// =============================================================================
// convex/detectIntervalsBackfillHelpers.ts
// =============================================================================
// Helpers internal (queries + mutations) usados por la action
// actions/detectIntervalsBackfill.ts. Las actions no tienen acceso directo
// a ctx.db, así que paginamos y parchamos vía estas.
// =============================================================================

import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { isRunningSportType } from "./activities/normalize";

export const fetchPage = internalQuery({
  args: {
    userId: v.optional(v.id("profiles")),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.number(),
    onlyRunning: v.boolean(),
  },
  handler: async (ctx, { userId, cursor, batchSize, onlyRunning }) => {
    const q = ctx.db.query("activities");
    const page = await q.paginate({
      cursor: cursor ?? null,
      numItems: batchSize,
    } as any);
    let items = page.page as any[];
    if (userId) {
      items = items.filter((a) => a.userId === userId);
    }
    if (onlyRunning) {
      items = items.filter((a) => isRunningSportType(a.stravaSportType));
    }
    return {
      page: items,
      isDone: page.isDone ?? (page as any).continueCursor === null,
      continueCursor: (page as any).continueCursor ?? null,
    };
  },
});

export const patchOne = internalMutation({
  args: {
    activityId: v.id("activities"),
    detected: v.object({
      isIntervalWorkout: v.boolean(),
      paceVariabilityCv: v.number(),
      fastDeltaSecPerKm: v.number(),
      slowDeltaSecPerKm: v.number(),
      fastSplits: v.number(),
      slowSplits: v.number(),
      estimatedRepetitions: v.number(),
      fastPaceSecPerKm: v.union(v.number(), v.null()),
      slowPaceSecPerKm: v.union(v.number(), v.null()),
      fastAvgHrBpm: v.union(v.number(), v.null()),
      slowAvgHrBpm: v.union(v.number(), v.null()),
      isTrackLike: v.boolean(),
      reason: v.string(),
    }),
  },
  handler: async (ctx, { activityId, detected }) => {
    await ctx.db.patch(activityId, { detectedIntervals: detected });
  },
});

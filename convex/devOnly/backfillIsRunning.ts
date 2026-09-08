// =============================================================================
// mi-dorsal — Dev/admin: backfillIsRunning
// =============================================================================
// One-shot backfill: rellena el campo `isRunning` en todas las activities
// existentes para que las queries de feed/stats puedan usar el índice
// `by_user_running` (filtrar solo running en el índice, no en cliente).
//
// Cómo correrlo (una vez, después del deploy que añade el campo `isRunning`
// y el índice `by_user_running`):
//   npx convex run --prod devOnly/backfillIsRunning:runBackfill '{}'
//
// Idempotente: solo escribe si `isRunning` no está seteado todavía.
// =============================================================================

import { action, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { isRunningSportType } from "../activities/normalize";

const BATCH_SIZE = 200;

export const fetchPage = internalQuery({
  args: {
    cursor: v.union(v.string(), v.null()),
    batchSize: v.number(),
  },
  handler: async (ctx, { cursor, batchSize }) => {
    const result = await ctx.db.query("activities").paginate({ cursor, numItems: batchSize });
    return {
      items: result.page.map((d) => ({
        _id: d._id,
        isRunning: d.isRunning,
        stravaSportType: d.stravaSportType,
      })),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const patchOne = internalMutation({
  args: {
    activityId: v.id("activities"),
    isRunning: v.boolean(),
  },
  handler: async (ctx, { activityId, isRunning }) => {
    await ctx.db.patch(activityId, { isRunning });
  },
});

export const runBackfill = action({
  args: {},
  handler: async (ctx) => {
    let cursor: string | null = null;
    let scanned = 0;
    let updated = 0;
    let skipped = 0;
    let pages = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page: {
        items: Array<{ _id: string; isRunning: boolean | undefined; stravaSportType: string | undefined }>;
        continueCursor: string;
        isDone: boolean;
      } = await ctx.runQuery(internal.devOnly.backfillIsRunning.fetchPage, {
        cursor,
        batchSize: BATCH_SIZE,
      });
      pages++;

      for (const item of page.items) {
        scanned++;
        const isRunning = item.stravaSportType
          ? isRunningSportType(item.stravaSportType)
          : true; // sin sportType → asumimos running (legacy)
        if (item.isRunning === isRunning) {
          skipped++;
          continue;
        }
        await ctx.runMutation(internal.devOnly.backfillIsRunning.patchOne, {
          activityId: item._id as any,
          isRunning,
        });
        updated++;
      }

      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    return { scanned, updated, skipped, pages };
  },
});

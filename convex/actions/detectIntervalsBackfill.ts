// =============================================================================
// convex/actions/detectIntervalsBackfill.ts
// =============================================================================
// Recorre todas las actividades de running de todos los usuarios y rellena
// el campo `detectedIntervals` usando el detector de series basado en
// splitsMetric. Pensado para correr UNA VEZ tras desplegar el schema, o
// para re-correr si ajustamos el detector.
//
// Diferido a action (no mutation) porque puede tardar varios minutos si
// hay muchos miles de actividades. Las mutations tienen un timeout de
// 10s y un máximo de writes por llamada.
// =============================================================================

"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { detectIntervalsFromSplits, type SplitMetric } from "../../lib/training/detect-intervals";

const BATCH_SIZE = 200;

export const runBackfill = action({
  args: {
    /** Si se pasa, procesa solo este usuario. Si no, todos. */
    userId: v.optional(v.id("profiles")),
    /** Si true, re-calcula aunque detectedIntervals ya exista. */
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{
    scanned: number;
    updated: number;
    detectedAsIntervals: number;
    skipped: number;
    errors: number;
  }> => {
    const force = args.force ?? false;
    let cursor: string | null = null;
    let scanned = 0;
    let updated = 0;
    let detectedAsIntervals = 0;
    let skipped = 0;
    let errors = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page: { page: unknown[]; isDone: boolean; continueCursor: string } =
        await ctx.runQuery(internal.detectIntervalsBackfillHelpers.fetchPage, {
          userId: args.userId,
          cursor,
          batchSize: BATCH_SIZE,
          onlyRunning: true,
        });

      for (const act of page.page as Array<{
        _id: string;
        userId: string;
        splitsMetric: SplitMetric[] | null | undefined;
        detectedIntervals: unknown | null | undefined;
      }>) {
        scanned++;
        try {
          if (!force && act.detectedIntervals) {
            skipped++;
            continue;
          }
          const result = detectIntervalsFromSplits(act.splitsMetric);
          await ctx.runMutation(internal.detectIntervalsBackfillHelpers.patchOne, {
            activityId: act._id as any,
            detected: result,
          });
          updated++;
          if (result.isIntervalWorkout) detectedAsIntervals++;
        } catch (e) {
          errors++;
          // eslint-disable-next-line no-console
          console.error(`[detectIntervalsBackfill] activity ${act._id} failed:`, e);
        }
      }

      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    return { scanned, updated, detectedAsIntervals, skipped, errors };
  },
});

// =============================================================================
// convex/detectIntervalsBackfill.ts
// =============================================================================
// Recorre todas las actividades de running y rellena el campo
// `detectedIntervals` usando el detector de series basado en splits por km
// + elevación + loop start/end (pista de Atletismo como precondición).
//
// Pensado para correr UNA VEZ tras desplegar el schema, o para re-correr
// si ajustamos el detector.
//
// Sin "use node" para que corra en V8 isolate y sea invocable sin
// autenticación desde el endpoint admin de Vercel (que valida un secret
// en el header x-admin-secret).
// =============================================================================

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  detectIntervalsFromSplits,
  type SplitMetric,
} from "../lib/training/detect-intervals";

const BATCH_SIZE = 200;

interface RawStravaDetail {
  start_latlng?: [number, number] | null;
  end_latlng?: [number, number] | null;
  total_elevation_gain?: number | null;
}

function loopDistanceM(detail: RawStravaDetail | null | undefined): number | null {
  if (!detail) return null;
  const start = detail.start_latlng;
  const end = detail.end_latlng;
  if (!start || !end || start.length < 2 || end.length < 2) return null;
  const lat1 = (start[0] * Math.PI) / 180;
  const dx = (end[0] - start[0]) * 111000;
  const dy = (end[1] - start[1]) * 111000 * Math.cos(lat1);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Variante admin sin auth: solo callable desde el endpoint
 * app/api/admin/detect-intervals-backfill. Pensada para correr el backfill
 * desde la terminal con Invoke-WebRequest (que SÍ maneja bien el JSON
 * en el body, a diferencia de PowerShell + npx convex CLI que se come
 * las comillas del JSON en Windows).
 */
export const runBackfill = action({
  args: {
    userId: v.optional(v.id("profiles")),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
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
        name: string | undefined;
        splitsMetric: SplitMetric[] | null | undefined;
        stravaSportType: string | undefined;
        elevationGainM: number | undefined;
        rawStravaDetail: RawStravaDetail | null | undefined;
        detectedIntervals: unknown | null | undefined;
      }>) {
        scanned++;
        try {
          if (!force && act.detectedIntervals) {
            skipped++;
            continue;
          }
          const loop = loopDistanceM(act.rawStravaDetail);
          const result = detectIntervalsFromSplits({
            splits: act.splitsMetric,
            totalElevationGainM: act.elevationGainM,
            startEndLoopM: loop,
            activityName: act.name,
            sportType: act.stravaSportType,
          });
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

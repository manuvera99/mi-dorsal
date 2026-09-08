// =============================================================================
// convex/actions/detectIntervalsBackfill.ts
// =============================================================================
// Recorre todas las actividades de running y rellena el campo
// `detectedIntervals` usando el detector de series basado en splitsMetric.
// Pensado para correr UNA VEZ tras desplegar el schema, o para re-correr
// si ajustamos el detector.
//
// Diferido a action (no mutation) porque puede tardar varios minutos si
// hay muchos miles de actividades. Las mutations tienen un timeout de
// 10s y un máximo de writes por llamada.
//
// Nota: SIN "use node" para que corra en V8 isolate y sea invocable sin
// autenticación desde el endpoint admin de Vercel. La función de
// detección no usa nada específico de Node.
// =============================================================================

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";

const BATCH_SIZE = 200;

// Inline del detector (en lugar de importar lib/training/detect-intervals)
// para mantener la action portable en V8 isolate.
interface SplitMetric {
  split: number;
  distance: number;
  elapsed_time: number;
  moving_time: number;
  elevation_difference: number;
  average_speed: number;
  average_heartrate?: number;
  average_cadence?: number;
}

interface DetectedIntervals {
  isIntervalWorkout: boolean;
  paceVariabilityCv: number;
  fastSplits: number;
  slowSplits: number;
  estimatedRepetitions: number;
  fastPaceSecPerKm: number | null;
  slowPaceSecPerKm: number | null;
  fastAvgHrBpm: number | null;
  slowAvgHrBpm: number | null;
  reason: string;
}

const FAST_THRESHOLD = 0.9;
const SLOW_THRESHOLD = 1.1;
const CV_THRESHOLD = 0.15;
const MIN_SPLITS = 6;

function detectIntervalsFromSplits(
  splits: SplitMetric[] | null | undefined,
): DetectedIntervals {
  const empty: DetectedIntervals = {
    isIntervalWorkout: false,
    paceVariabilityCv: 0,
    fastSplits: 0,
    slowSplits: 0,
    estimatedRepetitions: 0,
    fastPaceSecPerKm: null,
    slowPaceSecPerKm: null,
    fastAvgHrBpm: null,
    slowAvgHrBpm: null,
    reason: "sin splits",
  };
  if (!splits || splits.length < MIN_SPLITS) {
    return { ...empty, reason: `solo ${splits?.length ?? 0} splits (mín ${MIN_SPLITS})` };
  }
  const paces = splits
    .filter((s) => s.distance > 0 && s.moving_time > 0)
    .map((s) => s.moving_time / (s.distance / 1000));
  if (paces.length < MIN_SPLITS) return { ...empty, reason: "splits con datos insuficientes" };

  const mean = paces.reduce((a, b) => a + b, 0) / paces.length;
  const variance = paces.reduce((a, b) => a + (b - mean) ** 2, 0) / paces.length;
  const cv = Math.sqrt(variance) / mean;

  const fastIndices: number[] = [];
  const slowIndices: number[] = [];
  splits.forEach((s, i) => {
    if (s.distance <= 0 || s.moving_time <= 0) return;
    const pace = s.moving_time / (s.distance / 1000);
    if (pace < mean * FAST_THRESHOLD) fastIndices.push(i);
    else if (pace > mean * SLOW_THRESHOLD) slowIndices.push(i);
  });

  const isIntervalWorkout =
    cv > CV_THRESHOLD &&
    fastIndices.length >= 2 &&
    slowIndices.length >= 2;

  const fastPaceSecPerKm = fastIndices.length > 0
    ? meanOf(fastIndices.map((i) => splits[i].moving_time / (splits[i].distance / 1000)))
    : null;
  const slowPaceSecPerKm = slowIndices.length > 0
    ? meanOf(slowIndices.map((i) => splits[i].moving_time / (splits[i].distance / 1000)))
    : null;

  const fastHrValues = fastIndices
    .map((i) => splits[i].average_heartrate)
    .filter((h): h is number => typeof h === "number" && h > 0);
  const slowHrValues = slowIndices
    .map((i) => splits[i].average_heartrate)
    .filter((h): h is number => typeof h === "number" && h > 0);

  return {
    isIntervalWorkout,
    paceVariabilityCv: Number(cv.toFixed(4)),
    fastSplits: fastIndices.length,
    slowSplits: slowIndices.length,
    estimatedRepetitions: Math.min(fastIndices.length, slowIndices.length),
    fastPaceSecPerKm: fastPaceSecPerKm !== null ? Number(fastPaceSecPerKm.toFixed(1)) : null,
    slowPaceSecPerKm: slowPaceSecPerKm !== null ? Number(slowPaceSecPerKm.toFixed(1)) : null,
    fastAvgHrBpm: fastHrValues.length > 0 ? Math.round(meanOf(fastHrValues)) : null,
    slowAvgHrBpm: slowHrValues.length > 0 ? Math.round(meanOf(slowHrValues)) : null,
    reason: isIntervalWorkout
      ? `CV=${(cv * 100).toFixed(0)}% > ${CV_THRESHOLD * 100}%, fast=${fastIndices.length}, slow=${slowIndices.length}`
      : `CV=${(cv * 100).toFixed(0)}% (umbral ${CV_THRESHOLD * 100}%), fast=${fastIndices.length}, slow=${slowIndices.length}`,
  };
}

function meanOf(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Variante admin sin auth: solo callable desde el endpoint
 * app/api/admin/detect-intervals-backfill. Piensa para correr el backfill
 * desde la terminal con `Invoke-WebRequest` (que SÍ maneja bien el JSON
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

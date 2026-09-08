// =============================================================================
// mi-dorsal — Helpers internos para el análisis del entrenador IA
// =============================================================================
// Queries/mutations internal que usa convex/actions/coachAnalysis.ts. Las
// actions no tienen ctx.db directo, así que estas hacen el trabajo de lectura
// y escritura contra la base de datos.
// =============================================================================

import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { deriveInputs, computeRunnerType, type ActivityInput } from "./runnerType";
import { isRunningSportType } from "./activities/normalize";

export const getProfileByClerkId = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    return await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();
  },
});

/**
 * Reúne todos los datos que necesita el prompt del entrenador: stats
 * agregadas (deriveInputs de runnerType.ts), tags de tipo de corredor, PRs
 * actuales, perfil del usuario (edad, peso, FC en reposo) y resumen de las
 * series detectadas en los últimos 90 días.
 *
 * Solo cuenta actividades de running (ver isRunningSportType).
 */
export const getAnalysisInputs = internalQuery({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, { profileId }) => {
    const allActivitiesRaw = await ctx.db
      .query("activities")
      .withIndex("by_user_started", (q) => q.eq("userId", profileId))
      .collect();
    const activities = allActivitiesRaw.filter((a) => isRunningSportType(a.stravaSportType));

    // ---------------------------------------------------------------------
    // Series detectadas (campo detectedIntervals, calculado en el ingest
    // y/o por el backfill). Cogemos las 3 más recientes de los últimos 90
    // días para que el LLM las pueda citar con detalle.
    // ---------------------------------------------------------------------
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const intervalActivities = activities
      .filter(
        (a) =>
          a.detectedIntervals?.isIntervalWorkout &&
          a.startedAt >= ninetyDaysAgo,
      )
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 3);

    const intervalExamples = intervalActivities.map((a) => ({
      date: new Date(a.startedAt).toISOString().slice(0, 10),
      distanceKm: Math.round((a.distanceM / 1000) * 10) / 10,
      fastPaceSecPerKm: a.detectedIntervals?.fastPaceSecPerKm ?? null,
      slowPaceSecPerKm: a.detectedIntervals?.slowPaceSecPerKm ?? null,
      repetitions: a.detectedIntervals?.estimatedRepetitions ?? 0,
      fastAvgHrBpm: a.detectedIntervals?.fastAvgHrBpm ?? null,
      slowAvgHrBpm: a.detectedIntervals?.slowAvgHrBpm ?? null,
      isTrackLike: a.detectedIntervals?.isTrackLike ?? false,
      fastDeltaSecPerKm: a.detectedIntervals?.fastDeltaSecPerKm ?? 0,
    }));

    // Calculamos el ratio REAL de series sobre el total running, basado en
    // la detección. Esto sustituye al intervalRatio de deriveInputs (que
    // solo se basaba en workoutType de Strava y siempre era 0).
    const detectedIntervalsCount = activities.filter(
      (a) => a.detectedIntervals?.isIntervalWorkout,
    ).length;
    const detectedIntervalRatio =
      activities.length > 0 ? detectedIntervalsCount / activities.length : 0;

    const inputs: ActivityInput[] = activities.map((a) => ({
      type: a.type,
      startedAt: a.startedAt,
      distanceM: a.distanceM,
      durationSec: a.durationSec,
      elevationGainM: a.elevationGainM,
      avgHeartRate: a.avgHeartRate,
      avgCadence: a.avgCadence,
    }));

    const derived = deriveInputs(inputs);
    const runnerType = computeRunnerType(inputs);

    const prs = await ctx.db
      .query("personalRecords")
      .withIndex("by_user", (q) => q.eq("userId", profileId))
      .collect();
    const currentPrs = prs
      .filter((p) => p.isCurrent)
      .sort((a, b) => a.distanceM - b.distanceM)
      .map((p) => ({
        distanceLabel: p.distanceLabel,
        timeSeconds: p.timeSeconds,
        achievedAt: p.achievedAt,
      }));

    // ---------------------------------------------------------------------
    // Perfil del usuario: edad, peso, FC en reposo (lo que el prompt del
    // entrenador necesita para personalizar el análisis).
    // ---------------------------------------------------------------------
    const profile = await ctx.db.get(profileId);
    const age = profile?.birthDate
      ? Math.floor(
          (Date.now() - new Date(profile.birthDate).getTime()) /
            (365.25 * 24 * 60 * 60 * 1000),
        )
      : null;
    const weightKg = profile?.stravaAthleteWeightKg ?? null;
    const restingHrBpm = profile?.stravaAthleteRestHr ?? null;
    const maxHrBpm = profile?.stravaAthleteMaxHr ?? null;

    return {
      totalActivities: derived.totalActivities,
      totalDistanceKm: derived.totalDistanceKm,
      weeklyVolumeMedianKm: derived.weeklyVolumeMedianKm,
      consistencyPct: derived.consistencyPct,
      avgCadenceSpm: derived.avgCadenceSpm,
      elevationPerKm: derived.elevationPerKm,
      trailRatio: derived.trailRatio,
      raceRatio: derived.raceRatio,
      longestRunKm: derived.longestRunM / 1000,
      estimated10KTimeSec: derived.estimated10KTimeSec,
      intervalRatio: derived.intervalRatio,
      // Nuevo: ratio REAL de series basado en detección por splits.
      detectedIntervalRatio,
      detectedIntervalsCount,
      easyRatio: derived.easyRatio,
      weeksActive: derived.weeksActive,
      isNewbie: derived.isNewbie,
      paceVariability: derived.paceVariability,
      runnerTypeTags: runnerType.tags,
      personalRecords: currentPrs,
      // Perfil
      age,
      weightKg,
      restingHrBpm,
      maxHrBpm,
      // Series: hasta 3 ejemplos recientes para que el LLM los cite
      intervalExamples,
    };
  },
});

export const saveAnalysis = internalMutation({
  args: {
    profileId: v.id("profiles"),
    text: v.string(),
    generatedAt: v.number(),
  },
  handler: async (ctx, { profileId, text, generatedAt }) => {
    await ctx.db.patch(profileId, {
      coachAnalysisText: text,
      coachAnalysisAt: generatedAt,
    });
  },
});

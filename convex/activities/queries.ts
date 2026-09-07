// =============================================================================
// mi-dorsal — Activities queries
// =============================================================================
// Queries para el feed y stats de actividades del usuario autenticado.
// =============================================================================

import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireUser, getOptionalUser } from "../_helpers";
import { computeRunnerType, type ActivityInput, type RunnerTypeResult } from "../runnerType";
import { isRunningSportType } from "./normalize";

// ---------------------------------------------------------------------------
// Feed de actividades
// ---------------------------------------------------------------------------

/**
 * Lista las actividades del usuario actual con paginación y filtros opcionales.
 */
export const listMyActivities = query({
  args: {
    limit: v.optional(v.number()),
    type: v.optional(
      v.union(
        v.literal("race"),
        v.literal("long_run"),
        v.literal("tempo"),
        v.literal("interval"),
        v.literal("easy"),
        v.literal("recovery"),
        v.literal("trail"),
      ),
    ),
    afterMs: v.optional(v.number()), // actividades con startedAt < afterMs (para paginación cursor)
  },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];

    const limit = Math.min(args.limit ?? 50, 200);

    // Query con índice by_user_started (userId, startedAt desc implícito)
    const all = await ctx.db
      .query("activities")
      .withIndex("by_user_started", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    // Filtro "solo running": Strava ingiere cualquier deporte (pádel,
    // ciclismo, esquí, pesas...) bajo el mismo endpoint — sin esto, el feed
    // muestra actividades que no son correr.
    const runningOnly = all.filter((a) => isRunningSportType(a.stravaSportType));

    let filtered = runningOnly;
    if (args.type) {
      filtered = filtered.filter((a) => a.type === args.type);
    }
    if (args.afterMs !== undefined) {
      filtered = filtered.filter((a) => a.startedAt < args.afterMs!);
    }

    return filtered.slice(0, limit);
  },
});

/**
 * Cuenta el total de actividades de RUNNING del usuario (excluye otros
 * deportes que Strava haya ingerido bajo el mismo perfil).
 */
export const getMyActivityCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return 0;
    const all = await ctx.db
      .query("activities")
      .withIndex("by_user_started", (q) => q.eq("userId", user._id))
      .collect();
    return all.filter((a) => isRunningSportType(a.stravaSportType)).length;
  },
});

/**
 * Stats resumen del usuario: total km, km/semana, cadencia media, etc.
 * Calculado on-the-fly (las queries son baratas, ~500ms para 1000 act).
 * Solo cuenta actividades de running — ver isRunningSportType.
 */
export const getMyActivityStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return null;

    const allRaw = await ctx.db
      .query("activities")
      .withIndex("by_user_started", (q) => q.eq("userId", user._id))
      .collect();
    const activities = allRaw.filter((a) => isRunningSportType(a.stravaSportType));

    if (activities.length === 0) {
      return {
        totalActivities: 0,
        totalDistanceKm: 0,
        weeklyVolumeMedianKm: 0,
        consistencyPct: 0,
        avgCadenceSpm: null,
        byType: {} as Record<string, number>,
        byProvider: {} as Record<string, number>,
      };
    }

    // Calcular stats
    const distances = activities.map((a) => a.distanceM).sort((a, b) => a - b);
    const medianDistance = distances[Math.floor(distances.length / 2)];
    const totalDistanceM = activities.reduce((s, a) => s + a.distanceM, 0);

    // Volumen semanal
    const weeklyTotals = new Map<number, number>();
    for (const a of activities) {
      const d = new Date(a.startedAt);
      const week = d.getUTCFullYear() * 100 + Math.ceil((((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000) + 1) / 7);
      weeklyTotals.set(week, (weeklyTotals.get(week) ?? 0) + a.distanceM / 1000);
    }
    const weeklyVolumes = Array.from(weeklyTotals.values()).sort((a, b) => a - b);
    const weeklyVolumeMedianKm = weeklyVolumes[Math.floor(weeklyVolumes.length / 2)] ?? 0;

    // Consistencia
    const sortedByDate = [...activities].sort((a, b) => a.startedAt - b.startedAt);
    const firstMs = sortedByDate[0].startedAt;
    const lastMs = sortedByDate[sortedByDate.length - 1].startedAt;
    const totalDays = Math.max(1, (lastMs - firstMs) / (24 * 60 * 60 * 1000));
    const uniqueDays = new Set(
      activities.map((a) => new Date(a.startedAt).toDateString()),
    ).size;
    const consistencyPct = Math.min(1, uniqueDays / totalDays);

    // Cadencia media (solo easy + long_run + recovery)
    const easyLike = activities.filter(
      (a) => a.type === "easy" || a.type === "long_run" || a.type === "recovery",
    );
    const cadences = easyLike
      .map((a) => a.avgCadence)
      .filter((c): c is number => c !== undefined && c > 0);
    const avgCadenceSpm = cadences.length > 0
      ? cadences.sort((a, b) => a - b)[Math.floor(cadences.length / 2)]
      : null;

    // Por tipo
    const byType: Record<string, number> = {};
    for (const a of activities) {
      byType[a.type] = (byType[a.type] ?? 0) + 1;
    }

    // Por provider
    const byProvider: Record<string, number> = {};
    for (const a of activities) {
      byProvider[a.provider] = (byProvider[a.provider] ?? 0) + 1;
    }

    return {
      totalActivities: activities.length,
      totalDistanceKm: totalDistanceM / 1000,
      weeklyVolumeMedianKm,
      consistencyPct,
      avgCadenceSpm,
      medianDistanceM: medianDistance,
      byType,
      byProvider,
      firstActivityAt: firstMs,
      lastActivityAt: lastMs,
    };
  },
});

/**
 * Calcula el tipo de corredor del usuario actual.
 * Calcula on-the-fly cada vez (las heurísticas son baratas, ~200ms para 1000 act).
 * Si en el futuro el cálculo se vuelve pesado, podemos cachearlo en el profile.
 * Solo cuenta actividades de running — ver isRunningSportType.
 */
export const getMyRunnerType = query({
  args: {},
  handler: async (ctx): Promise<RunnerTypeResult | null> => {
    const user = await getOptionalUser(ctx);
    if (!user) return null;

    const allRaw = await ctx.db
      .query("activities")
      .withIndex("by_user_started", (q) => q.eq("userId", user._id))
      .collect();
    const activities = allRaw.filter((a) => isRunningSportType(a.stravaSportType));

    // Mapear a ActivityInput
    const inputs: ActivityInput[] = activities.map((a) => ({
      type: a.type,
      startedAt: a.startedAt,
      distanceM: a.distanceM,
      durationSec: a.durationSec,
      elevationGainM: a.elevationGainM,
      avgHeartRate: a.avgHeartRate,
      avgCadence: a.avgCadence,
    }));

    return computeRunnerType(inputs);
  },
});

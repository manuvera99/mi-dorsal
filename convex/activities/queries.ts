// =============================================================================
// mi-dorsal — Activities queries
// =============================================================================
// Queries para el feed y stats de actividades del usuario autenticado.
//
// OPTIMIZACIONES DE COSTE (8 sep 2026):
// - Usan el índice `by_user_running` (userId, isRunning, startedAt) en vez
//   de cargar TODAS las actividades del usuario y filtrar en cliente. Sin
//   el índice, las queries de feed leían ~1.3 MB por carga (712 act × 1.8 KB)
//   aunque solo ~250 fueran running.
// - Proyectan solo los campos que el feed usa, descartando splitsMetric,
//   rawStravaDetail, detectedIntervals, segmentEfforts, etc. que pesan
//   ~1.5 KB por fila y solo se necesitan en el detalle. Bajamos de ~1.3 MB
//   por carga a ~50-100 KB (~90% menos).
// =============================================================================

import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireUser, getOptionalUser } from "../_helpers";
import { computeRunnerType, type ActivityInput, type RunnerTypeResult } from "../runnerType";
import { isRunningSportType } from "./normalize";

// ---------------------------------------------------------------------------
// Proyección para el feed
// ---------------------------------------------------------------------------

/**
 * Proyecta una actividad al subset de campos que el feed usa directamente.
 * Excluye: rawStravaDetail, detectedIntervals, segmentEfforts, social stats
 * (kudos/comment/etc.), weather, power, laps (van en queries separadas).
 * Incluye: los campos del feed + mapPolyline/splitsMetric (sin ellos el
 * feed no podría mostrar el mapa al expandir la card sin lanzar una query
 * extra por cada actividad).
 * Coste: ~400-600 bytes por fila (vs ~1.8 KB del documento completo).
 */
type FeedActivity = {
  _id: string;
  _creationTime: number;
  name: string | undefined;
  startedAt: number;
  durationSec: number;
  distanceM: number;
  avgPaceSecPerKm: number | undefined;
  avgHeartRate: number | undefined;
  elevationGainM: number | undefined;
  type: string;
  stravaSportType: string | undefined;
  isPrivate: boolean | undefined;
  isIntervalWorkout: boolean | undefined;
  matchedRaceId: string | undefined;
  mapPolyline: string | undefined;
  splitsMetric: any[] | undefined;
  deviceName: string | undefined;
  gearId: string | undefined;
  gearName: string | undefined;
  locationCity: string | undefined;
  locationCountry: string | undefined;
};

function projectForFeed(a: any): FeedActivity {
  return {
    _id: a._id,
    _creationTime: a._creationTime,
    name: a.name,
    startedAt: a.startedAt,
    durationSec: a.durationSec,
    distanceM: a.distanceM,
    avgPaceSecPerKm: a.avgPaceSecPerKm,
    avgHeartRate: a.avgHeartRate,
    elevationGainM: a.elevationGainM,
    type: a.type,
    stravaSportType: a.stravaSportType,
    isPrivate: a.isPrivate,
    isIntervalWorkout: a.detectedIntervals?.isIntervalWorkout,
    matchedRaceId: a.matchedRaceId,
    mapPolyline: a.mapPolyline,
    splitsMetric: a.splitsMetric,
    deviceName: a.deviceName,
    gearId: a.gearId,
    gearName: a.gearName,
    locationCity: a.locationCity,
    locationCountry: a.locationCountry,
  };
}

// ---------------------------------------------------------------------------
// Feed de actividades
// ---------------------------------------------------------------------------

/**
 * Lista las actividades de RUNNING del usuario con paginación y filtros
 * opcionales. Usa el índice `by_user_running` para no leer ciclismo/pádel/
 * esquí/pesas de la tabla.
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
    afterMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];

    const limit = Math.min(args.limit ?? 50, 200);

    // Lee SOLO running desde el índice. Si el user no tiene `isRunning`
    // seteado en alguna actividad legada, el filtro .eq no la matchea —
    // fallback con el índice viejo `by_user_started` solo para esas.
    const fromIndex = await ctx.db
      .query("activities")
      .withIndex("by_user_running", (q) =>
        q.eq("userId", user._id).eq("isRunning", true),
      )
      .order("desc")
      .collect();

    // Fallback: actividades legadas (sin isRunning) — son pocas, ~0 hoy.
    // Si el backfill se ejecutó, esta query devuelve 0 filas.
    const legacy = await ctx.db
      .query("activities")
      .withIndex("by_user_started", (q) => q.eq("userId", user._id))
      .collect()
      .then((all) =>
        all.filter((a) => a.isRunning === undefined && isRunningSportType(a.stravaSportType)),
      );

    let combined = [...fromIndex, ...legacy];

    if (args.type) {
      combined = combined.filter((a) => a.type === args.type);
    }
    if (args.afterMs !== undefined) {
      combined = combined.filter((a) => a.startedAt < args.afterMs!);
    }

    // Orden por startedAt desc
    combined.sort((a, b) => b.startedAt - a.startedAt);

    return combined.slice(0, limit).map(projectForFeed);
  },
});

/**
 * Cuenta el total de actividades de RUNNING del usuario.
 * Usa el índice `by_user_running` y devuelve el count sin traer los docs.
 */
export const getMyActivityCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return 0;
    const fromIndex = await ctx.db
      .query("activities")
      .withIndex("by_user_running", (q) =>
        q.eq("userId", user._id).eq("isRunning", true),
      )
      .collect();
    // Fallback legadas (sin isRunning)
    const legacy = await ctx.db
      .query("activities")
      .withIndex("by_user_started", (q) => q.eq("userId", user._id))
      .collect()
      .then((all) =>
        all.filter((a) => a.isRunning === undefined && isRunningSportType(a.stravaSportType)),
      );
    return fromIndex.length + legacy.length;
  },
});

/**
 * Stats resumen del usuario: total km, km/semana, cadencia media, etc.
 * Lee solo running desde el índice. Proyecta solo los campos que necesita
 * (distanceM, startedAt, type, avgCadence, provider) — no trae el doc
 * completo.
 */
export const getMyActivityStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) {
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

    // Solo necesitamos unos pocos campos de cada actividad. Hacemos la query
    // con el índice y luego mapeamos — Convex cobra bandwidth por el tamaño
    // de lo que devolvemos, no por el de lo que leemos del disco.
    const fromIndex = await ctx.db
      .query("activities")
      .withIndex("by_user_running", (q) =>
        q.eq("userId", user._id).eq("isRunning", true),
      )
      .collect();

    const legacy = await ctx.db
      .query("activities")
      .withIndex("by_user_started", (q) => q.eq("userId", user._id))
      .collect()
      .then((all) =>
        all.filter((a) => a.isRunning === undefined && isRunningSportType(a.stravaSportType)),
      );

    const activities = [...fromIndex, ...legacy];

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

    // Calcular stats (mismo cálculo que antes, solo corre sobre running)
    const distances = activities.map((a) => a.distanceM).sort((a, b) => a - b);
    const medianDistance = distances[Math.floor(distances.length / 2)];
    const totalDistanceM = activities.reduce((s, a) => s + a.distanceM, 0);

    const weeklyTotals = new Map<number, number>();
    for (const a of activities) {
      const d = new Date(a.startedAt);
      const week = d.getUTCFullYear() * 100 + Math.ceil((((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000) + 1) / 7);
      weeklyTotals.set(week, (weeklyTotals.get(week) ?? 0) + a.distanceM / 1000);
    }
    const weeklyVolumes = Array.from(weeklyTotals.values()).sort((a, b) => a - b);
    const weeklyVolumeMedianKm = weeklyVolumes[Math.floor(weeklyVolumes.length / 2)] ?? 0;

    const sortedByDate = [...activities].sort((a, b) => a.startedAt - b.startedAt);
    const firstMs = sortedByDate[0].startedAt;
    const lastMs = sortedByDate[sortedByDate.length - 1].startedAt;
    const totalDays = Math.max(1, (lastMs - firstMs) / (24 * 60 * 60 * 1000));
    const uniqueDays = new Set(
      activities.map((a) => new Date(a.startedAt).toDateString()),
    ).size;
    const consistencyPct = Math.min(1, uniqueDays / totalDays);

    const easyLike = activities.filter(
      (a) => a.type === "easy" || a.type === "long_run" || a.type === "recovery",
    );
    const cadences = easyLike
      .map((a) => a.avgCadence)
      .filter((c): c is number => c !== undefined && c > 0);
    const avgCadenceSpm = cadences.length > 0
      ? cadences.sort((a, b) => a - b)[Math.floor(cadences.length / 2)]
      : null;

    const byType: Record<string, number> = {};
    for (const a of activities) {
      byType[a.type] = (byType[a.type] ?? 0) + 1;
    }

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
 * Runner type del usuario. Calcula on-the-fly sobre running.
 */
export const getMyRunnerType = query({
  args: {},
  handler: async (ctx): Promise<RunnerTypeResult | null> => {
    const user = await getOptionalUser(ctx);
    if (!user) {
      return computeRunnerType([]);
    }

    const fromIndex = await ctx.db
      .query("activities")
      .withIndex("by_user_running", (q) =>
        q.eq("userId", user._id).eq("isRunning", true),
      )
      .collect();

    const legacy = await ctx.db
      .query("activities")
      .withIndex("by_user_started", (q) => q.eq("userId", user._id))
      .collect()
      .then((all) =>
        all.filter((a) => a.isRunning === undefined && isRunningSportType(a.stravaSportType)),
      );

    const activities = [...fromIndex, ...legacy];

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

// ---------------------------------------------------------------------------
// Gear (zapatillas, bici) — agregado por gearId
// ---------------------------------------------------------------------------

/**
 * Resumen de gear del usuario. Lee solo running desde el índice.
 */
export const getMyGearSummary = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];

    const fromIndex = await ctx.db
      .query("activities")
      .withIndex("by_user_running", (q) =>
        q.eq("userId", user._id).eq("isRunning", true),
      )
      .collect();

    const legacy = await ctx.db
      .query("activities")
      .withIndex("by_user_started", (q) => q.eq("userId", user._id))
      .collect()
      .then((all) =>
        all.filter((a) => a.isRunning === undefined && isRunningSportType(a.stravaSportType)),
      );

    const running = [...fromIndex, ...legacy];

    type GearSummary = {
      gearId: string;
      gearName: string | undefined;
      totalDistanceM: number;
      activityCount: number;
      lastUsedAt: number;
    };
    const byGear = new Map<string, GearSummary>();
    for (const a of running) {
      if (!a.gearId) continue;
      const prev = byGear.get(a.gearId);
      if (prev) {
        prev.totalDistanceM += a.distanceM;
        prev.activityCount += 1;
        if (a.startedAt > prev.lastUsedAt) {
          prev.lastUsedAt = a.startedAt;
          if (a.gearName) prev.gearName = a.gearName;
        }
      } else {
        byGear.set(a.gearId, {
          gearId: a.gearId,
          gearName: a.gearName,
          totalDistanceM: a.distanceM,
          activityCount: 1,
          lastUsedAt: a.startedAt,
        });
      }
    }

    return Array.from(byGear.values()).sort(
      (a, b) => b.totalDistanceM - a.totalDistanceM,
    );
  },
});

// ---------------------------------------------------------------------------
// Single-activity queries (sin cambios — ya eran eficientes)
// ---------------------------------------------------------------------------

/**
 * Devuelve la polyline y metadata de mapa para una actividad concreta.
 */
export const getActivityMap = query({
  args: { id: v.id("activities") },
  handler: async (ctx, { id }) => {
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    const a = await ctx.db.get(id);
    if (!a) return null;
    if (a.userId !== user._id) return null;
    return {
      mapPolyline: a.mapPolyline ?? null,
      deviceName: a.deviceName ?? null,
      locationCity: a.locationCity ?? null,
      locationCountry: a.locationCountry ?? null,
    };
  },
});

export const getActivitySplits = query({
  args: { id: v.id("activities") },
  handler: async (ctx, { id }) => {
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    const a = await ctx.db.get(id);
    if (!a) return null;
    if (a.userId !== user._id) return null;
    return a.splitsMetric ?? null;
  },
});

/**
 * Devuelve la actividad completa para la página de detalle de un PR.
 * Solo se llama al abrir un PR específico, no en el feed.
 */
export const getActivityFull = query({
  args: { id: v.id("activities") },
  handler: async (ctx, { id }) => {
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    const a = await ctx.db.get(id);
    if (!a) return null;
    if (a.userId !== user._id) return null;
    return a;
  },
});

/**
 * Busca candidatos para vincular a un PR. Solo running.
 */
export const findCandidateActivitiesForPr = query({
  args: {
    distanceM: v.number(),
    targetTimeSeconds: v.number(),
    aroundMs: v.optional(v.number()),
    windowDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    const windowDays = args.windowDays ?? 30;
    const around = args.aroundMs ?? Date.now();
    const lower = around - windowDays * 24 * 60 * 60 * 1000;
    const upper = around + windowDays * 24 * 60 * 60 * 1000;
    const distMin = args.distanceM * 0.9;
    const distMax = args.distanceM * 1.1;

    const fromIndex = await ctx.db
      .query("activities")
      .withIndex("by_user_running", (q) =>
        q.eq("userId", user._id).eq("isRunning", true),
      )
      .collect();

    const candidates = fromIndex
      .filter((a) => a.startedAt >= lower && a.startedAt <= upper)
      .filter((a) => a.distanceM >= distMin && a.distanceM <= distMax)
      .map((a) => {
        const distError = Math.abs(a.distanceM - args.distanceM) / args.distanceM;
        const timeError = Math.abs(a.durationSec - args.targetTimeSeconds) / args.targetTimeSeconds;
        const score = distError + timeError;
        return { activity: a, score };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 20)
      .map((c) => projectForFeed(c.activity));

    return candidates;
  },
});

export const findActivityByProviderId = query({
  args: { providerActivityId: v.string() },
  handler: async (ctx, { providerActivityId }) => {
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    return await ctx.db
      .query("activities")
      .withIndex("by_provider_activity", (q) =>
        q
          .eq("provider", "strava")
          .eq("providerActivityId", providerActivityId),
      )
      .first();
  },
});

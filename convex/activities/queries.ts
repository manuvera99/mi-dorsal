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
    if (args.type === "interval") {
      // El campo `type` solo se rellena con `workoutType` de Strava, que
      // Garmin Connect no transmite. Para detectar series en el feed
      // consideramos AMBAS señales: el tipo Strava Y la detección local
      // por splits (detectIntervalsFromSplits). Esto arregla el caso
      // del usuario que sincroniza desde Garmin y no ve nunca sus series
      // en el feed.
      filtered = filtered.filter(
        (a) =>
          a.type === "interval" ||
          a.detectedIntervals?.isIntervalWorkout === true,
      );
    } else if (args.type) {
      filtered = filtered.filter((a) => a.type === args.type);
    }
    if (args.afterMs !== undefined) {
      filtered = filtered.filter((a) => a.startedAt < args.afterMs!);
    }

    // Enriquece cada item con `intervalSource` (solo relevante para series).
    // - "both": Strava y nuestro detector coinciden
    // - "strava": solo Strava lo marcó
    // - "detected": solo nuestro detector lo marcó (caso Garmin típico)
    // Para actividades que no son series, devuelve undefined.
    const enriched = filtered.slice(0, limit).map((a) => {
      if (a.type !== "interval" && a.detectedIntervals?.isIntervalWorkout !== true) {
        return a;
      }
      const fromStrava = a.type === "interval";
      const fromDetection = a.detectedIntervals?.isIntervalWorkout === true;
      const source =
        fromStrava && fromDetection
          ? "both"
          : fromStrava
            ? "strava"
            : "detected";
      return { ...a, intervalSource: source };
    });

    return enriched;
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

// ---------------------------------------------------------------------------
// Gear (zapatillas, bici) — agregado por gearId
// ---------------------------------------------------------------------------

/**
 * Resumen de gear del usuario: cada par de zapatillas / bici con sus km
 * totales en mi-dorsal y la fecha de la última actividad en la que se usó.
 *
 * Calculado on-the-fly desde `activities` (suma de `distanceM` agrupada
 * por `gearId`). Solo se cuentan actividades de running.
 *
 * Útil para:
 *  - Card "Tus zapatillas" en el perfil.
 *  - Alerta de cambio de zapatillas cuando se acerquen a 800 km.
 *  - Mostrar el nombre del modelo en la card de cada actividad.
 */
export const getMyGearSummary = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];

    const all = await ctx.db
      .query("activities")
      .withIndex("by_user_started", (q) => q.eq("userId", user._id))
      .collect();

    const running = all.filter((a) => isRunningSportType(a.stravaSportType));

    // Agrupar por gearId. Actividades sin gear (gearId undefined) se
    // ignoran — no podemos asociarlas a un par de zapatillas concreto.
    type GearSummary = {
      gearId: string;
      gearName: string | undefined;
      totalDistanceM: number;
      activityCount: number;
      lastUsedAt: number; // ms epoch
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
          // Si la última actividad trae un nombre más reciente, preferimos ese.
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

    // Ordenar por km totales desc (las zapatillas más usadas primero).
    return Array.from(byGear.values()).sort(
      (a, b) => b.totalDistanceM - a.totalDistanceM,
    );
  },
});

/**
 * Devuelve la polyline y metadata de mapa para una actividad concreta.
 * Se usa en la card de un PR (o en una actividad del feed) para mostrar
 * el mini-mapa del recorrido.
 *
 * El check de propiedad es por `userId` (no se filtra por provider) para
 * soportar también actividades ingeridas por export ZIP en el futuro.
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

/**
 * Devuelve los splits por km de una actividad (gráfica de pace por km).
 * Mismo check de propiedad que `getActivityMap`.
 */
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
 * Devuelve la actividad completa de Strava para mostrar la página de
 * detalle de un PR. Incluye polyline, splits, device, gear, location,
 * desnivel y todos los stats que Strava ingirió.
 *
 * Devuelve `null` si la actividad no existe, no es del usuario, o si el
 * PR no tiene `sourceActivityId` (PRs manuales / heredados).
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
 * Devuelve actividades candidatas para vincular a un PR. Busca por:
 *  - distancia (tolerancia ±10% para cubrir variantes del GPS)
 *  - ventana temporal alrededor del `achievedAt` del PR (±windowDays,
 *    default 30). Esto evita matches accidentales con actividades
 *    antiguas de la misma distancia.
 *
 * Solo running (isRunningSportType). Ordena por closeness al tiempo
 * del PR (las más probables primero). Devuelve hasta 20.
 *
 * Usado por la página de detalle de un PR sin `sourceActivityId` para
 * que el usuario pueda vincularlo con un click.
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

    // Filtrar todo lo del usuario con `by_user_started` (userId, startedAt).
    // El índice es por (userId, startedAt) — necesitamos filtrar por startedAt
    // en el cliente. Para datasets pequeños (<10k act) está bien.
    const all = await ctx.db
      .query("activities")
      .withIndex("by_user_started", (q) => q.eq("userId", user._id))
      .collect();

    const candidates = all
      .filter((a) => isRunningSportType(a.stravaSportType))
      .filter((a) => a.startedAt >= lower && a.startedAt <= upper)
      .filter((a) => a.distanceM >= distMin && a.distanceM <= distMax)
      .map((a) => {
        // Distancia al target: 0 = exact match, mayor = peor.
        const distError = Math.abs(a.distanceM - args.distanceM) / args.distanceM;
        const timeError = Math.abs(a.durationSec - args.targetTimeSeconds) / args.targetTimeSeconds;
        const score = distError + timeError;
        return { activity: a, score };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 20)
      .map((c) => c.activity);

    return candidates;
  },
});

/**
 * Busca una actividad por `providerActivityId` (Strava ID). Se usa cuando
 * el usuario pega una URL de Strava del estilo
 * `https://www.strava.com/activities/1234567890` y queremos resolver
 * el id y enlazarlo a un PR sin pedirle que lo busque.
 *
 * Devuelve `null` si la actividad no está en nuestro DB (el usuario
 * tendría que sincronizar primero desde Strava).
 */
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

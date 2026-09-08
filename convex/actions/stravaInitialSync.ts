// =============================================================================
// mi-dorsal — Strava initial sync (action)
// =============================================================================
// Sincronización inicial cuando un usuario conecta su Strava por OAuth.
// Pagina por /athlete/activities con rate limit awareness, e ingiere cada
// actividad en `activities` con provider="strava".
//
// Para usuarios con miles de actividades, parte en chunks via
// ctx.scheduler.runAfter.
// =============================================================================

"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { getDistanceLabel } from "../_helpers";
import { detectIntervalsFromSplits } from "../../lib/training/detect-intervals";
import {
  decodeTokens,
  ensureFreshToken,
  encodeTokens,
  listAthleteActivities,
  getActivity,
  sleep,
  type StravaTokens,
  type StravaActivitySummary,
} from "../../lib/strava/client";
import {
  normalizeStravaCsvRow,
  findBestRaceMatch,
  matchPRDistance,
  matchBestEffortName,
  classifyActivity,
  stravaApiCadenceToSpm,
  type NormalizedActivity,
  type StravaCsvRow,
  type RaceMatchCandidate,
} from "../activities/normalize";

const PAGE_SIZE = 100;
const MAX_PAGES_PER_CHUNK = 5; // 500 actividades por invocación
const CHUNK_DELAY_MS = 1500;
// Solo actividades de al menos esta distancia pueden contener un
// best_effort de 5K (el más corto que trackeamos como PR de ruta) — no
// tiene sentido pedir el detalle (1 request extra c/u) de un trote de 3km.
const MIN_DISTANCE_M_FOR_DETAIL = 4750;
// Delay entre peticiones de detalle dentro del mismo chunk, para no
// consumir de golpe el rate limit de Strava (100 req/15min en Standard Tier)
// cuando un chunk tiene muchas actividades largas.
const DETAIL_FETCH_DELAY_MS = 400;

/**
 * Convierte todos los `null` de un objeto a `undefined` (recursivo solo
 * a primer nivel, suficiente para los args de Convex). Los validators
 * de Convex `v.optional(v.string())` / `v.optional(v.number())` NO
 * aceptan `null` literal — hay que pasar `undefined` o el valor
 * correcto. Strava devuelve `null` para campos opcionales, así que
 * cualquier ingest sin normalizar termina reventando con
 * "Value does not match validator" en el primer campo null.
 *
 * IMPORTANTE: NO aplica a `false`/`0`/`""` (que son valores válidos).
 */
function nullsToUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v === null ? undefined : v;
  }
  return out as T;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export const startInitialSync = action({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, { profileId }) => {
    return await runSyncChunk(ctx, { profileId, page: 1, totalProcessed: 0 });
  },
});

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

interface SyncArgs {
  profileId: string;
  page: number;
  totalProcessed: number;
}

async function runSyncChunk(ctx: any, args: SyncArgs) {
  const { profileId, page, totalProcessed } = args;

  // 1) Cargar profile
  const profile = await ctx.runQuery(internal.stravaOauth.getMyTokensEncrypted, { profileId });
  if (!profile) {
    throw new Error("Profile sin tokens");
  }

  // 2) Descifrar tokens
  let tokens: StravaTokens = decodeTokens({
    accessTokenEncrypted: profile.accessTokenEncrypted,
    refreshTokenEncrypted: profile.refreshTokenEncrypted,
    expiresAt: profile.expiresAt,
    athleteId: profile.athleteId,
  });

  // 3) Refrescar si hace falta (y guardar los nuevos tokens)
  tokens = await ensureFreshToken(tokens, async (newTokens) => {
    const encoded = encodeTokens(newTokens);
    await ctx.runMutation(internal.stravaOauth.updateTokens, {
      profileId,
      accessTokenEncrypted: encoded.accessTokenEncrypted,
      refreshTokenEncrypted: encoded.refreshTokenEncrypted,
      expiresAt: encoded.expiresAt,
    });
  });

  // 4) Listar actividades de esta página
  let pageResult;
  try {
    pageResult = await listAthleteActivities(tokens, {
      page,
      perPage: PAGE_SIZE,
    });
  } catch (e: any) {
    console.error(`[stravaInitialSync] page ${page} failed: ${e?.message}`);
    throw e;
  }

  const activities = pageResult.activities;
  if (activities.length === 0) {
    // Terminamos
    await ctx.runMutation(internal.stravaInitialSyncHelpers.markSyncComplete, {
      profileId,
      totalActivities: totalProcessed,
    });
    return { done: true, totalProcessed };
  }

  // 5) Cargar catálogo de carreras para cross-reference
  const fromDateMs = Math.min(
    ...activities.map((a: StravaActivitySummary) =>
      new Date(a.start_date_local).getTime(),
    ),
  ) - 7 * 24 * 60 * 60 * 1000;
  const toDateMs =
    Math.max(
      ...activities.map((a: StravaActivitySummary) =>
        new Date(a.start_date_local).getTime(),
      ),
    ) + 7 * 24 * 60 * 60 * 1000;

  const races = await ctx.runQuery(
    internal.stravaExportIngestHelpers.listRacesInRange,
    { fromDateMs, toDateMs },
  );
  const raceCandidates: RaceMatchCandidate[] = races.map((r: any) => ({
    _id: r._id,
    name: r.name,
    slug: r.slug,
    locality: r.locality,
    startDate: r.startDate,
    distanceKm: r.distanceKm,
  }));

  // 6) Ingerir cada actividad. Las que alcanzan el umbral de distancia
  // piden el detalle (best_efforts + map + splits + gear + device) antes
  // — es lo que usa Strava para calcular sus "Mejores tiempos" y donde
  // vienen los campos que el listado NO incluye.
  for (const activity of activities) {
    // `effective` es la versión "mejorada" de la actividad: si pudimos
    // obtener el detail, lo usamos (tiene map, splits, gear, etc.). Si
    // no, caemos al summary del listado (sin esos campos).
    let effective: StravaActivitySummary = activity;
    if (activity.distance >= MIN_DISTANCE_M_FOR_DETAIL) {
      try {
        const detail = await getActivity(activity.id, tokens, async (newTokens) => {
          const encoded = encodeTokens(newTokens);
          await ctx.runMutation(internal.stravaOauth.updateTokens, {
            profileId,
            accessTokenEncrypted: encoded.accessTokenEncrypted,
            refreshTokenEncrypted: encoded.refreshTokenEncrypted,
            expiresAt: encoded.expiresAt,
          });
        });
        effective = detail.data;
        await sleep(DETAIL_FETCH_DELAY_MS);
      } catch (e: any) {
        console.warn(
          `[stravaInitialSync] no se pudo obtener detalle de actividad ${activity.id}: ${e?.message}`,
        );
      }
    }
    await ingestOneActivity(ctx, profileId, effective, raceCandidates);
  }

  // 7) Actualizar progreso
  const newTotal = totalProcessed + activities.length;
  await ctx.runMutation(internal.stravaInitialSyncHelpers.updateSyncProgress, {
    profileId,
    lastSyncAt: Date.now(),
    processedCount: newTotal,
  });

  // 8) Si la página vino llena y aún no hemos pasado el límite, agendar siguiente
  if (activities.length === PAGE_SIZE && page < MAX_PAGES_PER_CHUNK * 100) {
    // Este archivo vive en convex/actions/stravaInitialSync.ts, así que su
    // namespace real es "actions/stravaInitialSync" (con prefijo de carpeta).
    await ctx.scheduler.runAfter(
      CHUNK_DELAY_MS,
      (internal as any)["actions/stravaInitialSync"].continueSync,
      { profileId, page: page + 1, totalProcessed: newTotal },
    );
  } else {
    // Terminamos
    await ctx.runMutation(internal.stravaInitialSyncHelpers.markSyncComplete, {
      profileId,
      totalActivities: newTotal,
    });
  }

  return { done: activities.length < PAGE_SIZE, totalProcessed: newTotal, page };
}

export const continueSync = internalAction({
  args: {
    profileId: v.id("profiles"),
    page: v.number(),
    totalProcessed: v.number(),
  },
  handler: async (ctx, args) => {
    return await runSyncChunk(ctx, args);
  },
});

// ---------------------------------------------------------------------------
// Ingest de una actividad
// ---------------------------------------------------------------------------

async function ingestOneActivity(
  ctx: any,
  profileId: string,
  activity: StravaActivitySummary,
  raceCandidates: RaceMatchCandidate[],
) {
  // Mapear a nuestro formato normalizado
  const startedAt = new Date(activity.start_date_local).getTime();
  const distanceM = activity.distance;
  const durationSec = activity.moving_time;
  // Strava API devuelve cadencia de running en zancadas de UNA pierna/min —
  // convertir a spm reales antes de usarla en cualquier sitio.
  const avgCadenceSpm = stravaApiCadenceToSpm(activity.average_cadence);

  // Clasificar con la heurística real (distancia/pace/desnivel/cadencia),
  // NO con el mapeo plano por sport_type que había aquí antes (marcaba
  // cualquier "Run" como long_run sin mirar duración ni distancia — un
  // sprint de 300m de 1 minuto salía como "tirada larga").
  const classifiedType = classifyActivity(
    (activity.sport_type ?? activity.type) as any,
    distanceM,
    durationSec,
    activity.total_elevation_gain,
    avgCadenceSpm,
  );

  // Normalizar para cross-reference
  const normalized: NormalizedActivity = {
    providerActivityId: String(activity.id),
    name: activity.name,
    description: activity.description,
    startedAt,
    durationSec,
    distanceM,
    avgPaceSecPerKm: activity.average_speed > 0
      ? Math.round(1000 / activity.average_speed)
      : undefined,
    avgHeartRate: activity.average_heartrate,
    maxHeartRate: activity.max_heartrate,
    avgCadence: avgCadenceSpm,
    elevationGainM: activity.total_elevation_gain,
    elevationLossM: undefined, // Strava API no devuelve esto directamente
    stravaType: activity.sport_type as any,
    classifiedType,
    isPrivate: activity.visibility === "only_me",
    rawPayload: activity as unknown as Record<string, unknown>,
  };

  // Cross-reference. findBestRaceMatch devuelve `string | null`, pero los
  // validadores de Convex son v.optional(v.id("races")) — null no matchea
  // eso (Convex distingue null de undefined), así que se normaliza aquí.
  const matchedRaceId = findBestRaceMatch(normalized, raceCandidates) ?? undefined;

  // Upsert actividad (idempotente por provider + providerActivityId)
  const upserted = await ctx.runMutation(
    internal.stravaExport.upsertActivityInternal,
    {
      userId: profileId as any,
      provider: "strava",
      source: "oauth",
      providerActivityId: normalized.providerActivityId,
      type: classifiedType,
      // Strava puede devolver null en strings (name, description, sport_type);
      // los validators v.optional(v.string()) NO aceptan null, hay que
      // normalizar a undefined.
      name: normalized.name ?? undefined,
      startedAt: normalized.startedAt,
      durationSec: normalized.durationSec,
      distanceM: normalized.distanceM,
      avgPaceSecPerKm: normalized.avgPaceSecPerKm,
      avgHeartRate: normalized.avgHeartRate,
      maxHeartRate: normalized.maxHeartRate,
      avgCadence: normalized.avgCadence,
      elevationGainM: normalized.elevationGainM,
      description: normalized.description ?? undefined,
      matchedRaceId: matchedRaceId as any,
      isPrivate: normalized.isPrivate,
      rawPayload: JSON.stringify(activity),
      stravaSportType: activity.sport_type ?? activity.type ?? undefined,
      // Detalle (solo presente en getActivity, no en el listado).
      // Filtramos los splits a solo los campos que declaramos en el
      // schema — Strava devuelve más (average_grade_adjusted_speed,
      // pace_zone, start_index, etc.) y el validator de Convex es
      // estricto, rechaza el objeto entero si hay extras.
      mapPolyline: activity.map?.summary_polyline ?? undefined,
      gearId: activity.gear?.id ?? activity.gear_id ?? undefined,
      gearName: activity.gear?.name ?? undefined,
      gearDistanceM: activity.gear?.distance ?? undefined,
      deviceName: activity.device_name ?? undefined,
      splitsMetric: (() => {
        const mapped = activity.splits_metric?.map((s: any) => ({
          split: s.split,
          distance: s.distance,
          elapsed_time: s.elapsed_time,
          moving_time: s.moving_time,
          elevation_difference: s.elevation_difference,
          average_speed: s.average_speed,
          average_heartrate: s.average_heartrate,
          average_cadence: s.average_cadence,
        }));
        return detectIntervalsFromSplits(mapped);
      })(),
      detectedIntervals: (() => {
        const mapped = activity.splits_metric?.map((s: any) => ({
          split: s.split,
          distance: s.distance,
          elapsed_time: s.elapsed_time,
          moving_time: s.moving_time,
          elevation_difference: s.elevation_difference,
          average_speed: s.average_speed,
          average_heartrate: s.average_heartrate,
          average_cadence: s.average_cadence,
        }));
        return detectIntervalsFromSplits(mapped);
      })(),
      locationCity: activity.location_city ?? undefined,
      locationCountry: activity.location_country ?? undefined,
      // -----------------------------------------------------------------
      // Campos extra (2026-09-08) — engagement, esfuerzo, weather, laps, etc.
      // normalizado a undefined si Strava devuelve null (los validators
      // de Convex con v.optional(v.number()) NO aceptan null literal).
      // -----------------------------------------------------------------
      kudosCount: activity.kudos_count ?? undefined,
      commentCount: activity.comment_count ?? undefined,
      achievementCount: activity.achievement_count ?? undefined,
      athleteCount: activity.athlete_count ?? undefined,
      photoCount: activity.photo_count ?? undefined,
      calories: activity.calories ?? undefined,
      workoutType: activity.workout_type ?? undefined,
      perceivedExertion: activity.perceived_exertion ?? undefined,
      sufferScore: activity.suffer_score ?? undefined,
      hasPower: activity.device_watts ?? activity.has_power ?? undefined,
      averageWatts: activity.average_watts ?? undefined,
      maxWatts: activity.max_watts ?? undefined,
      weightedAverageWatts: activity.weighted_average_watts ?? undefined,
      maxCadence: activity.max_cadence ?? undefined,
      utcOffsetSeconds: activity.utc_offset ?? undefined,
      externalId: activity.external_id ?? undefined,
      averageGradeAdjustedSpeed: activity.average_grade_adjusted_speed ?? undefined,
      gradeAdjustedDistance: activity.grade_adjusted_distance ?? undefined,
      embedToken: activity.embed_token ?? undefined,
      // Weather (si está disponible)
      averageTemp: activity.average_temp ?? undefined,
      minTemp: activity.min_temp ?? undefined,
      maxTemp: activity.max_temp ?? undefined,
      feelsLikeTemp: activity.feels_like ?? undefined,
      averageWindSpeed: activity.average_wind_speed ?? undefined,
      precipitationIntensity: activity.precipitation_intensity ?? undefined,
      weatherObservationTime: activity.weather_observation_time ?? undefined,
      // Laps y segments (arrays, sin filtrar — el validator es v.any())
      laps: activity.laps ?? undefined,
      segmentEfforts: activity.segment_efforts ?? undefined,
      // Detalle completo parseado (solo si es el detail, no el list)
      rawStravaDetail:
        activity.map || activity.splits_metric ? (activity as any) : undefined,
    },
  );
  const activityId = upserted.id;

  // PR check.
  //
  // Vía preferente (5K-Maratón): best_efforts de Strava. Es el mismo dato
  // que la app de Strava usa para "Mejores tiempos" — el mejor tramo GPS
  // continuo de esa distancia exacta, calculado por Strava aunque la
  // actividad completa sea más larga o más corta. No se filtra por
  // classifiedType: si Strava dice que hay un 10K real dentro del track,
  // es un 10K real, sea la actividad completa "easy", "long_run" o lo que sea.
  //
  // Ultras (50K+): Strava NO emite best_efforts para estas distancias, así
  // que siempre se usa la distancia total de la actividad + filtro de
  // classifiedType (incluye "trail" porque los ultras casi siempre llevan
  // desnivel).
  //
  // Fallback 5K-Maratón: si no se pudo obtener el detalle (fetch falló, o
  // la actividad no llegó al umbral mínimo de distancia), se cae a
  // distancia total + classifiedType — peor que best_efforts, pero mejor
  // que no detectar nada.
  const prDistanceM = matchPRDistance(distanceM);
  const isUltra = prDistanceM !== null && prDistanceM >= 50000;

  if (!isUltra && activity.best_efforts && activity.best_efforts.length > 0) {
    for (const effort of activity.best_efforts) {
      const effortDistanceM = matchBestEffortName(effort.name);
      if (!effortDistanceM) continue;
      // Si el esfuerzo (5K) viene de una actividad más larga (10K),
      // guardamos el label de la actividad para mostrar "Lograda en 10K"
      // en la card y el detalle. Si la actividad coincide con el esfuerzo
      // (5K PR de una carrera de 5K), no pasamos label (sería redundante).
      let sourceLabel: string | undefined;
      if (activity.distance > effortDistanceM * 1.1) {
        const standard = getDistanceLabel(activity.distance);
        sourceLabel = standard.includes(".")
          ? `${(activity.distance / 1000).toFixed(1)}K`
          : standard;
      }
      await ctx.runMutation(internal.stravaExport.checkAndUpdatePR, {
        userId: profileId as any,
        distanceM: effortDistanceM,
        timeSeconds: effort.elapsed_time,
        raceId: matchedRaceId as any,
        achievedAt: new Date(effort.start_date_local).toISOString(),
        activityId: activityId as any,
        sourceActivityDistanceLabel: sourceLabel,
        sourceActivityIsRace: classifiedType === "race",
        source: "strava",
      });
    }
  } else if (
    prDistanceM &&
    (classifiedType === "race" ||
      classifiedType === "long_run" ||
      classifiedType === "tempo" ||
      classifiedType === "trail")
  ) {
    await ctx.runMutation(internal.stravaExport.checkAndUpdatePR, {
      userId: profileId as any,
      distanceM: prDistanceM,
      timeSeconds: durationSec,
      raceId: matchedRaceId as any,
      achievedAt: new Date(startedAt).toISOString(),
      activityId: activityId as any,
      sourceActivityIsRace: classifiedType === "race",
      source: "strava",
    });
  }

  // Race candidate si no matcheó
  if (!matchedRaceId && activity.name && classifiedType === "race") {
    await ctx.runMutation(internal.stravaExport.upsertRaceCandidate, {
      name: activity.name,
      date: startedAt,
      locality: undefined,
      distanceM,
      userId: profileId as any,
    });
  }
}

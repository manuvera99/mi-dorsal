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
  // piden el detalle (best_efforts) antes — es lo que usa Strava para
  // calcular sus "Mejores tiempos", no la distancia total de la actividad.
  for (const activity of activities) {
    let bestEfforts: StravaActivitySummary["best_efforts"];
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
        bestEfforts = detail.data.best_efforts;
        await sleep(DETAIL_FETCH_DELAY_MS);
      } catch (e: any) {
        console.warn(
          `[stravaInitialSync] no se pudo obtener detalle de actividad ${activity.id}: ${e?.message}`,
        );
      }
    }
    await ingestOneActivity(ctx, profileId, activity, raceCandidates, bestEfforts);
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
  bestEfforts?: StravaActivitySummary["best_efforts"],
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
      name: normalized.name,
      startedAt: normalized.startedAt,
      durationSec: normalized.durationSec,
      distanceM: normalized.distanceM,
      avgPaceSecPerKm: normalized.avgPaceSecPerKm,
      avgHeartRate: normalized.avgHeartRate,
      maxHeartRate: normalized.maxHeartRate,
      avgCadence: normalized.avgCadence,
      elevationGainM: normalized.elevationGainM,
      description: normalized.description,
      matchedRaceId: matchedRaceId as any,
      isPrivate: normalized.isPrivate,
      rawPayload: JSON.stringify(activity),
      stravaSportType: activity.sport_type ?? activity.type,
      // Detalle (solo presente en getActivity, no en el listado)
      mapPolyline: activity.map?.summary_polyline ?? undefined,
      gearId: activity.gear?.id ?? activity.gear_id ?? undefined,
      gearName: activity.gear?.name ?? undefined,
      gearDistanceM: activity.gear?.distance ?? undefined,
      deviceName: activity.device_name ?? undefined,
      splitsMetric: activity.splits_metric ?? undefined,
      locationCity: activity.location_city ?? undefined,
      locationCountry: activity.location_country ?? undefined,
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

  if (!isUltra && bestEfforts && bestEfforts.length > 0) {
    for (const effort of bestEfforts) {
      const effortDistanceM = matchBestEffortName(effort.name);
      if (!effortDistanceM) continue;
      await ctx.runMutation(internal.stravaExport.checkAndUpdatePR, {
        userId: profileId as any,
        distanceM: effortDistanceM,
        timeSeconds: effort.elapsed_time,
        raceId: matchedRaceId as any,
        achievedAt: new Date(effort.start_date_local).toISOString(),
        activityId: activityId as any,
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

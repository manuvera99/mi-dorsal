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
  type StravaTokens,
  type StravaActivitySummary,
} from "@/lib/strava/client";
import {
  normalizeStravaCsvRow,
  findBestRaceMatch,
  matchPRDistance,
  type NormalizedActivity,
  type StravaCsvRow,
  type RaceMatchCandidate,
} from "../activities/normalize";

const PAGE_SIZE = 100;
const MAX_PAGES_PER_CHUNK = 5; // 500 actividades por invocación
const CHUNK_DELAY_MS = 1500;

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
  const profile = await ctx.runQuery(internal.stravaOauth.getMyTokensEncrypted, {});
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

  // 6) Ingerir cada actividad
  for (const activity of activities) {
    await ingestOneActivity(ctx, profileId, activity, raceCandidates);
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
    await ctx.scheduler.runAfter(
      CHUNK_DELAY_MS,
      internal.stravaInitialSync.continueSync,
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
  const stravaType = mapStravaTypeToOurs(activity.sport_type ?? activity.type);
  const startedAt = new Date(activity.start_date_local).getTime();
  const distanceM = activity.distance;
  const durationSec = activity.moving_time;

  // Clasificar (reusamos la lógica de normalize.ts)
  const classifiedType = mapStravaTypeToOurs(
    activity.sport_type ?? activity.type,
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
    avgCadence: activity.average_cadence,
    elevationGainM: activity.total_elevation_gain,
    elevationLossM: undefined, // Strava API no devuelve esto directamente
    stravaType: activity.sport_type as any,
    classifiedType,
    isPrivate: activity.visibility === "only_me",
    rawPayload: activity as unknown as Record<string, unknown>,
  };

  // Cross-reference
  const matchedRaceId = findBestRaceMatch(normalized, raceCandidates);

  // Upsert actividad (idempotente por provider + providerActivityId)
  await ctx.runMutation(internal.stravaExport.upsertActivityInternal, {
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
  });

  // PR check
  const prDistanceM = matchPRDistance(distanceM);
  if (
    prDistanceM &&
    (classifiedType === "race" || classifiedType === "long_run" || classifiedType === "tempo")
  ) {
    await ctx.runMutation(internal.stravaExport.checkAndUpdatePR, {
      userId: profileId as any,
      distanceM: prDistanceM,
      timeSeconds: durationSec,
      raceId: matchedRaceId as any,
      achievedAt: new Date(startedAt).toISOString(),
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

function mapStravaTypeToOurs(stravaType: string): "race" | "long_run" | "tempo" | "interval" | "easy" | "recovery" | "trail" {
  if (stravaType === "Race") return "race";
  if (stravaType === "TrailRun") return "trail";
  if (stravaType === "VirtualRun") return "easy";
  if (stravaType === "Run") return "long_run";
  return "easy";
}

// =============================================================================
// mi-dorsal — Strava webhook event handler
// =============================================================================
// Procesa los eventos push de Strava:
//   - aspect_type="create" / "update" → ingestar la actividad
//   - aspect_type="delete" → borrar la actividad
// =============================================================================

"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  decodeTokens,
  encodeTokens,
  ensureFreshToken,
  getActivity,
  type StravaTokens,
} from "../../lib/strava/client";

// Pública (no internalAction) porque la llama app/api/webhooks/strava/route.ts
// desde fuera de Convex vía ConvexHttpClient — solo funciones "public" son
// invocables así. No expone datos sensibles: solo procesa el evento del
// webhook de Strava (ya validado por firma HMAC antes de llegar aquí).
export const handleEvent = action({
  args: {
    stravaAthleteId: v.number(),
    stravaActivityId: v.number(),
    aspectType: v.string(),
    eventTime: v.number(),
  },
  handler: async (ctx, args) => {
    const { stravaAthleteId, stravaActivityId, aspectType } = args;

    // 1) Borrado: eliminar la actividad
    if (aspectType === "delete") {
      await ctx.runMutation(internal.stravaWebhookHandlerInternal.deleteActivity, {
        stravaActivityId: String(stravaActivityId),
      });
      return { ok: true, action: "deleted" };
    }

    // 2) Crear/actualizar: ingestar la actividad
    // Buscar el profile por stravaUserId
    const profile = await ctx.runQuery(
      internal.stravaWebhookHandlerInternal.findProfileByAthleteId,
      { stravaAthleteId },
    );
    if (!profile) {
      console.warn(
        `[stravaWebhookHandler] no profile para athleteId ${stravaAthleteId}`,
      );
      return { ok: false, reason: "profile_not_found" };
    }

    if (!profile.accessTokenEncrypted) {
      return { ok: false, reason: "no_tokens" };
    }

    // 3) Cargar tokens y refrescar si hace falta
    let tokens: StravaTokens = decodeTokens({
      accessTokenEncrypted: profile.accessTokenEncrypted,
      refreshTokenEncrypted: profile.refreshTokenEncrypted ?? "",
      expiresAt: profile.expiresAt ?? 0,
      athleteId: profile.athleteId ?? 0,
    });

    tokens = await ensureFreshToken(tokens, async (newTokens) => {
      const encoded = encodeTokens(newTokens);
      await ctx.runMutation(internal.stravaOauth.updateTokens, {
        profileId: profile.profileId,
        accessTokenEncrypted: encoded.accessTokenEncrypted,
        refreshTokenEncrypted: encoded.refreshTokenEncrypted,
        expiresAt: encoded.expiresAt,
      });
    });

    // 4) Llamar a Strava para el detalle de la actividad
    let activity;
    try {
      const result = await getActivity(stravaActivityId, tokens);
      activity = result.data;
    } catch (e: any) {
      console.error(
        `[stravaWebhookHandler] getActivity ${stravaActivityId} failed: ${e?.message}`,
      );
      return { ok: false, reason: "strava_api_failed" };
    }

    // 5) Clasificar e ingestar
    const stravaType = activity.sport_type ?? activity.type;
    const classifiedType = mapStravaTypeToOurs(stravaType);
    const startedAt = new Date(activity.start_date_local).getTime();
    const distanceM = activity.distance;
    const durationSec = activity.moving_time;

    // Cargar catálogo para cross-reference
    const fromDateMs = startedAt - 7 * 24 * 60 * 60 * 1000;
    const toDateMs = startedAt + 7 * 24 * 60 * 60 * 1000;
    const races = await ctx.runQuery(
      internal.stravaExportIngestHelpers.listRacesInRange,
      { fromDateMs, toDateMs },
    );
    const raceCandidates = races.map((r: any) => ({
      _id: r._id,
      name: r.name,
      slug: r.slug,
      locality: r.locality,
      startDate: r.startDate,
      distanceKm: r.distanceKm,
    }));

    const { findBestRaceMatch, matchPRDistance } = await import(
      "../activities/normalize"
    );
    const normalized = {
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
      elevationLossM: undefined,
      stravaType: stravaType as any,
      classifiedType,
      isPrivate: activity.visibility === "only_me",
      rawPayload: activity as unknown as Record<string, unknown>,
    };

    // findBestRaceMatch devuelve `string | null`, pero los validadores de
    // Convex son v.optional(v.id("races")) — null no matchea eso (Convex
    // distingue null de undefined), así que se normaliza aquí.
    const matchedRaceId = findBestRaceMatch(normalized, raceCandidates) ?? undefined;

    // Upsert actividad
    await ctx.runMutation(internal.stravaExport.upsertActivityInternal, {
      userId: profile.profileId as any,
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

    // PR check. Incluye "trail" porque los ultras (50K+) casi siempre llevan
    // desnivel y se clasifican como trail, no como race/long_run/tempo.
    const prDistanceM = matchPRDistance(distanceM);
    if (
      prDistanceM &&
      (classifiedType === "race" ||
        classifiedType === "long_run" ||
        classifiedType === "tempo" ||
        classifiedType === "trail")
    ) {
      await ctx.runMutation(internal.stravaExport.checkAndUpdatePR, {
        userId: profile.profileId as any,
        distanceM: prDistanceM,
        timeSeconds: durationSec,
        raceId: matchedRaceId as any,
        achievedAt: new Date(startedAt).toISOString(),
        source: "strava",
      });
    }

    return { ok: true, action: aspectType, activityId: stravaActivityId };
  },
});

function mapStravaTypeToOurs(stravaType: string): "race" | "long_run" | "tempo" | "interval" | "easy" | "recovery" | "trail" {
  if (stravaType === "Race") return "race";
  if (stravaType === "TrailRun") return "trail";
  if (stravaType === "VirtualRun") return "easy";
  if (stravaType === "Run") return "long_run";
  return "easy";
}

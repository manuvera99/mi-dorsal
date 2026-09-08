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

    // 5) Clasificar e ingestar. Import dinámico porque este archivo lleva
    // "use node" y normalize.ts se mantiene como módulo puro sin esa
    // directiva.
    const { classifyActivity, findBestRaceMatch, matchPRDistance, matchBestEffortName, stravaApiCadenceToSpm } =
      await import("../activities/normalize");
    const stravaType = activity.sport_type ?? activity.type;
    const startedAt = new Date(activity.start_date_local).getTime();
    const distanceM = activity.distance;
    const durationSec = activity.moving_time;
    // Strava API devuelve cadencia de running en zancadas de UNA pierna/min —
    // convertir a spm reales antes de usarla en cualquier sitio.
    const avgCadenceSpm = stravaApiCadenceToSpm(activity.average_cadence);
    // Heurística real (distancia/pace/desnivel/cadencia), NO el mapeo plano
    // por sport_type que había aquí antes (marcaba cualquier "Run" como
    // long_run sin mirar duración ni distancia).
    const classifiedType = classifyActivity(
      stravaType as any,
      distanceM,
      durationSec,
      activity.total_elevation_gain,
      avgCadenceSpm,
    );

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
      avgCadence: avgCadenceSpm,
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
    const upserted = await ctx.runMutation(
      internal.stravaExport.upsertActivityInternal,
      {
        userId: profile.profileId as any,
        provider: "strava",
        source: "oauth",
        providerActivityId: normalized.providerActivityId,
        type: classifiedType,
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
        // Filtramos los splits a los campos del schema (Convex rechaza
        // campos extra en objetos anidados).
        mapPolyline: activity.map?.summary_polyline ?? undefined,
        gearId: activity.gear?.id ?? activity.gear_id ?? undefined,
        gearName: activity.gear?.name ?? undefined,
        gearDistanceM: activity.gear?.distance ?? undefined,
        deviceName: activity.device_name ?? undefined,
        splitsMetric: activity.splits_metric?.map((s: any) => ({
          split: s.split,
          distance: s.distance,
          elapsed_time: s.elapsed_time,
          moving_time: s.moving_time,
          elevation_difference: s.elevation_difference,
          average_speed: s.average_speed,
          average_heartrate: s.average_heartrate,
          average_cadence: s.average_cadence,
        })),
        locationCity: activity.location_city ?? undefined,
        locationCountry: activity.location_country ?? undefined,
        // -----------------------------------------------------------------
        // Campos extra (2026-09-08) — engagement, esfuerzo, weather, laps, etc.
        // normalizado a undefined si Strava devuelve null.
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
        averageTemp: activity.average_temp ?? undefined,
        minTemp: activity.min_temp ?? undefined,
        maxTemp: activity.max_temp ?? undefined,
        feelsLikeTemp: activity.feels_like ?? undefined,
        averageWindSpeed: activity.average_wind_speed ?? undefined,
        precipitationIntensity: activity.precipitation_intensity ?? undefined,
        weatherObservationTime: activity.weather_observation_time ?? undefined,
        laps: activity.laps ?? undefined,
        segmentEfforts: activity.segment_efforts ?? undefined,
        rawStravaDetail: activity as any,
      },
    );
    const activityId = upserted.id;

    // PR check. Mismo criterio que stravaInitialSync.ts:
    //   - 5K-Maratón: usar best_efforts de Strava (mejor tramo GPS continuo
    //     de esa distancia, lo mismo que "Mejores tiempos" en la app).
    //   - Ultras (50K+): Strava no emite best_efforts ahí, usar distancia
    //     total + filtro de classifiedType (incluye "trail").
    //   - Fallback si no hay best_efforts en la respuesta: distancia total
    //     + classifiedType, igual que antes.
    const prDistanceM = matchPRDistance(distanceM);
    const isUltra = prDistanceM !== null && prDistanceM >= 50000;
    const bestEfforts = activity.best_efforts;

    if (!isUltra && bestEfforts && bestEfforts.length > 0) {
      for (const effort of bestEfforts) {
        const effortDistanceM = matchBestEffortName(effort.name);
        if (!effortDistanceM) continue;
        await ctx.runMutation(internal.stravaExport.checkAndUpdatePR, {
          userId: profile.profileId as any,
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
        userId: profile.profileId as any,
        distanceM: prDistanceM,
        timeSeconds: durationSec,
        raceId: matchedRaceId as any,
        achievedAt: new Date(startedAt).toISOString(),
        activityId: activityId as any,
        source: "strava",
      });
    }

    return { ok: true, action: aspectType, activityId: stravaActivityId };
  },
});

// =============================================================================
// mi-dorsal — Helpers de convex/emailNotificationsAction.ts
// =============================================================================
// Queries/mutations internas que usa la action sendResultFoundEmail
// (convex/emailNotificationsAction.ts), más las queries PÚBLICAS que
// sirven al front (diploma, share card, página de resultado).
//
// Viven en un archivo separado porque son tipos distintos en Convex
// (query/mutation vs. action) — mantenerlas en el mismo módulo que la
// action no aporta nada y complica los imports circulares de `internal`.
// =============================================================================

import { internalQuery, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getEffectiveDistance } from "../lib/prediction/effective-distance";

// ===========================================================================
// Queries/mutations internas (usadas por la action)
// ===========================================================================

export const getDataForEmail = internalQuery({
  args: { myRaceId: v.id("myRaces") },
  handler: async (ctx, { myRaceId }) => {
    const myRace = await ctx.db.get(myRaceId);
    if (!myRace) return null;
    const profile = await ctx.db.get(myRace.userId);
    if (!profile) return null;
    const race = await ctx.db.get(myRace.raceId);
    if (!race) return null;

    // PR actual en la distancia EFECTIVA (la que el usuario eligió, o la
    // principal de la carrera si no eligió ninguna), sin modificarlo.
    const effectiveDistance = getEffectiveDistance(myRace, race);
    const distanceM = Math.round(effectiveDistance.distanceKm * 1000);
    const currentPR = await ctx.db
      .query("personalRecords")
      .withIndex("by_user_distance_current", (q) =>
        q
          .eq("userId", profile._id)
          .eq("distanceM", distanceM)
          .eq("isCurrent", true),
      )
      .unique();

    return { myRace, profile, race, currentPR, effectiveDistance };
  },
});

export const hasLogForMyRace = internalQuery({
  args: {
    userId: v.id("profiles"),
    myRaceId: v.id("myRaces"),
    type: v.union(
      v.literal("welcome"),
      v.literal("reminder_7d"),
      v.literal("reminder_1d"),
      v.literal("result_found"),
      v.literal("result_not_found"),
      v.literal("weekly_digest"),
      v.literal("year_review"),
    ),
  },
  handler: async (ctx, { userId, myRaceId, type }) => {
    const log = await ctx.db
      .query("notificationLog")
      .withIndex("by_user_type", (q) =>
        q.eq("userId", userId).eq("type", type),
      )
      .filter((q) => q.eq(q.field("relatedMyRaceId"), myRaceId))
      .first();
    return log !== null;
  },
});

export const attachStorageIds = internalMutation({
  args: {
    myRaceId: v.id("myRaces"),
    diplomaStorageId: v.id("_storage"),
    shareCardStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.myRaceId, {
      diplomaStorageId: args.diplomaStorageId,
      shareCardStorageId: args.shareCardStorageId,
    });
  },
});

export const writeLog = internalMutation({
  args: {
    userId: v.id("profiles"),
    myRaceId: v.id("myRaces"),
    type: v.union(
      v.literal("welcome"),
      v.literal("reminder_7d"),
      v.literal("reminder_1d"),
      v.literal("result_found"),
      v.literal("result_not_found"),
      v.literal("weekly_digest"),
      v.literal("year_review"),
    ),
    delivered: v.boolean(),
    resendMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notificationLog", {
      userId: args.userId,
      relatedMyRaceId: args.myRaceId,
      type: args.type,
      sentAt: Date.now(),
      delivered: args.delivered,
      resendMessageId: args.resendMessageId,
      error: args.error,
    });
  },
});

// ===========================================================================
// Queries PÚBLICAS (llamadas desde endpoints Next.js y desde el cliente)
// ===========================================================================
// Diferencia con las internalQuery de arriba: estas son accesibles desde
// el cliente (app) y desde endpoints API. NO exponen secretos. La
// privacidad del diploma/card se gestiona a nivel de URL: la URL ya va
// firmada en el email al dueño del myRace; si la comparte, asume la
// responsabilidad (consistente con Strava y otras apps de running).
// ===========================================================================

/**
 * Devuelve los datos mínimos del myRace necesarios para servir el diploma
 * PDF. NO expone email ni datos sensibles — solo lo que el diploma muestra.
 */
export const getMyRaceForDiploma = query({
  args: { myRaceId: v.id("myRaces") },
  handler: async (ctx, { myRaceId }) => {
    const myRace = await ctx.db.get(myRaceId);
    if (!myRace) return null;
    return {
      _id: myRace._id,
      dorsalNumber: myRace.dorsalNumber,
      diplomaStorageId: myRace.diplomaStorageId,
      actualTimeSeconds: myRace.actualTimeSeconds,
      actualPosition: myRace.actualPosition,
      actualPositionCategory: myRace.actualPositionCategory,
    };
  },
});

/**
 * Devuelve los datos mínimos del myRace para servir el share card PNG.
 */
export const getMyRaceForShareCard = query({
  args: { myRaceId: v.id("myRaces") },
  handler: async (ctx, { myRaceId }) => {
    const myRace = await ctx.db.get(myRaceId);
    if (!myRace) return null;
    return {
      _id: myRace._id,
      shareCardStorageId: myRace.shareCardStorageId,
    };
  },
});

/**
 * Resuelve la URL firmada de un blob de Convex Storage. Expira en ~1h por
 * defecto (Convex la regenera cada vez). Esto está bien porque los
 * endpoints OG son cacheados por Vercel/CDN durante 1 año, así que solo
 * la primera vez se llama a esta query.
 */
export const getStorageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});

/**
 * Devuelve la metadata completa de un myRace (profile, race, PR) para
 * renderizar la página pública /resultado/{myRaceId}. No expone email.
 */
export const getMyRaceForPublicPage = query({
  args: { myRaceId: v.id("myRaces") },
  handler: async (ctx, { myRaceId }) => {
    const myRace = await ctx.db.get(myRaceId);
    if (!myRace) return null;
    const profile = await ctx.db.get(myRace.userId);
    const race = await ctx.db.get(myRace.raceId);
    if (!profile || !race) return null;
    const effectiveDistance = getEffectiveDistance(myRace, race);
    const distanceM = Math.round(effectiveDistance.distanceKm * 1000);
    const currentPR = await ctx.db
      .query("personalRecords")
      .withIndex("by_user_distance_current", (q) =>
        q
          .eq("userId", profile._id)
          .eq("distanceM", distanceM)
          .eq("isCurrent", true),
      )
      .unique();
    return {
      myRace: {
        _id: myRace._id,
        dorsalNumber: myRace.dorsalNumber,
        actualTimeSeconds: myRace.actualTimeSeconds,
        actualPosition: myRace.actualPosition,
        actualPositionCategory: myRace.actualPositionCategory,
        diplomaStorageId: myRace.diplomaStorageId,
        shareCardStorageId: myRace.shareCardStorageId,
      },
      profile: {
        _id: profile._id,
        displayName: profile.displayName,
      },
      race: {
        _id: race._id,
        name: race.name,
        slug: race.slug,
        distanceKm: effectiveDistance.distanceKm,
        startDate: race.startDate,
        locality: race.locality,
        resultsUrl: race.resultsUrl,
      },
      currentPR: currentPR
        ? { timeSeconds: currentPR.timeSeconds, achievedAt: currentPR.achievedAt }
        : null,
    };
  },
});

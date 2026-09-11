// =============================================================================
// mi-dorsal — Editor de sticker personalizable (feature premium)
// =============================================================================
// Queries/mutations para /editor-sticker/{myRaceId} y /mi-sticker. Ver spec
// docs/superpowers/specs/2026-09-10-sticker-editor-design.md.
//
// A diferencia de diploma/share-card/story-sticker (generados server-side
// por convex/emailNotificationsAction.ts), el PNG personalizado se exporta
// 100% client-side (html-to-image) y solo se sube aquí para persistirlo.
// =============================================================================

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./_helpers";
import { hasPremiumAccess } from "./subscriptions";
import { getEffectiveDistance } from "../lib/prediction/effective-distance";
import { Id } from "./_generated/dataModel";

/**
 * Datos completos para montar el editor: carrera + corredor + PR + mapa de
 * ruta (si hay actividad vinculada) + plantilla propia del usuario (si la
 * guardó antes) + storageId del sticker personalizado ya exportado (si
 * existe, para poder mostrarlo/redescargarlo).
 */
export const getEditorData = query({
  args: { myRaceId: v.id("myRaces") },
  handler: async (ctx, { myRaceId }) => {
    const user = await requireUser(ctx);
    const myRace = await ctx.db.get(myRaceId);
    if (!myRace) return null;
    if (myRace.userId !== user._id) return null;

    const race = await ctx.db.get(myRace.raceId);
    if (!race) return null;

    const effectiveDistance = getEffectiveDistance(myRace, race);
    const distanceM = Math.round(effectiveDistance.distanceKm * 1000);

    const currentPR = await ctx.db
      .query("personalRecords")
      .withIndex("by_user_distance_current", (q) =>
        q.eq("userId", user._id).eq("distanceM", distanceM).eq("isCurrent", true),
      )
      .unique();

    // Resolución del mapa de ruta: no hay vínculo directo myRace→activity.
    // Buscamos actividades del usuario vinculadas a esta carrera
    // (matchedRaceId == myRace.raceId) y nos quedamos con la de mayor
    // distancia (heurística: la carrera real, no un calentamiento corto).
    const candidateActivities = await ctx.db
      .query("activities")
      .withIndex("by_matched_race", (q) => q.eq("matchedRaceId", myRace.raceId))
      .filter((q) => q.eq(q.field("userId"), myRace.userId))
      .collect();
    const bestActivity = candidateActivities.sort((a, b) => b.distanceM - a.distanceM)[0];
    const mapPolyline = bestActivity?.mapPolyline;

    return {
      myRace: {
        _id: myRace._id,
        dorsalNumber: myRace.dorsalNumber,
        actualTimeSeconds: myRace.actualTimeSeconds,
        actualPosition: myRace.actualPosition,
        actualPositionCategory: myRace.actualPositionCategory,
        customStickerStorageId: myRace.customStickerStorageId,
      },
      race: {
        name: race.name,
        startDate: race.startDate,
        distanceLabel: effectiveDistance.label,
        distanceKm: effectiveDistance.distanceKm,
      },
      runnerName: user.displayName ?? "Corredor",
      currentPR: currentPR ? { timeSeconds: currentPR.timeSeconds } : null,
      mapPolyline: mapPolyline ?? null,
      customStickerTemplate: user.customStickerTemplate ?? null,
    };
  },
});

/**
 * Guarda (o sobrescribe) la plantilla propia del usuario actual. 1 sola
 * por usuario — sin historial. Requiere premium (mismo criterio de
 * feature gating que el resto del editor).
 */
export const saveCustomTemplate = mutation({
  args: {
    baseTemplateId: v.string(),
    elements: v.array(
      v.object({
        fieldId: v.string(),
        visible: v.boolean(),
        x: v.number(),
        y: v.number(),
        scale: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const isPremium = await hasPremiumAccess(ctx, identity.subject);
    if (!isPremium) {
      throw new Error("Esta función requiere una cuenta Premium");
    }
    await ctx.db.patch(user._id, {
      customStickerTemplate: {
        baseTemplateId: args.baseTemplateId,
        elements: args.elements,
      },
    });
  },
});

/**
 * Genera una signed upload URL de Convex Storage, invocable directamente
 * desde el navegador (a diferencia de convexStorageGenerateUploadUrl en
 * lib/convexStorage.ts, que usa ConvexHttpClient y solo funciona
 * server-side). Requiere premium.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const isPremium = await hasPremiumAccess(ctx, identity.subject);
    if (!isPremium) {
      throw new Error("Esta función requiere una cuenta Premium");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Asocia el PNG recién subido (storageId) a la myRace, sobrescribiendo el
 * anterior si existía. A diferencia de diploma/share-card (que se generan
 * una sola vez), este campo se puede regenerar muchas veces — hay que
 * borrar el blob previo o se acumulan huérfanos en Storage.
 */
export const attachCustomSticker = mutation({
  args: {
    myRaceId: v.id("myRaces"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { myRaceId, storageId }) => {
    const user = await requireUser(ctx);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const isPremium = await hasPremiumAccess(ctx, identity.subject);
    if (!isPremium) {
      throw new Error("Esta función requiere una cuenta Premium");
    }

    const myRace = await ctx.db.get(myRaceId);
    if (!myRace) throw new Error("myRace no encontrada");
    if (myRace.userId !== user._id) {
      throw new Error("Forbidden: esta myRace pertenece a otro usuario");
    }

    if (myRace.customStickerStorageId) {
      await ctx.storage.delete(myRace.customStickerStorageId);
    }

    await ctx.db.patch(myRaceId, { customStickerStorageId: storageId as Id<"_storage"> });
  },
});

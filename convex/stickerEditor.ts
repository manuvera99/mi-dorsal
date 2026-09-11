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
import { mutation, query, action } from "./_generated/server";
import { requireUser } from "./_helpers";
import { hasPremiumAccess } from "./subscriptions";
import { getEffectiveDistance } from "../lib/prediction/effective-distance";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

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
        bgOpacity: v.optional(v.number()),
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

    const previousStorageId = myRace.customStickerStorageId;

    await ctx.db.patch(myRaceId, { customStickerStorageId: storageId as Id<"_storage"> });

    if (previousStorageId) {
      await ctx.storage.delete(previousStorageId);
    }
  },
});

/**
 * Devuelve los datos mínimos del myRace para servir el sticker
 * personalizado PNG. Pública (sin auth) — mismo criterio que
 * getMyRaceForShareCard/getMyRaceForStorySticker en
 * emailNotificationsHelpers.ts: el endpoint de descarga es público.
 */
export const getMyRaceForCustomSticker = query({
  args: { myRaceId: v.id("myRaces") },
  handler: async (ctx, { myRaceId }) => {
    const myRace = await ctx.db.get(myRaceId);
    if (!myRace) return null;
    return {
      _id: myRace._id,
      customStickerStorageId: myRace.customStickerStorageId,
    };
  },
});

/**
 * Envía el sticker personalizado (ya exportado client-side a PNG) al
 * email de la cuenta del usuario actual, como adjunto. No genera nada
 * server-side — recibe el PNG en base64 tal cual lo produjo
 * html-to-image en el navegador (mismo buffer que se descarga y se sube
 * a Storage vía attachCustomSticker).
 */
export const emailCustomSticker = action({
  args: {
    myRaceId: v.id("myRaces"),
    raceName: v.string(),
    pngBase64: v.string(),
  },
  handler: async (ctx, { myRaceId, raceName, pngBase64 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // hasPremiumAccess() necesita QueryCtx/MutationCtx (ctx.db directo),
    // no disponible dentro de una action — reutilizamos la query pública
    // ya existente, que hace la misma comprobación vía ctx.runQuery.
    const premiumStatus = await ctx.runQuery(api.subscriptions.getMyPremiumStatus, {});
    if (!premiumStatus.hasAccess) {
      throw new Error("Esta función requiere una cuenta Premium");
    }

    const profile = await ctx.runQuery(api.users.getProfileByClerkId, {
      clerkUserId: identity.subject,
    });
    if (!profile) throw new Error("Perfil no encontrado");
    const email = profile.email;
    if (!email) {
      throw new Error("Tu cuenta no tiene un email verificado para recibir el envío");
    }

    const isMock = !process.env.RESEND_API_KEY;
    if (isMock) {
      console.log(`[sticker-email-mock] Would send to ${email} for myRace ${myRaceId}`);
      return { success: true, mocked: true };
    }

    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "mi-dorsal <hola@mi-dorsal.com>";

    const result = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `Tu sticker de ${raceName} — mi-dorsal`,
      html: `<p>Aquí tienes tu sticker personalizado de <strong>${raceName}</strong>, listo para subir a tus Stories de Instagram/TikTok.</p><p>— El equipo de mi-dorsal</p>`,
      text: `Aquí tienes tu sticker personalizado de ${raceName}, listo para subir a tus Stories de Instagram/TikTok.`,
      attachments: [
        {
          filename: `mi-dorsal-sticker-${myRaceId}.png`,
          content: pngBase64,
        },
      ] as any,
    });

    if (result.error) {
      throw new Error(`Resend error: ${result.error.message}`);
    }

    return { success: true, id: result.data?.id };
  },
});

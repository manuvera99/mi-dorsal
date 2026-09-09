// =============================================================================
// mi-dorsal — Email: sendResultFoundEmail (action)
// =============================================================================
// Action que se llama desde convex/crons/checkResults.ts cuando un cron
// detecta un resultado oficial nuevo para una myRace. Es la responsable
// de orquestar TODO el flujo post-resultado:
//
//   1. Lee profile + myRace + race + PR actual
//   2. Calcula si el resultado bate el PR (sin modificarlo aún)
//   3. Genera el diploma PDF (lib/pdf/diploma.tsx)
//   4. Genera el share card PNG 1200x630 (lib/share-card/render.tsx)
//   5. Sube ambos a Convex Storage y guarda los IDs en myRaces
//   6. Renderiza el email HTML con todos los datos
//   7. Envía el email con Resend: diploma PDF como attachment + share card
//      PNG inline con cid: (para que se vea en la bandeja sin hacer clic)
//   8. Log a notificationLog (idempotente)
//
// El PR se persiste DESPUÉS desde checkResults.ts (updateIfBetter), que
// recibe el previousTimeSeconds implícito en el flujo.
// =============================================================================

import { internalAction, internalQuery, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { renderDiploma, DiplomaProps } from "@/lib/pdf/diploma";
import { renderShareCard, ShareCardProps } from "@/lib/share-card/render";
import { resultFoundEmail } from "./emails/templates/resultFound";

// ===========================================================================
// Queries auxiliares (lectura desde la action)
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

    // PR actual en la distancia del race (sin modificarlo)
    const distanceM = Math.round(race.distanceKm * 1000);
    const currentPR = await ctx.db
      .query("personalRecords")
      .withIndex("by_user_distance_current", (q) =>
        q
          .eq("userId", profile._id)
          .eq("distanceM", distanceM)
          .eq("isCurrent", true),
      )
      .unique();

    return { myRace, profile, race, currentPR };
  },
});

// ===========================================================================
// Action principal
// ===========================================================================

export const sendResultFoundEmail = internalAction({
  args: {
    userId: v.id("profiles"),
    myRaceId: v.id("myRaces"),
    raceName: v.string(),
    raceDate: v.string(),
    timeSeconds: v.number(),
    positionOverall: v.optional(v.number()),
    positionCategory: v.optional(v.number()),
    predictedTimeSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const IS_MOCK = !process.env.RESEND_API_KEY;
    const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://www.mi-dorsal.com").replace(/\/$/, "");

    // ---------- 1. Cargar datos completos desde Convex ----------
    const data = await ctx.runQuery(internal.emailNotifications.getDataForEmail, {
      myRaceId: args.myRaceId,
    });
    if (!data) {
      console.warn(`[result-found] myRace ${args.myRaceId} not found, skipping`);
      return { success: false, reason: "myRace_not_found" as const };
    }
    const { myRace, profile, race, currentPR } = data;
    if (!profile.email) {
      console.warn(`[result-found] profile ${profile._id} has no email, skipping`);
      return { success: false, reason: "no_email" as const };
    }

    // Idempotencia: si ya se envió este email para esta myRace, no repetir.
    const alreadySent = await ctx.runQuery(internal.emailNotifications.hasLogForMyRace, {
      userId: profile._id,
      myRaceId: myRace._id,
      type: "result_found",
    });
    if (alreadySent) {
      return { success: true, reason: "already_sent" as const };
    }

    // ---------- 2. Calcular PR ----------
    const distanceM = Math.round(race.distanceKm * 1000);
    const isPR =
      currentPR != null &&
      args.timeSeconds < currentPR.timeSeconds;
    const prDeltaSeconds =
      isPR && currentPR ? currentPR.timeSeconds - args.timeSeconds : undefined;
    const previousRecordFormatted = currentPR ? formatHMS(currentPR.timeSeconds) : undefined;
    const distanceLabel = getDistanceLabel(distanceM);

    // ---------- 3. Generar diploma PDF ----------
    const issuedAt = new Date();
    const verificationId = `MD-${myRace.dorsalNumber ?? "X"}-${(race.startDate ?? "0000-00-00").replace(/-/g, "")}`;

    const diplomaProps: DiplomaProps = {
      runnerName: profile.displayName ?? "Corredor",
      raceName: race.name,
      raceDate: args.raceDate,
      distanceKm: race.distanceKm,
      distanceLabel,
      timeFormatted: formatHMS(args.timeSeconds),
      timeSeconds: args.timeSeconds,
      dorsalNumber: myRace.dorsalNumber ?? "—",
      paceFormatted: formatPace(args.timeSeconds, race.distanceKm),
      positionOverall: args.positionOverall,
      positionCategory: args.positionCategory,
      isPersonalRecord: isPR,
      previousRecordFormatted,
      prDeltaSeconds,
      verificationId,
      appUrl: APP_URL,
      issuedAt,
    };
    const pdfBuffer = await renderDiploma(diplomaProps);

    // ---------- 4. Generar share card PNG ----------
    const cardProps: ShareCardProps = {
      ...diplomaProps,
    };
    const pngBuffer = await renderShareCard(cardProps);

    // ---------- 5. Subir a Convex Storage ----------
    // `body: new Uint8Array(buf)` evita el lío de tipos Buffer vs BodyInit
    // en TS estricto (Buffer extends Uint8Array pero fetch espera BodyInit).
    const diplomaUploadUrl = await ctx.storage.generateUploadUrl();
    const diplomaUploadRes = await fetch(diplomaUploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: new Uint8Array(pdfBuffer),
    });
    if (!diplomaUploadRes.ok) {
      throw new Error(`Diploma upload failed: ${diplomaUploadRes.status}`);
    }
    const diplomaBlob = await diplomaUploadRes.json();
    const diplomaStorageId = diplomaBlob.storageId as Id<"_storage">;

    const cardUploadUrl = await ctx.storage.generateUploadUrl();
    const cardUploadRes = await fetch(cardUploadUrl, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: new Uint8Array(pngBuffer),
    });
    if (!cardUploadRes.ok) {
      throw new Error(`Share card upload failed: ${cardUploadRes.status}`);
    }
    const cardBlob = await cardUploadRes.json();
    const shareCardStorageId = cardBlob.storageId as Id<"_storage">;

    // Persistir storage IDs en myRace para descargas futuras
    await ctx.runMutation(internal.emailNotifications.attachStorageIds, {
      myRaceId: myRace._id,
      diplomaStorageId,
      shareCardStorageId,
    });

    // ---------- 6. Renderizar email ----------
    const diplomaUrl = `${APP_URL}/api/diploma/${myRace._id}.pdf`;
    const shareCardUrl = `${APP_URL}/api/result/${myRace._id}/share-card.png`;
    const classificationUrl = race.resultsUrl ?? `${APP_URL}/carreras/${race.slug ?? ""}`;
    const predictionBlock = args.predictedTimeSeconds
      ? {
          predictedTimeFormatted: formatHMS(args.predictedTimeSeconds),
          errorPct:
            ((args.timeSeconds - args.predictedTimeSeconds) / args.predictedTimeSeconds) * 100,
        }
      : {};

    const { subject, html, text } = resultFoundEmail({
      userName: profile.displayName ?? "corredor",
      raceName: race.name,
      raceDate: args.raceDate,
      timeFormatted: formatHMS(args.timeSeconds),
      positionOverall: args.positionOverall,
      positionCategory: args.positionCategory,
      isPersonalRecord: isPR,
      previousRecordFormatted,
      prDeltaSeconds,
      distanceLabel,
      classificationUrl,
      diplomaUrl,
      shareUrl: shareCardUrl,
      appUrl: APP_URL,
      ...predictionBlock,
    });

    // Inyectar el inline cid: del share card en el HTML. Se hace aquí
    // porque el template no conoce el cid (mantenemos el template puro).
    const INLINE_CID = "sharecard@mi-dorsal";
    const htmlWithInline = html.replace(
      /<\/head>/,
      `<style>.share-card-hero img{max-width:100%;height:auto;border-radius:8px;display:block;}</style></head>`,
    ).replace(
      /<!--SHARE_CARD_INLINE-->/g,
      `<img class="share-card-hero" src="cid:${INLINE_CID}" alt="Tu resultado en ${escapeAttr(race.name)}" width="480" />`,
    );

    // ---------- 7. Enviar email ----------
    let success = false;
    let resendId: string | undefined;
    let errorMsg: string | undefined;
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "mi-dorsal <hola@mi-dorsal.com>";

    if (IS_MOCK) {
      console.log(
        `[result-found-mock] → ${profile.email} | ${subject} | diploma=${(pdfBuffer.length / 1024).toFixed(1)}KB card=${(pngBuffer.length / 1024).toFixed(1)}KB`,
      );
      success = true;
    } else {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(stripBom(process.env.RESEND_API_KEY!));
        const result = await resend.emails.send({
          from: stripBom(fromEmail),
          to: profile.email,
          subject,
          html: htmlWithInline,
          text,
          // Resend acepta `content_id` (snake_case) en attachments, pero
          // el tipo público `Attachment` no lo expone. Lo casteamos a
          // `any` para no pelearnos con el tipado.
          attachments: [
            {
              filename: `mi-dorsal-${verificationId}.pdf`,
              content: pdfBuffer.toString("base64"),
            },
            {
              filename: `mi-dorsal-${verificationId}.png`,
              content: pngBuffer.toString("base64"),
              content_id: INLINE_CID,
            },
          ] as any,
        });
        resendId = result.data?.id;
        success = true;
      } catch (err) {
        success = false;
        errorMsg = String(err);
        console.error(`[result-found] ${profile.email} failed:`, err);
      }
    }

    // ---------- 8. Log ----------
    await ctx.runMutation(internal.emailNotifications.writeLog, {
      userId: profile._id,
      myRaceId: myRace._id,
      type: "result_found",
      delivered: success,
      resendMessageId: resendId,
      error: errorMsg,
    });

    return {
      success,
      reason: "sent" as const,
      resendId,
      isPR,
      diplomaStorageId,
      shareCardStorageId,
      error: errorMsg,
    };
  },
});

// ===========================================================================
// Mutations / queries internas (helpers de la action)
// ===========================================================================

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
// Helpers puros
// ===========================================================================

function formatHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function formatPace(timeSeconds: number, distanceKm: number): string {
  if (distanceKm <= 0) return "—";
  const paceSec = timeSeconds / distanceKm;
  const m = Math.floor(paceSec / 60);
  const s = Math.round(paceSec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getDistanceLabel(distanceM: number): string {
  if (distanceM === 5000) return "5K";
  if (distanceM === 10000) return "10K";
  if (distanceM === 15000) return "15K";
  if (distanceM === 21097) return "Media maratón";
  if (distanceM === 42195) return "Maratón";
  // Fallback genérico
  if (distanceM < 21000) return `${(distanceM / 1000).toFixed(0)}K`;
  return `${(distanceM / 1000).toFixed(1)}K`;
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, "");
}

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
    const distanceM = Math.round(race.distanceKm * 1000);
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
        distanceKm: race.distanceKm,
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

// =============================================================================
// mi-dorsal — Email: sendResultFoundEmail + sendReminderEmail (actions)
// =============================================================================
// sendResultFoundEmail se llama desde convex/crons/checkResults.ts cuando
// un cron detecta un resultado oficial nuevo para una myRace. Es la
// responsable de orquestar TODO el flujo post-resultado:
//
//   1. Lee profile + myRace + race + PR actual
//   2. Calcula si el resultado bate el PR (sin modificarlo aún)
//   3. Pide el diploma PDF + share card PNG a
//      app/api/internal/render-diploma (ver nota abajo)
//   4. Sube ambos a Convex Storage y guarda los IDs en myRaces
//   5. Renderiza el email HTML con todos los datos
//   6. Envía el email con Resend: diploma PDF como attachment + share card
//      PNG inline con cid: (para que se vea en la bandeja sin hacer clic)
//   7. Log a notificationLog (idempotente)
//
// El PR se persiste DESPUÉS desde checkResults.ts (updateIfBetter), que
// recibe el previousTimeSeconds implícito en el flujo.
//
// Por qué el PDF/PNG NO se generan aquí con renderDiploma/renderShareCard:
// esas funciones usan @react-pdf/renderer (pdfkit) y @vercel/og (satori),
// que leen assets binarios (TTF, WASM) con fs.readFileSync desde rutas
// relativas al propio paquete al cargar el módulo. El paso de análisis de
// `npx convex deploy` EJECUTA el módulo para bundlearlo y falla con ENOENT
// porque esos assets no existen en el sandbox de Convex (aunque sí existen
// en el Lambda de Vercel, vía next.config.js outputFileTracingIncludes).
// Por eso la generación real vive en
// app/api/internal/render-diploma/route.ts (runtime Node de Vercel, ya
// verificado en producción) y esta action solo hace fetch a ese endpoint.
//
// Por qué este archivo NO vive en convex/actions/: Convex exige "use node"
// para TODO archivo dentro de esa carpeta (legado — ver docs de actions),
// y estas actions ya no usan fs/path (sendResultFoundEmail delega en el
// endpoint interno de Next.js; sendReminderEmail nunca lo necesitó), así
// que no necesitan el runtime Node. Se referencian como
// internal.emailNotificationsAction.sendResultFoundEmail /
// internal.emailNotificationsAction.sendReminderEmail.
// Las queries/mutations que sirven al front (getMyRaceForDiploma,
// getStorageUrl, etc.) viven en convex/emailNotificationsHelpers.ts.
//
// sendReminderEmail (7 días / 1 día antes de la carrera) se llama desde
// convex/crons/reminderPreRace.ts. No genera PDF ni sube nada a Storage —
// solo renderiza y envía el email con fecha/hora/lugar/dorsal/predicción.
// Ver su implementación más abajo para el detalle de `testOverrideTo`.
// =============================================================================

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import type { DiplomaProps } from "../lib/pdf/diploma";
import type { ShareCardProps } from "../lib/share-card/render";
import { resultFoundEmail } from "./emails/templates/resultFound";
import { reminderEmail } from "./emails/templates/reminder";

/**
 * Llama a /api/internal/render-diploma (Next.js, runtime Node) para
 * generar el PDF+PNG. Ver nota arriba sobre por qué no se genera in-process.
 */
async function renderViaInternalApi(
  diploma: DiplomaProps,
  shareCard: ShareCardProps,
): Promise<{ pdfBuffer: Buffer; pngBuffer: Buffer }> {
  const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://www.mi-dorsal.com").replace(/\/$/, "");
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    throw new Error("INTERNAL_API_SECRET no configurado en Convex env vars");
  }

  const res = await fetch(`${APP_URL}/api/internal/render-diploma`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": secret,
    },
    body: JSON.stringify({ diploma, shareCard }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`render-diploma endpoint failed: ${res.status} ${detail}`);
  }
  const { diplomaBase64, shareCardBase64 } = (await res.json()) as {
    diplomaBase64: string;
    shareCardBase64: string;
  };
  return {
    pdfBuffer: Buffer.from(diplomaBase64, "base64"),
    pngBuffer: Buffer.from(shareCardBase64, "base64"),
  };
}

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
    const data = await ctx.runQuery(internal.emailNotificationsHelpers.getDataForEmail, {
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
    const alreadySent = await ctx.runQuery(internal.emailNotificationsHelpers.hasLogForMyRace, {
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
      myRaceId: myRace._id,
    };
    // ---------- 4. Generar diploma PDF + share card PNG ----------
    // (vía el endpoint interno de Next.js — ver nota al inicio del archivo)
    const cardProps: ShareCardProps = {
      ...diplomaProps,
    };
    const { pdfBuffer, pngBuffer } = await renderViaInternalApi(diplomaProps, cardProps);

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
    const diplomaBlob = (await diplomaUploadRes.json()) as { storageId: string };
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
    const cardBlob = (await cardUploadRes.json()) as { storageId: string };
    const shareCardStorageId = cardBlob.storageId as Id<"_storage">;

    // Persistir storage IDs en myRace para descargas futuras
    await ctx.runMutation(internal.emailNotificationsHelpers.attachStorageIds, {
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
    await ctx.runMutation(internal.emailNotificationsHelpers.writeLog, {
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
// Action: sendReminderEmail (7 días / 1 día antes de la carrera)
// ===========================================================================
// Llamada desde convex/crons/reminderPreRace.ts. A diferencia de
// sendResultFoundEmail, no genera PDF ni sube nada a Storage — solo
// renderiza y envía el email con fecha/hora/lugar/dorsal/predicción.
//
// `testOverrideTo` (opcional): si se pasa, el email se envía a esa
// dirección en vez de al email del profile, y NO se escribe en
// notificationLog (así se puede repetir la prueba sin "gastar" la
// idempotencia real de reminder_7d/reminder_1d para ese usuario/carrera).
// Pensado para pruebas manuales, nunca lo usa el cron.
// ===========================================================================

export const sendReminderEmail = internalAction({
  args: {
    userId: v.id("profiles"),
    myRaceId: v.id("myRaces"),
    raceName: v.string(),
    dorsalNumber: v.optional(v.string()),
    predictedTimeSeconds: v.optional(v.number()),
    daysUntil: v.union(v.literal(7), v.literal(1)),
    testOverrideTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const IS_MOCK = !process.env.RESEND_API_KEY;
    const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://www.mi-dorsal.com").replace(/\/$/, "");
    const isTest = !!args.testOverrideTo;

    // ---------- 1. Cargar datos completos desde Convex ----------
    const data = await ctx.runQuery(internal.emailNotificationsHelpers.getDataForEmail, {
      myRaceId: args.myRaceId,
    });
    if (!data) {
      console.warn(`[reminder] myRace ${args.myRaceId} not found, skipping`);
      return { success: false, reason: "myRace_not_found" as const };
    }
    const { myRace, profile, race } = data;

    const toEmail = args.testOverrideTo ?? profile.email;
    if (!toEmail) {
      console.warn(`[reminder] profile ${profile._id} has no email, skipping`);
      return { success: false, reason: "no_email" as const };
    }

    // Idempotencia: si ya se envió este recordatorio para esta myRace, no
    // repetir. Se salta por completo en modo test (testOverrideTo) para
    // poder reenviar la prueba las veces que haga falta.
    const notifType = args.daysUntil === 7 ? "reminder_7d" : "reminder_1d";
    if (!isTest) {
      const alreadySent = await ctx.runQuery(internal.emailNotificationsHelpers.hasLogForMyRace, {
        userId: profile._id,
        myRaceId: myRace._id,
        type: notifType,
      });
      if (alreadySent) {
        return { success: true, reason: "already_sent" as const };
      }
    }

    // ---------- 2. Preparar datos para la plantilla ----------
    const distanceM = Math.round(race.distanceKm * 1000);
    const distanceLabel = getDistanceLabel(distanceM);
    const raceDateFormatted = race.startDate
      ? new Date(race.startDate).toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })
      : args.raceName;
    const raceUrl = race.officialUrl
      ?? race.registrationUrl
      ?? `${APP_URL}/carreras/${race.slug ?? ""}`;

    const { subject, html, text } = reminderEmail({
      userName: profile.displayName ?? "corredor",
      raceName: args.raceName,
      raceDate: raceDateFormatted,
      raceTime: race.startTime,
      venue: race.venue ?? race.locality,
      distanceLabel,
      dorsalNumber: args.dorsalNumber,
      predictedTimeFormatted: args.predictedTimeSeconds
        ? formatHMS(args.predictedTimeSeconds)
        : undefined,
      daysUntil: args.daysUntil,
      raceUrl,
      appUrl: APP_URL,
    });

    // ---------- 3. Enviar email ----------
    let success = false;
    let resendId: string | undefined;
    let errorMsg: string | undefined;
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "mi-dorsal <hola@mi-dorsal.com>";

    if (IS_MOCK) {
      console.log(`[reminder-mock] ${notifType} → ${toEmail} | ${subject}`);
      success = true;
    } else {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(stripBom(process.env.RESEND_API_KEY!));
        const result = await resend.emails.send({
          from: stripBom(fromEmail),
          to: toEmail,
          subject: isTest ? `[PRUEBA] ${subject}` : subject,
          html,
          text,
        });
        resendId = result.data?.id;
        success = true;
      } catch (err) {
        success = false;
        errorMsg = String(err);
        console.error(`[reminder] ${toEmail} failed:`, err);
      }
    }

    // ---------- 4. Log (se salta en modo test) ----------
    if (!isTest) {
      await ctx.runMutation(internal.emailNotificationsHelpers.writeLog, {
        userId: profile._id,
        myRaceId: myRace._id,
        type: notifType,
        delivered: success,
        resendMessageId: resendId,
        error: errorMsg,
      });
    }

    return {
      success,
      reason: "sent" as const,
      resendId,
      to: toEmail,
      error: errorMsg,
    };
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
  return s.replace(/^﻿/, "");
}

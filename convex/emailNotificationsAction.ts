// =============================================================================
// mi-dorsal — Email: sendResultFoundEmail + sendReminderEmail +
//                     sendResultNotFoundEmail (actions)
// =============================================================================
// sendResultFoundEmail se llama desde convex/crons/checkResults.ts cuando
// un cron detecta un resultado oficial nuevo para una myRace. Es la
// responsable de orquestar TODO el flujo post-resultado:
//
//   1. Lee profile + myRace + race + PR actual
//   2. Calcula si el resultado bate el PR (sin modificarlo aún)
//   3. Pide el diploma PDF + story sticker PNG (plantilla clásica) a
//      app/api/internal/render-diploma (ver nota abajo)
//   4. Sube ambos a Convex Storage y guarda los IDs en myRaces
//   5. Renderiza el email HTML con todos los datos
//   6. Envía el email con Resend: diploma PDF como attachment + sticker
//      PNG inline con cid: (para que se vea en la bandeja sin hacer clic)
//   7. Log a notificationLog (idempotente)
//
// El PR se persiste DESPUÉS desde checkResults.ts (updateIfBetter), que
// recibe el previousTimeSeconds implícito en el flujo.
//
// Por qué el PDF/PNG NO se generan aquí con renderDiploma/renderStorySticker:
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
//
// sendResultNotFoundEmail (>=48h sin resultado scrapeado) se llama desde
// convex/crons/resultNotFound.ts. Avisa al usuario y le ofrece meter su
// tiempo a mano en /calendario (myRaces.setManualResult). También acepta
// `testOverrideTo` con el mismo comportamiento que sendReminderEmail.
// Además, cada vez que se dispara de verdad (no en modo test), manda un
// segundo aviso a hola@mi-dorsal.com (sendAdminAlert) — es la señal de
// que el scraper de esa carrera no está funcionando.
// =============================================================================

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import type { DiplomaProps } from "../lib/pdf/diploma";
import type { StoryStickerProps } from "../lib/share-card/story-sticker";
import { resultFoundEmail } from "./emails/templates/resultFound";
import { reminderEmail } from "./emails/templates/reminder";
import { resultNotFoundEmail } from "./emails/templates/resultNotFound";

/**
 * Este archivo corre en el runtime V8 isolate de Convex (sin "use node",
 * a propósito — ver nota arriba), que no expone el global `Buffer` de
 * Node.js. Usamos `atob`/`btoa` (Web APIs estándar, sí disponibles aquí)
 * para convertir entre base64 y `Uint8Array`.
 */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * Llama a /api/internal/render-diploma (Next.js, runtime Node) para
 * generar el PDF + los dos PNGs (sticker overlay transparente + variante
 * email fondo crema). Ver nota arriba sobre por qué no se genera
 * in-process.
 */
async function renderViaInternalApi(
  diploma: DiplomaProps,
  storySticker: StoryStickerProps,
): Promise<{ pdfBytes: Uint8Array; stickerBytes: Uint8Array; stickerEmailBytes: Uint8Array }> {
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
    body: JSON.stringify({ diploma, storySticker }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`render-diploma endpoint failed: ${res.status} ${detail}`);
  }
  const { diplomaBase64, storyStickerBase64, storyStickerEmailBase64 } = (await res.json()) as {
    diplomaBase64: string;
    storyStickerBase64: string;
    storyStickerEmailBase64: string;
  };
  return {
    pdfBytes: base64ToBytes(diplomaBase64),
    stickerBytes: base64ToBytes(storyStickerBase64),
    stickerEmailBytes: base64ToBytes(storyStickerEmailBase64),
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
    const { myRace, profile, race, currentPR, effectiveDistance } = data;
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
    const distanceM = Math.round(effectiveDistance.distanceKm * 1000);
    const isPR =
      currentPR != null &&
      args.timeSeconds < currentPR.timeSeconds;
    const prDeltaSeconds =
      isPR && currentPR ? currentPR.timeSeconds - args.timeSeconds : undefined;
    const previousRecordFormatted = currentPR ? formatHMS(currentPR.timeSeconds) : undefined;
    const distanceLabel = effectiveDistance.label;

    // ---------- 3. Generar diploma PDF ----------
    const issuedAt = new Date();
    const verificationId = `MD-${myRace.dorsalNumber ?? "X"}-${(race.startDate ?? "0000-00-00").replace(/-/g, "")}`;

    const diplomaProps: DiplomaProps = {
      runnerName: profile.displayName ?? "Corredor",
      raceName: race.name,
      raceDate: args.raceDate,
      distanceKm: effectiveDistance.distanceKm,
      distanceLabel,
      timeFormatted: formatHMS(args.timeSeconds),
      timeSeconds: args.timeSeconds,
      dorsalNumber: myRace.dorsalNumber ?? "—",
      paceFormatted: formatPace(args.timeSeconds, effectiveDistance.distanceKm),
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
    // ---------- 4. Generar diploma PDF + story sticker (plantilla clásica) ----------
    // (vía el endpoint interno de Next.js — ver nota al inicio del archivo)
    const stickerProps: StoryStickerProps = {
      timeFormatted: diplomaProps.timeFormatted,
      paceFormatted: diplomaProps.paceFormatted,
      distanceKm: diplomaProps.distanceKm,
      isPersonalRecord: diplomaProps.isPersonalRecord,
    };
    const { pdfBytes, stickerBytes, stickerEmailBytes } = await renderViaInternalApi(diplomaProps, stickerProps);

    // ---------- 5. Subir a Convex Storage ----------
    // `as any`: fetch acepta Uint8Array en runtime, pero su tipo genérico
    // (Uint8Array<ArrayBufferLike>) no encaja exactamente con BodyInit bajo
    // lib DOM estricta (el build de Next/Vercel sí la usa, a diferencia del
    // tsconfig de Convex — que además no declara BodyInit al no tener DOM).
    const diplomaUploadUrl = await ctx.storage.generateUploadUrl();
    const diplomaUploadRes = await fetch(diplomaUploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: pdfBytes as any,
    });
    if (!diplomaUploadRes.ok) {
      throw new Error(`Diploma upload failed: ${diplomaUploadRes.status}`);
    }
    const diplomaBlob = (await diplomaUploadRes.json()) as { storageId: string };
    const diplomaStorageId = diplomaBlob.storageId as Id<"_storage">;

    const stickerUploadUrl = await ctx.storage.generateUploadUrl();
    const stickerUploadRes = await fetch(stickerUploadUrl, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: stickerBytes as any,
    });
    if (!stickerUploadRes.ok) {
      throw new Error(`Story sticker upload failed: ${stickerUploadRes.status}`);
    }
    const stickerBlob = (await stickerUploadRes.json()) as { storageId: string };
    const storyStickerStorageId = stickerBlob.storageId as Id<"_storage">;

    // Variante email (fondo crema + textos oscuros) para inline en el
    // email. Independiente del overlay transparente: la descarga sigue
    // sirviendo el overlay, el email incrusta esta versión.
    const stickerEmailUploadUrl = await ctx.storage.generateUploadUrl();
    const stickerEmailUploadRes = await fetch(stickerEmailUploadUrl, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: stickerEmailBytes as any,
    });
    if (!stickerEmailUploadRes.ok) {
      throw new Error(`Story sticker (email variant) upload failed: ${stickerEmailUploadRes.status}`);
    }
    const stickerEmailBlob = (await stickerEmailUploadRes.json()) as { storageId: string };
    const storyStickerEmailStorageId = stickerEmailBlob.storageId as Id<"_storage">;

    // Persistir storage IDs en myRace para descargas futuras
    await ctx.runMutation(internal.emailNotificationsHelpers.attachStorageIds, {
      myRaceId: myRace._id,
      diplomaStorageId,
      storyStickerStorageId,
      storyStickerEmailStorageId,
    });

    // ---------- 6. Renderizar email ----------
    const diplomaUrl = `${APP_URL}/api/diploma/${myRace._id}.pdf`;
    const stickerUrl = `${APP_URL}/api/result/${myRace._id}/story-sticker.png`;
    const stickerEditorUrl = `${APP_URL}/editor-sticker/${myRace._id}`;
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
      shareUrl: stickerUrl,
      stickerEditorUrl,
      appUrl: APP_URL,
      ...predictionBlock,
    });

    // Inyectar el inline cid: del sticker en el HTML. Se hace aquí porque
    // el template no conoce el cid (mantenemos el template puro). El cid
    // apunta a la variante "email" (fondo crema + textos oscuros), que ya
    // es legible sobre fondo claro por sí misma — el template ya no
    // necesita envolverla en un panel oscuro artificial.
    const INLINE_CID = "sticker@mi-dorsal";
    const htmlWithInline = html.replace(
      /<!--SHARE_CARD_INLINE-->/g,
      `<img src="cid:${INLINE_CID}" alt="Tu resultado en ${escapeAttr(race.name)}" width="240" style="display:block;max-width:100%;height:auto;" />`,
    );

    // ---------- 7. Enviar email ----------
    let success = false;
    let resendId: string | undefined;
    let errorMsg: string | undefined;
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "mi-dorsal <hola@mi-dorsal.com>";

    if (IS_MOCK) {
      console.log(
        `[result-found-mock] → ${profile.email} | ${subject} | diploma=${(pdfBytes.length / 1024).toFixed(1)}KB sticker=${(stickerBytes.length / 1024).toFixed(1)}KB stickerEmail=${(stickerEmailBytes.length / 1024).toFixed(1)}KB`,
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
              content: bytesToBase64(pdfBytes),
            },
            {
              // Variante "email" (fondo crema opaco + textos oscuros): es
              // la que se incrusta inline con cid para que el HTML del
              // email la muestre directamente. El overlay transparente
              // (stickerBytes) se sigue subiendo a Convex Storage y se
              // sirve desde /api/result/{myRaceId}/story-sticker.png
              // para descarga.
              filename: `mi-dorsal-${verificationId}.png`,
              content: bytesToBase64(stickerEmailBytes),
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
      storyStickerStorageId,
      storyStickerEmailStorageId,
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
    const { myRace, profile, race, effectiveDistance } = data;

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
    const distanceLabel = effectiveDistance.label;
    const raceDateFormatted = race.startDate
      ? new Date(race.startDate).toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })
      : args.raceName;
    // Siempre la ficha DENTRO de mi-dorsal, nunca la web externa de la
    // carrera (officialUrl/registrationUrl) — el CTA es "ver tu ficha",
    // no "salir de la app".
    const raceUrl = `${APP_URL}/carreras/${race.slug ?? ""}`;

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
// Action: sendResultNotFoundEmail (>=48h sin resultado scrapeado)
// ===========================================================================
// Llamada desde convex/crons/resultNotFound.ts. Avisa al usuario y le
// ofrece meter su tiempo a mano (myRaces.setManualResult, vía /calendario)
// o consultar la clasificación oficial si tenemos resultsUrl.
//
// `testOverrideTo` (opcional): mismo comportamiento que en
// sendReminderEmail — redirige el envío y NO escribe en notificationLog.
// ===========================================================================

export const sendResultNotFoundEmail = internalAction({
  args: {
    userId: v.id("profiles"),
    myRaceId: v.id("myRaces"),
    raceName: v.string(),
    raceDate: v.string(),
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
      console.warn(`[result-not-found] myRace ${args.myRaceId} not found, skipping`);
      return { success: false, reason: "myRace_not_found" as const };
    }
    const { myRace, profile, race } = data;

    const toEmail = args.testOverrideTo ?? profile.email;
    if (!toEmail) {
      console.warn(`[result-not-found] profile ${profile._id} has no email, skipping`);
      return { success: false, reason: "no_email" as const };
    }

    // Idempotencia: se salta por completo en modo test.
    if (!isTest) {
      const alreadySent = await ctx.runQuery(internal.emailNotificationsHelpers.hasLogForMyRace, {
        userId: profile._id,
        myRaceId: myRace._id,
        type: "result_not_found",
      });
      if (alreadySent) {
        return { success: true, reason: "already_sent" as const };
      }
    }

    // ---------- 2. Preparar datos para la plantilla ----------
    const raceDateFormatted = race.startDate
      ? new Date(race.startDate).toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })
      : args.raceDate;

    const { subject, html, text } = resultNotFoundEmail({
      userName: profile.displayName ?? "corredor",
      raceName: args.raceName,
      raceDate: raceDateFormatted,
      classificationUrl: race.resultsUrl,
      calendarUrl: `${APP_URL}/calendario`,
      appUrl: APP_URL,
    });

    // ---------- 3. Enviar email ----------
    let success = false;
    let resendId: string | undefined;
    let errorMsg: string | undefined;
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "mi-dorsal <hola@mi-dorsal.com>";

    if (IS_MOCK) {
      console.log(`[result-not-found-mock] → ${toEmail} | ${subject}`);
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
        console.error(`[result-not-found] ${toEmail} failed:`, err);
      }
    }

    // ---------- 4. Log (se salta en modo test) ----------
    if (!isTest) {
      await ctx.runMutation(internal.emailNotificationsHelpers.writeLog, {
        userId: profile._id,
        myRaceId: myRace._id,
        type: "result_not_found",
        delivered: success,
        resendMessageId: resendId,
        error: errorMsg,
      });
    }

    // ---------- 5. Avisar al admin (hola@mi-dorsal.com) ----------
    // Cada vez que se dispara este email real (no en modo test), Manu
    // quiere saberlo: es la señal de que el scraper de esa carrera no
    // está funcionando y toca revisar resultsUrl a mano en /admin/races.
    if (!isTest) {
      await sendAdminAlert({
        userName: profile.displayName ?? profile.email ?? "corredor",
        userEmail: profile.email,
        raceName: race.name,
        raceId: race._id,
        myRaceId: myRace._id,
        resultsUrl: race.resultsUrl,
        userEmailDelivered: success,
        appUrl: APP_URL,
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

/**
 * Aviso interno a hola@mi-dorsal.com cuando se dispara result_not_found
 * de verdad. Best-effort: si falla, solo loguea — nunca debe tirar abajo
 * el flujo principal (el usuario ya recibió, o no, su email).
 */
async function sendAdminAlert(args: {
  userName: string;
  userEmail?: string;
  raceName: string;
  raceId: Id<"races">;
  myRaceId: Id<"myRaces">;
  resultsUrl?: string;
  userEmailDelivered: boolean;
  appUrl: string;
}): Promise<void> {
  const IS_MOCK = !process.env.RESEND_API_KEY;
  const adminUrl = `${args.appUrl}/admin/races/${args.raceId}`;
  const subject = `⚠️ Resultado no encontrado: ${args.raceName}`;
  const html = `
    <p>${escapeAttr(args.userName)}${args.userEmail ? ` (${escapeAttr(args.userEmail)})` : ""} no tiene resultado tras 48h en <strong>${escapeAttr(args.raceName)}</strong>.</p>
    <p>Email al usuario: ${args.userEmailDelivered ? "enviado" : "FALLÓ al enviar"}.</p>
    <p>resultsUrl actual: ${args.resultsUrl ? `<a href="${args.resultsUrl}">${escapeAttr(args.resultsUrl)}</a>` : "(sin resultsUrl configurada)"}</p>
    <p><a href="${adminUrl}">Revisar carrera en el admin →</a></p>
    <p style="color:#78716c;font-size:12px;">myRaceId: ${args.myRaceId}</p>
  `;
  const text = [
    `${args.userName}${args.userEmail ? ` (${args.userEmail})` : ""} no tiene resultado tras 48h en ${args.raceName}.`,
    `Email al usuario: ${args.userEmailDelivered ? "enviado" : "FALLÓ al enviar"}.`,
    `resultsUrl actual: ${args.resultsUrl ?? "(sin resultsUrl configurada)"}`,
    `Revisar: ${adminUrl}`,
    `myRaceId: ${args.myRaceId}`,
  ].join("\n");

  if (IS_MOCK) {
    console.log(`[admin-alert-mock] result_not_found → hola@mi-dorsal.com | ${subject}`);
    return;
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(stripBom(process.env.RESEND_API_KEY!));
    await resend.emails.send({
      from: stripBom(process.env.RESEND_FROM_EMAIL ?? "mi-dorsal <hola@mi-dorsal.com>"),
      to: "hola@mi-dorsal.com",
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error("[admin-alert] failed to notify hola@mi-dorsal.com:", err);
  }
}

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

// =============================================================================
// mi-dorsal — Email dispatch (interno)
// =============================================================================
// Action compartida que envía el email vía Resend (o mock) y registra en
// notificationLog. Vive en la RAÍZ de convex/ (no en convex/emails/) para
// evitar la referencia circular que se genera cuando un archivo se llama
// a sí mismo a través de internal.* (el árbol de tipos se vuelve infinito).
// =============================================================================

import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const getProfile = internalQuery({
  args: { userId: v.id("profiles") },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId);
  },
});

export const hasLog = internalQuery({
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
      v.literal("photos_available"),
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
      v.literal("photos_available"),
    ),
    delivered: v.boolean(),
    resendMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notificationLog", {
      userId: args.userId,
      relatedRaceId: undefined,
      relatedMyRaceId: args.myRaceId,
      type: args.type,
      sentAt: Date.now(),
      delivered: args.delivered,
      resendMessageId: args.resendMessageId,
      error: args.error,
    });
  },
});

export const dispatchAndLog = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    text: v.optional(v.string()),
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
      v.literal("photos_available"),
    ),
  },
  handler: async (ctx, args) => {
    const IS_MOCK = !process.env.RESEND_API_KEY;
    let success = false;
    let mocked = false;
    let resendId: string | undefined;
    let errorMsg: string | undefined;

    if (IS_MOCK) {
      console.log(
        `[email-mock] ${args.type} → ${args.to}: ${args.subject}`,
      );
      success = true;
      mocked = true;
    } else {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY!);
        const result = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? "mi-dorsal <hola@mi-dorsal.com>",
          to: args.to,
          subject: args.subject,
          html: args.html,
          text: args.text,
        });
        resendId = result.data?.id;
        success = true;
      } catch (err) {
        success = false;
        errorMsg = String(err);
        console.error(`[email] ${args.type} → ${args.to} failed:`, err);
      }
    }

    await ctx.runMutation(internal.emailDispatch.writeLog, {
      userId: args.userId,
      myRaceId: args.myRaceId,
      type: args.type,
      delivered: success,
      resendMessageId: resendId,
      error: errorMsg,
    });

    return { success, id: resendId, mocked, error: errorMsg };
  },
});

// =============================================================================
// Onboarding welcome email (Sprint 1)
// =============================================================================
// A diferencia de los emails de carrera (result_found, reminder_*, etc.), el
// welcome de onboarding NO está atado a una myRace. Por eso tiene su propia
// action: no usa notificationLog y el idempotente lo gestiona el campo
// `profile.onboardingWelcomeEmailSentAt`.
//
// Se agenda desde `users.markWelcomeSeen` cuando el usuario cierra el
// welcome overlay por primera vez.
// =============================================================================

/**
 * Envía el email de bienvenida al usuario dado.
 *
 * Idempotente: si `onboardingWelcomeEmailSentAt` ya está set, sale sin
 * enviar nada. Esto cubre el caso de reintento del cliente (por ejemplo,
 * si la mutation se llama dos veces en una sesión por un race del
 * scheduler).
 *
 * Modo mock: si no hay `RESEND_API_KEY`, loguea por consola y setea
 * igualmente el timestamp (para que el dev local vea el flujo).
 */
export const sendWelcomeEmail = internalAction({
  args: {
    userId: v.id("profiles"),
  },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.runQuery(internal.emailDispatch.getProfile, { userId });
    if (!profile) {
      console.warn(`[email-welcome] profile ${userId} not found, skipping`);
      return { success: false, reason: "profile_not_found" as const };
    }
    if (profile.onboardingWelcomeEmailSentAt != null) {
      // Ya enviado: idempotente, no hacer nada.
      return { success: true, reason: "already_sent" as const };
    }
    if (!profile.email) {
      // Sin email no podemos enviar (Clerk aún no lo ha sincronizado).
      // NO marcamos como enviado: cuando el usuario actualice su perfil
      // o se reintente desde otra mutation, lo enviaremos.
      console.warn(`[email-welcome] profile ${userId} has no email yet`);
      return { success: false, reason: "no_email" as const };
    }

    const html = renderWelcomeEmail({
      displayName: profile.displayName ?? "corredor",
    });

    const IS_MOCK = !process.env.RESEND_API_KEY;
    let success = false;
    let resendId: string | undefined;
    let errorMsg: string | undefined;

    if (IS_MOCK) {
      console.log(
        `[email-welcome-mock] → ${profile.email} (${profile.displayName ?? "corredor"})`,
      );
      success = true;
    } else {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(stripBom(process.env.RESEND_API_KEY!));
        const result = await resend.emails.send({
          from: stripBom(
            process.env.RESEND_FROM_EMAIL ?? "mi-dorsal <hola@mi-dorsal.com>",
          ),
          to: profile.email,
          subject: "Tu dorsal empieza aquí",
          html,
        });
        resendId = result.data?.id;
        success = true;
      } catch (err) {
        success = false;
        errorMsg = String(err);
        console.error(`[email-welcome] ${profile.email} failed:`, err);
      }
    }

    if (success) {
      await ctx.runMutation(internal.emailDispatch.markWelcomeEmailSent, {
        userId,
      });
    }

    return { success, reason: "sent" as const, resendId, error: errorMsg };
  },
});

/**
 * Setea el flag de email enviado (mutation interna, llamada desde sendWelcomeEmail).
 * Idempotente: si ya está marcado, sale sin tocar nada.
 */
export const markWelcomeEmailSent = internalMutation({
  args: {
    userId: v.id("profiles"),
  },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db.get(userId);
    if (!profile) return;
    if (profile.onboardingWelcomeEmailSentAt != null) return; // ya marcado
    await ctx.db.patch(userId, {
      onboardingWelcomeEmailSentAt: Date.now(),
    });
  },
});

/**
 * Render del email de bienvenida. Inline aquí (mismo patrón que el newsletter)
 * para no añadir una dependencia de @react-email/renderer solo para esto.
 */
function renderWelcomeEmail({ displayName }: { displayName: string }): string {
  const baseUrl = stripBom(
    process.env.NEXT_PUBLIC_APP_URL || "https://www.mi-dorsal.com",
  );
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>Tu dorsal empieza aquí</title></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#0a0a0a;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${baseUrl}" target="_blank" rel="noopener" style="display:inline-block;text-decoration:none;">
        <img src="${baseUrl}/logo-light.png" alt="mi-dorsal" width="220" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;" />
      </a>
    </div>
    <div style="background:white;border:1px solid #e7e5e4;border-radius:12px;padding:28px 24px;">
      <p style="font-size:22px;font-weight:700;color:#0a0a0a;margin:0 0 16px 0;line-height:1.3;">
        Hola, ${displayName}.
      </p>
      <p style="font-size:16px;line-height:1.65;color:#44403c;margin:0 0 20px 0;">
        Tu dorsal empieza aquí. Bienvenido a <strong>mi-dorsal</strong>.
      </p>
      <p style="font-size:15px;line-height:1.65;color:#44403c;margin:0 0 20px 0;">
        Esto es lo que te espera: un catálogo curado de carreras populares
        en España, predicción de tiempos con el método Daniels y, sobre
        todo, el <strong>resultado oficial</strong> de cada carrera directo
        en tu buzón con diploma PDF.
      </p>
      <p style="font-size:15px;line-height:1.65;color:#44403c;margin:0 0 22px 0;">
        Sin pulseras, sin GPS, sin conectar tu smartwatch. Solo tú, tu
        dorsal y la línea de meta.
      </p>

      <hr style="border:none;border-top:1px solid #e7e5e4;margin:22px 0;">

      <p style="font-size:14px;font-weight:600;color:#0a0a0a;margin:0 0 12px 0;">
        Por dónde empezar
      </p>
      <p style="font-size:15px;line-height:1.7;color:#44403c;margin:0 0 8px 0;">
        &nbsp;&nbsp;&middot; <a href="${baseUrl}/carreras" style="color:#dc2626;text-decoration:underline;">Apúntate a tu próxima carrera</a>
      </p>
      <p style="font-size:15px;line-height:1.7;color:#44403c;margin:0 0 8px 0;">
        &nbsp;&nbsp;&middot; <a href="${baseUrl}/perfil" style="color:#dc2626;text-decoration:underline;">Añade tu mejor marca y predícete el maratón</a>
      </p>
      <p style="font-size:15px;line-height:1.7;color:#44403c;margin:0 0 22px 0;">
        &nbsp;&nbsp;&middot; <a href="${baseUrl}/#how-it-works" style="color:#dc2626;text-decoration:underline;">Mira cómo llega el resultado oficial</a>
      </p>

      <p style="font-size:13px;color:#78716c;margin:24px 0 0 0;line-height:1.5;">
        Nos vemos en la línea de salida.
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Normaliza BOM invisible que pueda venir de env vars de Vercel/CLI
 * (bug observado: `Cannot convert argument to a ByteString` con U+FEFF).
 */
function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, "");
}

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
          from: process.env.RESEND_FROM_EMAIL ?? "hola@mi-dorsal.com",
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

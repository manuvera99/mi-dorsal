// =============================================================================
// mi-dorsal — Email sender (Resend)
// =============================================================================
// Wrapper sobre Resend para enviar emails transaccionales.
// En modo mock, solo loguea.
// =============================================================================

import { internalAction } from "../_generated/server";
import { v } from "convex/values";

interface EmailArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const IS_MOCK = !process.env.RESEND_API_KEY;

export const sendEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    text: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (IS_MOCK) {
      console.log(`[email-mock] Would send to ${args.to}: ${args.subject}`);
      return { success: true, mocked: true };
    }
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY!);
      const result = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "resultados@mi-dorsal.es",
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
      });
      return { success: true, id: result.data?.id };
    } catch (err) {
      console.error(`[email] Failed to send to ${args.to}:`, err);
      return { success: false, error: String(err) };
    }
  },
});

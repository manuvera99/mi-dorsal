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
      // RESEND_FROM_EMAIL ya viene en formato completo "Nombre <email>"
      // (ver `npx convex env get RESEND_FROM_EMAIL`) — envolverlo de nuevo
      // en `mi-dorsal <...>` producía un header From malformado de doble
      // anidado ("mi-dorsal <mi-dorsal <hola@mi-dorsal.com>>"), que Resend
      // rechazaba. Bug confirmado 2026-09-11: el email de resumen de
      // ingest nunca llegaba pese a que Convex reportaba la acción como
      // ejecutada con éxito (el SDK de Resend v4 no lanza excepción en
      // errores de validación de API, devuelve { data: null, error } —
      // por eso el try/catch nunca lo detectaba).
      const from = process.env.RESEND_FROM_EMAIL ?? "mi-dorsal <hola@mi-dorsal.com>";
      const result = await resend.emails.send({
        from,
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
      });
      if (result.error) {
        console.error(`[email] Resend rechazó el envío a ${args.to}:`, result.error);
        return { success: false, error: JSON.stringify(result.error) };
      }
      return { success: true, id: result.data?.id };
    } catch (err) {
      console.error(`[email] Failed to send to ${args.to}:`, err);
      return { success: false, error: String(err) };
    }
  },
});

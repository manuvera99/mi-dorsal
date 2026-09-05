// =============================================================================
// mi-dorsal — Cron: newsletter editorial mensual
// =============================================================================
// Corre el día 1 de cada mes a las 10:00 UTC. Coge el post editorial más
// reciente que aún no se haya enviado en newsletter y lo envía a todos los
// suscriptores activos con editorialEnabled=true.
//
// El link "darme de baja" se incluye automáticamente con el
// unsubscribeToken estable del suscriptor.
//
// Nota: en MOCK mode (sin RESEND_API_KEY) este cron registra los envíos en
// stdout y no marca a nadie como enviado, para poder iterar sin enviar
// emails reales.
// =============================================================================

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

export const newsletterEditorial = internalAction({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx: any, args) => {
    const dryRun = args.dryRun ?? false;

    // 1. Buscar el siguiente post candidato
    const post = await ctx.runQuery(internal.blog.pickNextNewsletterPost, {});
    if (!post) {
      console.log("[newsletter-editorial] No hay posts pendientes de envío");
      return { sent: 0, reason: "no_post" as const };
    }

    // 2. Buscar suscriptores activos con editorial habilitado
    const subscribers: any[] = await ctx.runQuery(
      internal.newsletter.listActiveEditorialSubscribers as any,
      { limit: 5000 },
    );

    if (subscribers.length === 0) {
      console.log("[newsletter-editorial] No hay suscriptores activos con editorial");
      // Aún así marcamos el post como enviado (no queremos re-enviar el mismo)
      if (!dryRun) {
        await ctx.runMutation(internal.blog.markNewsletterSent, {
          id: post._id,
          sentAt: Date.now(),
        });
      }
      return { sent: 0, reason: "no_subscribers" as const, postSlug: post.slug };
    }

    // 3. Construir el email y enviar a cada suscriptor
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.mi-dorsal.com";
    const postUrl = `${baseUrl}/blog/${post.slug}`;
    const IS_MOCK = !process.env.RESEND_API_KEY;

    const subject = `Nueva historia de dorsal: ${post.title}`;
    const from = process.env.RESEND_FROM_EMAIL ?? "hola@mi-dorsal.com";

    let delivered = 0;
    let failed = 0;
    let mocked = 0;

    for (const sub of subscribers) {
      const unsubscribeUrl = sub.unsubscribeToken
        ? `${baseUrl}/api/newsletter/unsubscribe?token=${sub.unsubscribeToken}`
        : `${baseUrl}/newsletter`;

      const html = renderEditorialEmail({
        postTitle: post.title,
        postExcerpt: post.excerpt,
        postUrl,
        unsubscribeUrl,
        categoryLabel: categoryLabel(post.category),
      });

      let success = false;
      let mockedThis = false;

      if (IS_MOCK || dryRun) {
        console.log(
          `[newsletter-editorial] ${dryRun ? "DRY-RUN" : "MOCK"} → ${sub.email}: ${subject}`,
        );
        success = true;
        mockedThis = true;
        mocked++;
      } else {
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY!);
          const result = await resend.emails.send({
            from,
            to: sub.email,
            subject,
            html,
          });
          success = !!(result.data?.id);
          if (!success) console.error(`[newsletter-editorial] Resend failed:`, result.error);
        } catch (e) {
          console.error(`[newsletter-editorial] send to ${sub.email} failed:`, e);
        }
      }

      if (success) delivered++;
      else failed++;

      if (!dryRun && !IS_MOCK) {
        await ctx.runMutation(internal.newsletter.markSent, {
          id: sub._id,
          sentAt: Date.now(),
        });
      }
    }

    // 4. Marcar el post como enviado
    if (!dryRun && !IS_MOCK) {
      await ctx.runMutation(internal.blog.markNewsletterSent, {
        id: post._id,
        sentAt: Date.now(),
      });
    }

    const summary = {
      sent: delivered,
      failed,
      mocked,
      total: subscribers.length,
      postSlug: post.slug,
      postTitle: post.title,
      isMock: IS_MOCK,
      isDryRun: dryRun,
    };
    console.log(`[newsletter-editorial] ${JSON.stringify(summary)}`);
    return summary;
  },
});

// ---------------------------------------------------------------------------
// Email HTML (inline para no añadir dependencias)
// ---------------------------------------------------------------------------

function categoryLabel(category: string): string {
  const map: Record<string, string> = {
    historias: "Historias de dorsal",
    guias: "Guías de carrera",
    curiosidades: "Curiosidades",
    tendencias: "Tendencias con contexto",
  };
  return map[category] ?? category;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderEditorialEmail({
  postTitle,
  postExcerpt,
  postUrl,
  unsubscribeUrl,
  categoryLabel,
}: {
  postTitle: string;
  postExcerpt: string;
  postUrl: string;
  unsubscribeUrl: string;
  categoryLabel: string;
}): string {
  // Plantilla inline-friendly para clientes de email (Gmail, Outlook, Apple Mail).
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>${escapeHtml(postTitle)}</title></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#0a0a0a;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="display:inline-block;background:#dc2626;color:white;font-weight:700;font-size:14px;padding:4px 10px;border-radius:999px;">mi-dorsal</span>
    </div>

    <div style="background:white;border:1px solid #e7e5e4;border-radius:12px;padding:28px 24px;">
      <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#78716c;margin-bottom:8px;">${escapeHtml(categoryLabel)}</div>
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 14px 0;color:#0a0a0a;">${escapeHtml(postTitle)}</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 22px 0;color:#44403c;">${escapeHtml(postExcerpt)}</p>
      <div style="text-align:center;margin:24px 0 8px;">
        <a href="${postUrl}" style="display:inline-block;background:#dc2626;color:white;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">Leer la historia →</a>
      </div>
    </div>

    <p style="font-size:12px;color:#a8a29e;margin-top:24px;text-align:center;line-height:1.5;">
      El hilo que te une a tu dorsal.<br>
      <a href="${unsubscribeUrl}" style="color:#a8a29e;text-decoration:underline;">Darme de baja</a> ·
      <a href="${unsubscribeUrl.replace("/api/newsletter/unsubscribe", "/newsletter/gestionar")}" style="color:#a8a29e;text-decoration:underline;">Gestionar preferencias</a>
    </p>
  </div>
</body>
</html>`;
}

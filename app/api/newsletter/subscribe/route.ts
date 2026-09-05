// =============================================================================
// mi-dorsal — POST /api/newsletter/subscribe
// =============================================================================
// Crea un suscriptor en estado "pending" con doble opt-in (RGPD España LSSI).
// Devuelve { ok, alreadyExisted, status } para que el cliente muestre feedback
// adecuado. Hashea la IP antes de guardarla (auditoría RGPD sin PII en claro).
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createHash } from "crypto";

export const runtime = "nodejs"; // usamos crypto nativo

function hashIp(ip: string): string {
  // SHA-256 + un salt fijo (auditoría). No invertimos la IP.
  const SALT = process.env.NEWSLETTER_IP_SALT ?? "mi-dorsal-newsletter-2026";
  return createHash("sha256").update(SALT + ip).digest("hex");
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, source } = body as { email?: string; source?: string };

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email requerido" }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }
    const validSource = ["blog", "landing", "footer"].includes(source ?? "")
      ? (source as "blog" | "landing" | "footer")
      : "landing";

    // Hashear IP para auditoría RGPD
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip")
      ?? "0.0.0.0";
    const userAgent = request.headers.get("user-agent") ?? undefined;
    const locale = request.headers.get("accept-language")?.split(",")[0]?.trim();

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

    const result = await convex.mutation(api.newsletter.subscribePending, {
      email: email.toLowerCase().trim(),
      source: validSource,
      ipHash: hashIp(ip),
      userAgent,
      locale,
    });

    // Si el suscriptor ya estaba activo, no enviamos email de confirmación
    if (result.alreadyExisted) {
      // Mirar el estado actual para devolver feedback
      const status = await convex.query(api.newsletter.getStatus, {
        email: email.toLowerCase().trim(),
      });
      return NextResponse.json({
        ok: true,
        alreadyExisted: true,
        status: status.status,
      });
    }

    // Enviar email de confirmación con el token
    // Normalizamos BOM invisible que pueda venir de env vars de Vercel/CLI
    // (bug observado: `Cannot convert argument to a ByteString` con U+FEFF).
    const stripBom = (s: string) => s.replace(/^\uFEFF/, "");
    const baseUrl = stripBom(process.env.NEXT_PUBLIC_APP_URL || "https://www.mi-dorsal.com");
    const confirmUrl = `${baseUrl}/api/newsletter/confirm?token=${result.confirmToken}`;

    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(stripBom(process.env.RESEND_API_KEY));
        await resend.emails.send({
          from: stripBom(process.env.RESEND_FROM_EMAIL ?? "hola@mi-dorsal.es"),
          to: email,
          subject: "Confirma tu suscripción a la newsletter de mi-dorsal",
          html: renderConfirmEmail({ confirmUrl }),
        });
      } catch (e) {
        console.error("[newsletter/subscribe] Error sending confirmation:", e);
        // No fallamos: el suscriptor está creado en pending, podemos reenviar
      }
    } else {
      console.log(`[newsletter/subscribe] MOCK confirmation: ${confirmUrl}`);
    }

    return NextResponse.json({ ok: true, alreadyExisted: false, status: "pending" });
  } catch (e: any) {
    console.error("[newsletter/subscribe]", e);
    return NextResponse.json(
      { error: e?.message ?? "Error interno" },
      { status: 500 },
    );
  }
}

function renderConfirmEmail({ confirmUrl }: { confirmUrl: string }): string {
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>Confirma tu suscripción</title></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#0a0a0a;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="display:inline-block;background:#dc2626;color:white;font-weight:700;font-size:14px;padding:4px 10px;border-radius:999px;">mi-dorsal</span>
    </div>
    <div style="background:white;border:1px solid #e7e5e4;border-radius:12px;padding:28px 24px;">
      <h1 style="font-size:22px;margin:0 0 14px 0;">Un click y listo</h1>
      <p style="font-size:15px;line-height:1.6;color:#44403c;margin:0 0 22px 0;">
        Te has apuntado a la newsletter de <strong>mi-dorsal</strong>. Para
        confirmar (doble opt-in, RGPD), haz click en el botón de abajo.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${confirmUrl}" style="display:inline-block;background:#dc2626;color:white;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">Confirmar suscripción</a>
      </div>
      <p style="font-size:13px;color:#78716c;margin-top:24px;line-height:1.5;">
        Si no has sido tú, ignora este email. No te apuntaremos a nada.<br>
        El botón caduca en 24 horas, pero puedes volver a apuntarte cuando quieras.
      </p>
    </div>
  </div>
</body>
</html>`;
}

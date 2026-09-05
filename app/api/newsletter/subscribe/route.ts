// =============================================================================
// mi-dorsal — POST /api/newsletter/subscribe
// =============================================================================
// Single opt-in con consentimiento explícito en el frontend (checkbox "Acepto
// recibir emails"). El suscriptor se crea como "active" directamente y se le
// envía un email de bienvenida.
//
// Prueba de consentimiento (RGPD LSSI):
// - El usuario marcó un checkbox explícito en el frontend
// - Guardamos timestamp + IP hasheada + UA como prueba de auditoría
// - El email de bienvenida incluye link de baja con 1 click (LSSI art. 22)
//
// Devuelve { ok, alreadyExisted, reactivated, status } para que el cliente
// muestre feedback adecuado.
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
    const { email, source, consent } = body as {
      email?: string;
      source?: string;
      consent?: boolean;
    };

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email requerido" }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }
    // RGPD: el frontend DEBE enviar consent=true. Si no, rechazamos.
    if (consent !== true) {
      return NextResponse.json(
        { error: "Debes aceptar recibir emails para suscribirte" },
        { status: 400 },
      );
    }
    const validSource = ["blog", "landing", "footer"].includes(source ?? "")
      ? (source as "blog" | "landing" | "footer")
      : "landing";

    // Hashear IP para auditoría RGPD
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip")
      ?? "0.0.0.0";
    const userAgent = request.headers.get("user-agent") ?? undefined;

    const convex = new ConvexHttpClient(stripBom(process.env.NEXT_PUBLIC_CONVEX_URL!));

    const result = await convex.mutation(api.newsletter.subscribeDirect, {
      email: email.toLowerCase().trim(),
      source: validSource,
      consentIpHash: hashIp(ip),
      consentUserAgent: userAgent,
    });

    // Si el suscriptor ya existía y NO se reactivó, no enviamos email
    // (caso: ya está active y simplemente re-intenta suscribirse).
    // Si se reactivó (estaba unsubscribed/bounced) o es nuevo, SÍ enviamos
    // email de bienvenida.
    if (result.alreadyExisted && !result.reactivated) {
      return NextResponse.json({
        ok: true,
        alreadyExisted: true,
        reactivated: false,
        status: "active",
        message: "Ya estabas apuntado. Te tenemos en la lista. 🏃",
      });
    }

    // Construir URL de baja con el unsubscribeToken
    const baseUrl = stripBom(process.env.NEXT_PUBLIC_APP_URL || "https://www.mi-dorsal.com");
    const unsubscribeUrl = `${baseUrl}/api/newsletter/unsubscribe?token=${result.unsubscribeToken}`;

    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(stripBom(process.env.RESEND_API_KEY));
        await resend.emails.send({
          from: stripBom(process.env.RESEND_FROM_EMAIL ?? "hola@mi-dorsal.es"),
          to: email,
          subject: "¡Bienvenido a la familia del dorsal!",
          html: renderWelcomeEmail({ unsubscribeUrl }),
        });
      } catch (e) {
        console.error("[newsletter/subscribe] Error sending welcome:", e);
        // No fallamos: el suscriptor está creado en active, podemos reenviar manualmente
      }
    } else {
      console.log(`[newsletter/subscribe] MOCK welcome: ${unsubscribeUrl}`);
    }

    return NextResponse.json({
      ok: true,
      alreadyExisted: result.alreadyExisted,
      reactivated: result.reactivated,
      status: "active",
    });
  } catch (e: any) {
    console.error("[newsletter/subscribe]", e);
    return NextResponse.json(
      { error: e?.message ?? "Error interno" },
      { status: 500 },
    );
  }
}

// Normalizamos BOM invisible que pueda venir de env vars de Vercel/CLI
// (bug observado: `Cannot convert argument to a ByteString` con U+FEFF).
function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, "");
}

function renderWelcomeEmail({ unsubscribeUrl }: { unsubscribeUrl: string }): string {
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>¡Bienvenido a la familia del dorsal!</title></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#0a0a0a;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <!-- pill "mi-dorsal" en rojo -->
    <div style="text-align:center;margin-bottom:24px;">
      <span style="display:inline-block;background:#dc2626;color:white;font-weight:700;font-size:14px;padding:4px 10px;border-radius:999px;">mi-dorsal</span>
    </div>
    <!-- caja blanca con el mensaje -->
    <div style="background:white;border:1px solid #e7e5e4;border-radius:12px;padding:28px 24px;">
      <h1 style="font-size:24px;margin:0 0 14px 0;">¡Bienvenido a la familia del dorsal!</h1>
      <p style="font-size:15px;line-height:1.6;color:#44403c;margin:0 0 18px 0;">
        Soy <strong>Manu</strong> y te escribo desde la línea de meta.
      </p>
      <p style="font-size:15px;line-height:1.6;color:#44403c;margin:0 0 18px 0;">
        <strong>mi-dorsal</strong> es el sitio para corredores populares como tú.
        Aquí planificas tu temporada, predices tus tiempos con la fórmula de Daniels
        y, lo más importante, recibes el <strong>resultado oficial</strong> de cada
        carrera por email. Sin pulseras, sin GPS, sin conectar tu smartwatch.
        Solo tú, tu dorsal y la línea de meta.
      </p>
      <p style="font-size:15px;line-height:1.6;color:#44403c;margin:0 0 18px 0;">
        Esta newsletter es el proyecto hermano: una vez al mes te cuento
        lo que no cabe en la app. <strong>Historias reales</strong> de la línea de
        meta, <strong>guías prácticas</strong> para tu próxima carrera y
        <strong>algún dato curioso</strong> del running popular. Sin spam,
        sin patrocinios, sin prisa.
      </p>

      <!-- CTA principal -->
      <div style="text-align:center;margin:28px 0 12px 0;">
        <a href="https://www.mi-dorsal.com/carreras"
           style="display:inline-block;background:#dc2626;color:white;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">
          Explora carreras
        </a>
      </div>

      <!-- 3 links secundarios -->
      <div style="text-align:center;margin:18px 0 4px 0;font-size:14px;color:#78716c;">
        También puedes ver el
        <a href="https://www.mi-dorsal.com/blog" style="color:#dc2626;text-decoration:underline;">blog</a>,
        tu
        <a href="https://www.mi-dorsal.com/perfil" style="color:#dc2626;text-decoration:underline;">perfil</a>
        o el
        <a href="https://www.mi-dorsal.com/calendario" style="color:#dc2626;text-decoration:underline;">calendario</a>
        de tu temporada.
      </div>

      <hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0;">

      <p style="font-size:13px;color:#78716c;margin:0 0 8px 0;line-height:1.5;">
        Si te cansas de mí, date de baja cuando quieras con
        <a href="${unsubscribeUrl}" style="color:#78716c;text-decoration:underline;">este link</a>.
        Sin preguntas, sin formularios.
      </p>
      <p style="font-size:13px;color:#78716c;margin:0;line-height:1.5;">
        ¡Nos vemos en la línea de salida! 🏃
      </p>
    </div>
  </div>
</body>
</html>`;
}

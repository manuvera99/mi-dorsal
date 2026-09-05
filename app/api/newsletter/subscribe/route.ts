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
          subject: "El hilo que te une a tu dorsal",
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
<head><meta charset="utf-8"><title>El hilo que te une a tu dorsal</title></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#0a0a0a;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <!-- Logo de marca como enlace a la web -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="https://www.mi-dorsal.com" target="_blank" rel="noopener" style="display:inline-block;text-decoration:none;">
        <img src="https://www.mi-dorsal.com/logo-light.png" alt="mi-dorsal" width="220" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;" />
      </a>
    </div>
    <!-- caja blanca con el mensaje -->
    <div style="background:white;border:1px solid #e7e5e4;border-radius:12px;padding:28px 24px;">
      <p style="font-size:15px;line-height:1.65;color:#44403c;margin:0 0 20px 0;">
        Cruzas la meta. Te dan un dorsal de cartón. Te lo llevas
        a casa y lo metes en un cajón. Y ahí se queda la historia
        de esa carrera para siempre.
      </p>
      <p style="font-size:15px;line-height:1.65;color:#44403c;margin:0 0 20px 0;">
        <strong>mi-dorsal</strong> es la web que recoge esas historias.
      </p>
      <p style="font-size:15px;line-height:1.65;color:#44403c;margin:0 0 20px 0;">
        Apuntarte a carreras, predecir tus tiempos con el método
        Daniels y, sobre todo, recibir el <strong>resultado oficial</strong>
        de cada carrera por email. Sin pulseras, sin GPS, sin conectar
        tu smartwatch.
      </p>
      <p style="font-size:15px;line-height:1.65;color:#44403c;margin:0 0 22px 0;">
        Esto es la newsletter mensual: lo que no cabe en la app,
        cabe aquí.
      </p>

      <hr style="border:none;border-top:1px solid #e7e5e4;margin:22px 0;">

      <p style="font-size:14px;font-weight:600;color:#0a0a0a;margin:0 0 10px 0;">
        Cada mes vas a recibir
      </p>
      <p style="font-size:15px;line-height:1.7;color:#44403c;margin:0 0 6px 0;">
        &nbsp;&nbsp;&middot; 1 historia real de la línea de meta
      </p>
      <p style="font-size:15px;line-height:1.7;color:#44403c;margin:0 0 6px 0;">
        &nbsp;&nbsp;&middot; 1 guía práctica para tu próxima carrera
      </p>
      <p style="font-size:15px;line-height:1.7;color:#44403c;margin:0 0 18px 0;">
        &nbsp;&nbsp;&middot; Algún dato curioso del mundillo
      </p>

      <p style="font-size:14px;font-weight:600;color:#0a0a0a;margin:0 0 10px 0;">
        Lo que NO vas a recibir
      </p>
      <p style="font-size:15px;line-height:1.7;color:#44403c;margin:0 0 6px 0;">
        &nbsp;&nbsp;&middot; Spam
      </p>
      <p style="font-size:15px;line-height:1.7;color:#44403c;margin:0 0 6px 0;">
        &nbsp;&nbsp;&middot; Patrocinios
      </p>
      <p style="font-size:15px;line-height:1.7;color:#44403c;margin:0 0 18px 0;">
        &nbsp;&nbsp;&middot; Emails para &quot;rellenar&quot;
      </p>

      <p style="font-size:15px;line-height:1.65;color:#44403c;margin:0 0 22px 0;">
        Si un mes no hay nada que merezca tu tiempo, no se manda.
        Así de simple.
      </p>

      <hr style="border:none;border-top:1px solid #e7e5e4;margin:22px 0;">

      <p style="font-size:14px;font-weight:600;color:#0a0a0a;margin:0 0 10px 0;">
        Mientras tanto, empieza por aquí
      </p>
      <p style="font-size:15px;line-height:1.7;color:#44403c;margin:0 0 6px 0;">
        &nbsp;&nbsp;&middot; <a href="https://www.mi-dorsal.com/carreras" style="color:#dc2626;text-decoration:underline;">Carreras cerca de ti</a>
      </p>
      <p style="font-size:15px;line-height:1.7;color:#44403c;margin:0 0 6px 0;">
        &nbsp;&nbsp;&middot; <a href="https://www.mi-dorsal.com/blog" style="color:#dc2626;text-decoration:underline;">El blog</a>
      </p>
      <p style="font-size:15px;line-height:1.7;color:#44403c;margin:0 0 22px 0;">
        &nbsp;&nbsp;&middot; <a href="https://www.mi-dorsal.com/perfil" style="color:#dc2626;text-decoration:underline;">Tu perfil</a>
      </p>

      <p style="font-size:13px;color:#78716c;margin:24px 0 0 0;line-height:1.5;">
        Si algún día te cansas, te das de baja con 1 click
        <a href="${unsubscribeUrl}" style="color:#78716c;text-decoration:underline;">aquí</a>.
        Sin preguntas, sin formularios.
      </p>
      <p style="font-size:13px;color:#78716c;margin:8px 0 0 0;line-height:1.5;">
        Nos vemos en la línea de salida.
      </p>
    </div>
  </div>
</body>
</html>`;
}

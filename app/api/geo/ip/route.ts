// =============================================================================
// app/api/geo/ip/route.ts
// =============================================================================
// Geolocalización por IP pública del cliente. Fallback cuando el usuario
// rechaza el permiso del navegador. Precisión a nivel de ciudad (~50km).
//
// IMPORTANTE: pasamos la IP del cliente (header x-forwarded-for) a ipwho.is.
// Sin esto, ipwho.is ve la IP del SERVIDOR de Vercel (Frankfurt) y siempre
// devuelve Alemania, sin importar desde dónde nos visiten.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";

interface IpWhoResponse {
  success?: boolean;
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country?: string;
  connection?: { isp?: string };
  message?: string;
}

function getClientIp(req: NextRequest): string | null {
  // Vercel + Cloudflare pasan la IP del cliente en estos headers
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // x-forwarded-for puede tener varias IPs: "client, proxy1, proxy2"
    return xff.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cf = req.headers.get("cf-connecting-ip"); // Cloudflare
  if (cf) return cf.trim();
  return null;
}

export async function GET(req: NextRequest) {
  const clientIp = getClientIp(req);
  if (!clientIp) {
    return NextResponse.json(
      { error: "No se pudo determinar la IP del cliente" },
      { status: 400 },
    );
  }

  try {
    // Pasamos la IP del cliente en la URL a ipwho.is
    // El servicio devuelve la geo de ESA IP, no la nuestra
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(clientIp)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `IP geolocation service HTTP ${res.status}` },
        { status: 502 },
      );
    }
    const data = (await res.json()) as IpWhoResponse;
    if (!data.success || typeof data.latitude !== "number" || typeof data.longitude !== "number") {
      return NextResponse.json(
        { error: data.message || "Respuesta inválida del servicio" },
        { status: 502 },
      );
    }
    return NextResponse.json({
      latitude: data.latitude,
      longitude: data.longitude,
      city: data.city,
      region: data.region,
      country: data.country,
      accuracy: "city",
      isp: data.connection?.isp,
      clientIp, // devolver la IP que vimos, útil para debug
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: `Error: ${e?.message ?? e}` },
      { status: 500 },
    );
  }
}

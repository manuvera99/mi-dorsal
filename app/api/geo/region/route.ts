/**
 * GET /api/geo/region
 *
 * Devuelve la comunidad autónoma (o "desconocida") del visitante basándose
 * en los headers de geolocalización que Vercel añade en producción.
 *
 * En desarrollo local estos headers NO existen, así que el endpoint
 * devuelve { source: "default" } para que la home use el fallback.
 *
 * IMPORTANTE: este endpoint NO usa la IP del cliente. Solo lee los headers
 * `x-vercel-ip-*` que Vercel añade de forma anónima, y los cruza con el
 * diccionario de CCAA.
 *
 * Documentación Vercel:
 *  https://vercel.com/docs/edge-network/headers/request-headers#x-vercel-ip-country
 */

import { NextRequest, NextResponse } from "next/server";
import {
  detectCommunityFromString,
  getCommunityById,
  type AutonomousCommunity,
  type CommunityInfo,
} from "@/lib/geo/region";

export const runtime = "edge";
export const dynamic = "force-dynamic";

interface RegionResponse {
  community: CommunityInfo | null;
  source: "vercel-region" | "vercel-country" | "vercel-city" | "default" | "manual-override";
  city: string | null;
  country: string | null;
}

export async function GET(req: NextRequest) {
  // 1) Permitir override manual (?ccaa=valencia). Útil para QA y para que
  //    el cliente fuerce una región al recargar.
  const override = req.nextUrl.searchParams.get("ccaa");
  if (override) {
    const found = detectCommunityFromString(override);
    if (found) {
      return NextResponse.json<RegionResponse>(
        {
          community: found,
          source: "manual-override",
          city: null,
          country: "ES",
        },
        {
          headers: {
            // Cache corta: el override es raro pero los datos válidos 1h.
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
          },
        }
      );
    }
  }

  // 2) En Vercel: leer los headers añadidos por el edge.
  const cityHeader = req.headers.get("x-vercel-ip-city") ?? null;
  const regionHeader = req.headers.get("x-vercel-ip-country-region") ?? null; // provincia
  const countryHeader = req.headers.get("x-vercel-ip-country") ?? null; // "ES"

  // 2a) Si tenemos la provincia, vamos al mapa directo.
  if (regionHeader) {
    const fromRegion = detectCommunityFromString(regionHeader);
    if (fromRegion) {
      return NextResponse.json<RegionResponse>(
        {
          community: fromRegion,
          source: "vercel-region",
          city: cityHeader ? decodeURIComponent(cityHeader) : null,
          country: countryHeader,
        },
        {
          headers: {
            "Cache-Control": "public, max-age=86400, s-maxage=86400", // 24h
          },
        }
      );
    }
  }

  // 2b) Si no, intentar con el país (solo funciona para diferenciar España del resto).
  if (countryHeader && countryHeader.toUpperCase() !== "ES") {
    return NextResponse.json<RegionResponse>(
      {
        community: null,
        source: "default",
        city: null,
        country: countryHeader,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      }
    );
  }

  // 2c) Default: ES sin región conocida.
  return NextResponse.json<RegionResponse>(
    {
      community: null,
      source: "default",
      city: cityHeader ? decodeURIComponent(cityHeader) : null,
      country: countryHeader ?? "ES",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    }
  );
}

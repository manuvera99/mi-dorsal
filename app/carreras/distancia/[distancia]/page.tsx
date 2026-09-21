// =============================================================================
// mi-dorsal — /carreras/distancia/[distancia]
// =============================================================================
// Hub SEO programático para una distancia concreta (5K, 10K, media maratón,
// maratón, trail, ultramaratón). Captura long-tail nacional: "carreras 10K
// en España", "próximas maratones 2026", "trail running España".
// =============================================================================

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { JsonLd, itemListJsonLd, breadcrumbJsonLd } from "@/components/json-ld";
import {
  DistanceHubClient,
  type DistanceHubRace,
} from "@/components/hubs/distance-hub-client";

export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.com";

// Slugs válidos para el segmento dinámico.
const VALID_SLUGS = ["5k", "10k", "media-maraton", "maraton", "trail", "ultra"] as const;
type DistanceSlug = (typeof VALID_SLUGS)[number];

function isDistanceSlug(k: string): k is DistanceSlug {
  return (VALID_SLUGS as readonly string[]).includes(k);
}

const SLUG_TO_LABEL: Record<DistanceSlug, string> = {
  "5k": "5K",
  "10k": "10K",
  "media-maraton": "Media maratón",
  maraton: "Maratón",
  trail: "Trail",
  ultra: "Ultramaratón",
};

const SLUG_TO_INTENT: Record<DistanceSlug, string[]> = {
  "5k": ["carreras 5k", "carreras 5 km", "5k España"],
  "10k": ["carreras 10k", "carreras 10 km", "10k España", "próximas 10k"],
  "media-maraton": ["media maratón", "carreras media maratón", "21k España", "próximas medias maratones"],
  maraton: ["maratón", "42k España", "próximas maratones", "calendario maratones"],
  trail: ["trail running", "carreras trail", "trail España", "carreras de montaña"],
  ultra: ["ultramaratón", "ultra trail", "carreras ultra", "100k España"],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ distancia: string }>;
}): Promise<Metadata> {
  const { distancia } = await params;
  if (!isDistanceSlug(distancia)) {
    return {
      title: "Distancia no encontrada",
      robots: { index: false, follow: true },
    };
  }
  const label = SLUG_TO_LABEL[distancia];

  let total = 0;
  let upcoming = 0;
  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const hubs = await convex.query(api.races.listDistanceHubsForSeo, {});
    const hub = (hubs ?? []).find((h) => h.slug === distancia);
    total = hub?.total ?? 0;
    upcoming = hub?.upcoming ?? 0;
  } catch {
    // Ignorar; metadata mínima funciona sin Convex.
  }

  if (total < 3) {
    return {
      title: `Carreras de ${label} · mi-dorsal`,
      description: `Catálogo de carreras de ${label.toLowerCase()} en España.`,
      robots: { index: false, follow: true },
    };
  }

  const title = `Carreras de ${label} en España · Calendario ${new Date().getFullYear()}`;
  const description = `Catálogo de carreras de ${label.toLowerCase()} en España. ${upcoming} pruebas confirmadas para los próximos meses. Filtra por provincia y fecha.`;
  const url = `${BASE_URL}/carreras/distancia/${distancia}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    keywords: [
      ...SLUG_TO_INTENT[distancia],
      `${label.toLowerCase()} España`,
      `carreras ${label.toLowerCase()} 2026`,
      `carreras ${label.toLowerCase()} 2027`,
    ],
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: "mi-dorsal",
      locale: "es_ES",
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: title }],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
    },
  };
}

export default async function DistanceHubPage({
  params,
}: {
  params: Promise<{ distancia: string }>;
}) {
  const { distancia } = await params;
  if (!isDistanceSlug(distancia)) notFound();

  const label = SLUG_TO_LABEL[distancia];

  // Queries secuenciales (cada una con su propio ConvexHttpClient).
  // Ver /carreras/provincia/[provincia]/page.tsx para el motivo.
  let hubs: any[] = [];
  let races: any[] = [];
  let provinceHubs: any[] = [];
  try {
    hubs = await new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!).query(
      api.races.listDistanceHubsForSeo,
      {},
    );
  } catch {}
  try {
    races = await new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!).query(
      api.races.listByDistanceForSeo,
      { slug: distancia },
    );
  } catch {}
  try {
    provinceHubs = await new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!).query(
      api.races.listProvinceHubsForSeo,
      {},
    );
  } catch {}

  const hub = (hubs ?? []).find((h) => h.slug === distancia);
  const total = hub?.total ?? 0;
  const upcoming = hub?.upcoming ?? 0;
  if (total < 3) notFound();

  const racesTyped: DistanceHubRace[] = (races ?? []).map((r: any) => ({
    slug: r.slug,
    name: r.name,
    locality: r.locality,
    province: r.province,
    startDate: r.startDate,
    distanceKm: r.distanceKm,
    raceType: r.raceType,
  }));

  const siblings = (hubs ?? [])
    .filter((h) => h.total >= 3)
    .map((h) => ({ label: SLUG_TO_LABEL[h.slug as DistanceSlug] ?? h.label, slug: h.slug, total: h.total }));

  const provinces = (provinceHubs ?? [])
    .filter((h) => h.total >= 5)
    .slice(0, 30)
    .map((h) => ({ label: h.label, slug: h.slug, total: h.total }));

  const url = `${BASE_URL}/carreras/distancia/${distancia}`;
  const itemList = itemListJsonLd(
    `Carreras de ${label} en España`,
    `Catálogo completo de carreras de ${label.toLowerCase()} en España.`,
    url,
    racesTyped.map((r, i) => ({
      name: r.name,
      url: `/carreras/${r.slug}`,
      position: i + 1,
      ...(r.startDate ? { datePublished: r.startDate } : {}),
    })),
  );
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Inicio", url: "/" },
    { name: "Carreras", url: "/carreras" },
    { name: label, url: `/carreras/distancia/${distancia}` },
  ]);

  return (
    <>
      <JsonLd data={itemList} />
      <JsonLd data={breadcrumbs} />
      <DistanceHubClient
        label={label}
        slug={distancia}
        total={total}
        upcoming={upcoming}
        races={racesTyped}
        siblings={siblings}
        provinces={provinces}
      />
    </>
  );
}
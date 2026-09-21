// =============================================================================
// mi-dorsal — /carreras/provincia/[provincia]
// =============================================================================
// Hub SEO programático para una provincia concreta.
// Captura long-tail tipo "carreras populares Valencia", "próximas carreras
// populares Alicante", etc. Genera metadata dinámica + JSON-LD ItemList con
// los slugs reales de las carreras publicadas en esa provincia.
// =============================================================================

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { JsonLd, itemListJsonLd, breadcrumbJsonLd } from "@/components/json-ld";
import {
  ProvinceHubClient,
  type ProvinceHubRace,
} from "@/components/hubs/province-hub-client";
import { provinceLabels } from "@/convex/races";

// Cache estático corto (1h): re-render barato si Convex cambia carreras.
export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.com";

interface ProvinceHubData {
  province: string;
  slug: string;
  label: string;
  total: number;
  upcoming: number;
  nextDate?: string;
}

function isProvinceKey(k: string): k is keyof typeof provinceLabels {
  return Object.prototype.hasOwnProperty.call(provinceLabels, k);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ provincia: string }>;
}): Promise<Metadata> {
  const { provincia } = await params;
  if (!isProvinceKey(provincia)) {
    return {
      title: "Provincia no encontrada",
      robots: { index: false, follow: true },
    };
  }
  const label = provinceLabels[provincia];
  let hub: ProvinceHubData | null = null;
  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const hubs = await convex.query(api.races.listProvinceHubsForSeo, {});
    hub = (hubs ?? []).find((h) => h.slug === provincia) ?? null;
  } catch {
    // Si Convex falla, devolvemos metadata mínima igualmente (label existe).
  }

  if (!hub || hub.total < 3) {
    // Thin content: no indexar páginas con <3 carreras (filtro calidad).
    return {
      title: `Carreras en ${label} · mi-dorsal`,
      description: `Catálogo de carreras populares en ${label}, ${label}.`,
      robots: { index: false, follow: true },
    };
  }

  const title = `Carreras populares en ${label} · Calendario ${new Date().getFullYear()}`;
  const description = `Catálogo de carreras populares en ${label} actualizado a diario. ${hub.upcoming} pruebas confirmadas para los próximos meses. Filtra por distancia (5K, 10K, media maratón, maratón, trail).`;
  const url = `${BASE_URL}/carreras/provincia/${provincia}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    keywords: [
      `carreras ${label.toLowerCase()}`,
      `carreras populares ${label.toLowerCase()}`,
      `carreras running ${label.toLowerCase()}`,
      `próximas carreras ${label.toLowerCase()}`,
      `10K ${label.toLowerCase()}`,
      `media maratón ${label.toLowerCase()}`,
      `maratón ${label.toLowerCase()}`,
      `trail ${label.toLowerCase()}`,
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

export default async function ProvinceHubPage({
  params,
}: {
  params: Promise<{ provincia: string }>;
}) {
  const { provincia } = await params;
  if (!isProvinceKey(provincia)) notFound();

  const label = provinceLabels[provincia];
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  const [hubsAll, races, allHubsRaw] = await Promise.all([
    convex.query(api.races.listProvinceHubsForSeo, {}).catch(() => []),
    convex.query(api.races.listByProvinceForSeo, { province: provincia }).catch(() => []),
    convex.query(api.races.listProvinceHubsForSeo, {}).catch(() => []),
  ]);
  const hub = (hubsAll ?? []).find((h) => h.slug === provincia) ?? null;
  if (!hub || hub.total < 3) notFound();

  const racesTyped: ProvinceHubRace[] = (races ?? []).map((r: any) => ({
    slug: r.slug,
    name: r.name,
    locality: r.locality,
    province: r.province,
    startDate: r.startDate,
    distanceKm: r.distanceKm,
    raceType: r.raceType,
  }));

  const siblings = (allHubsRaw ?? [])
    .filter((h) => h.slug !== provincia && h.total >= 3)
    .slice(0, 30)
    .map((h) => ({ label: h.label, slug: h.slug, total: h.total }));

  const url = `${BASE_URL}/carreras/provincia/${provincia}`;
  const itemList = itemListJsonLd(
    `Carreras populares en ${label}`,
    `Catálogo completo de carreras populares en ${label}.`,
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
    { name: label, url: `/carreras/provincia/${provincia}` },
  ]);

  return (
    <>
      <JsonLd data={itemList} />
      <JsonLd data={breadcrumbs} />
      <ProvinceHubClient
        provinceLabel={label}
        provinceSlug={provincia}
        total={hub.total}
        upcoming={hub.upcoming}
        races={racesTyped}
        siblings={siblings}
      />
    </>
  );
}
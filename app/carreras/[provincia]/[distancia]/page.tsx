// =============================================================================
// mi-dorsal — /carreras/{provincia}/{distancia}
// =============================================================================
// Hub SEO long-tail combinando provincia + distancia. SEO target exacto:
// "carreras 10K en Madrid", "maratones en Valencia", "trail en Asturias", etc.
// Solo emitimos combinaciones con ≥3 carreras para evitar thin content.
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
import { provinceLabels, isProvinceSlug, isDistanceSlug, distanceLabels } from "@/lib/seo/province-labels";

export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.com";

const SLUG_TO_LABEL = distanceLabels;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ provincia: string; distancia: string }>;
}): Promise<Metadata> {
  const { provincia, distancia } = await params;
  if (!isProvinceSlug(provincia) || !isDistanceSlug(distancia)) {
    return {
      title: "Combinación no encontrada",
      robots: { index: false, follow: true },
    };
  }
  const provinceLabel = provinceLabels[provincia];
  const distanceLabel = SLUG_TO_LABEL[distancia];

  const title = `Carreras de ${distanceLabel} en ${provinceLabel} · Calendario ${new Date().getFullYear()}`;
  const description = `Catálogo de carreras de ${distanceLabel.toLowerCase()} en ${provinceLabel}. Todas las pruebas publicadas y actualizadas a diario.`;
  const url = `${BASE_URL}/carreras/${provincia}/${distancia}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    keywords: [
      `carreras ${distanceLabel.toLowerCase()} ${provinceLabel.toLowerCase()}`,
      `${distanceLabel.toLowerCase()} ${provinceLabel.toLowerCase()}`,
      `carreras populares ${provinceLabel.toLowerCase()} ${distanceLabel.toLowerCase()}`,
      `próximas ${distanceLabel.toLowerCase()} ${provinceLabel.toLowerCase()}`,
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

export default async function ProvinceDistanceHubPage({
  params,
}: {
  params: Promise<{ provincia: string; distancia: string }>;
}) {
  const { provincia, distancia } = await params;
  if (!isProvinceSlug(provincia) || !isDistanceSlug(distancia)) notFound();

  const provinceLabel = provinceLabels[provincia];
  const distanceLabel = SLUG_TO_LABEL[distancia];
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  const [races, provinceHubs] = await Promise.all([
    convex
      .query(api.races.listByProvinceDistanceForSeo, {
        province: provincia,
        distanceSlug: distancia,
      })
      .catch(() => []),
    convex.query(api.races.listProvinceHubsForSeo, {}).catch(() => []),
  ]);

  if (!races || races.length < 3) notFound();

  const racesTyped: ProvinceHubRace[] = races.map((r: any) => ({
    slug: r.slug,
    name: r.name,
    locality: r.locality,
    province: r.province,
    startDate: r.startDate,
    distanceKm: r.distanceKm,
    raceType: r.raceType,
  }));

  const siblings = (provinceHubs ?? [])
    .filter((h) => h.slug !== provincia && h.total >= 3)
    .slice(0, 30)
    .map((h) => ({ label: h.label, slug: h.slug, total: h.total }));

  const url = `${BASE_URL}/carreras/${provincia}/${distancia}`;
  const itemList = itemListJsonLd(
    `Carreras de ${distanceLabel} en ${provinceLabel}`,
    `Catálogo completo de carreras de ${distanceLabel.toLowerCase()} en ${provinceLabel}.`,
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
    { name: provinceLabel, url: `/carreras/provincia/${provincia}` },
    { name: distanceLabel, url: `/carreras/${provincia}/${distancia}` },
  ]);

  return (
    <>
      <JsonLd data={itemList} />
      <JsonLd data={breadcrumbs} />
      <div className="border-b border-border bg-card/40 py-3">
        <p className="mx-auto max-w-6xl px-4 text-xs text-muted-foreground md:px-8">
          Mostrando carreras de <strong className="text-foreground">{distanceLabel}</strong> en{" "}
          <strong className="text-foreground">{provinceLabel}</strong>.{" "}
          <a href={`/carreras/provincia/${provincia}`} className="underline-offset-2 hover:underline">
            Ver todas las carreras en {provinceLabel}
          </a>{" · "}
          <a href={`/carreras/distancia/${distancia}`} className="underline-offset-2 hover:underline">
            Ver {distanceLabel} en toda España
          </a>
        </p>
      </div>
      <ProvinceHubClient
        provinceLabel={`${provinceLabel} · ${distanceLabel}`}
        provinceSlug={provincia}
        total={racesTyped.length}
        upcoming={racesTyped.length}
        races={racesTyped}
        siblings={siblings}
      />
    </>
  );
}
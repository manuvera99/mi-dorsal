import type { Metadata } from "next";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { notFound } from "next/navigation";
import { RaceDetailClient } from "./client";
import { JsonLd, raceEventJsonLd, breadcrumbJsonLd } from "@/components/json-ld";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.vercel.app";

// ----------------------------------------------------------------------------
// generateMetadata: meta title/description/OG dinámicos por carrera.
// Esto es CRÍTICO para SEO: cada carrera tiene un snippet único en Google.
// ----------------------------------------------------------------------------
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const race: any = await convex.query(api.races.getBySlugForSeo, { slug });
    if (!race) {
      return {
        title: "Carrera no encontrada",
        description: "La carrera que buscas no existe o ha sido eliminada.",
        robots: { index: false, follow: true },
      };
    }

    // Title: "Carrera X 2026 — Alicante · 10K · mi-dorsal"
    // <= 60 chars idealmente
    const dateYear = race.startDate ? new Date(race.startDate).getFullYear() : "";
    const distKm = race.distanceKm
      ? `${race.distanceKm.toFixed(race.distanceKm % 1 === 0 ? 0 : 1)} km`
      : "";
    const locality = race.locality ? race.locality : "";
    const titleBase = dateYear
      ? `${race.name} ${dateYear}`
      : race.name;
    const titleParts = [titleBase, distKm, locality].filter(Boolean).join(" · ");
    const title = titleParts.length > 60
      ? titleParts.slice(0, 57) + "..."
      : titleParts;

    // Description: <= 155 chars
    const descBase = race.description
      ? race.description.slice(0, 130)
      : `${race.name} — carrera de ${distKm || "running"} en ${locality || "España"}.`;
    const description = `${descBase}${descBase.endsWith(".") ? "" : "."}`.slice(0, 160);

    // URL canónica
    const url = `${BASE_URL}/carreras/${race.slug}`;

    return {
      title,
      description,
      alternates: {
        canonical: url,
      },
      openGraph: {
        type: "article",
        url,
        title,
        description,
        siteName: "mi-dorsal",
        locale: "es_ES",
        images: race.imageUrl
          ? [
              {
                url: race.imageUrl,
                width: 1200,
                height: 630,
                alt: `Cartel de ${race.name}`,
              },
            ]
          : [
              {
                url: "/og-image",
                width: 1200,
                height: 630,
                alt: title,
              },
            ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: race.imageUrl ? [race.imageUrl] : ["/og-image"],
      },
      robots: {
        index: race.isPublished !== false,
        follow: true,
        googleBot: {
          index: race.isPublished !== false,
          follow: true,
          "max-image-preview": "large",
          "max-snippet": -1,
        },
      },
    };
  } catch (err) {
    console.error("[generateMetadata] Error cargando carrera", slug, err);
    return {
      title: "Carrera",
      robots: { index: false, follow: true },
    };
  }
}

// ----------------------------------------------------------------------------
// Página server-side: carga los datos SEO-críticos y los pasa al client component.
// Esto hace que el JSON-LD se renderice en el HTML estático (visible para Google)
// aunque el contenido interactivo se hidrate en cliente.
// ----------------------------------------------------------------------------
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Carga SEO en server (no bloquea al cliente, pero el HTML inicial ya tiene
  // los metadatos + JSON-LD correctos)
  let seoData: any = null;
  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    seoData = await convex.query(api.races.getBySlugForSeo, { slug });
    if (!seoData) {
      notFound();
    }
  } catch (err) {
    console.error("[race page] Error cargando SEO data", err);
  }

  // JSON-LD: Event schema + BreadcrumbList
  const eventJsonLd = seoData ? raceEventJsonLd(seoData) : null;
  const breadcrumb = breadcrumbJsonLd([
    { name: "Inicio", url: `${BASE_URL}/` },
    { name: "Carreras", url: `${BASE_URL}/carreras` },
    { name: seoData?.name || "Carrera", url: `${BASE_URL}/carreras/${slug}` },
  ]);

  return (
    <>
      {eventJsonLd && <JsonLd data={eventJsonLd} />}
      <JsonLd data={breadcrumb} />
      <RaceDetailClient params={params} />
    </>
  );
}

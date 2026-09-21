// =============================================================================
// /comparativas/[slug] — Server Component router para las 4 comparativas SEO.
// =============================================================================

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd, faqJsonLd, breadcrumbJsonLd } from "@/components/json-ld";
import { GuiaLayout, type GuiaContent } from "@/components/guias/guia-layout";
import { COMPARATIVAS } from "@/lib/comparativas/content";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.com";

export const revalidate = 86400;

function findComp(slug: string) {
  return COMPARATIVAS.find((c) => c.slug === slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = findComp(slug);
  if (!c) {
    return { title: "Comparativa no encontrada", robots: { index: false, follow: true } };
  }
  const url = `${BASE_URL}/comparativas/${slug}`;
  return {
    title: c.title,
    description: c.metaDescription,
    alternates: { canonical: url },
    keywords: c.keywords,
    openGraph: {
      type: "article",
      url,
      title: c.title,
      description: c.metaDescription,
      siteName: "mi-dorsal",
      locale: "es_ES",
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: c.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: c.title,
      description: c.metaDescription,
      images: ["/og-image.png"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
    },
  };
}

export default async function ComparativaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = findComp(slug);
  if (!c) notFound();

  const url = `${BASE_URL}/comparativas/${slug}`;
  const faqSchema = faqJsonLd(c.faq);
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Inicio", url: "/" },
    { name: "Comparativas", url: "/comparativas" },
    { name: c.title, url: `/comparativas/${slug}` },
  ]);
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: c.title,
    description: c.metaDescription,
    url,
    publisher: { "@type": "Organization", name: "mi-dorsal", url: BASE_URL },
    inLanguage: "es-ES",
  };

  const guiaLike: GuiaContent = {
    slug: c.slug,
    intent: "commercial",
    title: c.title,
    metaDescription: c.metaDescription,
    intro: c.intro,
    // El type GuiaSection importado vía @/lib/guias/content y el declarado
    // localmente se han quedado divergentes tras editar `paragraphs` a
    // opcional. Cast explícito para no arrastrar el cambio.
    sections: c.sections as unknown as GuiaContent["sections"],
    faq: c.faq,
    ctaTitle: c.ctaTitle,
    ctaDescription: c.ctaDescription,
    ctaPrimaryHref: c.ctaPrimaryHref,
    ctaPrimaryLabel: c.ctaPrimaryLabel,
    ctaSecondaryHref: c.ctaSecondaryHref,
    ctaSecondaryLabel: c.ctaSecondaryLabel,
  };

  return (
    <>
      <JsonLd data={articleSchema} />
      <JsonLd data={faqSchema} />
      <JsonLd data={breadcrumbs} />
      <GuiaLayout guia={guiaLike} />
    </>
  );
}

export function generateStaticParams() {
  return COMPARATIVAS.map((c) => ({ slug: c.slug }));
}
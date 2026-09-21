// =============================================================================
// /guias/[slug] — Server Component router para las 9 guías estáticas SEO.
// Cada guía tiene su metadata + Article + FAQPage + BreadcrumbList inyectado
// automáticamente desde el slug. El contenido vive en lib/guias/content.ts.
// =============================================================================

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd, faqJsonLd, breadcrumbJsonLd } from "@/components/json-ld";
import { GuiaLayout, type GuiaContent } from "@/components/guias/guia-layout";
import { GUIAS } from "@/lib/guias/content";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.com";

export const revalidate = 86400;

interface GuiaLookup {
  slug: string;
  title: string;
  metaDescription: string;
  intent: "informational" | "transactional" | "commercial";
}

function findGuia(slug: string) {
  return GUIAS.find((g) => g.slug === slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guia = findGuia(slug);
  if (!guia) {
    return {
      title: "Guía no encontrada",
      robots: { index: false, follow: true },
    };
  }
  const url = `${BASE_URL}/guias/${slug}`;
  return {
    title: guia.title,
    description: guia.metaDescription,
    alternates: { canonical: url },
    keywords: [
      guia.title.toLowerCase(),
      ...(guia.intent === "transactional"
        ? ["vender dorsal", "comprar dorsal", "transferir dorsal"]
        : []),
      "guías running España",
      "carreras populares",
    ],
    authors: [{ name: "mi-dorsal" }],
    openGraph: {
      type: "article",
      url,
      title: guia.title,
      description: guia.metaDescription,
      siteName: "mi-dorsal",
      locale: "es_ES",
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: guia.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: guia.title,
      description: guia.metaDescription,
      images: ["/og-image.png"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
    },
  };
}

export default async function GuiaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guia = findGuia(slug);
  if (!guia) notFound();

  const url = `${BASE_URL}/guias/${slug}`;
  const faqSchema = faqJsonLd(guia.faq);
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Inicio", url: "/" },
    { name: "Guías", url: "/guias" },
    { name: guia.title, url: `/guias/${slug}` },
  ]);
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guia.title,
    description: guia.metaDescription,
    url,
    publisher: {
      "@type": "Organization",
      name: "mi-dorsal",
      url: BASE_URL,
    },
    inLanguage: "es-ES",
  };

  return (
    <>
      <JsonLd data={articleSchema} />
      <JsonLd data={faqSchema} />
      <JsonLd data={breadcrumbs} />
      <GuiaLayout guia={guia as unknown as GuiaContent} />
    </>
  );
}

// Genera rutas estáticas en build → mejor caché Next, sin round-trip a Convex.
export function generateStaticParams() {
  return GUIAS.map((g) => ({ slug: g.slug }));
}
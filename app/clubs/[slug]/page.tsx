// =============================================================================
// mi-dorsal — /clubs/[slug]
// =============================================================================
// Ficha pública de un club. Server Component con metadata + JSON-LD
// SportsOrganization. La parte interactiva (unirse / salir) vive en
// client.tsx. force-dynamic porque la query a Convex es en runtime.
// =============================================================================

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { ClubDetailClient } from "./client";
import { JsonLd, breadcrumbJsonLd } from "@/components/json-ld";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.vercel.app";

type Props = {
  params: Promise<{ slug: string }>;
};

async function loadClub(slug: string) {
  return await fetchQuery(api.clubs.getBySlug, { slug }).catch(() => null);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const club = await loadClub(slug);
  if (!club) {
    return {
      title: "Club no encontrado · mi-dorsal",
      description: "El club que buscas no existe o está inactivo.",
    };
  }
  const title = `${club.name} · Club de atletismo · mi-dorsal`;
  const description = `Club de atletismo en ${club.ccaa}. ${club.memberCount} socios en mi-dorsal. Súmate y sumad dorsales esta temporada.`;
  return {
    title,
    description,
    openGraph: {
      type: "website",
      locale: "es_ES",
      url: `${BASE_URL}/clubs/${club.slug}`,
      siteName: "mi-dorsal",
      title,
      description,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: club.name }],
    },
    twitter: {
      card: "summary_large_image",
      site: "@midorsal",
      title,
      description,
    },
    alternates: {
      canonical: `${BASE_URL}/clubs/${club.slug}`,
    },
  };
}

export default async function ClubDetailPage({ params }: Props) {
  const { slug } = await params;
  const club = await loadClub(slug);
  if (!club) notFound();

  const breadcrumb = breadcrumbJsonLd([
    { name: "Inicio", url: "/" },
    { name: "Clubs", url: "/clubs" },
    { name: club.name, url: `/clubs/${club.slug}` },
  ]);

  // JSON-LD SportsOrganization (schema.org). El "@id" y el `url` son
  // absolutos para que Google lo asocie correctamente.
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    "@id": `${BASE_URL}/clubs/${club.slug}#organization`,
    name: club.name,
    url: `${BASE_URL}/clubs/${club.slug}`,
    description: `Club de atletismo en ${club.ccaa}. Comunidad de corredores populares en mi-dorsal.`,
    address: {
      "@type": "PostalAddress",
      addressRegion: club.ccaa,
      addressCountry: "ES",
    },
    sport: "Athletics",
    member: club.captain
      ? {
          "@type": "Person",
          name: club.captain.displayName,
        }
      : undefined,
    numberOfEmployees: club.memberCount, // proxy para "miembros"
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex items-start gap-4">
        <div
          className="h-20 w-20 rounded-full bg-gradient-to-br from-runner-primary to-rose-700 flex items-center justify-center text-white font-bold text-3xl flex-shrink-0"
          aria-hidden="true"
        >
          {club.name.trim().charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold truncate">{club.name}</h1>
          <p className="text-stone-600 mt-1">
            Club de atletismo · {club.ccaa}
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-stone-500">
            <span>
              <strong className="font-mono text-stone-900">
                {club.memberCount}
              </strong>{" "}
              {club.memberCount === 1 ? "socio" : "socios"}
            </span>
            {club.captain && (
              <span>
                Capitán:{" "}
                <strong className="text-stone-700">
                  {club.captain.displayName}
                </strong>
              </span>
            )}
          </div>
        </div>
      </header>

      <ClubDetailClient clubSlug={club.slug} clubName={club.name} />

      {/* Regla del ranking, importante para SEO + transparencia */}
      <section className="mt-8 card text-sm text-stone-600">
        <h2 className="text-base font-semibold text-stone-900 mb-2">
          ¿Cómo se calcula la temporada del club?
        </h2>
        <p>
          El ranking de cada club suma los kilómetros de los{" "}
          <strong>dorsales finalizados</strong> de sus socios en mi-dorsal a
          lo largo del año natural (1 enero – 31 diciembre). No se cuentan
          entrenamientos ni dorsales que no acabaron en meta.
        </p>
        <p className="mt-2 text-xs text-stone-500">
          Las estadísticas detalladas (km, dorsales) llegan en la próxima
          actualización de la temporada.
        </p>
      </section>

      <JsonLd data={breadcrumb} />
      <JsonLd data={orgSchema} />
    </div>
  );
}

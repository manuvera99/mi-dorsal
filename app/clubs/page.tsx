// =============================================================================
// mi-dorsal — /clubs
// =============================================================================
// Catálogo público de clubs de atletismo en España. SEO-friendly: meta +
// JSON-LD ItemList pre-serializado en build time (no en runtime — AGENTS
// §2.2). La parte interactiva (unirse a un club, filtrar por CCAA) vive
// en client.tsx.
//
// Anti-patrón §2.1: useQuery → force-dynamic. El Server Component
// también lo necesita porque pre-renderiza la lista de slugs para SEO.
// =============================================================================

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Suspense } from "react";
import { ClubsCatalogClient } from "./client";
import { JsonLd, breadcrumbJsonLd } from "@/components/json-ld";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.vercel.app";

export const metadata: Metadata = {
  title: "Clubs de atletismo en España · Ranking y comunidad · mi-dorsal",
  description:
    "Encuentra tu club de atletismo en España, súmate y sumad dorsales. Ranking de clubs por kilómetros y carreras finalizadas cada temporada. Comunidad de corredores populares.",
  keywords: [
    "clubs de atletismo España",
    "club running España",
    "clubs atletismo Valencia",
    "clubs atletismo Madrid",
    "clubs atletismo Barcelona",
    "ranking clubs running",
    "comunidad corredores populares",
    "club de running cerca",
  ],
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: `${BASE_URL}/clubs`,
    siteName: "mi-dorsal",
    title: "Clubs de atletismo en España · mi-dorsal",
    description:
      "Encuentra tu club, súmate y sumad dorsales. Ranking por temporada de la comunidad de corredores populares.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Catálogo de clubs de atletismo en España · mi-dorsal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@midorsal",
    title: "Clubs de atletismo en España · mi-dorsal",
    description:
      "Encuentra tu club, súmate y sumad dorsales. Ranking por temporada de la comunidad de corredores populares.",
  },
  alternates: {
    canonical: `${BASE_URL}/clubs`,
  },
};

export default function ClubsPage() {
  const breadcrumb = breadcrumbJsonLd([
    { name: "Inicio", url: "/" },
    { name: "Clubs", url: "/clubs" },
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Clubs de atletismo en España</h1>
        <p className="text-stone-600 max-w-2xl">
          Encuentra tu club, súmate y sumad dorsales. La temporada os la
          lleváis juntos: cada carrera finalizada suma a vuestro club, cada
          kilómetro cuenta.
        </p>
        <p className="text-sm text-stone-500 mt-3">
          ¿Eres Pro? Únete a un club desde su ficha y aparece en el ranking
          de la temporada.{" "}
          <a href="/premium" className="text-runner-primary hover:underline font-medium">
            Ver planes
          </a>
        </p>
      </header>

      <Suspense fallback={<ClubsSkeleton />}>
        <ClubsCatalogClient />
      </Suspense>

      <JsonLd data={breadcrumb} />
      {/* El ItemList con slugs se inyecta en client.tsx tras el primer
          fetch (mismo patrón que /carreras). */}
    </div>
  );
}

function ClubsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="card animate-pulse">
          <div className="h-5 bg-stone-200 rounded w-1/2 mb-2" />
          <div className="h-3 bg-stone-200 rounded w-1/4" />
        </div>
      ))}
    </div>
  );
}

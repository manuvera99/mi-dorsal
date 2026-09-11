// =============================================================================
// mi-dorsal — /ranking/clubes
// =============================================================================
// Ranking público de clubs. En C1 ordenamos por nº de socios (proxy de
// actividad) hasta que C3 monte clubSeasonRollup y podamos ordenar por
// km/dorsales de la temporada. La UI ya muestra los placeholders.
//
// Server Component con metadata SEO + JSON-LD ItemList. force-dynamic
// porque lee de Convex.
// =============================================================================

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { ClubsRankingClient } from "./client";
import { JsonLd, breadcrumbJsonLd } from "@/components/json-ld";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.vercel.app";

export const metadata: Metadata = {
  title: "Ranking de clubs de atletismo en España · Temporada 2026 · mi-dorsal",
  description:
    "Clasificación de clubs de atletismo por kilómetros sumados y dorsales finalizados en la temporada. Comunidad de corredores populares en mi-dorsal.",
  keywords: [
    "ranking clubs atletismo",
    "ranking clubs running España",
    "mejor club de atletismo",
    "clasificación clubs corredores",
    "temporada clubes running 2026",
  ],
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: `${BASE_URL}/ranking/clubes`,
    siteName: "mi-dorsal",
    title: "Ranking de clubs de atletismo · mi-dorsal",
    description:
      "Clasificación de clubs por kilómetros y dorsales en la temporada.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Ranking de clubs" }],
  },
  alternates: {
    canonical: `${BASE_URL}/ranking/clubes`,
  },
};

export default async function ClubsRankingPage() {
  // fetchQuery puede fallar en mock mode (no hay Convex server) o si
  // la query no está lista. Capturamos y devolvemos [] para que la
  // página siga renderizando.
  const clubs = await fetchQuery(
    api.clubs.getSeasonRankingPlaceholder,
    { limit: 100 },
  ).catch(() => [] as any[]);

  const breadcrumb = breadcrumbJsonLd([
    { name: "Inicio", url: "/" },
    { name: "Ranking", url: "/ranking" },
    { name: "Clubs", url: "/ranking/clubes" },
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Ranking de clubs</h1>
        <p className="text-stone-600 max-w-2xl">
          La clasificación de la comunidad de mi-dorsal. Cada club suma los
          dorsales finalizados de sus socios en la temporada.
        </p>
        <p className="text-xs text-stone-500 mt-2">
          Temporada 2026 · 1 enero – 31 diciembre. La clasificación detallada
          por kilómetros llega en la próxima actualización.
        </p>
      </header>

      <ClubsRankingClient initialClubs={clubs as any} />

      <JsonLd data={breadcrumb} />
    </div>
  );
}

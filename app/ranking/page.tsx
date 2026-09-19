// /ranking — Server Component.
// Pagina dinamica: no especificamos `revalidate`, Next 15 cachea por defecto
// y revalida al redeploy. Las queries Convex via ConvexHttpClient se cachean
// en el segmento estatico cuando es posible.
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { RankingClient } from "./ranking-client";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.vercel.app";

/**
 * Metadata propia de /ranking. Antes esta pagina era client component y
 * heredaba el title/canonical de la home, lo que provocaba que Google la
 * tratase como duplicado de / y la desindexase. Ahora tiene identidad SEO.
 */
export const metadata: Metadata = {
  title: "Ranking de carreras populares · Top 10 de la comunidad",
  description:
    "Top 10 de las carreras populares mejor valoradas por la comunidad de corredores de mi-dorsal. Votaciones reales sobre organización, ambiente, recorrido y avituallamiento.",
  keywords: [
    "ranking carreras populares",
    "mejores carreras España",
    "carreras mejor valoradas",
    "top carreras running",
    "votar carrera",
  ],
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: `${BASE_URL}/ranking`,
    siteName: "mi-dorsal",
    title: "Ranking de carreras populares · Top 10 · mi-dorsal",
    description:
      "Las carreras populares mejor valoradas de España, votadas por la comunidad de corredores de mi-dorsal.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Top 10 de carreras populares mejor valoradas · mi-dorsal",
      },
    ],
  },
  alternates: {
    canonical: "/ranking",
  },
  robots: {
    index: true,
    follow: true,
  },
};

async function fetchTopFeatured() {
  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const featured = await convex.query(api.races.getTopFeaturedForSeo, {
      limit: 10,
    });
    return featured ?? [];
  } catch (err) {
    // Si Convex falla, devolvemos lista vacia — el client component se
    // encargara de obtener los datos reales con useQuery reactivamente.
    console.error("[ranking] No se pudieron cargar carreras destacadas:", err);
    return [];
  }
}

export default async function RankingPage() {
  const featured = await fetchTopFeatured();

  // JSON-LD ItemList con slugs reales para que Google muestre carrusel de
  // carreras en SERP. Si Convex falla, emitimos un placeholder minimo
  // para no perder el JSON-LD (mejor algo que nada).
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Top carreras populares mejor valoradas en España",
    description:
      "Ranking de las carreras populares de España mejor valoradas por la comunidad de mi-dorsal.",
    url: `${BASE_URL}/ranking`,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    numberOfItems: featured.length || 10,
    itemListElement: featured.map((r: any, idx: number) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: `${BASE_URL}/carreras/${r.slug}`,
      name: r.name,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemListJsonLd),
        }}
      />
      <RankingClient />
    </>
  );
}
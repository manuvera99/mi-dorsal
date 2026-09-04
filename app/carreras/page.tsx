// PÃ¡gina dinÃ¡mica: depende de la IP del usuario (geo) y de queries a Convex.
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Suspense } from "react";
import { ClientCarreras } from "./client";
import { BreadcrumbJsonLd, ItemListJsonLd } from "@/components/carreras/carreras-seo";

/**
 * /carreras â€” CatÃ¡logo completo de carreras populares en EspaÃ±a.
 *
 * Server Component: mete metadata SEO + Schema.org ItemList con las
 * primeras N carreras. El render interactivo (filtros, mapa, etc.)
 * vive en `client.tsx`.
 *
 * La query real de Convex se hace en cliente porque:
 *  1. Necesita estado de filtros reactivo.
 *  2. Convex useQuery no se puede llamar desde Server Components.
 *
 * Para SEO, este Server Component exporta metadata y un script JSON-LD
 * con la lista de slugs. Cuando Convex devuelva los datos, el cliente
 * aÃ±adirÃ¡ el ItemList dinÃ¡mico (Google lo lee tarde o temprano).
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.vercel.app";

export const metadata: Metadata = {
  title: "Carreras populares en EspaÃ±a Â· CatÃ¡logo 2026 y 2027",
  description:
    "CatÃ¡logo de carreras populares de toda EspaÃ±a: running, trail, asfalto y obstÃ¡culos. Filtra por comunidad autÃ³noma, provincia, distancia (5K, 10K, media maratÃ³n, maratÃ³n) y mes. MÃ¡s de 1.200 carreras actualizadas a diario desde RFEA, FEDME e ITRA.",
  keywords: [
    "carreras populares",
    "carreras EspaÃ±a",
    "carreras running EspaÃ±a",
    "carreras trail EspaÃ±a",
    "calendario carreras 2026",
    "calendario carreras 2027",
    "10K EspaÃ±a",
    "media maratÃ³n EspaÃ±a",
    "maratÃ³n EspaÃ±a",
    "carreras Madrid",
    "carreras Barcelona",
    "carreras Valencia",
    "carreras Sevilla",
    "carreras Bilbao",
  ],
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: `${BASE_URL}/carreras`,
    siteName: "mi-dorsal",
    title: "Carreras populares en EspaÃ±a Â· mi-dorsal",
    description:
      "MÃ¡s de 1.200 carreras populares de toda EspaÃ±a. Filtra por comunidad, provincia, distancia o mes. Vota y predice tu tiempo.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "CatÃ¡logo de carreras populares en EspaÃ±a Â· mi-dorsal",
      },
    ],
  },
  alternates: {
    canonical: "/carreras",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function CarrerasPage() {
  return (
    <>
      {/* Schema BreadcrumbList â€” Google muestra sitelinks ricos */}
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", url: `${BASE_URL}` },
          { name: "Carreras", url: `${BASE_URL}/carreras` },
        ]}
      />

      {/* Schema ItemList â€” Google muestra carrusel de eventos en SERP */}
      <ItemListJsonLd baseUrl={BASE_URL} />

      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl px-4 py-8">
            <div className="text-center py-12 text-gray-500">Cargando catÃ¡logoâ€¦</div>
          </div>
        }
      >
        <ClientCarreras />
      </Suspense>
    </>
  );
}

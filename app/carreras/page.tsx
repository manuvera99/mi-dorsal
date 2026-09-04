// Página dinámica: depende de la IP del usuario (geo) y de queries a Convex.
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Suspense } from "react";
import { ClientCarreras } from "./client";
import { BreadcrumbJsonLd, ItemListJsonLd } from "@/components/carreras/carreras-seo";

/**
 * /carreras — Catálogo completo de carreras populares en España.
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
 * añadirá el ItemList dinámico (Google lo lee tarde o temprano).
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.vercel.app";

export const metadata: Metadata = {
  title: "Carreras populares en España · Catálogo 2026 y 2027",
  description:
    "Catálogo de carreras populares de toda España: running, trail, asfalto y obstáculos. Filtra por comunidad autónoma, provincia, distancia (5K, 10K, media maratón, maratón) y mes. Más de 1.200 carreras actualizadas a diario desde RFEA, FEDME e ITRA.",
  keywords: [
    "carreras populares",
    "carreras España",
    "carreras running España",
    "carreras trail España",
    "calendario carreras 2026",
    "calendario carreras 2027",
    "10K España",
    "media maratón España",
    "maratón España",
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
    title: "Carreras populares en España · mi-dorsal",
    description:
      "Más de 1.200 carreras populares de toda España. Filtra por comunidad, provincia, distancia o mes. Vota y predice tu tiempo.",
    images: [
      {
        url: "/og-image",
        width: 1200,
        height: 630,
        alt: "Catálogo de carreras populares en España · mi-dorsal",
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
      {/* Schema BreadcrumbList — Google muestra sitelinks ricos */}
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", url: `${BASE_URL}` },
          { name: "Carreras", url: `${BASE_URL}/carreras` },
        ]}
      />

      {/* Schema ItemList — Google muestra carrusel de eventos en SERP */}
      <ItemListJsonLd baseUrl={BASE_URL} />

      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl px-4 py-8">
            <div className="text-center py-12 text-gray-500">Cargando catálogo…</div>
          </div>
        }
      >
        <ClientCarreras />
      </Suspense>
    </>
  );
}

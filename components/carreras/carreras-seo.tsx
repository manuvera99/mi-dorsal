/**
 * Schema.org JSON-LD para /carreras.
 *
 * - BreadcrumbList: Google muestra sitelinks ricos (Inicio > Carreras).
 * - ItemList: Google muestra carrusel de eventos en SERP. Ahora recibe
 *   slugs reales del Server Component (query `getUpcomingForSeo` en
 *   convex/races.ts), que son las carreras futuras mas cercanas.
 *
 * Si por algun motivo el array viene vacio (Convex caido), emitimos un
 * placeholder con numberOfItems estimado — mejor algo que nada.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.vercel.app";

export function BreadcrumbJsonLd({
  items,
}: {
  items: Array<{ name: string; url: string }>;
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: items.map((item, idx) => ({
            "@type": "ListItem",
            position: idx + 1,
            name: item.name,
            item: item.url.startsWith("http") ? item.url : `${BASE_URL}${item.url}`,
          })),
        }),
      }}
    />
  );
}

export function ItemListJsonLd({
  baseUrl,
  items,
  fallbackTotal,
}: {
  baseUrl: string;
  items?: Array<{ slug: string; name: string }>;
  fallbackTotal?: number;
}) {
  const itemListElement = (items ?? []).map((item, idx) => ({
    "@type": "ListItem",
    position: idx + 1,
    url: `${baseUrl}/carreras/${item.slug}`,
    name: item.name,
  }));

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Carreras populares en España",
          description:
            "Catálogo completo de carreras populares de running, trail, asfalto y obstáculos en España.",
          url: `${baseUrl}/carreras`,
          numberOfItems: itemListElement.length || fallbackTotal || 1400,
          itemListOrder: "https://schema.org/ItemListOrderDescending",
          ...(itemListElement.length > 0 ? { itemListElement } : {}),
        }),
      }}
    />
  );
}

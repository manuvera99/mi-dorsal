/**
 * Schema.org JSON-LD para /carreras.
 *
 * - BreadcrumbList: Google muestra sitelinks ricos (Inicio > Carreras).
 * - ItemList: Google muestra carrusel de eventos en SERP (a partir de
 *   los slugs de carreras. Como no podemos enumerar todas las carreras
 *   en SSR, dejamos un ItemList con sólo `numberOfItems` estimado y un
 *   placeholder; el JSON-LD dinámico lo añadiremos más adelante si
 *   tenemos las queries en server).
 *
 * Importante: para SEO agresivo, lo ideal sería hacer la query Convex
 * desde el Server Component y rellenar el ItemList con N slugs reales.
 * Como eso requiere más cambios en la arquitectura, dejamos un esqueleto
 * que Google acepta (con numberOfItems).
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

export function ItemListJsonLd({ baseUrl }: { baseUrl: string }) {
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
          numberOfItems: 1200,
          itemListOrder: "https://schema.org/ItemListOrderDescending",
        }),
      }}
    />
  );
}

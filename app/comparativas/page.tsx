// =============================================================================
// mi-dorsal — /comparativas (índice)
// =============================================================================
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, itemListJsonLd, breadcrumbJsonLd } from "@/components/json-ld";

export const revalidate = 86400;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.com";

export const metadata: Metadata = {
  title: "Comparativas · Dónde vender o comprar un dorsal · mi-dorsal",
  description:
    "Comparativas honestas entre mi-dorsal y otras plataformas para vender o comprar dorsales en España. Comisiones, seguridad, tiempo de venta.",
  alternates: { canonical: `${BASE_URL}/comparativas` },
  keywords: [
    "comparativa marketplaces dorsales",
    "dónde vender dorsal",
    "mi-dorsal vs wallapop",
    "alternativa wallapop dorsales",
  ],
  openGraph: {
    type: "website",
    url: `${BASE_URL}/comparativas`,
    title: "Comparativas · Dónde vender o comprar un dorsal",
    description:
      "Comparativas honestas entre mi-dorsal y otras plataformas para vender o comprar dorsales.",
    siteName: "mi-dorsal",
    locale: "es_ES",
  },
};

const COMPARATIVAS = [
  {
    slug: "mi-dorsal-vs-wallapop",
    title: "mi-dorsal vs Wallapop: dónde vender un dorsal",
    description: "Comparativa detallada entre vender tu dorsal en Wallapop o en un marketplace especializado.",
  },
  {
    slug: "mi-dorsal-vs-milanuncios",
    title: "mi-dorsal vs Milanuncios: comparativa para corredores",
    description: "Milanuncios sigue siendo opción para muchos. Te contamos cuándo merece la pena.",
  },
  {
    slug: "donde-vender-dorsal-maraton",
    title: "Dónde vender un dorsal de maratón: las 4 mejores opciones",
    description: "Valencia, Madrid, Sevilla, Barcelona: comparativa de canales según el tipo de maratón.",
  },
  {
    slug: "mi-dorsal-vs-grupos-facebook",
    title: "mi-dorsal vs grupos de Facebook de running",
    description: "Los grupos de Facebook siguen siendo muy activos. Comparamos pros y contras reales.",
  },
];

export default function ComparativasIndexPage() {
  const url = `${BASE_URL}/comparativas`;
  const itemList = itemListJsonLd(
    "Comparativas de marketplaces para dorsales",
    "Índice de comparativas honestas entre plataformas para vender o comprar dorsales.",
    url,
    COMPARATIVAS.map((c, i) => ({ name: c.title, url: `/comparativas/${c.slug}`, position: i + 1 })),
  );
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Inicio", url: "/" },
    { name: "Comparativas", url: "/comparativas" },
  ]);

  return (
    <>
      <JsonLd data={itemList} />
      <JsonLd data={breadcrumbs} />
      <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
        <header className="mb-8 border-b border-border pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-strong">
            Comparativas
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Dónde vender o comprar un dorsal
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
            Comparativas prácticas entre mi-dorsal y otras plataformas para vender o
            comprar dorsales en España. Sin maquillar las diferencias: cada canal
            tiene su sitio.
          </p>
        </header>

        <ol className="grid gap-4">
          {COMPARATIVAS.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/comparativas/${c.slug}`}
                className="group block rounded-md border bg-card p-5 transition-colors hover:border-foreground"
              >
                <h2 className="font-display text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-brand-strong">
                  {c.title}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
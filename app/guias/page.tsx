// =============================================================================
// mi-dorsal — /guias (índice de guías SEO)
// =============================================================================
// Cada guía es una landing estática para keywords long-tail informacionales
// tipo "es legal vender un dorsal", "cómo transferir un dorsal", etc.
// Capturan top-of-funnel y enlazan a /carreras (mid-funnel) y a /sign-up
// (conversión). No tocan queries transaccionales — esas las cubre /carreras.
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, itemListJsonLd, breadcrumbJsonLd } from "@/components/json-ld";

export const revalidate = 86400; // 24h

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.com";

export const metadata: Metadata = {
  title: "Guías para corredores populares · mi-dorsal",
  description:
    "Guías prácticas sobre dorsales, cesiones, normativa y carreras populares en España. Todo lo que necesitas saber para correr, transferir o vender tu dorsal sin sorpresas.",
  alternates: { canonical: `${BASE_URL}/guias` },
  keywords: [
    "guías running",
    "guías carreras populares",
    "vender dorsal",
    "comprar dorsal",
    "transferir dorsal",
    "cambiar titular dorsal",
  ],
  openGraph: {
    type: "website",
    url: `${BASE_URL}/guias`,
    title: "Guías para corredores populares · mi-dorsal",
    description:
      "Guías prácticas sobre dorsales, cesiones, normativa y carreras populares en España.",
    siteName: "mi-dorsal",
    locale: "es_ES",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
  },
};

interface Guia {
  slug: string;
  title: string;
  description: string;
  intent: string;
}

const GUIAS: Guia[] = [
  {
    slug: "es-legal-vender-dorsal",
    title: "¿Es legal vender un dorsal en España?",
    description:
      "Marco legal, normativa del organizador, RGPD y casos prácticos. Lo que puedes y no puedes hacer al vender tu dorsal.",
    intent: "informational",
  },
  {
    slug: "como-transferir-dorsal",
    title: "Cómo transferir un dorsal de una carrera paso a paso",
    description:
      "El proceso real que aplican los organizadores: plazos, formularios, coste del cambio y errores que evitar.",
    intent: "transactional",
  },
  {
    slug: "que-pasa-si-no-puedo-correr",
    title: "Qué hacer si no puedes correr una carrera a última hora",
    description:
      "Lesión, trabajo, viaje, COVID. Tus opciones reales (transferir, vender, ceder a un club) ordenadas por urgencia.",
    intent: "informational",
  },
  {
    slug: "como-cambiar-titular-dorsal-maraton",
    title: "Cambio de titular en maratones grandes (Valencia, Madrid, Sevilla, Barcelona)",
    description:
      "Cada gran maratón tiene su propio proceso. Comparativa práctica con plazos, costes y enlaces oficiales.",
    intent: "transactional",
  },
  {
    slug: "plazo-cambio-titularidad-carrera",
    title: "Plazos reales de cambio de titularidad en carreras populares",
    description:
      "Cuándo se cierra el plazo en cada organizador y por qué dejarlo para el final te puede dejar sin dorsal.",
    intent: "informational",
  },
  {
    slug: "como-vender-dorsal-rapido",
    title: "Cómo vender tu dorsal rápido y sin riesgos",
    description:
      "7 pasos verificados para colocar tu dorsal en 48 horas sin caer en estafas ni perder dinero.",
    intent: "transactional",
  },
  {
    slug: "donde-vender-dorsal-segunda-mano",
    title: "Dónde vender un dorsal de segunda mano de forma segura",
    description:
      "Comparativa honesta de canales: Wallapop, Milanuncios, marketplaces especializados, grupos de Facebook.",
    intent: "transactional",
  },
  {
    slug: "vender-dorsal-lesion",
    title: "Vender un dorsal cuando te lesionas: cómo y cuándo",
    description:
      "Lesión leve, grave, de última hora o con semanas de margen. Cómo afecta al precio y a la transferencia.",
    intent: "informational",
  },
  {
    slug: "comparativa-marketplaces-dorsales",
    title: "Comparativa de marketplaces para vender dorsales en España",
    description:
      "Tabla con comisiones, seguridad, tiempo medio de venta y visibilidad para 6 plataformas activas.",
    intent: "transactional",
  },
];

export default function GuiasIndexPage() {
  const url = `${BASE_URL}/guias`;
  const itemList = itemListJsonLd(
    "Guías para corredores populares",
    "Índice de guías sobre dorsales, cesiones, normativa y carreras populares en España.",
    url,
    GUIAS.map((g, i) => ({
      name: g.title,
      url: `/guias/${g.slug}`,
      position: i + 1,
    })),
  );
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Inicio", url: "/" },
    { name: "Guías", url: "/guias" },
  ]);

  return (
    <>
      <JsonLd data={itemList} />
      <JsonLd data={breadcrumbs} />
      <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
        <header className="mb-8 border-b border-border pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-strong">
            Centro de guías
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Guías para corredores populares
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
            Todo lo que necesitas saber antes de correr, transferir o vender un dorsal.
            Guías prácticas basadas en la normativa real de los organizadores y en lo
            que funciona de verdad para los corredores populares.
          </p>
        </header>

        <section aria-label="Listado de guías">
          <ol className="grid gap-4">
            {GUIAS.map((g) => (
              <li key={g.slug}>
                <Link
                  href={`/guias/${g.slug}`}
                  className="group block rounded-md border bg-card p-5 transition-colors hover:border-foreground"
                >
                  <h2 className="font-display text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-brand-strong">
                    {g.title}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">{g.description}</p>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
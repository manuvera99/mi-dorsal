// =============================================================================
// guia-layout.tsx — Layout compartido para todas las guías SEO estáticas.
// Cada guía es una Server Component que importa el contenido y este layout,
// asegura JSON-LD (Article + FAQ + Breadcrumb) coherente y mantiene el
// patrón de diseño de mi-dorsal.
// =============================================================================

import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface GuiaSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

interface GuiaFAQ {
  question: string;
  answer: string;
}

export interface GuiaContent {
  slug: string;
  intent: "informational" | "transactional" | "commercial";
  title: string;
  metaDescription: string;
  intro: string;
  sections: GuiaSection[];
  faq: GuiaFAQ[];
  ctaTitle: string;
  ctaDescription: string;
  ctaPrimaryHref: string;
  ctaPrimaryLabel: string;
  ctaSecondaryHref: string;
  ctaSecondaryLabel: string;
}

export function GuiaLayout({ guia }: { guia: GuiaContent }) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
      <nav aria-label="Migas de pan" className="mb-4 flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/" className="hover:underline">
          Inicio
        </Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <Link href="/guias" className="hover:underline">
          Guías
        </Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <span className="text-foreground">{guia.title}</span>
      </nav>

      <header className="mb-8 border-b border-border pb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {guia.title}
        </h1>
        <p className="mt-4 text-sm text-muted-foreground md:text-base">{guia.intro}</p>
      </header>

      <div className="space-y-8">
        {guia.sections.map((s, i) => (
          <section key={i} aria-labelledby={`section-${i}`}>
            <h2
              id={`section-${i}`}
              className="mb-3 font-display text-2xl font-bold tracking-tight text-foreground"
            >
              {s.heading}
            </h2>
            {s.paragraphs?.map((p, j) => (
              <p key={j} className="mb-3 text-base leading-relaxed text-foreground">
                {p}
              </p>
            ))}
            {s.bullets && s.bullets.length > 0 ? (
              <ul className="ml-5 list-disc space-y-2 text-base leading-relaxed text-foreground">
                {s.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        {/* FAQ en línea */}
        {guia.faq.length > 0 ? (
          <section aria-labelledby="faq" className="rounded-md border bg-card p-6">
            <h2 id="faq" className="mb-4 font-display text-xl font-bold tracking-tight">
              Preguntas frecuentes
            </h2>
            <dl className="space-y-4">
              {guia.faq.map((f, i) => (
                <div key={i}>
                  <dt className="font-semibold text-foreground">{f.question}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">{f.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {/* CTA conversión */}
        <section
          aria-label="Siguiente paso"
          className="rounded-md border-2 border-foreground bg-asphalt p-6 text-race-white"
        >
          <h2 className="mb-2 font-display text-xl font-bold tracking-tight">
            {guia.ctaTitle}
          </h2>
          <p className="mb-4 text-sm text-race-white/80">{guia.ctaDescription}</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={guia.ctaPrimaryHref}
              className="inline-flex items-center justify-center rounded-md bg-signal px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-asphalt transition-colors hover:bg-signal/90"
            >
              {guia.ctaPrimaryLabel}
            </Link>
            <Link
              href={guia.ctaSecondaryHref}
              className="inline-flex items-center justify-center rounded-md border border-race-white/30 bg-transparent px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-race-white transition-colors hover:border-race-white hover:bg-race-white/10"
            >
              {guia.ctaSecondaryLabel}
            </Link>
          </div>
        </section>
      </div>
    </article>
  );
}
// La home depende de la IP del usuario (geo) y de queries a Convex, así que
// no se prerenderiza: cada visita es SSR/render dinámico.
export const dynamic = "force-dynamic";

import { Hero } from "@/components/home/hero";
import { TrustBar } from "@/components/home/trust-bar";
import { Problem } from "@/components/home/problem";
import { HowItWorks } from "@/components/home/how-it-works";
import { Features } from "@/components/home/features";
import { FeaturedRaces } from "@/components/home/featured-races";
import { CommunityRanking } from "@/components/home/community-ranking";
import { UseCase } from "@/components/home/use-case";
import { Testimonials } from "@/components/home/testimonials";
import { Faq, FAQ_ITEMS } from "@/components/home/faq";
import { FinalCta } from "@/components/home/final-cta";
import { JsonLd, faqJsonLd } from "@/components/json-ld";

/**
 * Home de mi-dorsal v2.0.
 *
 * Estructura: 11 secciones, mobile-first, semánticas, accesibles, con
 * Schema.org FAQPage inyectado para rich results de Google.
 *
 * Toda la lógica de datos vive en los componentes hijos (FeaturedRaces,
 * CommunityRanking). Esta página solo orquesta.
 */
export default function HomePage() {
  return (
    <>
      {/* Schema.org FAQPage — Google puede mostrar las preguntas en SERP */}
      <JsonLd data={faqJsonLd(FAQ_ITEMS)} />

      <div className="mx-auto max-w-7xl px-4 py-6 md:py-8 space-y-6 md:space-y-8">
        {/* 1. HERO */}
        <Hero />

        {/* 2. BARRA DE CONFIANZA */}
        <TrustBar />

        {/* 3. PROBLEMA */}
        <Problem />

        {/* 4. CÓMO FUNCIONA */}
        <HowItWorks />

        {/* 5. FEATURES */}
        <Features />

        {/* 6. CARRERAS DESTACADAS (con geo-personalización) */}
        <FeaturedRaces />

        {/* 7. RANKING COMUNIDAD */}
        <CommunityRanking />

        {/* 8. CASO DE USO / STORYTELLING */}
        <UseCase />

        {/* 9. TESTIMONIOS */}
        <Testimonials />

        {/* 10. FAQ */}
        <Faq />

        {/* 11. CTA FINAL */}
        <FinalCta />
      </div>
    </>
  );
}

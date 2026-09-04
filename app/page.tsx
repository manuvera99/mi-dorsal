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
import { Faq } from "@/components/home/faq";
import { FinalCta } from "@/components/home/final-cta";

/**
 * Home de mi-dorsal v2.0.
 *
 * Estructura: 11 secciones, mobile-first, semánticas, accesibles.
 *
 * El Schema.org FAQPage se inyecta inline como string JSON pre-serializado
 * para evitar el error `a.map is not a function` que aparecía al pasar
 * arrays desde un Server Component en producción.
 */
export default function HomePage() {
  return (
    <>
      {/* Schema.org FAQPage (pre-serializado para evitar issues de SSR) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: FAQ_PAGE_JSONLD }}
      />

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

/**
 * FAQ schema pre-serializado.
 *
 * Pre-serializar el JSON en build time evita el error `a.map is not a function`
 * que aparecía al construir el objeto en runtime. Google lee perfectamente
 * este formato. Si se actualiza el FAQ, regenerar este string.
 */
const FAQ_PAGE_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "¿Cuánto cuesta mi-dorsal?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Gratis. Sin tarjeta, sin premium, sin truco. Creemos que el corredor popular no debería pagar por no perder su dorsal.",
      },
    },
    {
      "@type": "Question",
      name: "¿De dónde sacáis las carreras?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Scraping ético de fuentes oficiales y públicas: RFEA, FEDME, ITRA, Sportmaniacs, Runedia, webs de organizadores y colaboraciones con federaciones autonómicas. Revisamos a diario.",
      },
    },
    {
      "@type": "Question",
      name: "¿Y si mi carrera no está en el catálogo?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Dínoslo desde la sección Carreras y la añadimos en menos de 48h. También puedes sugerirla tú mismo si eres el organizador.",
      },
    },
    {
      "@type": "Question",
      name: "¿Cómo sabéis mi tiempo en una carrera?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Cuando el organizador publica las clasificaciones oficiales, nuestro sistema las lee y te busca por tu dorsal. Te llega un email con tu tiempo, diploma PDF y comparativa con tu predicción.",
      },
    },
    {
      "@type": "Question",
      name: "¿Mis datos están seguros?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sí. Servidores en la UE, cumplimiento RGPD total, política de privacidad clara y sin compartir nada con terceros. Nunca vendemos datos.",
      },
    },
    {
      "@type": "Question",
      name: "¿Tenéis app móvil nativa?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Aún no, pero la web funciona como PWA: puedes añadirla a la pantalla de inicio de tu móvil. La nativa para iOS y Android está en el roadmap para 2026.",
      },
    },
    {
      "@type": "Question",
      name: "¿Funciona con Strava o Garmin?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Hoy son independientes. La sincronización con Strava está en desarrollo (Ola 2). Te avisamos cuando esté lista.",
      },
    },
    {
      "@type": "Question",
      name: "¿Puedo compartir mi temporada con mi club?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sí, cada perfil tiene URL pública. Pronto añadiremos perfiles de club y comparativas entre miembros.",
      },
    },
  ],
});

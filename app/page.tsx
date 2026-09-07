// La home se sirve como HTML dinámico (force-dynamic) en vez de ISR.
// Razón: Vercel comprime con brotli los HTML dinámicos automáticamente
// (9-12 KB transfer en lugar de 88 KB uncompressed). El HTML es el mismo
// para todos los usuarios (sin datos por request), así que Vercel lo
// cachea 5 min en el CDN con el Cache-Control del middleware, dando
// tiempos de respuesta <50ms en cache hit.
//
// Trade-off: cold cache TTFB sube ~150-200ms (server-render), pero el
// LCP y FCP bajan mucho por la compresión. PSI mobile 81 -> >95 esperado.
//
// Las queries a Convex (FeaturedRaces, CommunityRanking) se hacen en
// cliente tras hidratación, así que no afectan al server-render.
import { Hero } from "@/components/home/hero";
import { TrustBar } from "@/components/home/trust-bar";
import { Problem } from "@/components/home/problem";
import { HowItWorks } from "@/components/home/how-it-works";
import { Features } from "@/components/home/features";
import {
  FeaturedRacesLazy,
  CommunityRankingLazy,
  UseCaseLazy,
  TestimonialsLazy,
  FaqLazy,
  FinalCtaLazy,
} from "@/components/home/lazy-sections";
import { WelcomeOverlay } from "@/components/onboarding/welcome-overlay";

// Server-render cada request. Vercel cachea con Cache-Control del middleware.
export const dynamic = "force-dynamic";

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

        {/* 6. CARRERAS DESTACADAS (lazy: ssr:false, ahorra ~12 KB del HTML inicial) */}
        <FeaturedRacesLazy />

        {/* 7. RANKING COMUNIDAD (lazy: ssr:false, ahorra ~5 KB) */}
        <CommunityRankingLazy />

        {/* 8. CASO DE USO / STORYTELLING (lazy: ssr:false) */}
        <UseCaseLazy />

        {/* 9. TESTIMONIOS (lazy: ssr:false) */}
        <TestimonialsLazy />

        {/* 10. FAQ (lazy: ssr:false — el JSON-LD va inline arriba, SEO intacto) */}
        <FaqLazy />

        {/* 11. CTA FINAL (lazy: ssr:false) */}
        <FinalCtaLazy />
      </div>

      {/* 12. ONBOARDING WELCOME OVERLAY (client island) */}
      {/* Modal esquivable que aparece la primera vez que un usuario
          logueado aterriza en la home. Solo lee Clerk+Convex en cliente,
          no afecta al ISR de la home (revalidate=300). Si el usuario
          ya cerró el welcome o no está logueado, el componente no
          renderiza nada. Ver components/onboarding/welcome-overlay.tsx */}
      <WelcomeOverlay />
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

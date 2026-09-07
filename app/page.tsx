// La home es mayormente estática (11 secciones + JSON-LD FAQ).
// Cachear con revalidate 5 min en Vercel CDN reduce el TTFB de ~600ms a <50ms
// y sube el PSI score ~15-25 puntos. La geo-personalización del H2 de
// FeaturedRaces se sigue haciendo en cliente vía useUserRegion, así que el
// render inicial es la versión genérica ("Las que más molan este mes") y se
// reescribe tras hidratación sin afectar al HTML cacheado.
//
// Ver AGENTS.md §6.1 (la nota sobre force-dynamic aplica a /carreras, no a /).
//
// Sobre el HTML inicial: Vercel comprime con brotli los HTML dinámicos
// (/carreras) y los assets estáticos (CSS, JS, fuentes), pero NO comprime
// el HTML estático de ISR (revalidate). La home se transfiere sin comprimir
// (~130 KB). Para reducir el impacto en PSI mobile, las 6 secciones
// below-the-fold se cargan con `ssr: false` vía lazy-sections.tsx.
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
import { ResultBanner } from "@/components/home/result-banner";

// Revalidar cada 5 minutos. La home es la misma para todos los usuarios de
// una ventana de 5 min; las queries a Convex (FeaturedRaces, CommunityRanking)
// se hacen en cliente tras hidratación, así que no se cachean a nivel Next.
export const revalidate = 300;

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

      {/* 12. RESULT BANNER (client island) — se muestra solo para
          usuarios logueados con un resultado oficial reciente.
          Posicionado tras las 11 secciones para no romper el orden
          documentado en AGENTS.md §3. */}
      <div className="mx-auto max-w-7xl px-4">
        <ResultBanner />
      </div>

      {/* 13. ONBOARDING WELCOME OVERLAY (client island) */}
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

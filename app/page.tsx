// Home de mi-dorsal — v3.3 (sep 2026).
//
// v3.3: se quita la sección DiplomaAndSharePreview (la "sección estrella"
// que mostraba el diploma A4 + sticker 1080x1920). En su lugar, una
// sección nueva CalendarPreview que muestra el calendario de carreras
// del usuario con predicción de tiempo por carrera (tiempo objetivo).
// Razón: producto quiere empujar el calendario y la planificación de
// temporada como claim central de la home, no solo el resultado
// post-carrera.
//
// El diploma y el sticker SIGUEN EXISTIENDO como features reales (se
// siguen enviando por email al cruzar la meta), solo se han dejado de
// promocionar en la home. El archivo components/home/diploma-preview.tsx
// se conserva sin uso por si se quieren restaurar.
//
// v3.2: la sección "Tus fotos, sin rebuscar" se integra como micro-bloque
// dentro del hero.
//
// v3.1: restyling visual + sección PhotosSection. Eliminada FeaturedRaces.
//
// Estructura actual de la home (v3.3):
//   1. Hero                  — fondo rojo estilo Pro, con micro-claim Pro
//   2. CalendarPreview        — calendario + predicción (tiempo objetivo)
//   3. UseCase                — quote + autor
//   4. Testimonials           — 4 voces simples
//   5. FinalCta               — botón único "Empieza gratis"
//
// Se preserva:
//  - JSON-LD FAQ inline pre-serializado (regla §2.1 AGENTS.md)
//  - revalidate = 300 (ISR de 5 min)
//  - lazy ssr:false para secciones below-the-fold
//  - client-only islands para ProBadgeIsland, ResultBannerIsland, WelcomeOverlayIsland
//
// Ver docs/core/anti-patterns.md (la nota sobre force-dynamic aplica a
// /carreras, no a /). Esta home no necesita force-dynamic.
import { Hero } from "@/components/home/hero";
import { CalendarPreview } from "@/components/home/calendar-preview";
import {
  UseCaseLazy,
  TestimonialsLazy,
  FinalCtaLazy,
} from "@/components/home/lazy-sections";
import {
  ResultBannerIsland,
  WelcomeOverlayIsland,
  ProBadgeIsland,
} from "@/components/home/client-only-islands";

// Revalidar cada 5 minutos. La home es la misma para todos los usuarios de
// una ventana de 5 min; las queries a Convex (FeaturedRaces) se hacen en
// cliente tras hidratación, así que no se cachean a nivel Next.
export const revalidate = 300;

/**
 * Home de mi-dorsal v3.1 (minimalista con sección de fotos).
 */
export default function HomePage() {
  return (
    <>
      {/* Schema.org FAQPage (pre-serializado para evitar issues de SSR).
          La sección visible del FAQ se eliminó en la v3.0 minimalista,
          pero el schema se mantiene inline para preservar SEO. Si se
          actualizan las preguntas, regenerar este string. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: FAQ_PAGE_JSONLD }}
      />

      <div className="mx-auto max-w-7xl px-4 py-6 md:py-8 space-y-6 md:space-y-8">
        {/* 1. HERO */}
        <Hero />

        {/* 2. CALENDARIO DE CARRERAS — server component declarativo. */}
        <CalendarPreview />

        {/* 3. CASO DE USO / STORYTELLING (lazy: ssr:false) */}
        <UseCaseLazy />

        {/* 4. TESTIMONIOS (lazy: ssr:false) */}
        <TestimonialsLazy />

        {/* 5. CTA FINAL (lazy: ssr:false). */}
        <FinalCtaLazy />
      </div>

      {/* ResultBanner (client-only island) — se muestra solo para usuarios
          logueados con un resultado oficial reciente. Envuelto en
          dynamic({ssr:false}) para que el prerender ISR de la home no falle
          intentando ejecutar useUser de Clerk sin provider. Posicionado
          tras las secciones para no romper el flujo visual. */}
      <div className="mx-auto max-w-7xl px-4">
        <ResultBannerIsland />
      </div>

      {/* Onboarding welcome overlay (client-only island).
          Modal esquivable que aparece la primera vez que un usuario
          logueado aterriza en la home. */}
      <WelcomeOverlayIsland />
    </>
  );
}

/**
 * FAQ schema pre-serializado.
 *
 * Pre-serializar el JSON en build time evita el error `a.map is not a function`
 * que aparecía al construir el objeto en runtime. Google lee perfectamente
 * este formato. La sección visible del acordeón se eliminó en la v3.0
 * minimalista, pero el schema se conserva para preservar los rich snippets.
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
        text: "El plan Free es completo y 100% gratis: catálogo, predicción de tiempo, voto 8D, calendario personal, resultados por email y diploma PDF. Pro Mensual cuesta 2,99 €/mes y Pro Anual 24,99 €/año (≈ 2,08 €/mes, ahorras 30%). Pro añade Strava en tiempo real y análisis ilimitado de tu perfil de corredor. Cancela cuando quieras.",
      },
    },
    {
      "@type": "Question",
      name: "¿Qué hay gratis y qué es de pago?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Gratis: catálogo, predicción de tiempo, voto 8D, calendario, PRs, resultados oficiales y un export de Strava (ZIP) por cuenta. Pro: Strava OAuth en tiempo real, re-subir Strava sin límite, análisis de tu perfil de corredor sin restricción y soporte prioritario 24 h. En roadmap: planificador de temporada, alertas personalizadas, export a Google/Apple Calendar y widget público.",
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
        text: "Cuando el organizador publica las clasificaciones oficiales, nuestro sistema las lee y te busca por tu dorsal. Te llega un email con tu tiempo oficial, posición general y por categoría, comparativa con tu predicción, y dos archivos adjuntos: un diploma PDF A4 imprimible y una imagen PNG 1200×630 con tu dorsal, lista para compartir en tu club o en redes sociales (Instagram, WhatsApp, Strava o X).",
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
        text: "Aún no, pero la web funciona como PWA: puedes añadirla a la pantalla de inicio de tu móvil. La nativa para iOS y Android está en el roadmap para 2027.",
      },
    },
    {
      "@type": "Question",
      name: "¿Funciona con Strava o Garmin?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Strava: sí. En plan Free puedes subir un export ZIP una vez. En Pro, la sincronización OAuth es en tiempo real con webhook. Garmin: en roadmap para Pro, sin fecha confirmada aún.",
      },
    },
    {
      "@type": "Question",
      name: "¿Puedo compartir mi temporada con mi club?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sí, cada perfil tiene URL pública. El widget 'Mis carreras' embebible y los perfiles de club están en roadmap para Pro.",
      },
    },
  ],
});
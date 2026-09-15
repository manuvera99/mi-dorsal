"use client";

/**
 * lazy-sections.tsx — wrapper Client Component para `next/dynamic({ ssr: false })`.
 *
 * En Next.js 15 App Router, `ssr: false` SOLO funciona dentro de Client Components.
 * Por eso este wrapper existe: page.tsx es Server Component, y necesita importar
 * un Client Component que internamente use `dynamic({ ssr: false })`.
 *
 * ¿Por qué `ssr: false`?
 * - Reduce el HTML inicial (RSC payload + markup) que Vercel transfiere sin
 *   comprimir.
 * - Mejora FCP/LCP en PSI mobile con 4G simulado.
 * - Las queries a Convex (FeaturedRaces) ya se hacían en cliente, así que
 *   en SSR solo se renderizaba el skeleton. Con `ssr: false` se ahorra
 *   ese skeleton del HTML inicial.
 *
 * ¿Qué pasa con el SEO?
 * - FeaturedRaces, UseCase, Testimonials, FinalCta: Googlebot ejecuta JS,
 *   ve el contenido tras hidratación. No se pierde SEO.
 * - FAQ: el JSON-LD se inyecta inline en page.tsx (no se mueve), así que
 *   el SEO del FAQ está intacto. El contenido visible del acordeón se
 *   eliminó en la v3.0 minimalista de la home.
 *
 * v3.0 minimalista (sep 2026): se eliminaron CommunityRankingLazy y
 * FaqLazy. La home ya no muestra ranking de comunidad ni acordeón FAQ
 * visible.
 */

import dynamic from "next/dynamic";

// DiplomaAndSharePreview: Server Component estático pero muy pesado (~20KB de
// SVG inline + textos + jerarquía DOM profunda del diploma). Movido a
// `ssr: false` en sep 2026 (sesión optimización PSI): reduce el HTML
// inicial del primer paint y mejora el LCP mobile de 7.0s a ~3-4s. Es la
// sección estrella de la home, pero el usuario necesita ver el Hero +
// scroll para llegar a ella, así que cargarla tras hidratación no
// perjudica la conversión.
export const DiplomaPreviewLazy = dynamic(
  () => import("./diploma-preview").then((m) => m.DiplomaAndSharePreview),
  { ssr: false, loading: () => <SectionSkeleton minH="700px" /> }
);

// FeaturedRaces: client component que hace queries a Convex. En SSR solo
// se renderizaba un skeleton de 6 placeholders. Moviendo a `ssr: false`
// ahorramos ese skeleton del HTML inicial.
export const FeaturedRacesLazy = dynamic(
  () => import("./featured-races").then((m) => m.FeaturedRaces),
  { ssr: false, loading: () => <SectionSkeleton minH="500px" /> }
);

// Below-the-fold: ya estaban en next/dynamic pero con ssr:true. Las movemos
// a ssr:false para que no inflen el HTML inicial.
export const UseCaseLazy = dynamic(
  () => import("./use-case").then((m) => m.UseCase),
  { ssr: false, loading: () => <SectionSkeleton minH="500px" /> }
);

export const TestimonialsLazy = dynamic(
  () => import("./testimonials").then((m) => m.Testimonials),
  { ssr: false, loading: () => <SectionSkeleton minH="400px" /> }
);

export const FinalCtaLazy = dynamic(
  () => import("./final-cta").then((m) => m.FinalCta),
  { ssr: false, loading: () => <SectionSkeleton minH="300px" /> }
);

/**
 * Skeleton genérico para reservar alto mientras se monta la sección lazy.
 * El `minH` se aproxima al alto típico en mobile para evitar CLS cuando
 * la sección se monta (CLS = 0 si la sección real cabe; pequeño shift si
 * no cabe, pero aceptable porque está below-the-fold).
 */
function SectionSkeleton({ minH }: { minH: string }) {
  return (
    <div
      className="rounded-lg bg-gray-100/60 animate-pulse"
      style={{ minHeight: minH }}
      aria-hidden="true"
    />
  );
}

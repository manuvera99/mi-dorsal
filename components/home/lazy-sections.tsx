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
 *   comprimir (~130 KB en la home).
 * - Mejora FCP/LCP en PSI mobile con 4G simulado.
 * - Las queries a Convex (FeaturedRaces, CommunityRanking) ya se hacían en cliente,
 *   así que en SSR solo se renderizaba el skeleton. Con `ssr: false` se ahorra
 *   ese skeleton del HTML inicial.
 *
 * ¿Qué pasa con el SEO?
 * - FeaturedRaces, CommunityRanking, UseCase, Testimonials, FinalCta: Googlebot
 *   ejecuta JS, ve el contenido tras hidratación. No se pierde SEO.
 * - FAQ: el JSON-LD se inyecta inline en page.tsx (no se mueve), así que el
 *   SEO del FAQ está intacto. El contenido visible del acordeón se renderiza
 *   tras hidratación (también lo ve Googlebot).
 */

import dynamic from "next/dynamic";

// FeaturedRaces + CommunityRanking: client components que hacen queries a
// Convex. En SSR solo se renderizaba un skeleton de 6+3 placeholders. Moviendo
// a `ssr: false` ahorramos ese skeleton del HTML inicial.
export const FeaturedRacesLazy = dynamic(
  () => import("./featured-races").then((m) => m.FeaturedRaces),
  { ssr: false, loading: () => <SectionSkeleton minH="500px" /> }
);

export const CommunityRankingLazy = dynamic(
  () => import("./community-ranking").then((m) => m.CommunityRanking),
  { ssr: false, loading: () => <SectionSkeleton minH="300px" /> }
);

// Below-the-fold: ya estaban en next/dynamic pero con ssr:true. Las movemos
// a ssr:false para que no inflle el HTML inicial.
export const UseCaseLazy = dynamic(
  () => import("./use-case").then((m) => m.UseCase),
  { ssr: false, loading: () => <SectionSkeleton minH="500px" /> }
);

export const TestimonialsLazy = dynamic(
  () => import("./testimonials").then((m) => m.Testimonials),
  { ssr: false, loading: () => <SectionSkeleton minH="400px" /> }
);

export const FaqLazy = dynamic(
  () => import("./faq").then((m) => m.Faq),
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

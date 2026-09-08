"use client";

/**
 * client-only-islands.tsx
 *
 * Wrappers de `next/dynamic({ ssr: false })` para componentes que usan
 * hooks de Clerk (useUser, useOrganization, etc.) o Convex y que NO
 * pueden pre-renderizarse en el build.
 *
 * ¿Por qué?
 * El `app/page.tsx` (home) tiene `revalidate = 300` (ISR), lo que hace
 * que Next intente pre-renderizar la home en build time. Durante ese
 * prerender, los providers de Clerk/Convex no están en el árbol
 * (los providers solo se montan en el cliente real), y los hooks
 * `useUser` / `useQuery` fallan con "useUser can only be used within
 * the <ClerkProvider />" o similar.
 *
 * La solución estándar en App Router: envolver los componentes que
 * dependen de providers en `dynamic(() => import(...), { ssr: false })`.
 * `ssr: false` solo funciona dentro de Client Components (por eso este
 * archivo es "use client").
 *
 * Cada wrapper aquí es un Client Component que internamente usa
 * `next/dynamic` con `ssr: false`. El padre (Server Component) solo
 * importa este wrapper como si fuera un componente normal.
 */

import dynamic from "next/dynamic";

// ResultBanner: lee useUser + useQuery de Convex. Solo tiene sentido
// en cliente, no aporta nada al SEO.
export const ResultBannerIsland = dynamic(
  () => import("./result-banner").then((m) => m.ResultBanner),
  { ssr: false, loading: () => null }
);

// WelcomeOverlay: modal que se muestra a usuarios nuevos. No afecta
// al HTML estático (no aparece en SSR ni en prerender, solo en cliente
// tras login).
export const WelcomeOverlayIsland = dynamic(
  () =>
    import("@/components/onboarding/welcome-overlay").then(
      (m) => m.WelcomeOverlay
    ),
  { ssr: false, loading: () => null }
);

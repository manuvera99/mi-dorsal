# Estructura de la home (5 secciones, v3.0 minimalista)

> Documento on-demand. Se carga cuando se toca la home o `app/page.tsx`.

5 secciones visibles en este orden, **no reordenar sin discutirlo**:

1. **Hero** (`components/home/hero.tsx`) — H1 "Tu dorsal, de principio a fin" + subtítulo + CTAs + dorsal visual estilizado. Incluye el `RegionSwitcher` flotante y el `ProBadgeIsland` (oculto si el usuario ya es Pro).
2. **DiplomaAndSharePreview** (`components/home/diploma-preview.tsx`) — **Sección estrella**. Mockups lado a lado del diploma PDF A4 y la imagen PNG 1200×630 para redes, con la promesa "al cruzar la meta, llegan los dos a tu buzón".
3. **FeaturedRaces** (`components/home/featured-races.tsx`, vía `FeaturedRacesLazy`) — Carrusel de carreras con geo-personalización en cliente.
4. **UseCase** (`components/home/use-case.tsx`, vía `UseCaseLazy`) — Storytelling "Behobia" con mockups de email.
5. **Testimonials** (`components/home/testimonials.tsx`, vía `TestimonialsLazy`) — 4 cards con voces de la comunidad.
6. **FinalCta** (`components/home/final-cta.tsx`, vía `FinalCtaLazy`) — CTA final con "Empieza gratis" + enlace secundario "Solo quiero curiosear carreras" (sin tabla de precios Pro, ver `docs/ROADMAP.md` §1.4).

## Eliminado en v3.0 (sep 2026)

Las siguientes secciones vivían en la home v2 y se quitaron en el recorte minimalista:

- `TrustBar` — 4 stats con números honestos (movida a la lógica del hero, no se duplica).
- `Problem` — 3 cards con dolor del corredor.
- `HowItWorks` — sección oscura con 3 pasos.
- `WhatsHere` — "Lo que ya está funcionando".
- `Features` — grid de 4 features.
- `StickerEditorTeaser` — reclamo del editor premium.
- `ProTeaser` — 3 cards Free/Pro/Pro Anual. La mención a Pro se hace ahora de forma suave dentro de `FinalCta` y en el `ProBadgeIsland` del hero.
- `CommunityRanking` — top 3 con medallas.
- `FAQ` (visible) — acordeón accesible. **El JSON-LD `FAQPage` sigue inyectado inline** en `app/page.tsx` para preservar los rich snippets de Google.

Los archivos `.tsx` de las secciones eliminadas se borraron en la misma sesión (ver commit).

## SEO

El Schema.org `FAQPage` está pre-serializado en `app/page.tsx` como string literal (ver §6.2 del stack). Aunque la sección visible del FAQ se eliminó, el schema se mantiene inline para preservar los rich snippets en Google. Si se actualizan las preguntas, regenerar el string.

## Reglas técnicas

- **`app/page.tsx` usa `export const revalidate = 300`** (ISR de 5 min). NO lleva `force-dynamic` — eso es para `/carreras`. Las queries a Convex (`FeaturedRaces`) se hacen en cliente tras hidratación.
- Las 3 secciones below-the-fold (`UseCase`, `Testimonials`, `FinalCta`) se cargan con `ssr: false` vía `components/home/lazy-sections.tsx` para reducir el HTML inicial.
- Los componentes que dependen de `useUser`/`useQuery` van envueltos en `dynamic({ ssr: false })` vía `components/home/client-only-islands.tsx` (`ProBadgeIsland`, `ResultBannerIsland`, `WelcomeOverlayIsland`).

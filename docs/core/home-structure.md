# Estructura de la home (11 secciones)

> Documento on-demand. Se carga cuando se toca la home o `app/page.tsx`.

11 secciones en este orden, **no reordenar sin motivo**:

1. **Hero** (`components/home/hero.tsx`) — H1 "Tu dorsal, de principio a fin" + subtítulo + CTAs + dorsal visual estilizado. Incluye el `RegionSwitcher` flotante.
2. **TrustBar** (`components/home/trust-bar.tsx`) — 4 stats con números honestos. Disclaimer visible.
3. **Problem** (`components/home/problem.tsx`) — 3 cards con dolor del corredor popular. Tono humorístico.
4. **HowItWorks** (`components/home/how-it-works.tsx`) — Sección oscura con 3 pasos y línea conectora.
4b. **DiplomaAndSharePreview** (`components/home/diploma-preview.tsx`) — **Sección estrella** añadida en sep 2026. Mockups lado a lado del diploma PDF A4 y la imagen PNG 1200×630 para redes, con la promesa "al cruzar la meta, llegan los dos a tu buzón". Posicionada tras HowItWorks para capitalizar la atención del paso 3.
5. **Features** (`components/home/features.tsx`) — 4 features en grid.
6. **FeaturedRaces** (`components/home/featured-races.tsx`) — Carrusel de carreras con geo-personalización.
7. **CommunityRanking** (`components/home/community-ranking.tsx`) — Top 3 con medallas.
8. **UseCase** (`components/home/use-case.tsx`) — Storytelling "Behobia" con mockups de email.
9. **Testimonials** (`components/home/testimonials.tsx`) — 3 cards + **disclaimer explícito de placeholders**.
10. **FAQ** (`components/home/faq.tsx`) — 8 preguntas, acordeón accesible. El JSON-LD de la home está pre-serializado en `app/page.tsx` como string literal (ver §6.2 del stack).
11. **FinalCta** (`components/home/final-cta.tsx`) — CTA final con dos opciones.

> **Secciones extra (numeradas 4c, 4d y 5b en el código pero no en este doc para no romper la cuenta)**: entre la 4b y la 5 están `StickerEditorTeaser` ("El sticker de tu resultado, a tu manera" — reclamo del editor premium `/editor-sticker`, sep 2026) y `WhatsHere` ("Lo que ya está funcionando"), y entre la 5 y la 6 está `ProTeaser` (3 cards Free/Pro/Pro Anual). El orden en `app/page.tsx` es: Hero · TrustBar · Problem · HowItWorks · DiplomaAndSharePreview · StickerEditorTeaser · WhatsHere · Features · ProTeaser · FeaturedRaces · CommunityRanking · UseCase · Testimonials · Faq · FinalCta.

## Refinamiento crítico

**`app/page.tsx` exporta `export const dynamic = "force-dynamic"`** porque la home depende de la IP del usuario (geo) y de queries a Convex. Si quitas esto, la build en Vercel falla con `a.map is not a function` durante el prerender.

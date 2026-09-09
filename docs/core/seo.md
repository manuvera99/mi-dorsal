# SEO — estado, patrones y checklist operativa

> Documento on-demand. Se carga cuando se toca Schema.org, metadata, sitemap, o cualquier feature SEO/AdSense.
> Fusiona la guía operativa original (4 sep 2026) con el resumen de patrones — ya no hay dos documentos separados.

## Schema.org implementado
- `Organization` + `WebSite` con `SearchAction` en layout (`components/json-ld.tsx`).
- `FAQPage` en home — **string literal pre-serializado** en `app/page.tsx` (ver `docs/core/anti-patterns.md` — nunca construir JSON-LD en runtime).
- `BreadcrumbList` + `ItemList` en `/carreras` (`components/carreras/carreras-seo.tsx`).
- `SportsEvent` por carrera en `app/carreras/[slug]/page.tsx`, con subEventos (modalidades), offers, location, organizer.

## Metadata por página
- `app/layout.tsx` — metadata por defecto (title template, description, keywords, OG, Twitter, canonical, robots, viewport).
- Cada `page.tsx` importante exporta su propio `metadata` (o `generateMetadata` dinámico en `/carreras/[slug]`: title único, description 155 chars, OG image dinámica con el cartel real, `noindex` si `isPublished: false`).
- Canonical declarado en páginas con filtros (`/carreras` → `/carreras`).

## Fundamentos ya hechos
- `app/sitemap.ts` dinámico desde Convex, revalidación cada hora.
- `app/robots.ts` con disallow en admin/sign-in/sign-up/calendario/perfil/APIs.
- `app/manifest.ts` (PWA).
- Logo: `app/icon.tsx`, `app/apple-icon.tsx`, `app/opengraph-image.tsx`, `app/twitter-image.tsx` (todos vía `next/og`).
- Analytics: GA4 + GTM con consentimiento denegado por defecto; `CookieBanner` en `localStorage`.
- AdSense preparado pero con guards: no carga sin `NEXT_PUBLIC_ADSENSE_CLIENT_ID`, no carga en `*.vercel.app`.
- Páginas legales `/legal/privacidad`, `/legal/cookies`, `/legal/aviso-legal`.

## Pendiente (bug conocido)
- **`races:listForSitemap` no existe en Convex** — el sitemap de carreras individuales no funciona. Bug preexistente, no arreglado.
- ItemList dinámico en `/carreras` con slugs reales (hoy es estático con `numberOfItems` estimado) — requiere mover la query Convex al Server Component.

## Cómo verificar que algo de SEO funciona
```bash
npm run dev
# Abre http://localhost:3000/robots.txt, /sitemap.xml, /manifest.webmanifest
# Inspecciona meta description, OG tags, JSON-LD en el HTML
```
- [Rich Results Test](https://search.google.com/test/rich-results) — pega una URL de carrera, debe detectar `SportsEvent` + `BreadcrumbList`.
- [Schema Markup Validator](https://validator.schema.org/)
- Search Console → Inspección de URLs → debe decir "La URL está en Google".

## Activar AdSense (cuando aplique)
1. Aplicar en adsense.google.com con el dominio propio (necesita 3+ meses online).
2. `NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-...` en Vercel.
3. Descomentar la línea correspondiente en `public/ads.txt`.
4. `<AdSlot adSlot="..." format="auto" />` de `components/analytics/GoogleAdSense.tsx`.

## Errores que no se deben cometer
- No cloaking (contenido distinto a Google que a usuarios).
- No comprar enlaces.
- No texto oculto / keyword stuffing.
- No cambiar de dominio sin redirección 301.
- No desactivar el sitemap en producción "para ahorrar bandwidth".
- No poner anuncios antes del consentimiento de cookies.

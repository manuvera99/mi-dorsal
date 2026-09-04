# Guía SEO y monetización — mi-dorsal

> Checklist de lo que está hecho y lo que falta para que **mi-dorsal** posicione en Google y esté listo para monetizar con AdSense.

---

## ✅ Lo que ya está hecho (este PR)

### Fundamentos SEO
- ✅ `app/sitemap.ts` dinámico desde Convex (todas las carreras publicadas, revalidación cada hora)
- ✅ `app/robots.ts` con `disallow` en admin, sign-in, sign-up, calendario, perfil y APIs
- ✅ `app/manifest.ts` (PWA) con iconos, theme color `#dc2626`, categorías
- ✅ `app/layout.tsx` con metadata completa: title template, description, keywords, OG, Twitter, canonical, robots, viewport
- ✅ `app/not-found.tsx` custom (404 themed con el dorsal)
- ✅ Header `X-Robots-Tag: noindex` en rutas privadas vía `middleware.ts`
- ✅ HSTS en `vercel.json` y `middleware.ts`
- ✅ `poweredByHeader: false` (no exponer X-Powered-By)

### Performance (Core Web Vitals)
- ✅ `next.config.js`: `images.unoptimized: false` (antes era `true` — esto mataba el LCP)
- ✅ `images.formats: ['image/avif', 'image/webp']` (mejor compresión)
- ✅ Preconnect a `clerk.accounts.dev` y al host de Convex
- ✅ DNS-prefetch a `googletagmanager.com` y `google-analytics.com`
- ✅ Google Analytics y Google Tag Manager cargados con `strategy="afterInteractive"`
- ✅ `compress: true`

### SEO dinámico de carreras
- ✅ `app/carreras/[slug]/page.tsx` ahora tiene `generateMetadata` dinámico:
  - Title único por carrera: "Carrera X 2026 · 10K · Alicante"
  - Description única (155 chars)
  - OG image dinámica (cartel real de la carrera si está disponible)
  - Twitter cards
  - Canonical URL
  - `noindex` si `isPublished: false`
- ✅ Convex queries `listForSitemap` y `getBySlugForSeo` (auth-free, devuelven solo campos SEO)

### Rich results (JSON-LD)
- ✅ `components/json-ld.tsx` con helpers:
  - `organizationJsonLd` — Knowledge Graph de Google
  - `websiteJsonLd` con `SearchAction` — Sitelinks Searchbox
  - `breadcrumbJsonLd` — Breadcrumbs en SERP
  - `raceEventJsonLd` — schema `SportsEvent` con subEventos (modalidades 5K/10K/21K), offers, location, organizer
- ✅ Organization + WebSite inyectados en `app/layout.tsx`
- ✅ BreadcrumbList + SportsEvent inyectados en cada `/carreras/[slug]`

### Logo profesional
- ✅ `public/logo.svg` (wordmark completo "mi-dorsal")
- ✅ `public/icon.svg` (isotipo solo)
- ✅ `public/icon-mono.svg` (monocromo, hereda color)
- ✅ `app/icon.tsx` (favicon 32x32 dinámico vía `next/og`)
- ✅ `app/apple-icon.tsx` (apple-touch-icon 180x180)
- ✅ `app/opengraph-image.tsx` (1200x630 con logo + tagline)
- ✅ `app/twitter-image.tsx` (1200x600)
- ✅ `public/manifest.webmanifest` apunta a estos

### Analytics & verificación
- ✅ `components/analytics/GoogleAnalytics.tsx` (GA4, con consentimiento por defecto denegado)
- ✅ `components/analytics/GoogleTagManager.tsx` (GTM)
- ✅ Hook para `NEXT_PUBLIC_GSC_VERIFICATION` en metadata
- ✅ `app/components/CookieBanner.tsx` (RGPD, rechaza/acepta, persiste en `localStorage`)

### AdSense (preparado pero NO activo)
- ✅ `components/analytics/GoogleAdSense.tsx` con guards:
  - No carga si `NEXT_PUBLIC_ADSENSE_CLIENT_ID` no está configurado
  - No carga si la URL es `*.vercel.app` (AdSense rechaza subdominios)
- ✅ `public/ads.txt` con placeholder para cuando lo actives

### Páginas legales (RGPD + AdSense)
- ✅ `/legal/privacidad` — completa,RGPD-compliant
- ✅ `/legal/cookies` — qué cookies usamos, cómo gestionarlas
- ✅ `/legal/aviso-legal` — LSSI-CE compliant
- ✅ Todas indexables y enlazadas desde el footer (próximo PR)

---

## 🛠️ Lo que tienes que hacer tú (post-deploy)

### 1. Configurar Google Search Console

1. Ve a [search.google.com/search-console](https://search.google.com/search-console)
2. Añade la propiedad `https://mi-dorsal.vercel.app` (o tu dominio cuando lo tengas)
3. Verificación por **URL prefix** (la más rápida):
   - Elige el método **HTML tag**
   - Copia el `content="..."` de la meta tag que te da Google
   - Pégalo en la variable de entorno `NEXT_PUBLIC_GSC_VERIFICATION` en Vercel
4. Una vez verificado, envía el sitemap:
   - Menú lateral → **Sitemaps** → Añadir `https://mi-dorsal.vercel.app/sitemap.xml`
5. Pide indexación de las páginas clave:
   - **Inspección de URLs** → escribe la home → "Solicitar indexación"
   - Repite con `/carreras` y 2-3 páginas de carrera concretas

### 2. Configurar Google Analytics 4

1. Ve a [analytics.google.com](https://analytics.google.com)
2. Crea una cuenta (si no la tienes) y una propiedad para "mi-dorsal"
3. Tipo: **Web**
4. Nombre: "mi-dorsal"
5. Zona horaria: España, moneda: EUR
6. Crea un **flujo de datos web**
7. Copia el **ID de medición** (formato `G-XXXXXXXXXX`)
8. En Vercel, añade la variable de entorno `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX`
9. Redeploy

### 3. (Opcional pero recomendado) Google Tag Manager

Si quieres gestionar múltiples scripts (AdSense, conversiones, remarketing) desde una consola:
1. Crea un contenedor en [tagmanager.google.com](https://tagmanager.google.com)
2. Copia el GTM ID (formato `GTM-XXXXXXX`)
3. Variable: `NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX`

> Si usas GTM, puedes saltarte GA4 directo y meterlo como una etiqueta en GTM. Es más flexible a largo plazo.

### 4. Cuando tengas dominio propio (`.es`)

1. Compra el dominio (Namecheap, Cloudflare Registrar, OVH...)
2. En Vercel → Settings → Domains → Add `mi-dorsal.es`
3. Configura los DNS que Vercel te indica (CNAME + A o ALIAS)
4. Una vez propagado, actualiza la variable `NEXT_PUBLIC_APP_URL=https://mi-dorsal.es`
5. Redeploy → todos los canonical, OG, sitemap, JSON-LD se regeneran con el nuevo dominio
6. Ve a Search Console y vuelve a verificar (ahora sí funcionará AdSense)

### 5. Activar Google AdSense (cuando tengas dominio)

1. Ve a [google.com/adsense](https://www.google.com/adsense)
2. Aplica con `https://mi-dorsal.es`
3. Google revisará la web (suele tardar 1-4 semanas). Necesitas:
   - Contenido original suficiente (tienes 300+ carreras, OK)
   - Páginas legales publicadas (las tienes, OK)
   - Banner de cookies (lo tienes, OK)
   - Al menos 3 meses online (este es el principal requisito temporal)
4. Una vez aprobado, copia tu `ca-pub-XXXXXXXXXXXXXXXX` (16 dígitos)
5. Variable de entorno: `NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXX`
6. Edita `public/ads.txt` y descomenta la línea con tu ID
7. Redeploy
8. En AdSense → Anuncios → Por unidad de anuncio → crea los slots
9. Para colocar un anuncio en una página:
   ```tsx
   import { AdSlot } from "@/components/analytics/GoogleAdSense";
   <AdSlot adSlot="1234567890" format="auto" />
   ```

### 6. Mejorar indexación de carreras

- **Longitud del title**: si ves que Google las está truncando, acorta `titleBase` (quita el año o la distancia)
- **Description duplicada**: si dos carreras tienen la misma description porque vienen del mismo organizador, enriquece desde el admin el campo `description` por carrera
- **Canonical**: nunca debe haber dos URLs con el mismo contenido. Si tienes `/carreras/foo` y `/carreras/foo/`, el segundo debe tener `<link rel="canonical" href="/carreras/foo">`

---

## 🧪 Cómo verificar que todo funciona

### 1. Test local

```bash
npm run dev
# Abre http://localhost:3000/robots.txt
# Abre http://localhost:3000/sitemap.xml
# Abre http://localhost:3000/manifest.webmanifest
# Inspecciona el HTML: meta description, OG tags, JSON-LD
```

### 2. Validadores de Google

- [Rich Results Test](https://search.google.com/test/rich-results) → pega una URL de carrera → debe detectar `SportsEvent` y `BreadcrumbList`
- [Schema Markup Validator](https://validator.schema.org/) → mismo check
- [Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)
- [PageSpeed Insights](https://pagespeed.web.dev/) → objetivo: >90 en todas las métricas

### 3. Indexación

- En Search Console → **Inspección de URLs** → escribe `/carreras/<slug>` → debe decir "La URL está en Google"
- `site:mi-dorsal.vercel.app` en Google → debe listar las páginas indexadas
- `cache:mi-dorsal.vercel.app` en Google → debe mostrar la versión cacheada

---

## 📊 KPIs a monitorizar (primeras 4 semanas)

| Métrica | Dónde | Objetivo semana 1 | Objetivo semana 4 |
|---|---|---|---|
| Páginas indexadas | Search Console | >10 | >100 |
| CTR orgánico | Search Console | — | >3% |
| Impresiones | Search Console | >100 | >5.000 |
| Errores de rastreo | Search Console | <10 | <3 |
| Core Web Vitals | CrUX (PSI) | >75 | >90 |
| Eventos en GA4 | Analytics | flujos | embudos |

---

## 🚨 Errores comunes que NO debes cometer

- ❌ **No hagas cloaking**: mostrar contenido distinto a Google que a usuarios. Penalización segura.
- ❌ **No compres enlaces**: AdSense puede banearte la cuenta.
- ❌ **No uses texto oculto o keyword stuffing** en descriptions.
- ❌ **No cambies de dominio sin redirección 301** de todas las URLs.
- ❌ **No desactives el sitemap en producción** "para ahorrar ancho de banda" — Google no te descubrirá.
- ❌ **No pongas anuncios antes de tener el consentimiento de cookies** en la primera visita.

---

## 📚 Referencias

- [Google Search Central](https://developers.google.com/search) — guía oficial SEO
- [Schema.org SportsEvent](https://schema.org/SportsEvent)
- [Next.js Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Google AdSense Program Policies](https://support.google.com/adsense/answer/48182)
- [RGPD — AEPD](https://www.aepd.es/es/reglamentacion-basica)

---

*Última revisión: 4 de septiembre de 2026*

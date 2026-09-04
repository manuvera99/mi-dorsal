# AGENTS.md — Guía de proyecto para mi-dorsal

> Documento de contexto principal. **Cualquier agente o persona que abra este repo debe leer esto primero.** Contiene decisiones de producto, branding, arquitectura y patrones ya establecidos que NO se deben contradecir sin discutirlo.

---

## 1. Resumen del proyecto

**mi-dorsal** es una web app para corredores populares de España: catálogo curado de carreras, predicción de tiempos (Daniels VDOT), tracking automático de dorsales y envío de resultados oficiales por email con diploma PDF. Diferenciador vs Strava/Correbirras/Runedia: **no compite en datos de entrenamiento, compite en el ritual del dorsal y el resultado oficial**.

- **Naming**: `mi-dorsal` (con guion). Variante sin guion `midorsal` no adoptada todavía.
- **Tagline maestro**: "El hilo que te une a tu dorsal."
- **H1 de marketing**: "Tu dorsal, de principio a fin."
- **Audiencia**: corredor popular español (5K–maratón, 3–10 carreras/año), 28-45 años, vive el ritual (línea de salida, dorsal, cinta de meta) más que el dato de entrenamiento.
- **Cobertura geográfica**: toda España. Antes era solo Levante, **se expandió en septiembre 2026**. NO escribir copy que limite a Levante/Valencia/Alicante/Murcia/Castellón.
- **Estado**: MVP funcional. Auth con Clerk, DB con Convex, deploy en Vercel (`mi-dorsal.vercel.app`).

---

## 2. Identidad de marca

### 2.1 Tono de voz

- **Cercano, con humor sutil de corredor**, sin pasarse.
- **Tuteo siempre** ("apúntate", "cruza", "el día D te llega"). Nunca "usted".
- **Frase corta > frase larga**. Sin jerga técnica innecesaria.
- **Datos como celebración**, no como reporte. ("¡Nuevo PR en 5K!" > "5K PR: 22:34").
- **Evitar**: postureo, emojis decorativos sin significado, lenguaje B2B o técnico.
- **Admitir tamaños pequeños con honestidad**: si hay pocos usuarios/dorsales, decirlo. La honestidad convierte mejor que los números inflados.

### 2.2 Palabras preferidas vs evitadas

| Preferimos | Evitamos | Por qué |
|---|---|---|
| Dorsal | Inscripción, registro, ticket | Es la palabra que usa el corredor popular. |
| Tu tiempo oficial | Tu pace, tu ritmo | Diferenciador: nosotros damos el oficial, no el GPS. |
| Tu temporada | Tu plan de entrenamiento | No somos coach. |
| Resultado | Performance, métricas | Hablar como el corredor, no como Strava. |
| Carrera | Evento, competición | Lo que dice tu cuñado. |
| Línea de salida / cinta de meta | Start / finish line | Español, siempre. |
| Avituallamiento | Hidratación,補給 | La palabra que une a los populares. |
| PR (Personal Record) | Récord personal, best time | Anglicismo ya adoptado. |
| Club | Grupo, comunidad | Más running, menos Facebook. |

### 2.3 Tagline maestro

- **Corto**: "El hilo que te une a tu dorsal."
- **H1 de marketing**: "Tu dorsal, de principio a fin."
- **Subtítulo de hero**: "Apúntate a las carreras que te motivan, predice tu tiempo y recibe el resultado oficial con diploma PDF directamente en tu buzón."
- **Diferenciador explícito**: "Sin pulseras, sin GPS, sin conectar tu smartwatch. Solo tú, tu dorsal y la línea de meta."

### 2.4 Paleta de color (Tailwind config `app/globals.css`)

| Token | Hex | Uso |
|---|---|---|
| `--runner-primary` | `220 38 38` (#dc2626) | Primario. Rojo asfalto popular. |
| `--runner-accent` | `22 163 74` (#16a34a) | Secundario. Verde. |
| `--runner-warm` | `250 250 249` (#fafaf9) | Fondo principal. Crema, no blanco puro. |
| `--runner-dark` | `10 10 10` (#0a0a0a) | Texto principal. Negro suave. |

> **No se ha migrado aún a la paleta extendida propuesta en el plan de branding** (Verano en el Levante: `--dorsal-red: #E63946`, `--asfalto-700: #1D3557`, `--hierba-500: #2A9D8F`, `--naranja-salida: #F4A261`). El rojo `#dc2626` actual funciona pero es el mismo rojo "navidad" que Strava. **Migración pendiente — no aplicar sin rediseño completo de paleta.**

### 2.5 Tipografía

- **Sans / UI**: `Inter` (ya en `globals.css` y `tailwind.config.ts`).
- **Mono / números de dorsal y tiempos**: `JetBrains Mono` (ya en `tailwind.config.ts`).
- **Display / logo**: aún sin definir. `Sora` o `Bricolage Grotesque` como candidatas, **no adoptadas todavía**.

### 2.6 Logo e isotipo

- Versión actual: `public/icon.svg`, `public/icon-mono.svg`, `public/logo.svg`. Estilo: isotipo con forma de dorsal estilizado + "hilo" curvo.
- **NO redibujar el logo** sin discutirlo. Si necesitas variantes, partir del SVG actual.

---

## 3. Estructura de la home (referencia consolidada)

11 secciones en este orden, **no reordenar sin motivo**:

1. **Hero** (`components/home/hero.tsx`) — H1 "Tu dorsal, de principio a fin" + subtítulo + CTAs + dorsal visual estilizado. Incluye el `RegionSwitcher` flotante.
2. **TrustBar** (`components/home/trust-bar.tsx`) — 4 stats con números honestos. Disclaimer visible.
3. **Problem** (`components/home/problem.tsx`) — 3 cards con dolor del corredor popular. Tono humorístico.
4. **HowItWorks** (`components/home/how-it-works.tsx`) — Sección oscura con 3 pasos y línea conectora.
5. **Features** (`components/home/features.tsx`) — 4 features en grid.
6. **FeaturedRaces** (`components/home/featured-races.tsx`) — Carrusel de carreras con geo-personalización.
7. **CommunityRanking** (`components/home/community-ranking.tsx`) — Top 3 con medallas.
8. **UseCase** (`components/home/use-case.tsx`) — Storytelling "Behobia" con mockups de email.
9. **Testimonials** (`components/home/testimonials.tsx`) — 3 cards + **disclaimer explícito de placeholders**.
10. **FAQ** (`components/home/faq.tsx`) — 8 preguntas, acordeón accesible. El JSON-LD de la home está pre-serializado en `app/page.tsx` como string literal (ver §6.2).
11. **FinalCta** (`components/home/final-cta.tsx`) — CTA final con dos opciones.

### 3.1 Refinamiento crítico de la home

**`app/page.tsx` exporta `export const dynamic = "force-dynamic"`** porque la home depende de la IP del usuario (geo) y de queries a Convex. Si quitas esto, la build en Vercel falla con `a.map is not a function` durante el prerender.

---

## 4. Sistema de geolocalización (CCAA)

### 4.1 Stack

- **`lib/geo/region.ts`** — Single source of truth. Define `AUTONOMOUS_COMMUNITIES`, `getCommunityByProvince()`, `getCommunityById()`, `detectCommunityFromString()`. 19 CCAA + Ceuta + Melilla.
- **`app/api/geo/region/route.ts`** — Edge endpoint. Lee `x-vercel-ip-country-region` y `x-vercel-ip-city` de Vercel. Cache 24h con `Cache-Control`. Soporta `?ccaa=valencia` para override.
- **`components/use-user-region.ts`** — Hook con `localStorage` (`midorsal:ccaa`). 1) Lee override manual, 2) Llama al endpoint, 3) Expone `setCommunity` y `clearOverride`.
- **`components/region-switcher.tsx`** — Pill en el hero + dropdown con **portal a `document.body`** (esencial: el hero tiene `overflow-hidden` para las luces decorativas, sin portal el dropdown se recorta).
- **`/api/geo/ip` está DEPRECATED** — devuelve 410 Gone. Devolver IP del servidor Vercel en lugar de la del cliente. **No usar.**

### 4.2 Limitación conocida

Vercel en plan hobby/free inyecta `x-vercel-ip-city` y `x-vercel-ip-country` pero **no siempre** `x-vercel-ip-country-region`. En producción típica, el endpoint devuelve `source: "default"` y la home muestra "Las que más molan este mes" en lugar de "Cerca de ti". El usuario puede arreglarlo con el selector manual.

---

## 5. Página `/carreras` (referencia consolidada)

Estructura actual, **no reordenar sin motivo**:

1. **CarrerasHero** (`components/carreras/carreras-hero.tsx`) — H1 dinámico ("Carreras populares en [CCAA]" o "toda España"), buscador grande, trust signals.
2. **RaceDistanceFilter** (existente) — GPS + slider. Estado concedido renderiza como **pill minimalista** con check + "Ubicación activa · GPS", sin coordenadas decimales.
3. **QuickFilterChips** (`components/carreras/quick-filter-chips.tsx`) — Pills horizontales de distancia y mes con 1 click. Scroll horizontal en móvil, meses pasados dim.
4. **AdvancedFilters** (`components/carreras/advanced-filters.tsx`) — Acordeón cerrado por defecto. Provincia, tipo, organizadora, distancia múltiple.
5. **Header de resultados** — Contador + sort (fecha/nombre/votos) + toggle lista/mapa.
6. **Carruseles por afinidad** (solo si `activeFilterCount === 0`):
   - Cerca de ti (CCAA detectada) — `RaceCarousel` con icono `MapPin` y accent `primary`.
   - Próximamente (cronológico) — icono `Calendar`.
   - Las más votadas — icono `Sparkles`, accent `amber`.
7. **Modo mapa** (alternativo a grid) — `RaceMapWrapper` con aviso de carreras sin coordenadas.
8. **Grid completo** — Resto de carreras, ordenadas por `sortBy`.
9. **Empty state emocional** — Copy contextual según filtros/distancia/resultados.

### 5.1 `app/carreras/page.tsx` y `client.tsx`

- `page.tsx` es **Server Component** con metadata SEO y `force-dynamic`.
- `client.tsx` (`app/carreras/client.tsx`) es **Client Component** que recibe la query de Convex. **Toda la lógica interactiva va aquí.**
- Schema.org `BreadcrumbList` + `ItemList` en `components/carreras/carreras-seo.tsx`. El ItemList es estático con `numberOfItems: 1200` (estimado). **Para hacerlo dinámico real**, mover la query Convex al Server Component.

---

## 6. Decisiones técnicas que NO se deben romper

### 6.1 `force-dynamic` en páginas con query/SSR

Páginas con `useQuery` de Convex, `useUserRegion`, o `force-dynamic` por IP necesitan **`export const dynamic = "force-dynamic"`** en el `page.tsx` (Server Component) o en el Client Component raíz. Sin esto, el build en Vercel peta con `a.map is not a function` durante el prerender.

Páginas afectadas: `app/page.tsx`, `app/carreras/page.tsx`.

### 6.2 JSON-LD pre-serializado

**Patrón**: en `app/page.tsx`, el JSON-LD de la FAQPage se inyecta como **string literal pre-serializado** en build time, NO construido en runtime. Esto evita el error `a.map is not a function` en SSR.

```tsx
// ✅ CORRECTO (lo que hay en app/page.tsx)
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_PAGE_JSONLD }} />

// ❌ EVITAR (lo que estaba antes y petaba)
<JsonLd data={faqJsonLd(FAQ_ITEMS)} />  // falla en SSR
```

**Si modificas el FAQ**, regenera el string en `app/page.tsx` manualmente.

### 6.3 Portal en dropdowns/popovers

**Cualquier dropdown o popover que viva dentro de un contenedor con `overflow-hidden` debe usar `createPortal(..., document.body)`** y posicionamiento dinámico con `getBoundingClientRect()` + listeners de scroll/resize. El hero de la home tiene `overflow-hidden` y rompió el `RegionSwitcher` antes de este fix.

### 6.4 Stack técnico

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind 3.4.
- **Backend**: Convex (DB + cron + storage + reactive queries).
- **Auth**: Clerk (magic link). NO migrar.
- **Email**: Resend.
- **PDF**: `@react-email/renderer` + `@react-pdf/renderer`.
- **Hosting**: Vercel (región `fra1`).
- **Mock mode**: `NEXT_PUBLIC_USE_MOCK=true` para dev sin credenciales.

### 6.5 Geolocalización

- **No usar el endpoint `/api/geo/ip`** (deprecated, 410).
- **Usar `/api/geo/region`** con headers `x-vercel-ip-*` de Vercel.
- **Para CCAA/provincias**, consultar `lib/geo/region.ts` siempre. Es la single source of truth.

---

## 7. SEO: estado y patrones

### 7.1 Schema.org implementado

- `Organization` + `WebSite` con `SearchAction` en layout (`components/json-ld.tsx`).
- `FAQPage` en home (string literal en `app/page.tsx`).
- `BreadcrumbList` + `ItemList` en `/carreras` (`components/carreras/carreras-seo.tsx`).
- `SportsEvent` por carrera en `app/carreras/[slug]/page.tsx` (ya estaba).

### 7.2 Metadata por página

- `app/layout.tsx` — metadata por defecto.
- Cada `page.tsx` importante exporta su propio `metadata` con title, description, keywords, openGraph.
- **Canonical** declarado en páginas con filtros (`/carreras` → `/carreras`).

### 7.3 Pendiente

- ItemList dinámico en `/carreras` con slugs reales (requiere query en Server Component).
- Sitemap de carreras con la función `races:listForSitemap` (NO existe en Convex, **bug preexistente** que no he arreglado).

---

## 8. Convenciones de código

- **Naming**: español para copy y dominio (`carreras`, `perfil`, `dorsal`). Inglés para tech (`useQuery`, `force-dynamic`, `components/carreras/`).
- **Componentes**: PascalCase, un archivo por componente, en `components/<sección>/`.
- **Hooks**: prefijo `use-`, kebab-case (`use-user-region.ts`).
- **Estilos**: Tailwind utility-first. **Evitar CSS modules.** Para utilities custom (ej. `scrollbar-hide`), añadir en `app/globals.css` con `@layer utilities`.
- **Tipos**: `any` se tolera en boundaries con Convex (`api.races.getFeatured as any`) y en componentes de RaceCard (datos mock). En el resto, tipar.
- **Imports**: usar alias `@/components`, `@/lib`, `@/convex`.

### 8.1 Estructura de carpetas (resumen)

```
mi-dorsal/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Home (Server Component con force-dynamic)
│   ├── carreras/                 # Catálogo + ficha
│   ├── ranking/                  # Top 10
│   ├── calendario/               # Calendario personal
│   ├── perfil/                   # Perfil + PRs
│   ├── api/geo/region/           # Endpoint de CCAA por IP
│   ├── components/json-ld.tsx    # Shim deprecado
│   ├── layout.tsx                # Metadata global
│   └── globals.css
├── components/
│   ├── home/                     # 10 componentes de la home
│   ├── carreras/                 # 5 componentes del catálogo
│   ├── region-switcher.tsx       # Pill de CCAA con portal
│   ├── use-user-region.ts        # Hook con localStorage
│   ├── race-card.tsx
│   ├── race-filters.tsx
│   └── ...
├── convex/                       # Backend completo
├── lib/
│   ├── geo/region.ts             # SSOT de CCAA/provincias
│   ├── geo/distance.ts
│   ├── prediction/               # Daniels VDOT + Riegel
│   ├── mock/                     # Datos mock para dev
│   └── utils.ts                  # cn(), formatDate, DISTANCE_CATEGORY_LIST
├── public/                       # icon.svg, logo.svg, etc.
└── scripts/                      # Scrapers (RFEA, FEDME, ITRA, etc.)
```

---

## 9. Deploy y CI

- **Branch de producción**: `master`.
- **Comando**: `vercel deploy --prod --yes` desde local.
- **Variables de entorno críticas** en Vercel: `NEXT_PUBLIC_CONVEX_URL`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_JWT_ISSUER_DOMAIN`, `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`.
- **Crons en Vercel**: configurados en `vercel.json` (actualmente vacío `[]`).
- **Crons en Convex**: `convex/crons.ts` define 4 jobs (`checkResults`, `reminderPreRace`, `weeklyDigest`, `yearReview`).
- **GitHub Actions**: `.github/workflows/daily-ingest.yml` corre scrapers a diario.

### 9.1 Advertencia sobre `git add -A`

**NO usar `git add -A`** indiscriminadamente. Varios archivos del working tree (`docs/MONETIZATION_PLAN.md`, `docs/DORSALSWAP_MVP.md`, `docs/INTERCAMBIO_DORSALES.md`, `docs/ANALISIS_BACKEND_DORSALES.md`, `convex/crons/resultNotFound.ts`, `components/dorsal-swap-widget.tsx`) son generados por el IDE del usuario o por otros procesos en background, no por la sesión de agente. **Antes de commit, hacer `git status` y revisar.**

---

## 10. Lo que NO hacer (anti-patrones)

1. **No reordenar las 11 secciones de la home** sin discutirlo.
2. **No quitar `force-dynamic`** de las páginas con queries.
3. **No introducir JSON-LD construido en runtime** — siempre pre-serializar o usar `dangerouslySetInnerHTML` con string.
4. **No hacer dropdowns sin portal** si pueden acabar dentro de un `overflow-hidden`.
5. **No usar `/api/geo/ip`** — usar `/api/geo/region`.
6. **No escribir copy que limite a Levante** — la app cubre toda España.
7. **No usar testimonios como si fueran reales** sin verificar — la home tiene disclaimer explícito.
8. **No usar `git add -A` sin revisar `git status` antes**.
9. **No desplegar sin verificar 200 OK y 0 errores 500** en los logs de Vercel.
10. **No prometer "toda España" sin geo** — si la IP no se detecta, mostrar fallback honesto, no fingir personalización.

---

## 11. Próximas iteraciones pendientes

- [ ] Migrar la paleta de color al rebranding "Verano en el Levante" (E63946 / 1D3557 / 2A9D8F / F4A261).
- [ ] Adoptar `Bricolage Grotesque` o `Sora` como display font.
- [ ] ItemList dinámico en `/carreras` con slugs reales (requiere query en Server Component).
- [ ] Arreglar `races:listForSitemap` en Convex para que el sitemap funcione.
- [ ] Testimonios reales (sustituir el array `TESTIMONIALS` en `components/home/testimonials.tsx`).
- [ ] Cuando Vercel inyecte `x-vercel-ip-country-region` consistentemente, simplificar el endpoint `/api/geo/region` para no caer en default.
- [ ] PWA: prompt de instalación en Android/iOS tras 2 visitas.
- [ ] App nativa iOS/Android (roadmap 2026-2027).

---

## 12. Glosario del dominio

- **Dorsal**: número que te dan al apuntarte a una carrera. En mi-dorsal es la identidad del corredor popular.
- **Tiempo oficial**: el publicado por la organización de la carrera, NO el del GPS. Es lo que cuenta para el ranking.
- **PR (Personal Record)**: tu mejor marca personal en una distancia. Anglicismo ya adoptado.
- **Avituallamiento**: puntos de agua/comida en el recorrido. Palabra sagrada para los populares.
- **8D (votación 8D)**: sistema de 8 sliders de 0-10 inspirado en Correbirras. organization, avituallamiento, bolsa del corredor, ambiente, etc.
- **Hilo (en "El hilo que te une a tu dorsal")**: narrativa de continuidad entre carreras, temporadas y años. El "hilo" es el que conecta todos tus dorsales.
- **VDOT**: método de Daniels para predecir tiempos a partir de tu marca en otra distancia.
- **Popular**: corredor no profesional, no élite. El segmento objetivo de mi-dorsal. NO usar "amateur" (suena despectivo).

---

**Última actualización**: 4 de septiembre de 2026. Refleja el estado del proyecto tras la sesión de rediseño de home + /carreras + filtro de ubicación.

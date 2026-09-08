# AGENTS.md — Guía de proyecto para mi-dorsal

> Documento de contexto principal. **Cualquier agente o persona que abra este repo debe leer esto primero.** Contiene decisiones de producto, branding, arquitectura y patrones ya establecidos que NO se deben contradecir sin discutirlo.

---

## 1. Resumen del proyecto

**mi-dorsal** es una web app para corredores populares de España: catálogo curado de carreras, predicción de tiempos (Daniels VDOT), tracking automático de dorsales y envío de resultados oficiales por email con diploma PDF. Diferenciador vs Strava/Correbirras/Runedia: **no compite en datos de entrenamiento, compite en el ritual del dorsal y el resultado oficial**.

- **Naming**: `mi-dorsal` (con guion). Variante sin guion `midorsal` no adoptada todavía. Ver §13.1 (conflictos de marca analizados) y §13.2 (decisión final sobre el naming).
- **Tagline maestro**: "El hilo que te une a tu dorsal."
- **H1 de marketing**: "Tu dorsal, de principio a fin."
- **Audiencia**: corredor popular español (5K–maratón, 3–10 carreras/año), 28-45 años, vive el ritual (línea de salida, dorsal, cinta de meta) más que el dato de entrenamiento.
- **Cobertura geográfica**: toda España. Antes era solo Levante, **se expandió en septiembre 2026**. NO escribir copy que limite a Levante/Valencia/Alicante/Murcia/Castellón.
- **Estado**: MVP funcional. Auth con Clerk, DB con Convex, deploy en Vercel. **Dominio propio en producción desde 4 sep 2026** — ver §13.3.

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

### 6.6 Menú móvil con hamburguesa (header)

`components/header.tsx` tiene la nav de escritorio con `hidden md:flex`, PERO debajo de 768 px se sustituye por una hamburguesa (`md:hidden`, 44×44 px) que abre un panel desplegable dentro del `<header>` sticky. La fuente de verdad para los items es `NAV_ITEMS` (mismo array para desktop y mobile, fuente única para evitar drift).

Comportamiento del panel:
- Cierra con `Escape`, click en enlace o cambio de ruta (`useEffect` sobre `usePathname`).
- Body scroll lock mientras está abierto.
- Highlight de ruta activa con `aria-current="page"`.
- A11y: `aria-label` dinámico ("Abrir menú"/"Cerrar menú"), `aria-expanded`, `aria-controls="mobile-menu-panel"`, `aria-hidden` en el panel.

**NO eliminar la hamburguesa, el panel ni el estado `mobileMenuOpen`** pensando que es código duplicado de la nav de escritorio. Es intencional: la nav desktop es `hidden` en móvil y el panel solo existe en móvil. Quitarlo deja a los usuarios sin acceso a Carreras, Perfil, Calendario o Ranking en <768 px (regression ya resuelta el 5 sep 2026, commit `fe18841`).

**Si añades un nuevo item a la nav** (ej. DorsalSwap cuando se reactive), añadirlo a `NAV_ITEMS` y, si quieres también desktop, al `<nav>` visible. NO duplicar la lista.

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

### 9.2 Procedimiento pre-deploy obligatorio (local antes que PRO)

**NUNCA pushear a `master` sin haber validado el build en local primero.** Vercel detecta typechecks e inferencias de tipos que `tsc --noEmit` local puede pasar por alto (caché incremental, profundidad de inferencia, etc.). Confiar en que "local pasa" sin un build completo es un anti-patrón que ha costado varios deploys rotos y挽回 de emergencia.

**Checklist pre-deploy (ejecutar en este orden):**

1. **Typecheck explícito**: `npx tsc --noEmit` → 0 errores. Si hay errores, NO continuar.
2. **Build completo local**: `npm run build` → debe terminar con `✓ Compiled successfully`. Si falla, NO pushear, arreglar primero.
3. **Verificar que las rutas afectadas existen en el output del build**: revisar la tabla de rutas en la consola de `next build`. Si una ruta que tocas NO aparece, hay un problema (ruta mal nombrada, dynamic route sin `force-dynamic`, etc.).
4. **Solo entonces** commit selectivo (`git add <archivos específicos>`, NUNCA `git add -A`) + `git push origin master`.
5. Tras el push, monitorizar el deploy: `vercel ls mi-dorsal --yes`. Si sale `● Error`, leer logs con `vercel inspect <deployment> --logs`, NO acumular commits de parche a ciegas.

**Si Vercel falla pero local pasa**: casi siempre es uno de estos tres:
- **Caché corrupto de Vercel**: forzar redeploy con `vercel deploy --prod --force --yes` (verificar que `Skipping build cache, deployment was triggered without cache` aparece en el log).
- **Asume un archivo que no commiteaste**: `git status` para ver qué falta, commitear y pushear.
- **Inferencia de Convex 1.18 más estricta que local**: `ctx: any` en handlers de `internalAction`/`internalQuery` o cast a string para `runMutation(internal.X.Y as any)`. Ver entrada en memoria de agente.

**Aplicar a cualquier deploy de cualquier proyecto del workspace**, no solo mi-dorsal.

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
11. **No eliminar la hamburguesa / panel mobile del header** (`components/header.tsx`) — la nav desktop es `hidden` en móvil y solo el panel cubre <768 px. Sin él, Carreras, Perfil, Calendario y Ranking quedan inaccesibles (ver §6.6).
12. **No pushear a `master` sin haber ejecutado `npm run build` local primero**. `tsc --noEmit` no es suficiente — Vercel detecta typechecks más estrictos (inferencias de Convex, tipos profundos, etc.) que local puede pasar por alto. Saltarse el build local ha costado 5+ deploys rotos seguidos en esta sesión. Ver §9.2 para el procedimiento completo.

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
- [ ] **Configurar email corporativo** con Zoho Mail free (5 buzones) — ver §13.4.
- [ ] **Limpiar inconsistencias de naming** en el código (midorsal vs mi-dorsal en metadata, copy, OG) — ver §13.5.
- [ ] **Registrar marca `mi-dorsal` en OEPM** (clases 9, 41, 42) — ~150 €, 8-12 meses resolución — ver `docs/BRAND_PROTECTION_CHECKLIST.md`.
- [ ] **Logo simplificado** para favicon 16/32/180/192/512 px (gap detectado en `docs/BRAND_ANALYSIS.md` §3.2).
- [ ] **OG image custom 1200×630** con dorsal estilizado y tagline (mejora CTR en WhatsApp/Twitter/LinkedIn).
- [x] **Esqueleto de Clerk Billing listo** (8 sep 2026) — schema `subscriptions` + webhook Svix + páginas `/premium` y `/cuenta/suscripcion` + componentes `<Paywall>` y `<PremiumBadge>`. Activar cuando llegue Q3-Q4 2026 siguiendo `docs/BILLING_SETUP.md`. Ver §16.

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

## 13. Avances de marca y dominio (sesión del 4 sep 2026)

Esta sección documenta el estado de la marca al cierre de la sesión de naming + dominio. Los análisis completos están en `docs/BRAND_ANALYSIS.md` (auditoría completa) y `docs/BRAND_PROTECTION_CHECKLIST.md` (plan ejecutable).

### 13.1 — Conflictos de marca analizados (verificados con WHOIS/RDAP)

| Nombre | URL | Estado | Amenaza |
|---|---|---|---|
| **Midorsal** | `midorsal.com` (B2B Toledo) | REGISTRADO | 🔴 ALTA — competidor directo, misma raíz semántica |
| DorsalChip | `dorsalchip.es` | REGISTRADO | 🟠 Media (cronometraje, no competidor) |
| Dorsal1 | `dorsal1.es` | REGISTRADO | 🟠 Media (cronometrador regional) |
| Dorsal21 | `dorsal21.com` | REGISTRADO | 🟠 Media (cronometrador Murcia) |
| Dorsal.pro | `dorsal.pro` | REGISTRADO | 🟢 Baja (marketplace dorsales) |
| BuscoDorsal | `buscodorsal.com` | REGISTRADO | 🟢 Baja (fotos por dorsal) |
| #MiDorsal | hashtag cultural en sector | — | 🟢 A FAVOR — ya está asumido por la comunidad |

**Conclusión**: nadie usa "dorsal" como marca emocional/personal del corredor popular. Esa es nuestra ventana. La convivencia con `midorsal.com` es inevitable, pero diferenciable por audiencia (B2B organizadores vs B2C corredores).

### 13.2 — Decisión final sobre naming

**Se mantiene `mi-dorsal` (con guion). NO se rebrandea.**

Razones (resumen del análisis en `docs/BRAND_ANALYSIS.md`):
- Brandability / boca-oreja: el activo cultural del hashtag #MiDorsal es IRREPETIBLE
- SEO a 36+ meses: la convivencia con `midorsal.com` se separa por audiencia distinta
- Coste de cambiar >> coste de coexistir (200 € proteger vs 20.000 € rebrandear)
- Defensibilidad legal aceptable con OEPM clase 9/41/42 + dominio `.com` con guion

**Plan B documentado** por si en 12-18 meses toca rebrandear: Carrerómetro, Dorsalink, Dorsalio, Meta del Dorsal, El Hilo. Todos con `.com` y `.run` verificados LIBRES (WHOIS/RDAP 4 sep 2026). NO ACTIVAR sin discusión.

### 13.3 — Dominios comprados y propagación (4 sep 2026)

| Dominio | Registrador | Precio/año | Estado |
|---|---|---|---|
| **mi-dorsal.com** | Vercel | ~10 € | ✅ COMPRADO + LIVE (apunta a producción) |
| **mi-dorsal.es** | Hostinger | ~9 € | ✅ COMPRADO + DNS configurado, propagando |
| `mi-dorsal.run` | — | ~24 € | ⬜ Pendiente, defensivo (extensión del sector) |
| `mi-dorsal.app` | — | ~18 € | ⬜ Pendiente, defensivo (formato app) |

**Setup DNS en Hostinger (4 sep 2026)**:
- Registro A: `mi-dorsal.es` → `76.76.21.21` (Vercel)
- Registro CNAME: `www` → `cname.vercel-dns.com` (⚠️ conflicto con default de Hostinger, ver §13.5)
- TTL: 14400 (estándar, OK)

**Setup Vercel**: `mi-dorsal.com`, `www.mi-dorsal.com` y `mi-dorsal.vercel.app` → Valid Configuration. Redirect 308: `mi-dorsal.com` → `www.mi-dorsal.com`.

### 13.4 — Email corporativo pendiente

**Decisión**: configurar **Zoho Mail plan Free** (5 buzones gratis) vinculado a `mi-dorsal.es`. NO pagar el pack email de Hostinger (10 € extra) ni Google Workspace (72 €/año) ni Microsoft 365 (50 €/año).

**Pasos a ejecutar** (15 min):
1. https://www.zoho.com/mail/ → Sign Up → plan Free
2. Add domain: `mi-dorsal.es`
3. Zoho da TXT de verificación → añadir en Hostinger DNS:
   - Tipo: TXT, Host: `@`, Valor: el de Zoho
4. Verify dominio en Zoho (espera 5-10 min)
5. Zoho da MX records → añadir en Hostinger DNS:
   - Tipo: MX, Host: `@`, Prioridad: 10, Valor: `mx.zoho.com`
6. Crear buzón `info@mi-dorsal.es`
7. Conectar vía IMAP a Gmail/Outlook/Apple Mail

**Buzones a crear** (3-4 para empezar):
- `info@mi-dorsal.es` — contacto general, fallback
- `hola@mi-dorsal.es` — email de bienvenida, onboarding
- `noreply@mi-dorsal.es` — emails transaccionales (solo envío)
- `soporte@mi-dorsal.es` — cuando escales a tener usuarios que pidan ayuda

**Actualizar el email en código** cuando esté activo: el `app/layout.tsx` actual declara `hola@mi-dorsal.es` (JSON-LD Organization) — verificar que el buzón exista o cambiar a `info@mi-dorsal.es`.

### 13.5 — Inconsistencias de naming detectadas en el código (pendiente)

Detectado el 4 sep 2026 en `mi-dorsal-6besvjgpy-manuvera99s-projects.vercel.app` (HTML inspeccionado):

| Lugar | Versión actual | Decisión recomendada |
|---|---|---|
| `og:site_name` | "mi-dorsal" | ✅ Dejar (con guion) |
| `twitter:site` | "@midorsal" | ✅ Dejar (sin guion — los handles no admiten guion y la gente no los escribe) |
| `twitter:creator` | "@midorsal" | ✅ Dejar |
| `application-name` | "mi-dorsal" | ✅ Dejar |
| `apple-mobile-web-app-title` | "mi-dorsal" | ✅ Dejar |
| Email contacto declarado | `hola@mi-dorsal.es` | ⚠️ Pendiente: crear buzón o cambiar a `info@mi-dorsal.es` (ver §13.4) |
| Copy de la home: "Enero. Abres midorsal." | sin guion | ⚠️ Cambiar a "Enero. Abres mi-dorsal." o "Abres la app." (evita inconsistencia) |

**Regla de consistencia** (documentar en esta sección cuando se aplique):
- **URLs, dominios, emails**: `mi-dorsal` (con guion)
- **Handles de redes sociales**: `@midorsal` (sin guion)
- **Copy en pantalla**: `mi-dorsal` (con guion, como el wordmark del logo)
- **Hashtags**: `#MiDorsal` (CamelCase para legibilidad)

### 13.6 — Pendientes inmediatos (orden de prioridad)

1. 🔴 Configurar Zoho Mail (15 min, 0 €) — ver §13.4
2. 🟠 Verificar que `mi-dorsal.es` ya resuelve en navegador (espera 5-30 min desde DNS en Hostinger)
3. 🟠 Limpiar inconsistencias de naming en código (30 min) — ver §13.5
4. 🟠 Registrar marca en OEPM (1h + 8-12 meses) — seguir `docs/BRAND_PROTECTION_CHECKLIST.md`
5. 🟢 Comprar `mi-dorsal.run` defensivo (~24 €/año) cuando apetezca
6. 🟢 Asegurar `@midorsal` en IG, TikTok, X, YouTube, Threads, Bluesky (15 min, 0 €)
7. 🟢 Logo simplificado para favicons (gap técnico en `public/`)

---

## 14. Blog "Historias de dorsal" + Newsletter (sistema editorial)

Sistema editorial implementado el 5 sep 2026 para captar tráfico orgánico SEO y mantener engagement con suscriptores (registrados y externos).

### 14.1 — Decisión de naming y dirección

- **Blog**: "Historias de dorsal" (encaja con el "hilo que te une a tu dorsal"). URL: `/blog`.
- **Newsletter**: solo "Newsletter mi-dorsal". URL pública: `/newsletter`.
- **NO se compite** con Runnea, Foroatletismo, Runner's World, etc. (medios generalistas de running). Posicionamiento: contenido específico del corredor popular con datos reales de carreras españolas.
- **Frecuencia recomendada**: 1 post/semana escrito por Manu (sostenible, sin fábrica de contenido).
- **Categorías (4, no más)**: historias, guias, curiosidades, tendencias.

### 14.2 — Arquitectura

```
app/
  blog/                          # público
    page.tsx                     # Server Component, force-dynamic + metadata
    client.tsx                   # Client con useQuery(api.blog.list)
    [slug]/page.tsx              # Server con generateMetadata + Schema.org Article
    [slug]/client.tsx            # MarkdownRenderer + incrementViews + related
    categoria/[cat]/page.tsx     # SEO long-tail por categoría
  newsletter/                    # landing pública de suscripción
    page.tsx
  api/newsletter/
    subscribe/route.ts           # POST: crea pending + envía email confirmación
    confirm/route.ts             # GET: doble opt-in (token)
    unsubscribe/route.ts         # GET: baja (token)
  admin/
    blog/                        # CRUD admin
      page.tsx                   # lista con filtros
      new/page.tsx               # crear
      [id]/page.tsx              # editar
    newsletter/page.tsx          # gestión suscriptores
components/
  blog/
    PostCard.tsx
    MarkdownRenderer.tsx         # parser ligero, sin librería externa
  newsletter/
    NewsletterForm.tsx           # form público con feedback
convex/
  schema.ts                      # tablas blogPosts + newsletterSubscribers
  blog.ts                        # queries + mutations (admin / pública)
  newsletter.ts                  # subscribe/confirm/unsubscribe + admin
  crons/
    newsletterEditorial.ts       # cron día 1 mes, 10:00 UTC
  cronJobs.ts                    # registro del cron
scripts/content/
  generate-post.ts               # CLI: crea esqueleto por categoría
  publish-post.ts                # CLI: sube MD a Convex
  blog-publisher.ts              # helper compartido
  drafts/                        # borradores (en .gitignore)
  README.md                      # instrucciones
```

### 14.3 — Tablas Convex

**`blogPosts`** (slug único, content en markdown):
- `slug`, `title`, `excerpt`, `content`, `coverImageUrl`, `coverImageAlt`
- `category`: historias | guias | curiosidades | tendencias
- `tags[]`, `authorId`, `authorName`, `publishedAt`, `isPublished`, `isFeatured`
- `seoTitle`, `seoDescription`, `seoKeywords[]`, `readingTimeMinutes`
- `views`, `relatedRaceIds[]` (FK a races para internal linking)
- `newsletterSentAt` (se setea al enviar por el cron)
- Índices: by_slug, by_published_date, by_category, by_featured, search_blog

**`newsletterSubscribers`** (doble opt-in RGPD):
- `email`, `status`: pending | active | unsubscribed | bounced
- `source`: blog | landing | footer | admin | import
- `preferences`: { editorialEnabled, raceRemindersEnabled, resultsEnabled }
- `confirmToken` (one-shot), `unsubscribeToken` (estable)
- `subscribedAt`, `confirmedAt`, `unsubscribedAt`, `lastSentAt`
- `subscriptionIpHash` (SHA-256 con salt, RGPD), `subscriptionUserAgent`
- `profileId` (FK opcional a profiles si el suscriptor también es usuario)
- Índices: by_email, by_status, by_status_locale, by_status_editorial, by_profile

### 14.4 — Doble opt-in (RGPD España LSSI)

Flujo obligatorio:
1. Usuario envía email en `/newsletter` → POST `/api/newsletter/subscribe`.
2. Backend hashea la IP con SHA-256 + salt (`NEWSLETTER_IP_SALT` o default) y guarda suscriptor en `status: pending` con `confirmToken`.
3. Backend envía email de confirmación con link `/api/newsletter/confirm?token=...`.
4. Usuario hace click → backend llama `api.newsletter.confirm` → marca `status: active`, limpia `confirmToken`.
5. Suscriptor queda activo, listo para recibir emails.

**Baja**: cada email lleva link `/api/newsletter/unsubscribe?token={unsubscribeToken}` (token estable, no cambia). El `unsubscribeToken` se genera al crear el suscriptor y se mantiene aunque se re-suscriba.

**IMPORTANTE**: NUNCA guardar IP en claro. Siempre hashear. La sal `NEWSLETTER_IP_SALT` debe estar en env vars en producción (no commitear).

### 14.5 — Cron `newsletter-editorial`

- **Schedule**: día 1 de cada mes, 10:00 UTC.
- **Lógica**: coge el post más reciente (`isPublished=true`) que aún no tenga `newsletterSentAt`. Envía a todos los suscriptores activos con `editorialEnabled=true`.
- **Dry-run**: `internal.crons.newsletterEditorial.newsletterEditorial({ dryRun: true })` para probar sin enviar nada.
- **Mock mode**: si no hay `RESEND_API_KEY`, loguea en stdout y NO marca nada como enviado.
- **Email**: HTML inline (sin `@react-email/components` para esta plantilla simple). Subject: "Nueva historia de dorsal: {title}".

### 14.6 — Comandos CLI

```bash
# Crear esqueleto
pnpm content:new historias "Mi primera Behobia"
pnpm content:new guias "Cómo preparar una media maratón"
pnpm content:new curiosidades "Por qué el 10K es la distancia más democrática"
pnpm content:new tendencias "Qué buscar en unas zapatillas para trail en invierno"

# Publicar (queda como borrador)
pnpm content:publish scripts/content/drafts/2026-09-05-mi-post.md

# Publicar y publicar inmediatamente
pnpm content:publish scripts/content/drafts/2026-09-05-mi-post.md --publish
```

Más detalles en `scripts/content/README.md`.

### 14.7 — Lo que NO hacer

- **No** enviar emails sin doble opt-in (RGPD España). El sistema ya lo implementa, no saltarlo.
- **No** guardar IP en claro. Siempre hashear.
- **No** añadir más de 4 categorías (fragmenta SEO).
- **No** generar posts con LLM sin que Manu los revise y edite. La voz de marca se rompe.
- **No** programar el cron para enviar más de 1 vez/mes (cansancio + baja engagement).
- **No** usar el sistema de blog para comunicar cambios de producto. Eso va en la home o en banners.
- **No** quitar el campo `newsletterSentAt` del post. Es lo que evita re-envíos.
- **No** hacer el NewsletterForm con doble confirmación al hacer click (ya hay doble opt-in vía email).

### 14.8 — Roadmap editorial (próximos 90 días)

- [ ] Publicar 4 posts de "Historias de dorsal" (1/semana).
- [ ] Llegar a 100 suscriptores activos en la newsletter.
- [ ] Medir tráfico orgánico a `/blog/*` desde Search Console (objetivo: 200 visitas/mes desde SEO).
- [ ] Medir conversión newsletter → registro en mi-dorsal (objetivo: 10% de los suscriptores).
- [ ] A/B testing de asuntos de email (fase 2).
- [ ] Si el blog tira bien, valorar `Bricolage Grotesque` o `Sora` para el wordmark (ver §2.5).

### 13.7 — Documentos completos de esta sesión

| Documento | Contenido | Tamaño |
|---|---|---|
| `docs/BRAND_ANALYSIS.md` | Auditoría completa: naming, competidores, SEO, plan B, ident. visual, veredicto final | 42 KB |
| `docs/BRAND_PROTECTION_CHECKLIST.md` | Plan ejecutable 5-7 días: dominios, OEPM, redes, metadata | 16.7 KB |
| `docs/BRAND_ANALYSIS.md` §10 | Análisis SEO con keywords reales y ranking de nombres | (dentro del doc principal) |
| `docs/BRAND_ANALYSIS.md` Anexo A | Disponibilidad de dominios verificada con WHOIS/RDAP autoritativo | (dentro del doc principal) |

## 15. Convex: plan Starter, fix del cron y limpieza TS2589 (sesión del 5 sep 2026)

Esta sección documenta el upgrade al plan Starter de Convex (tras aviso de exceso del free plan), el fix del cron que lo motivó, y la limpieza de 31 errores de TypeScript preexistentes que bloqueaban el deploy.

### 15.1 — Plan actual: Convex Starter con cap de $10/mes

- **Desde**: 5 de septiembre de 2026, tras aviso de exceso del free plan.
- **Plan**: **Convex Starter** (pay-as-you-go con los mismos límites que el free, pero SIN tope duro). 1 developer (Manu).
- **Límite de gasto configurado**: **$10/mes** como red de seguridad.
- **Coste esperado**: **~$0-1/mes** en uso normal (después del fix del cron). ~$1.10 prorrateado en septiembre de 2026 por el exceso ya quemado.
- **Por qué NO Professional**: $25/mes fijo es 25× más caro para una app con 1 dev y poco tráfico. Solo se amortiza con 2+ devs, >50 GB/mes de I/O, o necesidad de backups diarios / support prioritario.

**Límites de Starter relevantes** (verificados en `docs.convex.dev/production/state/limits`, jul 2026):

- 1M function calls/mes incluidos (luego $2.20/M).
- 1 GB database bandwidth (I/O) / mes incluido (luego $0.22/GB).
- 0.5 GB database storage incluido (luego $0.22/GB-mes).
- 1 GB file storage incluido (luego $0.033/GB-mes).
- 1 GB egress/mes incluido (luego $0.132/GB).
- 20 GB-horas action compute incluido (luego $0.33/GB-hora).

**Dashboard**: https://dashboard.convex.dev/t/manuvera08/settings/billing

### 15.2 — Fix del cron `recalc-stats` (5 min → 30 min)

**Síntoma**: Convex envió email avisando de exceso del free plan. `npx convex deploy` mostraba "Your projects are above the Free plan limits".

**Causa raíz**: `convex/crons/recalcStats.ts:32-48` hace un `Promise.all` de **7 `.collect()` sobre tablas grandes** (`races`, `profiles`, `raceVotes`, `raceRatings`, `myRaces`, `personalRecords`, `notificationLog`). Con 431 carreras, ~700 KB leídos por ejecución. A 5 min: 8.640 ejecuciones/mes × 700 KB = **~6 GB/mes de Database bandwidth**. Límite free: 1 GB/mes.

**Fix**: cambiar `{ minutes: 5 }` por `{ minutes: 30 }` en `convex/cronJobs.ts:53`. Nuevo consumo: ~1 GB/mes (dentro del free y Starter). Commit `4183d2e`.

**Lección para futuras sesiones**:
- Cualquier cron que haga `.collect()` de tablas grandes con frecuencia alta **quema bandwidth**. Antes de añadir crons a <15 min, medir.
- Revisar `convex/stats.ts` y `convex/crons/*.ts` para `Promise.all` + `collect()`.
- Si Convex avisa de nuevo de exceso de bandwidth, este es el primer sitio a mirar.

**Aplicar cuando**: Convex avise de exceso de bandwidth en el dashboard. Revisar primero los crons con `Promise.all` + `collect()`. Si están justificados, mantener y subir plan; si no, reducir frecuencia.

### 15.3 — Limpieza de 31 errores de TypeScript preexistentes (TS2589)

**Síntoma**: `npx tsc --noEmit` fallaba con 31 errores en `convex/crons/*.ts`, `convex/devOnly/*.ts`, `convex/newsletter.ts` y `app/blog/client.tsx`. Bloqueaba `npx convex deploy` salvo con `--typecheck=disable` (workaround temporal aplicado durante el fix del cron).

**Causa raíz**: Convex 1.18 + schema complejo. La tabla `races` tiene 50+ campos opcionales, unions grandes como `province` con 53 literales, y arrays de objetos como `raceFormats`, `aidStations`, `priceTiers`, `altimetryData`. Esto desborda la inferencia de tipos y produce **`TS2589: Type instantiation is excessively deep and possibly infinite`** en `internalAction` / `internalQuery` / `internalMutation`. El blog client tenía un type-narrowing que no se propagaba bien por una `Record<string, string>` en `convex/blog.ts:CATEGORY_LABELS` que se ensanchaba a `string` en vez del union literal.

**Fix aplicada** (13 edits, commit `4183d2e`):
- **`ctx: any` en el handler** de todas las funciones `internal*` de `convex/crons/*.ts` y `convex/devOnly/*.ts` (28 funciones en 7 archivos).
- **`q: any` en `convex/newsletter.ts:adminList:269`** donde se reasignaba el query (`let q = ctx.db.query(...); if (...) { q = q.withIndex(...) }`).
- **`as const` en `CATEGORY_ORDER`** de `app/blog/client.tsx:17` (el original `Array<keyof typeof CATEGORY_LABELS>` se ampliaba a `Array<string>` porque `CATEGORY_LABELS` está tipado como `Record<string, string>` en `convex/blog.ts:24`).
- **Cast `as Record<string, number>` en `Object.values(...)`** del reduce de los counts.
- **`as any` en `internal.newsletter.listActiveEditorialSubscribers`** en `newsletterEditorial.ts:34` para romper la inferencia circular del API type.

**Por qué es OK**: AGENTS.md §8 permite `any` en boundaries con Convex. El cambio es solo de tipos — el runtime no se ve afectado (los crons ya funcionaban en producción, simplemente `tsc` no podía verificar).

**Aplicar cuando**:
- `npx convex deploy` falle con `TS2589` en un nuevo cron. Aplicar `ctx: any` en el handler.
- Si el error es en un `runQuery(internal.X.Y)`, usar `(internal.X.Y as any)`.
- Si el error es sobre `Record<string, X>` que debería ser union literal, añadir `as const` al array que se usa para derivar las keys.
- Workaround de emergencia: `npx convex deploy --typecheck=disable` (saltarse el typecheck, deploy igualmente). **Usar solo para sacar fixes urgentes**.

### 15.4 — Pendientes post-upgrade

- [ ] Revisar el dashboard de usage en 24-48h para confirmar que el bandwidth ha bajado tras el fix.
- [ ] Si en algún mes el coste sube de $5/mes, considerar Professional ($25/mes) para predictibilidad.
- [ ] Si se llega al límite de $10/mes configurado, hay un bug (bucle de cron, query descontrolada) — no es uso normal. Investigar qué crons/queries se han desbocado.
- [ ] Considerar añadir un **`tsc` check en CI** (GitHub Actions) para no acumular errores TS de nuevo.

**Leer `docs/BRAND_ANALYSIS.md` antes de tomar cualquier decisión de naming, branding, SEO o competidores**.

---

## 15. Enrichment de carreras (procedimiento canónico)

El schema soporta ~50 campos por carrera. La ficha en `/carreras/[slug]` los renderiza **condicionalmente**: si un campo está vacío, la sección ni se pinta. Albacete (ejemplo "perfecto") los tiene casi todos; el resto del catálogo está pelado por el source original (corredores populares suelen tener solo nombre, fecha, distancia, type).

### 15.1 — Las 3 capas de datos

| Capa | Cómo llega | Calidad |
|---|---|---|
| **Source** (RFEA, FEDME, ITRA, Runedia, Sportmaniacs, Correbirras) | Ingest con `systemCreate`/`systemUpsert` al ejecutar `npm run ingest:<source>` | Básica: nombre, fecha, locality, distance, type, a veces description y organizer |
| **Deep extract IA** | `scripts/deep-extract-all.ts` con `MiniMax-M3` (`OPENAI_BASE_URL=https://api.minimax.io/v1`) | Rica si la web oficial tiene info estructurada; modo "síntesis" si es landing page |
| **Manual** | Panel `/admin/races/[id]` con `adminUpdate` o botón "Extraer y aplicar" | La más precisa — humano en el loop |

### 15.2 — Procedimiento para enriquecer

1. **Ver el gap**:
   ```bash
   npx tsx --env-file=.env.local scripts/check-bulk-status.ts
   ```
   Imprime 18 métricas (longDescription, altimetryData, raceFormats, organizer, social, address, lat/lng, services, etc.) y desglose por source/confidence.

2. **Listar candidatos top** (próximas + publicadas + con officialUrl, ordenadas por destacado y fecha):
   ```bash
   npx tsx --env-file=.env.local scripts/list-top-candidates.ts
   ```
   Muestra las 30 más relevantes con lo que ya tienen y lo que les falta.

3. **Lanzar bulk deep-extract en background** (con HEAD probe para no quemar IA en URLs rotas):
   ```bash
   npx tsx --env-file=.env.local scripts/deep-extract-all.ts --priority --delay=3000
   ```
   - `--priority` procesa primero no-extraídas, luego baja-confianza, luego completas.
   - El HEAD probe marca con `extractedAt` las URLs 404/5xx para no reintentar.
   - El prompt tiene "modo síntesis": incluso en landing pages escasas, la IA escribe un `longDescription` útil.
   - ETA: ~3-5h para 2700 carreras (a 5s/carrera con delay 3s).
   - Log: `scripts/output/deep-extract-YYYY-MM-DD.log`.

4. **Geocodificar** lo que aún no tenga lat/lng (desbloquea "Cómo llegar" en la ficha):
   ```bash
   npx tsx --env-file=.env.local scripts/geocode-races.ts --only-missing
   ```
   ETA: ~40 min para 2300 carreras (1.1s/carrera, Nominatim ToS).

5. **Enriquecer a mano las top 20-30** desde `/admin/races/[id]`. El botón "Extraer y aplicar" lanza la IA contra la URL oficial y aplica el patch via `adminUpdate`. Para lo que la IA no pille, editar el form directamente.

6. **Medir el progreso** re-corriendo `check-bulk-status` y comparando.

### 15.3 — Arquitectura técnica

- **Single source of truth para el patch**: `buildExtractionPatch(data, sourceUrl)` en `lib/ai/extract-race-deep.ts`. Tanto el script bulk como el admin actions lo importan. NO duplicar la lista de campos en otros sitios — añadir a `PATCH_SCALAR_FIELDS` y a `convex/races.ts → adminUpdate`/`systemUpdate` validators.
- **Sanitización**: `sanitize(r)` en el mismo módulo normaliza la respuesta del LLM (recorta longitudes, filtra URLs, valida `TIME_RE`/`DATE_RE`, ordena arrays por km).
- **HEAD probe**: función `probeUrl()` en `deep-extract-all.ts`. Devuelve `'ok' | 'broken' | 'unknown'` y marca `extractedAt` en el caso broken para no re-intentar.
- **systemListAll ampliado** (2026-09-07): devuelve 23 campos extra (isPublished, isFeatured, scraperAdapter, startTime, address, venue, organizerUrl, contactPhone, dorsalPickupLocation, dorsalPickupHours, social*, imageUrl, description, registrationOpenDate/CloseDate, maxParticipants, timeLimitMinutes, courseType, gpxUrl, mapImageUrl, profileImageUrl, regulationUrl). Para que `check-bulk-status` reporte progreso real.

### 15.4 — Bug conocido: sportmaniacs devuelve 404

El 80% del catálogo viene de sportmaniacs. **TODAS** las URLs `sportmaniacs.com/es/races/{slug}/{uuid}/results` devuelven 404 (la plataforma reorganizó las rutas y los UUIDs ya no resuelven). El HEAD probe las salta correctamente. Solución definitiva (pendiente): backfillear `officialUrl` desde la ficha real de sportmaniacs via su API o re-scraping con el patrón nuevo. Mientras tanto, la única forma de enriquecer estas carreras es a mano desde el admin.

### 15.5 — Cron self-reminder para monitorizar

```bash
mavis cron self --cron-name "monitor-deep-extract" --every "15m" --prompt "..." --session mode=sessionId,session_id=me --quiet_on_skip true
```

El cron `monitor-deep-extract` está configurado al lanzar el deep-extract. Si el log no crece en 5 min, avisa. Cuando ve "RESUMEN" al final, lo borra y reporta.

### 15.6 — Panel de duplicados en `/admin/duplicates`

Detecta carreras candidatas a duplicado combinando 3 criterios (ordenados por confianza):

1. **exact**: mismo `scraperAdapter` + mismo nombre normalizado + misma fecha → re-ingest.
2. **structural**: misma fecha + misma `province` + misma `distanceKm` (±0.1 km) + `locality` compatible → cross-source probable (caso típico: Runedia mete un registro esquelético de la misma carrera que correbirras tiene completa).
3. **fuzzy**: misma fecha + misma `province` + Jaccard(tokens del nombre) ≥ 0.75 → nombres similares pero no idénticos.

**Implementación**:
- Convex query: `convex/races.ts → adminFindDuplicates` (3 detectores + dedupe de grupos)
- Convex mutation: `adminDeleteMany` (batch delete con `requireAdmin`)
- Página: `app/admin/duplicates/page.tsx` (Client Component)
- Scripts CLI equivalentes (para uso sin auth desde servidor):
  - `scripts/find-fuzzy-duplicates.ts` — fuzzy client-side
  - `scripts/find-dup-by-date-distance.ts` — structural client-side
  - `scripts/fix-same-source-duplicates.ts` — exact, ya existía

**UI del panel**:
- Filtros por tipo de detección (all / exact / structural / fuzzy)
- Cada grupo muestra todas las carreras del grupo con: nombre, source, fecha, localidad, distancia, organizador, URL oficial, count de campos rellenos
- "Recomendado mantener" (✓ verde) = la que tiene más campos rellenos
- Checkboxes para marcar cada carrera como "borrar"
- Botón "Marcar para borrar (sugerencia)" en cada grupo: marca automáticamente todas las que NO son la recomendada
- Botón flotante de "Borrar N carreras" con confirmación

**Importante**: el panel solo BORRA, no hace merge. Si quieres preservar datos del duplicado (ej. organizerUrl que está solo en el secundario), cópialos a mano desde el detalle del secundario antes de borrarlo, o modifica el script para soportar merge.

---

## 16. Monetización: esqueleto de Clerk Billing (sesión del 8 sep 2026)

Esta sección documenta el estado del sistema de pagos. Está **listo pero no activado** — la app funciona 100% en plan Free; cuando llegue el momento de monetizar (Q3-Q4 2026, ver `docs/MONETIZATION_PLAN.md`), solo hay que seguir `docs/BILLING_SETUP.md` para activarlo.

### 16.1 — Decisión de arquitectura

**Se usa Clerk Billing (no Stripe directo).** Razones:
- Clerk ya gestiona la auth; Billing se integra nativamente con el mismo user.
- Cero código de checkout — Clerk se ocupa del iframe, Apple/Google Pay, cambio de plan, cancelación, cumplimiento fiscal.
- Coste extra: 0,7% sobre ingresos (vs 1,5% + 0,25€ de Stripe directo). Para €1000-5000/mes objetivo: 5-35€/mes, asumibles.
- Trade-off: menos control sobre checkout custom. Si lo necesitamos, se puede migrar a Stripe directo (ver §16.8).

**Clerk Billing usa Stripe por debajo** — Manu no necesita cuenta Stripe propia para empezar. Clerk la aprovisiona en el dashboard de Clerk con un clic. Solo hay que crear los productos (Free + Premium) y copiar el webhook signing secret.

### 16.2 — Componentes del esqueleto

| Archivo | Rol |
|---|---|
| `convex/schema.ts` (tabla `subscriptions`) | Mirror local del estado de subscripción. Source of truth para queries Convex y feature gating. |
| `convex/subscriptions.ts` | Queries (`getMySubscription`, `getMyPremiumStatus`, `getSubscriptionStats`) + action pública (`handleClerkBillingEvent`) + internal mutations (`upsertFromClerkEvent`, `downgradeToFree`). |
| `app/api/webhooks/clerk-billing/route.ts` | Webhook handler con verificación Svix. Recibe `subscription.*` events de Clerk y los refleja en Convex. |
| `components/billing/use-has-premium.ts` | Hook reactivo que consulta Convex. Re-renderiza al instante cuando el webhook actualiza la fila. |
| `components/billing/paywall.tsx` | `<Paywall feature="...">` envuelve features premium. Variantes: inline / card / subtle. |
| `components/billing/premium-badge.tsx` | `<PremiumBadge />` indicador visual. |
| `components/billing/pricing-table.tsx` | Wrapper sobre `<PricingTable />` de Clerk. |
| `app/cuenta/page.tsx` + `app/cuenta/suscripcion/page.tsx` | Gestión de la suscripción para usuarios logueados. Protegida por middleware. |
| `app/premium/page.tsx` | Landing pública de venta (SEO, anónimos). |
| `docs/BILLING_SETUP.md` | Tutorial paso a paso para activar. |

### 16.3 — Modelo de datos (tabla `subscriptions`)

- `clerkUserId` (string, index) — FK lógica a `profiles.clerkUserId`.
- `clerkSubscriptionId` (string, index único por Clerk) — 1 fila por suscripción.
- `planId` ("free_user" | "premium_monthly" | "premium_yearly") — SKU concreto de Clerk.
- `tier` ("free" | "premium") — nivel LÓGICO, sobre el que se hace feature gating.
- `status` ("active" | "trialing" | "past_due" | "canceled" | ...) — estado de Clerk.
- `currentPeriodStart` / `currentPeriodEnd` (number, unix ms) — fechas de facturación.
- `cancelAtPeriodEnd` (bool) — usuario marcó para cancelar pero sigue con acceso.
- `customerId`, `customerEmail`, `amountCents`, `currency` — auditoría.

**Importante**: NO escribir en `subscriptions` desde el cliente. Solo la internal mutation `upsertFromClerkEvent` (llamada desde el webhook tras verificar firma Svix).

### 16.4 — Feature gating

**Cliente (UI reactiva)**:
```tsx
import { useHasPremium, Paywall, PremiumBadge } from "@/components/billing";

const { hasAccess, tier, status, currentPeriodEnd } = useHasPremium();

if (!hasAccess) {
  return <Paywall feature="predicciones ilimitadas" />;
}
```

**Backend (mutations Convex)**:
```ts
import { hasPremiumAccess } from "@/convex/subscriptions";

// Dentro de una mutation
const identity = await ctx.auth.getUserIdentity();
if (!identity || !(await hasPremiumAccess(ctx, identity.subject))) {
  throw new Error("Premium required");
}
```

**Por tier**: derivar tier del `planId` es robusto a nombres nuevos. La función `deriveTierFromPlanId` (en `convex/subscriptions.ts`) hace `planId.toLowerCase().includes("premium")`. Cuando se añadan tiers nuevos (team, lifetime), solo hay que cambiar ese switch.

### 16.5 — Estados que dan acceso premium

| Estado Clerk | ¿Da acceso? | Razón |
|---|---|---|
| `active` | ✅ Sí | Al día con los cobros. |
| `trialing` | ✅ Sí | En trial gratuito. |
| `past_due` | ✅ Sí | Cobro falló, reintentando. No castigar al usuario por un fallo transitorio. |
| `canceled` (con currentPeriodEnd futuro) | ✅ Sí | El usuario canceló, pero el periodo pagado aún no venció. |
| `canceled` (con currentPeriodEnd vencido) | ❌ No | El periodo venció, vuelve a Free. |
| `incomplete` / `incomplete_expired` / `unpaid` / `paused` | ❌ No | Estados terminales sin acceso. |

Centralizado en `ACCESS_GRANTING_STATES` (en `convex/subscriptions.ts`). Si Clerk añade estados nuevos, actualizar la lista.

### 16.6 — Mientras está desactivado (situación actual)

- `CLERK_WEBHOOK_SIGNING_SECRET` está **vacío** en Vercel y en `.env.local`.
- El webhook handler rechaza con 503 al recibir cualquier petición (no se procesa nada).
- `<PricingTable />` se renderiza pero sin planes configurados en el dashboard de Clerk → muestra "No plans available" (inocuo).
- `getMyPremiumStatus` devuelve `hasAccess: false` para todos → la app funciona 100% como Free.
- **No hay coste**, no hay claves que rotar, no hay datos sensibles expuestos.

### 16.7 — Para activar (cuando llegue el momento)

1. Crear cuenta / entrar en https://dashboard.clerk.com
2. Activar **Billing** en el dashboard (un clic, Clerk pide los datos fiscales)
3. Crear producto **Free** (precio 0, plan_id: `free_user`)
4. Crear producto **Premium** (precio 4,99 €/mes y/o 39 €/año, plan_id: `premium_*`)
5. Webhooks → Add endpoint → URL `https://<dominio>/api/webhooks/clerk-billing` → eventos `subscription.*`
6. Copiar el **Signing Secret** (whsec_...) a `CLERK_WEBHOOK_SIGNING_SECRET` en Vercel
7. Redeploy (Vercel detecta la nueva env var y redeploy solo)
8. Probar con el botón "Send test event" del dashboard de Clerk
9. Verificar en Convex dashboard que la tabla `subscriptions` se actualiza
10. Anunciar en redes / newsletter con link a `/premium`

**Detalle completo paso a paso**: `docs/BILLING_SETUP.md`.

### 16.8 — Si en el futuro migramos a Stripe directo

Cuesta 1-2 semanas de trabajo:
- Borrar `CLERK_WEBHOOK_SIGNING_SECRET`, añadir `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`.
- Sustituir `<PricingTable />` por `loadStripe` + `<EmbeddedCheckoutProvider>`.
- Crear endpoint `/api/stripe/checkout` que crea Checkout Session y devuelve la URL.
- Crear endpoint `/api/stripe/webhook` (en lugar de `/api/webhooks/clerk-billing`) que verifica firma de Stripe y llama a la misma `upsertFromClerkEvent` (que renombraríamos a `upsertFromStripeEvent`).
- Añadir tablas de Stripe (`stripe_customers`, `stripe_invoices`) para facturas e historial.

**La estructura actual (Convex + webhook + tabla mirror + feature gating) sigue siendo válida** — solo cambian las fuentes (Clerk → Stripe) y los componentes de checkout. Esa es la razón de haber construido la tabla `subscriptions` agnóstica al proveedor de pagos.

---

## 17. Bypass admin/test + rate limit del entrenador IA (sesión del 8 sep 2026)

Esta sesión cierra el modelo de acceso para el freemium: roles internos (admin, test) bypassean todo el paywall, y el entrenador IA tiene rate limit por tier para evitar abuso.

### 17.1 — Roles con bypass total: `admin` y `test`

El campo `role` en `profiles` admite tres literales:

- `"user"` (default, cualquier usuario registrado).
- `"admin"` (Manu, único en producción). Bypass total.
- `"test"` (beta-tester marcado a mano por Manu desde el dashboard de Convex). Bypass total.

**Qué bypassean:**
- Toda la lógica de `hasPremiumAccess(ctx, clerkUserId)` y `getMyPremiumStatus` en `convex/subscriptions.ts` → devuelven `hasAccess: true` sin mirar la tabla `subscriptions`.
- El rate limit del entrenador IA → cuentan como ilimitados.
- Cualquier futuro feature gating (Paywall, export ZIP de diplomas, etc.).

**Implementación:**
- `convex/_helpers.ts` → `isAdminOrTest(ctx)` (helper de auth).
- `convex/subscriptions.ts` → bypass en `hasPremiumAccess` (línea de entrada que mira profile.role antes de consultar subscriptions) y bypass en `getMyPremiumStatus` (devuelve `tier: "premium", status: "bypassed", bypassed: true`).
- `convex/coachAnalysisHelpers.ts` → `coachLimitForProfile()` devuelve `-1` (ilimitado) si `role === "admin" || role === "test"`.

**Para promover un usuario a test** (Manu vía dashboard de Convex):
```bash
npx convex data profiles --format json | grep <email>
npx convex data update profiles/<id> --patch '{"role":"test"}'
```

O desde el dashboard web: https://dashboard.convex.dev → proyecto `mi-dorsal` → data → profiles → fila del user → edit role a `"test"`.

### 17.1.1 — Crear un usuario de prueba NUEVO en Clerk (free, sin bypass)

Para probar la UI como un free user real (no como admin), el flujo es:

1. **Signup en Clerk**: ir a `https://mi-dorsal.com/sign-up` y registrarse con el email del test user (ej. `admin@mi-dorsal.com`). Clerk crea el user y manda el magic link.
2. **Onboarding**: abrir el email, hacer click en el magic link, completar el onboarding básico. Esto crea la fila en `profiles` automáticamente.
3. **Enrichment con PRs y myRaces**: ejecutar
   ```bash
   # En dev (default):
   npx convex run devOnly/enrichTestUserByEmail:enrichTestUserByEmail \
     '{"email":"admin@mi-dorsal.com"}'
   # En producción:
   npx convex run --prod devOnly/enrichTestUserByEmail:enrichTestUserByEmail \
     '{"email":"admin@mi-dorsal.com"}'
   ```
   El script mete 3 PRs (5K 22:30, 10K 47:15, media 1:44:50) y 2 myRaces (1 done con resultado + 1 planned) en el profile del user. NO modifica el role.

El script es **idempotente**: si lo ejecutas 2 veces, solo reemplaza los PRs/myRaces del seed, no duplica ni machaca otros que el user haya creado a mano.

**Diferencia con `devOnly/seedTestUser.ts`**: el seed crea un profile con `clerkUserId` fake (no tiene cuenta en Clerk, no puede hacer login). El enrichment opera sobre un user real de Clerk que acaba de pasar por signup + onboarding.

### 17.1.2 — Limpiar un usuario de prueba (script de cleanup)

`devOnly/cleanTestUserByClerkId.ts` borra un user (profile + PRs + myRaces + diplomas en storage) por `clerkUserId`. Pensado para limpiar el seed fake que se haya colado en prod, o para borrar un test user real cuando ya no lo necesites.

**CÓMO EJECUTAR:**

```bash
# 1. DRY RUN primero (default si no se pasa dryRun) — solo informa, NO borra
npx convex run --prod devOnly/cleanTestUserByClerkId:cleanTestUserByClerkId \
  '{"clerkUserId":"user_test_normal_seed_001"}'

# 2. Si el dry run muestra lo esperado, ejecutar de verdad
npx convex run --prod devOnly/cleanTestUserByClerkId:cleanTestUserByClerkId \
  '{"clerkUserId":"user_test_normal_seed_001","dryRun":false}'
```

**QUÉ BORRA (en este orden):**
1. PRs del user (`personalRecords`).
2. MyRaces del user (`myRaces`).
3. Archivos de diploma en Convex File Storage (best-effort: si falla, loguea y sigue).
4. El profile en sí.

**QUÉ NO TOCA (por seguridad):**
- Actividades de Strava (`activities`) — son muchas filas, si quieres borrarlas hazlo a mano.
- Votes, ratings, notifications, raceSuggestions, etc. — no las tocamos para no liarla.
- El user en Clerk — bórralo aparte desde el dashboard de Clerk si te registraste con un email real.

**Por qué `dryRun` es true por default:** para evitar accidentes. Si ejecutas el comando sin `dryRun`, te mostrará el informe pero NO borrará nada. Tienes que pasar `"dryRun":false` explícitamente.

### 17.2 — Rate limit del entrenador IA

Para evitar que alguien abuse de la action `coachAnalysis` (cada llamada cuesta ~€0.0007 con gpt-4o-mini, gratis con MiniMax M3, pero el LLM tiene límites de rate y no queremos saturarlo):

| Tier | Límite | Implementación |
|---|---|---|
| `admin` | ∞ | bypass en `coachLimitForProfile` |
| `test` | ∞ | bypass en `coachLimitForProfile` |
| Pro (suscripción premium activa) | ∞ | si `tier === "premium"` y `status` ∈ {active, trialing, past_due} |
| Free (user sin suscripción) | **1 al mes** | se resetea el día 1 de cada mes UTC |

**Modelo de datos** (schema `profiles`):
- `aiCoachUsageCount: v.optional(v.number())` — contador del mes en curso.
- `aiCoachUsageResetAt: v.optional(v.number())` — Unix ms del próximo reset (1 del mes siguiente, 00:00 UTC).

**Cómo funciona el reset:**
- En la mutation `incrementCoachUsage` (en `convex/coachAnalysisHelpers.ts`), antes de incrementar se mira `aiCoachUsageResetAt`:
  - Si no existe o es de un mes UTC anterior → se considera "mes nuevo" y se reinicia el contador a 1 (este uso).
  - Si es del mes UTC actual → se incrementa de `currentCount` a `currentCount + 1`.
- Además hay un cron `reset-coach-usage` que corre el día 1 de cada mes a las 00:05 UTC (`convex/crons/resetCoachUsage.ts`, registrado en `convex/cronJobs.ts`). Mantiene la BD limpia sin esperar a que el usuario entre a /perfil.

**UI en `CoachAnalysisCard`:**
- Si `limit === -1` → no se muestra contador.
- Si `limit > 0` → se muestra `"X de Y al mes"` en la cabecera.
- Si `count >= limit` (free agotado) → botón deshabilitado, mensaje claro con fecha de reset, **CTA suave** a `/cuenta/suscripcion` (NO paywall bloqueante — Manu decidió que el free puede hacer 1 al mes, no que tenga que pagar).
- El contador se actualiza en tiempo real vía `useQuery(api.coachAnalysisHelpers.getMyCoachUsage)`.

### 17.3 — Estado que devuelve `getMyPremiumStatus`

Antes: `{ hasAccess, tier, status, currentPeriodEnd }`.

Ahora: se añaden dos campos para que la UI pueda distinguir bypass de pago real:

```typescript
{
  hasAccess: boolean,            // true si premium (pago o bypass)
  tier: "free" | "premium",
  status: string | null,         // "bypassed" si es admin/test
  currentPeriodEnd: number | null,
  role: string | null,           // "user" | "admin" | "test" | null
  bypassed: boolean,             // true si acceso viene de role, no de pago
}
```

El hook `useHasPremium()` (`components/billing/use-has-premium.ts`) ya expone estos campos. La UI puede usar `bypassed` para mostrar copy neutro ("Acceso total (beta tester)") en vez de "Premium".

### 17.4 — Pendientes relacionados

- Cuando se activen pagos reales (Q3-Q4 2026), `coachLimitForProfile` se mantiene igual: si tienen fila `subscriptions` con `tier === "premium"`, son pro/ilimitado. Si no, son free/1-mes.
- Si en el futuro hay un tier intermedio "premium_basic" (3/mes), cambiar el `if (hasActiveSubscription) return -1` por una comprobación del `planId` o del tier.
- El bypass por rol se comprueba ANTES de mirar la suscripción, así que un admin con `subscriptions.tier === "free"` (raro pero posible) sigue teniendo acceso. Es la semántica correcta: el rol manda.

### 17.5 — Lifecycle del profile: el signup de Clerk NO crea fila en Convex

**Lección crítica (sesión 8 sep 2026):** cuando un usuario se registra con magic link en Clerk y completa el onboarding, **Clerk crea el user en su sistema pero NO se crea la fila correspondiente en `profiles` de Convex**. La mutation `upsertMyProfile` solo se dispara cuando el usuario hace algo explícito en la app (abrir el form de edición, guardar un PR, etc.). Si el usuario nuevo entra directamente a `/perfil` sin haber hecho nada más, las queries de actividades (`getMyActivityStats`, `getMyRunnerType`, etc.) que llaman a `getOptionalUser(ctx)` devuelven `null`, y los componentes que esperan un objeto explotan con `TypeError: Cannot read properties of null (reading 'totalActivities')`.

**Síntoma exacto que vio Manu** (8 sep 2026, tras signup con `admin@mi-dorsal.com`):
```
TypeError: Cannot read properties of null (reading 'totalActivities')
    at K (https://www.mi-dorsal.com/_next/static/chunks/app/perfil/page-1815ee64fa667165.js:1:39034)
```

**Fix en dos capas** (commit `e9a1595`):

1. **Defensa en queries** (`convex/activities/queries.ts`): `getMyActivityStats` y `getMyRunnerType` devuelven un objeto con campos neutros (todos a 0, `avgCadenceSpm: null`, `byType: {}`) cuando no hay profile, en lugar de `null`. Así la UI nunca explota por un profile ausente, ni siquiera en el caso edge del primer login.

2. **Causa raíz en el cliente** (`app/perfil/page.tsx`): `RealPerfil` tiene un `useEffect` que detecta cuando `useQuery(api.users.getMyProfile)` devuelve `null` y dispara `upsertMyProfile({})` automáticamente. La mutation es idempotente y Clerk ya inyecta el `clerkUserId` en el JWT, así que no necesita argumentos. En el siguiente tick React, el profile existe y los componentes se actualizan reactivamente.

**Por qué `useEffect` y no `middleware` o el webhook de Clerk**: Clerk tiene un webhook de `user.created` que podríamos usar, pero requiere configurar el endpoint, validar la firma Svix y manejar reintentos. El `useEffect` es 10 líneas, auto-curativo, sin estado intermedio que mantener. Si el user nunca entra a `/perfil` no se crea el profile, pero eso es OK porque sin activity de la app no necesitamos el profile.

**Aplicar a**: cualquier nuevo flujo que dependa de un profile existente. Si en el futuro añades un feature que asuma "el profile siempre existe en Convex", o bien disparas `upsertMyProfile` desde el primer punto de contacto con la app, o bien devuelves objeto neutro en la query como en este fix. La opción del `useEffect` es la más barata y la más difícil de olvidar.

**Lección relacionada (memoria del agente, 8 sep 2026)**: el typecheck de `npx convex dev` es menos estricto que el de `npx convex deploy` / `next build`. Si un `internalAction` o `internalMutation` rompe con TS2589/TS2615 (tipo circular en mapped type de Convex 1.18), el workaround definitivo es **declarar el return type del handler explícitamente** (`handler: async (ctx): Promise<{...}> => {...}`). Los casts a `any` no bastan. Ver el código de `convex/crons/resetCoachUsage.ts` para el ejemplo aplicado.

**Última actualización**: 8 de septiembre de 2026. Sesión de integración de pasarela de pagos: esqueleto de Clerk Billing (Stripe bajo el capó) listo pero no activado. Tabla `subscriptions` en Convex + webhook handler Svix-verified en `/api/webhooks/clerk-billing` + componentes `<Paywall>`/`<PremiumBadge>` + páginas `/premium` (landing pública) y `/cuenta/suscripcion` (gestión) + doc `docs/BILLING_SETUP.md` con el runbook de activación. Cero coste mientras no se active. Activación en Q3-Q4 2026 según `docs/MONETIZATION_PLAN.md`. Sesión anterior: 7 sep 2026 (enrichment masivo de carreras con IA). Misma sesión (continuación): bypass admin/test en `hasPremiumAccess` y `getMyPremiumStatus` + rate limit del entrenador IA (free=1/mes, pro=∞, admin/test=∞) con reset mensual vía cron + UI con contador "X de Y al mes" en `CoachAnalysisCard` y CTA suave a `/cuenta/suscripcion` cuando se agota. Misma sesión (más tarde): scripts de devOnly para crear/limpiar usuarios de prueba (`seedTestUser`, `enrichTestUserByEmail`, `cleanTestUserByClerkId`) + fix del bug "TypeError: Cannot read properties of null (reading 'totalActivities')" en `/perfil` con dos capas: queries devuelven objeto neutro cuando no hay profile + `useEffect` en `RealPerfil` que dispara `upsertMyProfile` automáticamente al detectar `null` en `getMyProfile`. Documentado en §17.5.

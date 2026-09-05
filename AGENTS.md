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

**Última actualización**: 5 de septiembre de 2026. Refleja el estado del proyecto tras el upgrade a Convex Starter ($10 cap), el fix del cron `recalc-stats` (5→30 min) y la limpieza de 31 errores de TypeScript preexistentes (TS2589). Sesión anterior: 4 sep 2026 (naming + dominio + email corporativo pendiente).

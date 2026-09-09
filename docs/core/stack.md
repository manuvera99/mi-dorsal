# Stack técnico y decisiones arquitectónicas

> Documento on-demand. Se carga cuando la tarea toca decisiones técnicas de stack.

## Stack

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind 3.4.
- **Backend**: Convex (DB + cron + storage + reactive queries).
- **Auth**: Clerk (magic link). **NO migrar**.
- **Email**: Resend.
- **PDF**: `@react-email/renderer` + `@react-pdf/renderer`.
- **Hosting**: Vercel (región `fra1`).
- **Mock mode**: `NEXT_PUBLIC_USE_MOCK=true` para dev sin credenciales.

## Decisiones que NO se deben romper

### 1. `force-dynamic` en páginas con query/SSR

Páginas con `useQuery` de Convex, `useUserRegion`, o `force-dynamic` por IP necesitan **`export const dynamic = "force-dynamic"`** en el `page.tsx` (Server Component) o en el Client Component raíz. Sin esto, el build en Vercel peta con `a.map is not a function` durante el prerender.

Páginas afectadas: `app/page.tsx`, `app/carreras/page.tsx`.

### 2. JSON-LD pre-serializado

**Patrón**: en `app/page.tsx`, el JSON-LD de la FAQPage se inyecta como **string literal pre-serializado** en build time, NO construido en runtime. Esto evita el error `a.map is not a function` en SSR.

```tsx
// ✅ CORRECTO (lo que hay en app/page.tsx)
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_PAGE_JSONLD }} />

// ❌ EVITAR (lo que estaba antes y petaba)
<JsonLd data={faqJsonLd(FAQ_ITEMS)} />  // falla en SSR
```

**Si modificas el FAQ**, regenera el string en `app/page.tsx` manualmente.

### 3. Portal en dropdowns/popovers

**Cualquier dropdown o popover que viva dentro de un contenedor con `overflow-hidden` debe usar `createPortal(..., document.body)`** y posicionamiento dinámico con `getBoundingClientRect()` + listeners de scroll/resize. El hero de la home tiene `overflow-hidden` y rompió el `RegionSwitcher` antes de este fix.

### 4. Geolocalización

- **No usar el endpoint `/api/geo/ip`** (deprecated, 410).
- **Usar `/api/geo/region`** con headers `x-vercel-ip-*` de Vercel.
- **Para CCAA/provincias**, consultar `lib/geo/region.ts` siempre. Es la single source of truth.

### 5. Menú móvil con hamburguesa (header)

`components/header.tsx` tiene la nav de escritorio con `hidden md:flex`, PERO debajo de 768 px se sustituye por una hamburguesa (`md:hidden`, 44×44 px) que abre un panel desplegable dentro del `<header>` sticky. La fuente de verdad para los items es `NAV_ITEMS` (mismo array para desktop y mobile, fuente única para evitar drift).

Comportamiento del panel:
- Cierra con `Escape`, click en enlace o cambio de ruta (`useEffect` sobre `usePathname`).
- Body scroll lock mientras está abierto.
- Highlight de ruta activa con `aria-current="page"`.
- A11y: `aria-label` dinámico ("Abrir menú"/"Cerrar menú"), `aria-expanded`, `aria-controls="mobile-menu-panel"`, `aria-hidden` en el panel.

**NO eliminar la hamburguesa, el panel ni el estado `mobileMenuOpen`** pensando que es código duplicado de la nav de escritorio. Es intencional: la nav desktop es `hidden` en móvil y el panel solo existe en móvil. Quitarlo deja a los usuarios sin acceso a Carreras, Perfil, Calendario o Ranking en <768 px (regression ya resuelta el 5 sep 2026, commit `fe18841`).

**Si añades un nuevo item a la nav** (ej. DorsalSwap cuando se reactive), añadirlo a `NAV_ITEMS` y, si quieres también desktop, al `<nav>` visible. NO duplicar la lista.

## Convenciones de código

- **Naming**: español para copy y dominio (`carreras`, `perfil`, `dorsal`). Inglés para tech (`useQuery`, `force-dynamic`, `components/carreras/`).
- **Componentes**: PascalCase, un archivo por componente, en `components/<sección>/`.
- **Hooks**: prefijo `use-`, kebab-case (`use-user-region.ts`).
- **Estilos**: Tailwind utility-first. **Evitar CSS modules.** Para utilities custom (ej. `scrollbar-hide`), añadir en `app/globals.css` con `@layer utilities`.
- **Tipos**: `any` se tolera en boundaries con Convex (`api.races.getFeatured as any`) y en componentes de RaceCard (datos mock). En el resto, tipar.
- **Imports**: usar alias `@/components`, `@/lib`, `@/convex`.

## Estructura de carpetas (resumen)

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

## Workaround TypeScript para Convex 1.18

Convex 1.18 tiene inferencia más estricta. Si `tsc --noEmit` falla con **TS2589 (Type instantiation is excessively deep)** en `internalAction`/`internalQuery`/`internalMutation`:

1. **`ctx: any` en el handler** de la función (28 funciones en 7 archivos fue el fix del 5 sep 2026).
2. **`q: any` en queries reasignadas** (`let q = ctx.db.query(...); if (...) { q = q.withIndex(...) }`).
3. **`as const` en arrays derivados** de `Record<string, X>` que deberían ser union literal.
4. **Cast `as Record<string, number>`** en `Object.values(...)` que se usan en reduce.
5. **`as any` en `runQuery(internal.X.Y)`** para romper la inferencia circular del API type.
6. **Workaround de emergencia**: `npx convex deploy --typecheck=disable` (saltarse el typecheck, deploy igualmente). **Usar solo para sacar fixes urgentes**.

**Por qué es OK**: AGENTS.md permite `any` en boundaries con Convex. El cambio es solo de tipos — el runtime no se ve afectado.

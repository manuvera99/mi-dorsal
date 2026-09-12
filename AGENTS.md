# AGENTS.md — Índice y router de contexto para mi-dorsal

> **Este archivo es un ÍNDICE, no una enciclopedia.** Léelo entero (es corto), pero NO cargues todo `docs/` de golpe. Usa la tabla de la sección 3 para abrir solo el/los documentos que aplican a la tarea concreta que vas a hacer. El detalle vive repartido en `docs/core/`, `docs/optional/`, `docs/history/` y `docs/plans/` — cada archivo es pequeño y dice en su cabecera cuándo cargarlo.
>
> Por qué está organizado así: el desarrollo se hace con LLMs (sobre todo MiniMax M3) en conversaciones largas, y cargar todo el contexto de la app en cada turno es caro en tokens. Cargar solo lo relevante a la pantalla/sistema que tocas mantiene las conversaciones baratas y rápidas.

---

## 1. Qué es mi-dorsal

**mi-dorsal** es una web app para corredores populares de España: catálogo curado de carreras, predicción de tiempos (Daniels VDOT), tracking automático de dorsales y envío de resultados oficiales por email con diploma PDF. Diferenciador vs Strava/Correbirras/Runedia: **no compite en datos de entrenamiento, compite en el ritual del dorsal y el resultado oficial**.

- **Naming**: `mi-dorsal` (con guion, siempre en copy/URLs/emails). Handles de redes sin guion (`@midorsal`). Ver `docs/history/naming-decisions.md`.
- **Tagline**: "El hilo que te une a tu dorsal." — **Tuteo siempre**, tono cercano con humor sutil de corredor. Ver `docs/history/brand-identity.md`.
- **Cobertura**: toda España (expandido sep 2026, antes solo Levante). **No escribir copy que limite a Levante/Valencia/Alicante/Murcia/Castellón.**
- **Estado**: MVP funcional en producción desde 4 sep 2026. Auth Clerk, DB Convex, deploy Vercel.
- **Hoja de ruta viva (pendientes + futuras features)**: `docs/ROADMAP.md` — fuente única para marcar tareas como completadas o añadir nuevas. Léelo siempre antes de planificar trabajo.
- **Mapa técnico completo**: `docs/ARCHITECTURE.md` (stack, 24 tablas, 7 crons, flujos críticos, API routes) — léelo si necesitas la vista de pájaro del sistema entero.

---

## 2. Reglas que NO se deben romper (resumen — detalle en `docs/core/anti-patterns.md`)

1. Páginas con `useQuery`/geo-IP necesitan `export const dynamic = "force-dynamic"` o el build de Vercel peta con `a.map is not a function`.
2. JSON-LD siempre pre-serializado en build time (string literal + `dangerouslySetInnerHTML`), nunca construido en runtime.
3. Dropdowns/popovers dentro de un contenedor `overflow-hidden` → portal a `document.body`.
4. No usar `/api/geo/ip` (deprecated, 410) — usar `/api/geo/region`.
5. No reordenar las 11 secciones de la home, ni la estructura de `/carreras`, sin discutirlo.
6. No eliminar la hamburguesa/panel móvil del header — es la única nav en <768px.
7. **Nunca `git add -A`** sin `git status` antes.
8. **Nunca pushear a `master` sin `npm run build` local primero** (`tsc --noEmit` no basta, Vercel es más estricto).
9. Testimonios de la home son placeholders con disclaimer — no tratarlos como reales.
10. Cambiar `RESEND_FROM_EMAIL` → verificar dominio en Resend primero.
11. **Tras cualquier sesión que toque `convex/*.ts` o cambie el schema**: pasar la checklist de optimización de `docs/optional/convex-upgrade.md` §"Checklist post-sesión" antes de cerrar la sesión — buscar `.collect()` nuevos sobre tablas grandes en el hot path (crons, mutations llamadas en bucle) y confirmar que usan índice real, no filtro en memoria.

---

## 3. Procedimiento de desarrollo con IA — dónde buscar según la tarea

**Regla de oro**: identifica qué vas a tocar en la fila de la izquierda, abre SOLO el/los documento(s) de la derecha. Si tu tarea cruza varias filas, abre varias — pero no abras todo `docs/` "por si acaso".

| Vas a tocar... | Lee primero |
|---|---|
| Home / `app/page.tsx` | `docs/core/home-structure.md` |
| `/carreras` (catálogo, ficha, filtros) | `docs/core/carreras-page.md` |
| Geolocalización / CCAA / `RegionSwitcher` | `docs/core/geo-system.md` |
| Deploy / CI / build roto en Vercel / entorno de PRE (`mi-dorsal.vercel.app`) | `docs/core/deploy-checklist.md` |
| Stack, convenciones de código, error TS2589 | `docs/core/stack.md` |
| Base de datos / nueva tabla / campo en Convex | `docs/core/database-schema.md` + `convex/schema.ts` (fuente real) |
| Emails transaccionales / crons / `notificationLog` | `docs/core/emails-crons.md` |
| Billing (Clerk) / Premium / rate limit del coach IA / roles admin-test | `docs/core/billing-subscriptions.md` |
| Blog "Historias de dorsal" / newsletter | `docs/core/blog-newsletter.md` |
| Strava OAuth / export ZIP / activities | `docs/core/strava-integration.md` |
| Panel `/admin/*` (cualquier subruta) | `docs/core/admin-panel.md` |
| SEO / metadata / Schema.org / AdSense | `docs/core/seo.md` |
| Anti-patrones (antes de cualquier cambio dudoso) | `docs/core/anti-patterns.md` |
| Trabajar varias sesiones/ramas en paralelo (git worktrees) | `docs/core/dev-worktrees.md` |
| **¿Qué tareas hay pendientes / qué se hace ahora?** | `docs/ROADMAP.md` (hoja de ruta viva) |
| Tono de voz / copy / vocabulario preferido-evitado | `docs/core/brand-voice.md` |
| Branding / paleta de color / tipografía / logo | `docs/history/brand-identity.md` |
| Naming / dominios / marca legal (OEPM) | `docs/history/naming-decisions.md` |
| Vocabulario del dominio running (dorsal, PR, 8D...) | `docs/history/domain-glossary.md` |
| Enrichment de carreras con IA (`deep-extract-all.ts`, `/admin/duplicates`) | `docs/optional/enrichment.md` |
| Plan/coste de Convex, errores TS2589 a fondo | `docs/optional/convex-upgrade.md` |
| Prompts de los agentes editoriales del blog | `docs/optional/agent-prompts.md` |
| Runbook ya ejecutado de Strava OAuth (repetir setup) | `docs/history/strava-oauth-setup.md` |
| Análisis histórico superado del backend (4 sep 2026) | `docs/history/analisis-backend-dorsales.md` — **no citar como estado actual** |
| Activar Clerk Billing en producción (runbook) | `docs/BILLING_SETUP.md` |
| **Roadmap / pendientes / próximas iteraciones (fuente única)** | `docs/ROADMAP.md` (legacy: `docs/optional/future-iterations.md`) |
| Monetización, DorsalSwap, marketing, infra a escala (**planes de negocio, no código**) | `docs/plans/*` — normalmente NO hace falta para programar |
| Mapa completo del sistema (stack, 23 tablas, 9 crons, flujos, API routes) | `docs/ARCHITECTURE.md` |

---

## 4. Convenciones de código (resumen — detalle en `docs/core/stack.md`)

- **Naming**: español para copy y dominio (`carreras`, `perfil`, `dorsal`). Inglés para tech (`useQuery`, `force-dynamic`, `components/carreras/`).
- **Componentes**: PascalCase, un archivo por componente, en `components/<sección>/`. **Hooks**: prefijo `use-`, kebab-case.
- **Estilos**: Tailwind utility-first, evitar CSS modules.
- **Tipos**: `any` tolerado en boundaries con Convex; tipar el resto.
- **Imports**: alias `@/components`, `@/lib`, `@/convex`.
- **Deploy**: `npx tsc --noEmit` → `npm run build` → commit selectivo → push `master` → `npx convex deploy` → `vercel deploy --prod --yes`. Checklist completo en `docs/core/deploy-checklist.md`.

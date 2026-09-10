# 🗺️ Roadmap · mi-dorsal

> **Documento vivo.** Fuente única de verdad de tareas pendientes y futuras features.
> Se actualiza al cerrar cada tarea y al descubrir nueva deuda.
>
> **Última revisión:** 10 sep 2026 · **Próxima revisión:** semanal hasta lanzar monetización, después mensual.
>
> **Cómo se lee:**
> - `[ ]` = pendiente · `[~]` = en curso · `[x]` = completada
> - **Sprint 0** = bloqueante, esta semana
> - **Sprint N** = orden de ejecución propuesto
> - Las tareas se mueven de Sprint cuando se completan (no se borran, se tachan)
> - Para detalle, cada tarea apunta al doc de referencia

---

## 📊 Estado global (resumen ejecutivo)

| Pilar | Estado | Última actualización |
|---|---|---|
| Producto (catálogo, predicciones, diplomas, Strava) | ✅ **MVP en producción** desde 4 sep 2026 | sprint 0 cerrado |
| Infra crítica (Vercel, Zoho, Resend) | 🔴 **3 fixes pendientes bloqueantes** | 10 sep 2026 |
| Suscripción Pro (Stripe directo) | 🟡 Esqueleto listo, **NO activado** | 9 sep 2026 |
| DorsalSwap (side project) | 🟡 MVP técnico completo, **sin desplegar** | 4 sep 2026 |
| Monetización (4 patas) | 🟡 Sin ingresos. AdSense sin solicitar | 4 sep 2026 |
| SEO + descubrimiento | 🟠 2.761 páginas indexables, **sitemap no enviado a GSC** | 10 sep 2026 |
| Multi-distancia en carreras | 🟡 Plan aprobado, **0/7 tasks hechas** | 9 sep 2026 |

**Tracción**: ~200 usuarios registrados, ~60 MAU, 2.761 carreras en catálogo, 0 Pro pagando.

---

## 🚨 Sprint 0 — Esta semana (BLOQUEANTE)

> Estos 3 fixes son **obligatorios antes de activar monetización o AdSense**.
> Coste: ~$40/mes. Esfuerzo: < 1 h total en dashboards. Riesgo de cierre de cuenta Vercel si no se hace.

- [ ] **Vercel Hobby → Pro** (`$20/mes`)
  - Vercel Hobby prohíbe uso comercial → choca con AdSense y Stripe
  - Acción: dashboard Vercel → upgrade
  - Ref: `docs/plans/INFRA_ROADMAP.md` §3.1, `docs/AGENTS.md` §2
- [ ] **Configurar Zoho Mail + crear buzón `hola@mi-dorsal.com`**
  - Hoy `RESEND_FROM_EMAIL` apunta a un buzón inexistente → emails rebotan
  - Riesgo: reputación de dominio cae con cada rebote (afecta a TODA la newsletter)
  - Acción: 5 buzones gratis en Zoho, actualizar DNS MX en Hostinger
  - Ref: `docs/history/naming-decisions.md`, `docs/plans/INFRA_ROADMAP.md` §1.1
- [ ] **Resend Free → Pro** (`$20/mes`, hacerlo el **mismo día** que se active Pro)
  - El cap de 100 emails/día mata la newsletter a >100 suscriptores
  - Sin esto, el primer envío masivo de bienvenida se queda a medias

**Coste tras Sprint 0:** ~$40/mes operativos (cubre Vercel Pro + Resend Pro; Zoho $0).

---

## ⚡ Sprint 1 — Mes 1 (activar monetización)

> Activar Stripe directo (ya migrado de Clerk Billing el 9 sep 2026) y desbloquear las 4 patas.

### 1.1 Activar Stripe (1-2 días, sustituye al `BILLING_SETUP.md` legacy)

- [ ] Crear cuenta Stripe y rellenar datos fiscales (autónomo / SL)
- [ ] Crear productos en dashboard:
  - [ ] "Premium mensual" 2,99 €/mes, **sin trial**, cobro upfront
  - [ ] "Premium anual" 24,99 €/año, **trial 14 días sin tarjeta**
- [ ] Configurar `STRIPE_PRICE_MONTHLY` y `STRIPE_PRICE_YEARLY` en Vercel
- [ ] Crear endpoint webhook `https://mi-dorsal.com/api/stripe/webhook` con eventos:
  - `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`
- [ ] Configurar env vars en Vercel: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- [ ] Smoke test E2E con tarjeta `4242 4242 4242 4242` (verificar fila en `subscriptions` y badge Premium)
- [ ] Desactivar **Clerk Billing** en su dashboard (legacy, ya no se usa)
- [ ] **Mantener o eliminar** `app/api/webhooks/clerk-billing/route.ts` (legacy, candidato a borrar)
- [ ] Test 3D Secure con tarjeta `4000 0027 6000 3184` (mercado EU)
- [ ] Customizar branding del Customer Portal (logo, color)
- [ ] Ref: `docs/STRIPE_INTEGRATION_TODO.md` (fuente única), `docs/BILLING_SETUP.md` (legacy)

### 1.2 Validación de pricing con entrevistas (1 semana)

- [ ] Reclutar 5-10 corredores populares reales (lista newsletter + Telegram + foros)
- [ ] Pregunta nuclear: *"¿Pagarías 2,99 €/mes o 24 €/año por [features]?"*
- [ ] Pregunta 2: *"¿Qué feature echas más de menos si te la quito?"*
- [ ] Documentar respuestas y ajustar pricing si hay consenso > 70%
- [ ] Ref: `docs/plans/BUSINESS_PLAN.md` §6, §8 (Fase 0)

### 1.3 UX del paywall + feature gating (1 semana)

- [ ] Decidir Free vs Pro para cada feature según `docs/plans/MONETIZATION_PLAN.md` §"Pata 4"
- [ ] Aplicar `<Paywall>` a: calendario>5, PRs>3, resultados>3, export ZIP, alertas, export calendario, widget público, comparativa, entrenador IA, gear, splits, polyline, hilo del corredor
- [ ] **NO aplicar** a: predicciones, catálogo, voto, 8D, newsletter
- [ ] Rate-limit entrenador IA: 4/mes/Pro, 0/mes/Free (1 trial gratis)
- [ ] Banner contextual en home/perfil cuando free se acerca al límite
- [ ] Ref: `components/billing/paywall.tsx`, `components/billing/premium-feature-lock.tsx`, `convex/aiUsage.ts`

### 1.4 Onboarding "wow moment" (3-5 días)

- [ ] Diseñar flujo: signup → Strava connect → 1ª predicción → 1er diploma → 1er análisis IA en < 5 min
- [ ] Email transaccional de bienvenida inmediato (ver §3.2 — actualmente "Pendiente cablear")
- [ ] Ref: `docs/ARCHITECTURE.md` §4.1 (Onboarding)

### 1.5 SEO básico (2-3 días)

- [ ] **Crear Google Search Console** y enviar sitemap (cada día sin esto = visitas perdidas)
- [ ] Verificar que `races:listForSitemap` de Convex funciona (sospechoso de estar roto, ver §3.4)
- [ ] Verificar indexación de las 2.761 páginas (URL Inspection sobre 5-10 carreras top)
- [ ] Ref: `docs/optional/future-iterations.md` (SEO y descubrimiento)

---

## 📅 Sprint 2 — Mes 2-3 (contenido + 4 patas)

### 2.1 Pata 1: Display Ads (AdSense)

- [ ] Solicitar AdSense (1-4 semanas aprobación, **pedir YA**)
- [ ] Activar `NEXT_PUBLIC_ADSENSE_CLIENT_ID` cuando aprueben
- [ ] Insertar 1 banner en home (debajo del hero, no encima)
- [ ] Insertar 1 banner en ficha de carrera (después de datos clave)
- [ ] Insertar 1 banner en `/carreras` (después de 6-9 cards)
- [ ] **Nunca intersticiales ni popups** (penalización SEO + mala UX)
- [ ] Si AdSense rechaza: tener Ezoic preparado como backup
- [ ] Ref: `docs/plans/MONETIZATION_PLAN.md` §Pata 1

### 2.2 Pata 2: Afiliación material deportivo

- [ ] Crear cuenta en **Awin** (15k+ anunciantes en España, aprobación 1-3 días)
- [ ] Crear cuenta en **Daisycon** (fuerte en ES, fácil)
- [ ] (Opcional) Amazon Asociados como refuerzo (peor comisión pero conversión brutal)
- [ ] Escribir 4 guías SEO iniciales:
  - [ ] "Las 10 mejores zapatillas para trail en 2026" → `/guias/mejores-zapatillas-trail-2026`
  - [ ] "Las 10 mejores zapatillas para 10K"
  - [ ] "Mejor GPS running 2026" (Garmin, Suunto, Coros, Polar)
  - [ ] "Mejores geles para maratón" (Maurten, SIS, Precision Fuel)
- [ ] Intern linking masivo desde carreras de trail a la guía de trail (y así con cada una)
- [ ] Marcar todos los enlaces con `rel="sponsored noopener"`
- [ ] Ref: `docs/plans/MONETIZATION_PLAN.md` §Pata 2

### 2.3 Pata 3: Newsletter (mejorar la lista)

- [ ] Lead magnet PDF: "Plan de 12 semanas para tu primera media maratón"
- [ ] Modal opt-in al alcanzar 5 carreras en el calendario
- [ ] Banner sticky en home (no intrusivo, parte inferior)
- [ ] Opt-in después de votar una carrera
- [ ] Footer en cada email de resultados
- [ ] Verificar SPF/DKIM en Resend (ya están en Vercel)
- [ ] Ref: `docs/core/blog-newsletter.md`

### 2.4 Pata 4: Lanzamiento público Pro

- [ ] Landing pública `/pro` con feature list, FAQ, social proof
- [ ] Beta cerrada con 50-100 early adopters (trial 14 días sin tarjeta)
- [ ] Recoger feedback: trial→paid, retención 7/30 días, features más usadas
- [ ] Iterar pricing y feature set si hace falta
- [ ] **Oferta launch**: 19 €/año el primer año (en vez de 24 €) para los primeros 200
- [ ] Post en blog: "Por qué Pro cuesta 2 € al mes y no 5 €" (transparencia con datos de `aiUsageLog`)
- [ ] Anuncio en newsletter, redes (@midorsal), Product Hunt
- [ ] Ref: `docs/plans/BUSINESS_PLAN.md` §8 (Fase 1-3)

### 2.5 Multi-distancia en carreras (7 tasks, plan 9 sep)

> Plan completo en `docs/superpowers/plans/2026-09-09-multi-distancia-carreras.md`.
> Spec: `docs/superpowers/specs/2026-09-09-multi-distancia-carreras-design.md`.
> **Status: 0/7 tasks hechas — empezar tras Sprint 0.**

- [ ] **Task 1**: Schema — añadir `selectedDistanceKm/Label/ElevationGainM` a `myRaces`
- [ ] **Task 2**: Helper puro `getEffectiveDistance` en `lib/prediction/effective-distance.ts`
- [ ] **Task 3**: `myRaces.add` acepta `selectedDistance` y la usa en la predicción
- [ ] **Task 4**: Mutation `myRaces.updateDistance` para cambiar desde el calendario
- [ ] **Task 5**: Componente `DistanceModalityPicker` (compartido por add + edit)
- [ ] **Task 6**: Integrar picker en `AddToCalendarWidget` y `HiloNode`
- [ ] **Task 7**: Filtro de `/carreras` ampliado para mirar `raceFormats`
- [ ] Verificar con `npx tsc --noEmit` + `npm run build` en cada paso (regla de oro AGENTS.md §2.8)
- [ ] Commit selectivo (nunca `git add -A` sin `git status`)

---

## 🔧 Sprint 3 — Q3-Q4 2026 (escala + producto)

### 3.1 Producto

- [ ] **Welcome email cableado** — actualmente figura como "Pendiente cablear" en `docs/ARCHITECTURE.md` §6
- [ ] PWA: prompt de instalación en Android/iOS tras 2 visitas
- [ ] Garmin integration (Convex + OAuth) — `activities` ya soporta `garmin` como source
- [ ] Plan familiar (5 corredores) como palanca year 2
- [ ] Programa de referidos (1 mes gratis por amigo)
- [ ] Export del calendario a Google Calendar / Apple Calendar
- [ ] Widget público "carreras que corro" para blogs/web externa
- [ ] Comparativa con comunidad (percentiles por edad, distancia, zona)
- [ ] Alertas personalizadas gratuitas (1-2 básicas, el resto Pro)

### 3.2 Cron `weekly-digest` y `year-review`

- [ ] **weekly-digest**: archivo `convex/crons/weeklyDigest.ts` existe como PLACEHOLDER
  - Decisión previa: **se eliminó del código el 9 sep 2026** (`INFRA_ROADMAP.md` §3.1 nota 1)
  - Acción: confirmar si el archivo `.ts` placeholder sigue ahí → si sí, **borrarlo o implementarlo**
- [ ] **year-review**: `convex/crons/yearReview.ts` PLACEHOLDER (Sprint 3)
  - Implementar: email "tu año en dorsal" el 1 de enero con stats del año
  - Ref: `docs/ARCHITECTURE.md` §5

### 3.3 SEO y descubrimiento

- [ ] ItemList dinámico en `/carreras` con slugs reales (requiere query en Server Component)
- [ ] Arreglar `races:listForSitemap` en Convex (sospechoso de estar roto — verificar)
- [ ] OG image custom 1200×630 con dorsal estilizado y tagline (mejora CTR en WhatsApp/Twitter/LinkedIn)
- [ ] Comprar `mi-dorsal.run` defensivo (~24 €/año)
- [ ] Asegurar `@midorsal` en IG, TikTok, X, YouTube, Threads, Bluesky
- [ ] Ref: `docs/core/seo.md`, `docs/optional/future-iterations.md`

### 3.4 Branding y naming

- [ ] Migrar paleta de color al rebranding "Verano en el Levante" (E63946 / 1D3557 / 2A9D8F / F4A261)
- [ ] Adoptar `Bricolage Grotesque` o `Sora` como display font
- [ ] Logo simplificado para favicon 16/32/180/192/512 px
- [ ] Testimonios reales (sustituir el array `TESTIMONIALS` en `components/home/testimonials.tsx`)
  - ⚠️ Hoy son placeholders con disclaimer — no tratar como reales
- [ ] Landing `/newsletter` mejorada con social proof
- [ ] Limpiar inconsistencias de naming en el código (midorsal vs mi-dorsal en metadata, copy, OG)
- [ ] Registrar marca `mi-dorsal` en OEPM (clases 9, 41, 42) — ~150 €, 8-12 meses resolución
- [ ] Ref: `docs/history/brand-identity.md`, `docs/history/naming-decisions.md`

### 3.5 DorsalSwap (despliegue + decisión)

- [ ] **Resolver gap crítico**: añadir `email` al profile (necesario para emails de DorsalSwap)
- [ ] Decisión de lanzamiento: ¿dorsalswap.vercel.app gratis o dominio propio?
- [ ] Validar 4-6 semanas con listings reales antes de comprar dominio
- [ ] Contactar organizadores top (Valencia, Madrid, Barcelona, Sevilla) para partnerships
- [ ] Ref: `docs/plans/DORSALSWAP_MVP.md`, `docs/plans/DORSALSWAP_PLAN.md`, `docs/plans/INTERCAMBIO_DORSALES.md`

### 3.6 Datos / observabilidad

- [ ] Dashboard en `/admin` que muestre uso Pro vs Free (churn, MRR estimado)
- [ ] Revisar `aiUsageLog` mensualmente para detectar abuso del coach IA
- [ ] Configurar alertas cuando `costEur/mes > $50` con <100 Pro (señal de abuso)

---

## 🚀 Año 2 — 2027 (expansión)

> Estas tareas no son para Sprint N específico, son apuestas de crecimiento.

### 4.1 Producto

- [ ] **App nativa iOS/Android** (PWA es buen primer paso, pero abre otro mercado) — roadmap 2026-2027
- [ ] Marketplace de entrenadores y planes (DorsalSwap y mi-dorsal confluyen)
- [ ] Carreras virtuales patrocinadas
- [ ] API pública (B2B) para organizadores que quieran integrar mi-dorsal
- [ ] Multi-currency en Stripe (si sales a Latam)
- [ ] Stripe Tax (re-activar `automatic_tax` con certificados EU)

### 4.2 Negocio

- [ ] **Evaluar migración a Stripe directo puro** (ya está, pero conviene desactivar Clerk Billing legacy)
- [ ] Plan familiar (5 corredores) si el individual valida
- [ ] Publicidad en `carreras/[slug]`: bloque "Material recomendado" según tipo y distancia
- [ ] Perfil: "Si quieres mejorar tu 10K, mira estas zapatillas"
- [ ] Email de resultados: sección "¡Felicidades! Mira estas recomendaciones"
- [ ] Escalar newsletter a 2.000 suscriptores (mes 6) → 5.000 (mes 12)
- [ ] Evaluar **Mediavine** si llegas a 50k sesiones/mes

### 4.3 Datos

- [ ] BigQuery export o similar para analizar patrones de uso
- [ ] Detección de dorsales duplicados cross-source (scripts ya existen)
- [ ] Enriquecer descripciones de carreras con texto original (mitigar "agregador" Google penalty)

---

## 🐛 Backlog técnico (deuda y bugs conocidos)

> Cosas que el equipo sabe que hay que tocar, pero no son prioridad hasta que duelan.

- [ ] Simplificar `/api/geo/region` cuando Vercel inyecte `x-vercel-ip-country-region` consistentemente
- [ ] Webhook legacy `app/api/webhooks/clerk-billing/route.ts` — candidato a borrar
- [ ] Cron `weekly-digest` (placeholder, decisión pendiente: implementar o borrar)
- [ ] TS2589 en Convex — `ctx: any` aplicado en 28 funciones. Vigilar regresiones
- [ ] Mojibake en archivos TS/TSX: si ves `â†’`, `â€`, etc., son UTF-8 leídos como Latin-1. **No commitear fixes sin verificar en el navegador**
- [ ] Permissions-Policy header: bug histórico resuelto, pero añadir test E2E que verifique que geolocation=(self) sigue activo
- [ ] Modales por debajo de mapas (z-index battle) — patrón de portal a `document.body` aplicado en `RegionSwitcher`, replicar si surge otro caso
- [ ] Strava null literal vs Convex v.optional — verificar todos los `getAction` de Strava con `null`

---

## ✅ Historial de tareas completadas (no se borra)

### Sprint 0 — cerrado 4 sep 2026

- [x] MVP funcional en producción
- [x] 2.761 carreras indexadas (creciendo)
- [x] Dominio `mi-dorsal.com` y `mi-dorsal.es` comprados y DNS configurados
- [x] 24 tablas en Convex, 7 crons
- [x] Detección automática del resultado oficial por dorsal (diferenciador)
- [x] Predicciones Daniels VDOT + Riegel
- [x] Diplomas PDF
- [x] Strava OAuth + Strava export (ZIP)
- [x] Newsletter single opt-in RGPD compliant (consentAt + consentIpHash)
- [x] Cron `check-results` con frecuencia adaptativa (aggressive/normal/sparse)
- [x] 11 secciones de la home con JSON-LD pre-serializado
- [x] Hamburguesa/panel móvil del header (regression resuelta 5 sep, commit `fe18841`)
- [x] Catálogo unificado multi-fuente (RFEA, FEDME, ITRA, Sportmaniacs, Runedia, Chiplevante)
- [x] Deep race extraction con IA
- [x] DorsalSwap MVP técnico completo (19 páginas + 8 tablas Convex, build limpio en 11s)

### Sprint billing — cerrado 8-9 sep 2026

- [x] Esqueleto de Clerk Billing listo (8 sep) — `subscriptions` table + Svix webhook + `/premium` y `/cuenta/suscripcion` + `<Paywall>` y `<PremiumBadge>`
- [x] Migración de Clerk Billing → Stripe directo (9 sep 2026)
  - Razón: Clerk Billing solo soporta USD y no tiene 3DS — incompatible con mercado EU
  - `/cuenta/suscripcion` reescrito contra `useHasPremium` + `postAndRedirect` a `/api/stripe/checkout`
  - Webhooks Clerk Billing marcados como legacy

### Sprint documentación — cerrado 8 sep 2026

- [x] `docs/BUSINESS_PLAN.md` + `docs/INFRA_ROADMAP.md` creados
- [x] `docs/plans/MONETIZATION_PLAN.md` actualizado con pricing 2,99 €
- [x] `docs/optional/future-iterations.md` mantenido
- [x] Plan multi-distancia aprobado (`docs/superpowers/plans/2026-09-09-multi-distancia-carreras.md`)

---

## 📚 Documentos relacionados (ir a la fuente para detalle)

| Tema | Doc |
|---|---|
| Arquitectura técnica completa | `docs/ARCHITECTURE.md` |
| Mapa de capacidad y saltos de plan | `docs/plans/INFRA_ROADMAP.md` |
| Modelado financiero y unit economics | `docs/plans/BUSINESS_PLAN.md` |
| Las 4 patas de monetización | `docs/plans/MONETIZATION_PLAN.md` |
| Runbook activación Stripe | `docs/BILLING_SETUP.md` (legacy) + `docs/STRIPE_INTEGRATION_TODO.md` (actual) |
| DorsalSwap estrategia | `docs/plans/DORSALSWAP_PLAN.md` |
| DorsalSwap MVP auditoría | `docs/plans/DORSALSWAP_MVP.md` |
| DorsalSwap legal y modelo | `docs/plans/INTERCAMBIO_DORSALES.md` |
| Plan multi-distancia | `docs/superpowers/plans/2026-09-09-multi-distancia-carreras.md` |
| Reglas del proyecto (anti-patrones) | `docs/core/anti-patterns.md` |
| Convenciones de código | `docs/core/stack.md` |
| Deploy checklist | `docs/core/deploy-checklist.md` |
| Newsletter y blog | `docs/core/blog-newsletter.md` |
| SEO | `docs/core/seo.md` |
| Naming y marca | `docs/history/naming-decisions.md`, `docs/history/brand-identity.md` |

---

## 📌 Cómo mantener este documento

1. **Al cerrar una tarea:** cambiar `[ ]` por `[x]` y mover a la sección "Historial".
2. **Al descubrir trabajo nuevo:** añadir a la sección del sprint correspondiente con su referencia.
3. **Si una tarea se atrasa:** moverla al sprint siguiente, **nunca** borrar.
4. **Revisión semanal:** los lunes, revisar Sprint 0-1 y mover lo que toque.
5. **Revisión mensual:** revisar Sprint 2-3 y Año 2; podar lo obsoleto.
6. **Si el doc se desactualiza**: regenerar desde este `ROADMAP.md` en lugar de los archivos viejos (mantener los otros docs como detalle de cada tema).

---

*Documento vivo. Editar y commitear con cuidado: usa `git add docs/ROADMAP.md` (nunca `git add -A`).*

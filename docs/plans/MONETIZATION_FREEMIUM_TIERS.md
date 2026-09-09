# Plan Freemium · mi-dorsal (v2, revisión 8 sep 2026)

> **Misión:** definir un tier Free y un tier de Pago lo más barato posible para el usuario, sostenibles con los costes reales de infraestructura y API que tiene mi-dorsal **hoy** (8 sep 2026), y competitivos frente a alternativas reales del corredor popular español.
>
> **Estado:** propuesta para discusión. **NO implementado todavía.**
> **Sustituye** a la v1 (7 sep) que subestimaba el valor de las features nuevas (entrenador IA, gear, splits, polyline) y sobrestimaba el coste del VDOT.
> **Volumen de modelado:** 1.000 / 5.000 / 20.000 usuarios registrados.
> **Próxima revisión:** tras 4 semanas con datos reales de `aiUsageLog` y Convex dashboard.

Este documento NO sustituye a `docs/MONETIZATION_PLAN.md` (4 patas: AdSense, afiliación, newsletter, freemium). Este es el **zoom sobre la Pata 4 (freemium)** con criterio de coste real y stack actual.

---

## TL;DR

- **Tier Free:** lo más generoso posible. Predicciones VDOT ilimitadas (cuestan $0), catálogo entero, Strava OAuth + 1 export, 3 PRs, 3 carreras en calendario, 3 diplomas históricos, newsletter. Suficiente para enamorar al corredor popular.
- **Tier Pro:** 2,99 €/mes o 24 €/año. Margen bruto ~85%. **Por debajo del techo de dolor (5 €/mes) y al precio de ClubRunning pero con más valor diferencial** (entrenador IA, diploma PDF, resultado oficial automático, predicciones VDOT, "hilo del corredor").
- **Features premium candidatas que YA EXISTEN** (no hay que construirlas, solo gatearlas): entrenador IA, gear tracking, splits chart, polyline map de actividades, hilo del corredor, comparativa con comunidad, alertas.
- **No incluir en v1:** plan familiar, white-label B2B, marketplace de planes. Year 2.
- **Próximo paso accionable:** validar pricing con 5-10 entrevistas (semana 1), luego setup de Stripe (semana 2), beta cerrada (semanas 6-8), lanzamiento público (semana 10).

---

## 1. Contexto actualizado: el proyecto ha cambiado

Esta v2 incorpora features implementadas **el 7-8 sep 2026** que no existían en la v1:

| Feature | Archivo | Estado | Implicación para monetización |
|---|---|---|---|
| **Entrenador IA con voz de club** | `lib/ai/coach-analysis.ts`, `convex/actions/coachAnalysis.ts`, `components/perfil/coach-analysis-card.tsx` | Producción | **Premium candidato #1.** Genera análisis narrativo de 350-550 palabras del registro Strava del usuario. Coste: ~€0.0006/llamada con gpt-4o-mini, gratis con MiniMax M3. |
| **Detección de intervalos (3 modos)** | `lib/training/detect-intervals.ts`, `convex/detectIntervalsBackfill.ts` | Producción | Cálculo puro local (laps + splits + nombre). **0 coste.** Sirve de input al entrenador IA. |
| **Gear tracking (zapatillas)** | `components/perfil/gear-card.tsx`, schema `gearId/gearName/gearDistanceM` en activities | Producción | Premium candidato. Umbral 800 km. |
| **Splits por km con gráfica** | `components/perfil/splits-chart.tsx` | Producción | Premium candidato. |
| **Polyline map de actividades** | `components/perfil/polyline-map.tsx`, `polyline-map-wrapper.tsx` | Producción | Premium candidato. |
| **Hilo del corredor (timeline)** | `components/calendario/hilo-timeline.tsx`, `hilo-node.tsx` | Producción | **Premium candidato narrativo**. Encaja con el "hilo que te une a tu dorsal". |
| **Strava OAuth + webhook en tiempo real** | `convex/stravaOauth.ts`, `actions/stravaWebhookHandler.ts` | Producción | Sustituye la "1 conexión" del plan anterior. Mejor dejarlo en free (es la base del grafo de datos). |
| **IA usage tracking con pricing por modelo** | `convex/aiUsageLog`, `lib/ai/pricing.ts`, `log-usage.ts` | Producción | Permite **medir el coste real por feature** y prevenir abuso. |
| **Convex Starter $10/mes con cap** | (dashboard) | Producción | Confirma que el coste base es ~$0-1/mes. |
| **Dominio propio `mi-dorsal.com` en producción** | AGENTS.md §13.3 | Producción | Activa AdSense (futuro) y elimina barrera para afiliados. |

**Implicación estratégica:** el producto tiene un arsenal de features premium que ya están construidas. La pregunta no es "qué construyo", es **"qué gateo sin matar la adquisición"**.

---

## 2. Coste real por usuario (actualizado, 8 sep 2026)

### 2.1 Coste por feature, calculado desde el código real

| Feature | Qué consume | Coste unitario (gpt-4o-mini) | Coste unitario (MiniMax M3) |
|---|---|---|---|
| Predicciones VDOT (Daniels) | Cálculo puro cliente (`lib/prediction/`) | **$0** | **$0** |
| Cálculo de paces / segmentos | Cálculo puro | **$0** | **$0** |
| Carruseles y fichas de carrera | Queries Convex (lectura) | ~$0.000001 / query | igual |
| **Extracción simple de carrera (admin)** | `gpt-4o-mini` temp 0.1, ~1500 input + 500 output | **$0.0003** | **$0** |
| **Extracción profunda de carrera (admin)** | `gpt-4o-mini` temp 0.2, ~16000 input + 3000 output | **$0.0042** | **$0** |
| **Entrenador IA (`coach_analysis`)** | `gpt-4o-mini` temp 0.6, ~2000 input + 800 output (350-550 palabras) | **$0.00077** | **$0** |
| Subir export Strava (ZIP) | Procesamiento Convex (storage + queries) | ~$0.001 / upload | igual |
| Sincronización Strava OAuth (webhook) | Action + queries | ~$0.0005 / sync | igual |
| Email transaccional | Resend | Gratis hasta 3k/mes, luego $0.40/1k | igual |
| Diploma PDF | `@react-pdf/renderer` serverless | ~$0.001 / render | igual |
| Auth | Clerk | Gratis hasta 10k MAU | igual |
| File storage (Strava exports) | Convex | $0.033/GB-mes | igual |

**Insight crítico (nuevo en v2):** el **entrenador IA** es la feature más cara de las nuevas, pero su coste por uso es **ridículamente bajo** (€0.0007/llamada). Incluso limitando a 4 llamadas/mes por usuario Pro, son **€0.003/usuario/mes** de coste IA. Esto cambia el pricing: **se puede dar más IA por menos dinero** del que la v1 sugería.

### 2.2 Coste variable por usuario activo al mes

Supuesto conservador: usuario Pro hace 4 análisis de entrenador IA + 10 emails extra + 5 diplomas extra + ~80 Convex calls extra.

| Concepto | Coste/usuario/mes |
|---|---|
| Convex function calls | $0.005 |
| Resend emails (10 extra) | $0.004 |
| Render diploma PDF (5 extra) | $0.005 |
| Vercel bandwidth | $0.002 |
| Stripe fee (fijo) | $0.30 / mes (mensual) o $0.30 / 12 = $0.025/mes prorrateado (anual) |
| IA entrenador (4/mes) | $0.003 |
| **TOTAL plan mensual** | **~$0.32/usuario/mes** |
| **TOTAL plan anual (prorrateado)** | **~$0.04/usuario/mes** |

**A 2,99 €/mes (mensual):** margen bruto = **2,67 €/usuario = 89%**.
**A 24 €/año = 2 €/mes prorrateado (anual):** margen bruto = **1,96 €/mes = 98%**.

El plan anual es **muchísimo más rentable** porque el fee de Stripe es único. **El push de venta debe ser el anual.**

### 2.3 Límites del tier free en plan Convex Starter ($10/mes)

Confirmado en AGENTS.md §15.1:
- 1M function calls/mes incluidos.
- 1 GB database bandwidth incluido.
- 0.5 GB database storage incluido.
- 1 GB file storage incluido.
- 1 GB egress/mes incluido.
- 20 GB-horas action compute incluido.

**A 5.000 usuarios activos con uso moderado (15 queries/sesión × 4 sesiones/mes):** ~300k calls/mes, 1.5 GB bandwidth/mes → **cabe en el cap de $10 con margen**. A 20k MAU empezamos a acercarnos al límite y habría que pasar a Professional ($25/mes fijo). Pero para v1 estamos bien.

---

## 3. Análisis de valor vs competencia (v2, con datos verificados)

### 3.1 Matriz de competidores

| Producto | Qué es | Precio | Fortaleza | Debilidad para mi-dorsal |
|---|---|---|---|---|
| **Strava** | Red social + tracking GPS | 5-12 €/mes (varía por fuente) | 100M+ usuarios, datos entrenamiento, segments | No español, no da resultados oficiales, no predice VDOT |
| **Garmin Connect+** | Plataforma de Garmin | 8,99 €/mes o 89,99 €/año | Integración nativa con su hardware, IA "Active Intelligence" | Solo si tienes Garmin, no español, no se centra en carreras |
| **Runna** | Plan de entrenamiento con IA | 14,99 €/mes (tras trial 7 días) | Plan adaptativo, muy pulido | Caro, no es español, no gestiona carreras |
| **Nike Run Club** | Tracking + coach | **Gratis** (sin premium) | 100% gratis, coach real | Sin plan personalizado, sin resultado oficial |
| **adidas Running** | Tracking + retos | 9,99 €/mes o 49,99 €/año | Simple, gamificado | Caro para lo que da, sin plan entrenamiento |
| **CorrerJuntos** (España, indie) | Red social para quedadas | 4,99 €/mes o 29,99 €/año | Grupos locales, coach IA (José/Ana) | Otro competidor indie español, mismo target |
| **ClubRunning Plus** | Calendario + Strava + resultados | **2 €/mes o 24 €/año** | **37.000 usuarios**, español, Strava sync | Catálogo más pequeño, sin newsletter editorial, sin IA de predicción, sin diploma PDF, sin resultado oficial automático |
| **RunMotion Coach** | Plan de entrenamiento con IA | 4,99-9,99 €/mes | Recomendado por Runedia, descuentos ClubRunning | Solo entrenamiento, no carreras |
| **CarrerasPopulares.com** | Medio editorial + calendario | Gratis (publicidad) | SEO brutal, marca conocida | Sin login, sin calendario personal, sin predicciones, no es producto |
| **Runedia** | Inscripciones + calendario | Gratis (B2B a organizadores) | Inscripciones integradas, comunidad grande | Sin foco en "ritual del dorsal", no trackea resultados al corredor |
| **Correbirras** | Foro + ranking 8D | Gratis | Comunidad, ranking 8D original | Foro puro, no app, no datos personales |
| **DorsalSwap** | Marketplace dorsales | Gratis (fee al vender) | Resuelve problema puntual | Una sola cosa, no retención |

### 3.2 Lo que mi-dorsal tiene que NADIE tiene (validado)

1. **Resultado oficial por email con diploma PDF** (tracking automático por dorsal). **Único en el mercado español.** Ni Strava, ni Garmin, ni ClubRunning lo hacen automáticamente. ClubRunning te lo da si subes export manual.
2. **Predicción VDOT calibrada con tu PR real**, mostrada en la ficha de la carrera que te interesa. Strava predice sobre actividad GPS, no sobre tu PR oficial.
3. **Newsletter propia con contenido editorial** ("Historias de dorsal") + doble opt-in RGPD.
4. **Catálogo SEO masivo** (374+ carreras indexadas, Schema.org SportsEvent) — ClubRunning no llega ni de lejos.
5. **Foco emocional** ("el hilo que te une a tu dorsal") vs foco técnico de Strava.
6. **Hilo del corredor** (timeline visual) + **entrenador IA con voz de club** — combinación única.

### 3.3 Lo que Strava/Garmin/Runna tienen que tú no

- Comunidad global (kudos, segments, leaderboards).
- Datos de entrenamiento y carga (Training Load, Readiness, VO2max).
- Integración con hardware.
- Marca establecida y base instalada.

**Implicación:** no compites en entrenamiento, no debes intentarlo. Tu diferencial es **el ritual del dorsal + la IA con voz de entrenador + el SEO español**.

### 3.4 Lo que ClubRunning tiene que tú también tienes que tener

- Sync Strava (✅ ya lo tienes, OAuth + export).
- Comparativas por edición (✅ los datos están en `personalRecords` con `achievedAt`).
- Estadísticas avanzadas y export Excel.
- 37.000 usuarios. **Tu techo de mercado realista.**

**Diferenciador para superar a ClubRunning:** entrenador IA + diploma PDF + newsletter editorial + resultado oficial automático + predicciones VDOT + hilo del corredor + gear tracking + splits chart. **Tienes 7-8 features que ClubRunning no tiene. Ese es tu pitch.**

### 3.5 Posicionamiento de precio

| Producto | Precio/mes | Por qué está a ese precio |
|---|---|---|
| Nike Run Club | **0 €** | Marca subsidia con el coaching, busca vender zapatillas |
| **ClubRunning Plus** | **2 €** | Indie español, catálogo decente, sin IA |
| **mi-dorsal Pro (propuesto)** | **2,99 €** | Por encima de ClubRunning, por debajo de CorrerJuntos (4,99 €), con 7-8 features que ClubRunning no tiene |
| CorrerJuntos | 4,99 € | Coach IA + quedadas, más social |
| Strava | 5-12 € | Marca global, segments, comunidad |
| Garmin Connect+ | 8,99 € | Solo si tienes Garmin |
| Runna | 14,99 € | Plan adaptativo muy pulido |

**Sweet spot para nosotros: 2,99 €/mes o 24 €/año.** Por encima de ClubRunning, justificado por features que ellos no tienen. Por debajo de CorrerJuntos y Strava, porque no somos coach ni red social.

---

## 4. Tier Free vs Tier Pro — propuesta v2

### 4.1 Principio rector (sin cambios respecto a v1)

"El free tiene que enamorar, el pago tiene que doler no tenerlo."

El corredor popular español:
- Tiene alta fricción al pago.
- Paga si le resuelves un problema que no puede resolver solo.
- **No paga por features que ya tiene en Strava gratis.**

Por eso el free es **muy generoso en contenido y predicciones** y **medido en todo lo que requiere IA, automatización, persistencia o integración premium**.

### 4.2 Tier Free ("Dorsal gratis")

**Sin paywall, sin tarjeta.**

| Feature | Free | Notas v2 |
|---|---|---|
| **Catálogo de carreras** (toda España) | ✅ Ilimitado | Tu SEO, no se toca. |
| **Búsqueda + filtros** (provincia, distancia, fecha, tipo) | ✅ | |
| **Ficha de carrera** (datos, avituallamientos, altimetría, mapa, inscripción) | ✅ | |
| **Votar carreras** (👍/👎) y sistema 8D | ✅ | Tu comunidad, no se toca. |
| **Newsletter "Historias de dorsal"** | ✅ | Tu canal de adquisición. |
| **Publicar valoraciones / comentarios** | ✅ | |
| **Perfil público con PRs** | ✅ | SEO long-tail, gratis. |
| **Predicciones VDOT** | ✅ **Ilimitadas** | **Coste $0, no limitar.** Es tu arma de retención. |
| **Sincronización Strava OAuth** | ✅ 1 conexión, sync activo | Sustituye la "1 conexión" de v1. Es la base del grafo. |
| **Sincronización Strava export (ZIP)** | ✅ 1 vez (histórico) | Re-subidas Pro. |
| **Calendario personal** | ✅ Hasta **5 carreras activas** | Mismo límite que v1, sweet spot. |
| **PRs manuales** | ✅ Hasta **3 PRs** | Mismo que v1 (5K, 10K, media). |
| **Recibir resultado por email** | ✅ Hasta **3 resultados históricos** | Mismo que v1. |
| **Diploma PDF descargable** | ✅ Para esos 3 | Mismo que v1. |
| **Detección de intervalos (laps/splits/nombre)** | ✅ | Cálculo puro, gratis. |
| **Actividad reciente (feed de Strava)** | ✅ 5 últimas | Vista rápida sin profundizar. |
| **Runner type (tags heurísticos)** | ✅ | Cálculo local, gratis. |
| **Soporte** | 🟡 Estándar (email, 48-72h) | |
| **Publicidad** (cuando se active AdSense) | 🟡 No intrusiva | |

### 4.3 Tier Pro ("Dorsal Pro") — todas las de Free, MÁS esto

**Pricing:**

| Plan | Precio | Ahorro | Equivalente mensual | Target |
|---|---|---|---|---|
| **Mensual** | **2,99 €/mes** | — | 2,99 € | Probar sin compromiso |
| **Anual** | **24 €/año** (≈ 1,67 €/mes promediado) | 33% vs mensual | 2,00 € | **Push principal** |
| **Familiar** (year 2) | **39 €/año** (4 corredores) | 35% | 3,25 €/cuenta | Year 2 con >500 Pro |

**Por qué este pricing (refinado vs v1):**
- 2,99 €/mes = por debajo del techo de dolor (5 €) y por encima de ClubRunning (2 €). Diferencia justificada por 7-8 features que ellos no tienen.
- 24 €/año = mismo precio que ClubRunning pero con **3-4x más valor diferencial**.
- **Anual como push principal**: el fee de Stripe es 1× y el LTV/coste es brutal.
- Familiar se difiere: la complejidad operativa (compartir, invitar, gestionar miembros) no compensa hasta tener 500+ Pro.

| Feature | Free | **Pro (2,99 €/mes)** |
|---|---|---|
| Calendario personal | 5 carreras activas | **∞** |
| PRs manuales | 3 PRs | **∞** |
| Resultados históricos con diploma PDF | 3 últimos | **∞ + descarga en bloque ZIP** |
| Sync Strava OAuth | 1 conexión | **Re-sync ilimitado + webhook tiempo real** |
| Strava export (ZIP) | 1 vez | **Re-subir ilimitado** |
| **🆕 Entrenador IA** ("Cómo te veo" / "Lo que cambiaría" / "Tu próximo objetivo") | ❌ | ✅ **4 regeneraciones/mes** |
| **🆕 Gear tracking (zapatillas)** con alertas de cambio a 800 km | ❌ | ✅ |
| **🆕 Splits por km con gráfica interactiva** | ❌ | ✅ |
| **🆕 Polyline map de actividades** (mapa Leaflet con el recorrido real) | ❌ | ✅ |
| **🆕 Hilo del corredor** (timeline visual con marcador "Hoy") | ❌ | ✅ |
| **🆕 Hilo anual retrospectivo** (resumen de toda la temporada con IA) | ❌ | ✅ (year 2) |
| Predicciones VDOT recalibradas al añadir PR | ∞ (con cache) | **∞ + recálculo automático en cada PR nuevo** |
| **Planificación inteligente de temporada** | ❌ | ✅ "Si tu PR en 10K es 45:00, estas 6 carreras encajan con tu nivel" |
| **Comparativa con la comunidad** | ❌ | ✅ Percentiles anónimos ("estás en el top 32% de corredores de tu edad con tu VDOT") |
| **Alertas personalizadas** | ❌ | ✅ "Nueva edición de la Behobia 2027 abierta / cambio de precio en la carrera X" |
| **Export a Google Calendar / Apple Calendar** | ❌ | ✅ 1 click |
| **Widget "Mis carreras" público** para blog | ❌ | ✅ iframe + OpenGraph |
| **Diploma PDF premium** (con foto, dorsal grande, branding) | Básico | **Personalizado** |
| **Export Excel del historial completo** | ❌ | ✅ |
| **Estadísticas avanzadas** (evolución PRs por año, comparativa ediciones) | ❌ | ✅ |
| Soporte prioritario | 48-72h | **24h** (incluso finde) |
| Sin publicidad (cuando se active AdSense) | Con ads | **Sin ads** |
| **Acceso anticipado a features nuevas** | ❌ | ✅ |
| **Descuento en DorsalSwap** (cuando se reactive) | — | ✅ (year 2) |

### 4.4 Lo que NUNCA va a ser de pago (decisión de producto, ratificada)

- ✅ **Catálogo de carreras**: 100% público y gratis. Tu SEO, tu tráfico, tu adquisición.
- ✅ **Búsqueda y filtros**: gratis.
- ✅ **Predicciones VDOT**: gratis e ilimitadas (cuestan $0).
- ✅ **Voto y sistema 8D**: gratis.
- ✅ **Newsletter editorial**: gratis.
- ✅ **Strava OAuth + 1 export**: gratis (es la base del grafo de datos del usuario).

**Regla de oro:** si monetizar X te corta tráfico SEO o engagement comunitario, X es gratis. Si monetizar X te da una historia que contar al usuario Pro, X es de pago.

### 4.5 Por qué 2,99 €/mes y no 1,99 € o 4,99 €

- **1,99 €/mes** igualaría el mensual de ClubRunning y perderíamos la justificación de "más valor". Riesgo: parecer alternativa barata sin diferenciación real.
- **4,99 €/mes** igualaría CorrerJuntos (que tiene coach IA) y perderíamos la batalla de percepción con un actor más grande.
- **2,99 €/mes** es el **sweet spot psicológico**: 1 € por encima de ClubRunning, 2 € por debajo de CorrerJuntos. Diferencia justificable con feature list visible en `/pro`.

---

## 5. Coste de implementación técnica (refinado)

### 5.1 Lo que hay que construir (3-4 semanas, 1 dev)

1. **Schema Convex** — nueva tabla `subscriptions` con `userId`, `plan`, `stripeCustomerId`, `stripeSubscriptionId`, `currentPeriodEnd`, `status` (active, canceled, past_due, trialing, paused). Índice `by_user` y `by_stripe_subscription_id`.
2. **Integración Clerk + Stripe** — usar **Clerk Billing** opcional o Stripe directo. **Recomendado: Stripe directo** (más control, fees más bajos, mejor para Europa).
3. **Webhook de Stripe** (`app/api/stripe/webhook/route.ts`) → Convex `internal.subscriptions.upsertFromStripe`. Validar firma con `STRIPE_WEBHOOK_SECRET`.
4. **Componente `<Paywall feature="...">`** — 3 estados: `allowed` / `locked-with-preview` / `paywall-modal`. **Reutilizar el patrón de onboarding welcome-overlay** para el modal.
5. **Página `/cuenta`** con suscripción actual, método de pago, facturas (link a Stripe Customer Portal), cancel.
6. **Página `/cuenta/suscripcion`** — upgrade/downgrade con Stripe Checkout.
7. **Página pública `/pro`** — landing con feature list, FAQ, pricing, social proof. **CRÍTICA** para SEO y conversión desde newsletter.
8. **Email transaccional de bienvenida al upgrade** (Resend, template nuevo).
9. **Banner contextual** en home/perfil cuando el usuario free está cerca del límite (5/5 carreras, 3/3 PRs, 3/3 diplomas) — CTA suave de upgrade.
10. **A/B test de precios** en el checkout (mensual vs anual destacado).
11. **Rate limiting en el entrenador IA** (4/mes) y en la regeneración de diplomas.

### 5.2 Esquema de la tabla `subscriptions` (propuesto)

```typescript
subscriptions: defineTable({
  userId: v.id("profiles"),                       // FK a profile
  plan: v.union(v.literal("monthly"), v.literal("annual")),
  status: v.union(
    v.literal("trialing"),
    v.literal("active"),
    v.literal("past_due"),
    v.literal("canceled"),
    v.literal("paused"),
  ),
  stripeCustomerId: v.string(),
  stripeSubscriptionId: v.string(),
  currentPeriodStart: v.number(),                 // Unix ms
  currentPeriodEnd: v.number(),
  cancelAtPeriodEnd: v.optional(v.boolean()),
  canceledAt: v.optional(v.number()),
  trialEndsAt: v.optional(v.number()),
  // Auditoría de uso IA para rate limiting
  aiAnalysisCount: v.optional(v.number()),        // resets monthly
  aiAnalysisResetAt: v.optional(v.number()),      // próximo reset
  // Metadata
  source: v.optional(v.string()),                 // "checkout" | "trial" | "admin" | "launch_promo"
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_stripe_subscription_id", ["stripeSubscriptionId"])
  .index("by_status", ["status"]),
```

### 5.3 Webhooks de Stripe a implementar

- `checkout.session.completed` → crear subscription en Convex.
- `customer.subscription.updated` → actualizar status, currentPeriodEnd.
- `customer.subscription.deleted` → marcar canceled.
- `invoice.paid` → resetear aiAnalysisCount.
- `invoice.payment_failed` → marcar past_due, enviar email de aviso.

### 5.4 Orden de implementación

1. **Semana 1:** validar pricing con 5-10 entrevistas (no skippear).
2. **Semana 2:** setup Stripe (productos `pro_monthly` 2,99 € y `pro_annual` 24 €), webhooks stub.
3. **Semana 3:** schema Convex + handler de webhooks + tabla subscriptions.
4. **Semana 4:** componente `<Paywall>` + páginas `/cuenta` y `/pro`.
5. **Semana 5:** emails transaccionales (Resend templates) + banners contextuales.
6. **Semana 6:** rate limiting del entrenador IA (4/mes) + reset mensual.
7. **Semana 7-8:** beta cerrada con 50-100 early adopters de la newsletter.
8. **Semana 9-10:** iteración sobre feedback + ajustes de pricing.
9. **Semana 11-12:** lanzamiento público con oferta launch 19 €/año.

---

## 6. Proyección de ingresos (actualizada)

| Usuarios registrados | Conversión Pro | Suscriptores Pro | MRR (mensual) | ARR (anual) |
|---|---|---|---|---|
| 1.000 | 3-5% (realista nicho fitness) | 30-50 | **90-150 €** | **1.080-1.800 €** |
| 5.000 | 3-5% | 150-250 | **450-750 €** | **5.400-9.000 €** |
| 20.000 | 3-5% | 600-1.000 | **1.800-3.000 €** | **21.600-36.000 €** |

**Asunción de mix anual/mensual en Pro:**
- Year 1: 60% anual / 40% mensual.
- Year 2: 75% anual / 25% mensual (tras ver que los mensuales tienen más churn).

**Combinado con las otras 3 patas (AdSense + afiliación + newsletter patrocinada)**, la proyección total a 12 meses se alinea con `docs/MONETIZATION_PLAN.md` escenario "Esperado" (€800-1.800/mes) → "Bueno" (€2.500-5.000/mes) si Pro tira.

---

## 7. Estrategia de lanzamiento (90 días, revisada)

### Fase 0 (semana 1-2): validación y setup

- [ ] **Validar pricing con 5-10 corredores del target** (entrevista 30 min, pregunta exacta: *"¿Pagarías 2,99 €/mes o 24 €/año por [lista de features Pro]? ¿Cuál es la feature que más te dolería no tener?"*). **CRÍTICO. No skippear.**
- [ ] Decidir stack: **Stripe directo** (recomendado) vs Clerk Billing (más rápido, menos control).
- [ ] Crear productos en Stripe dashboard: `pro_monthly` 2,99 € y `pro_annual` 24 €.
- [ ] Diseñar UX del paywall (modal) y del upgrade modal. **No genérico: muestra screenshots reales de las features Pro con un usuario demo.**

### Fase 1 (semana 3-5): implementación core

- [ ] Tabla `subscriptions` en Convex + `internal.subscriptions.upsertFromStripe`.
- [ ] Webhook handler `/api/stripe/webhook/route.ts` con validación de firma.
- [ ] Componente `<Paywall feature="...">` con 3 estados.
- [ ] Páginas `/cuenta` y `/cuenta/suscripcion`.
- [ ] Página pública `/pro` con landing SEO-friendly (keywords: "app runner español", "resultado oficial dorsal", "predicción tiempo 10K").

### Fase 2 (semana 6-7): feature gating

- [ ] Aplicar `<Paywall>` a: calendario>5, PRs>3, resultados>3, export ZIP, alertas, export calendario, widget público, comparativa, entrenador IA, gear card, splits chart, polyline map.
- [ ] **NO** aplicar a: predicciones, catálogo, voto, 8D, newsletter.
- [ ] Rate limiting del entrenador IA: 4/mes para Pro, 0/mes para Free (con 1 free trial).
- [ ] Banners contextuales cuando free está cerca del límite ("4/5 carreras en calendario, te queda 1 — Pro").

### Fase 3 (semana 8-9): beta cerrada

- [ ] 50-100 usuarios early adopters (lista newsletter + comunidad).
- [ ] **Trial de 30 días sin tarjeta** (`status: "trialing"` en Convex).
- [ ] Recoger feedback: ¿qué features usan más? ¿cuáles no? ¿qué les falta?
- [ ] Ajustar pricing y feature set si hace falta.

### Fase 4 (semana 10-12): lanzamiento público

- [ ] Anuncio en newsletter, redes (@midorsal), Product Hunt.
- [ ] **Oferta launch: 19 €/año el primer año** (en vez de 24 €) — solo para los primeros 200. Crea urgencia + early adopters.
- [ ] Post en blog "Por qué Pro cuesta 2 € al mes y no 5 €" (transparencia sobre costes, ya tienes la data en `aiUsageLog`).
- [ ] Programa de referidos: "1 mes gratis por cada amigo que se haga Pro" (year 2).

---

## 8. Riesgos y mitigaciones (revisados)

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| **Conversión <1%** | Media | Alto | Trial 30 días sin tarjeta + medir uso real de features Pro en beta + ajustar según feedback |
| **Churn >10%/mes** | Alta | Alto | **Onboarding crítico**: el "wow moment" en los primeros 5-7 días (subir Strava → 1ª predicción calibrada → 1er diploma → 1er análisis IA). Si no llega, churn seguro. |
| **ClubRunning reacciona** (baja precio, añade features) | Media | Medio | Diferenciador en IA + diploma PDF + newsletter + SEO. No compitas en precio, compite en **valor emocional + features únicas**. |
| **CorrerJuntos entra en el segmento de carreras** | Baja | Medio | CorrerJuntos es más social/quedadas. Tu diferencial es el dorsal/resultado. Coexistencia posible. |
| **Strava copia "resultado oficial por dorsal"** | Muy baja | Alto | Tu SEO + email + comunidad ya están construidos. Strava no tiene foco español ni "ritual del dorsal". |
| **Usuarios free sienten que pierden features clave** | Media | Medio | Predicciones infinitas gratis + catálogo entero gratis. El paywall solo bloquea "valor generado por uso repetido / IA". |
| **Abuso del entrenador IA** (alguien automatiza 1000 calls/mes) | Media | Medio | Rate limiting 4/mes para Pro + monitoreo en `aiUsageLog` + alert si una cuenta >$1/mes en IA. |
| **Coste IA se dispara** si muchos Pro usan mucho entrenador IA | Baja | Bajo | A 4 calls/mes × €0.0007 = €0.003/usuario/mes. 1.000 Pro = €3/mes. Insignificante. |
| **Problemas con RGPD al cobrar** | Baja | Medio | Stripe cumple PCI-DSS. Clerk maneja datos. Solo guardar `stripeCustomerId` y `stripeSubscriptionId` en Convex. **No guardar tarjeta.** |
| **Stripe fee mata margen en micro-importes** | Baja | Bajo | €0,30/mes en plan mensual. Por eso el **push de venta debe ser el anual**. |
| **Soporte se inunda** con "no me deja guardar la 6ª carrera" | Alta | Bajo | Banner explicativo + FAQ en `/pro` + email automático "has alcanzado el límite free, actualiza". |
| **Cap de Convex $10/mes se queda corto** | Baja (v1) → Media (v2 con 20k MAU) | Medio | Plan Professional $25/mes cuando se acerque. Migración es solo cambiar el cap. |
| **Convex deploy typecheck bloquea release** | Conocida | Medio | Aplicar workaround documentado en AGENTS.md §15.3 (`ctx: any`, `as const`, `as any`). |

---

## 9. Métricas para saber si va bien

| KPI | Meta mes 3 | Meta mes 6 | Meta mes 12 |
|---|---|---|---|
| Trial starts | 200 | 800 | 3.000 |
| Trial → paid conversion | 15% | 20% | 25% |
| Suscriptores Pro activos | 30 | 100 | 350 |
| MRR | 90 € | 300 € | 1.000 € |
| ARR | 1.080 € | 3.600 € | 12.000 € |
| Churn mensual | <8% | <6% | <5% |
| ARPU | 2,50 € | 2,50 € | 2,50 € |
| LTV medio (a 5% churn) | 50 € | 50 € | 50 € |
| Ratio anual/mensual | 60/40 | 70/30 | 75/25 |
| **CAC (coste de adquirir un Pro)** | <5 € | <8 € | <10 € |
| **LTV/CAC** | **>10x** | **>6x** | **>5x** |
| **Entrenador IA usage/Pro/mes** | 2-3 | 3-4 | 3-4 |
| **aiUsageLog costEur/mes** | <$5 | <$15 | <$50 |

**Alerta roja si en mes 3:**
- <50 trial starts → la propuesta de valor no llega (revisar copy, banner, email, `/pro`).
- Conversión trial → paid <5% → la entrega de valor en los primeros 7 días falla.
- Churn >15% → el producto no retiene (revisar features, soporte, onboarding).
- aiUsageLog costEur >$50/mes con <100 Pro → algún usuario abusa del entrenador IA, activar rate limiting inmediato.

---

## 10. Top 5 acciones para empezar esta semana

1. **Validar el pricing con 5-10 corredores reales** (2 h, total). Pregunta exacta: *"¿Pagarías 2,99 €/mes o 24 €/año por [lista de features Pro]? ¿Cuál es la que más te dolería no tener?"*. Sin esto, construyes a ciegas.

2. **Crear cuenta de Stripe + productos** (30 min). Dashboard: `pro_monthly` 2,99 € y `pro_annual` 24 €. Webhook endpoint stub todavía no, pero deja la config lista.

3. **Diseñar el onboarding Pro** (1 tarde). El usuario que se apunta a Pro debe tener su "wow moment" en los primeros 5 minutos: sube Strava → 1ª predicción calibrada → 1er diploma histórico → 1er análisis del entrenador IA → sugerencia de 3 carreras para su nivel. **Si esto no pasa, el churn es altísimo.**

4. **Escribir la landing `/pro`** (1 día). No técnica: emocional. "Por 2 € al mes, deja de buscar tus resultados como un poseso. Te llegan al buzón con tu diploma, y un entrenador con 20 años de experiencia te dice cómo estás entrenando de verdad."

5. **Escribir el post del blog "Por qué Pro cuesta 2 € al mes y no 5 €"** (3-4 h). Transparente: "esto es lo que cuesta, esto es lo que ofrecemos, este es nuestro margen". Tienes la data exacta en `aiUsageLog` para demostrarlo. La honestidad es tu mejor marketing en este nicho.

---

## 11. Decisión recomendada (resumen ejecutivo, v2)

**Implementar tier Pro a 2,99 €/mes o 24 €/año**, con todo el contenido (catálogo, predicciones, newsletter, voto) gratis, y paywall solo en features premium que ya tienes construidas:

- **Entrenador IA** (4 regeneraciones/mes)
- **Gear tracking con alertas**
- **Splits chart + polyline map** de actividades
- **Hilo del corredor** (timeline visual)
- **Calendario >5 carreras**
- **PRs >3**
- **Resultados históricos completos**
- **Diploma PDF descargable en bloque**
- **Alertas personalizadas**
- **Export a calendarios externos**
- **Estadísticas avanzadas + export Excel**
- **Widget público**
- **Comparativa con comunidad**
- **Sync Strava ilimitado + webhook tiempo real**

**Por qué este pricing y no el del plan general (5-12 €/mes):**
- El corredor popular español no es el cliente de Strava ni de Garmin. Tiene otro techo de dolor (5 €/mes).
- ClubRunning (2 €/mes, 37k usuarios) y CorrerJuntos (4,99 €/mes) marcan el rango. **2,99 € nos coloca entre los dos con un claro "más que ClubRunning, menos que CorrerJuntos".**
- El margen al 85-98% es brutal a este precio. **No necesitas volumen para ser rentable.** Un solo Pro ya cubre su coste.
- La newsletter + SEO + comunidad siguen siendo el motor de adquisición. **Pro es la consecuencia, no el motor.**

**No incluir en v1:**
- Plan familiar (year 2, no antes de 500 Pro).
- Plan mensual + anual con prueba social (year 2, cuando tengas testimonios reales).
- White-label B2B a organizadores (year 3, vía marketplace DorsalSwap reactivado).
- Marketplace de planes de entrenamiento (post-core, year 2-3).

**Apalancarse en lo ya construido (NO construir nada nuevo para v1):**
- ✅ `lib/ai/coach-analysis.ts` → gatear con `<Paywall>` + rate limit 4/mes.
- ✅ `components/perfil/gear-card.tsx` → gatear.
- ✅ `components/perfil/splits-chart.tsx` → gatear.
- ✅ `components/perfil/polyline-map.tsx` → gatear.
- ✅ `components/calendario/hilo-timeline.tsx` → gatear.
- ✅ Predicciones VDOT → **NO GATEAR** (es tu arma de retención).
- ✅ Newsletter + blog → **NO GATEAR** (es tu motor de adquisición).
- ✅ `dorsal-swap-widget.tsx` (existente) → **NO GATEAR en v1**, dejarlo como feature futura Pro.

---

## 12. Diferencias clave con v1 (7 sep 2026)

| Aspecto | v1 | v2 |
|---|---|---|
| Features premium candidatas | 9 features, mayoría a construir | **15+ features, ya construidas** (entrenador IA, gear, splits, polyline, hilo) |
| Coste IA asumido | ~$0.001/usuario/mes (sin contar coach) | ~$0.003/usuario/mes (incluye 4 calls de coach/mes) |
| Competidores identificados | Strava, Garmin, ClubRunning, Runedia | + **CorrerJuntos, RunMotion Coach, adidas Running, Runna** |
| Tamaño de ClubRunning | "indie español" | **37.000 usuarios**, actor principal del nicho |
| Pricing propuesto | 2,99 €/mes o 24 €/año | **Igual**, pero con **anual como push principal** (mejor margen) |
| Cap de Convex | Free plan | **Starter $10/mes** con cap |
| Tabla `subscriptions` | Conceptual | **Schema completo** propuesto con `aiAnalysisCount` para rate limiting |
| Webhook handlers | Lista genérica | **5 eventos específicos** de Stripe con su handler |
| Stack de pagos | "Stripe vs Lemon Squeezy vs Paddle" | **Stripe directo recomendado** |
| Riesgos | 8 | **13** (añadidos: abuse IA, cap Convex, typecheck deploy) |
| Métricas | 9 KPIs | **13 KPIs** (añadidos: usage IA, costEur, ARPU, LTV) |

---

## 13. Referencias y decisiones vinculadas

- **ClubRunning Plus:** 2 €/mes o 24 €/año, **37.000 usuarios** (verificado 7 sep 2026). Es el competidor principal en el nicho español indie. **NO superar sin diferenciador claro.**
- **CorrerJuntos:** 4,99 €/mes o 29,99 €/año. Coach IA + quedadas. Competidor con foco social.
- **Strava España:** 5-12 €/mes según fuente. **NO es tu competencia directa** (Strava = entrenamiento, mi-dorsal = dorsal).
- **Garmin Connect+ España:** 8,99 €/mes o 89,99 €/año. Solo si tienes Garmin. NO es tu competencia.
- **Runna:** 14,99 €/mes. Plan adaptativo. Out of category (caro).
- **Gasto medio corredor popular:** 39,6 €/mes en deporte (estudio SEMED-Cinfa). Tu Pro a 2,99 €/mes es el 7,5% de ese gasto.
- **Conversión freemium nicho fitness:** 2-7% según ProductLed, ProfitWell, OpenView. Asumimos 3-5% en year 1.
- **Stripe España:** fee 1,4% + 0,30 € para tarjetas EU estándar. Asumimos 0,30 € fijo por transacción.
- **Coste IA gpt-4o-mini** (verificado en `lib/ai/pricing.ts`): $0,15/1M input, $0,60/1M output.
- **Coste IA MiniMax M3** (verificado en `lib/ai/pricing.ts`): $0 input, $0 output (gratis vía Maverick).
- **Coste Entrenador IA** (350-550 palabras, temp 0.6): **€0.0007/llamada** con gpt-4o-mini.
- **Coste Extracción profunda** (~16k input + 3k output): **€0.003/llamada** con gpt-4o-mini.
- **Convex Starter** (verificado en AGENTS.md §15.1): $10/mes cap. Suficiente hasta ~20k MAU.
- **Vercel hobby plan**: gratis hasta 100 GB bandwidth. Vigilar con vídeos del diploma PDF.
- **Clerk free**: hasta 10k MAU. Suficiente para v1.
- **Resend free**: hasta 3k emails/mes. Suficiente para v1; pasar a paid a 5k+ Pro.

---

*Esta v2 corrige la v1 incorporando las features implementadas el 7-8 sep 2026 (entrenador IA, gear, splits, polyline, hilo) y los costes reales calculados desde `lib/ai/pricing.ts` y `aiUsageLog`. El objetivo realista de year 1 con Pro es **500-1.500 € MRR combinado con AdSense + afiliación + newsletter patrocinada = 2.000-4.000 €/mes total** (alineado con el escenario "Bueno" de `docs/MONETIZATION_PLAN.md`).*

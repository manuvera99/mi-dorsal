# Plan Freemium · mi-dorsal

> **Misión:** definir un tier Free y un tier de Pago lo más barato posible para el usuario, sostenibles con los costes reales de infraestructura y API que tiene mi-dorsal hoy, y competitivos frente a alternativas reales del corredor popular español.
>
> **Última revisión:** 7 de septiembre de 2026
> **Estado:** propuesta para discusión (NO implementado todavía)
> **Supuestos sobre volumen:** se modela con 1.000, 5.000 y 20.000 usuarios registrados.

Este documento NO sustituye a `docs/MONETIZATION_PLAN.md` (que cubre las 4 patas: AdSense, afiliación, newsletter patrocinada, freemium). Este es el **zoom sobre la Pata 4 (freemium)** con criterio de coste real.

---

## 1. Contexto: por qué un plan de "lo más barato posible"

### 1.1 Perfil del corredor popular español (audiencia real)

- Gasto medio en deporte: **39,6 €/mes** (estudio SEMED–Cinfa). Pero la mayor parte se va en material (zapatillas, geles, fisio).
- Apps de fitness en Europa convierten bien entre **3-5 €/mes**. Por encima de 7 €/mes el corredor popular ya compara con Strava o Garmin.
- El corredor popular **ya paga Strava (5 €/mes)** si es medio serio. Si le cobramos por algo que **no resuelve su dolor principal** (entrenamiento), no va a pagar.
- **Conclusión:** el techo de precio realista para mi-dorsal es **2-4 €/mes** o **20-35 €/año**. Por encima pierde contra ClubRunning (2 €/mes) o parece "otra app de entreno".

### 1.2 Coste real por usuario (coste variable)

He revisado el código de `lib/ai/`, `convex/`, `components/` y los providers que usas. Resumen de lo que consume cada feature de mi-dorsal:

| Feature | Qué consume | Coste unitario |
|---|---|---|
| Predicciones VDOT (Daniels) | Cálculo puro cliente (`lib/prediction/daniels-vdot.ts`, `lib/prediction/predict.ts`) | **0 €** |
| Cálculo de paces / segmento | Cálculo puro | **0 €** |
| Carruseles y fichas de carrera | Queries Convex (lectura) | ~$0.000001 / query |
| Subir export Strava (ZIP) | Procesamiento en Convex (storage + queries) | ~$0.001 / upload |
| Sincronización Strava OAuth | Webhook + queries | ~$0.0005 / sync |
| **Extracción profunda de carrera (IA)** | `gpt-4o-mini` o MiniMax M3, ~16k input + 2-4k output | **$0.0001-0.0003** con gpt-4o-mini · **GRATIS** con MiniMax M3 |
| Email transaccional | Resend | Gratis hasta 3k/mes, luego $0.40/1k |
| Diploma PDF | `@react-pdf/renderer` serverless | ~$0.001 / render |
| Auth | Clerk | Gratis hasta 10k MAU |

**Detalle crítico:** las predicciones VDOT son **cálculo matemático local**, no consumen tokens. Lo único que **realmente cuesta dinero por uso** es la extracción profunda con IA. Eso cambia la economía: puedes regalar predicciones ilimitadas sin que suba tu coste.

**Estrategia de coste IA:**
- Dev: MiniMax M3 (gratis, configurable vía `OPENAI_BASE_URL`).
- Prod: gpt-4o-mini (~$0.15/1M input, $0.60/1M output). A 16k input + 3k output ≈ **$0.003/carrera**. Si un usuario hace 5 extracciones/mes, son $0.015/mes. Con 1000 usuarios premium haciendo todos 5/mes = $15/mes totales.
- A escala (20k usuarios), la IA sigue siendo <$100/mes si lo limitas a premium. No es un problema de coste, es de abuse prevention.

**Convex free tier:** 1M function calls/mes. Una home carga ~10-15 queries. A 5k usuarios con 2 visitas/mes = 150k calls. **Cabe holgado en free hasta ~20k MAU.**

**Resend free tier:** 3.000 emails/mes. El cron de recordatorios + resultados + welcome + digest puede comer esto rápido. Si creces, pagas ~$20/mes en 50k emails.

**Vercel free tier:** OK hasta 100GB bandwidth. La home + carreras pueden comer 30-50GB/mes con 20k MAU. Vigilar.

**Síntesis: el coste variable por usuario activo está entre $0.01-0.05/mes.** Eso permite cobrar **2 €/mes con un margen del 95%+**.

---

## 2. Análisis de valor vs competencia

### 2.1 Matriz de competidores directos e indirectos

| Producto | Qué es | Precio | Fortaleza | Debilidad para mi-dorsal |
|---|---|---|---|---|
| **Strava** | Red social + tracking GPS | 5 €/mes (individual) | Comunidad enorme, datos entrenamiento | No es del "dorsal español", no da resultados oficiales, no predice VDOT |
| **Garmin Connect+** | Plataforma del reloj Garmin | 8,99 €/mes | Integración nativa con su hardware | Solo sirve si tienes Garmin, no español, no se centra en carreras |
| **ClubRunning** | Calendario + Strava + resultados (competidor directo) | **2 €/mes o 24 €/año** | Precio agresivo, español, Strava sync | Catálogo más pequeño, sin newsletter propia, sin IA de predicción |
| **CarrerasPopulares.com** | Medio editorial + calendario | Gratis (publicidad) | SEO brutal, marca conocida | Sin login, sin calendario personal, sin predicciones, no es producto |
| **Runedia** | Inscripciones + calendario | Gratis (B2B a organizadores) | Inscripciones integradas, comunidad | Sin foco en el "ritual del dorsal", sin trackeo de resultados al corredor |
| **Correbirras** | Foro + ranking 8D | Gratis | Comunidad, ranking 8D original | Foro puro, no app, no datos personales |
| **DorsalSwap** | Marketplace de dorsales | Gratis (fee al vender) | Resuelve problema puntual | Una sola cosa, no retención |
| **BuscoDorsal / Dorsal1 / Dorsal21** | Fotos / cronometradores | Gratis / por evento | Servicio concreto | No producto, solo web auxiliar |

### 2.2 Lo que mi-dorsal tiene que NADIE tiene

1. **Resultado oficial por email con diploma PDF** (tracking automático por dorsal). **Único en el mercado español.** Strava no lo hace, Garmin no lo hace, ClubRunning lo hace solo si subes export manual.
2. **Predicción VDOT calibrada con tu PR real**, mostrada en la ficha de la carrera que te interesa. Strava te predice sobre tu actividad GPS, no sobre tu PR oficial.
3. **Newsletter propia con contenido editorial del dorsal** ("Historias de dorsal") + lead magnet.
4. **Catálogo SEO masivo** (374+ carreras indexadas, Schema.org SportsEvent) → tráfico orgánico que los demás no tienen.
5. **Foco emocional** ("el hilo que te une a tu dorsal") vs el foco técnico de Strava. Esto retiene emocionalmente, no por features.
6. **Cubre toda España** (no solo Levante), con detalle de avituallamientos, altimetrías, tramos de precio.

### 2.3 Lo que Strava/Garmin tienen que tú no

- Comunidad global (kudos, segments, leaderboards).
- Datos de entrenamiento y carga (Training Load, Readiness, etc.).
- Integración con su hardware (Garmin watches, etc.).

**Implicación estratégica:** no puedes competir en entrenamiento, y no debes intentarlo. Tu diferencial es **el ritual del dorsal**: apuntarte, predecir, correr, recibir resultado. Eso es lo que cobras.

### 2.4 Lo que ClubRunning tiene que tú también tendrás que tener

- Sync Strava (ya lo tienes via OAuth + export).
- Comparativas por edición (ya hay datos en tu `personalRecords` con `achievedAt`).
- Estadísticas avanzadas y export Excel.

**Diferenciador para superar a ClubRunning:** IA de predicción calibrada + diploma PDF + newsletter editorial + resultado oficial automático. **Las 4 cosas que ClubRunning no tiene.**

---

## 3. Tier Free vs Tier de Pago — propuesta

### 3.1 Principio rector: "el free tiene que enamorar, el pago tiene que doler no tenerlo"

El corredor popular español:
- Tiene un nivel de "fricción al pago" alto (cultura: "Strava gratis me vale").
- **Paga si le resuelves un problema concreto que no puede resolver solo.**
- **No paga por features técnicas que ya tiene en Strava.**

Por eso el free debe ser **muy generoso en todo lo que es "contenido"** y **medido en todo lo que es "valor generado por IA o automatización"**. Lo gratis te trae; lo de pago te retiene y monetiza.

### 3.2 Tier Free ("Calcetines")

**Nombre interno:** `Free / Dorsal gratis` — sin paywall, sin tarjeta.

| Feature | Free |
|---|---|
| **Catálogo de carreras** (toda España) | ✅ Ilimitado |
| **Búsqueda + filtros** (provincia, distancia, fecha, tipo) | ✅ |
| **Ficha de carrera** (datos, avituallamientos, altimetría, mapa, inscripción) | ✅ |
| **Votar carreras** (👍/👎) | ✅ |
| **Sistema 8D** (votación sliders) | ✅ |
| **Calendario personal** (marcar carreras) | ✅ Hasta **5 carreras activas** (límite soft) |
| **PRs manuales** | ✅ Hasta **3 PRs** |
| **Predicciones VDOT** | ✅ **Ilimitadas** (cálculo local, 0 coste) |
| **Sincronización Strava OAuth** | ✅ 1 conexión |
| **Sincronización Strava export (ZIP)** | ✅ 1 vez (para siempre) |
| **Recibir resultado por email** | ✅ Hasta **3 resultados históricos** |
| **Diploma PDF descargable** | ✅ Para esos 3 primeros resultados |
| **Newsletter "Historias de dorsal"** | ✅ Gratis |
| **Publicar valoraciones / comentarios** | ✅ |
| **Perfil público con PRs** | ✅ |
| **Soporte** | 🟡 Estándar (email, 48-72h) |
| **Publicidad en la app** (si se activa AdSense) | 🟡 No intrusiva |

**Por qué estos límites concretos:**

- **5 carreras en calendario** ≈ 1 temporada amateur. Si quiere más, ya tiene 5-10 carreras en el año, el corredor serio. Es el sweet spot entre "vale, lo uso en serio" y "necesito más".
- **3 PRs** = las 3 distancias canónicas (5K, 10K, media). Más que eso, es corredor serio o élite. Distinto segmento.
- **3 resultados históricos**: ya tienes el "wow effect" del primer resultado oficial con diploma. Si quiere ver todo su historial completo, ahí está el paywall.
- **Predicciones ILIMITADAS gratis**: porque cuestan $0. Limitar esto sería regalar margen. Es tu arma de retención. Que predigan 50 veces al mes, qué más da.

### 3.3 Tier de Pago ("Zapatillas")

**Nombre interno:** `Pro / Dorsal Pro`.

**Pricing recomendado:**

| Plan | Precio | Ahorro | Equivalente mensual | Target |
|---|---|---|---|---|
| **Mensual** | **2,99 €/mes** | — | 2,99 € | Probar sin compromiso |
| **Anual** | **24 €/año** (≈ 1,67 €/mes promediado) | 33% vs mensual | 2,00 € | Corredor comprometido (target principal) |
| **Familiar** | **39 €/año** (hasta 4 corredores) | 35% vs 4 individuales | 3,25 € por cuenta | Parejas / clubs pequeños (year 2) |

**Por qué estos precios concretos:**

- **2,99 €/mes** está 1 € por debajo de ClubRunning Plus (2 €/mes × 12 = 24 €/año, mismo precio anual), pero ofrezcas más valor diferencial.
- **24 €/año** iguala el precio de ClubRunning, así que **tienes que justificar la diferencia con features que ClubRunning no tiene** (predicción IA, diploma PDF, resultado oficial, newsletter editorial).
- **3 €/mes está por debajo del dolor**: 1 café + 1 barrita. No es "otra suscripción" psicológica, es "el capricho del mes".
- **Por encima de 5 €/mes** ya compites con Strava y pierdes. **NO subir de 3,99 €/mes** en v1. Si necesitas más margen, subes en v2 cuando el valor esté demostrado.
- **Plan familiar** es **opcional en year 2** (no implementar hasta tener >500 suscriptores individuales). Añadir familiar antes es complejidad sin revenue.

### 3.4 Qué entra en Pro (todo lo de Free, MÁS esto)

| Feature | Free | **Pro (2,99 €/mes)** |
|---|---|---|
| Calendario personal | 5 carreras activas | **∞** |
| PRs manuales | 3 PRs | **∞** |
| Resultados históricos con diploma PDF | 3 últimos | **∞** + descarga en bloque ZIP |
| Predicciones VDOT | ∞ | ∞ + **recalibrado continuo** (cuando añades nuevo PR) |
| Sincronización Strava OAuth | 1 conexión | **Re-sync ilimitado + webhooks en tiempo real** |
| Strava export (ZIP) | 1 vez | **Re-subir ilimitado** (cambias de reloj, vuelves a subir) |
| **Planificación inteligente de temporada** | ❌ | ✅ "Si tu PR en 10K es 45:00, estas 6 carreras encajan con tu nivel" |
| **Comparativa con la comunidad** | ❌ | ✅ "¿En qué posición estarías respecto a corredores similares?" (percentiles anónimos) |
| **Alertas personalizadas** | ❌ | ✅ "Nueva edición de la Behobia 2027 abierta / cambio de precio en la carrera X" |
| **Export a Google Calendar / Apple Calendar** | ❌ | ✅ 1 click |
| **Widget "Mis carreras" para tu web/blog** | ❌ | ✅ iframe + OpenGraph |
| **Diploma PDF premium** (con tu foto, dorsal grande, branding) | Básico | **Personalizado** (foto, dorsal destacado, marcos de temporada) |
| **Estadísticas avanzadas** (evolución PRs por año, splits por km) | ❌ | ✅ Gráficas interactivas |
| **Soporte prioritario** | 48-72h | **24h** (incluso fin de semana) |
| **Sin publicidad** (cuando se active AdSense) | Con ads | **Sin ads** |
| **Acceso anticipado a features nuevas** | ❌ | ✅ |

### 3.5 Lo que NUNCA va a ser de pago (decision de producto)

- ✅ El **catálogo de carreras** sigue siendo 100% público y gratis para todos. Es tu SEO, tu tráfico, tu adquisición. Monetizar esto sería cortarte la rama.
- ✅ La **búsqueda y filtros** son gratis. Es la base del producto.
- ✅ Las **predicciones VDOT** son gratis e ilimitadas. Son tu arma de retención y no cuestan dinero.
- ✅ El **voto 👍/👎 y sistema 8D** es gratis. Es tu mecanismo de comunidad.
- ✅ La **newsletter editorial** es gratis. Es tu canal de adquisición y branding.

**Regla de oro:** si monetizar X te corta el tráfico SEO o el engagement comunitario, X es gratis.

---

## 4. Coste de implementación técnica

### 4.1 Lo que hay que construir (3-4 semanas, 1 dev)

1. **Schema Convex** — nueva tabla `subscriptions` con `userId`, `plan`, `stripeCustomerId`, `stripeSubscriptionId`, `currentPeriodEnd`, `status` (active, canceled, past_due, trialing).
2. **Integración Clerk + Stripe** — Clerk Organizations / billing metadata + Stripe Customer Portal.
3. **Webhook de Stripe** (`/api/stripe/webhook`) → Convex `internal.subscriptions.upsertFromStripe`.
4. **Componente `<Paywall feature="...">`** que envuelve features premium. Tres estados: `allowed` / `locked-with-preview` / `paywall-modal`.
5. **Página `/cuenta`** con suscripción actual, método de pago, facturas, cancel.
6. **Página `/cuenta/suscripcion`** — upgrade/downgrade con Stripe Checkout.
7. **Email transaccional de bienvenida al upgrade** (Resend, template nuevo).
8. **Banner en la home / perfil** cuando el usuario free está cerca del límite (5/5 carreras, 3/3 PRs) — CTA suave de upgrade.
9. **A/B test de precios** (mensual vs anual por defecto en el checkout).

### 4.2 Coste de infraestructura marginal por usuario Pro

| Concepto | Coste/usuario/mes | Justificación |
|---|---|---|
| Convex function calls | ~$0.005 | 50-100 calls/mes más que free |
| Resend emails | ~$0.003 | 5-10 emails extra/mes (resultados, alertas) |
| Render diploma PDF | ~$0.005 | 2-5 diplomas/mes |
| Vercel bandwidth | ~$0.002 | Fichas + perfil público |
| Stripe fee | $0.30 + 1,4% por cobro mensual = **~$0.34** | Fee fijo de Stripe por transacción |
| IA (extracción profunda) | $0.001 | Solo si el admin re-extrae, no uso directo del usuario |
| **TOTAL** | **~$0.36/usuario/mes** | |

**A 2,99 €/mes (mensual):** margen bruto = **2,63 €/usuario/mes = 88%**.
**A 24 €/año (= 2 €/mes prorrateado):** margen bruto = **1,64 €/usuario/mes = 82%**. Pero el cobro único de 24 € al inicio mejora cash flow.

**Break-even por usuario Pro:** **1 solo usuario Pro ya cubre su coste**. No necesitas volumen para empezar.

### 4.3 Volumen y proyección de ingresos

| Usuarios registrados | Conversión Pro esperada* | MRR (mensual) | ARR (anual) |
|---|---|---|---|
| 1.000 | 3-5% = 30-50 Pro | **90-150 €/mes** | **1.080-1.800 €/año** |
| 5.000 | 3-5% = 150-250 Pro | **450-750 €/mes** | **5.400-9.000 €/año** |
| 20.000 | 3-5% = 600-1000 Pro | **1.800-3.000 €/mes** | **21.600-36.000 €/año** |

*Conversión esperada: apps freemium de nicho fitness suelen convertir 2-7%. Con el anchor de 2 €/mes y la Newsletter empujando, **3-5% es realista** en year 1 si la propuesta de valor está bien comunicada. ClubRunning Plus (con su propuesta similar pero sin IA) presume de conversión 2-3% en foro de Producto.

---

## 5. Estrategia de lanzamiento (90 días)

### Fase 0 (semana 1-2): decisión y diseño

- [ ] Validar pricing con **5-10 corredores del público objetivo** (entrevista 30 min, "¿pagarías 24 €/año por X?"). **No skippear esto.**
- [ ] Decidir stack de pagos: **Stripe** (recomendado) vs Lemon Squeezy vs Paddle. Stripe = más control, fees más bajos para Europa, Clerk tiene integración nativa.
- [ ] Diseñar UX del paywall y del upgrade modal. No es un "modal genérico", es un "showcase de las features que te estás perdiendo, con screenshot real".

### Fase 1 (semana 3-5): implementación core

- [ ] Tabla `subscriptions` en Convex.
- [ ] Integración Stripe + Clerk (Clerk Billing opcional si quieres shortcut).
- [ ] Webhook `/api/stripe/webhook`.
- [ ] Componente `<Paywall>`.
- [ ] Páginas `/cuenta`, `/cuenta/suscripcion`.
- [ ] Emails transaccionales (welcome, recibo, cancelación, fallo de pago).

### Fase 2 (semana 6-7): feature gating

- [ ] Aplicar gate a: calendario >5, PRs >3, resultados históricos >3, export ZIP de diplomas, alertas personalizadas, export Google/Apple Calendar, widget público, comparativa con comunidad.
- [ ] **NO** aplicar gate a: predicciones, catálogo, voto, 8D, newsletter.
- [ ] Banner contextual cuando free está cerca del límite ("4/5 carreras, te queda 1 — actualiza a Pro").
- [ ] Página `/pro` con landing pública (para SEO y link desde newsletter).

### Fase 3 (semana 8-9): beta cerrada

- [ ] 50-100 usuarios early adopters (de la lista de newsletter existente).
- [ ] Trial de 30 días sin tarjeta.
- [ ] Recoger feedback sobre qué features usan más y cuáles no.
- [ ] Ajustar pricing y feature set si hace falta.

### Fase 4 (semana 10-12): lanzamiento público

- [ ] Anuncio en newsletter, redes, Product Hunt.
- [ ] **Oferta launch: 19 €/año el primer año** (en vez de 24) — solo para los primeros 200. Crea urgencia.
- [ ] Post en blog "Por qué Pro cuesta 2 € al mes y no 5 €" (transparencia sobre costes).
- [ ] Programa de referidos: "1 mes gratis por cada amigo que se haga Pro" (year 2).

---

## 6. Riesgos y cómo los mitigo

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| **Conversión <1%** (gente no ve valor suficiente en Pro) | Media | Alto | Trial 30 días sin tarjeta + ajustar feature set según uso real |
| **Churn >10%/mes** (se apuntan y se van al mes) | Alta | Alto | **Onboarding crítico**: que el primer resultado oficial o la primera predicción calibrada llegue en los primeros 7 días. El "wow moment" tiene que ser inmediato. |
| **ClubRunning baja precios aún más** | Baja | Medio | Diferenciador en IA, diploma PDF, newsletter, SEO. No compitas en precio, compite en valor emocional |
| **Strava copia el "resultado oficial por dorsal"** | Muy baja | Alto | Tu SEO + tu email + tu comunidad ya están construidos. Strava no tiene foco español ni "ritual del dorsal" |
| **Usuarios free sienten que pierden features clave** | Media | Medio | Predicciones infinitas gratis + catálogo entero gratis. El free enamora. El paywall solo bloquea "valor generado por uso repetido" |
| **Problemas con RGPD al cobrar** | Baja | Medio | Stripe cumple PCI-DSS. Clerk maneja datos. Solo guardas `stripeCustomerId` y `stripeSubscriptionId` en Convex. **No guardar tarjeta.** |
| **Stripe fee mata margen en micro-importes** | Baja | Bajo | El fee de 0,30 € es relevante solo en el plan mensual. Por eso el anual es el push principal |
| **Soporte se inunda** con "no me deja guardar la 6ª carrera" | Alta | Bajo | Banner explicativo + FAQ en `/pro` + email automático "has alcanzado el límite free, actualiza" |

---

## 7. Métricas para saber si va bien

| KPI | Meta mes 3 (post-lanzamiento) | Meta mes 6 | Meta mes 12 |
|---|---|---|---|
| Trial starts | 200 | 800 | 3.000 |
| Trial → paid conversion | 15% | 20% | 25% |
| Suscriptores Pro activos | 30 | 100 | 350 |
| MRR | 60 € | 200 € | 700 € |
| ARR | 720 € | 2.400 € | 8.400 € |
| Churn mensual | <8% | <6% | <5% |
| ARPU | 2,00 € | 2,00 € | 2,00 € |
| LTV medio (a 5% churn) | 40 € | 40 € | 40 € |
| Ratio anual/mensual | 60/40 | 70/30 | 75/25 |
| **CAC (coste de adquirir un Pro)** | <5 € | <8 € | <10 € |
| **LTV/CAC** | **>4x** | **>5x** | **>4x** |

**Alerta roja si en mes 3:**
- <50 trial starts → la propuesta de valor no está llegando (revisar copy, banner, email).
- Conversión trial → paid <5% → la entrega del valor en los primeros 7 días falla (revisar onboarding).
- Churn >15% → el producto no retiene (revisar features, soporte).

---

## 8. Top 5 acciones para empezar esta semana

1. **Validar el pricing con 5-10 corredores reales** (15 min por entrevista, 2 horas total). Pregunta exacta: *"¿Pagarías 2,99 €/mes o 24 €/año por [lista de features Pro]? ¿Qué feature es la que más te dolería no tener?"* Sin esto, estás construyendo a ciegas.

2. **Diseñar el flow de onboarding para Pro** (1 tarde). El usuario que se apunta a Pro debe tener su "wow moment" en los primeros 5 minutos: sube Strava, le predices 4 distancias, le mandas el diploma de su mejor carrera, le sugieres 3 carreras para su nivel. Si eso no pasa, el churn es altísimo.

3. **Crear la cuenta de Stripe** (30 min). Activar productos: `pro_monthly` 2,99 € y `pro_annual` 24 €. Configurar webhooks a tu endpoint (todavía no creado).

4. **Escribir la landing `/pro`** (1 día). No la hagas técnica: hazla emocional. "Por 2 € al mes, deja de buscar tus resultados como un poseso. Te llegan al buzón con tu diploma."

5. **Escribir el post del blog "Por qué Pro cuesta 2 €"** (3-4h). Transparente: "esto es lo que cuesta, esto es lo que ofrecemos, esto es nuestro margen". La honestidad es tu mejor marketing en este nicho.

---

## 9. Decisión recomendada (resumen ejecutivo)

**Implementar tier Pro a 2,99 €/mes o 24 €/año**, con todo el contenido (catálogo, predicciones, newsletter, voto) gratis, y paywall solo en features de "valor generado por uso":

- Calendario >5 carreras
- PRs >3
- Resultados históricos completos
- Diploma PDF descargable en bloque
- Alertas personalizadas
- Export a calendarios externos
- Estadísticas avanzadas
- Widget público
- Comparativa con comunidad
- Sync Strava ilimitado

**Por qué este pricing y no el del plan general (5 €/mes):**
- El corredor popular español no es el cliente de Strava. Tiene otro techo de dolor.
- ClubRunning ya está en 2 €/mes con propuesta similar. Subir de 2,99 €/mes sin diferenciador claro = perder.
- **El margen al 82-88% es brutal a este precio**, incluso si solo conviertes el 3%. No necesitas volumen para ser rentable.
- La newsletter + SEO + comunidad siguen siendo el motor de adquisición. **Pro es la consecuencia**, no el motor.

**No incluir en v1:**
- Plan familiar (year 2).
- Plan mensual + anual con prueba social (year 2, cuando tengas testimonios).
- White-label B2B a organizadores (year 3, vía marketplace DorsalSwap reactivado).
- Marketplace de planes de entrenamiento (roadmap post-monetización core).

**Apalancarse en lo existente:**
- El `dorsal-swap-widget.tsx` que ya está creado (no committeado, según AGENTS.md §6.1) puede ser feature Pro más adelante.
- El sistema de predicción VDOT ya funciona sin coste → usalo como gancho de retención.
- La newsletter "Historias de dorsal" ya manda emails mensuales → incluir pitch de Pro en cada envío.

---

## 10. Referencias y decisiones vinculadas

- **Pricing ClubRunning Plus:** 2 €/mes o 24 €/año (verificado 7 sep 2026). Es el techo de mercado para apps de nicho running en España. NO superar sin diferenciador claro.
- **Strava Individual España:** 5-8 €/mes según fuente. NO es tu competencia directa (Strava = entrenamiento, mi-dorsal = dorsal).
- **Garmin Connect+ España:** 8,99 €/mes o 89,99 €/año. NO es tu competencia (solo si tienes reloj Garmin).
- **Gasto medio corredor popular:** 39,6 €/mes en deporte (estudio SEMED-Cinfa). Tu Pro a 2,99 €/mes es el 7,5% de ese gasto. Es asumible.
- **Conversión freemium nicho fitness:** 2-7% según ProductLed, ProfitWell, OpenView. Asumimos 3-5% en year 1 por ser nicho.
- **Stripe España:** fee 1,4% + 0,25 € para tarjetas EU estándar, o 1,4% + 0,30 € según plan. Asumimos 0,30 € fijo.
- **Coste IA gpt-4o-mini** (verificado por OpenAI pricing 2026): $0,15/1M input, $0,60/1M output. ~$0,003/extracción profunda. **NO** usar para predicciones VDOT (es cálculo local).
- **MiniMax M3** (gratis vía Maverick) ya soportado en `lib/ai/extract-race.ts` con `OPENAI_BASE_URL=https://api.minimax.io/v1`. Usar para dev, mantener gpt-4o-mini en prod.

---

*Este plan es deliberadamente conservador. Prefiero infravalorar ingresos y sobredimensionar valor entregado que prometer 5000 €/mes y entregar 200. El objetivo realista de year 1 con Pro es **500-1500 € MRR combinado con AdSense + afiliación + newsletter patrocinada = 1500-3000 €/mes total** (alineado con `docs/MONETIZATION_PLAN.md` escenario "Esperado").*

# Mapa de infraestructura y roadmap de upgrades · mi-dorsal

> **Fecha**: 8 sep 2026
> **Propósito**: responder a "¿cuántos usuarios soporta el estado actual?" y "¿cuándo hay que ir saltando de plan?" con cifras concretas por servicio, orden de saltos, coste acumulado y fixes críticos pre-activación de monetización.

> ⚠️ **Este documento NO sustituye** a `BUSINESS_PLAN.md` (rentabilidad). Es el **zoom de capacidad técnica**: qué aguanta cada servicio, dónde rompe, cuánto cuesta el siguiente paso.

---

## 1. Estado actual confirmado (8 sep 2026)

Verificado en local + `.env.local` + `.vercel/project.json` + `convex.json`:

| Servicio | Plan actual | Capacidad | Coste hoy | Riesgo inmediato |
|---|---|---|---|---|
| **Vercel** | **Hobby** (OIDC token lo confirma) | 100 GB bandwidth, 1M function invocations, 4 CPU-hr, 360 GB-hr memory, **sin overage** (techos rígidos) | **$0/mes** | 🔴 **Uso comercial no permitido** → choca con AdSense y Stripe. **Saltar a Pro ($20/mes) es el primer fix obligatorio.** |
| **Convex** | **Free o Starter** (no verificable desde local, no hay dashboard aquí) | 1M function calls/mes, 0,5 GB DB, 1 GB file, 20 GB-hr action, 1 GB egress; overage $2,20/M calls + $0,22/GB DB | **$0-2/mes** | 🟡 OK al tráfico actual. Saltar a Professional ($25/dev/mes) cuando se acerque a los límites. |
| **Clerk** | **Free** (production) | 50k MRU incluidos (feb 2026) | **$0/mes** | 🟢 OK hasta 50k MAU. **No activar Clerk Billing hasta haber migrado a `pk_live_` en Vercel.** |
| **Resend** | **Free** | 3k emails/mes con cap de **100/día** | **$0/mes** | 🟡 **Primer cuello real**: si envías newsletter a >100 suscriptores/ día, el envío se pausa sin aviso. Saltar a Pro ($20/mes) cuando actives Pro + newsletter. |
| **OpenAI** | **Pay-per-use** | Sin techo, por uso | **~$0-1/mes** | 🟢 Barato. Pero el `RESEND_FROM_EMAIL = hola@mi-dorsal.com` que no existe puede estar **rebotando** las emails de resultados → activar Zoho Mail (AGENTS.md §13.4) **antes** de activar freemium. |
| **Stripe (via Clerk Billing)** | **No activado** | n/a | **$0/mes** | 🟢 Skeleton listo (8 sep 2026). Activar tras validar pricing con entrevistas (ver BUSINESS_PLAN.md). |
| **Dominio** | mi-dorsal.com (Vercel) + mi-dorsal.es (Hostinger) | n/a | **~19 €/año** | 🟢 OK. Pendiente `mi-dorsal.run` y `.app` defensivos. |
| **Zoho Mail** | **Pendiente** | 5 buzones gratis | **0 €** | 🔴 **Bloqueante para emails transaccionales**: el `RESEND_FROM_EMAIL` configurado no tiene buzón detrás. Configurar antes de lanzar Pro. |

### 1.1 Coste efectivo actual

~$0-2/mes (todo en tiers free). Pero hay 3 **trabones latentes** que te van a doler al activar monetización:

1. **Vercel Hobby** no permite uso comercial → al meter AdSense o Stripe te pueden cerrar la cuenta.
2. **Resend 100/día** → la newsletter semanal a 700+ suscriptores no se envía de un día. Necesitas Pro $20/mes el día que lances la newsletter.
3. **Buzón hola@mi-dorsal.com no existe** → los emails transaccionales (resultados, bienvenida Pro) rebotan y tu reputación de dominio se va al suelo con cada envío.

---

## 2. Capacidad por servicio y techos rígidos

### 2.1 Vercel (estado: Hobby)

| Recurso | Hobby (actual) | Pro (siguiente) | Enterprise |
|---|---|---|---|
| Bandwidth (Fast Data Transfer) | 100 GB/mes **duro** | 1 TB incluido, luego $0,15/GB | Custom |
| Function invocations | 1M/mes **duro** | 1M incluido, luego $0,60/M | Custom |
| Edge requests | n/a (cuenta en Pro) | 10M incluido, luego $2/M | Custom |
| Active CPU | 4 h/mes **duro** | Usage-based ($0,128/CPU-hr) | Custom |
| Provisioned Memory | 360 GB-hr/mes **duro** | Usage-based ($0,0106/GB-hr) | Custom |
| Build minutes | 6.000/mes **duro** (Hobby 100/mes) | 6.000 incluido | Custom |
| Image optimization | 1.000/mes | 5.000 incluido, luego $0,005/imagen | Custom |
| Concurrent builds | 1 | 1 (más $40/mes cada uno) | Custom |
| Team seats | 1 (personal) | $20/seat/mes (1 gratis, +$20 cada uno) | Custom |
| **Uso comercial** | ❌ Prohibido | ✅ Permitido | ✅ |
| **SSL custom** | ✅ | ✅ | ✅ |

**Techo realista Hobby**: ~50-100k páginas vistas/mes con catálogo + ficha + carrera. PDFs del diploma **comen bandwidth rápido** (1-2 MB por render).

**Costo de saltar a Pro**: $20/mes (1 seat, Manu) → cubre hasta 1 TB bw + 10M edge reqs.

### 2.2 Convex (estado: Free/Starter)

| Recurso | Free/Starter (actual) | Professional (siguiente) | Business (50+ devs) |
|---|---|---|---|
| Function calls | 1M/mes incluidos, luego **$2,20/M** | 25M incluidos, luego **$2,00/M** | Custom |
| Database storage | 0,5 GB incluido, luego **$0,22/GB** | 50 GB incluido, luego **$0,20/GB** | Custom |
| File storage | 1 GB incluido, luego **$0,033/GB** | 100 GB incluido, luego **$0,03/GB** | Custom |
| Database I/O | 1 GB incluido, luego **$0,22/GB** | 50 GB incluido, luego **$0,20/GB** | Custom |
| Action compute | 20 GB-hr incluido, luego **$0,33/GB-hr** | 250 GB-hr incluido, luego **$0,30/GB-hr** | Custom |
| Search queries | 3.000 query-GB incluido, luego **$0,11/1k query-GB** | 50.000 query-GB incluido, luego **$0,10/1k query-GB** | Custom |
| Data egress | 1 GB incluido, luego **$0,132/GB** | 50 GB incluido, luego **$0,12/GB** | Custom |
| Backups | ❌ | ✅ Daily, 7 días | ✅ |
| Logs retention | 24h | 7 días | Custom |
| Compliance (SOC2, HIPAA) | ❌ | ✅ Reports | ✅ BAA incluido |
| Precio base | **$0/mes** | **$25/dev/mes** | **$2.500/mes mínimo** |

**Techo realista Free**: ~3-5k MAU con uso moderado (carruseles, perfil, calendario). El action compute (PDF diploma, IA coach, extracción carreras admin) **es lo que más consume**.

**Cuándo saltar a Professional $25/dev/mes**:
- Function calls >500k/mes sostenido **O**
- Action compute >10 GB-hr/mes **O**
- DB storage >0,3 GB **O**
- Si tienes 1 dev (Manu): el umbral real son unos **5-10k MAU**.

**Comparación de "aguante"** (con 1 dev):
- Free: hasta ~5k MAU moderado
- Professional $25/mes: hasta ~30k MAU moderado
- Business $2.500/mes: 50k+ MAU (cuando ya tienes equipo y $$$)

### 2.3 Clerk (estado: Free production)

| Recurso | Free (actual) | Pro (siguiente) |
|---|---|---|
| **Monthly Retained Users (MRU)** | **50.000 gratis** | 50.000 incluidos |
| Monthly Active Organizations | 100 gratis | 100 incluidos |
| Enterprise SSO connections | ❌ | 1 incluida |
| Production features (MFA, passkeys, custom sessions) | ❌ | ✅ |
| Remove Clerk branding | ❌ | ✅ |
| Base price | **$0/mes** | **$25/mes** (anual) o **$25/mes** (mensual, 20% más) |
| Overage por MRU | n/a | **$0,02/MRU/mes** (con descuentos por volumen) |
| Soporte | Community | Email 24-48h |
| B2B Authentication add-on | ❌ | $100/mes |

**Definición crítica de Clerk**: MRU = usuario que vuelve al menos 24h después de signup. Los que se registran y no vuelven **no cuentan**. Esto te favorece mucho vs MAU tradicional.

**Cálculo de cuándo cuesta**:
- 50.000 MRU: $0/mes (free).
- 100.000 MRU: **$25 + (100k - 50k) × $0,02 = $1.025/mes**.
- 500.000 MRU: **$25 + 450k × $0,02 = $9.025/mes**.

**Techo realista Free**: 50k usuarios **retenidos** al mes. Es MUCHO. Para tu segmento nicho (corredores populares España) y con 4 patas ejecutándose, **probablemente no llegues a 50k MRU hasta año 2-3**.

**Cuándo saltar a Pro**:
- >50k MRU **O**
- Necesitas MFA, passkeys, custom sessions, o quitar el branding de Clerk **O**
- Quieres el add-on de B2B Authentication (cuando lances DorsalSwap a organizadores).

### 2.4 Resend (estado: Free)

| Recurso | Free (actual) | Pro (siguiente) | Scale |
|---|---|---|---|
| Emails/mes | 3.000 | 50.000 | 100.000 |
| **Cap diario** | **100/día duro** | Sin límite | Sin límite |
| Dominios | 1 | 1 (+$20/mes por 100 más) | 10 (+$20/mes por 100 más) |
| Log retention | 30 días | 30 días | 30 días |
| Webhooks | 1 endpoint | 5 endpoints | 10 endpoints |
| AI credits | 5 | 100 | 500 |
| Dedicated IP | ❌ | +$30/mes | +$30/mes |
| Soporte | Ticket sin SLA | Email estándar | Email prioritario |
| Precio | **$0/mes** | **$20/mes** | **$90/mes** |
| Overage | n/a (envío pausa) | $0,40/1.000 emails extra | $0,90/1.000 emails extra |

**El cap diario de 100 es el verdadero cuello, no el mensual.** Si envías una newsletter a 1.500 suscriptores un lunes, **Resend pausa el envío** al llegar a 100 y el resto no sale hasta el día siguiente (cuando ya es tarde).

**Cuándo saltar a Pro $20/mes**:
- Cualquier newsletter a >100 suscriptores **O**
- >3.000 emails/mes en transaccionales (resultados, alertas) **O**
- Necesitas webhook de delivery (>5 eventos) para tracking en Convex.

**Coste de 1.000-5.000 emails/mes extra**: 0 € si caben en 50k. Solo pagas cuando superas 50k.

### 2.5 OpenAI gpt-4o-mini (estado: pay-per-use)

Sin techo rígido, pagas por uso. Verificado en `lib/ai/pricing.ts`:
- Input: $0,15 / 1M tokens
- Output: $0,60 / 1M tokens

**Costes por feature (de la v2 freemium)**:
- Predicciones VDOT: $0 (cálculo local).
- Extracción simple carrera: $0,0003/llamada.
- Extracción profunda carrera: $0,0042/llamada.
- **Entrenador IA (coach)**: **$0,0007/llamada**.

**A 1.000 Pro × 4 calls/mes** = $2,80/mes. **Insignificante**. Pero el trainer puede ser **abuso-prone**: alguien con 1 cuenta + script puede inflar el coste. La tabla `aiUsageLog` ya rastrea esto (con rate-limit 4/mes por Pro ya implementado en v2).

**Cuándo preocuparse**: cuando `aiUsageLog.costEur/mes > $50` con <100 Pro (señal de abuso, activar rate-limit más agresivo).

---

## 3. Roadmap de upgrades (orden de saltos)

### 3.1 Pre-activación de monetización (antes de activar Pro)

**Estos 3 fixes son obligatorios antes de cobrar a un usuario o mostrar AdSense**. Coste extra: **~$30-50/mes**.

| # | Acción | Coste | Por qué obligatorio | Cuándo |
|---|---|---|---|---|
| 1 | **Vercel Hobby → Pro** | +$20/mes | Hobby prohíbe uso comercial. AdSense y Stripe requieren Pro. Techo rígido sin overage → tu primer Black Friday te tumba la web. | **HOY** |
| 2 | **Configurar Zoho Mail free + crear buzón hola@mi-dorsal.com** | $0 | El `RESEND_FROM_EMAIL` actual apunta a un buzón que no existe → los emails de resultados y bienvenida Pro rebotan. Tu reputación de dominio se va al suelo con cada rebote (afecta deliverability de TODA la newsletter). | **HOY** (15 min) |
| 3 | **Resend Free → Pro** | +$20/mes | El cap de 100 emails/día mata la newsletter a >100 suscriptores. Si lanzas Pro el mismo día sin esto, el primer email masivo de bienvenida se queda a medias. | **Día 1 de activación Pro** |

**Total pre-activación**: **~$40/mes de coste base operativo**.

### 3.2 Roadmap por hito de tráfico

| Hito | Usuarios registrados | MAU | Lo que SÍ aguanta el plan actual | Lo que FALLA / hay que upgradear | Coste mensual proyectado |
|---|---|---|---|---|---|
| **Hito 0** (actual) | ~200 | ~60 | ✅ Vercel Hobby, Convex Free, Clerk Free, Resend Free | 🔴 Vercel Hobby no permite uso comercial | **~$2/mes real** (pero el coste "legal" debería ser ~$40 si haces los 3 fixes) |
| **Hito 1** (post-activación) | 500-1.000 | 150-300 | ✅ Mismos planes (con Vercel Pro y Resend Pro aplicados) | Nada todavía | **~$40-60/mes** |
| **Hito 2** (tracción inicial) | 1.000-3.000 | 300-1.000 | ✅ Vercel Pro cubre hasta 1 TB bw, Convex Free aguanta | Posible overage de Vercel bandwidth si el PDF diploma es muy популяр (>500 descargas/mes) | **~$50-100/mes** |
| **Hito 3** (crecimiento) | 3.000-7.000 | 1.000-2.500 | ⚠️ Convex Free en el límite (action compute del PDF empieza a picar) | **Upgrade Convex Free → Professional $25/dev/mes** | **~$80-150/mes** |
| **Hito 4** (escala) | 7.000-20.000 | 2.500-6.000 | ✅ Vercel Pro, Convex Pro, Clerk Free, Resend Pro | Vigilar Vercel bandwidth (overage $0,15/GB) y Resend emails (50k incluidos) | **~$150-300/mes** |
| **Hito 5** (popularidad) | 20.000-50.000 | 6.000-15.000 | ⚠️ Clerk se acerca a 50k MRU, Vercel bandwidth puede pasar 1 TB | **Upgrade Clerk Free → Pro $25/mes** + **vigilar Vercel overage** | **~$200-500/mes** |
| **Hito 6** (éxito) | 50.000-100.000 | 15.000-30.000 | ❌ Clerk pagando $0,02/MRU extra, Vercel bw caro, Resend quizás a Scale | Optimizaciones: cache agresivo, CDN para assets, lazy-load PDFs, comprimir Strava exports | **~$500-1.500/mes** |
| **Hito 7** (sueño) | 100.000+ | 30.000+ | Todo en plan de pago, optimizar rendimiento | Migrar a Stripe directo (ahorrar 0,7% de Clerk Billing), considerar Convex Business si hay más devs | **~$1.500-3.000/mes** |

### 3.3 Orden de saltos (cuándo exacto, no solo en qué hito)

| Salto | Trigger exacto | Coste | Esfuerzo | Notas |
|---|---|---|---|---|
| **Vercel Hobby → Pro** | Inmediato (antes de AdSense o Stripe) | $20/mes | 5 min en dashboard Vercel | ⚠️ **Ya deberías haberlo hecho** al comprar el dominio propio. Si no, hazlo hoy. |
| **Resend Free → Pro** | Antes de lanzar newsletter o Pro | $20/mes | 5 min en dashboard Resend | Necesario desde el día 1. El cap diario de 100 es limitante. |
| **Zoho Mail setup** | Antes de enviar emails transaccionales | $0 | 15 min | Configurar buzón `hola@mi-dorsal.com` y cambiar DNS. |
| **Convex Free → Professional** | ~5-10k MAU **o** function calls >500k/mes **o** action compute >10 GB-hr/mes | $25/mes | 5 min en dashboard Convex | Migration trivial: solo cambiar el plan, los datos se quedan. |
| **Clerk Free → Pro** | >50k MRU **o** necesidad de MFA/passkeys/SAML | $25/mes + $0,02/MRU extra | 1h setup en dashboard Clerk | Para Pro propiamente dicho (MFA, passkeys), Pro vale la pena desde el día 1 si vas a tener >50k usuarios. Si no, espera. |
| **Resend Pro → Scale** | >50k emails/mes o 5+ webhooks | $90/mes | 5 min | Solo si la newsletter crece mucho. |
| **Vercel Pro → Enterprise** | >5 TB bandwidth/mes, necesidad de SLAs, HIPAA | $3.000-3.500/mes mínimo | 1-2 semanas de negotiation | Out of scope para v1. |
| **Convex Pro → Business** | >25M calls/mes o necesidad de SOC2/HIPAA | $2.500/mes mínimo | 1-2 semanas | Out of scope para v1. |
| **Migrar Clerk Billing → Stripe directo** | MRR >€5.000/mes | -0,7% de comisiones | 1-2 semanas (ver `BILLING_SETUP.md` §7) | Optimización de margen, no urgencia. |

### 3.4 Cuando un servicio "falla", ¿qué pasa?

| Servicio | Cómo falla | Señales de aviso | Mitigación inmediata |
|---|---|---|---|
| **Vercel Hobby** | HTTP 503 en exceso, deploy que no entra, build que aborta | Email de Vercel "approaching limits", errores 503 en logs | Upgrade a Pro (instantáneo desde dashboard). |
| **Convex Free** | Function calls fallan con "rate exceeded", queries se relentizan | Dashboard Convex muestra "X% of quota used" en naranja | Upgrade a Professional $25/mes. Si no, hacer back-off en el cliente y reducir queries. |
| **Resend Free** | Envío se pausa al llegar a 100/día, emails quedan en cola | Email "Daily limit reached" de Resend | Upgrade a Pro $20/mes (sin cap diario). |
| **Clerk Free** | No falla, pero al pasar 50k MRU te dan 1 mes de gracia y luego cortan | Dashboard Clerk empieza a mostrar "approaching MRU limit" | Upgrade a Pro $25/mes. |
| **OpenAI** | No falla, solo pasa la factura | `aiUsageLog.costEur/mes > $50` con <100 Pro | Rate-limit más agresivo, banear cuentas abusivas, migrar a M3 (gratis) si se dispara. |
| **Stripe** | Casi nunca falla. Webhook reintenta automáticamente. | Dashboard Stripe muestra "dispute opened" o "payout delayed" | Atender manual, escala de soporte. |

---

## 4. Coste acumulado por escenario (12 meses)

Proyección combinando saltos en el momento correcto + crecimiento realista de las 4 patas:

| Mes | Usuarios | MAU | Pro | Saltos producidos | Coste infra/mes |
|---|---|---|---|---|---|
| 0 (hoy) | 200 | 60 | 0 | (sin saltos hechos) | $0-2 |
| 0 (post-fixes) | 200 | 60 | 0 | Vercel Pro + Resend Pro + Zoho | **$40** |
| 1 | 300 | 90 | 0 | (launch Pro beta cerrada) | $40 |
| 2 | 500 | 150 | 5-15 | (launch público, primeros Pro) | $45-55 |
| 3 | 800 | 250 | 20-40 | (empieza newsletter, primeros patrocinadores) | $50-70 |
| 4 | 1.200 | 400 | 40-80 | | $55-80 |
| 5 | 1.800 | 600 | 70-130 | | $60-100 |
| 6 | 2.500 | 850 | 100-200 | **Convex Free → Professional $25** | $90-140 |
| 7 | 3.500 | 1.200 | 140-260 | | $100-160 |
| 8 | 5.000 | 1.700 | 200-350 | | $110-180 |
| 9 | 7.000 | 2.400 | 280-470 | | $130-220 |
| 10 | 10.000 | 3.500 | 400-700 | Vigilar Vercel bandwidth | $150-280 |
| 11 | 14.000 | 5.000 | 550-900 | | $180-350 |
| 12 | 20.000 | 7.000 | 800-1.200 | **Clerk Free → Pro $25** (si llegas a 50k MRU, improbable a mes 12) | $250-500 |

**Total acumulado 12 meses**: **~$1.500-2.500** (coste de infra). Esto se paga **de sobra** con los ingresos del Pro desde mes 2-3.

---

## 5. Optimizaciones proactivas (antes de que la infra escale)

Estas son las decisiones técnicas que **toman 1 día ahora y te ahorran 10× en overages más adelante**:

### 5.1 Vercel

- **Cache-Control agresivo en `/carreras/(.*)`** (ya lo tienes en `vercel.json`: `s-maxage=3600, stale-while-revalidate=86400`). ✅
- **No servir OG images dinámicos sin caché**: si generas OG images con `@vercel/og`, son caras. Considera pre-generarlas en build o en una cron.
- **Comprimir imágenes de carreras** con `next/image` y `formats: ['image/avif', 'image/webp']` en `next.config.js`.
- **Diploma PDF**: en vez de renderizarlo en cada descarga, **cachearlo en Vercel Blob** (~$0,02/GB/mes) o servirlo desde Convex file storage. Un diploma por usuario × 1.000 Pro = 1.000 PDFs en caché = 50 MB → $0/mes.
- **Static Generation** de `/carreras` con `revalidate: 3600` para que no se re-renderice cada vez. El `force-dynamic` actual (AGENTS.md §3.1) **es necesario** por la geo, pero puedes servir el contenido cacheado y solo variar la pill de CCAA.

### 5.2 Convex

- **Paginación de queries** (`.paginate()`) en lugar de `.collect()` cuando listes carreras. Importante cuando tengas 5.000+ carreras en la DB.
- **Índices apropiados** (ya los tienes por slug, fecha, categoría). Verifica con `npx convex dashboard → Data → Indexes` que no faltan índices críticos.
- **Evitar `ctx.runQuery` desde actions innecesariamente**: cada `runQuery` es un round-trip. Si lo haces 5 veces en un solo flujo del usuario, son 5 function calls.
- **Action compute es el cuello real**: el diploma PDF y el coach IA gastan action compute. **Cachear diplomas ya generados** en Convex file storage (gratis hasta 1 GB, luego $0,03/GB).

### 5.3 Resend

- **Batch sending**: si envías la newsletter a 2.000 suscriptores, usa `resend.batch.send()` con arrays en vez de un loop de `resend.emails.send()`.
- **Idempotency keys** en los emails transaccionales: si reintentas por fallo, no envíes duplicados.
- **Suppressions automáticas**: Resend gestiona los rebotes duros (bounces). Configura un webhook para que Convex desactive suscriptores con bounce.
- **Segmentación**: si la newsletter tiene secciones (corredores de 5K vs 10K vs trail), segmenta en lugar de enviar todo a todos.

### 5.4 Clerk

- **Bypass de MRU para emails de magic link**: el "First Day Free" de Clerk ya excluye a los que se registran y no vuelven. Asegúrate de que tu flow de onboarding **fomenta el retorno en 24h** (envía un email "bienvenida, mira las carreras cerca de ti" inmediato).
- **OAuth para evitar passwords**: Clerk soporta Google OAuth, GitHub, etc. Reduce fricción, aumenta conversión free→paid.

### 5.5 OpenAI

- **Rate limiting estricto** del entrenador IA: 4/mes para Pro, 0 para Free (con 1 free trial). Implementación ya en v2.
- **Migrar a M3 cuando el volumen lo justifique**: M3 es gratis vía Maverick, pero tiene límites de throughput. Úsalo para tier Free, deja gpt-4o-mini para Pro donde necesitas calidad constante.
- **Cachear análisis del coach** con clave `clerkUserId + weekNumber`: si el usuario entra 3 veces la misma semana, devuelves el mismo análisis sin gastar IA.

---

## 6. Checklist crítico pre-activación (hazlo esta semana)

En orden de prioridad, antes de lanzar Pro / newsletter / AdSense:

- [ ] **Vercel Hobby → Pro** ($20/mes). 5 min. **HOY.**
- [ ] **Configurar Zoho Mail + crear buzón hola@mi-dorsal.com** (15 min, AGENTS.md §13.4). **HOY.**
- [ ] **Actualizar DNS en Hostinger** con registros MX de Zoho (5 min tras verificar dominio en Zoho). **HOY.**
- [ ] **Resend Free → Pro** ($20/mes). 5 min. **Día 1 de activación Pro.**
- [ ] **Validar pricing con 5-10 entrevistas** (ver BUSINESS_PLAN.md §8). **Semana 1.**
- [ ] **Activar Clerk Billing** siguiendo `BILLING_SETUP.md` (30-45 min). **Semana 2.**
- [ ] **Setup de rate limiting del coach IA** (4/mes/Pro) en `convex/aiUsageLog`. **Semana 2.**
- [ ] **Diseñar onboarding "wow moment"** (Strava → 1ª predicción → 1er diploma → 1er coach IA) en los primeros 5 minutos. **Semana 2-3.**
- [ ] **Página /pro + PricingTable de Clerk** + banners contextuales. **Semana 3.**
- [ ] **Beta cerrada con 50-100 early adopters** (lista newsletter). **Semana 4-6.**

---

## 7. Resumen ejecutivo en 1 minuto

> **El estado actual aguanta hasta ~3-5k MAU con coste ~$40-60/mes**, PERO **3 fixes son obligatorios antes de activar monetización** (Vercel Pro, Zoho Mail, Resend Pro) y cuestan **~$40/mes adicionales**.
>
> **Los servicios que vas a ir升级 son 3 (en este orden)**:
> 1. **Vercel Hobby → Pro** ($20/mes, **HOY**).
> 2. **Convex Free → Professional** ($25/mes, ~5-10k MAU).
> 3. **Clerk Free → Pro** ($25/mes, >50k MRU, probablemente año 2).
>
> **Resend** escala solo cuando lo necesitas (Pro $20/mes a 3k+ emails).
> **Stripe (vía Clerk Billing)** es 0,7% de comisión sobre ingresos, no se "actualiza" en plan, pero al pasar €5k MRR conviene migrar a Stripe directo.
>
> **El coste infra acumulado a 12 meses es ~$1.500-2.500**, que se paga **de sobra con 5-10 Pro pagando**.
>
> **El cuello de botella NO es la infra, es la conversión y el tráfico SEO.** La infra escala bien y barata hasta 20-30k MAU. Ejecuta las 4 patas (Pro + AdSense + Afiliación + Newsletter) y la infra te seguirá el ritmo.

---

## 8. Referencias y datos verificables

- **Vercel pricing**: https://vercel.com/docs/pricing (verificado 2026-08). Hobby sin overage, Pro $20/seat/mes.
- **Convex pricing**: https://www.convex.dev/pricing (verificado 2026-08). Free/Starter $0/mes, Professional $25/dev/mes.
- **Clerk pricing**: https://clerk.com/pricing (verificado 2026-08). Free hasta 50k MRU desde feb 2026, Pro $25/mes.
- **Resend pricing**: https://resend.com/pricing (verificado 2026-08). Free 3k/mes con cap 100/día, Pro $20/mes con 50k.
- **OpenAI pricing**: https://openai.com/api/pricing (verificado 2026-08). gpt-4o-mini $0,15/M input, $0,60/M output.
- **Stripe EU fees**: https://stripe.com/es/pricing (verificado 2026-08). 1,4% + 0,30 € tarjetas EU estándar.
- **Estado actual del proyecto verificado en**:
  - `vercel.json` (región fra1, sin crons).
  - `.vercel/project.json` (`plan: hobby` en OIDC token).
  - `convex.json` (origin: mi-dorsal.es, functions: convex/).
  - `.env.local` (CLERK_JWT, CONVEX_DEPLOYMENT, RESEND_API_KEY, RESEND_FROM_EMAIL).
  - AGENTS.md §13.4 (Zoho Mail pendiente).
  - AGENTS.md §6.4 (stack general).
  - `docs/MONETIZATION_FREEMIUM_TIERS.md` (costes IA ya modelados).
  - `docs/BILLING_SETUP.md` (pricing 4,99 € / 39 € vs propuesta 2,99 € / 24 €).

---

*Última revisión: 8 de septiembre de 2026 · Re-revisar mensualmente con datos reales de los dashboards de Vercel/Convex/Clerk/Resend.*

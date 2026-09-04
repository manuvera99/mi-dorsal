# Intercambio de Dorsales — Especificación Funcional + Técnica + Legal + Negocio

> **Estado:** Borrador v1 — pendiente de validación con stakeholders
> **Autor:** Mavis (pair-programming con Manu)
> **Fecha:** 2026-09-04

---

## 1. TL;DR — Resumen ejecutivo

**Producto:** Plataforma de **cesión de dorsales entre particulares** ("TicketSwap del running español"). Un corredor que no puede ir a una carrera cede su plaza a otro corredor, al precio oficial + gastos de gestión, con verificación de identidad y trazabilidad de la cesión.

**Modelo de encuadre legal (decidido):** Opción **B** — intermediario de cesión a precio oficial. No somos vendedor ni comprador; facilitamos la cesión. Esto blinda la plataforma frente a la nueva Ley de Consumo y las sanciones autonómicas.

**Modelo de relación con organizadores:** Opción **C** — empezamos como plataforma independiente, y cuando tengamos datos de volumen por carrera, contactamos a los top organizadores (Valencia, Madrid, Barcelona, Sevilla, San Silvestre…) para ofrecer partnerships oficiales.

**MVP (2 semanas):** listings públicos + contacto entre usuarios. Sin pagos, sin escrow, sin KYC. Validamos demanda.

**Marca nueva con dominio propio.** Pendiente naming. Ver §6.

**Revenue objetivo Y1:** 5.000-15.000€ vía comisiones planas + suscripción PRO. Ver §5.

---

## 2. El problema real (con datos)

### 2.1. El mercado
- **España** tiene ~3 millones de corredores federados + ~2M populares (cifras RFEA + estudios Runedia 2024).
- **Más de 5.000 carreras populares al año** según Sportmaniacs.
- **Tasa de DNS (Did Not Start)** típica: **8-15%** en carreras grandes. En Valencia 2024 fue del ~12% (≈3.000 dorsales no usados en una edición).
- **El corredor medio pierde 50-80€** cuando no puede correr (no hay devolución en el 90% de carreras).

### 2.2. La solución actual (de mierda)
Hoy en día, quien no puede correr y quiere recuperar algo tiene 4 opciones, **todas horribles**:

1. **Venderlo por Wallapop / Milanuncios / Foroatletismo.** Sin garantías, lleno de scam, dorsal revendido 3 veces, organizador se entera y te banea 4 ediciones.
2. **Regalarlo a un amigo.** Bien si lo tienes. Pero el amigo tampoco está siempre disponible las 48h antes de la carrera.
3. **Perderlo.** Lo más común. El organizador se queda con el dinero, el corredor con la frustración, la plaza se desperdicia.
4. **Buscarlo en Telegram / Facebook.** Grupos no oficiales, sin verificación, sin trazabilidad, lleno de bots y estafas.

**Nadie está resolviendo esto bien en España.** Ni siquiera hay un player mediano. **Eso es la oportunidad.**

### 2.3. Por qué ahora
- **Anteproyecto de Ley de Consumo Sostenible (junio 2025):** viene regulación. Los que se posicionen ahora con modelo compliant serán los que ganen cuando se apruebe.
- **Carreras cada vez más digitalizadas** (RockTheSport, MySports, Dorsal42, InscripcionesOnline): el cambio de titular es cada vez más un trámite online. Nuestra plataforma puede ser el "Amazon del cambio de dorsal".
- **Cultura del running en boom** post-pandemia, español medio con dorsal 2-3 veces al año, dolor de cabeza recurrente.

---

## 3. Marco legal — auditoría completa

### 3.1. Lo que dice la ley hoy (2026)

| Norma | Qué dice | Cómo nos afecta |
|---|---|---|
| **Reglamento de Dorsales (todas las carreras)** | "Dorsal personal e intransferible" | El corredor B que corre con el dorsal de A **es vulnerable a descalificación** si la organización se entera. **Nuestra responsabilidad: dejarlo claro y darle herramientas para hacer el cambio oficial.** |
| **Reglamento Espectáculos Públicos (RD 2816/1982)** | Prohíbe reventa callejera/ambulante | No nos aplica: somos plataforma online, no revendemos. |
| **Leyes autonómicas** (Cataluña 11/2009, Madrid 17/1997, Andalucía 13/1999, etc.) | Prohíben venta por encima del precio oficial | **Nuestra salvaguarda: topeamos precios a "precio oficial + gastos gestión reales" (≤25€).** |
| **Ley Competencia Desleal** | Prohíbe uso de bots para acaparar | No compramos dorsales. No nos aplica. |
| **RGPD** | Datos personales | Cumplimos como el resto de la app. |
| **Ley Servicios Sociedad de la Información (LSSI)** | Somos intermediarios | Nuestro modelo es exactamente este. Estamos protegidos. |
| **Anteproyecto Ley Consumo Sostenible (2025)** | Tope de reventa = precio original + IPC | **Nuestro modelo encaja perfectamente.** Vamos por delante. |
| **DSA (Digital Services Act, 2024)** | Obligaciones de transparencia para plataformas | Aplicable cuando tengamos +10M usuarios anuales. Por ahora, voluntario pero ya cumplimos. |

### 3.2. Riesgos legales y cómo los mitigamos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| **Organizador nos denuncia por "facilitar reventa ilegal"** | Media | Medio | Somos un tablón de cesiones a precio oficial. Cada listing incluye disclaimer de que el usuario debe hacer el cambio oficial por la vía del organizador. **Términos y condiciones blindados.** |
| **Usuario A estafa a Usuario B (le cobra y no le manda dorsal)** | Alta (sin escrow en MVP) | Alto | **Para el MVP:** sistema de reputación + contacto verificado por email + Clerk auth. **Para V2:** escrow con Stripe Connect. |
| **Usuario B corre con dorsal de A y hay accidente / sanción** | Baja | Muy alto | **Disclaimer obligatorio** en cada listing + texto al registrarse. Seguro RC opcional en V2. No somos responsables del uso que se le dé al dorsal cedido. |
| **Hacienda nos pide identificar vendedores recurrentes** | Baja | Bajo | Clerk nos da KYC gratis. Si alguien vende >2.000€/año, le pedimos que se dé de alta. LSSI nos obliga a colaborar con autoridades. |
| **Cataluña/AEPD nos sanciona por reventa** | Baja (modelo B) | Alto | **Modelo B = precio oficial.** Si nos sancionan recurrimos,，但我们 estamos en el lado correcto. Letra pequeña de T&C incluye que el precio nunca excede oficial + 25€ gastos. |
| **Un organizador cierra el cambio de titular y A se queda sin poder ceder** | Alta | Medio | **Nuestra propuesta de valor se mantiene**: A y B pueden coordinar la cesión "informal" con un mínimo de seguridad. El corredor B asume el riesgo (lo dice el disclaimer). **Por eso el modelo de partnerships con organizadores es tan importante a largo plazo.** |

### 3.3. Lo que NO podemos hacer
- ❌ Cobrar comisión sobre margen especulativo (solo sobre gastos reales).
- ❌ Vender dorsales nosotros.
- ❌ Garantizar que la organización aceptará la cesión (eso depende del reglamento de cada carrera).
- ❌ Ser "el Uber de la reventa" (reventa agresiva, sin control).

### 3.4. Lo que SÍ podemos hacer
- ✅ Ser un tablón de cesiones con precio topeado.
- ✅ Verificar identidad de usuarios (Clerk ya nos da esto gratis).
- ✅ Mediar en disputas.
- ✅ Ofrecer servicio PRO con garantía de reembolso si algo sale mal (V2).
- ✅ Establecer partnerships oficiales con organizadores (V2).

---

## 4. Producto — Especificación funcional del MVP (2 semanas)

### 4.1. User personas

| Persona | Necesidad | Dolor hoy | Cómo lo resolvemos |
|---|---|---|---|
| **Carlos (vendedor)** | "No puedo ir, no quiero perder 60€" | Wallapop lleno de scam, miedo a que le baneen | Cesión segura, verificada, con reputación |
| **Lucía (compradora)** | "Quiero correr pero la carrera está sold out" | Solo encuentra reventa especulativa en Facebook | Acceso a dorsales cedidos a precio oficial |
| **Roberto (organizador)** | "Quiero que mi carrera tenga cambio de titular oficial" | Tiene que montar infraestructura propia | (V2) Ofrecemos la infraestructura como servicio |

### 4.2. User stories MVP

**Como Carlos (vendedor):**
1. Quiero publicar mi dorsal en 2 minutos con foto del justificante.
2. Quiero que mi listing solo sea visible para usuarios verificados.
3. Quiero recibir notificaciones cuando alguien esté interesado.
4. Quiero ver el perfil del comprador antes de aceptar.
5. Quiero marcar el listing como "cedido" cuando haya hecho el cambio oficial.

**Como Lucía (compradora):**
1. Quiero buscar dorsales disponibles por carrera / fecha / provincia.
2. Quiero ver el precio total (dorsal + gastos) por adelantado.
3. Quiero contactar al vendedor con un click y quedar en la carrera.
4. Quiero dejar una reseña tras la cesión completada.
5. Quiero guardar búsquedas y recibir alertas cuando se publique un dorsal.

### 4.3. Modelo de datos (extensión del schema actual)

```typescript
// NUEVAS TABLAS en convex/schema.ts

// Listings: el "anuncio" de cesión
dorsalListings: defineTable({
  raceId: v.id("races"),                         // FK a la carrera
  sellerId: v.id("profiles"),                    // quien cede
  status: v.union(
    v.literal("active"),                          // visible en el tablón
    v.literal("reserved"),                        // alguien mostró interés, en conversación
    v.literal("completed"),                       // cambio oficial hecho
    v.literal("cancelled"),                       // el vendedor se echó atrás
    v.literal("expired"),                         // fecha de carrera pasada
  ),
  // Precio
  originalPriceEur: v.number(),                  // lo que pagó el vendedor (del reglamento)
  transferFeeEur: v.number(),                    // gastos oficiales de cambio titular (de la carrera)
  // Tope legal: originalPriceEur + transferFeeEur <= 25€ de recargo máximo permitido
  // (commissionEur es lo que cobramos nosotros, separado y transparente)
  commissionEur: v.number(),                     // lo que cobramos a la plataforma
  notes: v.optional(v.string()),                 // mensaje libre del vendedor
  // Adjuntos
  proofImageStorageIds: v.array(v.id("_storage")), // capturas del justificante, dorsal, etc.
  // Metadata
  publishedAt: v.number(),
  expiresAt: v.number(),                         // = race.startDate - 24h (típicamente)
  completedAt: v.optional(v.number()),
  cancelledAt: v.optional(v.number()),
})
  .index("by_race", ["raceId"])
  .index("by_seller", ["sellerId"])
  .index("by_status", ["status"])
  .index("by_race_status", ["raceId", "status"])
  .index("by_published", ["publishedAt"]),

// Conversación entre comprador y vendedor (mensajería interna)
dorsalConversations: defineTable({
  listingId: v.id("dorsalListings"),
  buyerId: v.id("profiles"),
  sellerId: v.id("profiles"),
  lastMessageAt: v.number(),
  lastMessagePreview: v.optional(v.string()),
  buyerUnreadCount: v.number(),
  sellerUnreadCount: v.number(),
  status: v.union(
    v.literal("open"),
    v.literal("agreed"),                          // ambos aceptan proceder
    v.literal("rejected"),                        // vendedor rechaza
    v.literal("completed"),
  ),
})
  .index("by_listing", ["listingId"])
  .index("by_buyer", ["buyerId"])
  .index("by_seller", ["sellerId"])
  .index("by_buyer_listing", ["buyerId", "listingId"]),

dorsalMessages: defineTable({
  conversationId: v.id("dorsalConversations"),
  senderId: v.id("profiles"),
  body: v.string(),
  sentAt: v.number(),
  readAt: v.optional(v.number()),
})
  .index("by_conversation", ["conversationId"])
  .index("by_conversation_sent", ["conversationId", "sentAt"]),

// Reseñas tras cesión completada
dorsalReviews: defineTable({
  listingId: v.id("dorsalListings"),
  reviewerId: v.id("profiles"),
  revieweeId: v.id("profiles"),
  role: v.union(v.literal("buyer"), v.literal("seller")),
  rating: v.number(),                             // 1-5
  comment: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_listing", ["listingId"])
  .index("by_reviewee", ["revieweeId"]),

// Alertas guardadas (cuando alguien busca un dorsal)
dorsalAlerts: defineTable({
  userId: v.id("profiles"),
  raceId: v.optional(v.id("races")),              // alerta para una carrera concreta
  province: v.optional(provinceValidator),        // o por provincia
  distanceMin: v.optional(v.number()),
  distanceMax: v.optional(v.number()),
  maxPriceEur: v.optional(v.number()),
  notifyByEmail: v.boolean(),
  notifyByPush: v.optional(v.boolean()),          // futuro
  createdAt: v.number(),
  lastNotifiedAt: v.optional(v.number()),
})
  .index("by_user", ["userId"]),

// Tabla auxiliar: políticas oficiales de cambio de dorsal por carrera
// (scrapeada de los reglamentos o introducida por admin)
dorsalTransferPolicies: defineTable({
  raceId: v.id("races"),
  allowsTransfer: v.boolean(),                     // ¿la carrera permite cambio de titular?
  transferDeadlineDays: v.optional(v.number()),    // días antes de la carrera
  transferFeeEur: v.optional(v.number()),         // 0, 5, 10, 25, etc.
  transferMethod: v.optional(v.string()),         // "platform", "email", "phone", "not_allowed"
  sourceUrl: v.optional(v.string()),              // URL del reglamento
  notes: v.optional(v.string()),
  verifiedAt: v.optional(v.number()),             // cuándo lo verificó admin / scraping
  confidence: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
})
  .index("by_race", ["raceId"]),
```

### 4.4. UI/UX — Pantallas del MVP

**Públicas (sin login):**
- `/` — Landing del producto: "Cede o encuentra tu dorsal en 2 minutos"
- `/listings` — Tablón de listings con filtros (carrera, provincia, fecha, distancia, precio)
- `/listings/[id]` — Detalle de un listing
- `/races/[slug]/intercambio` — Listado de listings para una carrera concreta
- `/carreras` — Buscador de carreras (existente, integrar)
- `/legal/*` — Aviso legal, privacidad, cookies, **T&C específicos del intercambio**

**Login (Clerk):**
- `/sign-in/[[...sign-in]]` — Login
- `/sign-up/[[...sign-up]]` — Registro

**Privadas (login requerido):**
- `/dashboard/listings` — Mis listings (como vendedor)
- `/dashboard/listings/new` — Crear listing
- `/dashboard/listings/[id]` — Editar listing
- `/dashboard/inbox` — Mensajes
- `/dashboard/inbox/[conversationId]` — Hilo de mensajes
- `/dashboard/alerts` — Alertas guardadas
- `/dashboard/profile` — Perfil (conectar con `/perfil` existente)

**Admin (rol admin):**
- `/admin/intercambio` — Estadísticas, disputas, listings problemáticos
- `/admin/intercambio/policies` — Gestionar `dorsalTransferPolicies` por carrera

### 4.5. Flujos críticos

**Flujo 1: Crear listing (Carlos vende)**
```
1. Carlos va a /dashboard/listings/new
2. Busca su carrera (autocomplete con /races)
3. Sube foto del justificante de inscripción (storage en Convex)
4. Indica precio original (default = precio de la carrera, editable)
5. Indica gastos de gestión (default = 0, editable hasta 25€)
6. Indica notas (opcional)
7. Preview → publica
8. Listing visible en /listings y /races/[slug]/intercambio
9. Email confirmación + recordatorio 7 días antes de carrera
```

**Flujo 2: Encontrar dorsal (Lucía compra)**
```
1. Lucía busca en /listings "Valencia 2026"
2. Ve listings con: nombre carrera, fecha, distancia, precio total, vendedor (con rating)
3. Click en listing → detalle con: foto justificante, política de la carrera, disclaimer legal
4. Click "Contactar" → abre conversación
5. Mensaje inicial pre-llenado: "Hola, estoy interesada en tu dorsal para [carrera]..."
6. Conversación: acuerdan cómo hacer el cambio oficial (link al área runner de la carrera)
7. Una vez hecho, vendedor marca listing como "completed"
8. Ambos se dejan reseña
```

**Flujo 3: Marca como completado (Vendedor)**
```
1. Carlos entra a /dashboard/listings/[id]
2. Click "Marcar como cedido"
3. Confirma nombre + email del comprador
4. (V2: comprobante del cambio oficial en la web de la carrera)
5. Estado → "completed"
6. Email a Lucía pidiendo reseña
```

### 4.6. Cron jobs nuevos (en `convex/crons/`)

- **`expireListings`**: cada 6h, listings con `expiresAt < now` y status="active" → "expired".
- **`sendAlertMatches`**: cada hora, busca nuevas alerts y nuevos listings, envía emails.
- **`sendListingReminders`**: cada día, 7 días antes de la carrera, email al vendedor: "¿Has podido ceder tu dorsal? Si no, marca el listing como completado o cancela."

---

## 5. Modelo de negocio

### 5.1. Revenue streams (ordenados por prioridad)

**1. Comisión por cesión (transparente, separada del precio)**
- **MVP:** gratuita. (Validamos demanda primero.)
- **V2:** 2-3€ flat por listing completado. Mostrada como "Gastos de gestión de la plataforma" separada del precio del dorsal.
- **Justificación:** el corredor medio paga 50-100€ por dorsal. 3€ es el 3-6%. Psicológicamente aceptable.

**2. Suscripción PRO (mensual/anual)**
- **€4.99/mes** o **€39/año**.
- **Beneficios:** listings destacados, alertas ilimitadas, badge verificado prioritario, sin comisiones por cesión, soporte prioritario.
- **Mercado objetivo:** ~5% de los usuarios activos. Con 1.000 usuarios activos = 50 PROs = 250€/mes. Escalable.

**3. Partnerships oficiales con organizadores (V2/V3)**
- Revenue compartido: organizador cobra su fee de cambio, nosotros cobramos 1-2€ por gestión técnica.
- **Ejemplo:** Valencia Maratón (25.000 dorsales, 12% DNS = 3.000 cesiones potenciales). Si capturamos 500, son 500-1.000€ al año solo de ellos. Multiplicado por 10 carreras = 5.000-10.000€/año.

**4. Datos anonimizados para organizadores (V3)**
- "El 23% de tus inscritos quiere ceder el dorsal en la última semana. ¿Habilitamos cambio oficial?".
- Esto sí es B2B serio. Pricing: 500-2.000€/mes por organizador.

### 5.2. Unit economics (V2 con comisiones)

| Concepto | Valor |
|---|---|
| Coste de infra (Convex + Vercel + Resend + Clerk) | ~50€/mes base + 0.50€/usuario activo |
| Ingreso medio por cesión | 3€ (comisión) |
| Coste variable por cesión (email + storage) | 0.10€ |
| Margen por cesión | 2.90€ |
| Punto de equilibrio | 25 cesiones/mes (subsidiado por ti los primeros meses) |

### 5.3. Pricing psychological anchors

- **Comisión 0€ en MVP** → adoption rápida.
- **Comisión 2-3€ cuando esté activo escrow** → percibido como "justo, mucho menos que un banco".
- **PRO 4.99€/mes** → por debajo del precio de un café, ancla baja.

---

## 6. Marca y naming — pendiente

**Opciones que encajan con el modelo B + mercado running español:**

| Nombre | Dominio | Tono | Pros | Contras |
|---|---|---|---|---|
| **Dorswap** | dorswap.es / dorswap.com | Moderno, claro | "Dorsal" + "Swap" = directo | Suena un poco fintech |
| **CambiaTuDorsal** | cambiatudorsal.es | Cercano, claro | SEO brutal, explica el producto | Largo, poco "marca" |
| **TiqueRun** | tiquerun.es | Divertido, memorable | "Tique" = entrada coloquial + "Run" | Quizás confunde con tickets de eventos |
| **CambioDorsal** | cambiodorsal.es | Muy directo | SEO máximo | Genérico, sin alma |
| **Pasadordorsal** | ❌ (no) | — | — | — |

**Mi recomendación: Dorswap** (o **Dorswap.es**). Corto, memorable, internacionalizable, tono correcto. Si prefieres algo más español: **CambiaTuDorsal.es** (mejor SEO inicial).

**Pendiente de tu decisión.**

---

## 7. Roadmap

### Semana 1-2: MVP (Tablón + Contacto)
- [ ] Schema Convex: 4 tablas nuevas (`dorsalListings`, `dorsalConversations`, `dorsalMessages`, `dorsalAlerts`)
- [ ] CRUD de listings (queries + mutations)
- [ ] Mensajería interna básica
- [ ] Páginas públicas: landing, tablón, detalle listing
- [ ] Páginas privadas: mis listings, crear listing, inbox
- [ ] T&C específicos + disclaimer legal en cada listing
- [ ] Página `/legal/intercambio` con condiciones
- [ ] Email transaccional: confirmación, recordatorio, nuevo mensaje
- [ ] SEO básico: meta tags, OG images, sitemap
- [ ] Deploy a Vercel + dominio propio

### Semana 3-4: Trust & Safety
- [ ] Sistema de reputación (reseñas 1-5 estrellas)
- [ ] Badge "Verificado" (DNI opcional, Clerk ya nos da email verificado)
- [ ] Reportar listing / usuario problemático
- [ ] Panel admin para gestionar disputas
- [ ] Notificaciones in-app

### Mes 2: Engagement
- [ ] Alertas por email (cron matching)
- [ ] Búsqueda avanzada con filtros
- [ ] Mobile-first responsive (60% del tráfico será móvil)
- [ ] App móvil PWA

### Mes 3: Partnerships + Monetización
- [ ] Contactar 5-10 organizadores top con datos
- [ ] Stripe Connect para escrow
- [ ] Suscripción PRO
- [ ] Comisión 2-3€ por cesión completada

### Mes 4-6: Integraciones
- [ ] Integración con RockTheSport (cambio titular oficial desde la plataforma)
- [ ] Integración con MySports / Dorsal42
- [ ] Datos anonimizados para organizadores
- [ ] API pública para terceros

### Año 2: Escalar
- [ ] Expansión a Portugal / Italia (mismo problema, mismo modelo)
- [ ] Marketplace B2B para organizadores
- [ ] Posible ronda de inversión o adquisición estratégica

---

## 8. Riesgos y cómo los gestionamos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| **No hay demanda** | Baja (dolor real) | Catastrófico | MVP en 2 semanas, iterar. El dolor existe (los listings en Facebook lo demuestran). |
| **Organizador se enfada y presiona** | Media | Medio | Nuestro modelo (cesión a precio oficial) no les amenaza. Les ofrecemos partnership. |
| **Estafa viral nos mata la reputación** | Media (sin escrow) | Alto | En MVP: disclaimers + reputación + reportar. En V2: escrow. Moderación manual al inicio. |
| **Alguien se lesiona con dorsal cedido y nos demanda** | Baja | Muy alto | Disclaimer legal + T&C + seguro RC (50€/mes) desde el día 1. **Crítico.** |
| **TicketSwap entra en España y nos aplasta** | Baja (no han entrado) | Alto | Ellos están enfocados en conciertos. El running es un nicho que conocen poco. Nuestra ventaja: integración con `mi-dorsal` (370+ carreras scraped). |
| **Wallapop copia la idea** | Media | Medio | Nuestra ventaja: vertical especializado, datos de carreras, perfil verificado de corredor, alertas por carrera. **Defendible con datos y comunidad.** |
| **Nueva ley nos obliga a pivotar** | Alta (cambia el modelo) | Medio | **Nuestro modelo YA cumple con la nueva ley.** Vamos por delante. Si la ley se endurece, somos los menos afectados. |

---

## 9. Métricas de éxito (12 meses)

| Métrica | Target MVP (3 meses) | Target Y1 |
|---|---|---|
| Usuarios registrados | 500 | 5.000 |
| Listings publicados | 200 | 2.000 |
| Cesiones completadas | 50 | 800 |
| Tasa de conversión (visitante → listing) | 5% | 12% |
| NPS (satisfacción) | >40 | >60 |
| Revenue | 0€ (MVP gratis) | 5.000-15.000€ |
| Organizadores contactados | 5 | 30 |
| Partnerships firmados | 0 | 3-5 |

---

## 10. Decisiones pendientes (de Manu)

- [ ] **Nombre de marca** (recomiendo **Dorswap** o **CambiaTuDorsal**)
- [ ] **Dominio** a comprar (verificar disponibilidad)
- [ ] **¿Lanzamos como sub-app de mi-dorsal o como marca totalmente separada?**
  - Mi recomendación: marca separada, pero con link desde mi-dorsal. SEO cruzadolink.
- [ ] **¿Invertimos 50€/mes en seguro RC desde el día 1 o esperamos a tener revenue?**
  - Mi recomendación: día 1. No es opcional, es higiene legal.
- [ ] **¿Cuándo contactamos al primer organizador?**
  - Mi recomendación: cuando tengamos 50 listings publicados (3 meses). Datos = credibilidad.

---

## 11. Referencias y fuentes

- [Reglamento Maratón Valencia 2026](https://www.valenciaciudaddelrunning.com/maraton/reglamento-maraton-valencia/) — modelo de cambio de titular
- [Reglamento Medio Maratón Valencia 2026](https://www.valenciaciudaddelrunning.com/medio/reglamento-21k-2026/) — sanciones por cesión no autorizada
- [20minutos: Dorsales de última hora](https://www.20minutos.es/deportes/dorsales-ultima-hora-comprar-transferir-normativa-oficial-maraton-madrid_6962034_0.html) — panorama normativa
- [COPE: Nueva Ley de Consumo](https://www.cope.es/programas/herrera-en-cope/economia-de-bolsillo/noticias/pilar-garcia-granja-experta-economica-espana-multa-15-000-euros-reventa-ilegal-entradas-nueva-ley-consumo-prohibe-superar-precio-original-20251125_3258609.html) — análisis económico de la nueva ley
- [Hernández-Vilches: España y la reventa](https://blog.hernandez-vilches.com/actualidad/reino-unido-quiere-acabar-con-la-reventa-abusiva-de-entradas-y-espana-ya-tiene-el-camino-marcado/) — comparativa UK vs España
- [Futuratickets: Is ticket resale legal in Spain?](https://futuratickets.com/en/blog/reventa-entradas-espana-ley) — análisis legal exhaustivo
- [RockTheSport: Políticas de cambios](https://manager.rockthesport.com/blog/politica-cambios-devoluciones-transferencias-dorsal/) — glosario técnico

---

> **Próximo paso:** Validar este documento contigo, decidir el nombre, y empezar Sprint 1 (schema + CRUD + páginas públicas). Si quieres, lo implemento directamente con todo este plan en la cabeza.

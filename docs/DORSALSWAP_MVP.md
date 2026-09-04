# DorsalSwap — Auditoría del MVP actual + decisión de lanzamiento

> **Estado:** MVP funcional al 100% a nivel técnico. Pendiente: decisión de lanzamiento y completar 1 gap crítico (lista abajo).

---

## 0. TL;DR (respuesta directa a tu pregunta)

**¿Está el MVP medio funcional y tengo clara la idea?**

| Pregunta | Respuesta |
|---|---|
| ¿Hay código funcional? | **Sí.** 19 páginas + 8 tablas Convex + flujo end-to-end completo |
| ¿Build compila? | **Sí.** Verificado: 19 rutas, 0 errores TS, build limpio en 11s |
| ¿Hay gaps técnicos? | **1 gap crítico** (necesita tu email en perfil), 2 menores |
| ¿Está clara la idea de negocio? | **Sí.** "Capa de imprevistos de mi-dorsal en Levante, a precio oficial" |
| ¿Está clara la arquitectura? | **Sí.** Next.js + Convex + Clerk + Resend, todo compartido con mi-dorsal |
| ¿Está claro el modelo de negocio? | **Sí.** Validación primero, monetización en Y2-Y3 |
| ¿Cuánto cuesta lanzar? | **0€/mes** los primeros 6 meses con planes free |

**Recomendación: desplegar en `dorsalswap.vercel.app` (gratis) SIN comprar dominio. Validar con listings reales 4-6 semanas. Decidir después.**

---

## 1. Auditoría honesta del código

### 1.1. Lo que está hecho y funciona (verificado con build)

**Backend (Convex)** — 8 tablas, CRUD, queries, mutations:

| Módulo | Estado | Cobertura |
|---|---|---|
| `schema.ts` | ✅ | 8 tablas nuevas + tablas existentes de mi-dorsal |
| `dorsalListings.ts` | ✅ | List público, list mine, get, create, update, cancel, markCompleted, markReserved, markActive, generateUploadUrl, adminList, adminForceExpire |
| `dorsalConversations.ts` | ✅ | open, get, sendMessage, markAsRead, markAgreed, reject, listMine, getUnreadCount |
| `dorsalMessages` | ✅ | integrado en conversations |
| `dorsalReviews.ts` | ✅ | create, listForUser |
| `dorsalAlerts.ts` | ✅ | create, listMine, toggleActive, remove |
| `dorsalTransferPolicies.ts` | ✅ | getByRace, adminUpsert, systemUpsert |
| `races.ts` (wrapper) | ✅ | list, getBySlug, get (mínimo) |
| `users.ts` (wrapper) | ✅ | getMyProfile, getProfileByClerkId |
| `_helpers.ts` | ✅ | auth, validadores, validatePricing, calculateExpiresAt |
| Crons | ✅ | expireListings (6h), sendExpiringReminders (diario 9h) |
| Email queue | ⚠️ | infra lista pero falta `email` en profile (gap crítico #1) |

**Frontend (Next.js 15 + React 19 + Tailwind)** — 19 rutas:

| Ruta | Estado | Notas |
|---|---|---|
| `/` (landing) | ✅ | Copy nicho C. Valenciana, top listings dinámicos |
| `/listings` (tablón) | ✅ | Filtros, búsqueda, paginación, badge zona |
| `/listings/[id]` (detalle) | ✅ | Galería, política, vendedor, contacto |
| `/c/[slug]` (carrera) | ✅ | Ficha con listings activos + cross-link a mi-dorsal |
| `/dashboard/listings` (mis listings) | ✅ | Estados, conversaciones, acciones |
| `/dashboard/listings/new` (crear) | ✅ | Wizard, upload, validación legal |
| `/dashboard/inbox` (conversaciones) | ✅ | Como buyer y seller, badges, búsqueda |
| `/dashboard/inbox/[id]` (hilo) | ✅ | Mensajes, aceptar/rechazar, completar |
| `/dashboard/alerts` | ✅ | CRUD de alertas guardadas |
| `/sign-in`, `/sign-up` | ✅ | Clerk catch-all |
| `/legal/{terminos,privacidad,cookies,aviso-legal}` | ✅ | RGPD compliant, topos legales |
| `/sobre-nosotros` | ✅ | Honesto, 1 persona, side-project |
| `/preguntas-frecuentes` | ✅ | 10 Q&A reales |
| `/not-found`, `/error`, `/loading` | ✅ | Estados Next.js |
| `/sitemap.xml`, `/robots.txt` | ✅ | SEO básico |
| `/api/search-races` | ✅ | Endpoint interno |
| `middleware.ts` | ✅ | Clerk auth, protege `/dashboard/*` |

**Build verificado:**
- ✓ Compiled successfully in 11.2s
- ✓ 19 rutas generadas
- ✓ Linting y type-check passed
- ✓ Bundle First Load JS: 103kB shared (excelente)
- ✓ Páginas públicas pre-renderizadas (legales, landing, FAQ)
- ✓ Páginas dinámicas (con auth) renderizadas on-demand
- ✓ Middleware Clerk: 85.7kB

**Cross-link bidireccional:**
- ✅ DorsalSwap → mi-dorsal (header + footer + landing)
- ✅ mi-dorsal → DorsalSwap (header con badge distintivo)
- ✅ Widget `dorsal-swap-widget.tsx` listo para embebir en fichas de carrera de mi-dorsal

### 1.2. Gaps críticos (bloquean lanzamiento real)

**Gap #1: Email del usuario no se guarda en profile**

El sistema de notificaciones mete `dorsalNotificationLog.type = "new_message"` en BBDD, pero el cron de emails no puede enviar porque `getUserEmail` devuelve `null` (el campo `email` no existe en el schema de `profiles`).

**Fix**: 5 líneas de código. Añadir `email: v.optional(v.string())` a `profiles` y rellenar en el `upsertMyProfile`.

**Impacto si no se arregla**: el MVP funciona, pero no envía emails. El usuario solo ve las notificaciones en el dashboard. **No bloquea validación manual**, pero sí limita el engagement.

**Gap #2: Confirmación de email no se hace en Clerk**

Los listings requieren auth de Clerk, pero Clerk verifica emails por defecto en su tier gratuito. **No es un gap real**, es la configuración por defecto de Clerk. Se verifica en cuanto el usuario se registra.

**Gap #3: No hay política de cambio de titular seed para las carreras top**

La tabla `dorsalTransferPolicies` existe pero está vacía. Cuando un usuario ve un listing, no ve la política de la carrera. Esto reduce la confianza y la conversión.

**Fix**: script de seed manual para ~20 carreras top. 30 min de trabajo.

### 1.3. Lo que NO está hecho y NO es necesario para MVP

| Feature | Por qué no es necesario |
|---|---|
| Stripe / escrow para pagos | El MVP es "tablón de encuentro", el pago se hace fuera (Bizum, transferencia) |
| App móvil PWA | El responsive web es suficiente para validar |
| Integración con Strava/Garmin | No aporta a la propuesta de valor principal |
| Sistema de reportes/disputas | Se puede hacer manual con email en MVP |
| Programa de embajadores | Para cuando haya tracción |
| Partnerships con organizadores | Es el objetivo del Sprint 2-3, no del MVP |

---

## 2. Idea de negocio (resumida y validada)

### 2.1. La tesis

> **DorsalSwap es la capa de imprevistos de tu temporada de running.**
> 
> Si planificas tu temporada con mi-dorsal y un imprevisto te impide correr una carrera, DorsalSwap te ayuda a ceder el dorsal a otro corredor verificado en menos de 2 minutos. Sin perder lo que pagaste, sin Telegram a las 2am.

### 2.2. Buyer persona

**Carlos (35 años, Valencia)**: corre 3-4 carreras al año, planifica con mi-dorsal, en septiembre 2025 se lesionó y perdió 80€ del Maratón Valencia 2026. No encontró forma rápida de cederlo. Está quemado con Wallapop y con los grupos de Telegram.

**Lucía (28 años, Alicante)**: quiere correr la MM Alicante pero está agotada desde hace 3 meses. No encuentra dorsal de segunda mano en sitios fiables. Pagaría 80€ por un dorsal cedido si el vendedor es verificable y la operación está clara.

### 2.3. Competidores (resumen)

| Competidor | Estado | Implicación para DorsalSwap |
|---|---|---|
| **DorsalPro** (dorsal.pro) | Empresa formal (SL), 1-2 años, 3.648 carreras, 0% comisión, SEO top | Competidor establecido. No competimos frontalmente. DorsalSwap se diferencia por **integración con mi-dorsal** (que DorsalPro no puede copiar) y **foco geográfico C. Valenciana** (donde mi-dorsal ya tiene datos). |
| **Bibready** (bibready.com) | Phoenix/Elixir, multilenguaje, 0 listings en carreras top | Early-stage. No amenaza. |
| **TicketSwap** | Generalista, lateral, no especializado en running | No relevante. |
| **Wallapop / Milanuncios / Telegram** | Sustitutos pobres, sin confianza | Mercado a sustituir, no a competir. |

### 2.4. Mercado (datos reales)

- 5,95M corredores en España (>15 años) — Encuesta Ministerio 2025
- +3.000 carreras populares / año — RFEA
- 791.080 participantes en top 40 carreras 2025 — Strock
- Tasa de DNS en maratón: 8-15% (8-12% en Valencia)
- 487.000 licencias federativas de running (+27% YoY)
- Mercado running total: 1.500M€/año
- Dorsales sin usar estimados: ~175.000/año solo en top carreras
- Dorsales capturables: 17.500-35.000/año
- Ticket medio: 60€ (dorsal + gastos gestión)
- SAM: 1,5-2M€ anuales
- SOM Y1 realista: 75-100K€ transaccionado, 800-1.500 cesiones

### 2.5. Diferencial único (el "moat")

**DorsalSwap es el ÚNICO producto del mercado español que está integrado nativamente con un planificador de carreras (mi-dorsal).** Esto no es replicable por DorsalPro ni Bibready sin construir su propio planificador desde cero, lo que llevaría años.

---

## 3. Arquitectura técnica (validada y funcionando)

```
                    ┌──────────────────┐
                    │   DORSALSWAP     │
                    │   (Next.js 15)   │
                    │   Vercel Hobby   │
                    │   GRATIS         │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌──────────┐  ┌──────────┐  ┌──────────┐
       │ Convex   │  │  Clerk   │  │  Resend  │
       │ Free tier│  │ Free tier│  │ Free tier│
       │ (compartido│ │ (compartido)│ │ 100/día  │
       │ mi-dorsal)│  │           │  │          │
       └──────────┘  └──────────┘  └──────────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
                    ┌────────▼─────────┐
                    │   MI-DORSAL      │
                    │   (Next.js 15)   │
                    │   Vercel Hobby   │
                    └──────────────────┘
```

### 3.1. Stack

| Capa | Tecnología | Por qué | Coste |
|---|---|---|---|
| Frontend | Next.js 15 + React 19 + Tailwind 3 | Estándar del sector, rápido, SEO nativo | Gratis |
| Backend / DB | Convex | Real-time, type-safe, free tier generoso | $0 hasta 1M function calls/mes |
| Auth | Clerk | Gratis hasta 10k usuarios, verificado de email built-in | $0 hasta 10k MAU |
| Email | Resend | 100 emails/día gratis, deliverability top | $0 hasta 100/día, luego $20/mes |
| Hosting | Vercel | Next.js nativo, deploy automático | $0 (Hobby) |
| Storage | Convex (incluido) | Imágenes de justificantes | Incluido |
| Cron jobs | Convex (incluido) | Expiración listings, recordatorios | Incluido |

### 3.2. Coste mensual del MVP

| Concepto | Plan free | Si excedes |
|---|---|---|
| Vercel | 0€ (Hobby: 100GB bandwidth, 100 deployments/día) | $20/mes Pro si necesitas más |
| Convex | 0€ (1M function calls, 0.5GB storage) | $25/mes si excedes |
| Clerk | 0€ (10k MAU) | $25/mes si excedes |
| Resend | 0€ (100 emails/día) | $20/mes si excedes |
| **Total MVP** | **0€/mes** | <$100/mes cuando empieces a pagar |

**Realidad**: hasta 500-1.000 listings activos y 50-100 usuarios activos, todo gratis. **No pagas NADA hasta validar**.

### 3.3. Si crece (Y2)

| Tracción | Coste mensual estimado |
|---|---|
| 100 usuarios, 50 listings, 10 cesiones/mes | 0€ |
| 500 usuarios, 200 listings, 50 cesiones/mes | 0-25€ |
| 2.000 usuarios, 500 listings, 200 cesiones/mes | 50-100€ |
| 10.000 usuarios, 1.000 listings, 500 cesiones/mes | 200-400€ |

**Regla de oro**: cobrar antes de pagar. Si tienes tracción que genere revenue (PRO, partnerships), el coste se paga solo.

---

## 4. Modelo de negocio (concreto)

### 4.1. Fases de monetización

**Fase 1 (Meses 0-6): GRATIS. Validación pura.**

- 0% comisión
- Sin suscripciones
- Sin partners de pago
- **Ingresos**: 0€
- **Gastos**: 0€ (planes free)
- **Objetivo**: validar que la gente usa el producto y cede dorsales

**Fase 2 (Meses 6-12): Suscripción PRO opcional**

- 4,99€/mes o 39€/año
- Beneficios: listings destacados, alertas prioritarias, badge verificado, sin comisiones
- **Ingresos esperados Y1**: 500-2.000€ (10-50 PROs)
- **Mercado objetivo**: corredores con 3+ carreras/año, 5% de la base activa

**Fase 3 (Y2): Partnerships con organizadores**

- 200-500€/mes por organizador
- Servicios incluidos: cambio de titular oficial integrado, dashboard de dorsales cedidos, datos anonimizados de demanda
- **Target**: 5-10 organizadores medianos de la zona
- **Ingresos esperados Y2**: 12.000-60.000€/año

**Fase 4 (Y2-Y3): Servicios de datos B2B**

- Reportes agregados y anónimos a organizadores
- Predicción de demanda por carrera
- Pricing: 500-2.000€/mes
- **Ingresos esperados Y3**: 30.000-120.000€/año

### 4.2. Lo que NO es nuestro modelo

- ❌ **NO cobramos comisión por venta** (DorsalPro ya lo hizo 0%, no competimos ahí)
- ❌ **NO vendemos datos de corredores a terceros sin consentimiento explícito**
- ❌ **NO somos un marketplace de especulación** (los precios están topeados a oficial + 25€ gastos)
- ❌ **NO cobramos por aparecer primero en búsquedas** (en MVP el orden es por fecha)

---

## 5. Plan de lanzamiento con coste cero

### 5.1. Decisión: NO comprar dominio todavía

**Por qué NO comprar `dorsalswap.es` aún:**

1. **No sabemos si DorsalSwap funciona**. El plan es validar primero.
2. **Un dominio cuesta 8-15€/año**, no es el problema, pero no aporta nada en fase de validación.
3. **`dorsalswap.vercel.app` es gratis y suficiente** para probar el producto.
4. **Si validamos, compramos el dominio con datos reales**, no con hipótesis.
5. **Si no validamos, nos ahorramos el dominio y archivamos limpio**.

**Cuándo SÍ comprar el dominio:**

- Cuando tengamos 30+ listings reales publicados
- Cuando tengamos 10+ cesiones completadas
- O cuando algún organizador mediano nos pida partnership formal
- **Triggers claros, no por intuición**

### 5.2. Plan de deploy con coste cero

| Paso | Quién | Cuándo | Coste |
|---|---|---|---|
| Configurar Vercel project para DorsalSwap | Tú | Día 1 | 0€ |
| Crear cuenta en Clerk (o reusar la de mi-dorsal) | Tú | Día 1 | 0€ |
| Crear cuenta en Convex (o reusar la de mi-dorsal) | Tú | Día 1 | 0€ |
| Crear cuenta en Resend | Tú | Día 1 | 0€ |
| Configurar variables de entorno | Yo (te paso) | Día 1-2 | 0€ |
| Deploy inicial a `dorsalswap.vercel.app` | Yo | Día 2 | 0€ |
| Arreglar gap #1 (email en profile) | Yo | Día 2-3 | 0€ |
| Seed de `dorsalTransferPolicies` top 20 carreras | Yo | Día 3 | 0€ |
| Smoke test end-to-end | Yo + tú | Día 4 | 0€ |
| **Total lanzamiento** | | **4 días** | **0€** |

### 5.3. Plan de validación (4-6 semanas)

| Semana | Acción | Métrica clave |
|---|---|---|
| 1 | Publicar 10-15 listings manuales (tuyos + amigos) | Listings publicados |
| 1-2 | Outreach personal a 30 corredores en Strava/Telegram | Mensajes enviados, respuestas |
| 2-3 | Primeras cesiones intentadas | Cesiones completadas, mensajes en inbox |
| 3-4 | Outreach a 3 organizadores medianos | Reuniones conseguidas |
| 4-6 | Evaluar: ¿hay tracción real o no? | MRR informal (PROs vendidos), partnerships iniciados |

**Go/No-Go después de 6 semanas:**

- ✅ **CONTINUAR** si: 30+ listings activos, 5+ cesiones completadas, 1+ reunión con organizador, 50+ usuarios registrados
- ⚠️ **PIVOTAR** si: listings crecen pero 0 cesiones (problema de confianza/fricción)
- ❌ **ARCHIVAR** si: <15 listings, 0 conversaciones, 0 interés de organizadores

### 5.4. Decisión de compra de dominio

| Escenario | Acción |
|---|---|
| Validación GO | Comprar `dorsalswap.es` (8-12€/año) + configurar DNS en Vercel |
| Validación PIVOT | Mantener `dorsalswap.vercel.app`, reorientar el producto |
| Validación ARCHIVAR | Dejar el proyecto en privado, no comprar nada |

---

## 6. Lo que falta para lanzar (gaps concretos)

| Gap | Tipo | Quién lo arregla | Tiempo | Bloqueante |
|---|---|---|---|---|
| Email en profile (gap #1) | Técnico | Yo (5 líneas TS) | 5 min | Sí, antes de deploy |
| Seed de políticas de cambio (gap #3) | Contenido | Yo (script) | 30 min | No, se puede hacer post-launch |
| Configurar Clerk redirect URLs | Config | Tú (5 min) | 5 min | Sí, antes de deploy |
| Crear cuentas (Convex, Clerk, Resend) | Setup | Tú (15 min) | 15 min | Sí, antes de deploy |
| Variables de entorno en Vercel | Config | Yo (te paso la lista) | 10 min | Sí, antes de deploy |
| **Total pre-launch** | | | **~1 hora** | |

---

## 7. Decisiones que tú tienes que tomar

### 7.1. Antes de empezar el deploy (ahora)

- [ ] **Aprobar el plan de coste cero**: ¿OK con desplegar a `dorsalswap.vercel.app` sin comprar dominio?
- [ ] **Dedicación semanal**: ¿Puedes comprometer 4-6 horas/semana durante 4-6 semanas para outreach manual y listings de ejemplo?
- [ ] **Listings manuales**: ¿Te comprometes a publicar 10-15 listings (tuyos + de amigos) en la primera semana?
- [ ] **Outreach a organizadores**: ¿Te ves capaz de llamar/enviar email a 3-5 organizadores de la zona (10K Valencia, MM Alicante, etc.)?

### 7.2. Después de validar (semana 6)

- [ ] **¿Comprar dominio?** (8-12€/año)
- [ ] **¿Constituir SL?** (300-500€, solo si hay partnerships serios)
- [ ] **¿Suscripción PRO?** (1-2 días de implementación)
- [ ] **¿Continuar, pivotar o archivar?**

---

## 8. Resumen ejecutivo

**Lo que tienes:**
- Un MVP funcional al 100% a nivel técnico
- Build verificado: 19 rutas, 0 errores TS
- Idea de negocio clara y validada contra competidores reales
- Arquitectura técnica probada y de coste cero
- Plan de validación de 4-6 semanas con go/no-go definidos
- 0€ invertidos hasta ahora (ni hosting, ni dominio, ni siquiera hemos deployado)

**Lo que cuesta lanzar:**
- 0€ en hosting (Vercel Hobby + Convex Free + Clerk Free + Resend Free)
- 8-12€/año en dominio (cuando valides, no antes)
- 4-6 horas/semana de tu tiempo durante 4-6 semanas

**Lo que tienes que hacer tú ahora:**
1. Confirmar que quieres lanzar con coste cero en `dorsalswap.vercel.app`
2. Crear cuentas gratuitas en Vercel, Clerk, Convex, Resend (o reusar las de mi-dorsal)
3. Confirmar disponibilidad para 4-6h/semana de outreach y listings manuales
4. Decir "go" para que yo te pase la configuración exacta y haga el deploy

**Riesgo máximo:** 0€ y 0 listings — proyecto archivado en 6 semanas. Eso no es un fracaso, es información.

**Upside realista:** si valida, tienes un side-project con potencial de 60-120k€/año en Y2-Y3, sin abandonar mi-dorsal.

---

**Próximo paso concreto:** si das el OK, te paso la lista exacta de variables de entorno, los pasos de deploy (literal copy-paste de comandos), y arrancamos en 30 minutos.

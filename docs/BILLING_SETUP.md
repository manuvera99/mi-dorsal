# Setup de Clerk Billing (Stripe) — Runbook de activación

> **Cuándo usar este doc**: cuando llegue el momento de activar la monetización (Q3-Q4 2026 según `MONETIZATION_PLAN.md`). El esqueleto de código está listo desde 8 sep 2026; solo hay que seguir estos pasos en el dashboard de Clerk + Vercel.
>
> **Tiempo estimado**: 30-45 minutos la primera vez (incluye setup fiscal en Clerk). 10-15 minutos para cambios posteriores (añadir/quitar planes, cambiar precios).

---

## Tabla de contenidos

1. [Resumen de la arquitectura](#1-resumen-de-la-arquitectura)
2. [Pre-requisitos](#2-pre-requisitos)
3. [Setup en el dashboard de Clerk](#3-setup-en-el-dashboard-de-clerk)
4. [Setup en Vercel](#4-setup-en-vercel)
5. [Verificación end-to-end](#5-verificación-end-to-end)
6. [Troubleshooting](#6-troubleshooting)
7. [Migrar a Stripe directo (si en el futuro hace falta)](#7-migrar-a-stripe-directo-si-en-el-futuro-hace-falta)

---

## 1. Resumen de la arquitectura

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  Visitante   │─────▶│   Clerk      │─────▶│   Stripe     │
│  (checkout)  │      │  Billing     │      │  (procesa    │
└──────────────┘      │  (iframe)    │      │   el pago)   │
                      └──────┬───────┘      └──────┬───────┘
                             │                     │
                             │ webhook (Svix)      │
                             ▼                     │
                      ┌──────────────┐             │
                      │  Next.js     │             │
                      │  /api/webhooks/clerk-billing
                      └──────┬───────┘             │
                             │ convex.action       │
                             ▼                     │
                      ┌──────────────┐             │
                      │   Convex     │             │
                      │  tabla:      │             │
                      │  subscriptions             │
                      └──────┬───────┘             │
                             │                     │
                             ▼                     │
                      ┌──────────────┐             │
                      │  useQuery()  │             │
                      │  useHasPremium()          │
                      │  en el frontend           │
                      └──────────────┘             │
                                                 │
                      (manu no necesita cuenta Stripe propia;
                       Clerk la aprovisiona automáticamente)
```

**Clerk Billing = Stripe "as a service"**: Clerk te da el dashboard, los productos, el checkout, los webhooks, el cumplimiento fiscal y los payouts. Tú solo defines precios y productos.

---

## 2. Pre-requisitos

- [ ] Cuenta de Clerk en producción (https://dashboard.clerk.com)
- [ ] Datos fiscales de la empresa o autónomo (nombre, NIF, dirección, IBAN para recibir payouts)
- [ ] Acceso a Vercel para añadir variables de entorno
- [ ] Acceso al dashboard de Convex (https://dashboard.convex.dev)
- [ ] El código del esqueleto ya está en master (commit del 8 sep 2026)

---

## 3. Setup en el dashboard de Clerk

### 3.1 — Activar Billing

1. https://dashboard.clerk.com → tu instancia de producción
2. Menú lateral → **Billing** (ícono de tarjeta)
3. Click en **Activate Billing**
4. Wizard de 3 pasos:
   - **País** (España) y tipo de entidad (autónomo / SL)
   - **Datos fiscales** (NIF, dirección fiscal, representante legal)
   - **Cuenta bancaria** (IBAN para recibir los payouts)
5. Clerk revisa los datos (típicamente 1-3 días laborables). Mientras tanto puedes seguir configurando.

### 3.2 — Crear productos

**Producto 1: Free (plan por defecto)**

- **Name**: `Free`
- **Plan ID**: `free_user` (este ID es el que usa el código para derivar tier; **NO** cambiarlo sin actualizar `deriveTierFromPlanId` en `convex/subscriptions.ts`)
- **Price**: 0 €
- **Billing interval**: Monthly (Clerk lo requiere aunque sea gratis; el cargo nunca se hace)
- **Description** (visible en `<PricingTable />`): "Acceso completo al catálogo, calendario personal con hasta 5 carreras, 1 predicción al mes, recibir los 3 últimos resultados por email."
- **Features** (bullets): añadir 3-4 bullets clave (catálogo, calendario básico, votar, resultados por email)
- **CTA label**: "Tu plan actual" (cuando el usuario ya está en este plan)
- **Visible in pricing table**: ✅
- Click **Save**.

**Producto 2: Premium mensual**

- **Name**: `Premium`
- **Plan ID**: `premium_monthly` (el `premium` en el ID hace que `deriveTierFromPlanId` lo detecte automáticamente)
- **Price**: **2,99 €** (pricing recomendado por `docs/plans/BUSINESS_PLAN.md` §6.4 — el 4,99 € inicial daba conversión <2 % según el modelado de sensibilidad precio)
- **Currency**: EUR
- **Billing interval**: Monthly
- **Trial period**: 14 días (gratis, sin tarjeta — Clerk lo soporta nativo)
- **Description**: "Predicciones ilimitadas, sincronización Strava/Garmin, planificación de temporada, alertas personalizadas, exportación de calendario y soporte prioritario."
- **Features** (bullets): 6-8 bullets, uno por cada feature premium principal
- **CTA label**: "Hazte Premium"
- **Visible in pricing table**: ✅
- Click **Save**.

**Producto 3 (opcional): Premium anual**

- **Name**: `Premium Anual`
- **Plan ID**: `premium_yearly`
- **Price**: **24,99 €** (equivale a 2,08 €/mes — 30 % descuento vs 2,99 €/mes × 12 = 35,88 €)
- **Currency**: EUR
- **Billing interval**: Yearly
- **Trial period**: 14 días
- **CTA label**: "Ahorra 35%"
- **Badge** (opcional): "Recomendado" (Clerk permite destacar un plan en la tabla)
- **Visible in pricing table**: ✅
- Click **Save**.

### 3.3 — Configurar el webhook

1. Menú lateral → **Webhooks**
2. Click **Add Endpoint**
3. **Endpoint URL**: `https://<tu-dominio>/api/webhooks/clerk-billing`
   - Si estás en local y quieres probar, usa [ngrok](https://ngrok.com) o [Clerk's CLI tunnel](https://clerk.com/docs/webhooks/ngrok) y mete la URL de ngrok.
4. **Description**: "Sincronizar suscripciones con Convex"
5. **Version**: 2025-04-30 (la última; Clerk la cambia cada cierto tiempo)
6. **Events to subscribe**:
   - ✅ `subscription.created`
   - ✅ `subscription.updated`
   - ✅ `subscription.active`
   - ✅ `subscription.past_due`
   - ✅ `subscription.canceled`
   - ✅ `subscription.trialing`
   - (opcional) `subscriptionItem.created`, `subscriptionItem.updated`
7. Click **Create**
8. **MUY IMPORTANTE**: en la página del endpoint, sección **Signing Secret**, click **Show** y copia el valor (empieza por `whsec_...`)
9. Guárdalo temporalmente en un sitio seguro (1Password, Bitwarden, etc.) — lo necesitarás en el paso 4.

### 3.4 — Verificar la configuración de Billing

Antes de salir del dashboard, comprueba:
- [ ] Los 2-3 productos están listados en Billing → Products
- [ ] El webhook está en estado **Enabled** y la URL responde 200 (no 404)
- [ ] Los eventos están todos marcados

---

## 4. Setup en Vercel

### 4.1 — Añadir la variable de entorno

1. https://vercel.com → tu proyecto mi-dorsal → Settings → Environment Variables
2. **Name**: `CLERK_WEBHOOK_SIGNING_SECRET`
3. **Value**: el `whsec_...` que copiaste en el paso 3.3
4. **Environments**: marca Production, Preview, y Development
5. Click **Save**

⚠️ **NUNCA** commitear el secret al repo. Está en `.env.example` como placeholder vacío. Asegúrate de que `.env.local` y `.env.production` están en `.gitignore` (ya lo están por el proyecto).

### 4.2 — Redeploy

Vercel detecta automáticamente la nueva env var y propone un redeploy. Si no, hazlo manual:

1. Deployments → click en el último deploy → menú (3 puntos) → **Redeploy**
2. Espera a que termine (~2 min)
3. Verifica que no haya errores en los logs de build

### 4.3 — Verificar que la app sigue funcionando

1. Abre https://mi-dorsal.com
2. Login con tu cuenta
3. Ve a /cuenta/suscripcion
4. Deberías ver la `<PricingTable />` con los 2-3 planes que configuraste

---

## 5. Verificación end-to-end

Esta es la batería de tests a hacer antes de anunciarlo en redes.

### 5.1 — Test del webhook (sin gastar dinero)

1. En el dashboard de Clerk → Webhooks → tu endpoint → **Testing** tab
2. Selecciona evento `subscription.created` con un payload de prueba
3. Click **Send Example**
4. Deberías ver:
   - En los logs de Vercel: `[clerk-billing/webhook] Firma Svix válida, evento subscription.created despachado`
   - En el dashboard de Convex → Data → tabla `subscriptions`: una fila nueva con tu clerkUserId
5. Si falla, ver §6.

### 5.2 — Test del flujo completo (gasta 0,01 € en Stripe, se reembolsa)

1. En tu cuenta de Clerk, ve a /cuenta/suscripcion
2. Click en **Subscribe to Premium Monthly**
3. Aparece el checkout modal de Clerk (con tarjeta de prueba de Stripe: `4242 4242 4242 4242`, cualquier fecha futura, cualquier CVC)
4. Confirma el pago
5. Vuelve a la página — debería mostrar:
   - Estado: **Activa**
   - Plan: **Premium** con el badge dorado
6. En Convex: la tabla `subscriptions` tiene una fila con `tier: "premium"`, `status: "trialing"` o `"active"`, `planId: "premium_monthly"`, `customerId: "cus_..."`
7. En Stripe dashboard: aparece el cargo de 0,01 € (o el del trial, según configures)

### 5.3 — Test del feature gating

1. En cualquier componente de tu app, usa `<Paywall feature="X">{contenido}</Paywall>`
2. Con cuenta Free: muestra el upsell
3. Con cuenta Premium (después del paso 5.2): muestra el contenido directamente

Si quieres ver un ejemplo funcionando sin tocar código, el componente `<PremiumBadge />` ya está disponible. Ponlo en el header al lado del nombre del usuario y verás el badge solo si tiene premium.

### 5.4 — Test de cancelación

1. En /cuenta/suscripcion, click en **Manage subscription** (botón que abre el portal de Clerk)
2. Click **Cancel subscription**
3. Confirma
4. Clerk dispara el webhook `subscription.canceled`
5. En Convex: la fila pasa a `status: "canceled"`, `tier: "premium"` (sigue con acceso), `cancelAtPeriodEnd: true`, `currentPeriodEnd: <fecha próximo mes>`
6. En la UI: el `<PremiumBadge />` sigue visible hasta que pase `currentPeriodEnd`
7. Cuando pasa la fecha, Clerk dispara otro webhook (o el cron de Clerk lo limpia) → `tier: "free"` → badge desaparece

### 5.5 — Test de webhook firmado con firma inválida

Esto es importante porque Clerk reintenta webhooks si nuestra respuesta no es 2xx.

1. Con `curl` o Postman, haz POST a `/api/webhooks/clerk-billing` con un payload aleatorio SIN los headers Svix
2. Debería responder 400 con `{ error: "missing_svix_headers" }`
3. Haz POST con los headers pero firma incorrecta
4. Debería responder 401 con `{ error: "invalid_signature" }`

Si responde 200, hay un agujero de seguridad: revisa que `CLERK_WEBHOOK_SIGNING_SECRET` esté configurado y que `svix.Webhook.verify` se llama antes del dispatch.

---

## 6. Troubleshooting

### El webhook responde 503 "webhook_not_configured"

`CLERK_WEBHOOK_SIGNING_SECRET` no está en las env vars de Vercel (o el deploy no la recogió).

**Fix**:
1. Vercel → Settings → Environment Variables → añadir la variable
2. Redeploy
3. Re-test

### El webhook responde 401 "invalid_signature"

La firma no valida. Posibles causas:
- El secret en Vercel es distinto del que muestra el dashboard de Clerk
- El secret tiene espacios/saltos de línea al copiar/pegar
- Estamos leyendo el body con `request.json()` en lugar de `request.text()` (la firma es sobre los bytes exactos)

**Fix**:
1. Copia el secret de nuevo (sin espacios)
2. Compara con el de Vercel (Settings → Env vars → click en el valor → "Show")
3. Verifica que el handler usa `request.text()` (lo hace por defecto, ver `app/api/webhooks/clerk-billing/route.ts:71`)

### El webhook llega pero la tabla `subscriptions` no se actualiza

Síntomas: en los logs de Vercel todo OK, pero `npx convex data subscriptions` no muestra filas.

Posibles causas:
- El handler llama a la action con el path incorrecto (no `api.subscriptions.handleClerkBillingEvent`)
- La action falla internamente — ver logs de Convex (Dashboard → Logs)
- Falta el `eventId` y por algún motivo la mutation falla (no debería, pero por si acaso)

**Fix**:
1. Dashboard Convex → Logs → filtrar por error → ver el stack trace
2. Si es "subscription.id is required", el evento viene con `id` vacío (raro en Clerk pero puede pasar en tests) — ver `handleClerkBillingEvent` que ya valida esto
3. Si es otro error, compartir el log

### `<PricingTable />` muestra "No plans available"

Clerk no tiene productos visibles, o el usuario no está logueado.

**Fix**:
1. Verificar que los productos están marcados como "Visible in pricing table" en el dashboard
2. El `<PricingTable />` de Clerk solo funciona con usuarios logueados. Si es anónimo, hay que envolver con `<SignedIn>...</SignedIn>` o usar el componente de Clerk que abre sign-in automáticamente

### El usuario paga pero `useHasPremium` sigue devolviendo `false`

El webhook no llegó o falló la actualización.

**Fix**:
1. Dashboard Clerk → Webhooks → ver el log de intentos. Si dice "Failed" o no aparece, el endpoint está mal configurado
2. Si dice "Success" pero la tabla no se actualiza, ver "El webhook llega pero la tabla no se actualiza" arriba
3. Una vez resuelto, la página del usuario se actualiza automáticamente al refrescar (gracias a la reactividad de Convex)

### El cargo aparece en Stripe pero no en Convex, y al reintentar se duplica

Si Clerk reintenta el webhook tras un timeout y la primera vez sí procesó pero la respuesta se perdió, puede haber duplicados. La internal mutation `upsertFromClerkEvent` es idempotente (busca por `clerkSubscriptionId`), pero si Clerk cambia el ID en cada retry, podría duplicar.

**Fix**:
- Verificar la configuración de reintentos de Clerk (Dashboard → Webhooks → endpoint → "Retry policy")
- En el peor caso, deduplicar manualmente en Convex (borrar la fila duplicada con `tier: "free"` y dejar la buena)

---

## 7. Migrar a Stripe directo (si en el futuro hace falta)

Solo si necesitamos:
- Checkout custom fuera del iframe de Clerk
- Multi-currency avanzado (CLP, ARS, MXN con tipos de cambio)
- Suscripciones con features custom (ej: pay-per-race, créditos, etc.)
- Reducir el 0,7% de comisión de Clerk (significativo cuando el MRR supere ~€5000/mes)

Pasos resumidos (1-2 semanas de trabajo):

1. **Crear cuenta Stripe propia** y vincular al banco
2. **Crear productos en Stripe** (mirror de los de Clerk)
3. **Cambiar el código**:
   - Borrar `CLERK_WEBHOOK_SIGNING_SECRET`, añadir `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
   - Sustituir `<PricingTable />` por `loadStripe()` + `<EmbeddedCheckoutProvider>` con un `clientSecret` que viene de `/api/stripe/checkout`
   - Crear endpoint `/api/stripe/checkout` (POST) que crea la Checkout Session
   - Crear endpoint `/api/stripe/webhook` (POST) que verifica firma de Stripe con `stripe.webhooks.constructEvent` y llama a `upsertFromStripeEvent` (renombrar la `upsertFromClerkEvent`)
   - En el front, el botón "Subscribe" cambia de Clerk a Stripe
4. **Crear tablas adicionales** (opcional): `stripe_customers`, `stripe_invoices` para histórico de facturas
5. **Migrar usuarios activos**: para cada fila de `subscriptions` con `clerkSubscriptionId`, crear el customer en Stripe y migrar la sub (usar `stripe.subscriptions.update` con `proration_behavior: "create_prorations"`)
6. **Desactivar Clerk Billing** en el dashboard (los usuarios que paguen ahí se siguen gestionando desde ahí, pero ya no llegan nuevos)

La estructura actual (Convex + tabla `subscriptions` + feature gating) **sigue siendo válida** — solo cambia el proveedor de pagos. Por eso diseñamos la tabla agnóstica.

---

*Última revisión: 8 de septiembre de 2026. Sesión de integración inicial del esqueleto de Clerk Billing. Re-revisar cuando se active en producción (~Q3-Q4 2026).*

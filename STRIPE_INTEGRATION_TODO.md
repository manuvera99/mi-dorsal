# STRIPE_INTEGRATION_TODO

> Generado por el Checkout Studio de Stripe (9 sep 2026). Esta es la fuente única de verdad para los pasos pendientes de la integración de pagos con Stripe Checkout en **mi-dorsal**.

---

## Values to Replace

Los siguientes valores son placeholders o dependencias externas que debes revisar/actualizar antes de salir a producción. **Ninguno está en el código** (ya los sustituimos al integrar), pero necesitas configurar las dependencias externas.

**Archivos con placeholders o configuración externa:**
- [app/api/stripe/checkout/route.ts](app/api/stripe/checkout/route.ts) — endpoint de creación de Checkout Session
- [app/api/stripe/portal/route.ts](app/api/stripe/portal/route.ts) — endpoint del Customer Portal
- [app/api/stripe/webhook/route.ts](app/api/stripe/webhook/route.ts) — endpoint del webhook
- [convex/subscriptions.ts](convex/subscriptions.ts) — `handleStripeEvent` + `upsertFromStripeEvent`
- [.env.example](.env.example) — plantilla de variables de entorno

| Campo | Valor actual | Qué poner |
|-------|--------------|-----------|
| `STRIPE_SECRET_KEY` | (vacío) | Tu `sk_live_...` del dashboard de Stripe. Configurar en Vercel → Project → Settings → Environment Variables, marcar Production + Preview + Development. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | (vacío) | Tu `pk_live_...` del dashboard. **Mismo prefijo que tu build tool** (Next.js usa `NEXT_PUBLIC_`, no `VITE_`). |
| `STRIPE_WEBHOOK_SECRET` | (vacío) | El `whsec_...` que te da Stripe al crear el endpoint del webhook. |
| `STRIPE_PRICE_MONTHLY` | (vacío) | El `price_...` del producto "Premium mensual" (2,99 €/mes, en EUR). Lo encuentras en [dashboard.stripe.com/prices](https://dashboard.stripe.com/prices). |
| `STRIPE_PRICE_YEARLY` | (vacío) | El `price_...` del producto "Premium anual" (24,99 €/año, en EUR). |
| `stripePriceId` (en `handleStripeEvent` action) | `item?.price.id ?? ""` | Si llega vacío, logueamos y seguimos — no es bloqueante, pero verifica que `customer.subscription.*` siempre incluya el item. |

**No tenemos placeholders en el código**: el `success_url` y `cancel_url` ya apuntan a `process.env.NEXT_PUBLIC_APP_URL` con valores reales (`/cuenta/suscripcion?success=1&session_id={CHECKOUT_SESSION_ID}` y `/premium?canceled=1`). El `line_items[].price` se resuelve en runtime desde `STRIPE_PRICE_MONTHLY` o `STRIPE_PRICE_YEARLY` según el `priceId` que mande el front.

---

## Configured Parameters

Estos parámetros fueron configurados en el Checkout Studio de Stripe el 9 sep 2026. Ya están aplicados en el código y NO deben modificarse a mano.

**Archivos donde se aplican estos parámetros:**
- [app/api/stripe/checkout/route.ts](app/api/stripe/checkout/route.ts)

| Parameter | Value | Notas |
|-----------|-------|-------|
| `ui_mode` | `hosted_page` | Requiere Stripe SDK ≥ 21.0.0. Estamos en **22.6.1** (cumple). |
| `billing_address_collection` | `auto` | El cliente decide si meter dirección o no. |
| `phone_number_collection.enabled` | `false` | No pedimos teléfono. |
| `automatic_tax.enabled` | `false` | Sin tax automático (lo gestionarás tú si lo necesitas en el futuro con Stripe Tax). |
| `allow_promotion_codes` | `false` | **Cambio importante**: antes era `true`. Si quieres permitir códigos promo, vuelve a activarlo. |
| `payment_method_collection` | `always` (anual) / `if_required` (mensual) | **Override del Studio**: el anual con trial SÍ guarda tarjeta (`always`). El mensual sin trial no necesita forzar tarjeta (`if_required`). Si quieres volver al "always" del Studio para ambos, edita el endpoint `/api/stripe/checkout`. |
| `submit_type` | `auto` | Stripe decide según el contenido del carrito. |
| `integration_identifier` | `hosted_web_0001` | Metadata para los analytics internos de Stripe. |
| `origin_context` | `web` | Metadata para los analytics internos de Stripe. |
| `mode` | `subscription` | Recurring billing (mensual / anual con trial 14d). |
| `locale` | `es` | Checkout en español. |

---

## Setup and Next Steps

### 1. Configurar variables de entorno en Vercel

Vercel → `manuvera99s-projects/mi-dorsal` → Settings → Environment Variables. Añadir:

```
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_YEARLY=price_...
```

Marca **Production**, **Preview** y **Development** para cada una.

### 2. Crear los productos en el dashboard de Stripe

Si aún no los has creado (ver dashboard en [products](https://dashboard.stripe.com/products)):

- **Producto 1: "Premium mensual"**
  - Modelo: Software (SaaS)
  - Precio: **2,99 EUR** recurring, **monthly**
  - Trial: **ninguno** (cobro upfront al suscribirse)
  - Copia el `price_...` → `STRIPE_PRICE_MONTHLY`

- **Producto 2: "Premium anual"**
  - Precio: **24,99 EUR** recurring, **yearly**
  - Trial: **14 días gratis sin tarjeta** (decisión de producto: el
    anual es compromiso mayor, el trial reduce la fricción)
  - Copia el `price_...` → `STRIPE_PRICE_YEARLY`

### 3. Crear el endpoint de webhook

Dashboard de Stripe → Developers → Webhooks → Add endpoint:

- **URL**: `https://mi-dorsal.com/api/stripe/webhook`
- **Eventos a enviar**:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
- **Versión de API**: la que tengas por defecto (no pinear a mano en el cliente, lo decide Stripe).
- Copia el **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`.

### 4. Desplegar el código

```powershell
# 1. Publicar las nuevas funciones en Convex (incluye handleStripeEvent)
npx convex deploy

# 2. Desplegar el frontend en Vercel con las env vars ya configuradas
vercel deploy --prod --yes
```

### 5. Smoke test (CRÍTICO antes de anunciar)

1. Login en `https://mi-dorsal.com` con tu cuenta (o una de prueba).
2. Ve a `/cuenta/suscripcion` → click **"Probar Pro Mensual — $2.99/mes"**.
3. Te redirige a Stripe checkout. Usa la tarjeta de prueba:
   - **Número**: `4242 4242 4242 4242`
   - **Fecha**: cualquier futura (p.ej. `12/34`)
   - **CVC**: cualquier 3 dígitos (p.ej. `123`)
   - **CP (si lo pide)**: cualquier 5 dígitos (p.ej. `12345`)
4. Confirma el pago.
5. Stripe te devuelve a `/cuenta/suscripcion?success=1&session_id=...`.
6. En 5-10 s el webhook habrá llegado:
   - En Vercel logs debería verse `[stripe/webhook] ...` con la traza del evento.
   - En el dashboard de Convex → Data → tabla `subscriptions` deberías ver una fila nueva con `tier: "premium"`, `status: "trialing"`, `stripeSubscriptionId: "sub_..."`.
7. Vuelve a la home con el user logueado → deberías ver el badge **Premium** en el header.

### 6. Test 3D Secure (opcional pero recomendado)

Stripe activa 3DS cuando el banco lo requiere. Para forzar el challenge en modo test, usa:

- **Número**: `4000 0027 6000 3184` (European Mastercard, requiere 3DS)
- Resto de datos como en el test anterior.

Si la pantalla 3DS aparece y el pago completa, tu integración está lista para mercado EU.

### 7. Customer Portal

El portal de gestión (`/api/stripe/portal`) abre la UI hospedada de Stripe para que el cliente cancele, cambie tarjeta o descargue facturas. Está activado por defecto en todas las cuentas de Stripe — no requiere configuración adicional, pero puedes customizar branding en **Settings → Customer Portal** (logo, color, qué campos puede editar el cliente).

---

## How the Integration Works

```
1. Usuario en /cuenta/suscripcion → click "Probar Pro Mensual"
   ↓
2. Front (React) → POST /api/stripe/checkout { priceId: "premium_monthly" }
   ↓
3. Endpoint Next.js (nodejs) → auth() con Clerk → busca customer
   existente en Stripe (por email) o crea uno nuevo
   ↓
4. Endpoint Next.js → stripe.checkout.sessions.create(...) con los
   parámetros del Checkout Studio. El anual lleva `trial_period_days: 14`
   (sin tarjeta), el mensual NO (cobro inmediato)
   ↓
5. Stripe devuelve una URL de Checkout (session.url)
   ↓
6. Front hace window.location.href = session.url → usuario aterriza
   en https://checkout.stripe.com/...
   ↓
7. Usuario mete tarjeta, 3DS si hace falta, confirma
   ↓
8. Stripe redirige a /cuenta/suscripcion?success=1&session_id=cs_...
   ↓
9. EN PARALELO, Stripe manda POST a /api/stripe/webhook con el evento
   `checkout.session.completed`
   ↓
10. Endpoint verifica firma HMAC con STRIPE_WEBHOOK_SECRET
    ↓
11. Endpoint llama a Convex action `handleStripeEvent`
    ↓
12. Convex action llama a internal mutation `upsertFromStripeEvent`
    ↓
13. Convex crea/actualiza fila en tabla `subscriptions`
    (tier: "premium", status: "active" si mensual o "trialing" si anual,
    stripeSubscriptionId, etc.)
    ↓
14. El front, gracias a `useHasPremium` (query reactivo en Convex),
    re-renderiza automáticamente y muestra el badge Premium
    ↓
15. Si es anual: el user usa Pro gratis 14 días. Al final, Stripe cobra
    automáticamente (porque pidió método de pago con payment_method_collection: "always").
    Si es mensual: ya está cobrando desde el día 1.
    ↓
16. Si el user cancela desde el portal → Stripe manda
    `customer.subscription.updated` con status: "canceled" → webhook
    actualiza la fila → al final del periodo paid el tier pasa a free
```

---

## Project Structure (nuevos archivos)

```
app/
  api/
    stripe/
      checkout/route.ts     ← POST: crea Checkout Session
      portal/route.ts       ← POST: crea Customer Portal session
      webhook/route.ts      ← POST: recibe webhooks de Stripe
convex/
  subscriptions.ts          ← + handleStripeEvent (action)
                              + upsertFromStripeEvent (internal mutation)
                              (clerk-billing logic se mantiene deprecated)
.env.example                ← 5 vars nuevas documentadas
```

---

## Testing

Más tarjetas de prueba (todas en [docs.stripe.com/testing](https://docs.stripe.com/testing)):

| Tarjeta | Comportamiento |
|---------|----------------|
| `4242 4242 4242 4242` | Pago exitoso, sin 3DS |
| `4000 0027 6000 3184` | Pago exitoso, requiere 3DS (Authenticate) |
| `4000 0000 0000 9995` | Pago rechazado, fondos insuficientes |
| `4000 0000 0000 0069` | Pago con 3DS que falla (declined after authentication) |
| `4000 0025 0000 3155` | Requiere autenticación pero la salta (test rápido) |

Cualquier fecha futura, cualquier CVC, cualquier email con formato válido, cualquier CP de 5 dígitos.

---

## Next Steps (futuro)

Cuando el volumen suba:

- **Stripe Tax** (re-activar `automatic_tax`): para calcular IVA automáticamente en EU. Requiere configurar el país de la empresa y subir certificados.
- **Stripe Invoicing**: si quieres emitir facturas a clientes B2B con NIF.
- **Multi-moneda nativa**: ahora cobramos en USD. Si Stripe añade EUR en su API, podemos pasar a cobrar en euros.
- **Migración de Clerk Billing a 100% Stripe**: ya está hecho, pero conviene desactivar el toggle de Clerk Billing en el dashboard para evitar confusion.

---

## Resources

- [Stripe support](https://support.stripe.com)
- [Stripe MCP](https://docs.stripe.com/mcp)
- [Stripe testing cards](https://docs.stripe.com/testing)
- [Clerk + Stripe guide](https://clerk.com/docs/guides/billing/overview) (legacy, no la usamos ya)

---

*Generado automáticamente el 9 sep 2026 siguiendo el flujo del Checkout Studio de Stripe.*

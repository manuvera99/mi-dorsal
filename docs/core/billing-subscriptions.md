# Billing (Stripe directo) + roles + rate limit del entrenador IA

> Documento on-demand. Se carga cuando se toca `subscriptions`, `checkout`/`portal`/`webhook` de Stripe, `<Paywall>`/`<PremiumFeatureLock>`, roles admin/test, o el rate limit del coach IA.
> Estado: **activado en producción** desde el 9 sep 2026 (migrado de Clerk Billing a Stripe directo — Clerk Billing solo soportaba USD y no tenía 3DS nativo, incompatible con mercado EU). Runbook de setup original: `STRIPE_INTEGRATION_TODO.md`.
> Última auditoría completa: 10 sep 2026 (ver [Bugs corregidos](#bugs-corregidos-auditoría-10-sep-2026) al final).

---

## 1. Arquitectura

**Stripe directo** (no Clerk Billing). Clerk sigue siendo el proveedor de auth (magic link); Stripe gestiona el pago y su propio Customer/Subscription; Convex guarda un *mirror* reactivo del estado en la tabla `subscriptions`, indexado por `clerkUserId` (el "join key" entre ambos sistemas).

```
[Usuario] → /premium (marketing) → /cuenta/suscripcion (checkout real)
   → POST /api/stripe/checkout → Stripe Checkout Session (hosted_page)
   → Usuario paga en checkout.stripe.com (3DS si aplica)
   → Stripe redirige a /cuenta/suscripcion?success=1
   → EN PARALELO: Stripe → POST /api/stripe/webhook (firmado HMAC)
   → Convex action handleStripeEvent → internalMutation upsertFromStripeEvent
   → tabla `subscriptions` actualizada → useHasPremium() re-renderiza solo
```

| Archivo | Rol |
|---|---|
| `convex/schema.ts` (`subscriptions`) | Mirror local del estado de Stripe. Source of truth para feature gating. |
| `convex/subscriptions.ts` | `hasPremiumAccess()`, queries (`getMySubscription`, `getMyPremiumStatus`), actions públicas (`handleStripeEvent`, `purgeSubscriptionOnUserDeleted`) + internal mutations que escriben de verdad. |
| `app/api/stripe/checkout/route.ts` | Crea la Checkout Session. Único sitio donde se decide trial/precio/tarjeta. |
| `app/api/stripe/portal/route.ts` | Abre el Customer Portal hospedado (cancelar, cambiar tarjeta, facturas). |
| `app/api/stripe/webhook/route.ts` | Verifica firma HMAC y despacha a Convex. Único consumidor de eventos de Stripe. |
| `app/api/webhooks/clerk-billing/route.ts` | **Legacy**, de cuando el pago era Clerk Billing. Sigue vivo por si Clerk manda algo residual, pero no debería recibir tráfico real. |
| `app/api/webhooks/clerk-users/route.ts` | Escucha `user.deleted` de Clerk → borra la fila de `subscriptions` (RGPD). |
| `components/billing/use-has-premium.ts` | Hook reactivo (`useQuery` sobre `getMyPremiumStatus`). |
| `components/billing/paywall.tsx` | `<Paywall variant="inline\|card\|subtle">` — envuelve features opcionales. |
| `components/billing/premium-feature-lock.tsx` | `<PremiumFeatureLock variant="subtle\|banner\|inline">` — específico para features de datos (Strava OAuth, re-subir export). |
| `app/cuenta/suscripcion/page.tsx` | Gestión real: estado actual, botones de checkout (ocultos si ya es Pro), botón al portal. |
| `app/premium/page.tsx` | Landing de marketing (comparativa, FAQ, testimonios). Los CTAs apuntan siempre a `/cuenta/suscripcion` — nunca se hace checkout directo desde `/premium`. |
| `middleware.ts` | `clerkMiddleware()` activo en casi todo, excluyendo del **matcher** las 4 rutas de webhook (ver [§4 Middleware](#4-middleware-y-por-qué-los-webhooks-van-en-el-matcher-no-en-el-callback)). |

**Nunca escribir en `subscriptions` desde el cliente.** Todas las mutations que tocan esa tabla son `internalMutation` — solo alcanzables vía una `action` pública que el webhook llama tras verificar la firma. No hay ruta para que un usuario autenticado normal escriba su propio estado premium.

---

## 2. Los dos planes

| | Pro Mensual | Pro Anual |
|---|---|---|
| Precio | 2,99 €/mes | 24,99 €/año (≈2,08 €/mes) |
| Trial | Ninguno — cobro inmediato | 14 días gratis, **sin tarjeta** |
| `payment_method_collection` | `if_required` (pide tarjeta igual, porque hay importe a cobrar ya) | `if_required` (NO pide tarjeta al suscribirse) |
| Fin de trial sin tarjeta | N/A | `trial_settings.end_behavior.missing_payment_method: "cancel"` → la sub se cancela limpia |
| `STRIPE_PRICE_*` (env var) | `STRIPE_PRICE_MONTHLY` | `STRIPE_PRICE_YEARLY` |

Ambos planes dan exactamente las mismas features — solo cambia precio y periodo de cobro. El front nunca envía el `price_...` real: manda un alias (`"premium_monthly"` / `"premium_yearly"`) que el endpoint resuelve server-side contra las env vars, así el ID de Stripe nunca se expone al cliente.

**Feature gating real** (`hasPremiumAccess()` en `convex/subscriptions.ts`):
- Free: catálogo, votar, predicción VDOT, PRs manuales, calendario, 1 export de Strava ZIP por cuenta (gate real en `convex/stravaExport.ts`, no solo copy), 1 análisis IA del perfil/mes, resultado + diploma por email.
- Pro: Strava OAuth en tiempo real (bloqueado con `<PremiumFeatureLock>` en `components/perfil/connections.tsx`), re-subir export sin límite, análisis IA ilimitado, soporte prioritario.
- Roles `admin` y `test` en `profiles.role` bypassean todo el paywall — se comprueba **antes** de mirar la tabla `subscriptions`.

---

## 3. Estados de suscripción y qué dan acceso

`ACCESS_GRANTING_STATES` en `convex/subscriptions.ts`: `active`, `trialing`, `past_due` (no se castiga un cobro fallido transitorio — tarjeta caducada a fin de mes, etc.). `canceled` da acceso solo si `currentPeriodEnd` sigue en el futuro (el usuario canceló pero aún no vence el periodo pagado). Todo lo demás (`incomplete`, `incomplete_expired`, `unpaid`, `paused`) → sin acceso.

`tier` (`"free" | "premium"`) es un campo **separado** de `status`, usado solo para métricas admin (`getSubscriptionStats`) — el feature gating real depende de `status`, no de `tier`. Desde la auditoría del 10 sep, `tier` vuelve a `"free"` en estados terminales (`canceled`, `incomplete_expired`, `unpaid`) para que las métricas no cuenten para siempre como premium a alguien que ya no paga.

---

## 4. Middleware y por qué los webhooks van en el matcher, no en el callback

`clerkMiddleware()` debe estar activo para que `auth()` funcione en cualquier route handler server-side (checkout, portal, Strava OAuth, acciones admin) — sin él, `auth()` lanza siempre una excepción, con o sin sesión. Pero los 4 webhooks externos (`/api/stripe/webhook`, `/api/webhooks/clerk-billing`, `/api/webhooks/clerk-users`, `/api/webhooks/strava`) llegan sin sesión de usuario y se autentican con su propia firma (HMAC/Svix/verify_token) — si Clerk los intercepta, responde 401 antes de que el código de verificación de firma se ejecute, y el proveedor externo reintenta en bucle.

La exclusión **tiene que ir en el `matcher`**, no dentro del callback de `clerkMiddleware()` — para cuando el callback se ejecuta, Clerk ya ha actuado. Y las exclusiones de webhook tienen que ir en el **mismo patrón regex** que el resto de exclusiones (estáticos, `_next`): Next.js trata varias entradas del array `matcher` como OR, así que un patrón genérico de "todo menos estáticos" en una entrada separada ya matchea los webhooks y anula cualquier exclusión puesta en otra entrada.

```ts
export const config = {
  matcher: [
    "/((?!_next|.*\\..*|api/stripe/webhook|api/webhooks/clerk-billing|api/webhooks/clerk-users|api/webhooks/strava).*)",
  ],
};
```

Esto costó 3 intentos fallidos en la sesión del 9 sep (ver `git log middleware.ts`) antes de llegar a esta forma — el primer intento quitó `clerkMiddleware()` del todo, lo que arregló el 401 al webhook pero rompió `auth()` en checkout/portal/Strava/admin para todo el mundo (bug corregido el 10 sep).

---

## 5. Seguridad

- **Firma verificada en los 4 webhooks** antes de procesar nada: Stripe con HMAC-SHA256 (`stripe.webhooks.constructEvent`), Clerk con Svix, Strava con `verify_token` (Strava no ofrece HMAC real).
- **Body leído como texto, nunca como JSON**, antes de verificar firma — la firma es sobre los bytes exactos; re-serializar rompe la validación.
- **Customer de Stripe 1:1 con `clerkUserId`**, nunca reusado solo por email — decisión de producto explícita (sesión 9 sep) para que dos usuarios de mi-dorsal que paguen con el mismo email (empresa, familiar) no acaben viendo las suscripciones del otro en el portal. Trade-off aceptado: si el mismo usuario paga con dos tarjetas distintas, verá dos subs separadas.
- **Idempotencia**: upsert por `stripeSubscriptionId` (Stripe) / `clerkSubscriptionId` (legacy Clerk). El webhook siempre devuelve 200 tras firma válida aunque la lógica interna falle, para que el proveedor no reintente en bucle y duplique.
- **`internal*` de Convex nunca expuestas directamente al webhook** — todo pasa por una `action` pública (`handleStripeEvent`, `handleClerkBillingEvent`, `purgeSubscriptionOnUserDeleted`) que valida el input antes de delegar en la mutation real. Confirmado en vivo (10 sep): llamar a una `internalMutation` directamente vía `ConvexHttpClient` es rechazado por Convex con "Server Error" — es el bug que tenía roto el borrado RGPD (ver abajo).
- **Doble-submit protegido en el front**: los botones de checkout/portal en `/cuenta/suscripcion` se deshabilitan mientras hay una request en curso.

---

## 6. Rate limit del entrenador IA

| Tier | Límite |
|---|---|
| admin / test | ∞ |
| Pro (sub con acceso, ver §3) | ∞ |
| Free | 1/mes, reset día 1 UTC (cron `reset-coach-usage`) |

Campos en `profiles`: `aiCoachUsageCount`, `aiCoachUsageResetAt`. Al agotar, botón deshabilitado + CTA suave a `/cuenta/suscripcion` — **NO paywall bloqueante**, decisión de producto (Manu): el free puede seguir viendo su último análisis generado, solo no puede pedir uno nuevo hasta el reset.

---

## 7. Bugs corregidos (auditoría 10 sep 2026)

Encontrados y arreglados en la misma sesión, commit `22c9a13`:

1. **Trial con tarjeta, contradiciendo la web.** `payment_method_collection: "always"` en el plan anual obligaba a introducir tarjeta *antes* del trial (confirmado contra la doc oficial de Stripe), pero `/premium`, `/cuenta/suscripcion` y el teaser de home prometen "sin tarjeta" en 8+ sitios. Fix: `"if_required"` + `trial_settings.end_behavior.missing_payment_method: "cancel"`.
2. **Borrado RGPD roto.** El webhook `clerk-users` llamaba directo a una `internalMutation` vía `ConvexHttpClient` → Convex la rechaza siempre. Verificado en vivo contra el deployment real. El borrado de `subscriptions` al eliminar cuenta nunca se ejecutaba. Fix: nueva action pública `purgeSubscriptionOnUserDeleted`.
3. **Email del customer siempre vacío.** `sessionClaims?.email` no existe por defecto en el session token de Clerk (hace falta "Customize session token", no configurado). El reuso de customer por `metadata.clerkUserId` nunca se activaba. Fix: `clerkClient().users.getUser(userId)` (Backend API, no depende del JWT de sesión).
4. **Métricas de churn infladas.** `tier` era siempre `"premium"` para cualquier evento de Stripe, incluso `customer.subscription.deleted`. No afectaba al feature gating (que mira `status`), pero sí a `getSubscriptionStats`. Fix: `tier` → `"free"` en estados terminales.

Y por separado, el mismo día: el middleware perdió `clerkMiddleware()` por completo en un intento anterior de arreglar el 401 al webhook de Stripe, rompiendo `auth()` en checkout/portal/Strava/admin para todos los usuarios (commit `77c2774`, ver §4).

---

## 8. Pendiente / conocido

- `downgradeToFree` (internal mutation en `convex/subscriptions.ts`) existe pero no se llama desde ningún sitio — quedó como código muerto tras migrar de Clerk Billing a Stripe. No es necesario tocarlo: el caso "Stripe cancela" ya lo cubre el fix de `tier` (§7.4) y el caso "usuario borra cuenta" lo cubre mejor `purgeSubscriptionOnUserDeleted` (borra la fila entera).
- El chequeo de `currentPeriodEnd` para status `"canceled"` en `hasPremiumAccess()` es código muerto en la práctica: `"canceled"` no está en `ACCESS_GRANTING_STATES`, así que la función ya ha retornado `false` antes de llegar a ese chequeo. No rompe nada (Stripe solo manda `customer.subscription.deleted` cuando el periodo ya venció de verdad), pero si se cambia esa lógica en el futuro, revisar este punto.
- Gate del diploma PDF descargable a partir del 4º resultado (mencionado en versiones anteriores de este doc como feature Pro planeada): no está implementado — la función de generación existe (`lib/pdf/diploma.tsx`) pero no hay ningún gate ni UI que la condicione a Pro. Los diplomas por email son gratis para todos, sin límite, según confirma tanto el código como `/premium`.
- No hay reconciliación periódica (cron) que recorra suscripciones activas contra el estado real de Stripe — si se pierde un evento de webhook, el sistema queda en *eventual consistency* hasta el siguiente evento. Aceptable al volumen actual; revisar si el volumen sube.

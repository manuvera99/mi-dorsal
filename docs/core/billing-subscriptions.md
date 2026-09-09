# Billing (Clerk Billing) + roles + rate limit del entrenador IA

> Documento on-demand. Se carga cuando se toca `subscriptions`, `<Paywall>`/`<PremiumFeatureLock>`, roles admin/test, o el rate limit del coach IA.
> Estado: **esqueleto listo, NO activado**. La app funciona 100% en plan Free. Runbook de activación: `docs/BILLING_SETUP.md`.

## Arquitectura

**Clerk Billing (no Stripe directo)** — Clerk gestiona auth + billing con el mismo user, cero código de checkout, 0,7% sobre ingresos. Clerk usa Stripe por debajo, Manu no necesita cuenta Stripe propia.

| Archivo | Rol |
|---|---|
| `convex/schema.ts` (`subscriptions`) | Mirror local del estado. Source of truth para feature gating. |
| `convex/subscriptions.ts` | Queries (`getMySubscription`, `getMyPremiumStatus`) + `handleClerkBillingEvent` + `upsertFromClerkEvent`. |
| `app/api/webhooks/clerk-billing/route.ts` | Webhook con verificación Svix. |
| `components/billing/use-has-premium.ts` | Hook reactivo. |
| `components/billing/paywall.tsx` | `<Paywall variant="inline\|card\|subtle">` — envuelve features opcionales. |
| `components/billing/premium-feature-lock.tsx` | `<PremiumFeatureLock variant="subtle\|banner\|inline">` — específico para features de datos (Strava, calendario). |
| `app/cuenta/suscripcion/page.tsx`, `app/premium/page.tsx` | Gestión y landing pública. |

**Nunca escribir en `subscriptions` desde el cliente** — solo la internal mutation tras verificar firma Svix.

## Estados que dan acceso premium
`active`, `trialing`, `past_due` (no castigar cobro fallido transitorio), `canceled` con `currentPeriodEnd` futuro. Todo lo demás → no. Centralizado en `ACCESS_GRANTING_STATES` (`convex/subscriptions.ts`).

## Roles con bypass total: `admin` y `test`
`profiles.role` ∈ {user, admin, test}. Admin (Manu) y test (beta-tester marcado a mano) bypassean `hasPremiumAccess`, `getMyPremiumStatus` y el rate limit del coach IA. El bypass se comprueba **antes** de mirar `subscriptions` — el rol manda.

Promover a test: `npx convex data update profiles/<id> --patch '{"role":"test"}'` o desde el dashboard de Convex.

## Rate limit del entrenador IA
| Tier | Límite |
|---|---|
| admin / test | ∞ |
| Pro (sub activa) | ∞ |
| Free | 1/mes, reset día 1 UTC (cron `reset-coach-usage`) |

Campos en `profiles`: `aiCoachUsageCount`, `aiCoachUsageResetAt`. Al agotar, botón deshabilitado + CTA suave a `/cuenta/suscripcion` — **NO paywall bloqueante**.

## Decisión Free vs Pro: "Pro es comodidad, no acceso"
El free tiene todo lo esencial (catálogo, votar, VDOT, PRs manuales, 1 export Strava ZIP de por vida, resultado + diploma por email, calendario sin límite).
Solo Pro: Strava OAuth (consume rate limit de la API de Strava — el export ZIP manual sí es free porque no toca la API), re-subir export tras cambiar dispositivo, alertas, planificador, comparativa comunidad, export a calendario externo, coach IA ilimitado.

**Pendiente**: gate del diploma PDF descargable (a partir del 4º resultado) — la función existe (`lib/pdf/diploma.tsx`) pero no hay UI en `/perfil` que la invoque todavía.

# Monetización: Clerk Billing + freemium — decisión y runbook (sesión del 8 sep 2026)

> Documento opcional. Para el estado operativo actual (tablas, gating, roles, rate limit) ver `docs/core/billing-subscriptions.md` — este documento cubre el **por qué** de la decisión de arquitectura y el runbook de activación que no hace falta releer para programar día a día.

## Por qué Clerk Billing y no Stripe directo

- Clerk ya gestiona la auth; Billing se integra nativamente con el mismo user.
- Cero código de checkout — Clerk se ocupa del iframe, Apple/Google Pay, cambio de plan, cancelación, cumplimiento fiscal.
- Coste extra: 0,7% sobre ingresos (vs 1,5% + 0,25€ de Stripe directo). Para €1000-5000/mes objetivo: 5-35€/mes, asumibles.
- Trade-off: menos control sobre checkout custom. Migrable a Stripe directo si hace falta (ver abajo).

Clerk Billing usa Stripe por debajo — Manu no necesita cuenta Stripe propia para empezar.

## Mientras está desactivado (situación actual)

- `CLERK_WEBHOOK_SIGNING_SECRET` vacío en Vercel y `.env.local` → el webhook rechaza con 503.
- `<PricingTable />` se renderiza sin planes configurados → "No plans available" (inocuo).
- `getMyPremiumStatus` devuelve `hasAccess: false` para todos → la app funciona 100% como Free.

## Para activar (cuando llegue el momento — Q3-Q4 2026, ver `docs/plans/MONETIZATION_PLAN.md`)

1. Activar **Billing** en el dashboard de Clerk (un clic).
2. Crear producto **Free** (precio 0, plan_id: `free_user`).
3. Crear producto **Premium** (4,99€/mes y/o 39€/año, plan_id: `premium_*`).
4. Webhooks → Add endpoint → `https://<dominio>/api/webhooks/clerk-billing` → eventos `subscription.*`.
5. Copiar el Signing Secret (`whsec_...`) a `CLERK_WEBHOOK_SIGNING_SECRET` en Vercel → redeploy.
6. Probar con "Send test event" del dashboard de Clerk.
7. Verificar en Convex dashboard que `subscriptions` se actualiza.
8. Anunciar en redes/newsletter con link a `/premium`.

Detalle completo paso a paso: `docs/BILLING_SETUP.md`.

## Si en el futuro se migra a Stripe directo

Coste estimado: 1-2 semanas de trabajo.
- Borrar `CLERK_WEBHOOK_SIGNING_SECRET`, añadir `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`.
- Sustituir `<PricingTable />` por `loadStripe` + `<EmbeddedCheckoutProvider>`.
- Endpoint `/api/stripe/checkout` (crea Checkout Session) y `/api/stripe/webhook` (verifica firma, llama a `upsertFromClerkEvent` renombrada a `upsertFromStripeEvent`).
- Tablas de facturación de Stripe (`stripe_customers`, `stripe_invoices`) para historial.

**La estructura actual (Convex + webhook + tabla mirror + feature gating) sigue siendo válida** — solo cambian las fuentes (Clerk → Stripe) y los componentes de checkout. Por eso la tabla `subscriptions` se diseñó agnóstica al proveedor de pagos.

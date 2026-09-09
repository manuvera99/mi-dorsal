# Emails y crons de Convex

> Documento on-demand. Se carga cuando se toca un cron, un email transaccional, o `notificationLog`.
> Fuente de verdad: `convex/cronJobs.ts` y `convex/emailDispatch.ts`.

## Los 9 crons reales (registrados en `convex/cronJobs.ts`)

| Cron | Frecuencia | Acción | Archivo |
|---|---|---|---|
| `check-results` | cada 30 min | Scrapea resultados con frecuencia adaptativa, envía email `result_found` | `convex/crons/checkResults.ts` |
| `reminder-pre-race` | 9am UTC diario | Recordatorios 7d/1d | `convex/crons/reminderPreRace.ts` |
| `result-not-found` | 14h UTC diario | Email "no encontrado" tras 48h | `convex/crons/resultNotFound.ts` |
| `weekly-digest` | lunes 9am UTC | PLACEHOLDER (Sprint 3, sin cablear) | `convex/crons/weeklyDigest.ts` |
| `year-review` | 1 enero 10am UTC | PLACEHOLDER (Sprint 3, sin cablear) | `convex/crons/yearReview.ts` |
| `recalc-stats` | **03:05 UTC diario** (bajado de cada 6h el 8 sep 2026, -75% bandwidth) | Recalcula `statsCache` | `convex/crons/recalcStats.ts` |
| `newsletter-editorial` | día 1 mes, 10:00 UTC | Envía blogPost pendiente a suscriptores | `convex/crons/newsletterEditorial.ts` |
| `reset-coach-usage` | día 1 mes, 00:05 UTC | Resetea `aiCoachUsageCount` de todos los profiles | `convex/crons/resetCoachUsage.ts` |
| `renew-strava-webhook` | 00:05 UTC diario | Renueva suscripción webhook Strava (caduca a las 24h) | `convex/actions/stravaWebhookSubscription.ts` |

**Antes de añadir o acelerar un cron**: revisar si hace `Promise.all` + `.collect()` sobre tablas grandes (races, profiles, activities...) — eso quema bandwidth de Convex rápido. Ver `docs/optional/convex-upgrade.md`.

## Sistema de emails (7 tipos vía `notificationLog`)

Todos pasan por `convex/emailDispatch.ts → dispatchAndLog` — **única función que llama a Resend**. No hardcodear envíos fuera de aquí.

| Tipo | Trigger | Estado |
|---|---|---|
| `welcome` | Al crear profile (onboarding) | Activo |
| `reminder_7d` | Cron reminder-pre-race, 7d antes | Activo |
| `reminder_1d` | Cron reminder-pre-race, 1d antes | Activo |
| `result_found` ⭐ | Cron check-results, al detectar dorsal | Activo. Incluye diploma PDF |
| `result_not_found` | Cron result-not-found, 48h tras carrera | Activo |
| `weekly_digest` | Cron weekly-digest | Placeholder, sin cablear |
| `year_review` | Cron year-review | Placeholder, sin cablear |

El envío mensual de **newsletter editorial** (blog) es un flujo aparte, no pasa por `notificationLog` — ver `docs/core/blog-newsletter.md`.

**Idempotencia**: antes de enviar, `hasLog` mira `notificationLog` con índice `by_user_type(userId, type)` + filtro `relatedMyRaceId`. Si ya existe, no reenvía. **No quitar este check** — es lo único que evita duplicar emails.

**Plantillas**: transaccionales (`result_found`, reminders) usan `@react-email/renderer` en `convex/emails/sendEmail.ts`; welcome/editorial son HTML inline (más control en clientes de email).

**Mock mode**: si falta `RESEND_API_KEY`, se loguea en stdout y se marca `delivered` igual (no bloquea el flujo en dev).

## Anti-patrones específicos
- No crear funciones en `convex/emails/` que se llamen a sí mismas vía `internal.*` — genera referencia circular de tipos (por eso `emailDispatch.ts` vive en la raíz de `convex/`, no en `convex/emails/`).
- No hardcodear el envío de un email saltándose `dispatchAndLog`.
- No olvidar `writeLog` tras enviar — rompe la idempotencia y duplica emails en el próximo tick del cron.

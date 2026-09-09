# Integración con Strava (OAuth + export ZIP)

> Documento on-demand. Se carga cuando se toca `connections.tsx`, `convex/stravaOauth.ts`, `convex/stravaExport*.ts`, o el webhook de Strava.
> Setup manual inicial (ya ejecutado): `docs/history/strava-oauth-setup.md`.

## Dos vías de entrada de datos, distinto tier

| Vía | Tier | Por qué |
|---|---|---|
| **Strava OAuth** (sync automática) | **Solo Pro** | Consume la API de Strava (rate limit 200 req/15min, 2000/día). Si todo el free la usa, se queman los límites sin pagar nada a Strava. |
| **Export ZIP manual** (descarga desde la web de Strava) | **Free** (1 vez en la vida del user; re-subir tras cambiar de dispositivo es Pro) | Son datos del propio user, no tocan la API de Strava. |

Ver detalle de gating en `docs/core/billing-subscriptions.md`.

## Flujo OAuth
`convex/stravaOauth.ts` + `app/api/connect/strava/{start,callback,disconnect}/route.ts`. Guarda tokens en `profiles`. El webhook (`app/api/webhooks/strava/route.ts` + `convex/stravaWebhookHandlerInternal.ts`) recibe eventos de nuevas actividades.

**Strava no firma los eventos con HMAC** — la única validación es el `verify_token` (`"mi-dorsal-strava-webhook"`, hardcoded, debe coincidir en `stravaWebhookSubscription.ts` y en el handler del webhook).

**Suscripción del webhook caduca a las 24h sin eventos** → cron `renew-strava-webhook` (00:05 UTC diario, ver `docs/core/emails-crons.md`) la renueva.

## Flujo export ZIP
1. `POST /api/connect/strava-export/upload` (multipart). Valida tamaño max **200 MB** y magic bytes ZIP (`PK\x03\x04`).
2. Signed URL a Convex File Storage → sube → `storageId`.
3. Crea fila en `uploads`, dispara `stravaExportIngest.startIngest(uploadId)` en background (fire-and-forget).
4. Action descarga el ZIP, extrae con JSZip, lee `activities.csv`.
5. Por actividad: `normalize` (`lib/activities/normalize`) → upsert en `activities` con índice `(provider, providerActivityId)`.
6. Match con `races` por fecha+distancia → `matchedRaceId`. Si es PR → `personalRecords`.
7. Marca `uploads` como done con counters, borra el ZIP de Storage.

## Anti-patrón
- **Scraping/parsing pesado en Vercel serverless se mata al terminar la función.** El ingest de Strava export es una `action` de Convex (no un route handler de Next.js) precisamente para evitar el timeout de Vercel en ZIPs grandes.

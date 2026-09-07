# mi-dorsal — Arquitectura de la app

> Mapa completo de la app. **Lee este archivo antes de hacer cambios** para entender qué
> toca qué. Versión texto plano de `docs/ARCHITECTURE.html` (que es la versión visual
> con diagramas Mermaid).
>
> Última actualización: 7 sep 2026.

---

## 1. Visión general

mi-dorsal es una web app para corredores populares de España. El flujo principal es:
**descubrir carrera → apuntarse → correrla → recibir el resultado oficial por email con diploma PDF**.

Tres capas:
- **Frontend**: Next.js 15 + React 19 + Tailwind 3.4, desplegado en Vercel (`fra1`).
- **Backend**: Convex (DB reactiva + funciones + crons + file storage), un solo servicio.
- **Externos**: Clerk (auth), Resend (email), scrapers Node (ingesta de carreras).

```
[Navegador] → [Vercel/Next.js] → [Convex] → [Resend/Scrapers/Clerk]
```

---

## 2. Stack técnico

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend | Next.js 15 App Router | Páginas con query a Convex llevan `export const dynamic = "force-dynamic"` |
| UI | React 19 + Tailwind 3.4 | Paleta `--runner-primary: #dc2626`, `--runner-warm: #fafaf9` |
| Backend | Convex 1.18 | Auto-deploy con `npx convex deploy` (sin `--prod`) |
| Auth | Clerk | Magic link, JWT en cookie |
| Email | Resend | Dominio verificado `mi-dorsal.com`. Mock si falta `RESEND_API_KEY` |
| Hosting | Vercel | Región `fra1`, headers seguridad en `vercel.json` |
| PDF | `@react-pdf/renderer` + `pdf-parse` | Diplomas + parser de PDFs de clasificaciones |
| Scraping | Cheerio + Playwright + JSZip | HTML, JS, ZIPs Strava |
| Mapas | Leaflet + react-leaflet | OpenStreetMap, sin API key |

---

## 3. Base de datos — 16 tablas en Convex

Definidas en `convex/schema.ts`. **Auto-migración al hacer `npx convex dev`**.

### 3.1 Identidad
- `profiles` — `clerkUserId` (PK), `role` (user/admin), `displayName`, `email`, preferencias email, Strava/Garmin OAuth, runner type

### 3.2 Catálogo
- `races` — +50 campos: nombre, slug, locality, province (literal, 50+ provincias), distanceKm, raceType (road/trail/mixed/obstacle), fechas, geo (lat/lng), URLs (oficial/inscripción/resultados/reglas), organizador, redes sociales, precio, avituallamientos, categorías, gpx, altimetría, etc. Índices: by_province, by_date, by_slug, by_published_date, by_data_source, by_race_type. Search index por nombre.
- `dataSources` — RFEA, FEDME, ITRA, Sportmaniacs, Runedia, Chiplevante. status (active/paused/error), lastSync, totalRaces, config
- `syncHistory` — log de sincronizaciones (running/success/error)

### 3.3 Engagement
- `raceRatings` — votación 8D Correbirras-style (organization, price, swag, aidStations, course, atmosphere, postRace, trophies + comment)
- `raceVotes` — 👍/👎 por usuario (un voto por carrera)

### 3.4 Tracking personal (el "hilo")
- `myRaces` ⭐ — **la tabla más importante**. Una fila por carrera apuntada por usuario. Campos: dorsalNumber, status (planned/done/dns/dnf), predictedTimeSeconds, actualTimeSeconds, actualPosition, resultScrapedAt, diplomaStorageId. Índices: by_user, by_user_status, by_race, by_user_race, by_user_dorsal, by_race_dorsal, by_status.
- `personalRecords` — PRs por distancia. source (manual/strava/strava-export/garmin/race_result), isCurrent
- `predictions` — log Daniels VDOT. predictedTime, actualTime, errorSeconds, modelVersion, factors
- `raceResultsCache` — resultados scrapeados indexados por `(raceId, dorsalNumber)`. runnerName, positionOverall, positionCategory, timeSeconds, sourceUrl
- `raceCandidates` — carreras detectadas en uploads de Strava que no matchean catálogo. occurrenceCount para promoción a pending_review

### 3.5 Contenido editorial
- `blogPosts` — "Historias de dorsal". Slug único, content en markdown, 4 categorías (historias/guias/curiosidades/tendencias), seoTitle/Description/Keywords, relatedRaceIds, newsletterSentAt. Search index por título.

### 3.6 Newsletter (RGPD)
- `newsletterSuscribers` — email, status (pending/active/unsubscribed/bounced), source, preferences (editorialEnabled/raceRemindersEnabled/resultsEnabled), locale, confirmToken (one-shot), unsubscribeToken (estable), consentAt, consentIpHash (SHA-256 con salt), consentUserAgent, profileId (FK opcional)

### 3.7 Integraciones de actividad
- `activities` — Strava OAuth, Strava export, Garmin (futuro). type (race/long_run/tempo/interval/easy/recovery/trail), startedAt, durationSec, distanceM, avgPace, matchedRaceId, isOfficialResult
- `uploads` — historial de ZIPs Strava. status (pending/processing/done/failed), counters de activities procesadas, matched races, new PRs

### 3.8 Sistema
- `statsCache` — fila única "global" con contadores denormalizados. Recalculada por cron cada 30 min
- `notificationLog` — log de emails enviados. Garantiza idempotencia: by_user_type(userId, type) + filtro relatedMyRaceId

---

## 4. Flujos críticos

### 4.1 Onboarding
1. Usuario visita `/` o `/carreras` → `clerkMiddleware` ve sin sesión.
2. Click "Apuntarme" → Clerk magic link.
3. Click en link → Clerk valida → crea cookie sesión.
4. `useEffect` en cliente → `api.users.upsertMyProfile` → crea fila en `profiles`.

### 4.2 Descubrir y apuntarse a carrera
1. Home `app/page.tsx` → `useUserRegion` → `/api/geo/region` (edge, lee headers Vercel).
2. Hero + FeaturedCarrusel con carreras filtradas por CCAA detectada.
3. Click "Carreras" → `app/carreras/client.tsx` → `api.races.list(filtros)`.
4. Click "Apuntarme" + dorsal → `api.myRaces.add(raceId, dorsalNumber)`.
5. Convex calcula predicción con `lib/prediction/predict.ts` (Daniels VDOT).
6. Inserta `personalRecord` si bate el anterior.

### 4.3 Día de la carrera (recordatorios)
- Cron `reminder-pre-race` corre diario a las 9am UTC.
- Query `getRacesNeedingReminder`: para cada `myRace` planned, mira si la carrera está en T-7d o T-1d (±6h).
- Si no se ha enviado el recordatorio (chequea `notificationLog`), llama a `emailDispatch.dispatchAndLog` que envía por Resend.
- Resend mock si falta `RESEND_API_KEY`.

### 4.4 Detección automática del resultado oficial ⭐
**El flujo estrella y principal diferenciador.** Cron `check-results` cada 30 min.

1. Query `getRacesToCheck` recoge todas las `myRace` con `status="planned"`.
2. Para cada una, calcula `getCheckFrequency(raceTime, now)`:
   - `aggressive` (cada 30 min): ventana [-1h, +6h]
   - `normal` (cada 6h): ventana [-7d, -1h] o [+6h, +48h]
   - `sparse` (cada 24h): [+48h, +7d]
   - `skip`: fuera de ventana
3. Si frecuencia != skip, llama a `scrapeResults(resultsUrl, dorsal, adapter)` (en `convex/scraper.ts`).
4. Si encuentra resultado:
   - `cacheResult` → guarda en `raceResultsCache`
   - `updateMyRace` → status=done, actualTime, position
   - `personalRecords.updateIfBetter` → si bate el PR
   - `emailDispatch.dispatchAndLog` → email `result_found` con diploma PDF adjunto
5. Si no encuentra, no marca `resultScrapedAt` (reintenta en próximo tick).

Adapters soportados: chiplevante, pdf, generic-html. Si el adapter es `pdf`, Convex llama a `POST /api/pdf/parse` con `X-PDF-Parser-Secret`.

Si pasan 48h sin resultado, el cron `result-not-found` (14h UTC diario) manda email "no hemos encontrado tu tiempo".

### 4.5 Strava export
1. Cliente: `POST /api/connect/strava-export/upload` con multipart ZIP.
2. Servidor valida: tamaño max 200MB, magic bytes ZIP, MIME opcional.
3. Pide signed URL a Convex File Storage, sube el archivo, obtiene `storageId`.
4. Crea fila en `uploads` con `createUploadAndStart(storageId)`.
5. Dispara `stravaExportIngest.startIngest(uploadId)` en background (fire-and-forget).
6. Action descarga el ZIP, lo extrae con JSZip, lee `activities.csv`.
7. Para cada actividad: `normalize` (en `lib/activities/normalize`) → upsert en `activities` con índice `(provider, providerActivityId)`.
8. Match con race por fecha+distancia → `matchedRaceId`.
9. Si es PR → `personalRecords`.
10. Marca `uploads` como done con counters, borra el ZIP de Storage.

### 4.6 Newsletter (single opt-in, RGPD)
1. Cliente: `POST /api/newsletter/subscribe {email, consent: true}` (consent obligatorio).
2. Hashea IP con SHA-256 + `NEWSLETTER_IP_SALT`.
3. Convex `subscribeDirect`:
   - email nuevo → crea active, envía welcome
   - ya active → no hace nada
   - reactivado desde unsubscribed → re-envía welcome
4. Welcome es HTML inline con link de baja usando `unsubscribeToken` (estable).
5. Unsub: `GET /api/newsletter/unsubscribe?token=...` → marca unsubscribed.

Mensualmente (día 1, 10am UTC), el cron `newsletter-editorial` coge el siguiente `blogPost` con `newsletterSentAt = null` y lo envía a todos los suscriptores `active` con `editorialEnabled = true`.

---

## 5. Crons de Convex

Definidos en `convex/cronJobs.ts`. 7 jobs:

| Cron | Frecuencia | Acción | Archivo |
|---|---|---|---|
| `check-results` | cada 30 min | Scrapea resultados con frecuencia adaptativa, envía email `result_found` | `convex/crons/checkResults.ts` |
| `reminder-pre-race` | 0 9 * * * (9am UTC diario) | Recordatorios 7d/1d | `convex/crons/reminderPreRace.ts` |
| `result-not-found` | 0 14 * * * (14h UTC diario) | Email "no encontrado" tras 48h | `convex/crons/resultNotFound.ts` |
| `newsletter-editorial` | 0 10 1 * * (día 1 mes 10am UTC) | Envía blogPost pendiente a suscriptores | `convex/crons/newsletterEditorial.ts` |
| `recalc-stats` | cada 30 min | Actualiza fila de `statsCache` | `convex/crons/recalcStats.ts` |
| `weekly-digest` | 0 9 * * 1 (lunes 9am UTC) | PLACEHOLDER (Sprint 3) | `convex/crons/weeklyDigest.ts` |
| `year-review` | 0 10 1 1 * (1 enero 10am UTC) | PLACEHOLDER (Sprint 3) | `convex/crons/yearReview.ts` |

---

## 6. Sistema de emails (8 tipos)

Todos pasan por `convex/emailDispatch.ts → dispatchAndLog` (única función que llama a Resend).

| Tipo | Trigger | Estado |
|---|---|---|
| `welcome` | Al crear profile | Pendiente cablear |
| `reminder_7d` | Cron reminder-pre-race, 7d antes | Activo |
| `reminder_1d` | Cron reminder-pre-race, 1d antes | Activo |
| `result_found` ⭐ | Cron check-results, al detectar dorsal | Activo. Incluye diploma PDF |
| `result_not_found` | Cron result-not-found, 48h tras carrera | Activo |
| `weekly_digest` | Cron weekly-digest | Placeholder |
| `year_review` | Cron year-review | Placeholder |
| `newsletter` (editorial) | Cron newsletter-editorial, día 1 mes | Activo |

**Plantillas**:
- Transaccionales (`result_found`, reminders): `convex/emails/sendEmail.ts` con `@react-email/renderer`.
- Editorial/welcome: HTML inline (sin librería) para máximo control en clientes email.

**Idempotencia**: antes de enviar, mira `notificationLog` con `by_user_type(userId, type)` + filtro `relatedMyRaceId`. Si ya existe, no reenvía.

**Mock mode**: si falta `RESEND_API_KEY`, los envíos se loguean en stdout y se marcan delivered igualmente.

---

## 7. API routes (Next.js)

| Ruta | Método | Auth | Propósito |
|---|---|---|---|
| `/api/geo/region` | GET | público | Edge. CCAA por IP Vercel (headers x-vercel-ip-*) |
| `/api/geo/ip` | — | — | **DEPRECATED**. Devuelve 410. Usar `/api/geo/region` |
| `/api/newsletter/subscribe` | POST | público (consent=true obligatorio) | Single opt-in. Hashea IP, crea suscriptor |
| `/api/newsletter/confirm` | GET | token | Doble opt-in legacy. Redirige a `/newsletter?confirmed=1` |
| `/api/newsletter/unsubscribe` | GET | token | One-click unsub. LSSI art. 22 |
| `/api/connect/strava-export/upload` | POST multipart | Clerk | Sube ZIP Strava, dispara ingest |
| `/api/scrape/[source]` | POST | Clerk + admin | Lanza scraper en background |
| `/api/pdf/parse` | POST | header `X-PDF-Parser-Secret` | Helper de Convex para parsear PDFs de clasificaciones |
| `/api/test-analyze` | GET | ninguna (debug) | Endpoint temporal de debug |

---

## 8. Scrapers y fuentes

6 fuentes activas, todas con scraper en `scripts/ingest-*.ts`:

| Fuente | Tipo | Cobertura | Script | Notas |
|---|---|---|---|---|
| RFEA | scraper | Federados ruta | `scripts/ingest-rfea.ts` | Requiere Playwright |
| FEDME | scraper | Montaña y trail | `scripts/ingest-fedme.ts` | Listado público HTML |
| ITRA | scraper | Trail internacional | `scripts/ingest-itra.ts` | Listado + resultados |
| Sportmaniacs | scraper | Inscripciones España | `scripts/ingest-sportmaniacs.ts` | API JSON descubierta |
| Runedia | scraper | Catálogo amplio | `scripts/ingest-runedia.ts` | A veces desactualizado |
| Chiplevante | scraper + adapter | Cronometrador Levante | `scripts/ingest-chiplevante.ts` | Adapter en `convex/scraper.ts` para resultados por dorsal |

**Cómo se ejecutan**:
- Programado: GitHub Actions `.github/workflows/daily-ingest.yml` corre a diario.
- Manual: `POST /api/scrape/[source]` desde el panel admin. En Vercel el proceso background se mata al terminar la función.

**Detección de duplicados**: `scripts/find-cross-source-duplicates.ts` + `scripts/merge-mock.ts`. Las carreras consolidadas guardan `mergedFromIds` y `additionalDataSourceIds`.

---

## 9. Panel admin

Todo bajo `/admin/*`. Protegido por `clerkMiddleware` + `profiles.role === "admin"`.

- `/admin` — Dashboard. Lee de `statsCache` (no consulta tablas).
- `/admin/races` — CRUD manual. Sub-rutas: `/new`, `/[id]`, `/from-url` (deep extraction con IA).
- `/admin/sources` — Lista de `dataSources` con último sync. Botón "sincronizar ahora".
- `/admin/users` — Lista de profiles con métricas. `/[id]` para detalle y soporte.
- `/admin/blog` — CRUD del blog. Editor markdown, cover images.
- `/admin/newsletter` — Suscriptores, filtros, export CSV, alta/baja manual.

CLI del blog: `npm run content:new` (esqueleto) + `npm run content:publish` (sube MD a Convex).

---

## 10. Auth y seguridad

**Clerk magic link** — sin password. Cookie firmada, JWT verificable por Convex.

**Protección de rutas** (en `middleware.ts`):
- `/calendario/*`, `/perfil/*` → requieren userId
- `/admin/*` → requieren userId + role=admin
- `/sign-in/*`, `/sign-up/*`, `/api/*`, `/test-geo` → noindex
- Resto → público indexable

**Headers de seguridad** (`vercel.json` + `middleware.ts`):
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(self), interest-cohort=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

**Middleware adicional**: gzip manual de la home (Vercel no comprime ISR estático). 87 KB → 17 KB. Cache 5 min en memoria del edge.

**RGPD**:
- Suscriptores newsletter: `consentAt` + `consentIpHash` (SHA-256 con `NEWSLETTER_IP_SALT`) + `consentUserAgent`. IP nunca en claro.
- Emails enviados: `notificationLog` con `resendMessageId`. Retención 12 meses.
- Páginas legales: `/legal/privacidad`, `/legal/aviso-legal`, `/legal/cookies`.

---

## 11. Despliegue y entorno

### Variables de entorno

| Variable | Entorno | Uso |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Vercel + local | URL pública de Convex |
| `CLERK_SECRET_KEY` | Vercel | Clerk server-side |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Vercel + local | Clerk client-side |
| `CLERK_JWT_ISSUER_DOMAIN` | Vercel + Convex | Verificación JWT en Convex |
| `RESEND_API_KEY` | Vercel | Si falta, mock mode |
| `RESEND_FROM_EMAIL` | Vercel | Default `mi-dorsal <hola@mi-dorsal.com>`. ⚠️ Verificar dominio en Resend antes de cambiar |
| `NEXT_PUBLIC_APP_URL` | Vercel + local | Base URL para emails y redirects. Default `https://www.mi-dorsal.com` |
| `NEWSLETTER_IP_SALT` | Vercel | Salt para hash de IPs RGPD |
| `PDF_PARSER_SECRET` | Vercel + Convex | Header `X-PDF-Parser-Secret` |
| `NEXT_PUBLIC_USE_MOCK` | local | `true` para dev sin credenciales |

### Procedimiento de deploy (resumen de AGENTS.md §9.2)

1. `npx tsc --noEmit` → 0 errores
2. `npm run build` → `✓ Compiled successfully` (**no skippear**)
3. Revisar tabla de rutas en output de `next build`
4. Commit selectivo (NUNCA `git add -A`), push a `master`
5. Backend: `npx convex deploy`
6. Frontend: `vercel deploy --prod --yes` (con `--force` si hay sospecha de caché)
7. `vercel ls mi-dorsal --yes` y leer logs si hay error

### Dominios en producción

- `www.mi-dorsal.com` (canónica, redirect 308 desde `mi-dorsal.com`)
- `mi-dorsal.es` (comprada 4 sep 2026)
- `mi-dorsal.vercel.app` (backup)

---

## 12. Archivos clave (TLDR para agentes)

```
app/                      # Next.js App Router
├── page.tsx              # Home (force-dynamic). 11 secciones
├── carreras/             # Catálogo (force-dynamic)
├── calendario, perfil    # Protegidos
├── blog/                 # Público
├── admin/                # Protegido admin
└── api/                  # 9 route handlers

components/
├── home/, carreras/      # Componentes por sección
├── header.tsx            # ⚠️ NO eliminar hamburguesa móvil (AGENTS.md §6.6)
├── region-switcher.tsx   # Pill de CCAA con portal a document.body
└── race-card.tsx, race-filters.tsx, race-map-wrapper.tsx

convex/
├── schema.ts             # 16 tablas
├── *.ts                  # users, races, myRaces, ratings, votes, predictions, personalRecords
├── stravaExport*.ts      # Flujo de Strava ZIP
├── scraper.ts            # Scrapers de resultados
├── emailDispatch.ts      # Único punto de envío de emails
├── newsletter.ts, blog.ts
├── cronJobs.ts           # 7 crons registrados
├── crons/                # 7 archivos (uno por cron)
└── devOnly/              # Solo dev (promoteToAdmin, markFeatured)

lib/
├── geo/region.ts         # SSOT CCAA + provincias (19 + Ceuta + Melilla)
├── prediction/predict.ts # Daniels VDOT + Riegel
├── pdf/findRunner.ts     # Buscar dorsal en texto PDF
├── ai/                   # Deep extraction con IA
└── utils.ts              # cn(), formatDate, DISTANCE_CATEGORY_LIST

scripts/
├── ingest-{rfea,fedme,itra,sportmaniacs,runedia,chiplevante}.ts
├── ingest-to-convex.ts   # Entry point común
└── content/              # CLI del blog

.github/workflows/
├── daily-ingest.yml      # Scrapers a diario
└── ci.yml

middleware.ts             # clerkMiddleware + gzip home + headers
vercel.json               # Headers + crons Vercel (vacío)
AGENTS.md                 # ⭐ LEER PRIMERO. Reglas, decisiones, anti-patrones
```

---

## 13. Reglas de oro (resumen de AGENTS.md)

1. **Páginas con query/SSR** → `export const dynamic = "force-dynamic"` o build peta.
2. **JSON-LD** → pre-serializado en build time, no en runtime.
3. **Dropdowns en `overflow-hidden`** → portal a `document.body`.
4. **`/api/geo/ip` está deprecated** → usar `/api/geo/region`.
5. **Copy** → no limitar a Levante. La app cubre toda España.
6. **Hamburguesa móvil del header** → no eliminar (regression ya resuelta).
7. **NUNCA `git add -A`** sin revisar `git status` antes.
8. **Deploy** → `npm run build` local antes de pushear a master.
9. **Backend Convex** → `npx convex deploy` separado del deploy de Vercel.
10. **Cambiar `RESEND_FROM_EMAIL`** → verificar dominios en Resend primero.

---

## 14. Anti-patrones frecuentes

- Usar `useQuery` en Server Component sin `force-dynamic`.
- Crear funciones en `convex/emails/` que se llamen a sí mismas vía `internal.*` (referencia circular).
- Hardcodear emails sin pasar por `emailDispatch.dispatchAndLog`.
- Olvidar `notificationLog.write` después de enviar (rompe idempotencia).
- Scrape en Vercel serverless (el proceso se mata). Usar GitHub Actions o local.
- Build sin antes `npm run build` local → 5+ deploys rotos ya en esta sesión.

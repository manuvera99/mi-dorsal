# Base de datos — 23 tablas Convex

> Documento on-demand. Se carga cuando se añade/modifica una tabla o se necesita el mapa de datos.
> Fuente de verdad real: `convex/schema.ts`. Esto es un resumen por dominio, no una copia campo a campo.

## Identidad
- **`profiles`** — `clerkUserId` (PK lógica), `role` (user/admin/test), displayName, email, preferencias, Strava OAuth, runner type, `aiCoachUsageCount`/`aiCoachUsageResetAt`.

## Catálogo
- **`races`** — +50 campos. Índices: by_province, by_date, by_slug, by_published_date, by_data_source, by_race_type + search.
- **`dataSources`** — RFEA, FEDME, ITRA, Sportmaniacs, Runedia, Chiplevante. status/lastSync/totalRaces.
- **`syncHistory`** — log de sincronizaciones.

## Engagement
- **`raceRatings`** — votación 8D (organization, price, swag, aidStations, course, atmosphere, postRace, trophies + comment).
- **`raceVotes`** — 👍/👎, un voto por usuario y carrera.

## Tracking personal ("el hilo") ⭐
- **`myRaces`** — la tabla más importante. dorsalNumber, status (planned/done/dns/dnf), predictedTimeSeconds, actualTimeSeconds, diplomaStorageId. Índices: by_user, by_user_status, by_race, by_user_race, by_user_dorsal, by_race_dorsal, by_status.
- **`personalRecords`** — PRs por distancia. source (manual/strava/strava-export/garmin/race_result), isCurrent.
- **`predictions`** — log Daniels VDOT (predictedTime, actualTime, errorSeconds, modelVersion).
- **`raceResultsCache`** — resultados scrapeados por `(raceId, dorsalNumber)`.
- **`raceCandidates`** — carreras detectadas en uploads Strava sin match en catálogo.

## Editorial
- **`blogPosts`** — "Historias de dorsal". Ver `docs/core/blog-newsletter.md`.
- **`newsletterSubscribers`** — RGPD doble/single opt-in. Ver `docs/core/blog-newsletter.md`.

## Integraciones de actividad
- **`activities`** — Strava OAuth/export, Garmin (futuro). Ver `docs/core/strava-integration.md`.
- **`uploads`** — historial de ZIPs Strava.

## Sistema
- **`statsCache`** — fila única "global", recalculada 1×/día.
- **`notificationLog`** — idempotencia de emails. Ver `docs/core/emails-crons.md`.

## Feedback y sugerencias de usuario (no documentadas antes en AGENTS.md)
- **`raceSuggestions`** — usuario pega URL de carrera no catalogada → admin la revisa en `/admin/race-suggestions` y puede convertirla en carrera real.
- **`feedbackReports`** — bug/idea/feedback público (userId opcional, anónimos permitidos). status: new → in_progress → done/wontfix. Panel: `/admin/feedback`.
- **`clubSuggestions`** — usuario no encuentra su club en el selector de `/perfil` y lo reporta. Panel: `/admin/club-suggestions`.
- **`clubsCatalog`** — catálogo extendido de clubs (RFEA + manuales). Los manuales tienen precedencia sobre RFEA en duplicados. Panel: `/admin/clubs`.

## Billing e IA (no documentadas antes en AGENTS.md)
- **`subscriptions`** — mirror local de Clerk Billing. Ver `docs/core/billing-subscriptions.md`.
- **`aiUsageLog`** — una fila por llamada a un LLM (OpenAI/MiniMax/Claude) desde `lib/ai/*`. Tokens, coste en €, éxito/error, duración. Panel: `/admin/ai-usage`.

## Reglas al añadir una tabla nueva
- Todo índice que uses en una query debe declararse explícitamente con `.index(...)` — Convex no crea índices implícitos.
- Si el schema tiene 50+ campos opcionales o uniones grandes, revisar `docs/core/stack.md` §"Workaround TypeScript" antes de escribir `internalAction`/`internalQuery`/`internalMutation` sobre ella (TS2589).

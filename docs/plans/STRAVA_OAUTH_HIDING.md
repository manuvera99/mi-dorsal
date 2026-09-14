# Plan: ocultar Strava OAuth (mantener ZIP upload) — sep 2026

> **Estado**: plan pendiente de aprobar. No empezar a editar hasta validación.
> **Objetivo**: dejar de pagar la suscripción Strava Summit ($5/mes obligatorio
> desde jun 2026) eliminando TODO rastro visible de OAuth en la web, emails y
> admin, **sin perder el flujo de upload ZIP** (gratis) y **manteniendo el
> código OAuth archivado** en el repo por si queremos reactivarlo en el futuro.
>
> **Decisiones del usuario (14 sep 2026)**:
> 1. Plan detallado primero (este documento) antes de tocar código.
> 2. Mantener TODO el código OAuth en el repo, archivado tras una carpeta
>    `_archive/strava-oauth/`, sin importar que no se compile (los
>    `imports` muertos no rompen el build de Next.js si no se usan).
> 3. Ocultar **todas** las referencias a OAuth en web, emails y admin.
> 4. Tier Pro = "Re-subir export ZIP ilimitado" (sin cambios sobre el
>    modelo actual, ya implementado en `convex/stravaExport.ts`).
> 5. **Sin email de aviso** a usuarios con OAuth activo. El cambio es
>    invisible salvo que el usuario entre a `/perfil`. Si nos llegan
>    quejas, se responde caso por caso.
> 6. **App de Strava dejada en read-only** (no se borra). Summit se
>    cancela tras el deploy. La app queda en Single Player Mode pero
>    registrada por si se reactiva en el futuro sin tener que volver a
>    crear y re-aprobar.
> 7. **Dump de `profiles` antes del Paso 5**. Descargar JSON/CSV de
>    filas con `stravaAccessToken !== null` y guardarlo localmente
>    (`backups/strava-oauth-users-{fecha}.json`). 5 minutos que salvan
>    si algo sale mal con el cambio de schema.

---

## 0. Resumen ejecutivo

| Acción | Ficheros tocados | Esfuerzo | Riesgo |
|---|---|---|---|
| **A. UI**: quitar card/banner de OAuth en `/perfil` | `components/perfil/connections.tsx`, `components/perfil/strava-oauth-connect.tsx` (a archivo) | 1h | Bajo |
| **B. Web copy**: quitar menciones a OAuth de home, premium, FAQ, JSON-LD, privacidad | 8 archivos | 1h | Bajo |
| **C. Backend**: quitar cron `renew-strava-webhook`, action webhook handler, OAuth convex files | `convex/cronJobs.ts`, 4 archivos a archivo | 30m | Bajo |
| **D. Schema**: borrar campos OAuth de `profiles` (NO los export) | `convex/schema.ts` + 1 mutation de limpieza | 30m | Medio (cambio irreversible) |
| **E. Routes API**: mover a archivo `app/api/connect/strava/{start,callback,disconnect}` y `app/api/webhooks/strava` | 4 route handlers | 15m | Bajo |
| **F. Lib helper**: mover a archivo `lib/strava/{client,encrypt,state}.ts` y `lib/stravaOAuth/*` si lo creamos | 3 archivos | 15m | Bajo |
| **G. Dev tools**: mover a archivo `scripts/generate-strava-key.ts` | 1 archivo | 5m | Bajo |
| **H. Env vars**: borrar de Vercel + Convex | Dashboard | 15m | Medio |
| **I. Strava Summit**: cancelar suscripción desde Strava | strava.com/settings/subscription | 10m | Bajo |
| **J. Docs**: actualizar/borrar docs | 6 archivos | 30m | Bajo |
| **K. Email a usuarios OAuth actuales**: avisar del cambio | Nuevo template en `convex/emailNotificationsHelpers.ts` | 30m | Bajo |
| **L. Test E2E**: verificar que ZIP upload sigue funcionando en free y Pro | Manual | 30m | Bajo |

**Total estimado**: 6-7h de trabajo + 30m de deploy + 30m de cancelar Summit.
**Ahorro anual**: $60 (Summit) + reducción de complejidad operativa (sin
webhook que renovar cada 24h, sin tokens que cifrar, sin rate limits que
monitorizar).

---

## 1. Inventario completo de archivos afectados

### 1.1 Archivos a ARCHIVAR (mover a `docs/_archive/strava-oauth/`)

> Convención: crear una carpeta `docs/_archive/strava-oauth/` y mover ahí
> los archivos del código OAuth "muerto". Mantiene git history (con `git mv`)
> y deja claro a futuros devs que ese código no se ejecuta.

**Convex backend** (4 archivos):
- `convex/stravaOauth.ts` (queries/mutations OAuth: `saveTokens`, `disconnectAndPurge`, `getMyStravaOauthStatus`, `triggerSyncNow`, `triggerFullSync`)
- `convex/stravaInitialSyncHelpers.ts`
- `convex/stravaWebhookHandlerInternal.ts`
- `convex/actions/stravaInitialSync.ts` (action de sync inicial con paginación)
- `convex/actions/stravaWebhookHandler.ts` (handler de webhook)
- `convex/actions/stravaWebhookSubscription.ts` (cron renew-strava-webhook)

**Next.js routes** (4 archivos):
- `app/api/connect/strava/start/route.ts`
- `app/api/connect/strava/callback/route.ts`
- `app/api/connect/strava/disconnect/route.ts`
- `app/api/webhooks/strava/route.ts`

**Lib helpers** (3 archivos):
- `lib/strava/client.ts`
- `lib/strava/encrypt.ts`
- `lib/strava/state.ts`

**Componentes** (1 archivo):
- `components/perfil/strava-oauth-connect.tsx`

**Scripts** (1 archivo):
- `scripts/generate-strava-key.ts`

**Documentación histórica** (a mover dentro de `_archive` o eliminar):
- `docs/history/strava-oauth-setup.md` (mantener como histórico en
  `_archive/strava-oauth/setup.md`)

**Total: 13 archivos** + 1 doc histórico.

### 1.2 Archivos a EDITAR (mantener en sitio, limpiar referencias)

**UI cliente**:
- `components/perfil/connections.tsx` — quitar la card completa de OAuth
  (líneas 117-134 con `<PremiumFeatureLock>` + `<StravaOauthConnect>`);
  quitar bloque OAuth de `getMyStravaSummary` (líneas 654-657 del
  `convex/stravaExport.ts`); quitar query `api.stravaOauth.getMyStravaOauthStatus`
  y referencias a `oauthStatus` (líneas 32, 39-46, 82-86, 132, 151-160).
- `components/perfil/use-auto-sync.ts` — el hook YA NO se llama desde
  `/perfil/page.tsx` (línea 82-83, 113-117); archivarlo o borrarlo.
  Decisión: **borrarlo** (no es reutilizable sin OAuth).
- `components/perfil/activity-feed.tsx` — el icono naranja y el link a
  Strava por actividad se mantienen (sigue siendo útil para actividades
  ingestadas por export); pero el empty state "Conecta Strava o sube tu
  export" (líneas 147-149) → cambiar a "Sube tu export de Strava para
  empezar".

**App/perfil**:
- `app/perfil/page.tsx` — quitar import + uso de `useAutoSync` y banner
  "Sincronizando con Strava…" (líneas 81-83, 110-117).
- `app/premium/page.tsx` — quitar todas las menciones a OAuth (líneas
  129, 194, 217, 302); reescribir descripción del tier Pro.
- `app/page.tsx` — quitar menciones a OAuth (líneas 151, 159, 207); el
  JSON-LD del FAQ.
- `app/legal/privacidad/page.tsx` — quitar sección 4.2 "Conexión OAuth
  con Strava (próximamente)"; reescribir 4.1.

**Home components**:
- `components/home/hero.tsx` línea 121: cambiar "Strava sync en Pro" →
  "Export de Strava ilimitado en Pro".
- `components/home/pro-teaser.tsx` líneas 54, 66-68, 128: reescribir
  bullets Free y Pro, copy inferior.
- `components/home/whats-here.tsx` línea 78: cambiar título a "PRs
  manuales + import desde Strava (ZIP)" (ya está bien).
- `components/home/use-case.tsx` línea 31: reescribir "Conectas Strava
  una vez" → "Subes tu export una vez".
- `components/home/testimonials.tsx` línea 53: ⚠️ es un placeholder con
  disclaimer ("testimonios son placeholders"), no se toca o se cambia a
  uno coherente con "subir ZIP".
- `components/home/faq.tsx` líneas 27, 32, 62: reescribir las 3
  respuestas.

**Billing components**:
- `components/billing/premium-feature-lock.tsx` y
  `components/billing/paywall.tsx` — solo comentarios. Cambiar "Strava
  sync" del comentario (línea 7 y 36) por algo genérico; no afecta a la
  lógica del componente.

**Convex**:
- `convex/cronJobs.ts` líneas 73-80: borrar bloque del cron
  `renew-strava-webhook`.
- `convex/cronJobs.ts` ya está afectado; en `convex/schema.ts`:
  - Líneas 38-47: borrar campos OAuth (`stravaUserId`, `stravaAccessToken`,
    `stravaRefreshToken`, `stravaTokenExpiresAt`, `stravaScope`,
    `stravaConnectedAt`, `stravaLastSyncAt`,
    `stravaWebhookSubscriptionId`).
  - Línea 108: borrar índice `by_strava_user_id`.
  - Líneas 466-468: en `personalRecords.source` quitar literal `"strava"`
    (deja solo `"manual"`, `"strava-export"`, `"race_result"`, `"garmin"`).
  - Líneas 842, 851-852: en `activities.provider` quitar literal
    `"strava"` (deja solo `"strava-export"`, `"garmin"`).
  - Líneas 467-468 y 852-853 son cambios de **union** literal: requieren
    regenerar `convex/_generated/api.d.ts`. Hacerlo con `npx convex dev`
    o `npx convex codegen` antes de `npm run build`.
- `convex/stravaExport.ts` líneas 42-44, 288-290: quitar literal
  `"strava"` del union de `provider`/`source` (igual que arriba).
- `convex/activities/normalize.ts` — el módulo "Strava API cadence" se
  mantiene porque `rawStravaDetail` puede traerlo del export (Strava
  también rellena `average_cadence` en algunos CSVs). El type
  `StravaActivityType` se mantiene porque el CSV del export usa esos
  valores. **No tocar.**
- `convex/activities/queries.ts` líneas 504-506: la query
  `findActivityByProviderId` usa el índice `by_provider` con
  `provider: "strava"`. Como ya no habrá OAuth, se puede cambiar a
  `provider: "strava-export"` o dejarlo genérico (buscar por
  `providerActivityId` sin provider, ya que el id es único globalmente).
  Decisión: dejarlo genérico (más limpio, la constraint es por
  `(provider, providerActivityId)` así que mejor usar el índice con
  ambos campos, pero buscando cualquier provider — esto es válido en
  Convex). O bien: usar el provider `"strava-export"` que es lo único
  que quedará en producción.

- `convex/personalRecords.ts` línea 110: `rawStravaDetail` se sigue
  usando para PRs ingestados por export (Strava también incluye ese
  campo en algunas filas del CSV con detalle si el usuario marcó el
  checkbox). **No tocar.** Lo único: cambiar comentarios "tras un
  `disconnectAndPurge`" (línea 470) ya que esa mutation ya no existe.

- `convex/emailNotificationsHelpers.ts` línea 143: solo un comentario
  ("consistente con Strava y otras apps de running"). **No tocar**, es
  una analogía correcta.

**Middleware**:
- `middleware.ts` línea 79: cambiar la regex del matcher para NO excluir
  `api/webhooks/strava` (ya no existe el endpoint):
  ```
  "/((?!_next|.*\\..*|api/stripe/webhook|api/webhooks/clerk-billing|api/webhooks/clerk-users).*)",
  ```

**Scripts (a archivar, ya listados arriba)**:
- `scripts/generate-strava-key.ts` — sin uso tras el cambio.

### 1.3 Archivos de DOCS a actualizar

| Archivo | Cambio |
|---|---|
| `AGENTS.md` | Línea 53: cambiar "Strava OAuth / export ZIP / activities" → "Strava export ZIP / activities". Línea 66: cambiar "Runbook ya ejecutado de Strava OAuth (repetir setup)" → mover a `_archive/`. |
| `docs/ROADMAP.md` | Línea 21 ("Strava" en columna "Producto"): mantener (Strava sigue, sin OAuth). Línea 437: borrar bullet "Strava null literal vs Convex v.optional" (ya no aplica). Línea 452: "Strava OAuth + Strava export (ZIP)" → solo "Strava export (ZIP)". |
| `docs/ARCHITECTURE.md` | (No lo he leído a fondo en este pase, pero seguro tiene referencias a OAuth/webhook/cron.) Hacer grep dedicado en la sesión de implementación. |
| `docs/core/strava-integration.md` | Convertir en "Strava export (ZIP) integration only" y quitar toda la sección OAuth. |
| `docs/core/billing-subscriptions.md` | Línea 56-57: reescribir qué es Free vs Pro sin OAuth. Eliminar la mención a `<PremiumFeatureLock>` en `connections.tsx`. |
| `docs/core/emails-crons.md` | Línea 18: borrar fila del cron `renew-strava-webhook`. |
| `docs/core/database-schema.md` | Quitar sección de campos OAuth de `profiles`. |
| `docs/core/deploy-checklist.md` | Línea 34: quitar `STRAVA_TOKEN_KEY` de la lista de env vars copiadas. Línea 36: quitar `STRAVA_*` de los pendientes a añadir a mano. |
| `docs/history/strava-oauth-setup.md` | Mover a `docs/_archive/strava-oauth/setup.md` con cabecera `# HISTÓRICO — Strava OAuth retirado sep 2026`. |
| `README.md` | Líneas 40, 179: quitar bullets de Strava OAuth. |
| `docs/BILLING_SETUP.md` | Línea 104: "sincronización Strava/Garmin" → reescribir. |
| `docs/plans/MONETIZATION_PLAN.md`, `MONETIZATION_FREEMIUM_TIERS.md`, `BUSINESS_PLAN.md`, `SOCIAL_MEDIA_CAMPAIGN.md`, `INFRA_ROADMAP.md`, `DORSALSWAP_*.md`, `CLUBS_RANKING_PLAN.md`, `PHOTO_SEARCH_PRD.md`, `2026-09-10-sticker-editor.md` | Verificar cada uno y ajustar copy si habla de OAuth como feature activo. |

### 1.4 Archivos a NO tocar (mantener tal cual)

- `components/perfil/strava-export-uploader.tsx` — sigue siendo el flujo principal.
- `components/perfil/activity-feed.tsx` — los iconos y links a Strava por actividad se mantienen (el corredor abre la actividad en Strava aunque se haya ingestado por export).
- `components/perfil/polyline-map.tsx` — decodifica polylines de Strava; sigue siendo válido (el export también incluye polylines en `mapPolyline`).
- `components/perfil/pr-card-with-map.tsx`, `pr-form-modal.tsx`, `link-strava-section.tsx` — funcionalidades de "vincular PR a actividad de Strava" siguen siendo válidas con actividades del export.
- `components/perfil/splits-chart.tsx` — el comentario "Strava da average_speed en m/s" sigue siendo válido (Strava export también usa m/s).
- `convex/stravaExport*.ts` — todo el flujo ZIP se queda intacto.
- `convex/activities/normalize.ts` — la lógica de normalización del CSV es agnóstica a OAuth.
- `convex/activities/queries.ts` — solo ajustar el `provider` literal como se ha descrito.
- `lib/sticker-editor/polyline.ts` — decoder de polylines, agnóstico.
- `lib/training/detect-intervals.ts`, `convex/detectIntervalsBackfill*.ts` — sin OAuth, intactos.
- `convex/devOnly/*.ts` — si alguno importa OAuth, se archiva también.
- `scripts/mock/{strava-export-sample,test-parse-strava-export}.ts` — siguen siendo útiles para probar el ingest ZIP en local.

---

## 2. Orden de ejecución recomendado

> **Regla**: hacer 1 paso por sesión de git, con `npm run build` local antes
> de commit. Después de cada paso, parar y verificar. No acumular pasos sin
> haber verificado el build.

### Paso 1 (1h): UI — quitar OAuth de `/perfil`
1. Mover a `docs/_archive/strava-oauth/strava-oauth-connect.tsx` (con
   `git mv` para preservar history).
2. Editar `components/perfil/connections.tsx`:
   - Borrar import de `StravaOauthConnect` (línea 27).
   - Borrar import de `StravaIcon` si solo se usaba para OAuth (NO: se
     sigue usando en el header de la card Strava).
   - Borrar import de `useAutoSync` y de `oauthStatus`.
   - Borrar bloque con `<PremiumFeatureLock>` + `<StravaOauthConnect>`
     (líneas 117-134).
   - Reemplazar líneas 82-86 del status text:
     ```
     oauthStatus?.connected ? "Conectado, sincronizando…" : "Aún no has conectado Strava"
     ```
     por:
     ```
     "Sube tu export para ver tus carreras detectadas"
     ```
   - Cambiar líneas 39-46 (limpieza de query param `?strava=connected`)
     por no-op.
   - Borrar import de `StravaOauthConnect` del InfoModal interno y
     reescribir el contenido del modal para que NO mencione OAuth.
3. **Build local**: `npm run build` (NO solo `tsc --noEmit` — ver
   `AGENTS.md` regla 2).
4. **Smoke test manual**: `/perfil` debería verse sin la card de OAuth,
   solo la card "Subir export ZIP" + la card Garmin deshabilitada.

### Paso 2 (30m): Web copy — home, premium, FAQ, JSON-LD, privacidad
1. Editar `app/premium/page.tsx` líneas 62, 129, 194, 217, 302:
   - Metadata description: reescribir.
   - Tabla comparativa Free vs Pro: borrar fila "Sincronización Strava
     OAuth (API + webhook tiempo real)" → mantener solo "Subir export
     de Strava (ZIP, una vez)" y "Re-subir export tras cambiar de
     dispositivo".
   - Bloque "Sincroniza Strava sin tocar la web" → renombrar a
     "Sube tu export y empieza".
   - FAQ línea 302: reescribir respuesta.
2. Editar `app/page.tsx` líneas 151, 159, 207: reescribir JSON-LD del
   FAQ.
3. Editar `components/home/*`:
   - `hero.tsx` línea 121.
   - `pro-teaser.tsx` líneas 54, 66-68, 128.
   - `use-case.tsx` línea 31.
   - `faq.tsx` líneas 27, 32, 62.
   - `whats-here.tsx` línea 78: ya está bien.
   - `testimonials.tsx` línea 53: como es placeholder con disclaimer
     (regla 9 de AGENTS.md), se puede reescribir libremente.
4. Editar `app/legal/privacidad/page.tsx`:
   - Borrar sección 4.2 (líneas 112-119).
   - Reescribir sección 4.1 para que sea la **única** vía Strava.
5. Editar `components/billing/premium-feature-lock.tsx` y `paywall.tsx`:
   comentarios internos solo.
6. **Build local + commit + push a PRE** (`mi-dorsal.vercel.app`) para
   verificar visualmente. **No** a producción todavía.

### Paso 3 (30m): Backend — quitar cron y webhook
1. Editar `convex/cronJobs.ts` líneas 73-80: borrar bloque
   `renew-strava-webhook`.
2. Mover a `_archive/strava-oauth/` con `git mv`:
   - `convex/actions/stravaWebhookSubscription.ts`
   - `convex/actions/stravaWebhookHandler.ts`
   - `convex/actions/stravaInitialSync.ts`
   - `convex/stravaOauth.ts`
   - `convex/stravaInitialSyncHelpers.ts`
   - `convex/stravaWebhookHandlerInternal.ts`
3. Mover a `_archive/strava-oauth/`:
   - `app/api/connect/strava/start/route.ts`
   - `app/api/connect/strava/callback/route.ts`
   - `app/api/connect/strava/disconnect/route.ts`
   - `app/api/webhooks/strava/route.ts`
4. Editar `middleware.ts` línea 79: quitar `api/webhooks/strava` del
   regex negativo.
5. Editar `components/perfil/use-auto-sync.ts`: **borrar** el archivo
   (no archivar, no es reutilizable sin OAuth).
6. Editar `app/perfil/page.tsx` líneas 81-83 y 110-117: quitar import
   y banner "Sincronizando con Strava…".
7. **Build local**.

### Paso 4 (30m): Lib helpers + scripts → archivo
1. `git mv` a `docs/_archive/strava-oauth/`:
   - `lib/strava/client.ts`
   - `lib/strava/encrypt.ts`
   - `lib/strava/state.ts`
   - `scripts/generate-strava-key.ts`
2. Verificar que `grep -r "lib/strava" .` (excluyendo `_archive`) no
   devuelve nada.
3. **Build local**.

### Paso 5 (1h): Schema — borrar campos OAuth de `profiles`
> **Riesgo medio**: cambio irreversible. Empezar con un dump de la tabla
> `profiles` para tener respaldo por si hay que deshacer.

1. **Dump de respaldo** (decisión #7):
   - En **Convex Dashboard → Data → profiles**: filtrar
     `stravaAccessToken != null` y exportar a CSV/JSON.
   - Guardar en `backups/strava-oauth-users-{YYYY-MM-DD}.json` (la
     carpeta `backups/` ya existe según `AGENTS.md` para cosas de
     emergencia; si no, crearla y añadirla al `.gitignore` si no
     estaba).
   - Anotar en este plan el número de filas afectadas (para futuro
     seguimiento).
2. Editar `convex/schema.ts`:
   - Líneas 38-47: borrar 8 campos OAuth.
   - Línea 108: borrar índice `by_strava_user_id`.
   - Líneas 466-468 (`personalRecords.source`): borrar literal
     `"strava"`.
   - Líneas 851-852 (`activities.provider`): borrar literal `"strava"`.
3. Editar `convex/stravaExport.ts`:
   - Líneas 42-44: borrar literal `"strava"` del union `provider`.
   - Líneas 288-290: borrar literal `"strava"` del union `source`
     (uploads).
4. Ejecutar `npx convex codegen` para regenerar `api.d.ts` (regla 8 de
   AGENTS.md: cambios de schema → regen manual). Verificar que no hay
   imports rotos.
5. **Build local** (`npm run build`).
6. **Deploy Convex PRIMERO**: `npx convex deploy --prod`. Después
   `vercel deploy --prod --yes` (regla 11 de AGENTS.md: deploy Convex
   antes que Vercel cuando hay cambios de schema).
7. Smoke test: `/perfil` debería seguir funcionando para usuarios SIN
   OAuth. Para los usuarios CON OAuth (si los hay), deberían ver su
   card Strava sin "Conectado" y poder subir un ZIP.

### Paso 6 (30m): Ajustes finales en queries y references
1. `convex/activities/queries.ts` línea 504-506: cambiar query
   `findActivityByProviderId` para usar `provider: "strava-export"` o
   dejarlo genérico.
2. `convex/personalRecords.ts` línea 470: cambiar comentario
   "tras un disconnectAndPurge" → "tras borrar las actividades del
   export".
3. `convex/devOnly/*.ts`: si alguno importa OAuth, archivarlo
   también (chequear con grep).
4. **Build local**.

### Paso 7 (30m): Docs — limpiar referencias
Ejecutar todos los cambios listados en §1.3. En particular:
- `AGENTS.md` (líneas 11, 53, 66).
- `README.md` (líneas 40, 179).
- `docs/ROADMAP.md` (líneas 21, 437, 452).
- `docs/ARCHITECTURE.md` (grep dedicado).
- `docs/core/strava-integration.md` (reescribir).
- `docs/core/billing-subscriptions.md` (líneas 56-57).
- `docs/core/emails-crons.md` (línea 18).
- `docs/core/database-schema.md` (quitar campos OAuth).
- `docs/core/deploy-checklist.md` (líneas 34, 36).
- `docs/BILLING_SETUP.md` (línea 104).
- `docs/plans/*.md` (verificar cada uno).
- Mover `docs/history/strava-oauth-setup.md` a
  `docs/_archive/strava-oauth/setup.md` con cabecera histórica.

### Paso 8 (15m): Cancelar Summit y limpiar env vars
> **Decisión #6**: la app de Strava se deja en read-only (no se borra).
> Summit se cancela pero la app sigue registrada.

1. **Vercel** (`Settings → Environment Variables → Production`):
   borrar `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`,
   `STRAVA_WEBHOOK_CALLBACK_URL`, `STRAVA_TOKEN_KEY`.
2. **Convex** (`npx convex env list --prod` para ver, luego
   `npx convex env unset` para cada uno).
3. **Strava**: https://www.strava.com/settings/subscription → cancelar
   Summit. La app sigue existiendo en read-only (Single Player Mode).
   **No** borrar la app de Strava (`https://www.strava.com/settings/api`)
   para no tener que re-aprobar si reactivamos en el futuro.
4. Opcional: si quieres ser paranoico, deja la app en Strava en
   read-only y olvídate. Si en 12 meses no la reactivas, ya
   reconsideramos borrarla.

### Paso 9 (30m): Smoke test E2E
1. Login con tu usuario de prueba en `https://www.mi-dorsal.com`.
2. `/perfil`: NO debe verse la card de OAuth.
3. `/premium`: la tabla Free vs Pro NO debe mencionar OAuth.
4. Subir un ZIP de prueba (el que está en `scripts/mock/` o uno real
   tuyo) → debe procesarse correctamente y detectar carreras/PRs.
5. Comprobar que los iconos de Strava en el feed siguen linkeando a
   `strava.com/activities/{id}`.
6. Comprobar que `convex/cronJobs` ya NO tiene `renew-strava-webhook`
   en el dashboard de Convex.
7. Búsqueda en Google del sitio con `site:mi-dorsal.com "Strava
   OAuth"` → debe dar 0 resultados de páginas en producción (los docs
   históricos internos sí).

---

## 3. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Cambios de `schema.ts` rompen producción si hay datos con OAuth | Paso 5.1 obligatorio: **dump de respaldo** de las filas afectadas (`backups/strava-oauth-users-{fecha}.json`). Sin email de aviso (decisión #5): los usuarios activos descubrirán el cambio al entrar a `/perfil`. El script del dump deja claro cuántos son, para tener referencia si llegan tickets de soporte. |
| Build pasa local pero rompe en Vercel | Regla 2 de AGENTS.md: `npm run build` local (no solo `tsc --noEmit`). Verificado. |
| Cron `renew-strava-webhook` se sigue ejecutando tras quitarlo del código | Convex tarda hasta 24h en propagar el cambio de crons. Verificar en `Convex Dashboard → Crons` 24h después del deploy. |
| Usuarios que tenían el botón "Conectar Strava" en favoritos/se lo saben de memoria | Sin email (decisión #5). Si llegan tickets de soporte, se responde caso por caso con instrucciones para subir el ZIP. Opcionalmente, podemos añadir un banner suave en `/perfil` durante 30 días: "Hemos retirado la sincronización automática con Strava — sube tu export o añade carreras a mano". Decidir al ver el número de usuarios activos del dump del Paso 5.1. |
| Reactiven OAuth en el futuro y el código archivado no compila | Documentado en `docs/_archive/strava-oauth/README.md` (a crear): "Estos archivos están archivados y NO compilan con el schema actual. Para reactivar, ver `docs/plans/STRAVA_OAUTH_REACTIVATION.md` (a crear si se reactiva)." |
| Strava cobre antes de cancelar Summit | Programar cancelación de Summit en cuanto se haga el deploy a producción (Paso 8) — no antes, para no quedarnos sin webhook mientras el código sigue desplegado. |

---

## 4. Estimación total

- **Trabajo técnico**: 5-7h repartidas en 3 sesiones (Paso 1+2 en una
  sesión con deploy a PRE; Paso 3+4+5+6 en otra sesión con dump +
  deploy a producción; Paso 7+8+9 en una tercera sesión
  administrativa + docs + cancelar Summit).
- **Riesgo bajo si se ejecuta el orden recomendado**. Riesgo medio si
  se saltan pasos.
- **Ahorro**: $60/año + simplificación operativa + 0 dependencias
  externas nuevas.

---

## 5. Decisiones cerradas

1. **¿Cuándo cancelar Summit?** → Tras el Paso 5 (schema desplegado en
   producción). No antes.
2. **¿Email de aviso a usuarios con OAuth activo?** → **No** (decisión
   #5). Sin margen de días. Se responde caso por caso si llegan tickets.
3. **¿Borrar la app de Strava o dejarla en modo read-only?** →
   **Dejar en read-only** (decisión #6). Si en 12 meses no se reactiva,
   reconsideramos.
4. **¿Renombrar `socialStrava` (campo de `races`) que se usa en
   `app/carreras/[slug]/client.tsx`?** → **No**: es la URL pública de
   Strava de cada carrera, sigue siendo útil aunque OAuth no exista.
5. **¿Quitar también el input "URL de Strava" del `pr-form-modal`?**
   → **No**: sigue siendo válido. El usuario puede pegar la URL de su
   actividad y obtener el mapa/splits (la actividad ya está en nuestro
   DB por el export).
6. **¿Quitar la card Garmin deshabilitada de `connections.tsx`?**
   → **Dejarla**, es buena pinta de "roadmap honesto". Solo
   actualizamos el copy para que NO mencione OAuth.
7. **¿Hacer respaldo de profiles antes del deploy?** → **Sí**
   (decisión #7). Dump JSON/CSV a `backups/strava-oauth-users-{fecha}.json`.
   5 minutos que salvan.
8. **¿Cuándo dar el plan por "ready to execute"?** → Cuando este
   documento esté revisado y aprobado por Manu. Mientras tanto, el
   plan vive en `docs/plans/` como propuesta.

---

## 6. Criterios de "done"

- [ ] `git status` muestra solo archivos esperados (archivados +
  editados listados arriba).
- [ ] `npm run build` pasa local sin warnings de TypeScript.
- [ ] `npx convex dev` (en consola) no muestra errores de schema.
- [ ] `npx tsc --noEmit` pasa.
- [ ] `grep -r "strava" docs/ AGENTS.md README.md` muestra solo
  referencias a "Strava export (ZIP)" (no "OAuth").
- [ ] `grep -r "oauth" convex/ app/ components/ lib/ middleware.ts`
  (excluyendo `_archive/`) devuelve 0 resultados.
- [ ] Smoke test E2E completo (Paso 9) pasa.
- [ ] Strava Summit cancelado.
- [ ] Env vars OAuth borradas de Vercel + Convex.
- [ ] `docs/ROADMAP.md` actualizado: bullet "Quitar Strava OAuth"
  marcado como `[x]`.
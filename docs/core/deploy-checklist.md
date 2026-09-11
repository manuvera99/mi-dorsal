# Deploy y CI — procedimiento obligatorio

> Documento on-demand. Se carga antes de cualquier `git push origin master` o `vercel deploy`.

## Branch de producción

- `master` es el branch de producción.
- Comando: `vercel deploy --prod --yes` desde local.

## Variables de entorno críticas en Vercel

`NEXT_PUBLIC_CONVEX_URL`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_JWT_ISSUER_DOMAIN`, `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`.

## Crons

- **Crons en Vercel**: configurados en `vercel.json` (actualmente vacío `[]`).
- **Crons en Convex**: `convex/crons.ts` define 4 jobs (`checkResults`, `reminderPreRace`, `weeklyDigest`, `yearReview`).
- **GitHub Actions**: `.github/workflows/daily-ingest.yml` corre scrapers a diario.

## ⚠️ Advertencia sobre `git add -A`

**NO usar `git add -A`** indiscriminadamente. Varios archivos del working tree (`docs/MONETIZATION_PLAN.md`, `docs/DORSALSWAP_MVP.md`, `docs/INTERCAMBIO_DORSALES.md`, `docs/ANALISIS_BACKEND_DORSALES.md`, `convex/crons/resultNotFound.ts`, `components/dorsal-swap-widget.tsx`) son generados por el IDE del usuario o por otros procesos en background, no por la sesión de agente. **Antes de commit, hacer `git status` y revisar.**

## Entorno de PRE (`mi-dorsal.vercel.app`)

`mi-dorsal.vercel.app` está reasignado al branch `pre` (no a producción) como entorno de pre-producción, antes de promocionar a los dominios reales (`mi-dorsal.es`, `mi-dorsal.com`).

- **Setup** (una sola vez, hecho el 2026-09-11): en el dashboard de Vercel → Project Settings → Domains → editar `mi-dorsal.vercel.app` → **Preview** → Git Branch = `pre`. Esto NO se puede hacer con el CLI (`vercel domains` no tiene subcomando para esto), solo dashboard o API REST.
- **Flujo**: mergear/pushear a `pre` → Vercel construye y actualiza `mi-dorsal.vercel.app` automáticamente. Probar ahí antes de mergear `pre` → `master`.
- **Convex AISLADO**: PRE tiene su propio deployment de Convex, `ideal-lemming-633` (tipo `prod`, sin expiración, creado con `npx convex deployment create pre --type prod`), completamente separado de producción (`precious-goshawk-41`). Base de datos vacía — cualquier prueba que escriba datos (registro, votos, diplomas) NO toca datos reales.
  - Deploy key propia generada con `npx convex deployment token create <nombre> --deployment pre` (scoped a este deployment, guardarla fuera del repo).
  - **Redeploy tras tocar `convex/`**: `CONVEX_DEPLOY_KEY="<esa-key>" npx convex deploy` — ⚠️ `CONVEX_DEPLOYMENT=prod:ideal-lemming-633 npx convex deploy` NO funciona para seleccionar destino (el CLI ignora esa variable en `deploy`, solo la respeta `convex dev`); hay que usar `CONVEX_DEPLOY_KEY` con la deploy key real, o se despliega a producción por error.
  - Variables de entorno del deployment aislado (`CLERK_JWT_ISSUER_DOMAIN`, etc.) se configuran con `npx convex env set <VAR> <valor>` usando esa misma `CONVEX_DEPLOY_KEY`.
- **Variables de entorno Vercel para Preview**: configuradas y verificadas funcionando 2026-09-11 — `NEXT_PUBLIC_CONVEX_URL`/`NEXT_PUBLIC_CONVEX_SITE_URL`/`CONVEX_DEPLOYMENT` apuntan a `ideal-lemming-633`; `RESEND_*`, `STRAVA_TOKEN_KEY`, `ADMIN_BACKFILL_SECRET`, `OPENAI_*`, `NEXT_PUBLIC_USE_MOCK`, `NEXT_PUBLIC_APP_URL` copiadas de valores locales; `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` / `CLERK_JWT_ISSUER_DOMAIN` copiadas desde Production con Edit → marcar también Preview (sin re-teclear el secreto).
  - ⚠️ **Trampa detectada**: `.env.local`/`.env.production` (archivos del repo) tienen una clave Clerk `pk_test_...` de una instancia de DESARROLLO obsoleta/desactualizada — NO es la que usa producción real. Producción usa `pk_live_...` de una instancia LIVE con dominio custom `clerk.mi-dorsal.com`. Los archivos `.env*` del repo NO son fuente de verdad fiable para Clerk; para saber la clave real de producción, extraerla del HTML servido (`curl https://www.mi-dorsal.es | grep pk_live_`) o copiarla desde Vercel dashboard.
  - **Pendientes de añadir a mano en el dashboard** (secretos irrecuperables vía CLI — Manu debe pegarlos si algún día se prueban esas rutas en PRE): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_WEBHOOK_CALLBACK_URL`, `INTERNAL_API_SECRET`, `PDF_PARSER_SECRET`. Sin estas, esas rutas concretas (Stripe checkout, Strava OAuth, `/api/internal/render-diploma`) fallarán en PRE — el resto de la app funciona.
- **Otras ramas** (feature branches) siguen generando su URL efímera de siempre (`mi-dorsal-git-<rama>-manuvera99s-projects.vercel.app`) — no chocan con `mi-dorsal.vercel.app`, y siguen sin variables de entorno propias salvo que se añadan.
- `master` sigue siendo el branch de producción sin cambios; los dominios reales (`mi-dorsal.es`, `mi-dorsal.com`) no se ven afectados por nada de esto — verificado explícitamente.
- **Protección de acceso**: al dejar de ser dominio de producción, `mi-dorsal.vercel.app` quedó bajo "Standard Protection" (Vercel Authentication) por defecto — solo se ve logueado con la cuenta de Vercel del proyecto. Decisión explícita 2026-09-11: mantenerlo así (no exponer PRE públicamente). Si algún día hace falta compartir el link con alguien sin cuenta de Vercel, desactivar en Settings → Deployment Protection.
- **Troubleshooting 500 `MIDDLEWARE_INVOCATION_FAILED`**: casi siempre falta `CLERK_SECRET_KEY` en el entorno Preview (Clerk exige esa clave para que `clerkMiddleware()` arranque, sin ella crashea en cada request). Verificar con `vercel env ls preview`.
- **Troubleshooting error Clerk "Invalid host" / `host_invalid`**: la clave pública (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) no corresponde a una instancia de Clerk real/activa — ver la trampa de arriba. Verificar decodificando la clave (es base64 de `<dominio>.clerk.accounts.dev$` o similar) y comparando con el dominio real que muestra el dashboard de Clerk.
- **Nota sobre tipos "Config" vs "Sensitive" en Vercel**: el tipo de una env var NO se puede cambiar después de creada (ni desde el dashboard ni la CLI) — hay que borrarla y recrearla. Si una variable `NEXT_PUBLIC_*` queda marcada "Sensitive" por error, no pasa nada grave (solo impide volver a leerla desde el dashboard), pero para poder copiarla libremente entre entornos sin re-teclear, mejor crearla como "Config" desde el principio.

**Procedimiento recomendado**: `feature/x` → PR/merge a `pre` → verificar en `https://mi-dorsal.vercel.app` → merge `pre` a `master` → checklist de abajo → `vercel deploy --prod --yes`.

## Procedimiento pre-deploy obligatorio (local antes que PRO)

**NUNCA pushear a `master` sin haber validado el build en local primero.** Vercel detecta typechecks e inferencias de tipos que `tsc --noEmit` local puede pasar por alto (caché incremental, profundidad de inferencia, etc.). Confiar en que "local pasa" sin un build completo es un anti-patrón que ha costado varios deploys rotos y挽回 de emergencia.

**Checklist pre-deploy (ejecutar en este orden):**

1. **Typecheck explícito**: `npx tsc --noEmit` → 0 errores. Si hay errores, NO continuar.
2. **Build completo local**: `npm run build` → debe terminar con `✓ Compiled successfully`. Si falla, NO pushear, arreglar primero.
3. **Verificar que las rutas afectadas existen en el output del build**: revisar la tabla de rutas en la consola de `next build`. Si una ruta que tocas NO aparece, hay un problema (ruta mal nombrada, dynamic route sin `force-dynamic`, etc.).
4. **Solo entonces** commit selectivo (`git add <archivos específicos>`, NUNCA `git add -A`) + `git push origin master`.
5. Tras el push, monitorizar el deploy: `vercel ls mi-dorsal --yes`. Si sale `● Error`, leer logs con `vercel inspect <deployment> --logs`, NO acumular commits de parche a ciegas.

**Si Vercel falla pero local pasa**: casi siempre es uno de estos tres:
- **Caché corrupto de Vercel**: forzar redeploy con `vercel deploy --prod --force --yes` (verificar que `Skipping build cache, deployment was triggered without cache` aparece en el log).
- **Asume un archivo que no commiteaste**: `git status` para ver qué falta, commitear y pushear.
- **Inferencia de Convex 1.18 más estricta que local**: `ctx: any` en handlers de `internalAction`/`internalQuery` o cast a string para `runMutation(internal.X.Y as any)`. Ver entrada en memoria de agente.

**Aplicar a cualquier deploy de cualquier proyecto del workspace**, no solo mi-dorsal.

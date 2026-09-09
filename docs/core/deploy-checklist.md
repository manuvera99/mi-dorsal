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

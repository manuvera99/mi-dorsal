# Convex — upgrade y fixes TS2589 (sesión del 5 sep 2026)

> Documento opcional. Se carga cuando se toca Convex, el dashboard de billing, o aparecen errores TS2589.

## Plan actual: Convex Starter con cap de $10/mes

- **Desde**: 5 de septiembre de 2026, tras aviso de exceso del free plan.
- **Plan**: **Convex Starter** (pay-as-you-go con los mismos límites que el free, pero SIN tope duro). 1 developer (Manu).
- **Límite de gasto configurado**: **$10/mes** como red de seguridad.
- **Coste esperado**: **~$0-1/mes** en uso normal (después del fix del cron). ~$1.10 prorrateado en septiembre de 2026 por el exceso ya quemado.
- **Por qué NO Professional**: $25/mes fijo es 25× más caro para una app con 1 dev y poco tráfico. Solo se amortiza con 2+ devs, >50 GB/mes de I/O, o necesidad de backups diarios / support prioritario.

**Límites de Starter relevantes** (verificados en `docs.convex.dev/production/state/limits`, jul 2026):
- 1M function calls/mes incluidos (luego $2.20/M).
- 1 GB database bandwidth (I/O) / mes incluido (luego $0.22/GB).
- 0.5 GB database storage incluido (luego $0.22/GB-mes).
- 1 GB file storage incluido (luego $0.033/GB-mes).
- 1 GB egress/mes incluido (luego $0.132/GB).
- 20 GB-horas action compute incluido (luego $0.33/GB-hora).

**Dashboard**: https://dashboard.convex.dev/t/manuvera08/settings/billing

## Fix del cron `recalc-stats` (5 sep 2026)

**Síntoma**: Convex envió email avisando de exceso del free plan. `npx convex deploy` mostraba "Your projects are above the Free plan limits".

**Causa raíz**: `convex/crons/recalcStats.ts:32-48` hace un `Promise.all` de **7 `.collect()` sobre tablas grandes** (`races`, `profiles`, `raceVotes`, `raceRatings`, `myRaces`, `personalRecords`, `notificationLog`). Con 431 carreras, ~700 KB leídos por ejecución. A 5 min: 8.640 ejecuciones/mes × 700 KB = **~6 GB/mes de Database bandwidth**. Límite free: 1 GB/mes.

**Fix**: cambiar `{ minutes: 5 }` por `{ minutes: 30 }` en `convex/cronJobs.ts:53`. Nuevo consumo: ~1 GB/mes (dentro del free y Starter). Commit `4183d2e`.

**Lección para futuras sesiones**:
- Cualquier cron que haga `.collect()` de tablas grandes con frecuencia alta **quema bandwidth**. Antes de añadir crons a <15 min, medir.
- Revisar `convex/stats.ts` y `convex/crons/*.ts` para `Promise.all` + `collect()`.
- Si Convex avisa de nuevo de exceso de bandwidth, este es el primer sitio a mirar.

**Aplicar cuando**: Convex avise de exceso de bandwidth en el dashboard. Revisar primero los crones con `Promise.all` + `collect()`. Si están justificados, mantener y subir plan; si no, reducir frecuencia.

## Limpieza de errores TypeScript TS2589 (5 sep 2026)

**Síntoma**: `npx tsc --noEmit` fallaba con 31 errores en `convex/crons/*.ts`, `convex/devOnly/*.ts`, `convex/newsletter.ts` y `app/blog/client.tsx`. Bloqueaba `npx convex deploy` salvo con `--typecheck=disable`.

**Causa raíz**: Convex 1.18 + schema complejo. La tabla `races` tiene 50+ campos opcionales, unions grandes como `province` con 53 literales, y arrays de objetos como `raceFormats`, `aidStations`, `priceTiers`, `altimetryData`. Esto desborda la inferencia de tipos y produce **`TS2589: Type instantiation is excessively deep and possibly infinite`** en `internalAction` / `internalQuery` / `internalMutation`.

**Fix aplicada** (commit `4183d2e`) — ver también `docs/core/stack.md` §"Workaround TypeScript":
- `ctx: any` en el handler de todas las funciones `internal*` de `convex/crons/*.ts` y `convex/devOnly/*.ts`.
- `q: any` en queries reasignadas.
- `as const` en arrays derivados de `Record<string, X>`.
- Cast `as Record<string, number>` en `Object.values(...)`.
- `as any` en `runQuery(internal.X.Y)`.

**Aplicar cuando**:
- `npx convex deploy` falle con `TS2589` en un nuevo cron. Aplicar `ctx: any` en el handler.
- Si el error es en un `runQuery(internal.X.Y)`, usar `(internal.X.Y as any)`.
- Si el error es sobre `Record<string, X>` que debería ser union literal, añadir `as const` al array que se usa para derivar las keys.
- Workaround de emergencia: `npx convex deploy --typecheck=disable` (saltarse el typecheck, deploy igualmente). **Usar solo para sacar fixes urgentes**.

## Pendientes post-upgrade

- [ ] Revisar el dashboard de usage en 24-48h para confirmar que el bandwidth ha bajado tras el fix.
- [ ] Si en algún mes el coste sube de $5/mes, considerar Professional ($25/mes) para predictibilidad.
- [ ] Si se llega al límite de $10/mes configurado, hay un bug (bucle de cron, query descontrolada) — no es uso normal. Investigar qué crons/queries se han desbocado.
- [ ] Considerar añadir un **`tsc` check en CI** (GitHub Actions) para no acumular errores TS de nuevo.

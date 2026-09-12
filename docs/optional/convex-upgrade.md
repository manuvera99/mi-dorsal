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

## Fix de `systemUpsert` — índice real en vez de collect() de toda la tabla (12 sep 2026)

**Síntoma**: ninguno reportado por Convex todavía — encontrado en auditoría proactiva de costes pedida por el usuario, no por un aviso de exceso.

**Causa raíz**: `convex/races.ts` → `systemUpsert` (llamado desde el cron nocturno `daily-ingest.yml` por cada carrera ingestada/actualizada de las 6 fuentes) buscaba una carrera existente por `officialUrl` así:
```ts
const matches = await ctx.db.query("races")
  .withIndex("by_data_source" as any)  // índice "truco", no filtra por officialUrl
  .collect();                           // trae TODA la tabla
const filtered = matches.filter((r) => r.officialUrl === args.officialUrl);
```
Con ~2800 carreras (~3 MB por scan) y decenas de upserts/noche, esto podía consumir **~4.5-9 GB/mes** solo en esta función — varias veces el 1 GB/mes incluido en Starter.

**Fix**: nuevo índice `by_official_url` en `convex/schema.ts` (`.index("by_official_url", ["officialUrl"])`) + query real con `.withIndex("by_official_url", (q) => q.eq("officialUrl", args.officialUrl))`. Coste ahora proporcional a los documentos que coinciden (normalmente 0-1), no a la tabla completa. Commit `1bc3eee`.

**Ahorro estimado**: de ~4.5-9 GB/mes a prácticamente 0 en esta función — elimina la práctica totalidad del exceso sobre el 1 GB incluido.

**Lección**: el mismo patrón (`.withIndex()` genérico + `.filter()`/`.find()` en memoria para el filtro real) puede repetirse en cualquier mutation llamada en bucle desde un script o cron. No basta con que la query "tenga un índice" — hay que comprobar que el índice filtra por el campo que realmente importa.

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

## Checklist post-sesión (obligatoria tras tocar `convex/*.ts` o el schema)

**Por qué existe**: auditoría 2026-09-12 encontró `systemUpsert` (llamado
decenas de veces cada noche desde el cron de ingesta) haciendo un
`.collect()` de TODA la tabla `races` (~3 MB con ~2800 carreras) en vez de
usar un índice real — el mismo patrón que ya había causado el incidente de
`recalcStats` el 5 sep 2026 (ver más abajo). Sin este hábito, ambos bugs
podrían haber convivido meses sin detectarse porque Convex no avisa hasta
que se pasa el límite. **Cualquier sesión que toque `convex/*.ts` o el
schema debe correr esto antes de cerrar**:

1. **Buscar `.collect()` nuevos o modificados**: `grep -n "\.collect()" convex/*.ts convex/crons/*.ts`. Para cada uno, preguntar:
   - ¿Se llama desde un cron, o desde una mutation/query que se ejecuta muchas veces por noche/hora (ingesta, backfills)? Si sí → riesgo alto.
   - ¿El `.withIndex(...)` que lo precede filtra de verdad por el campo relevante, o es un índice "genérico" usado solo como truco con el filtro real hecho en `.filter()`/`.find()` en memoria después? Si es lo segundo → está trayendo la tabla entera.
   - Si la tabla es pequeña (<200 KB) y la función es de admin/uso esporádico (paneles, scripts manuales), es aceptable dejarlo así — no todo `.collect()` es un problema.
2. **Si se añadió un cron nuevo o se bajó su intervalo**: calcular bytes/ejecución × ejecuciones/mes y compararlo con el 1 GB/mes incluido en Starter. Ver el fix de `recalc-stats` abajo como plantilla del cálculo.
3. **Si se añadió un campo grande a una tabla ya grande** (array de objetos, texto largo): recalcular el tamaño medio por documento (`JSON.stringify(doc).length`) y multiplicar por cuántas veces al mes se lee/escribe esa tabla completa.
4. **Documentar el resultado**: si el cambio afecta al coste de forma medible (>0.1 GB/mes), añadir una entrada corta a esta sección (fecha + qué se optimizó + ahorro estimado), igual que las dos entradas de abajo.
5. **No hace falta** ejecutar esto para cambios que no toquen Convex (solo frontend, solo scripts de un solo uso, solo docs).

## Pendientes post-upgrade

- [ ] Revisar el dashboard de usage en 24-48h para confirmar que el bandwidth ha bajado tras el fix.
- [ ] Si en algún mes el coste sube de $5/mes, considerar Professional ($25/mes) para predictibilidad.
- [ ] Si se llega al límite de $10/mes configurado, hay un bug (bucle de cron, query descontrolada) — no es uso normal. Investigar qué crons/queries se han desbocado.
- [ ] Considerar añadir un **`tsc` check en CI** (GitHub Actions) para no acumular errores TS de nuevo.

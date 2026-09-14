# Fix duplicados same-source en el ingest — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que `systemUpsert` reconozca duplicados **same-source** (misma fuente reingesta la misma carrera con el nombre reescrito) — hoy el paso 1 (`officialUrl`) bloquea que structural/fuzzy lo intenten, y fuzzy exige fuente distinta por diseño previo. Este plan aplica 2 fixes puntuales verificados contra 2 noches reales de ingest en producción.

**Architecture:** Fix A modifica el paso 1 de `systemUpsert` (`convex/races.ts`) para que un `officialUrl` compartido por múltiples carreras existentes (URL de organizador/portal, no de una carrera específica) deje de "ganar" el match por defecto — cae a los pasos siguientes en vez de coger la más antigua. Fix B quita la condición `scraperAdapter` distinto del detector fuzzy en `findExistingMatch` (`convex/duplicateMatching.ts`), dejando el detector structural sin cambios. Spec completo: `docs/superpowers/specs/2026-09-14-fix-duplicados-same-source-design.md`.

**Tech Stack:** Convex (mutation `systemUpsert`), TypeScript, `tsx` para scripts standalone de test (mismo patrón que la iteración anterior, no hay vitest/jest en este repo).

---

## Contexto que el implementador necesita antes de tocar código

- **Este plan es la continuación directa de** `docs/superpowers/plans/2026-09-12-prevenir-duplicados-ingest.md` (ya implementado y mergeado a `master` en los commits `cee985a`..`607462c`). Ese plan arregló duplicados **cross-source** (0 duplicados nuevos verificados en 2 noches reales de producción). Este plan arregla un gap **distinto y complementario**: duplicados **same-source**, descubierto al verificar esas 2 noches reales.
- **Causa raíz verificada empíricamente, no solo inferida** (ver spec, sección "Contexto y problema"): scripts de ingest como `scripts/scrape-correbirras.ts` pasan como `officialUrl` la URL del organizador/club cuando la carrera no tiene web propia (ej. `carreraspopularesalmeria.com`, compartida por 9 carreras reales distintas en producción). El paso 1 de `systemUpsert` busca por ese URL exacto vía el índice `by_official_url`; si encuentra >1 carrera con ese URL compartido, hoy coge "la más antigua" como si fuera un match válido — bloqueando que structural/fuzzy lleguen a intentarlo con el nombre real.
- **Por qué solo fuzzy, no structural, para same-source**: al limpiar el backlog de 2 noches reales se cometieron y corrigieron manualmente 2 errores de fusión — una carrera infantil (500m) fusionada con la de adultos (10km) del mismo organizador/día, y 2 entradas "GRABACIÓN MEDALLA FINISHER..." (un servicio de cronometraje sin distancia real, `sourceFilter: "Otros eventos"`) fusionadas con la carrera real. **Ambos errores fueron capturados por el detector structural** (fecha+provincia+distancia), con la "distancia" coincidente siendo el fallback inventado `?? 10` de los scripts de ingest, no un dato real. Los duplicados same-source legítimos de esas mismas noches (10-12 por noche) tenían todos Jaccard ≥0.75 — pasan fuzzy sin ambigüedad. Por eso el fix habilita fuzzy same-source pero deja structural same-source deshabilitado.
- **Coste (regla obligatoria de esta sesión, `docs/optional/convex-upgrade.md` §"Checklist post-sesión")**: el Fix A no añade ningún `.collect()` nuevo — reutiliza el mismo `matches` ya cargado por el índice `by_official_url` (acotado a esa URL exacta). El Fix B no toca `ctx.db` en absoluto (es un cambio en un módulo puro sin acceso a BD). Ningún paso de este plan debe introducir una query nueva.
- **Efecto en el panel `/admin/duplicates` (`adminFindDuplicates`)**: su detector 3 (fuzzy) en `convex/races.ts` **ya agrupa same-source sin filtro de fuente** (a diferencia de su detector 2/structural, que sí excluye `sources.size < 2`) — el panel ya venía detectando estos pares correctamente. Este plan no modifica `adminFindDuplicates` en absoluto — solo alinea `systemUpsert` para reconocer en origen lo que el panel ya podía ver.
- No hay test runner (`vitest`/`jest`). Los "tests" son scripts standalone en `scripts/test-*.ts`, ejecutados con `npx tsx`, que imprimen `✓`/`✗` y hacen `process.exit(1)` si algo falla — mismo patrón que `scripts/test-duplicate-matching.ts` (ya existe, 12 checks, se extiende en este plan).
- **No hay sandbox de Convex** — un solo deployment compartido por dev/producción. La Task 3 (verificación manual) escribe temporalmente contra la BD real; debe limpiar sus datos de prueba y no requiere `--execute` de ningún script de limpieza (este plan no toca el backlog existente, que ya se limpió manualmente en la sesión de investigación previa).

## File Structure

- **Modify** `convex/races.ts` — Fix A: el paso 1 de `systemUpsert` deja de tratar un `officialUrl` compartido por >1 carrera como match válido.
- **Modify** `convex/duplicateMatching.ts` — Fix B: el detector fuzzy de `findExistingMatch` deja de exigir `scraperAdapter` distinto.
- **Modify** `scripts/test-duplicate-matching.ts` — 3 checks nuevos: fuzzy same-source SÍ dispara, structural same-source sigue sin disparar, caso de regresión de los 2 errores reales de fusión.

---

### Task 1: Fix B — habilitar fuzzy same-source en `findExistingMatch`

**Files:**
- Modify: `convex/duplicateMatching.ts:124-140` (bloque fuzzy dentro de `findExistingMatch`)
- Modify: `scripts/test-duplicate-matching.ts` (3 checks nuevos)

Se hace esta tarea primero (antes del Fix A) porque es la de menor riesgo — un cambio en un módulo puro sin `ctx.db`, cubierto al 100% por el smoke test existente. El Fix A (Task 2) depende de poder verificar con `tsc`/tests que este módulo sigue correcto antes de tocar `systemUpsert`.

- [ ] **Step 1: Quitar la exclusión de same-source en el bloque fuzzy**

En `convex/duplicateMatching.ts`, el bloque actual (líneas 124-140 del HEAD de este worktree) es:

```ts
  // 3. fuzzy: misma fecha + provincia (o localidad si no hay provincia),
  // similitud de nombre por Jaccard >= threshold, cruzando fuentes
  if (candidateNorm) {
    const candidateTokens = tokenize(candidate.name);
    const candidateProv = candidate.province ?? candidate.locality ?? "?";
    let best: { race: T; sim: number } | null = null;
    for (const r of pool) {
      if ((r.scraperAdapter ?? "manual") === candidateSource) continue;
      const rProv = r.province ?? r.locality ?? "?";
      if (rProv !== candidateProv) continue;
      const sim = jaccard(candidateTokens, tokenize(r.name));
      if (sim >= similarityThreshold && (!best || sim > best.sim)) {
        best = { race: r, sim };
      }
    }
    if (best) return { race: best.race, reason: "fuzzy" };
  }
```

Reemplázalo por (se elimina la línea `if ((r.scraperAdapter ...) continue;` y se actualiza el comentario):

```ts
  // 3. fuzzy: misma fecha + provincia (o localidad si no hay provincia),
  // similitud de nombre por Jaccard >= threshold. A diferencia de structural,
  // SÍ dispara same-source (2026-09-14): el patrón real observado es la
  // misma fuente reingestando la misma carrera con el nombre reescrito
  // (ediciones, mayúsculas, texto añadido) noche tras noche. structural
  // sigue exigiendo fuente distinta — es el detector más propenso a falsos
  // positivos cuando distanceKm es un fallback inventado, no un dato real
  // (ver docs/superpowers/specs/2026-09-14-fix-duplicados-same-source-design.md).
  if (candidateNorm) {
    const candidateTokens = tokenize(candidate.name);
    const candidateProv = candidate.province ?? candidate.locality ?? "?";
    let best: { race: T; sim: number } | null = null;
    for (const r of pool) {
      const rProv = r.province ?? r.locality ?? "?";
      if (rProv !== candidateProv) continue;
      const sim = jaccard(candidateTokens, tokenize(r.name));
      if (sim >= similarityThreshold && (!best || sim > best.sim)) {
        best = { race: r, sim };
      }
    }
    if (best) return { race: best.race, reason: "fuzzy" };
  }
```

El detector structural (bloque anterior en el mismo archivo, líneas 111-122) **no se toca** — sigue con `if ((r.scraperAdapter ?? "manual") === candidateSource) return false;` sin cambios.

- [ ] **Step 2: Actualizar el test existente que verificaba lo contrario**

El smoke test actual (`scripts/test-duplicate-matching.ts`) tiene un check que verificaba que same-source NUNCA disparaba fuzzy — ese comportamiento cambia intencionalmente en este fix. Busca este bloque (líneas 132-157 del HEAD de este worktree):

```ts
// --- findExistingMatch: mismo source nunca dispara structural/fuzzy (los cubre exact o nada) ---
const poolSameSource: MatchCandidate[] = [
  {
    name: "Carrera Popular de Petrer",
    startDate: "2026-03-08",
    scraperAdapter: "rfea",
    province: "alicante",
    locality: "Petrer",
    distanceKm: 10,
  },
];
const sameSourceDifferentNameResult = findExistingMatch(
  {
    name: "Otra Carrera Distinta",
    startDate: "2026-03-08",
    scraperAdapter: "rfea",
    province: "alicante",
    locality: "Petrer",
    distanceKm: 10,
  },
  poolSameSource,
);
check(
  "findExistingMatch no fusiona 2 carreras de la MISMA fuente con nombre distinto (structural/fuzzy exigen fuente distinta)",
  sameSourceDifferentNameResult === null,
);
```

Reemplázalo por (el nombre candidato ("Otra Carrera Distinta") tiene Jaccard 0 contra "Carrera Popular de Petrer" — sigue sin matchear, pero ahora la razón correcta es que fuzzy exige similitud alta, no que exija fuente distinta; el título del check y su comentario se actualizan para reflejar esto):

```ts
// --- findExistingMatch: mismo source NO dispara si el nombre es realmente distinto (fuzzy exige similitud alta, no fuente distinta) ---
const poolSameSource: MatchCandidate[] = [
  {
    name: "Carrera Popular de Petrer",
    startDate: "2026-03-08",
    scraperAdapter: "rfea",
    province: "alicante",
    locality: "Petrer",
    distanceKm: 10,
  },
];
const sameSourceDifferentNameResult = findExistingMatch(
  {
    name: "Otra Carrera Distinta",
    startDate: "2026-03-08",
    scraperAdapter: "rfea",
    province: "alicante",
    locality: "Petrer",
    distanceKm: 10,
  },
  poolSameSource,
);
check(
  "findExistingMatch no fusiona 2 carreras de la MISMA fuente si el nombre es realmente distinto (Jaccard bajo)",
  sameSourceDifferentNameResult === null,
);
```

- [ ] **Step 3: Añadir un check nuevo — fuzzy SÍ dispara same-source con nombre similar**

Añade este bloque nuevo justo después del check del Step 2, antes de la línea `console.log(\`\n${pass} OK, ${fail} fail\`);`:

```ts
// --- findExistingMatch: fuzzy SÍ dispara same-source cuando el nombre es similar (fix 2026-09-14) ---
const poolFuzzySameSource: MatchCandidate[] = [
  {
    name: "XVI Vuelta a Sierra Espuña",
    startDate: "2026-10-03",
    scraperAdapter: "correbirras",
    province: "murcia",
    locality: "Totana",
  },
];
const fuzzySameSourceResult = findExistingMatch(
  {
    name: "Vuelta Senderista a Sierra Espuña",
    startDate: "2026-10-03",
    scraperAdapter: "correbirras",
    province: "murcia",
    locality: "Totana",
  },
  poolFuzzySameSource,
);
check(
  "findExistingMatch SÍ fusiona 2 carreras de la MISMA fuente con nombre similar (Jaccard alto) — fix same-source",
  fuzzySameSourceResult?.reason === "fuzzy",
);
```

- [ ] **Step 4: Añadir un check de regresión — structural same-source sigue SIN disparar**

Añade este bloque nuevo justo después del check del Step 3:

```ts
// --- findExistingMatch: structural NUNCA dispara same-source (sin cambios, test de regresión) ---
const poolStructuralSameSource: MatchCandidate[] = [
  {
    name: "38 Pas Ras al Port de Valencia",
    startDate: "2026-12-13",
    scraperAdapter: "carreraspopulares",
    province: "valencia",
    locality: "Valencia",
    distanceKm: 10,
  },
];
const structuralSameSourceResult = findExistingMatch(
  {
    name: "Carreras Infantiles Pas Ras al Port de Valencia",
    startDate: "2026-12-13",
    scraperAdapter: "carreraspopulares",
    province: "valencia",
    locality: "Valencia",
    distanceKm: 10,
  },
  poolStructuralSameSource,
);
check(
  "findExistingMatch NO fusiona por structural dentro de la MISMA fuente (evita el falso positivo real de 2026-09-14: carrera infantil vs adultos)",
  structuralSameSourceResult === null,
);
```

Nota: este candidato SÍ tiene nombre parecido ("Pas Ras al Port de Valencia" en ambos), pero ya se verificó el cálculo exacto: `jaccard(tokenize("38 Pas Ras al Port de Valencia"), tokenize("Carreras Infantiles Pas Ras al Port de Valencia"))` da **0.667** — por debajo del umbral 0.75, así que fuzzy tampoco dispara este par. El check aísla correctamente estructural: el resultado `null` confirma que NI structural NI fuzzy fusionan este caso, que es exactamente el falso positivo real que se cometió y corrigió manualmente en la sesión de investigación previa.

- [ ] **Step 5: Ejecutar el smoke test**

Run: `npx tsx scripts/test-duplicate-matching.ts`
Expected: 14 checks (12 originales, sin ninguno eliminado — el Step 2 solo actualiza el texto/comentario de uno existente sin añadirlo de nuevo — más 2 nuevos de los Steps 3 y 4), todos `✓`, `14 OK, 0 fail`.

- [ ] **Step 6: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `convex/duplicateMatching.ts` ni en `scripts/test-duplicate-matching.ts`.

- [ ] **Step 7: Commit**

```bash
git add convex/duplicateMatching.ts scripts/test-duplicate-matching.ts
git commit -m "feat(duplicados): habilitar fuzzy same-source en findExistingMatch (structural sin cambios)"
```

---

### Task 2: Fix A — URLs de organizador compartidas no interceptan el matching en `systemUpsert`

**Files:**
- Modify: `convex/races.ts:757-768` (paso 1 de `systemUpsert`)

- [ ] **Step 1: Cambiar el criterio de `matches.length > 1`**

En `convex/races.ts`, dentro de `systemUpsert`, el bloque actual (líneas 757-768 del HEAD de este worktree) es:

```ts
    let existing: Doc<"races"> | null = null;
    if (args.officialUrl && !isHomepageUrl(args.officialUrl)) {
      const matches = await ctx.db
        .query("races")
        .withIndex("by_official_url", (q) => q.eq("officialUrl", args.officialUrl))
        .collect();
      if (matches.length === 1) existing = matches[0];
      else if (matches.length > 1) {
        // Hay varias con el mismo URL (no debería pasar, pero por si acaso): coge la más antigua
        existing = matches.sort((a, b) => (a._creationTime ?? 0) - (b._creationTime ?? 0))[0];
      }
    }
```

Reemplázalo por:

```ts
    let existing: Doc<"races"> | null = null;
    if (args.officialUrl && !isHomepageUrl(args.officialUrl)) {
      const matches = await ctx.db
        .query("races")
        .withIndex("by_official_url", (q) => q.eq("officialUrl", args.officialUrl))
        .collect();
      // Si varias carreras comparten este officialUrl, es la URL de un
      // organizador/portal (no de una carrera específica) — no es una señal
      // de identidad fiable. Se descarta y se deja caer a los pasos
      // siguientes (nombre+fecha+localidad → structural → fuzzy), que sí
      // usan el nombre real para diferenciar. Verificado 2026-09-14: URLs
      // como carreraspopularesalmeria.com son compartidas por 9 carreras
      // reales distintas en producción — antes de este fix, coger "la más
      // antigua" bloqueaba que structural/fuzzy llegaran a intentarlo con
      // el nombre real, generando duplicados same-source cada noche.
      if (matches.length === 1) existing = matches[0];
    }
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `convex/races.ts`.

- [ ] **Step 3: Checklist de coste (regla obligatoria de esta sesión)**

Run: `git diff convex/races.ts`
Expected: el diff de este Step solo elimina la rama `else if (matches.length > 1) { ... }` y su contenido — no añade ninguna query nueva a `ctx.db`. Confirma que `matches` sigue siendo el mismo array ya cargado por la query existente del paso 1 (sin duplicarla).

- [ ] **Step 4: Commit**

```bash
git add convex/races.ts
git commit -m "fix(duplicados): officialUrl compartido por múltiples carreras ya no intercepta el matching de systemUpsert"
```

---

### Task 3: Verificación manual end-to-end contra la BD real

**Files:** ninguno (verificación manual, sin cambios de código)

Esta tarea requiere escribir contra la base de datos real de Convex (no hay sandbox). **Antes de ejecutar cualquier mutation contra la BD real, pide confirmación explícita al usuario** — mismo patrón que la Task 4 del plan anterior (`docs/superpowers/plans/2026-09-12-prevenir-duplicados-ingest.md`).

- [ ] **Step 1: Desplegar el código a Convex**

Este worktree no tiene su propio `.env.local` (gitignored, no se copia a worktrees). La URL real del deployment es `https://precious-goshawk-41.convex.cloud` (confirmar contra `.env.local` del checkout principal si ha cambiado).

Run: `NEXT_PUBLIC_CONVEX_URL="https://precious-goshawk-41.convex.cloud" CONVEX_DEPLOYMENT="dev:precious-goshawk-41" npx convex deploy`
Expected: `✔ Deployed Convex functions to https://precious-goshawk-41.convex.cloud`. Esto es una acción con impacto real (sobrescribe las funciones activas en el único deployment compartido dev/producción) — confirma con el usuario antes de ejecutar si no se ha hecho ya en esta sesión.

- [ ] **Step 2: Caso de prueba — Fix B (fuzzy same-source) con datos ficticios**

Usa una fecha lejana (`2099-01-01`) para no chocar con carreras reales. Crea un archivo temporal (bórralo después) o usa `npx convex run` directamente:

```bash
NEXT_PUBLIC_CONVEX_URL="https://precious-goshawk-41.convex.cloud" CONVEX_DEPLOYMENT="dev:precious-goshawk-41" npx convex run races:systemUpsert '{"name":"XVI Carrera de Proba","startDate":"2099-01-01","province":"valencia","locality":"Proba","distanceKm":10,"scraperAdapter":"test-samesource"}'
```

Expected: `{ action: "created", id: "..." }`. Anota el `id`.

```bash
NEXT_PUBLIC_CONVEX_URL="https://precious-goshawk-41.convex.cloud" CONVEX_DEPLOYMENT="dev:precious-goshawk-41" npx convex run races:systemUpsert '{"name":"CARRERA DE PROBA","startDate":"2099-01-01","province":"valencia","locality":"Proba","distanceKm":10,"scraperAdapter":"test-samesource"}'
```

Expected: `{ action: "updated", id: "<MISMO id del paso anterior>" }` — confirma que fuzzy same-source reconoció la misma carrera reescrita, sin necesidad de fuente distinta.

- [ ] **Step 3: Caso de prueba — Fix A (officialUrl compartido)**

```bash
NEXT_PUBLIC_CONVEX_URL="https://precious-goshawk-41.convex.cloud" CONVEX_DEPLOYMENT="dev:precious-goshawk-41" npx convex run races:systemUpsert '{"name":"Carrera Organizador A","startDate":"2099-02-01","province":"valencia","locality":"Proba2","distanceKm":5,"officialUrl":"https://organizador-de-prueba.example.com/","scraperAdapter":"test-sharedurl"}'
```

Expected: `{ action: "created", id: "<id1>" }`.

```bash
NEXT_PUBLIC_CONVEX_URL="https://precious-goshawk-41.convex.cloud" CONVEX_DEPLOYMENT="dev:precious-goshawk-41" npx convex run races:systemUpsert '{"name":"Otra Carrera Organizador B Muy Distinta","startDate":"2099-02-08","province":"valencia","locality":"Proba3","distanceKm":15,"officialUrl":"https://organizador-de-prueba.example.com/","scraperAdapter":"test-sharedurl"}'
```

Expected: `{ action: "created", id: "<id2 DISTINTO de id1>" }` — mismo `officialUrl` compartido, pero como ahora hay 2 carreras con ese URL (`matches.length > 1` tras el segundo upsert), el paso 1 ya no intercepta; y como el nombre/fecha/distancia son completamente distintos, ningún otro detector los fusiona tampoco. Esto confirma que el Fix A no fusiona carreras genuinamente distintas solo porque compartan `officialUrl` de organizador.

Nota: si `id2` resultara igual a `id1` (bug), sería una señal de que el Fix A está siendo demasiado permisivo — detente y reporta antes de seguir limpiando.

- [ ] **Step 4: Limpiar los datos de prueba (obligatorio)**

```bash
NEXT_PUBLIC_CONVEX_URL="https://precious-goshawk-41.convex.cloud" CONVEX_DEPLOYMENT="dev:precious-goshawk-41" npx convex run races:systemDelete '{"id":"<id del Step 2>"}'
NEXT_PUBLIC_CONVEX_URL="https://precious-goshawk-41.convex.cloud" CONVEX_DEPLOYMENT="dev:precious-goshawk-41" npx convex run races:systemDelete '{"id":"<id1 del Step 3>"}'
NEXT_PUBLIC_CONVEX_URL="https://precious-goshawk-41.convex.cloud" CONVEX_DEPLOYMENT="dev:precious-goshawk-41" npx convex run races:systemDelete '{"id":"<id2 del Step 3>"}'
```

Verifica que no queda ninguna carrera con `startDate` `2099-01-01` o `2099-02-01`/`2099-02-08` antes de continuar.

- [ ] **Step 5: Verificar el backlog real tras el próximo ingest nocturno**

No hay acción inmediata aquí — esta verificación depende del cron `daily-ingest.yml` de la próxima noche. Cuando corra, ejecutar en dry-run (sin `--execute`):

```bash
NEXT_PUBLIC_CONVEX_URL="https://precious-goshawk-41.convex.cloud" npx tsx scripts/fix-cross-source-duplicates.ts
```

Expected: 0 grupos, o solo grupos que ninguno de los 2 fixes de este plan pretende cubrir (documentar cualquier caso nuevo explícitamente antes de decidir si aplica `--execute`, con confirmación del usuario como en la iteración anterior). No forma parte del ciclo de implementación en sí — es la validación de que el fix funcionó en producción real, y puede quedar como una nota de seguimiento para quien retome esta conversación al día siguiente.

---

## Resumen de archivos tocados

| Archivo | Tipo de cambio |
|---|---|
| `convex/duplicateMatching.ts` | Modify — fuzzy ya no exige `scraperAdapter` distinto; structural sin cambios |
| `scripts/test-duplicate-matching.ts` | Modify — 1 check actualizado + 2 checks nuevos (fuzzy same-source, regresión structural) |
| `convex/races.ts` | Modify — paso 1 de `systemUpsert` ignora `officialUrl` compartido por >1 carrera |

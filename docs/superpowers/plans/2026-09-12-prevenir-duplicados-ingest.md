# Prevenir duplicados en el ingest — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que `systemUpsert` (usado por todo el ingest nocturno) reconozca una carrera ya existente cruzando fuentes distintas — no solo por `officialUrl`/nombre+fecha exactos como hoy — para que dejen de crearse duplicados; y limpiar con un script one-off el backlog de duplicados que ya existen hoy en la base de datos real.

**Architecture:** Se extrae la lógica de matching de `adminFindDuplicates` (3 detectores: exact/structural/fuzzy) a un módulo puro `convex/duplicateMatching.ts`, sin `ctx.db`. `systemUpsert` lo usa sobre el pool ya cargado por `by_date` (mismo índice real que ya usa hoy, sin `.collect()` de tabla completa) para decidir si una carrera "ya existe" antes de crear una nueva. `adminFindDuplicates` se refactoriza para importar del mismo módulo, sin cambiar su comportamiento visible en el panel. Un script one-off (`scripts/fix-cross-source-duplicates.ts`, patrón dry-run/`--execute` ya usado en el repo) limpia el backlog actual, migrando referencias de usuario a las 10 tablas que apuntan a `races` antes de borrar cada duplicado, vía una nueva mutation atómica `races.systemMergeDuplicates`.

**Tech Stack:** Convex (queries/mutations puras + `ctx.db`), TypeScript, `tsx` para scripts standalone (no hay vitest/jest en este repo — los "tests" son scripts con `process.exit(1)` en fallo).

---

## Contexto que el implementador necesita antes de tocar código

- **Solo existe UN deployment de Convex, compartido por dev y producción** (confirmado en memoria de sesiones previas). No hay sandbox: cualquier mutation ejecutada desde un script (`ConvexHttpClient`) golpea la base de datos real. El script one-off de la Task 6 DEBE ejecutarse primero en `--dry-run` (default) y solo pasar a `--execute` con confirmación explícita del usuario, revisando el log de dry-run antes.
- **Regla de coste obligatoria de esta sesión** (`docs/optional/convex-upgrade.md` §"Checklist post-sesión", `AGENTS.md` regla #11): tras tocar `convex/*.ts`, buscar `.collect()` nuevos con `grep -n "\.collect()" convex/*.ts convex/crons/*.ts` y verificar que el índice que los precede filtra de verdad (no es un índice-truco con el filtro real en memoria). El propio `systemUpsert` fue arreglado el 2026-09-12 (commit `1bc3eee`) porque hacía `.collect()` de TODA la tabla `races` vía un índice que no filtraba. **Este plan reutiliza el pool que YA carga el paso 2 de `systemUpsert` con `by_date` (índice real, acotado a una fecha) — no se añade ningún `.collect()` nuevo sobre tabla completa.** La Task 4 debe verificar explícitamente esto al terminar.
- `adminFindDuplicates` (`convex/races.ts`, hoy ~línea 1072-1237 en el HEAD de este worktree) hace `.collect()` de TODA la tabla `races` sin índice — pero es una query de admin, de uso esporádico desde el panel `/admin/duplicates`, no desde un cron ni un bucle de ingesta. Es el caso "aceptable" que la propia checklist describe (tabla no gigante, uso esporádico) — no se toca ese coste en este plan, solo se refactoriza para compartir funciones puras.
- `systemUpsert` (`convex/races.ts`) es llamado por 6 scripts de ingest distintos (`ingest-to-convex.ts`, `ingest-sportmaniacs.ts`, `scrape-correbirras.ts`, etc.), decenas de veces cada noche desde `daily-ingest.yml`. Su paso 2 ya carga `dateMatches` con `by_date` (una query por `startDate` exacta — acotada, no toda la tabla). Este plan añade los pasos 3 (structural) y 4 (fuzzy) reutilizando ese mismo `dateMatches` ya cargado, sin query adicional.
- El módulo nuevo `convex/duplicateMatching.ts` debe ser **puro** (sin `import` de `./_generated/server` ni acceso a `ctx.db`) para poder importarlo tanto desde `adminFindDuplicates` (query) como desde `systemUpsert` (mutation) sin acoplar tipos de contexto.
- **Nunca importar un módulo de `convex/*.ts` desde un componente `"use client"`** — no aplica directamente a este plan (no se toca ningún componente de UI), pero si algún paso futuro reutiliza `duplicateMatching.ts` desde frontend, debe copiarse a `lib/`, no importarse directo (ver memoria `feedback_convex_patterns`).
- Tablas que referencian `races` (10, todas confirmadas en `convex/schema.ts` del HEAD de este worktree): `myRaces` (`raceId`, índice único lógico `by_user_race`), `raceRatings` (`raceId`, índice único lógico `by_user_race`), `raceVotes` (`raceId`, índice único lógico `by_user_race`), `personalRecords` (`raceId` opcional, sin unicidad), `raceResultsCache` (`raceId`, índice `by_race_dorsal` — unicidad por dorsal, no por usuario), `predictions` (`raceId`, sin unicidad), `notificationLog` (`relatedRaceId` opcional, sin unicidad), `activities` (`matchedRaceId` opcional, índice `by_matched_race`, sin unicidad), `feedbackReports` (`raceId` opcional, sin unicidad), `raceSuggestions` (`createdRaceId` opcional, sin unicidad), `raceCandidates` (`linkedRaceId` opcional, sin unicidad). Solo `myRaces`/`raceRatings`/`raceVotes` tienen conflicto de unicidad real (un usuario no puede tener 2 filas para la misma carrera) — las demás se migran sin condición.
- No hay test runner (`vitest`/`jest`). Los "tests" son scripts standalone en `scripts/test-*.ts`, ejecutados con `npx tsx scripts/nombre.ts`, que imprimen `✓`/`✗` por consola y hacen `process.exit(1)` si algo falla. Sigue ese patrón — no instales vitest.
- `scripts/find-cross-source-duplicates.ts` ya existe en el repo con una lógica DISTINTA (más simple, sin structural/fuzzy) y su propio merge (`buildMerge`). **No lo reutilices ni lo borres** — el script nuevo de este plan (`fix-cross-source-duplicates.ts`) es un archivo separado que usa la detección exact+structural+fuzzy completa vía el módulo compartido.

## File Structure

- **Create** `convex/duplicateMatching.ts` — funciones puras de normalización y matching (extraídas de `adminFindDuplicates`), sin acceso a `ctx.db`.
- **Modify** `convex/races.ts` — `adminFindDuplicates` importa del módulo nuevo (mismo comportamiento); `systemUpsert` gana los pasos 3 (structural) y 4 (fuzzy) de matching antes de crear; nueva mutation `systemMergeDuplicates`.
- **Create** `scripts/test-duplicate-matching.ts` — smoke test standalone del módulo puro.
- **Create** `scripts/fix-cross-source-duplicates.ts` — script one-off de limpieza del backlog (dry-run por defecto, `--execute` para aplicar).
- **Modify** `docs/core/admin-panel.md` y `docs/optional/enrichment.md` — documentar que `systemUpsert` ahora previene duplicados en origen (no solo el panel los borra).

---

### Task 1: Módulo puro `convex/duplicateMatching.ts`

**Files:**
- Create: `convex/duplicateMatching.ts`
- Test: `scripts/test-duplicate-matching.ts`

- [ ] **Step 1: Escribir el módulo**

Crea `convex/duplicateMatching.ts` con este contenido exacto (extraído literalmente de las funciones de normalización que hoy viven inline en `adminFindDuplicates`, `convex/races.ts` líneas ~1082-1109 y ~1168-1175 del HEAD de este worktree — mismo comportamiento, sin cambios de umbral ni de criterio):

```ts
// =============================================================================
// mi-dorsal — Matching de carreras duplicadas (módulo puro, sin ctx.db)
// =============================================================================
// Funciones de normalización y detección compartidas entre:
//   - convex/races.ts -> adminFindDuplicates (panel /admin/duplicates)
//   - convex/races.ts -> systemUpsert (ingest nocturno, previene duplicados
//     en origen en vez de detectarlos después)
//
// Es un módulo PURO a propósito: no importa nada de "./_generated/server"
// ni recibe ctx.db, para poder usarse igual desde una query (adminFindDuplicates)
// y desde una mutation (systemUpsert) sin acoplar tipos de contexto.
// =============================================================================

export type MatchReason = "exact" | "structural" | "fuzzy";

/** Forma mínima que necesita cualquier carrera (existente o candidata) para el matching. */
export interface MatchCandidate {
  name: string;
  startDate?: string;
  province?: string;
  locality?: string;
  distanceKm?: number;
  scraperAdapter?: string;
}

// ---------------------------------------------------------------------------
// Normalización de nombres
// ---------------------------------------------------------------------------

function stripOrdinals(s: string): string {
  return s
    .replace(/\b\d{1,3}[ºª°]\b/g, " ")
    .replace(/\b(X{0,3})(IX|IV|V?I{1,3}|X{1,2})\b/g, " ");
}

function stripYear(s: string): string {
  return s
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\b(edici[oó]n|ed\.?)\b/gi, " ");
}

export function normalizeName(s: string): string {
  return stripYear(stripOrdinals(s))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokenize(s: string): Set<string> {
  return new Set(normalizeName(s).split(" ").filter((t) => t.length > 1));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function normLocality(s: string | undefined): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function localitiesCompatible(a: string | undefined, b: string | undefined): boolean {
  const na = normLocality(a);
  const nb = normLocality(b);
  if (!na || !nb) return true; // si una falta, no descartar
  return na === nb || na.includes(nb) || nb.includes(na);
}

// ---------------------------------------------------------------------------
// findExistingMatch: prueba exact -> structural -> fuzzy, en ese orden.
// `pool` debe ser un conjunto ya acotado (p.ej. carreras de la misma fecha,
// cargadas vía índice by_date) — esta función NO consulta la BD.
// ---------------------------------------------------------------------------

export function findExistingMatch<T extends MatchCandidate>(
  candidate: MatchCandidate,
  pool: T[],
  opts?: { similarityThreshold?: number },
): { race: T; reason: MatchReason } | null {
  const similarityThreshold = opts?.similarityThreshold ?? 0.75;
  const candidateNorm = normalizeName(candidate.name);
  const candidateSource = candidate.scraperAdapter ?? "manual";

  // 1. exact: mismo scraperAdapter + nombre normalizado + misma fecha
  if (candidateNorm && candidate.startDate) {
    const exactMatch = pool.find(
      (r) =>
        (r.scraperAdapter ?? "manual") === candidateSource &&
        normalizeName(r.name) === candidateNorm &&
        r.startDate === candidate.startDate,
    );
    if (exactMatch) return { race: exactMatch, reason: "exact" };
  }

  // 2. structural: misma fecha + provincia + distancia (±0.1km) + localidad compatible,
  // cruzando fuentes (si fuera la misma fuente, el paso 1 ya la habría cogido)
  if (candidate.province && candidate.distanceKm !== undefined) {
    const structuralMatch = pool.find((r) => {
      if ((r.scraperAdapter ?? "manual") === candidateSource) return false;
      if (r.province !== candidate.province) return false;
      if (r.distanceKm === undefined) return false;
      if (Math.abs(r.distanceKm - candidate.distanceKm!) > 0.1) return false;
      return localitiesCompatible(r.locality, candidate.locality);
    });
    if (structuralMatch) return { race: structuralMatch, reason: "structural" };
  }

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

  return null;
}
```

- [ ] **Step 2: Escribir el smoke test standalone**

Crea `scripts/test-duplicate-matching.ts`:

```ts
// Smoke test del módulo puro de matching de duplicados
import {
  normalizeName,
  jaccard,
  tokenize,
  localitiesCompatible,
  findExistingMatch,
  MatchCandidate,
} from "../convex/duplicateMatching";

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗"}  ${label}`);
  if (cond) pass++;
  else fail++;
}

// --- normalizeName ---
check(
  "normalizeName quita ordinales y años",
  normalizeName("15ª Media Maratón de Xàtiva 2026") === "media maraton de xativa",
);
check(
  "normalizeName es case/acento-insensible",
  normalizeName("Cross de Carrús") === normalizeName("CROSS DE CARRUS"),
);

// --- jaccard ---
check(
  "jaccard de sets idénticos es 1",
  jaccard(tokenize("10K Villa de Rojales"), tokenize("10K Villa de Rojales")) === 1,
);
check(
  "jaccard de sets sin solapamiento es 0",
  jaccard(tokenize("Maratón de Valencia"), tokenize("Trail de Cuenca")) === 0,
);

// --- localitiesCompatible ---
check("localitiesCompatible acepta substring", localitiesCompatible("Xàtiva", "Xàtiva (Valencia)"));
check("localitiesCompatible acepta si una falta", localitiesCompatible(undefined, "Xàtiva"));
check(
  "localitiesCompatible rechaza localidades distintas",
  !localitiesCompatible("Valencia", "Alicante"),
);

// --- findExistingMatch: exact ---
const poolExact: MatchCandidate[] = [
  { name: "Cross de Carrús", startDate: "2026-11-15", scraperAdapter: "rfea", province: "alicante", distanceKm: 8 },
];
const exactResult = findExistingMatch(
  { name: "Cross de Carrus", startDate: "2026-11-15", scraperAdapter: "rfea" },
  poolExact,
);
check("findExistingMatch detecta exact (mismo source+nombre+fecha)", exactResult?.reason === "exact");

// --- findExistingMatch: structural (cross-source) ---
const poolStructural: MatchCandidate[] = [
  {
    name: "Media Marató de Xàtiva",
    startDate: "2026-10-04",
    scraperAdapter: "correbirras",
    province: "valencia",
    locality: "Xàtiva",
    distanceKm: 21.1,
  },
];
const structuralResult = findExistingMatch(
  {
    name: "21K Xàtiva",
    startDate: "2026-10-04",
    scraperAdapter: "sportmaniacs",
    province: "valencia",
    locality: "Xàtiva",
    distanceKm: 21.05,
  },
  poolStructural,
);
check(
  "findExistingMatch detecta structural (fecha+provincia+distancia cruzando fuentes)",
  structuralResult?.reason === "structural",
);

// --- findExistingMatch: fuzzy (cross-source, nombre similar) ---
const poolFuzzy: MatchCandidate[] = [
  {
    name: "Trail Ultra Helike Villena",
    startDate: "2026-05-09",
    scraperAdapter: "itra",
    province: "alicante",
  },
];
const fuzzyResult = findExistingMatch(
  {
    name: "Ultra Helike de Villena",
    startDate: "2026-05-09",
    scraperAdapter: "fedme",
    province: "alicante",
  },
  poolFuzzy,
);
check("findExistingMatch detecta fuzzy (nombre similar, Jaccard alto)", fuzzyResult?.reason === "fuzzy");

// --- findExistingMatch: NO debe matchear carreras distintas el mismo día ---
const poolDistinct: MatchCandidate[] = [
  {
    name: "10K Playa de San Juan",
    startDate: "2026-06-20",
    scraperAdapter: "rfea",
    province: "alicante",
    locality: "Alicante",
    distanceKm: 10,
  },
];
const distinctResult = findExistingMatch(
  {
    name: "Media Maratón de Elche",
    startDate: "2026-06-20",
    scraperAdapter: "fedme",
    province: "alicante",
    locality: "Elche",
    distanceKm: 21.1,
  },
  poolDistinct,
);
check(
  "findExistingMatch NO matchea carreras distintas el mismo día (distancia y nombre distintos)",
  distinctResult === null,
);

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

console.log(`\n${pass} OK, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 3: Ejecutar el smoke test**

Run: `npx tsx scripts/test-duplicate-matching.ts`
Expected: 11 líneas con `✓` y al final `11 OK, 0 fail`, exit code 0. Si alguna falla, ajusta la implementación de `findExistingMatch` en `convex/duplicateMatching.ts` (no relajes el test) hasta que las 11 pasen.

- [ ] **Step 4: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `convex/duplicateMatching.ts` ni en `scripts/test-duplicate-matching.ts`.

- [ ] **Step 5: Commit**

```bash
git add convex/duplicateMatching.ts scripts/test-duplicate-matching.ts
git commit -m "feat(duplicados): módulo puro de matching exact/structural/fuzzy"
```

---

### Task 2: `adminFindDuplicates` importa las funciones puras del módulo compartido

**Files:**
- Modify: `convex/races.ts:1078-1244` (handler de `adminFindDuplicates`)

**Importante:** `adminFindDuplicates` necesita encontrar **todos** los grupos de duplicados (agrupación pairwise sobre toda la tabla), mientras que `findExistingMatch` (Task 1) encuentra la **primera** coincidencia de un candidato contra un pool ya acotado. Son problemas distintos — esta tarea NO sustituye el algoritmo de agrupación de `adminFindDuplicates` por `findExistingMatch`; solo elimina la duplicación de las funciones puras de normalización (`normalizeName`, `tokenize`, `jaccard`, `localitiesCompatible`), que ahora se importan del módulo nuevo en vez de redefinirse inline. El comportamiento visible del panel `/admin/duplicates` no cambia.

- [ ] **Step 1: Añadir el import**

En `convex/races.ts`, línea 9 (junto a los imports de `./_helpers`), añade:

```ts
import { normalizeName, tokenize, jaccard, localitiesCompatible } from "./duplicateMatching";
```

- [ ] **Step 2: Eliminar las definiciones inline duplicadas dentro de `adminFindDuplicates`**

En el handler de `adminFindDuplicates` (líneas 1083-1181 del HEAD de este worktree), borra estos bloques que quedan redundantes tras el import:

```ts
    // === Normalización ===
    const stripOrdinals = (s: string) =>
      s.replace(/\b\d{1,3}[ºª°]\b/g, " ")
        .replace(/\b(X{0,3})(IX|IV|V?I{1,3}|X{1,2})\b/g, " ");

    const stripYear = (s: string) =>
      s.replace(/\b(19|20)\d{2}\b/g, " ")
        .replace(/\b(edici[oó]n|ed\.?)\b/gi, " ");

    const normalizeName = (s: string) =>
      stripYear(stripOrdinals(s))
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");

    const tokenize = (s: string): Set<string> =>
      new Set(normalizeName(s).split(" ").filter((t) => t.length > 1));

    const jaccard = (a: Set<string>, b: Set<string>): number => {
      if (a.size === 0 || b.size === 0) return 0;
      let inter = 0;
      for (const t of a) if (b.has(t)) inter++;
      const union = a.size + b.size - inter;
      return union === 0 ? 0 : inter / union;
    };
```

y, más abajo (dentro del bloque del "Detector 2: structural"):

```ts
    const normLocality = (s: string | undefined) =>
      (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const localitiesCompatible = (a: string | undefined, b: string | undefined) => {
      const na = normLocality(a);
      const nb = normLocality(b);
      if (!na || !nb) return true; // si una falta, no descartar
      return na === nb || na.includes(nb) || nb.includes(na);
    };
```

El resto del handler (los 3 bloques `byExact`/`byStructural`/`byFuzzyBucket`, `addGroup`, el `sort` final) queda **exactamente igual** — solo usan las funciones ahora importadas en vez de las locales que acabas de borrar.

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `convex/races.ts`. Si hay un error de "variable no usada" o "redeclarada", revisa que borraste las 2 definiciones completas (incluyendo `stripOrdinals`/`stripYear`, que solo se usaban dentro de la `normalizeName` local ya borrada).

- [ ] **Step 4: Verificación manual — el panel de duplicados sigue igual**

Run: `npx convex dev` en una terminal, `npm run dev` en otra. Abre `/admin/duplicates` con tu usuario admin de dev. Confirma que la lista de grupos que aparece es la misma que antes del refactor (mismo número de grupos, mismos textos de "reason"). Si tenías capturado el número de grupos antes de este cambio, compáralo; si no, basta con que la página cargue sin error y muestre grupos con sentido (no vacíos ni con `undefined`).

- [ ] **Step 5: Commit**

```bash
git add convex/races.ts
git commit -m "refactor(duplicados): adminFindDuplicates importa normalización del módulo compartido"
```

---

### Task 3: `systemUpsert` usa `findExistingMatch` (structural + fuzzy) antes de crear

**Files:**
- Modify: `convex/races.ts:730-758` (pasos 1-3 de búsqueda de `existing` dentro de `systemUpsert`)

- [ ] **Step 1: Añadir el import de `findExistingMatch`**

En `convex/races.ts` línea 9, junto al import ya añadido en la Task 2, añade `findExistingMatch` y el tipo `MatchCandidate`:

```ts
import { normalizeName, tokenize, jaccard, localitiesCompatible, findExistingMatch, MatchCandidate } from "./duplicateMatching";
```

- [ ] **Step 2: Ampliar la búsqueda de `existing` con structural + fuzzy**

Dentro de `systemUpsert`, el bloque actual (líneas 730-758 del HEAD de este worktree) es:

```ts
    // 1. Buscar por officialUrl específico
    // Fix 2026-09-12: antes hacía .collect() de TODA la tabla races (vía un
    // índice "by_data_source" usado solo como truco, con filtro real en
    // memoria) en cada llamada — con ~2800 carreras (~3 MB) y decenas de
    // upserts por noche desde el cron de ingesta, esto quemaba varios GB/mes
    // de database bandwidth solo en esta función (el plan Starter incluye
    // 1 GB/mes). Ahora usa el índice real by_official_url — coste O(matches),
    // no O(tabla completa).
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

    // 2. Buscar por nombre + fecha + localidad
    if (!existing && args.startDate) {
      const nameKey = norm(args.name);
      const dateMatches = await ctx.db
        .query("races")
        .withIndex("by_date", (q) => q.eq("startDate", args.startDate!))
        .collect();
      const locKey = norm(args.locality);
      if (locKey) {
        existing = dateMatches.find((c) => norm(c.name) === nameKey && norm(c.locality) === locKey) ?? null;
      }
      // 3. Buscar por nombre + fecha (sin localidad)
      if (!existing) {
        existing = dateMatches.find((c) => norm(c.name) === nameKey) ?? null;
      }
    }
```

Reemplázalo por (se mantienen los pasos 1-3 sin tocar; se añaden los pasos 4-5 reutilizando `dateMatches`, que ya estaba cargado por `by_date` — **sin query adicional**, cumpliendo la regla de coste de la sesión):

```ts
    // 1. Buscar por officialUrl específico
    // Fix 2026-09-12: antes hacía .collect() de TODA la tabla races (vía un
    // índice "by_data_source" usado solo como truco, con filtro real en
    // memoria) en cada llamada — con ~2800 carreras (~3 MB) y decenas de
    // upserts por noche desde el cron de ingesta, esto quemaba varios GB/mes
    // de database bandwidth solo en esta función (el plan Starter incluye
    // 1 GB/mes). Ahora usa el índice real by_official_url — coste O(matches),
    // no O(tabla completa).
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

    // 2. Buscar por nombre + fecha + localidad, y 3. por nombre + fecha (sin
    // localidad). dateMatches se reutiliza abajo en los pasos 4-5 (structural
    // + fuzzy) para no lanzar una query adicional — sigue siendo el mismo
    // índice real by_date, acotado a esta fecha exacta, no toda la tabla.
    let dateMatches: Doc<"races">[] = [];
    if (!existing && args.startDate) {
      const nameKey = norm(args.name);
      dateMatches = await ctx.db
        .query("races")
        .withIndex("by_date", (q) => q.eq("startDate", args.startDate!))
        .collect();
      const locKey = norm(args.locality);
      if (locKey) {
        existing = dateMatches.find((c) => norm(c.name) === nameKey && norm(c.locality) === locKey) ?? null;
      }
      if (!existing) {
        existing = dateMatches.find((c) => norm(c.name) === nameKey) ?? null;
      }
    }

    // 4-5. Structural + fuzzy cruzando fuentes (2026-09-12): antes de crear
    // una carrera nueva, comprobar si otra fuente ya describe la misma
    // carrera con un nombre distinto (misma fecha+provincia+distancia, o
    // nombre suficientemente similar). Mismo matching que ya usa el panel
    // /admin/duplicates (adminFindDuplicates) — spec en
    // docs/superpowers/specs/2026-09-12-prevenir-duplicados-ingest-design.md.
    // Reutiliza dateMatches (ya cargado arriba, mismo índice by_date) — sin
    // query adicional.
    if (!existing && args.startDate && dateMatches.length > 0) {
      const candidate: MatchCandidate = {
        name: args.name,
        startDate: args.startDate,
        province: args.province,
        locality: args.locality,
        distanceKm: args.distanceKm,
        scraperAdapter: args.scraperAdapter,
      };
      const match = findExistingMatch(candidate, dateMatches);
      if (match) {
        existing = match.race;
      }
    }
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `convex/races.ts`. Presta atención a que `norm` (la función local ya existente en `systemUpsert`, distinta de `normalizeName` del módulo — no la toques, sigue usándose en los pasos 2-3) y `normalizeName`/`tokenize`/`jaccard`/`localitiesCompatible` (importadas en la Task 2, usadas solo por `adminFindDuplicates`) coexisten sin colisión de nombres.

- [ ] **Step 4: Checklist de coste (regla obligatoria de esta sesión)**

Run: `grep -n "\.collect()" convex/races.ts`
Expected: la única llamada `.collect()` nueva introducida por este Step está ausente — el Step 2 no añade ningún `.collect()`, reutiliza `dateMatches` ya cargado por el paso 2-3 existente. Confirma leyendo el diff (`git diff convex/races.ts`) que no hay una nueva query a `ctx.db` en el bloque añadido, solo lectura en memoria de `dateMatches`.

- [ ] **Step 5: Commit**

```bash
git add convex/races.ts
git commit -m "feat(duplicados): systemUpsert reconoce carreras existentes vía matching structural+fuzzy"
```

---

### Task 4: Verificación manual de `systemUpsert` con un caso cross-source real

**Files:** ninguno (verificación manual, sin cambios de código)

- [ ] **Step 1: Arrancar Convex dev**

Run: `npx convex dev`
Expected: sincroniza sin error (no hay cambio de schema en este plan hasta la Task 5).

- [ ] **Step 2: Insertar una carrera "fuente A" de prueba**

En otra terminal, con `NEXT_PUBLIC_CONVEX_URL` en el entorno (revisa `.env.local`), ejecuta:

```bash
npx tsx -e "
import { ConvexHttpClient } from 'convex/browser';
import { api } from './convex/_generated/api';
const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const res = await client.mutation(api.races.systemUpsert, {
  name: 'Media Marato de Proba',
  startDate: '2099-01-01',
  locality: 'Proba',
  province: 'valencia',
  distanceKm: 21.1,
  scraperAdapter: 'test-source-a',
});
console.log(res);
"
```

Expected: `{ id: '...', action: 'created' }`. Usa una fecha lejana (`2099-01-01`) para no chocar con carreras reales y poder identificar/borrar fácilmente el registro de prueba después.

- [ ] **Step 3: Insertar una carrera "fuente B" que describe la MISMA carrera con nombre distinto**

```bash
npx tsx -e "
import { ConvexHttpClient } from 'convex/browser';
import { api } from './convex/_generated/api';
const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const res = await client.mutation(api.races.systemUpsert, {
  name: '21K de Proba',
  startDate: '2099-01-01',
  locality: 'Proba',
  province: 'valencia',
  distanceKm: 21.05,
  scraperAdapter: 'test-source-b',
});
console.log(res);
"
```

Expected: `{ id: '<MISMO id que en el Step 2>', action: 'updated' }` — confirma que el matching structural (misma fecha+provincia+distancia±0.1km+localidad compatible, fuente distinta) evitó crear una segunda carrera.

- [ ] **Step 4: Insertar una carrera "fuente C" con nombre similar pero sin distancia exacta (fuerza el camino fuzzy)**

```bash
npx tsx -e "
import { ConvexHttpClient } from 'convex/browser';
import { api } from './convex/_generated/api';
const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const res = await client.mutation(api.races.systemUpsert, {
  name: 'Media Marato Proba',
  startDate: '2099-01-01',
  province: 'valencia',
  scraperAdapter: 'test-source-c',
});
console.log(res);
"
```

Expected: `{ id: '<MISMO id>', action: 'updated' }` — sin `distanceKm`, el paso structural no aplica (`candidate.distanceKm === undefined`), pero el fuzzy (nombre similar, misma provincia) sí encuentra la carrera.

- [ ] **Step 5: Confirmar que sigue creando carreras genuinamente distintas**

```bash
npx tsx -e "
import { ConvexHttpClient } from 'convex/browser';
import { api } from './convex/_generated/api';
const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const res = await client.mutation(api.races.systemUpsert, {
  name: 'Carrera Totalmente Distinta',
  startDate: '2099-01-01',
  province: 'valencia',
  locality: 'Otro Pueblo',
  distanceKm: 5,
  scraperAdapter: 'test-source-d',
});
console.log(res);
"
```

Expected: `{ id: '<id NUEVO, distinto de los anteriores>', action: 'created' }`.

- [ ] **Step 6: Limpiar los datos de prueba**

Desde `/admin/races` (o `npx convex dashboard`), borra las 2 carreras creadas en los Steps 2 y 5 (`startDate: "2099-01-01"`). No hay commit en esta tarea — es solo verificación manual.

---

### Task 5: Mutation `systemMergeDuplicates` (fusiona 1 duplicado en la carrera conservada, migra referencias, borra)

**Files:**
- Modify: `convex/races.ts` (nueva mutation, cerca de `systemDelete`/`systemUpdate`)

Esta mutation es el "motor" que usará el script de la Task 6. Recibe `keepId` + `deleteId` (**uno solo por llamada**, no un array — así cada fusión es una transacción independiente y el script puede reportar éxito/fallo por duplicado sin que un fallo tumbe todo el grupo). Migra referencias en las 10 tablas listadas en el contexto, resolviendo el conflicto de unicidad en `myRaces`/`raceRatings`/`raceVotes`, y borra `deleteId` al final.

- [ ] **Step 1: Escribir la mutation**

Añade en `convex/races.ts`, justo después de `systemDelete` (línea ~916 del HEAD de este worktree):

```ts
/**
 * systemMergeDuplicates: fusiona UNA carrera duplicada (`deleteId`) en la
 * carrera que se conserva (`keepId`). Migra todas las referencias de usuario
 * a `races` antes de borrar `deleteId`, para no dejar FKs colgando.
 *
 * Usado por scripts/fix-cross-source-duplicates.ts (limpieza one-off del
 * backlog de /admin/duplicates). Auth-free como el resto de mutations
 * "system*" — solo se ejecuta desde terminal con CONVEX_DEPLOY_KEY.
 *
 * Tablas con conflicto de unicidad lógica (userId, raceId) — myRaces,
 * raceRatings, raceVotes — no se migran ciegamente: si el usuario ya tiene
 * fila en `keepId`, se conserva la de más señal y se borra la otra (nunca
 * las 2 a la vez, para no perder datos de nadie).
 */
export const systemMergeDuplicates = mutation({
  args: {
    keepId: v.id("races"),
    deleteId: v.id("races"),
  },
  handler: async (ctx, { keepId, deleteId }) => {
    if (keepId === deleteId) {
      throw new Error("keepId y deleteId no pueden ser la misma carrera");
    }
    const keepRace = await ctx.db.get(keepId);
    const deleteRace = await ctx.db.get(deleteId);
    if (!keepRace || !deleteRace) {
      throw new Error("keepId o deleteId no existen");
    }

    const migrated: Record<string, number> = {};
    const merged: Record<string, number> = {};

    // --- myRaces (conflicto de unicidad por userId) ---
    {
      const toMigrate = await ctx.db
        .query("myRaces")
        .withIndex("by_race", (q) => q.eq("raceId", deleteId))
        .collect();
      let n = 0, m = 0;
      for (const row of toMigrate) {
        const existingForUser = await ctx.db
          .query("myRaces")
          .withIndex("by_user_race", (q) => q.eq("userId", row.userId).eq("raceId", keepId))
          .unique();
        if (!existingForUser) {
          await ctx.db.patch(row._id, { raceId: keepId });
          n++;
        } else {
          // El usuario ya tiene fila en keepId: conserva la de más señal
          // (status !== "planned" gana a "planned"; si ambas iguales, la más
          // reciente por _creationTime) y borra la otra.
          const rowScore = row.status !== "planned" ? 1 : 0;
          const existingScore = existingForUser.status !== "planned" ? 1 : 0;
          if (rowScore > existingScore) {
            await ctx.db.delete(existingForUser._id);
            await ctx.db.patch(row._id, { raceId: keepId });
          } else if (rowScore < existingScore) {
            await ctx.db.delete(row._id);
          } else {
            // Empate de señal: conserva la más reciente
            if ((row._creationTime ?? 0) > (existingForUser._creationTime ?? 0)) {
              await ctx.db.delete(existingForUser._id);
              await ctx.db.patch(row._id, { raceId: keepId });
            } else {
              await ctx.db.delete(row._id);
            }
          }
          m++;
        }
      }
      migrated.myRaces = n;
      merged.myRaces = m;
    }

    // --- raceRatings (conflicto de unicidad por userId) ---
    {
      const toMigrate = await ctx.db
        .query("raceRatings")
        .withIndex("by_race", (q) => q.eq("raceId", deleteId))
        .collect();
      let n = 0, m = 0;
      for (const row of toMigrate) {
        const existingForUser = await ctx.db
          .query("raceRatings")
          .withIndex("by_user_race", (q) => q.eq("userId", row.userId).eq("raceId", keepId))
          .unique();
        if (!existingForUser) {
          await ctx.db.patch(row._id, { raceId: keepId });
          n++;
        } else {
          // Ya hay rating del usuario en keepId: nos quedamos con ese, se
          // borra el del duplicado (no hay "más señal" objetiva en un rating).
          await ctx.db.delete(row._id);
          m++;
        }
      }
      migrated.raceRatings = n;
      merged.raceRatings = m;
    }

    // --- raceVotes (conflicto de unicidad por userId) ---
    {
      const toMigrate = await ctx.db
        .query("raceVotes")
        .withIndex("by_race", (q) => q.eq("raceId", deleteId))
        .collect();
      let n = 0, m = 0;
      for (const row of toMigrate) {
        const existingForUser = await ctx.db
          .query("raceVotes")
          .withIndex("by_user_race", (q) => q.eq("userId", row.userId).eq("raceId", keepId))
          .unique();
        if (!existingForUser) {
          await ctx.db.patch(row._id, { raceId: keepId });
          n++;
        } else {
          await ctx.db.delete(row._id);
          m++;
        }
      }
      migrated.raceVotes = n;
      merged.raceVotes = m;
    }

    // --- Tablas sin conflicto de unicidad: migración directa ---
    // personalRecords no tiene índice por raceId (raceId es opcional, de baja
    // cardinalidad de uso) — .collect() de tabla completa aceptable aquí: es
    // un script one-off de mantenimiento, no un hot path de cron/ingesta (la
    // regla de checklist de coste de esta sesión aplica a hot paths).
    {
      const all = await ctx.db.query("personalRecords").collect();
      let n = 0;
      for (const row of all) {
        if (row.raceId === deleteId) {
          await ctx.db.patch(row._id, { raceId: keepId });
          n++;
        }
      }
      migrated.personalRecords = n;
    }

    {
      const toMigrate = await ctx.db
        .query("raceResultsCache")
        .withIndex("by_race", (q) => q.eq("raceId", deleteId))
        .collect();
      for (const row of toMigrate) {
        await ctx.db.patch(row._id, { raceId: keepId });
      }
      migrated.raceResultsCache = toMigrate.length;
    }

    {
      const toMigrate = await ctx.db
        .query("predictions")
        .withIndex("by_race", (q) => q.eq("raceId", deleteId))
        .collect();
      for (const row of toMigrate) {
        await ctx.db.patch(row._id, { raceId: keepId });
      }
      migrated.predictions = toMigrate.length;
    }

    {
      const toMigrate = await ctx.db
        .query("activities")
        .withIndex("by_matched_race", (q) => q.eq("matchedRaceId", deleteId))
        .collect();
      for (const row of toMigrate) {
        await ctx.db.patch(row._id, { matchedRaceId: keepId });
      }
      migrated.activities = toMigrate.length;
    }

    {
      const toMigrate = await ctx.db
        .query("feedbackReports")
        .withIndex("by_race", (q) => q.eq("raceId", deleteId))
        .collect();
      for (const row of toMigrate) {
        await ctx.db.patch(row._id, { raceId: keepId });
      }
      migrated.feedbackReports = toMigrate.length;
    }

    // notificationLog, raceSuggestions, raceCandidates no tienen índice por
    // raceId (son de bajo volumen y no forman parte de ningún hot path) —
    // se aceptan sin índice dedicado en este script one-off.
    {
      const all = await ctx.db.query("notificationLog").collect();
      let n = 0;
      for (const row of all) {
        if (row.relatedRaceId === deleteId) {
          await ctx.db.patch(row._id, { relatedRaceId: keepId });
          n++;
        }
      }
      migrated.notificationLog = n;
    }

    {
      const all = await ctx.db.query("raceSuggestions").collect();
      let n = 0;
      for (const row of all) {
        if (row.createdRaceId === deleteId) {
          await ctx.db.patch(row._id, { createdRaceId: keepId });
          n++;
        }
      }
      migrated.raceSuggestions = n;
    }

    {
      const all = await ctx.db.query("raceCandidates").collect();
      let n = 0;
      for (const row of all) {
        if (row.linkedRaceId === deleteId) {
          await ctx.db.patch(row._id, { linkedRaceId: keepId });
          n++;
        }
      }
      migrated.raceCandidates = n;
    }

    await ctx.db.delete(deleteId);

    return { keepId, deleteId, migrated, merged };
  },
});
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `convex/races.ts`.

- [ ] **Step 3: Commit**

```bash
git add convex/races.ts
git commit -m "feat(duplicados): mutation systemMergeDuplicates para fusionar un duplicado en la carrera conservada"
```

---

### Task 6: Script one-off `scripts/fix-cross-source-duplicates.ts`

**Files:**
- Create: `scripts/fix-cross-source-duplicates.ts`

**Nota de auth:** `adminFindDuplicates` exige `requireAdmin(ctx)` (identidad Clerk), que un script con `ConvexHttpClient` no tiene. Este script usa `systemListAllDetailed` (ya existe, auth-free, usada por otros scripts de migración como `find-cross-source-duplicates.ts`) para traer todas las carreras, y agrupa en el propio script usando las funciones puras de `convex/duplicateMatching.ts` — mismo criterio exact/structural/fuzzy que el panel, sin depender de la query autenticada.

- [ ] **Step 1: Escribir el script**

Crea `scripts/fix-cross-source-duplicates.ts`:

```ts
// =============================================================================
// scripts/fix-cross-source-duplicates.ts
// =============================================================================
// Limpia el backlog de duplicados cross-source detectados hoy en
// /admin/duplicates (exact + structural + fuzzy), migrando referencias de
// usuario a la carrera conservada antes de borrar cada duplicado.
//
// Por qué existe: hasta el 2026-09-12, systemUpsert no reconocía carreras
// ya existentes cruzando fuentes (ver
// docs/superpowers/specs/2026-09-12-prevenir-duplicados-ingest-design.md),
// así que cada noche de ingesta pudo haber creado duplicados que hoy están
// acumulados en la base de datos real. Este script es un ONE-OFF para
// limpiar ese backlog una vez — el fix de systemUpsert evita que se sigan
// creando nuevos a partir de ahora.
//
// IMPORTANTE: no hay entorno de sandbox — este script apunta a la BD real
// de producción/dev (mismo deployment). SIEMPRE correr primero sin flags
// (dry-run) y revisar el log completo antes de pasar --execute.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/fix-cross-source-duplicates.ts
//   npx tsx --env-file=.env.local scripts/fix-cross-source-duplicates.ts --execute
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import {
  normalizeName,
  tokenize,
  jaccard,
  localitiesCompatible,
} from "../convex/duplicateMatching";

const EXECUTE = process.argv.includes("--execute");
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error("❌ NEXT_PUBLIC_CONVEX_URL no configurado");
  process.exit(1);
}
const client = new ConvexHttpClient(convexUrl);

type RaceDoc = {
  _id: string;
  _creationTime: number;
  name: string;
  startDate?: string;
  province?: string;
  locality?: string;
  distanceKm: number;
  scraperAdapter?: string;
  [key: string]: unknown;
};

type Group = {
  key: string;
  reasonType: "exact" | "structural" | "fuzzy";
  races: RaceDoc[];
};

function countFields(r: RaceDoc): number {
  let n = 0;
  for (const [k, v] of Object.entries(r)) {
    if (k.startsWith("_") || k === "slug" || k === "scraperAdapter" || k === "extractedAt") continue;
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0) continue;
    n++;
  }
  return n;
}

/** Mismo algoritmo de agrupación que adminFindDuplicates (convex/races.ts),
 *  pero corriendo en el script con las funciones puras importadas, porque
 *  adminFindDuplicates exige auth admin que este script no tiene. */
function findDuplicateGroups(all: RaceDoc[], similarityThreshold = 0.75): Group[] {
  const groups = new Map<string, Group>();
  const addGroup = (races: RaceDoc[], reasonType: Group["reasonType"]) => {
    if (races.length < 2) return;
    const ids = races.map((r) => r._id).sort();
    const key = ids.join("|");
    const existing = groups.get(key);
    if (existing) {
      const order = { exact: 0, structural: 1, fuzzy: 2 } as const;
      if (order[reasonType] < order[existing.reasonType]) {
        groups.set(key, { key, reasonType, races });
      }
      return;
    }
    groups.set(key, { key, reasonType, races });
  };

  // Detector 1: exact
  const byExact = new Map<string, RaceDoc[]>();
  for (const r of all) {
    if (!r.startDate) continue;
    const norm = normalizeName(r.name);
    if (!norm) continue;
    const k = `${r.scraperAdapter ?? "manual"}|${norm}|${r.startDate}`;
    if (!byExact.has(k)) byExact.set(k, []);
    byExact.get(k)!.push(r);
  }
  for (const [, list] of byExact) {
    if (list.length >= 2) addGroup(list, "exact");
  }

  // Detector 2: structural
  const byStructural = new Map<string, RaceDoc[]>();
  for (const r of all) {
    if (!r.startDate || !r.province) continue;
    const distBucket = Math.round(r.distanceKm * 2) / 2;
    const k = `${r.startDate}|${r.province}|${distBucket}`;
    if (!byStructural.has(k)) byStructural.set(k, []);
    byStructural.get(k)!.push(r);
  }
  for (const [, list] of byStructural) {
    if (list.length < 2) continue;
    const sources = new Set(list.map((r) => r.scraperAdapter ?? "manual"));
    if (sources.size < 2) continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!localitiesCompatible(a.locality, b.locality)) continue;
        if (Math.abs(a.distanceKm - b.distanceKm) > 0.1) continue;
        addGroup([a, b], "structural");
      }
    }
  }

  // Detector 3: fuzzy
  const byFuzzyBucket = new Map<string, RaceDoc[]>();
  for (const r of all) {
    if (!r.startDate) continue;
    const prov = r.province ?? r.locality ?? "?";
    const k = `${r.startDate}|${prov}`;
    if (!byFuzzyBucket.has(k)) byFuzzyBucket.set(k, []);
    byFuzzyBucket.get(k)!.push(r);
  }
  for (const [, list] of byFuzzyBucket) {
    if (list.length < 2) continue;
    const tokensList = list.map((r) => ({ r, t: tokenize(r.name) }));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = tokensList[i];
        const b = tokensList[j];
        const sim = jaccard(a.t, b.t);
        if (sim >= similarityThreshold) addGroup([a.r, b.r], "fuzzy");
      }
    }
  }

  return Array.from(groups.values());
}

async function main() {
  console.log("=".repeat(70));
  console.log(`Fix cross-source duplicates (${EXECUTE ? "EJECUTANDO" : "DRY RUN"})`);
  console.log("=".repeat(70));
  if (!EXECUTE) {
    console.log("⚠️  DRY RUN — no se escribe nada. Revisa el log y vuelve a");
    console.log("    ejecutar con --execute cuando confirmes que está bien.");
  }

  const all = (await client.query(api.races.systemListAllDetailed, {})) as RaceDoc[];
  console.log(`\nTotal carreras en BBDD: ${all.length}`);

  const groups = findDuplicateGroups(all);
  console.log(`Encontrados ${groups.length} grupos duplicados (exact+structural+fuzzy)\n`);

  if (groups.length === 0) {
    console.log("✅ No hay duplicados pendientes");
    return;
  }

  let totalMerged = 0;
  let totalErrors = 0;

  for (const group of groups) {
    const sorted = [...group.races].sort((a, b) => countFields(b) - countFields(a));
    const keep = sorted[0];
    const toDelete = sorted.slice(1);

    console.log(`\n📍 [${group.reasonType}] "${keep.name}" (${group.races.length} carreras):`);
    console.log(`   ✓ Mantener: ${keep._id} — "${keep.name}" (${countFields(keep)} campos, ${keep.scraperAdapter ?? "manual"})`);
    for (const d of toDelete) {
      console.log(`   ${EXECUTE ? "→" : "[dry]"} Fusionar y borrar: ${d._id} — "${d.name}" (${countFields(d)} campos, ${d.scraperAdapter ?? "manual"})`);
    }

    if (EXECUTE) {
      for (const d of toDelete) {
        try {
          const res = await client.mutation(api.races.systemMergeDuplicates, {
            keepId: keep._id as any,
            deleteId: d._id as any,
          });
          console.log(`     ✅ Fusionado. Migrado: ${JSON.stringify(res.migrated)}${Object.values(res.merged).some((v) => v > 0) ? ` | Conflictos resueltos: ${JSON.stringify(res.merged)}` : ""}`);
          totalMerged++;
        } catch (e: any) {
          console.error(`     ❌ Error fusionando ${d._id}: ${e?.message ?? e}`);
          totalErrors++;
        }
      }
    } else {
      totalMerged += toDelete.length;
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("RESUMEN");
  console.log("=".repeat(70));
  console.log(`Grupos:                 ${groups.length}`);
  console.log(`Carreras fusionadas:    ${totalMerged}${EXECUTE ? "" : " (0 en dry-run, esto es lo que SE HARÍA)"}`);
  if (EXECUTE && totalErrors > 0) console.log(`Errores:                ${totalErrors}`);
  if (!EXECUTE) console.log(`\n(DRY RUN — añade --execute para ejecutar de verdad)`);
}

main().catch((e) => {
  console.error("❌ Error fatal:", e);
  process.exit(1);
});
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `scripts/fix-cross-source-duplicates.ts`.

- [ ] **Step 3: Ejecutar en dry-run contra la BD real**

Run: `npx tsx --env-file=.env.local scripts/fix-cross-source-duplicates.ts`

Expected: imprime el número total de carreras, el número de grupos duplicados encontrados, y por cada grupo qué se conservaría y qué se fusionaría/borraría — sin escribir nada (dry-run). Lee el log completo. Si algún grupo parece incorrecto (dos carreras que en realidad son distintas agrupadas por error), NO continúes a `--execute` — vuelve a `convex/duplicateMatching.ts` y ajusta el criterio antes de aplicar nada a la base de datos real.

- [ ] **Step 4: Pedir confirmación explícita al usuario antes de `--execute`**

No hay sandbox — este script escribe en la base de datos real de producción/dev (mismo deployment, ver contexto al inicio del plan). Antes de ejecutar con `--execute`, muestra el resumen del dry-run al usuario y espera su confirmación explícita. No ejecutes `--execute` de forma autónoma sin que el usuario haya visto el log del dry-run y dado el visto bueno.

- [ ] **Step 5: Ejecutar con `--execute` (solo tras confirmación del usuario)**

Run: `npx tsx --env-file=.env.local scripts/fix-cross-source-duplicates.ts --execute`

Expected: por cada grupo, cada duplicado se fusiona (`✅ Fusionado. Migrado: {...}`) y al final el resumen muestra `Carreras fusionadas: N`, `Errores: 0` (o revisa cualquier error reportado individualmente — un error en un grupo no bloquea los demás, gracias al try/catch por duplicado).

- [ ] **Step 6: Verificar en el panel que el backlog quedó limpio**

Abre `/admin/duplicates` (con `npm run dev` + `npx convex dev` corriendo). Expected: 0 grupos, o solo los que el script no pudo resolver (revisa los `❌ Error` del Step 5 si los hay).

- [ ] **Step 7: Commit**

```bash
git add scripts/fix-cross-source-duplicates.ts
git commit -m "feat(duplicados): script one-off para limpiar el backlog de duplicados cross-source"
```

---

### Task 7: Actualizar la documentación de referencia

**Files:**
- Modify: `docs/optional/enrichment.md` (sección "Panel de duplicados en `/admin/duplicates`")
- Modify: `docs/core/admin-panel.md:11` (fila de la tabla de `/admin/duplicates`)

- [ ] **Step 1: Añadir una nota en `docs/optional/enrichment.md` sobre la prevención en origen**

En `docs/optional/enrichment.md`, justo antes de la línea `## Panel de duplicados en /admin/duplicates` (línea ~68), añade una sección nueva:

```markdown
## Prevención de duplicados en el ingest (desde 2026-09-12)

Antes, `systemUpsert` (usado por todo el ingest nocturno) solo reconocía una
carrera existente por `officialUrl` específico o nombre+fecha(+localidad)
exactos — no cruzaba fuentes con nombres distintos, así que cada noche podían
crearse duplicados que el panel de abajo detectaba **después**.

Desde el commit que introduce `convex/duplicateMatching.ts`, `systemUpsert`
reutiliza el mismo matching structural+fuzzy que ya usaba el panel, sobre el
pool de carreras de la misma fecha (`by_date`, ya cargado, sin query
adicional). Spec completo:
`docs/superpowers/specs/2026-09-12-prevenir-duplicados-ingest-design.md`.

El panel de duplicados de abajo **sigue existiendo** como red de seguridad
para lo que el matching automático no capture (p.ej. carreras sin `startDate`,
o creadas manualmente con nombres muy distintos) — no se ha vuelto redundante.
```

- [ ] **Step 2: Actualizar el bloque "Implementación" existente**

En el bloque `**Implementación**:` (línea ~77 de `docs/optional/enrichment.md`), añade una línea nueva después de "Convex query: `adminFindDuplicates`":

```markdown
- Convex query: `convex/races.ts → adminFindDuplicates` (3 detectores + dedupe de grupos)
- Módulo compartido: `convex/duplicateMatching.ts` (funciones puras de normalización/matching, usadas también por `systemUpsert` para prevenir duplicados en el ingest — ver sección de arriba)
- Convex mutation: `adminDeleteMany` (batch delete con `requireAdmin`)
```

- [ ] **Step 3: Actualizar la fila de la tabla en `docs/core/admin-panel.md`**

En `docs/core/admin-panel.md` línea 11, cambia:

```markdown
| `/admin/duplicates` | Detecta carreras duplicadas (exact/structural/fuzzy). Solo BORRA, no hace merge. Ver `docs/optional/enrichment.md`. | `races` |
```

por:

```markdown
| `/admin/duplicates` | Detecta carreras duplicadas (exact/structural/fuzzy) como red de seguridad — `systemUpsert` ya previene la mayoría en el ingest desde 2026-09-12. Solo BORRA, no hace merge. Ver `docs/optional/enrichment.md`. | `races` |
```

- [ ] **Step 4: Commit**

```bash
git add docs/optional/enrichment.md docs/core/admin-panel.md
git commit -m "docs(duplicados): documentar la prevención de duplicados en systemUpsert"
```

---

## Resumen de archivos tocados

| Archivo | Tipo de cambio |
|---|---|
| `convex/duplicateMatching.ts` | Create — módulo puro de matching exact/structural/fuzzy |
| `scripts/test-duplicate-matching.ts` | Create — smoke test del módulo puro |
| `convex/races.ts` | Modify — `adminFindDuplicates` importa del módulo; `systemUpsert` gana pasos structural+fuzzy; nueva mutation `systemMergeDuplicates` |
| `scripts/fix-cross-source-duplicates.ts` | Create — script one-off de limpieza del backlog (dry-run/`--execute`) |
| `docs/optional/enrichment.md` | Modify — documentar prevención en origen |
| `docs/core/admin-panel.md` | Modify — actualizar descripción de `/admin/duplicates` |


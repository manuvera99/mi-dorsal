# Diseño: prevenir duplicados en el ingest (en vez de borrarlos después)

> Fecha: 2026-09-12. Estado: aprobado para plan de implementación.

## Contexto y problema

Cada noche `daily-ingest.yml` scrapea ~6 fuentes distintas (RFEA, FEDME, ITRA,
Runedia, Sportmaniacs, Agenda Sureste) y llama a `convex/races.ts::systemUpsert`
para cada carrera encontrada, con el objetivo de ser idempotente: si la carrera
ya existe, actualizarla; si no, crearla.

El problema es que `systemUpsert` reconoce una carrera existente con una lógica
mucho más pobre que la que ya usa `adminFindDuplicates` (el motor detrás del
panel `/admin/duplicates`):

- `systemUpsert` hoy solo matchea por:
  1. `officialUrl` específico (si no es una homepage genérica), o
  2. nombre normalizado + `startDate` (+ `locality` si está disponible).
- `adminFindDuplicates` usa 3 detectores por orden de confianza: **exact**
  (mismo `scraperAdapter` + nombre normalizado + fecha — un re-ingest literal),
  **structural** (misma fecha + provincia + distancia ±0.1km + localidad
  compatible, cruzando fuentes distintas) y **fuzzy** (misma fecha + provincia,
  similitud Jaccard de nombre ≥ threshold, cruzando fuentes).

Como cada fuente describe la misma carrera con nombres ligeramente distintos
("Media Marató de Xàtiva" vs "21K Xàtiva 2026"), `systemUpsert` no las reconoce
como la misma y crea una fila nueva cada noche. El panel de duplicados detecta
el problema **después** de que ya ocurrió; hasta ahora la única forma de
arreglarlo era borrar a mano desde el panel.

Esta iteración ataca la causa raíz: si el ingest reconoce mejor lo que ya
existe, nunca llega a crear el duplicado.

## Alcance

Incluye:
1. Extraer la lógica de matching de `adminFindDuplicates` a un módulo
   compartido, sin cambiar su comportamiento actual en el panel.
2. Ampliar `systemUpsert` para usar ese mismo matching (exact + structural +
   fuzzy) al decidir si una carrera ya existe, antes de crear una nueva.
3. Script one-off para limpiar el backlog de duplicados que ya existen hoy en
   la base de datos, migrando las referencias de usuario antes de borrar.

No incluye:
- Cambiar los 3 tipos de detección en sí (umbrales, criterios) — se reutilizan
  tal cual están hoy en `adminFindDuplicates`.
- Tocar el panel `/admin/duplicates` (sigue funcionando igual, como red de
  seguridad para los casos que el matching automático no capture).
- Un cron/job recurrente de borrado automático — descartado a favor de
  prevenir la creación en origen (ver "Alternativas descartadas").

## Módulo compartido: `convex/duplicateMatching.ts`

Funciones puras (sin acceso a `ctx.db`), extraídas de `adminFindDuplicates`:

```ts
export function normalizeName(s: string): string
export function tokenize(s: string): Set<string>
export function jaccard(a: Set<string>, b: Set<string>): number
export function localitiesCompatible(a?: string, b?: string): boolean

export type MatchReason = "exact" | "structural" | "fuzzy";

export interface MatchCandidate {
  name: string;
  startDate?: string;
  province?: string;
  locality?: string;
  distanceKm?: number;
  scraperAdapter?: string;
}

/**
 * Busca en `pool` (carreras ya cargadas, típicamente todas las de la misma
 * fecha vía índice by_date) la mejor coincidencia con `candidate`, probando
 * en orden de confianza: exact → structural → fuzzy. Devuelve la primera
 * que matchee, o null si ninguna lo hace.
 */
export function findExistingMatch<T extends MatchCandidate>(
  candidate: MatchCandidate,
  pool: T[],
  opts?: { similarityThreshold?: number },
): { race: T; reason: MatchReason } | null
```

`adminFindDuplicates` se refactoriza para importar estas funciones (mismo
comportamiento, sin cambios visibles en el panel). `systemUpsert` las importa
también.

## Cambio en `systemUpsert`

Orden actual de búsqueda de `existing`:
1. `officialUrl` específico.
2. Nombre normalizado + fecha (+ localidad).

Se añade, solo si los pasos 1-2 no encontraron nada:

3. Cargar el pool de carreras de esa `startDate` (ya se usa `by_date` en el
   paso 2 — se reutiliza el mismo resultado, sin query adicional).
4. `findExistingMatch(candidate, pool)` con el mismo `similarityThreshold`
   (0.75) que usa el panel por defecto.
5. Si devuelve match (`structural` o `fuzzy`), se trata como `existing`: el
   flujo de UPDATE ya existente (rellenar huecos, registrar
   `additionalDataSourceIds`, lógica de prioridad de fuentes) no cambia.

Si ningún paso encuentra match, se sigue creando una carrera nueva (rama
CREATE sin cambios).

No se toca la lógica de prioridad de fuentes ni la protección de campos
"Manual" — solo se ampliá qué cuenta como "ya existe".

## Script one-off: `scripts/fix-cross-source-duplicates.ts`

Limpia el backlog de duplicados ya creados antes de este fix. Mismo patrón que
`scripts/fix-same-source-duplicates.ts` existente: `--dry-run` por defecto,
`--execute` para aplicar.

1. Nueva query interna (o reutiliza `adminFindDuplicates` vía
   `ConvexHttpClient` con credenciales admin) que devuelve todos los grupos
   duplicados (exact + structural + fuzzy).
2. Por grupo, conservar la carrera con más `fieldsCount` (mismo criterio que
   la sugerencia "keepSuggestion" del panel).
3. Antes de borrar cada duplicado del grupo, migrar sus referencias a la
   carrera conservada en las tablas que apuntan a `races`:
   `myRaces`, `raceRatings`, `raceVotes`, `personalRecords`,
   `raceResultsCache`, `predictions`, `notificationLog`,
   `activities.matchedRaceId`, `feedbackReports.raceId`,
   `raceSuggestions.createdRaceId`, `raceCandidates.linkedRaceId`.
4. **Conflicto de unicidad** (`myRaces`, `raceRatings`, `raceVotes` tienen
   índice lógico único por `(userId, raceId)`): si el mismo usuario tiene fila
   tanto en el duplicado como en la carrera conservada, no se migra — se
   conserva la fila con más señal (para `myRaces`: `status !== "planned"`
   gana a `"planned"`; si ambas tienen el mismo status, la más reciente) y se
   borra la otra.
5. Tras migrar todas las referencias del grupo, borrar los duplicados
   (`systemDelete`).
6. Log por grupo: qué se conservó, qué se borró, qué referencias se migraron
   o fusionaron por conflicto — para poder auditar la corrida tras
   `--execute`.

Nueva mutation interna `races.systemMergeDuplicates` (o similar, sin
`requireAdmin` — se ejecuta desde terminal con `CONVEX_DEPLOY_KEY`, mismo
modelo de seguridad que `systemUpsert`/`systemDelete`) que recibe
`{ keepId, deleteIds }` y hace los pasos 3-5 en una sola mutation para
garantizar atomicidad por grupo.

## Testing

- Unit: `findExistingMatch` con pares conocidos exact/structural/fuzzy, y con
  un par que NO debe matchear (carreras distintas el mismo día en el mismo
  pueblo pero con distancia distinta).
- Convex: `systemUpsert` con dos "fuentes" simuladas describiendo la misma
  carrera con nombre distinto → debe devolver `action: "updated"`, no
  `"created"`; verificar que no rompe los tests/casos existentes de
  `systemUpsert` (prioridad de fuentes, protección de "Manual").
- Script: correr `--dry-run` contra el backlog real y revisar el log
  (cuántos grupos, qué se migraría) antes de `--execute`.
- Manual: tras desplegar el fix y correr `--execute` del script, verificar
  que `/admin/duplicates` queda vacío (o casi) y que la siguiente corrida de
  `daily-ingest` no añade grupos nuevos.

## Alternativas descartadas

- **Cron/job diario que borra automáticamente lo que aparece en el panel**:
  fue la primera propuesta, descartada por el usuario a favor de atacar la
  causa raíz en el ingest. Un borrado automático recurrente seguiría
  necesitando el mismo matching mejorado para decidir qué agrupar, y no evita
  que se sigan creando duplicados cada noche — solo los limpia después.
- **Excluir del script one-off las carreras con datos de usuario enganchados**
  (dejarlas para revisión manual): descartado a favor de migrar las
  referencias, para poder limpiar el backlog completo en una sola pasada.

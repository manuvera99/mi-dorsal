# Diseño: fix de duplicados same-source en el ingest

> Fecha: 2026-09-14. Estado: aprobado para plan de implementación.
> Continuación de `docs/superpowers/specs/2026-09-12-prevenir-duplicados-ingest-design.md`
> (que arregló los duplicados **cross-source**; este spec cubre el gap
> **same-source** descubierto tras verificar 2 noches reales de ingest).

## Contexto y problema

Tras desplegar el fix de duplicados cross-source (2026-09-12) y limpiar el
backlog, se verificaron 2 noches consecutivas de ingest real (13 y 14 de
septiembre) contra la base de datos de producción. Resultado:

- **Cross-source: 0 duplicados nuevos ambas noches.** El fix de
  `systemUpsert` (matching structural+fuzzy cruzando fuentes) funciona
  correctamente.
- **Same-source: 14 duplicados la primera noche, 12 la segunda.** Un patrón
  persistente y no cubierto por el fix anterior.

### Causa raíz (verificada empíricamente, no solo inferida)

El problema **no** es principalmente falta de cobertura en structural/fuzzy.
Es que el **paso 1 de `systemUpsert`** (matching por `officialUrl` exacto)
intercepta el flujo antes de que structural/fuzzy tengan oportunidad de
intentarlo con el nombre real:

1. Los scripts de ingest de `correbirras` (`scripts/scrape-correbirras.ts`) y
   fuentes similares, cuando una carrera no tiene web propia, pasan como
   `officialUrl` el fallback `SOURCE_URL` o la URL del **organizador/club**
   (ej. `carreraspopularesalmeria.com`, compartida por 9 carreras reales
   distintas; `atletaspopulares.es`, por 8; `dipualba.es`, por 8) — no una
   URL específica de esa carrera.
2. `isHomepageUrl()` en `systemUpsert` no filtra estas URLs (tienen pathname
   no vacío, o son dominios que no están en la lista hardcodeada de
   homepages conocidas: `fedme|rfea|sportmaniacs|runedia`).
3. El paso 1 busca por `officialUrl` exacto vía el índice `by_official_url`.
   Si encuentra `matches.length > 1` (varias carreras comparten esa URL de
   organizador), el código actual coge "la más antigua" (`sort by
   _creationTime`) como `existing` — casi nunca la carrera correcta.
4. Como `existing` queda fijado con ese match arbitrario, **nunca se llega a
   probar** structural/fuzzy con el nombre real de la carrera que se está
   reingestando, y se crea un duplicado.

Verificado con datos reales: 232 carreras de `correbirras` en producción,
con URLs de organizador compartidas por hasta 9 carreras distintas cada una
(`scripts/_check-url-collision.ts`, script de diagnóstico ad-hoc, no forma
parte del repo).

### Por qué structural/fuzzy tampoco lo cubrían (secundario)

Aunque el paso 1 no interceptara, `findExistingMatch` (`convex/duplicateMatching.ts`)
exige `scraperAdapter` **distinto** tanto en structural como en fuzzy — por
diseño del spec anterior, para evitar que un re-ingest normal de la misma
fuente con nombre idéntico (que ya cubre el detector "exact") disparara
structural/fuzzy innecesariamente. Pero esto también bloquea el caso real:
la misma fuente reingesta la misma carrera con el nombre reescrito
(ediciones, mayúsculas, texto añadido) noche tras noche.

### Por qué solo fuzzy, no structural, para same-source

Al limpiar el backlog de las 2 noches se cometieron 2 errores de fusión
(corregidos manualmente, ver commits de esa sesión): "CARRERAS INFANTILES
PAS RAS AL PORT DE VALENCIA" (500m) fusionada con "38 PAS RAS AL PORT DE
VALENCIA" (10km) — dos eventos reales distintos del mismo organizador/día;
y 2 entradas "GRABACIÓN MEDALLA FINISHER..." (un servicio de cronometraje,
`sourceFilter: "Otros eventos"`, sin distancia real) fusionadas con la
carrera real de Gandía. Ambos errores fueron detectados por el criterio
**structural** (fecha+provincia+distancia), no fuzzy — y en ambos casos la
"distancia" que coincidía era el fallback inventado `?? 10`, no un dato real
del evento.

En cambio, los 10-12 duplicados same-source legítimos de cada noche
(verificados con `officialUrl` idéntico entre el par, cuando estaba
disponible) tenían todos similitud de nombre (Jaccard) ≥0.75 — pasan el
filtro de fuzzy sin ambigüedad. Por tanto:

- **Fuzzy same-source: se habilita.** Umbral 0.75 ya validado, discrimina
  bien entre "mismo evento reescrito" y "evento distinto".
- **Structural same-source: se mantiene deshabilitado** (sigue exigiendo
  fuente distinta, sin cambios). Es el detector más propenso a falsos
  positivos cuando la distancia es un fallback inventado en vez de un dato
  real, y no aporta cobertura adicional sobre fuzzy para los casos reales
  observados.

## Alcance

Incluye:
1. **Fix A**: en `systemUpsert`, cuando el paso 1 encuentra múltiples
   carreras compartiendo el mismo `officialUrl`, deja de tratarlo como un
   match válido — cae a los pasos siguientes en vez de coger la más antigua.
2. **Fix B**: en `convex/duplicateMatching.ts`, el detector fuzzy de
   `findExistingMatch` deja de exigir `scraperAdapter` distinto. El detector
   structural no cambia.
3. Verificación end-to-end contra la BD real (mismo patrón que el spec
   anterior: dry-run del script existente, revisión manual antes de
   `--execute` si queda backlog).

No incluye:
- Tocar `isHomepageUrl()` para añadir más dominios a la lista hardcodeada
  — el Fix A resuelve el problema de forma genérica (por conteo de
  matches), sin depender de mantener una lista de dominios conocidos.
- Habilitar structural same-source — descartado explícitamente por el
  análisis de riesgo de esta sesión (ver arriba). Si en el futuro se
  necesita, requiere una salvaguarda adicional (ej. no usar `distanceKm`
  cuando proviene de un fallback, en vez de un dato real extraído) que no
  está diseñada aquí.
- Arreglar los scripts de ingest (`scrape-correbirras.ts` y similares) para
  dejar de pasar URLs de organizador como `officialUrl` — se descartó frente
  a la opción de blindar `systemUpsert` de forma genérica, que cubre
  cualquier scraper actual o futuro con el mismo patrón, sin tener que tocar
  cada script de ingest.
- Corregir retroactivamente el backlog de esta sesión — ya se limpió
  manualmente durante la investigación (con 2 errores corregidos también
  manualmente). Este spec es forward-looking: evita que se repita.

## Fix A — detalle de implementación

En `convex/races.ts`, dentro de `systemUpsert`, el bloque actual (paso 1):

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

Cambia a:

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
      // reales distintas en producción.
      if (matches.length === 1) existing = matches[0];
    }
```

Sin coste adicional: reutiliza el mismo `matches` ya cargado por el índice
`by_official_url` (acotado a esa URL exacta), sin queries nuevas.

## Fix B — detalle de implementación

En `convex/duplicateMatching.ts`, dentro de `findExistingMatch`, el bloque
fuzzy actual:

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

Cambia a (se elimina la línea `if ((r.scraperAdapter ...) continue;`):

```ts
  // 3. fuzzy: misma fecha + provincia (o localidad si no hay provincia),
  // similitud de nombre por Jaccard >= threshold. A diferencia de structural,
  // SÍ dispara same-source (2026-09-14): el patrón real observado es la
  // misma fuente reingestando la misma carrera con el nombre reescrito
  // (ediciones, mayúsculas, texto añadido) noche tras noche. structural
  // sigue exigiendo fuente distinta — es el detector más propenso a falsos
  // positivos cuando distanceKm es un fallback inventado, no un dato real
  // (ver spec para el análisis de los 2 errores de fusión que motivaron
  // esta asimetría).
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

El detector structural (bloque anterior en el mismo archivo) **no se toca**
— sigue exigiendo `(r.scraperAdapter ?? "manual") === candidateSource` como
condición de exclusión.

**Efecto en `adminFindDuplicates`** (panel `/admin/duplicates`): ese
detector de fuzzy tiene su propia implementación inline en `convex/races.ts`
(no reutiliza `findExistingMatch`, que es solo para `systemUpsert` — ver
spec anterior, Task 2). El panel ya excluye explícitamente pares del mismo
`scraperAdapter` del bucket de fuzzy mediante el filtro `sources.size < 2`
aplicado solo al detector structural — su detector 3 (fuzzy) en
`adminFindDuplicates` **no filtra por fuente en absoluto** (agrupa por
fecha+provincia sin distinguir fuente), así que ya venía detectando estos
pares same-source correctamente en el panel. Este spec no cambia
`adminFindDuplicates` — solo alinea `systemUpsert` para que reconozca en
origen lo que el panel ya podía ver.

## Testing

- Unit: extender `scripts/test-duplicate-matching.ts` con casos que
  confirmen: (a) fuzzy same-source SÍ dispara (nombre similar, misma fuente,
  Jaccard ≥0.75); (b) structural same-source NO dispara (mismo
  fecha+provincia+distancia, misma fuente — debe seguir devolviendo `null`
  para ese detector); (c) el caso de los 2 errores reales de esta sesión
  (distancia fallback + evento distinto) sigue sin fusionarse si se simula
  con `findExistingMatch` directamente (documentar como test de regresión).
- `systemUpsert`: caso con `officialUrl` compartido por 2+ carreras
  existentes → no debe usar ese match, debe caer a structural/fuzzy con el
  nombre real.
- Manual: correr el script `scripts/fix-cross-source-duplicates.ts` en
  dry-run tras la siguiente corrida real del `daily-ingest`, confirmar 0
  grupos same-source nuevos (o solo los que el propio criterio no cubre,
  documentados explícitamente).

## Alternativas descartadas

- **Arreglar los scripts de ingest en el origen** (no pasar URL de
  organizador como `officialUrl`): descartado porque no es genérico — cada
  scraper nuevo repetiría el mismo error si no se documenta explícitamente,
  mientras que el Fix A en `systemUpsert` cubre cualquier fuente actual o
  futura con el mismo patrón, sin mantenimiento adicional.
- **Habilitar structural same-source también**: descartado por el análisis
  de riesgo — los 2 únicos falsos positivos reales observados en esta
  sesión vinieron de structural con distancia fallback, no de fuzzy.
- **Añadir más dominios a la lista hardcodeada de `isHomepageUrl()`**:
  descartado porque no escala — la causa real es "URL compartida por
  múltiples carreras", detectable dinámicamente sin mantener una lista.

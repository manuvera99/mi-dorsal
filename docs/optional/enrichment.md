# Enrichment de carreras — procedimiento canónico

> Documento opcional. Se carga cuando se trabaja en `scripts/deep-extract-all.ts`, `scripts/geocode-races.ts`, el panel `/admin/duplicates`, o el panel `/admin/races/[id]`.

El schema soporta ~50 campos por carrera. La ficha en `/carreras/[slug]` los renderiza **condicionalmente**: si un campo está vacío, la sección ni se pinta. Albacete (ejemplo "perfecto") los tiene casi todos; el resto del catálogo está pelado por el source original (corredores populares suelen tener solo nombre, fecha, distancia, type).

## Las 3 capas de datos

| Capa | Cómo llega | Calidad |
|---|---|---|
| **Source** (RFEA, FEDME, ITRA, Runedia, Sportmaniacs, Correbirras) | Ingest con `systemCreate`/`systemUpsert` al ejecutar `npm run ingest:<source>` | Básica: nombre, fecha, locality, distance, type, a veces description y organizer |
| **Deep extract IA** | `scripts/deep-extract-all.ts` con modelo LLM (`OPENAI_BASE_URL=https://api.minimax.io/v1`) | Rica si la web oficial tiene info estructurada; modo "síntesis" si es landing page |
| **Manual** | Panel `/admin/races/[id]` con `adminUpdate` o botón "Extraer y aplicar" | La más precisa — humano en el loop |

## Procedimiento para enriquecer

1. **Ver el gap**:
   ```bash
   npx tsx --env-file=.env.local scripts/check-bulk-status.ts
   ```
   Imprime 18 métricas (longDescription, altimetryData, raceFormats, organizer, social, address, lat/lng, services, etc.) y desglose por source/confidence.

2. **Listar candidatos top** (próximas + publicadas + con officialUrl, ordenadas por destacado y fecha):
   ```bash
   npx tsx --env-file=.env.local scripts/list-top-candidates.ts
   ```
   Muestra las 30 más relevantes con lo que ya tienen y lo que les falta.

3. **Lanzar bulk deep-extract en background** (con HEAD probe para no quemar IA en URLs rotas):
   ```bash
   npx tsx --env-file=.env.local scripts/deep-extract-all.ts --priority --delay=3000
   ```
   - `--priority` procesa primero no-extraídas, luego baja-confianza, luego completas.
   - El HEAD probe marca con `extractedAt` las URLs 404/5xx para no reintentar.
   - El prompt tiene "modo síntesis": incluso en landing pages escasas, la IA escribe un `longDescription` útil.
   - ETA: ~3-5h para 2700 carreras (a 5s/carrera con delay 3s).
   - Log: `scripts/output/deep-extract-YYYY-MM-DD.log`.

4. **Geocodificar** lo que aún no tenga lat/lng (desbloquea "Cómo llegar" en la ficha):
   ```bash
   npx tsx --env-file=.env.local scripts/geocode-races.ts --only-missing
   ```
   ETA: ~40 min para 2300 carreras (1.1s/carrera, Nominatim ToS).

5. **Enriquecer a mano las top 20-30** desde `/admin/races/[id]`. El botón "Extraer y aplicar" lanza la IA contra la URL oficial y aplica el patch via `adminUpdate`. Para lo que la IA no pille, editar el form directamente.

6. **Medir el progreso** re-corriendo `check-bulk-status` y comparando.

## Arquitectura técnica

- **Single source of truth para el patch**: `buildExtractionPatch(data, sourceUrl)` en `lib/ai/extract-race-deep.ts`. Tanto el script bulk como el admin actions lo importan. NO duplicar la lista de campos en otros sitios — añadir a `PATCH_SCALAR_FIELDS` y a `convex/races.ts → adminUpdate`/`systemUpdate` validators.
- **Sanitización**: `sanitize(r)` en el mismo módulo normaliza la respuesta del LLM (recorta longitudes, filtra URLs, valida `TIME_RE`/`DATE_RE`, ordena arrays por km).
- **HEAD probe**: función `probeUrl()` en `deep-extract-all.ts`. Devuelve `'ok' | 'broken' | 'unknown'` y marca `extractedAt` en el caso broken para no re-intentar.
- **systemListAll ampliado** (2026-09-07): devuelve 23 campos extra (isPublished, isFeatured, scraperAdapter, startTime, address, venue, organizerUrl, contactPhone, dorsalPickupLocation, dorsalPickupHours, social*, imageUrl, description, registrationOpenDate/CloseDate, maxParticipants, timeLimitMinutes, courseType, gpxUrl, mapImageUrl, profileImageUrl, regulationUrl). Para que `check-bulk-status` reporte progreso real.

## Bug conocido: sportmaniacs devuelve 404

El 80% del catálogo viene de sportmaniacs. **TODAS** las URLs `sportmaniacs.com/es/races/{slug}/{uuid}/results` devuelven 404 (la plataforma reorganizó las rutas y los UUIDs ya no resuelven). El HEAD probe las salta correctamente. Solución definitiva (pendiente): backfillear `officialUrl` desde la ficha real de sportmaniacs via su API o re-scraping con el patrón nuevo. Mientras tanto, la única forma de enriquecer estas carreras es a mano desde el admin.

## Cron self-reminder para monitorizar

```bash
mavis cron self --cron-name "monitor-deep-extract" --every "15m" --prompt "..." --session mode=sessionId,session_id=me --quiet_on_skip true
```

El cron `monitor-deep-extract` está configurado al lanzar el deep-extract. Si el log no crece en 5 min, avisa. Cuando ve "RESUMEN" al final, lo borra y reporta.

## Prevención de duplicados en el ingest (desde 2026-09-12, ampliado 2026-09-14)

Antes, `systemUpsert` (usado por todo el ingest nocturno) solo reconocía una
carrera existente por `officialUrl` específico o nombre+fecha(+localidad)
exactos — no cruzaba fuentes con nombres distintos, así que cada noche podían
crearse duplicados que el panel de abajo detectaba **después**.

Desde el commit que introduce `convex/duplicateMatching.ts`, `systemUpsert`
reutiliza el mismo matching structural+fuzzy que ya usaba el panel, sobre el
pool de carreras de la misma fecha (`by_date`, ya cargado, sin query
adicional). Spec completo:
`docs/superpowers/specs/2026-09-12-prevenir-duplicados-ingest-design.md`.

De paso, la extracción a `duplicateMatching.ts` corrigió 3 bugs de
normalización que existían en el código inline original (regex de ordinales
que nunca matchaba, orden de stripping de acentos, tokens de 2 letras
inflando la similitud Jaccard) — el panel puede detectar algún grupo nuevo
que antes se le escapaba. No es una regresión: los criterios (exact/
structural/fuzzy, umbral 0.75) no cambiaron, solo la normalización previa.

El panel de duplicados de abajo **sigue existiendo** como red de seguridad
para lo que el matching automático no capture (p.ej. carreras sin `startDate`,
o creadas manualmente con nombres muy distintos) — no se ha vuelto redundante.

### Backlog inicial limpiado (2026-09-12)

Tras desplegar el fix, se limpió el backlog acumulado con
`scripts/fix-cross-source-duplicates.ts` (dry-run por defecto, `--execute`
para aplicar de verdad — sin sandbox, escribe contra la BD real). El script
agrupa candidatos con el mismo criterio del panel (vía
`convex/duplicateMatching.ts`, ya que no tiene auth admin para llamar a
`adminFindDuplicates` — usa `systemListAllDetailed`), y por cada grupo llama
a la mutation `races.systemMergeDuplicates(keepId, deleteId)`: migra
referencias de usuario en las 11 tablas que apuntan a `races` (`myRaces`,
`raceRatings`, `raceVotes` con resolución de conflicto por `userId`;
`personalRecords`, `raceResultsCache`, `predictions`, `activities`,
`feedbackReports`, `notificationLog`, `raceSuggestions`, `raceCandidates`
directas) antes de borrar el duplicado. Resultado: 44 carreras fusionadas;
7 grupos "The Bay 5K/Swim/Aquathlon" y "Beer Night Run" quedaron excluidos a
mano porque son disciplinas/eventos reales distintos del mismo día, no
duplicados — un detector automático no puede distinguirlos de forma segura.

### Gap same-source descubierto y arreglado (2026-09-14)

Verificando 2 noches reales de ingest post-deploy se confirmó 0 duplicados
**cross-source** nuevos, pero sí 14 y 12 duplicados **same-source** cada
noche (la misma fuente reingesta la misma carrera con el nombre reescrito —
ediciones, mayúsculas, texto añadido). Causa raíz: muchos scrapers (ej.
`scripts/scrape-correbirras.ts`) pasan como `officialUrl` la URL del
organizador/club cuando la carrera no tiene web propia — esa URL puede
estar compartida por 9+ carreras reales distintas del mismo organizador. El
paso 1 de `systemUpsert` (`by_official_url`) coge esa URL compartida como
match aunque no identifique una carrera concreta, bloqueando que
structural/fuzzy lleguen a intentarlo con el nombre real. Fix (spec:
`docs/superpowers/specs/2026-09-14-fix-duplicados-same-source-design.md`):

- **Fix A**: si el `officialUrl` está compartido por varias carreras
  existentes (o por una sola de **otra** fuente distinta — mismo bug, con
  una carrera de margen), ya no se trata como match válido; cae a los pasos
  de nombre+fecha/structural/fuzzy. Logging `[dup-officialUrl-shared]`
  cuando esto ocurre (sin sandbox, útil para verificar en logs de Convex).
- **Fix B**: el detector **fuzzy** de `findExistingMatch` ya no exige fuente
  distinta — puede reconocer un re-ingest same-source con nombre reescrito.
  El detector **structural** mantiene la exigencia de fuente distinta sin
  cambios: en la limpieza manual del backlog de estas 2 noches se cometieron
  (y corrigieron a mano) 2 fusiones erróneas por structural con una
  distancia fallback inventada (`?? 10`), no un dato real — carrera infantil
  fusionada con la de adultos, y un "servicio de grabación de medalla" sin
  distancia real fusionado con la carrera de verdad. Fuzzy también gana un
  veto: si ambos lados tienen `distanceKm` real y difieren en más de 1km, no
  dispara aunque el nombre sea casi idéntico (evita fusionar un "10K" con un
  "5K" del mismo organizador por nombre parecido).

## Panel de duplicados en `/admin/duplicates`

Detecta carreras candidatas a duplicado combinando 3 criterios (ordenados por confianza):

1. **exact**: mismo `scraperAdapter` + mismo nombre normalizado + misma fecha → re-ingest.
2. **structural**: misma fecha + misma `province` + misma `distanceKm` (±0.1 km) + `locality` compatible → cross-source probable (caso típico: Runedia mete un registro esquelético de la misma carrera que correbirras tiene completa).
3. **fuzzy**: misma fecha + misma `province` + Jaccard(tokens del nombre) ≥ 0.75 → nombres similares pero no idénticos.

**Implementación**:
- Convex query: `convex/races.ts → adminFindDuplicates` (3 detectores + dedupe de grupos)
- Módulo compartido: `convex/duplicateMatching.ts` (funciones puras de normalización/matching, usadas también por `systemUpsert` para prevenir duplicados en el ingest — ver sección de arriba)
- Convex mutation: `adminDeleteMany` (batch delete con `requireAdmin`)
- Página: `app/admin/duplicates/page.tsx` (Client Component)
- Scripts CLI equivalentes (para uso sin auth desde servidor):
  - `scripts/find-fuzzy-duplicates.ts` — fuzzy client-side
  - `scripts/find-dup-by-date-distance.ts` — structural client-side
  - `scripts/fix-same-source-duplicates.ts` — exact, ya existía
  - `scripts/fix-cross-source-duplicates.ts` — exact+structural+fuzzy vía `duplicateMatching.ts`, con migración de referencias (`races.systemMergeDuplicates`) antes de borrar. Dry-run por defecto, `--execute` para aplicar. Es el que se usó para el backlog de 2026-09-12.

**UI del panel**:
- Filtros por tipo de detección (all / exact / structural / fuzzy)
- Cada grupo muestra todas las carreras del grupo con: nombre, source, fecha, localidad, distancia, organizador, URL oficial, count de campos rellenos
- "Recomendado mantener" (✓ verde) = la que tiene más campos rellenos
- Checkboxes para marcar cada carrera como "borrar"
- Botón "Marcar para borrar (sugerencia)" en cada grupo: marca automáticamente todas las que NO son la recomendada
- Botón flotante de "Borrar N carreras" con confirmación

**Importante**: el panel solo BORRA, no hace merge. Si quieres preservar datos del duplicado (ej. organizerUrl que está solo en el secundario), cópialos a mano desde el detalle del secundario antes de borrarlo, o modifica el script para soportar merge.

# Diseño: selección de distancia/modalidad en carreras multi-distancia

> Fecha: 2026-09-09. Estado: aprobado para plan de implementación.

## Contexto y problema

Muchas carreras del catálogo tienen varias modalidades/distancias bajo el mismo evento
(ej. "Media Maratón de Albacete" con 10K y 21K). Hoy:

- `races.distanceKm` es la distancia "principal" de la carrera (un solo número).
- `races.raceFormats` (array embebido, sin `_id` propio) ya guarda modalidades
  alternativas, pero es **puramente informativo**: se muestra en la ficha
  (`RaceFormatsSection`) y no se conecta a nada más.
- `myRaces` (calendario del usuario) referencia `raceId` directamente. Al añadir
  una carrera, la predicción (`predictForMyRace`), el matching de PR en la card
  del calendario, el registro de PR al pegar un resultado manual, los emails con
  diploma y el filtro de distancia del catálogo **usan siempre `race.distanceKm`**,
  ignorando `raceFormats` por completo.

Consecuencia: si un usuario se apunta a "Media Maratón de Albacete" pero corre el
10K, la app calcula su predicción, su PR y su diploma como si hubiera corrido 21K.

## Alcance

Incluye:
1. Selector de modalidad al añadir una carrera con `raceFormats` al calendario.
2. Poder cambiar la modalidad elegida después, desde el propio calendario, mientras
   la carrera esté en estado `planned`.
3. Propagar la distancia elegida por el usuario (no la principal de la carrera) a:
   predicción, matching de PR, registro de PR al cerrar resultado, diploma/emails,
   cron de comprobación de resultados.
4. Ampliar el filtro de distancia del catálogo `/carreras` para que tenga en cuenta
   todas las modalidades de una carrera, no solo `distanceKm` principal.
5. Aviso visible de que la detección automática de modalidades (vía IA) está en
   desarrollo y puede ser incompleta o incorrecta.

No incluye (fuera de alcance de esta iteración):
- Convertir `raceFormats` en una tabla propia con `_id` (se mantiene como array
  embebido; ver "Alternativas descartadas").
- Cambiar el chip de distancia "principal" mostrado en las cards del listado de
  `/carreras` (sigue mostrando `race.distanceKm`).
- Tocar el scraper de resultados (`chiplevanteCarreraIds` ya prueba combinaciones
  independientemente de la modalidad elegida por el usuario).

## Modelo de datos

`races` no cambia de forma. Sigue con `distanceKm` (modalidad principal) y
`raceFormats` (array opcional de modalidades adicionales, ya existente).

`myRaces` gana 3 campos nuevos, todos opcionales (retrocompatibles):

```ts
selectedDistanceKm: v.optional(v.number()),
selectedDistanceLabel: v.optional(v.string()),      // "10K", "Media maratón", "Trail 25K"...
selectedElevationGainM: v.optional(v.number()),      // snapshot, si la modalidad lo especifica
```

Es un **snapshot** copiado en el momento en que el usuario elige su modalidad, no
una referencia (índice/id) a una entrada de `raceFormats`. Motivo: si un admin
re-extrae o edita `raceFormats` de la carrera más tarde, las inscripciones ya
hechas no deben cambiar de significado ni romperse. Mismo patrón que ya usa
`personalRecords` (guarda `distanceLabel` propio en vez de solo una referencia).

**Sin migración de datos existentes.** Las filas de `myRaces` creadas antes de
este cambio no tienen estos 3 campos (quedan `undefined`). En cualquier lectura,
se usa un helper:

```ts
// lib/prediction/... o convex/_helpers.ts
function getEffectiveDistance(myRace, race): { distanceKm: number; label: string; elevationGainM?: number } {
  if (myRace.selectedDistanceKm != null) {
    return {
      distanceKm: myRace.selectedDistanceKm,
      label: myRace.selectedDistanceLabel ?? getDistanceLabel(myRace.selectedDistanceKm * 1000),
      elevationGainM: myRace.selectedElevationGainM,
    };
  }
  return { distanceKm: race.distanceKm, label: getDistanceLabel(race.distanceKm * 1000), elevationGainM: race.elevationGainM };
}
```

Esto da fallback implícito a `race.distanceKm` sin backfill ni script de migración.

## Flujo 1 — Selector de modalidad al añadir la carrera

En `AddToCalendarWidget` (`components/add-to-calendar-widget.tsx`, variante real y mock):

- Si `race.raceFormats` está vacío/no existe → comportamiento actual, sin selector.
- Si tiene ≥1 entrada → se construyen las opciones: **[modalidad principal:
  `race.distanceKm`, label vía `getDistanceLabel`] + cada entrada de `raceFormats`**,
  renderizadas como grupo de botones/radio (nombre + km). Ninguna preseleccionada
  por defecto — el usuario debe elegir explícitamente antes de poder añadir.
- Debajo del selector, aviso corto: *"Detectamos las modalidades de esta carrera
  automáticamente — puede faltar alguna o estar mal. Si es tu caso, dínoslo"*,
  con enlace al sistema de feedback ya existente (`feedbackReports` / `/admin/feedback`).
- `myRaces.add` gana un argumento opcional:
  ```ts
  selectedDistance: v.optional(v.object({
    distanceKm: v.number(),
    label: v.string(),
    elevationGainM: v.optional(v.number()),
  }))
  ```
  Si se pasa, se guarda snapshot en `myRaces` (los 3 campos nuevos) y la
  predicción (`predictForMyRace`) usa esa distancia en vez de `race.distanceKm`.
  Si no se pasa (carrera sin `raceFormats`), comportamiento idéntico al actual.

## Flujo 2 — Cambiar la modalidad después, desde el calendario

En `HiloNode` (`components/calendario/hilo-node.tsx`): si la carrera tiene
`raceFormats`, el chip de distancia (hoy solo texto: `{distanceKm} km · {raceType}`)
se vuelve interactivo (icono de lápiz o el propio chip es clicable) y abre el
mismo selector de modalidades del Flujo 1, con la opción actual preseleccionada.

Nueva mutation `myRaces.updateDistance`:
- Args: `id: v.id("myRaces")`, `selectedDistance: { distanceKm, label, elevationGainM? }`.
- Solo permitido si `myRace.status === "planned"` (una vez `done`/`dns`/`dnf` no
  tiene sentido cambiar la distancia — el resultado real ya fija la distancia
  corrida).
- Efectos al ejecutar:
  1. Actualiza `selectedDistanceKm/Label/ElevationGainM`.
  2. Recalcula la predicción con `predictForMyRace`, usando la nueva distancia
     efectiva (mismos PRs del usuario, mismo `raceType`/temperatura estimada).
     Actualiza `predictedTimeSeconds`, `predictionConfidence`, `predictionFactors`.
  3. **Resetea el objetivo manual** si existía (`predictedTimeSeconds` puesto vía
     `setTargetTime` deja de tener sentido para la nueva distancia): se limpia y
     se vuelve a poblar con la predicción automática recién calculada. Se avisa
     con un toast breve ("Recalculamos tu predicción para la nueva distancia").
  4. Inserta un nuevo log en `predictions` (igual que hace `add` hoy).

## Flujo 3 — Propagar la distancia efectiva a PR, diploma y emails

Puntos de código que hoy usan `race.distanceKm` directamente para un `myRace` y
deben pasar a usar `getEffectiveDistance(myRace, race)`:

- `convex/myRaces.ts` → `add` (ya cubierto en Flujo 1), `setManualResult` (líneas
  ~276 y ss.): hoy calcula `distanceM = race.distanceKm * 1000` para decidir si el
  resultado mejora el PR del usuario y en qué distancia se guarda. Debe usar la
  distancia efectiva — si no, un usuario que corrió el 10K de una carrera con
  `distanceKm` principal 21.1 se llevaría un PR de media maratón falso.
- `components/calendario/hilo-node.tsx` → matching de PR (`findMatchingPR`,
  tolerancia ±200m), chip de distancia mostrado, cálculo de pace mostrado en la
  card. Todo pasa a usar la distancia efectiva del `myRace`.
- `convex/emailNotificationsAction.ts` y `convex/emailNotificationsHelpers.ts` →
  cálculo de `distanceM`/`currentPR` para el email de resultado encontrado,
  `distanceKm`/`distanceLabel`/`paceFormatted` que se escriben en el diploma PDF
  (`DiplomaProps`).
- `convex/crons/checkResults.ts` → cálculo de `distanceM` al procesar un resultado
  scrapeado (para el mismo propósito que `emailNotificationsHelpers`).

En todos los casos, el cambio es sustituir `race.distanceKm` (y su `distanceM`
derivado) por el resultado de `getEffectiveDistance(myRace, race)` — no cambia la
lógica de negocio de cada punto, solo la fuente de la distancia.

## Flujo 4 — Filtro de distancia en el catálogo `/carreras`

`distanceToCategories` (duplicada intencionalmente en `convex/races.ts` y
`lib/utils.ts`, mismo criterio) se aplica a `race.distanceKm` **y** a cada
`race.raceFormats[].distanceKm`. La carrera cae en una categoría de filtro si
*alguna* de sus distancias (principal o de cualquier modalidad) está en el rango
de esa categoría.

No cambia el chip de distancia mostrado en las cards del listado (sigue siendo
`race.distanceKm`, la principal) — solo amplía qué carreras aparecen al filtrar
por una categoría concreta. Ejemplo: filtrar por "10K" debe encontrar la Media
Maratón de Albacete porque tiene un `raceFormat` de 10K, aunque su `distanceKm`
principal sea 21.1.

## Aviso de detección automática en desarrollo

Texto corto, reutilizado como fragmento/componente pequeño, visible en el
selector de modalidad (Flujos 1 y 2): *"Detectamos las modalidades de esta
carrera automáticamente — puede faltar alguna o estar mal. Si es tu caso,
dínoslo"*, enlazando al flujo de feedback existente. No se duplica en la ficha
pública de carrera (`RaceFormatsSection`) en esta iteración — si en el futuro se
decide mostrarlo ahí también, es un cambio de una línea al reutilizar el mismo
fragmento.

## Alternativas descartadas

- **Tabla `raceModalities` propia con `_id`**, referenciada desde `myRaces` y
  `personalRecords`: más "correcta" relacionalmente, pero requiere migrar
  `raceFormats` existentes, tocar el pipeline de extracción IA y el form admin,
  y no aporta beneficio inmediato dado que el snapshot en `myRaces` ya resuelve
  el problema de integridad ante ediciones posteriores de `raceFormats`. Se
  descarta por ahora; si el catálogo evoluciona a necesitar más metadata por
  modalidad (precio, cupo, cronometraje independiente), reconsiderar.
- **Referencia por índice/id a `raceFormats` en vez de snapshot**: descartada
  porque es frágil ante regeneración/reordenación de `raceFormats` por IA o admin.
- **Backfill de `myRaces` existentes**: descartado, sin beneficio sobre el
  fallback implícito a `race.distanceKm`.

## Testing

- Unit: `getEffectiveDistance` (con y sin selección), `predictForMyRace` con
  distancia de modalidad distinta a la principal, `distanceToCategories` aplicado
  a `raceFormats`.
- Convex: `myRaces.add` con y sin `selectedDistance`; `myRaces.updateDistance`
  (recalcula predicción, resetea objetivo manual, rechaza si `status !== planned`);
  `myRaces.setManualResult` guarda el PR en la distancia efectiva correcta.
- Manual en navegador: añadir una carrera con `raceFormats` real, elegir una
  modalidad distinta a la principal, verificar predicción/PR/pace en la card del
  calendario; cambiar de modalidad después y verificar que se recalcula; filtrar
  `/carreras` por una categoría que solo cubre una modalidad secundaria de alguna
  carrera y verificar que aparece.

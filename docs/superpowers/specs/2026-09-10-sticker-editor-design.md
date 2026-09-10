# Diseño: editor de sticker personalizable (feature premium)

> Fecha: 2026-09-10. Estado: aprobado para plan de implementación.

## Contexto y problema

Hoy existen tres piezas gráficas generadas automáticamente al publicarse un resultado
(`convex/emailNotificationsAction.sendResultFoundEmail`):

- Diploma PDF A4.
- Share card PNG 1200×630 (email inline + `og:image` + descarga).
- Story sticker PNG 1080×1920, fondo transparente (`lib/share-card/story-sticker.tsx`,
  ver spec `2026-09-10-story-sticker-design.md`) — layout fijo, sin edición, pensado
  para overlay en Stories de Instagram/TikTok.

Los usuarios premium quieren más control creativo: elegir qué datos mostrar, moverlos,
elegir entre varios estilos visuales, e incluir su propia silueta de ruta GPS. Hoy no
existe ninguna forma de personalizar el sticker — solo se puede descargar el fijo.

## Alcance

Incluye:
1. **Editor visual** de sticker, en una pantalla dedicada, con lienzo 1080×1920
   (fondo transparente, checkerboard de referencia en el editor).
2. **2-3 plantillas predefinidas** (layouts/estilos de partida) reutilizando la
   paleta de `lib/share-card/render.tsx`.
3. **Campos disponibles** para mostrar/ocultar y mover: tiempo oficial, pace,
   posición general, posición categoría, badge PR, dorsal, nombre de carrera + fecha,
   nombre del corredor, distancia, y **silueta de la ruta GPS** (a partir de
   `activities.mapPolyline`).
4. **Edición por elemento**: mover (drag) y redimensionar (resize por esquina).
   Sin cambio de color/tipografía — cada plantilla ya define el estilo visual.
5. **Plantilla propia del usuario**: guardar la configuración actual (plantilla base +
   posiciones + campos activos) como su plantilla personalizada — 1 sola por usuario,
   se sobrescribe si ya existía. Aparece como opción adicional junto a las
   predefinidas, en cualquier carrera futura.
6. **Exportación PNG** 100% client-side (captura DOM→PNG), con fondo transparente.
   Al exportar, se sube el PNG a Convex Storage (sobrescribiendo el anterior de esa
   carrera) para poder redescargarlo sin volver a abrir el editor.
7. **Dos puntos de entrada**:
   - Botón "Personalizar sticker" en `/resultado/{myRaceId}` (carrera precargada).
   - Página propia (`/mi-sticker` o similar) donde el usuario elige de su historial
     de carreras (`myRaces.listMine`) qué resultado personalizar.
8. **Gate premium**: usuario free que llega a cualquiera de los dos puntos de entrada
   ve un loading state breve y es redirigido a `/premium` (mismo patrón client-side
   con `useHasPremium()` + `router.push()` que ya usa `app/admin/layout.tsx` — sin
   preview editable del editor).
9. **Responsive real**: layout de 3 columnas fijas en desktop (plantillas | lienzo |
   propiedades); en móvil, lienzo a pantalla completa con plantillas y propiedades
   como bottom sheets, arrastre por touch directo sobre el lienzo.

No incluye (fuera de alcance de esta iteración):
- Cambios al sticker automático fijo (`story-sticker.tsx`) — sigue generándose igual
  tras publicar resultado, sin relación con el editor. El editor es un camino premium
  **adicional**, no lo sustituye.
- Cambios a diploma PDF o share card 1200×630.
- Envío del sticker personalizado por email.
- Historial de versiones exportadas — solo se conserva la última por carrera.
- Múltiples plantillas propias por usuario — solo 1, se sobrescribe.
- Color picker o cambio de tipografía por elemento — solo posición y tamaño.
- Mapa de ruta con tiles/fondo real (Leaflet) — solo silueta vectorial simple (trazo
  SVG), sin contexto geográfico.
- Editor accesible sin JS / SSR — es inherentemente una herramienta interactiva
  client-side.

## Diseño de interacción (UX)

### Desktop (≥1024px)

Tres columnas fijas, todo visible sin scroll:
- **Izquierda (~140-160px):** lista de plantillas (thumbnails pequeños) — predefinidas
  primero, luego "Mi plantilla" si existe (con borde punteado si aún no se ha guardado
  ninguna, mostrando el hueco).
- **Centro:** lienzo a tamaño fijo dentro del viewport (escalado visualmente, ej.
  altura ~500-600px, manteniendo proporción 1080:1920), con fondo de checkerboard para
  visualizar la transparencia. Click en un elemento lo selecciona (outline + handles);
  arrastrar con mouse lo mueve; arrastrar la esquina inferior derecha lo redimensiona
  (manteniendo aspect ratio del elemento).
- **Derecha (~150-180px):** panel de propiedades del elemento seleccionado — toggle
  "Mostrar", slider de tamaño, y (si aplica) reordenar profundidad (traer al frente /
  enviar atrás, solo relevante si dos elementos se superponen). Si no hay elemento
  seleccionado, muestra la lista de campos no visibles con botón "+ Añadir" por cada
  uno.

Barra superior fija: nombre de la carrera (contexto), botón "Guardar como mi
plantilla", botón primario "Descargar PNG".

### Móvil (<768px)

- **Lienzo a pantalla completa** (prioridad visual), mismo checkerboard.
- Header compacto: volver, "Plantillas" (abre bottom sheet), "Descargar".
- Tocar un elemento del lienzo lo selecciona; aparece una **barra de propiedades
  pegada a la parte inferior** (por encima del teclado si hay inputs, aunque aquí no
  hay texto libre) con: mostrar/ocultar, slider de tamaño. Arrastrar es con el dedo
  directamente sobre el elemento seleccionado; resize con un handle visible en la
  esquina del elemento (target táctil ≥40px).
- Botón flotante o de header "+ Dato" abre un bottom sheet con la lista de campos no
  visibles todavía.
- "Guardar como mi plantilla" vive dentro del bottom sheet de plantillas (acción
  secundaria, no compite con "Descargar").

### Estados y feedback

- **Carga inicial:** si el usuario tiene plantilla propia guardada → se precarga esa
  (con los datos de la carrera actual). Si no → se precarga la primera plantilla
  predefinida ("Clásica").
- **Cambiar de plantilla:** resetea las posiciones a las de la nueva plantilla, pero
  conserva qué campos están activados (si el usuario ya había activado "dorsal", sigue
  activado al cambiar de plantilla, en la posición default de esa plantilla para ese
  campo).
- **Exportando:** botón "Descargar PNG" muestra estado de carga (spinner) mientras
  captura + sube; al terminar, dispara la descarga del archivo en el navegador y
  muestra confirmación breve (toast, reutilizando `components/ui/toast.tsx`).
- **Sin datos para un campo** (ej. sin `mapPolyline`, o sin PR): ese campo no aparece
  en la lista de "+ Añadir dato" — no se ofrece si no hay dato que mostrar.

## Arquitectura

### Modelo de datos

**`convex/schema.ts`** — nuevos campos:

```ts
// myRaces: PNG personalizado (sobrescribe con cada export)
customStickerStorageId: v.optional(v.id("_storage")),

// profiles: plantilla propia del usuario (1 sola)
customStickerTemplate: v.optional(v.object({
  baseTemplateId: v.string(), // "classic" | "minimal" | "bold" — de qué predefinida partió
  elements: v.array(v.object({
    fieldId: v.string(),      // "time" | "pace" | "position" | "positionCategory" |
                               // "pr" | "dorsal" | "raceNameDate" | "runnerName" |
                               // "distance" | "routeMap"
    visible: v.boolean(),
    x: v.number(),            // posición normalizada 0-1 respecto al lienzo 1080x1920
    y: v.number(),
    scale: v.number(),        // multiplicador de tamaño respecto al default del campo
  })),
})),
```

Posiciones normalizadas (0-1) en vez de píxeles absolutos: el editor siempre trabaja
sobre el lienzo lógico 1080×1920 independientemente del zoom de pantalla, y es estable
si en el futuro cambia el tamaño de lienzo.

Las plantillas predefinidas ("classic", "minimal", "bold") son **código, no datos** —
viven como constantes en `lib/sticker-editor/templates.ts` con el layout default de
cada `fieldId`. No se guardan en Convex salvo cuando el usuario las adopta como base de
su plantilla propia.

### Módulo del editor (client-side)

**`lib/sticker-editor/`** (nuevo):
- `templates.ts` — definición de las 2-3 plantillas predefinidas: por cada una, lista
  de `{ fieldId, visible, x, y, scale }` default.
- `fields.ts` — catálogo de campos disponibles: id, etiqueta, componente de render,
  tamaño default. Cada campo sabe renderizarse a partir de un objeto de datos de
  carrera común (mismo shape que ya usa `StoryStickerProps`, extendido).
- `polyline.ts` — decodificador de Google Polyline Encoding (función propia, sin
  dependencia nueva) `decodePolyline(encoded: string): [number, number][]`, y un
  normalizador `polylineToSvgPath(points, viewBoxSize)` que centra/escala la ruta a un
  `<path>` SVG cuadrado.
- `StickerCanvas.tsx` — componente del lienzo: renderiza los elementos activos sobre
  un `<div>` de 1080×1920 (escalado con CSS `transform: scale()` para el viewport,
  pero el DOM interno mantiene las dimensiones lógicas para que la captura salga a
  resolución completa). Gestiona selección, drag y resize con Pointer Events nativos
  (`onPointerDown/Move/Up`), sin librería de drag&drop.
- `usePointerDrag.ts` — hook pequeño reutilizado por drag y resize (delta de
  movimiento normalizado a coordenadas 0-1 del lienzo).

### Página del editor

**`app/editor-sticker/[myRaceId]/page.tsx` + `client.tsx`** (nuevo, mismo patrón de
gate ya usado en `app/admin/layout.tsx`: todo client component, sin `redirect()` de
servidor):
- `"use client"`. Gate premium con `useHasPremium()` (hook ya existente) — mientras
  `hasAccess` está resolviéndose (undefined/loading) se muestra un loading state;
  cuando resuelve a `false`, `useEffect` dispara `router.push("/premium")`. Mismo
  patrón exacto que el chequeo de admin en `app/admin/layout.tsx` (`useEffect` +
  `router.push`, no un `redirect()` de Next server-side).
- Carga datos de la carrera + polyline + plantilla propia con
  `useQuery(api.stickerEditor.getEditorData, {myRaceId})`, y monta `StickerCanvas` +
  paneles de plantillas/propiedades según breakpoint (Tailwind responsive).

**`app/mi-sticker/page.tsx` + `client.tsx`** (nuevo) — segundo punto de entrada:
- Mismo gate premium client-side que arriba.
- Lista las carreras completadas del usuario (reutiliza `myRaces.listMine({status:
  "done"})`, filtrando las que tienen `actualTimeSeconds`), cada una con link a
  `/editor-sticker/{myRaceId}`.

Ambas páginas siguen la convención ya usada en `/calendario`, `/perfil`, etc.: chequeo
`isMockMode()` (`lib/mock/provider.tsx`) al inicio del client component, con una vista
mock simplificada cuando está activo (sin llamadas reales a Convex).

### Queries/mutations nuevas (Convex)

**`convex/stickerEditor.ts`** (nuevo módulo):
- `getEditorData(myRaceId)` — query: requiere usuario autenticado
  (`requireUser`/`getOptionalUser`) y verifica ownership (`myRace.userId ===
  user._id`, devolviendo `null` si no — mismo patrón que `myRaces.get`, a diferencia
  de `getMyRaceForPublicPage` que es pública sin auth). Devuelve datos de la carrera +
  corredor + PR (mismo shape que `getMyRaceForPublicPage`, reutilizable) +
  `mapPolyline` de la actividad vinculada (ver resolución abajo) +
  `customStickerTemplate` del usuario actual + `customStickerStorageId` si ya existe
  uno.
- `saveCustomTemplate(template)` — mutation: valida que el usuario sea premium
  (`hasPremiumAccess`), sobrescribe `profiles.customStickerTemplate` del usuario
  actual.
- `attachCustomSticker(myRaceId, storageId)` — mutation: valida ownership (myRace
  pertenece al usuario actual) y premium; si ya había un `customStickerStorageId`
  previo, lo borra con `ctx.storage.delete()` antes de sobrescribir (a diferencia de
  diploma/share-card, que se generan una sola vez, este campo puede regenerarse
  muchas veces por el mismo usuario — sin el delete se acumulan blobs huérfanos en
  Storage).

**Resolución del mapa de ruta:** no existe vínculo directo `myRace → activity`. Se
resuelve en `getEditorData`:
```ts
const activities = await ctx.db
  .query("activities")
  .withIndex("by_matched_race", (q) => q.eq("matchedRaceId", myRace.raceId))
  .filter((q) => q.eq(q.field("userId"), myRace.userId))
  .collect();
const best = activities.sort((a, b) => b.distanceM - a.distanceM)[0];
const mapPolyline = best?.mapPolyline;
```
Si no hay actividad con polyline, el campo "Ruta" simplemente no aparece en la lista de
campos disponibles (ver "Sin datos para un campo" en UX).

### Subida del PNG exportado

Reutiliza el patrón ya existente (`lib/convexStorage.ts`):
1. Cliente exporta con `html-to-image` (`toPng(canvasRef.current, {pixelRatio: 1})`,
   ya que el DOM lógico ya está a 1080×1920) → `Blob`.
2. `convexStorageGenerateUploadUrl` + `convexStorageUpload` (helpers existentes) →
   `storageId`.
3. `attachCustomSticker({myRaceId, storageId})` mutation.
4. Cliente dispara descarga local del blob (`URL.createObjectURL` + `<a download>`),
   independiente de la subida (no bloquea la descarga si la subida tarda — se hace en
   paralelo, y si la subida falla se avisa con un toast pero la descarga local ya
   ocurrió).

### Endpoint de descarga del sticker personalizado

**`app/api/result/[myRaceId]/custom-sticker.png/route.ts`** (nuevo, mismo patrón que
`story-sticker.png/route.ts`): sirve el PNG desde `myRaces.customStickerStorageId` si
existe. Se usa para poder compartir/redescargar sin volver a abrir el editor (ej. desde
`/resultado/{myRaceId}` si en el futuro se quiere mostrar un botón "Descargar tu
sticker personalizado" ahí — no forma parte del alcance de esta iteración de UI, pero
el endpoint se deja listo porque el dato ya se persiste).

## Flujo de datos (resumen)

```
Entrada A: /resultado/{id} → botón "Personalizar sticker" → /editor-sticker/{id}
Entrada B: /mi-sticker → elige carrera → /editor-sticker/{id}

/editor-sticker/{id} (gate: useHasPremium() + router.push, si no → /premium)
  → getEditorData(id): datos carrera + polyline (best activity by distanceM) +
    plantilla propia si existe
  → StickerCanvas precargado (plantilla propia > plantilla "classic" default)
  → usuario: cambia plantilla / mueve-oculta-redimensiona elementos / añade campos
  → [opcional] "Guardar como mi plantilla" → saveCustomTemplate(template)
  → "Descargar PNG":
      → html-to-image captura el lienzo → Blob
      → descarga local inmediata (createObjectURL)
      → en paralelo: generateUploadUrl + upload + attachCustomSticker(id, storageId)
```

## Testing / verificación

- Decodificador de polyline: test unitario con una polyline real de ejemplo (fixture),
  verificando puntos decodificados conocidos.
- `getEditorData`: verificar que resuelve la actividad de mayor distancia cuando hay
  varias con el mismo `matchedRaceId`, y que devuelve `mapPolyline: undefined` si no
  hay ninguna.
- Gate premium: verificar que un usuario free termina en `/premium` en ambos puntos de
  entrada (mismo comportamiento que el gate de admin ya existente).
- Manual: probar drag/resize en desktop (mouse) y móvil real o emulado (touch),
  cambiar de plantilla conservando campos activos, guardar plantilla propia y
  verificar que se precarga en otra carrera distinta, exportar y confirmar fondo
  transparente + resolución 1080×1920 del PNG resultante.
- Confirmar que el sticker automático fijo (`story-sticker.tsx`) sigue funcionando sin
  cambios tras esta feature (no comparte código de render, solo paleta de colores).

## Alternativas descartadas

- **Reemplazar el sticker automático por el editor**: obligaría a todo usuario
  (incluso free) a pasar por un flujo interactivo para obtener su sticker de Stories,
  perdiendo la generación automática "sin fricción" que ya funciona. Se descarta a
  favor de mantener ambos caminos independientes.
- **Renderizado server-side (satori) para preview y export**: exigiría una llamada de
  red por cada movimiento/cambio del editor (latencia, coste), o duplicar el motor de
  layout en cliente y servidor. Se descarta a favor de captura DOM→PNG 100%
  client-side con `html-to-image`.
- **Librería de drag&drop (`@dnd-kit`)**: resuelve casos (colisiones, accesibilidad
  avanzada, múltiple selección) que este editor no necesita — un solo elemento
  seleccionado a la vez, sin colisiones que resolver. Se descarta a favor de Pointer
  Events nativos, más ligero.
- **Mapa con tiles reales (Leaflet, ya usado en la app para otras vistas)**: cargar
  tiles de un proveedor externo dentro de un sticker pensado para fondo transparente
  no tiene sentido visual (el mapa de fondo tapa la transparencia) y complica la
  exportación (tiles externos + CORS al capturar con `html-to-image`). Se descarta a
  favor de una silueta vectorial simple (trazo SVG del recorrido, sin contexto
  geográfico).
- **Múltiples plantillas propias por usuario**: añade complejidad de gestión (listar,
  nombrar, borrar) para un caso de uso donde la mayoría de usuarios querrá "mi único
  estilo". Se descarta en favor de 1 plantilla propia que se sobrescribe; puede
  revisarse en el futuro si hay demanda.

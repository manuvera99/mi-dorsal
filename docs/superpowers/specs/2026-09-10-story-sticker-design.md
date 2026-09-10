# Diseño: sticker PNG vertical para Stories/Reels

> Fecha: 2026-09-10. Estado: aprobado para plan de implementación.

## Contexto y problema

Hoy, cuando se publica el resultado de una carrera, `convex/emailNotificationsAction.sendResultFoundEmail`
genera dos archivos vía `lib/pdf/diploma.tsx` y `lib/share-card/render.tsx`:

- Diploma PDF A4 (imprimible).
- Share card PNG 1200×630 con fondo sólido, dorsal grande y stats — usado como
  imagen inline del email, `og:image` de la página pública `/resultado/{myRaceId}`,
  y descarga directa.

Ninguno de los dos sirve bien para Instagram/TikTok Stories: son horizontales (o A4)
y tienen fondo opaco, así que no se pueden superponer sobre una foto propia de la
carrera. El usuario que quiere compartir su resultado en Stories no tiene una pieza
pensada para ese formato.

## Alcance

Incluye:
1. Un tercer PNG generado junto a los dos existentes: **story sticker**, vertical
   1080×1920, **fondo transparente**, pensado para subirse como sticker/overlay en
   Stories sobre la foto propia del usuario.
2. Contenido reducido a lo esencial: logo mini, badge "Nuevo PR" (solo si aplica),
   tiempo oficial, pace, posición general. Nada de dorsal grande, nombre de carrera,
   fecha ni footer de dominio.
3. Bloque de tarjetas centrado verticalmente en el lienzo, dejando espacio
   transparente arriba y abajo.
4. Cada dato en un panel blanco semi-opaco con esquinas redondeadas (contraste
   garantizado sobre cualquier foto de fondo).
5. Endpoint de descarga público (`/api/result/{myRaceId}/story-sticker.png`) y botón
   nuevo en la página `/resultado/{myRaceId}`.
6. Persistencia del storage ID en `myRaces` (mismo patrón que diploma/share card).

No incluye (fuera de alcance de esta iteración):
- Cambios al share card 1200×630 existente (email inline, `og:image`) — sigue igual.
- Cambios al diploma PDF — sigue igual.
- Envío del sticker por email (el email solo lleva diploma + share card, como hoy).
- Fotos reales del usuario incrustadas en el sticker (el usuario pone su propia foto
  de fondo en Instagram/TikTok; mi-dorsal solo genera el overlay).
- Regeneración on-demand si el sticker no existe (mismo criterio que share-card.png:
  se genera una vez en el pipeline de email y se sirve desde Storage).

## Diseño visual

Lienzo 1080×1920px, fondo completamente transparente (canal alfa PNG).

Bloque de contenido centrado verticalmente (flex column, `justify-content: center`
sobre la altura total), ancho ~820px, apilado de arriba a abajo:

1. **Logo mini** — cuadrado rojo redondeado con "m" + wordmark "mi-dorsal", igual
   estilo que el header del share card actual pero solo esto, sin "Resultado oficial".
2. **Badge "Nuevo PR"** — pastilla verde (mismos tokens `C.prBg`/`C.accent`/`C.prText`
   que `render.tsx`), **solo si `isPersonalRecord`**. Si no hay PR, este elemento no
   se renderiza (no deja hueco vacío).
3. **Tarjeta tiempo oficial** — panel blanco semi-opaco (`rgba(255,255,255,0.92)`),
   esquinas redondeadas (~24px), el tiempo como texto hero en JetBrains Mono, verde
   accent, con etiqueta pequeña "TU TIEMPO OFICIAL" encima en mayúsculas.
4. **Tarjeta pace** — mismo estilo de panel, más pequeño, valor + "/km".
5. **Tarjeta posición general** — mismo estilo de panel, valor + "/ total" si hay
   `totalRunners`.

Las tarjetas 3–5 usan el mismo lenguaje visual (fondo blanco semi-opaco, radio,
padding) pero con jerarquía de tamaño: el tiempo es el elemento más grande, pace y
posición son secundarios y pueden ir en una fila de 2 columnas para no alargar el
bloque verticalmente.

Reutiliza la paleta de colores `C` ya definida en `lib/share-card/render.tsx` (no se
inventan colores nuevos).

## Arquitectura

### Nuevo módulo de render

**`lib/share-card/story-sticker.tsx`** (nuevo archivo, mismo patrón que
`lib/share-card/render.tsx`):

```ts
export interface StoryStickerProps {
  timeFormatted?: string;
  paceFormatted?: string;
  positionOverall?: number;
  totalRunners?: number;
  isPersonalRecord?: boolean;
}

export async function renderStorySticker(props: StoryStickerProps): Promise<Buffer>
```

- Usa `@vercel/og` (`ImageResponse`) igual que `render.tsx`, con `width: 1080,
  height: 1920`.
- Carga de fuentes: se extrae la función `loadFonts()`/`getFonts()` ya existente en
  `render.tsx` a un módulo compartido **`lib/share-card/fonts.ts`** para no duplicar
  la lectura de TTF. `render.tsx` y `story-sticker.tsx` importan de ahí.
- No necesita `appUrl`, `runnerName`, `raceName`, `raceDate`, `dorsalNumber`,
  `distanceLabel` — el tipo de props es deliberadamente más pequeño que
  `ShareCardProps`.

### Endpoint interno de render

**`app/api/internal/render-diploma/route.ts`** — se añade un tercer render en
paralelo:

```ts
const [pdfBuffer, pngBuffer, stickerBuffer] = await Promise.all([
  renderDiploma(diplomaProps),
  renderShareCard(body.shareCard),
  renderStorySticker(body.storySticker),
]);
```

El body de la request gana un campo `storySticker: StoryStickerProps` (requerido,
igual que `diploma`/`shareCard`). La respuesta gana `storyStickerBase64`.

### Schema

**`convex/schema.ts`** — nuevo campo opcional en `myRaces`, junto a
`shareCardStorageId`:

```ts
storyStickerStorageId: v.optional(v.id("_storage")),
```

### Pipeline de generación (Convex action)

**`convex/emailNotificationsAction.ts`**:
- `renderViaInternalApi` gana un tercer parámetro `storySticker: StoryStickerProps`
  y devuelve también `stickerBuffer: Buffer`.
- Se construye `storyStickerProps` a partir de los mismos datos ya calculados para
  `cardProps` (tiempo, pace, posición, PR) — no requiere ninguna query nueva de
  datos, solo un subconjunto de los que ya existen en esa función.
- Se sube `stickerBuffer` a Convex Storage (mismo `ctx.storage` upload que ya se usa
  para diploma/share card).
- `attachStorageIds` (mutation en `emailNotificationsHelpers.ts`) gana el argumento
  opcional `storyStickerStorageId` y lo persiste en `myRaces`.
- El sticker **no** se adjunta al email ni se referencia en la plantilla
  `resultFound.ts` — solo se genera y se guarda para descarga.

### Endpoint público de descarga

**`app/api/result/[myRaceId]/story-sticker.png/route.ts`** (nuevo archivo, mismo
patrón que `share-card.png/route.ts`):
- `GET /api/result/{myRaceId}/story-sticker.png`.
- Nueva query `getMyRaceForStorySticker` en `emailNotificationsHelpers.ts` (idéntica
  a `getMyRaceForShareCard` pero leyendo `storyStickerStorageId`).
- Mismo manejo de errores/placeholder SVG que el endpoint existente, pero con
  dimensiones de placeholder 1080×1920 en vez de 1200×630.
- Cache-Control inmutable 1 año (el sticker no cambia una vez generado, igual que el
  share card).
- `Content-Disposition: inline; filename="mi-dorsal-story-{myRaceId}.png"`.

### UI de descarga

**`app/resultado/[myRaceId]/client.tsx`**:
- Nueva constante `stickerUrl` y `hasSticker = !!myRace.storyStickerStorageId`.
- Nuevo botón "Descargar para Stories" junto a los botones "Descargar PNG" /
  "Diploma PDF" existentes, visible solo si `hasSticker`. Usa el mismo patrón
  `<a href={stickerUrl} download={...}>`.
- `getMyRaceForPublicPage` (query ya existente) gana `storyStickerStorageId` en el
  objeto `myRace` que devuelve, para poder calcular `hasSticker` en el cliente.
- No se muestra preview inline del sticker en la página (a diferencia del share
  card): al ser transparente, se vería como un bloque flotante sin contexto visual
  útil sobre el fondo blanco de la card. Solo el botón de descarga.

## Flujo de datos (resumen)

```
sendResultFoundEmail (Convex action)
  → calcula timeFormatted, paceFormatted, positionOverall, isPersonalRecord (ya existente)
  → renderViaInternalApi(diplomaProps, cardProps, stickerProps)
      → POST /api/internal/render-diploma
          → renderDiploma() + renderShareCard() + renderStorySticker()  [paralelo]
      ← { diplomaBase64, shareCardBase64, storyStickerBase64 }
  → sube 3 buffers a Convex Storage
  → attachStorageIds(myRaceId, diplomaStorageId, shareCardStorageId, storyStickerStorageId)
  → envía email (diploma adjunto + share card inline; sticker NO va en el email)

GET /resultado/{myRaceId}
  → getMyRaceForPublicPage incluye storyStickerStorageId
  → botón "Descargar para Stories" → GET /api/result/{myRaceId}/story-sticker.png
```

## Testing / verificación

- Verificación manual sirviendo `renderStorySticker` desde un script local (patrón
  similar a `scripts/example-share-card-html.ts`) para revisar el PNG con fondo
  transparente sobre un fondo de cuadros (checkerboard) antes de integrarlo al
  pipeline completo.
- Probar los tres casos de contenido: con PR, sin PR, sin `totalRunners`.
- Verificar que el endpoint público devuelve 404 con placeholder para myRaces
  legacy sin `storyStickerStorageId` (igual que hace hoy `share-card.png`).
- Confirmar en el email real que el sticker NO aparece (no se referencia en la
  plantilla ni se adjunta).

## Alternativas descartadas

- **Sustituir el share card 1200×630 por este formato**: rompería `og:image` (que
  espera ~1.91:1) y el layout del email (una imagen de 1920px de alto no cabe bien
  inline). Se descarta a favor de un tercer archivo independiente.
- **Texto con sombra/contorno sin tarjetas**: menos legible sobre fotos claras o con
  mucho detalle en el punto donde cae el texto. Se descarta a favor de paneles
  blancos semi-opacos, que garantizan contraste sobre cualquier fondo.
- **Incrustar la foto real del usuario en el sticker (server-side)**: requeriría que
  el usuario suba una foto antes de generarlo, añadiendo un paso de captura de
  imagen al pipeline de email (que hoy es 100% automático tras publicarse el
  resultado). Fuera de alcance; el enfoque de "sticker que el usuario superpone él
  mismo en la app de Stories" no requiere ese paso.

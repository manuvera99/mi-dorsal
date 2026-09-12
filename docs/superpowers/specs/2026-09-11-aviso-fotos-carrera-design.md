# Diseño: aviso al usuario cuando salen las fotos de su carrera

> Fecha: 2026-09-11.

## Contexto y problema

Tras terminar una carrera, los corredores quieren encontrar sus fotos oficiales
(foto-finish, fotógrafos del circuito). Se investigó el mercado de proveedores de
fotos de carrera (Sportograf, FinisherPix, MarathonPhotos Live, FocoRace, fotógrafos
locales como el que aparece en créditos del Maratón de Barcelona...) y **no existe
ningún proveedor centralizado con API o feed público**: cada carrera contrata a un
fotógrafo/empresa distinta, con su propia web de galería buscable por dorsal, y ese
enlace se publica días después de la carrera sin ningún aviso automático.

Se confirmó también que **sportmaniacs.com** (la fuente que mi-dorsal ya usa para
resultados vía `race.resultsUrl`/`scraperAdapter`) no tiene ninguna sección de fotos
— ni en su home ni en páginas de carrera individuales revisadas. No hay, por tanto,
ninguna fuente automática fiable de la que "descubrir" el enlace a las fotos de una
carrera concreta.

Dado esto, el diseño no intenta automatizar el descubrimiento del enlace: el admin
de mi-dorsal lo añade a mano, igual que ya hace con `resultsUrl`, y el aviso se
dispara en el momento de guardar ese campo — sin cron, sin polling, sin scraping.

## Alcance

Incluye:

1. **Campo nuevo `photosUrl` en `races`**: URL de la galería de fotos de la carrera,
   editable en `/admin/races/[id]` junto a los demás campos de URLs (`resultsUrl`,
   `officialUrl`, etc.).
2. **Envío del aviso al guardar**: cuando `adminUpdate` persiste una `photosUrl` que
   antes no existía (transición `undefined` → valor), se dispara una action que
   notifica por email a todos los usuarios con una `myRace` de esa carrera.
3. **Nuevo tipo de email `photos_available`**: plantilla React Email nueva
   (`convex/emails/templates/photosAvailable.tsx`, mismo patrón que
   `resultFound.tsx`/`reminder.tsx`), enviada con el mismo mecanismo que ya usan
   `sendResultFoundEmail`/`sendReminderEmail` (Resend directo, con modo mock si no
   hay `RESEND_API_KEY`, ver `convex/emailNotificationsAction.ts`).
4. **Idempotencia vía `notificationLog`**: se añade `v.literal("photos_available")`
   a la unión `type` de `notificationLog` (schema.ts:561-569) y a la unión gemela en
   `hasLogForMyRace`/`writeLog` (`convex/emailNotificationsHelpers.ts`). Antes de
   enviar, se comprueba `hasLogForMyRace(userId, myRaceId, "photos_available")` igual
   que hace `sendResultFoundEmail`.

No incluye (fuera de alcance de esta iteración):
- Cualquier automatismo para descubrir o comprobar el enlace (cron, scraping, HEAD
  request) — no hay fuente fiable de la que automatizarlo, según la investigación de
  mercado. Si el admin se equivoca de fecha, puede reeditar `photosUrl` (ver más abajo
  el caso límite de reenvío).
- Enlace personalizado por dorsal (deep link a la foto exacta del usuario) — se envía
  siempre la URL genérica de la galería del evento; el usuario busca su dorsal allí,
  igual que hoy hace con `resultsUrl` para resultados manuales.
- Notificación in-app (campanita) — solo email, reutilizando el pipeline existente.
  No se crea ningún componente ni tabla nueva para esto.
- Reutilizar o modificar el flujo de `result_found` (diploma/share card) — es un aviso
  independiente y mucho más simple: no genera PDF, no sube nada a Storage, solo un
  email con un botón al enlace.

## Modelo de datos

### `races` (campo nuevo)

```ts
photosUrl: v.optional(v.string()),  // URL de la galería de fotos de la carrera (pegada a mano por el admin)
```

Se añade junto a `resultsUrl` en `convex/schema.ts` (bloque "URLs clave", línea ~213),
y a la unión `patch` de `adminUpdate` en `convex/races.ts` (línea ~390) y al formulario
de `app/admin/races/[id]/page.tsx` (junto al `<input>` de `resultsUrl`, línea ~387).

### `notificationLog` (cambio)

Añadir `v.literal("photos_available")` a la unión `type` en **tres** sitios que hoy
mantienen la misma unión duplicada (confirmado en el código, no es un solo lugar):
- `convex/schema.ts` (definición de tabla, línea ~561)
- `convex/emailNotificationsHelpers.ts` → `hasLogForMyRace` (línea ~54)
- `convex/emailNotificationsHelpers.ts` → `writeLog` (línea ~94)

## Disparo del aviso

`adminUpdate` (`convex/races.ts:370`) es una `mutation`, y las mutations en Convex no
pueden llamar a Resend directamente (necesitan `fetch`/paquetes de Node → eso vive en
`internalAction`, como ya hacen `sendResultFoundEmail`/`sendReminderEmail`). Por tanto:

1. En `adminUpdate`, tras el `ctx.db.patch(...)`, si `patch.photosUrl` está presente
   y el valor de `photosUrl` **antes** del patch era `undefined`/vacío, se llama
   `ctx.scheduler.runAfter(0, internal.crons.notifyPhotosAvailable.run, { raceId })`
   (patrón `scheduler.runAfter` para disparar una action desde una mutation, ya usado
   en el repo — confirmar nombre exacto del helper existente si lo hay al implementar).
2. Si el admin ya tenía `photosUrl` puesta y solo la corrige/actualiza (no es una
   transición desde vacío), **no se reenvía** el aviso — evita reenvíos accidentales
   al retocar una URL ya publicada. Si el admin quiere forzar un reenvío real (p. ej.
   se equivocó de URL la primera vez), no hay botón dedicado en esta iteración: se
   documenta como limitación conocida, no como bug.

## Nueva action `notifyPhotosAvailable`

Nuevo archivo, ej. `convex/crons/notifyPhotosAvailable.ts` (se ubica junto a los demás
crons de notificación aunque no sea periódico, por coherencia con dónde vive el resto
de lógica de notificación por carrera):

1. Query interna: todas las `myRaces` de `raceId` (índice `by_race` ya existente en
   `myRaces`, `convex/schema.ts:507`), con su `profile` y `race`.
2. Para cada una: comprobar `hasLogForMyRace(userId, myRaceId, "photos_available")`;
   si ya existe, saltar (idempotencia — importante porque `runAfter` podría, en teoría,
   reintentarse).
3. Renderizar `photosAvailableEmail(...)` (plantilla nueva) y enviarlo con el mismo
   bloque Resend/mock que usa `sendReminderEmail` (sin PDF, sin Storage — mucho más
   simple que `sendResultFoundEmail`).
4. `writeLog` con `type: "photos_available"`.
5. Log resumen `[photos-available] N emails enviados para raceId=...`.

## Plantilla de email

`convex/emails/templates/photosAvailable.tsx`, mismo esqueleto que
`reminder.tsx`/`resultFound.tsx` (función que devuelve `{ subject, html, text }`).
Contenido: nombre de la carrera, fecha, botón "Ver mis fotos" apuntando a
`race.photosUrl`, aviso breve de que se buscan por dorsal en la web de destino.

## Errores y casos límite

- `photosUrl` vacía o solo espacios: se trata igual que hoy trata el formulario a
  `resultsUrl` vacío → `undefined`, no dispara nada.
- Carrera sin ninguna `myRace` (nadie inscrito en mi-dorsal): la query del paso 1
  devuelve lista vacía, no se envía ningún email, se loguea `0 emails enviados`.
- Usuario añade su `myRace` a una carrera **después** de que el admin ya puso
  `photosUrl`: no recibe el aviso retroactivo (el trigger es la transición al guardar,
  no un estado consultable). Se documenta como limitación conocida — igual de aceptable
  que en el resto de flujos de notificación de mi-dorsal, que tampoco hacen backfill.
- Un usuario con `status: "dns"` también recibe el aviso si tiene una `myRace` de esa
  carrera — no se filtra por estado, igual que el criterio ya usado para
  `result_found` (el corredor pudo participar igualmente y solo desactualizó su
  estado).

## Testing

- Test de `adminUpdate`: guardar `photosUrl` por primera vez dispara el scheduler;
  volver a guardar (ya tenía valor) no lo dispara.
- Test de `notifyPhotosAvailable`: itera todas las `myRaces` de la carrera, respeta
  idempotencia de `hasLogForMyRace`, no falla si no hay ninguna `myRace`.
- Test manual en dev: poner `photosUrl` a una carrera de prueba con al menos una
  `myRace`, guardar desde `/admin/races/[id]`, verificar log del email (modo mock si
  no hay `RESEND_API_KEY`) y la fila nueva en `notificationLog`.

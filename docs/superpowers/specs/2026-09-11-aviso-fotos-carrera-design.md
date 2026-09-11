# Diseño: aviso al usuario cuando salen las fotos de su carrera

> Fecha: 2026-09-11. Estado: aprobado para plan de implementación.

## Contexto y problema

Tras terminar una carrera, los corredores quieren encontrar sus fotos oficiales
(foto-finish, fotógrafos del circuito). Estas fotos las publican proveedores externos
(Sportograf, MarathonFoto, Deporfoto, etc.) en galerías web buscables por dorsal, casi
siempre **días** después de la carrera, sin aviso ni API pública. Hoy mi-dorsal no
tiene forma de avisar a un usuario de que sus fotos ya están disponibles ni de
dirigirle a la galería correcta.

mi-dorsal ya resuelve un problema estructuralmente idéntico para los **resultados**
oficiales: `convex/crons/checkResults.ts` vigila periódicamente una URL por carrera
(`race.resultsUrl` + `race.scraperAdapter`) hasta detectar el dato, y notifica por
email vía `dispatchAndLog` con idempotencia en `notificationLog`. Este diseño reutiliza
ese mismo patrón para fotos, pero con una señal de detección mucho más simple (no hay
que scrapear ni parsear nada, solo comprobar que la URL responde).

## Alcance

Incluye:

1. **Campos nuevos en `races`** para saber dónde vigilar y qué enlazar:
   `photosProvider` (proveedor conocido o `manual`), `photosUrl` (URL final, resuelta
   o puesta a mano), `photosCheckStatus` (`pending`/`available`/`gave_up`),
   `photosCheckedAt`, `photosAvailableAt`.
2. **Resolución de URL por plantilla**: para proveedores conocidos (Sportograf,
   MarathonFoto, Deporfoto), un mapa de plantillas construye `photosUrl` a partir del
   slug/identificador del evento. Si el admin pega una URL manual, esa URL tiene
   siempre prioridad sobre la plantilla.
3. **Cron diario `check-photos`** (`convex/crons/checkPhotos.ts`): para cada carrera
   ya finalizada (con `photosUrl` definida y `photosCheckStatus` en `pending`), hace
   una petición HTTP a `photosUrl`. Si responde `200 OK`, marca la carrera como
   `available` y dispara la notificación a **todos** los usuarios con una `myRace` de
   esa carrera. Si pasan 30 días sin `200 OK`, marca `gave_up` y deja de comprobar.
   El chequeo es **por carrera**, no por usuario — una sola petición HTTP notifica a
   todos los corredores de esa carrera a la vez.
4. **Notificación por email**: nuevo tipo `photos_available` en `notificationLog`,
   enviado vía `dispatchAndLog` (mismo pipeline que el resto de emails
   transaccionales), con plantilla React Email nueva, idempotente por
   `(userId, type, relatedMyRaceId)` igual que `result_found`.
5. **Notificación in-app**: se reutiliza `notificationLog` como fuente de una
   campanita de notificaciones — se añade el campo `readAt` a la tabla. La campanita
   lista las filas sin `readAt` del usuario logueado (índice `by_user_type` ya
   existente) y permite marcarlas como leídas.
6. **Alta manual del proveedor/URL**: se añaden `photosProvider` y `photosUrl` como
   campos editables en el formulario ya existente de `/admin/races/[id]`, junto a los
   campos equivalentes de resultados (`resultsUrl`/`scraperAdapter`). No hay flujo de
   alta nuevo — se reutiliza el panel admin actual.

No incluye (fuera de alcance de esta iteración):
- Scraping o parsing del contenido de la galería de fotos — solo se comprueba que la
  URL responde `200 OK`, nunca se busca el dorsal del usuario en el HTML.
- Enlace personalizado por dorsal (deep link a la foto exacta del usuario) — se envía
  siempre la URL genérica de la galería del evento; el usuario busca su dorsal allí.
- Detección automática del proveedor de fotos de una carrera — el admin lo indica a
  mano en `/admin/races/[id]`, igual que ya hace con el proveedor de resultados.
- Reintentos con backoff distinto por proveedor — todos comparten la misma cadencia
  diaria y ventana de 30 días.
- Cambios al sistema de emails de resultados (`result_found`) o a los stickers/diploma
  — es una notificación independiente, sin relación con esos flujos.

## Modelo de datos

### `races` (campos nuevos)

```ts
photosProvider: v.optional(v.union(
  v.literal("sportograf"),
  v.literal("marathon_photos"),
  v.literal("deporfoto"),
  v.literal("manual"),        // URL puesta a mano, sin plantilla de proveedor
)),
photosUrl: v.optional(v.string()),         // URL final: resuelta por plantilla o manual
photosCheckStatus: v.optional(v.union(
  v.literal("pending"),
  v.literal("available"),
  v.literal("gave_up"),
)),
photosCheckedAt: v.optional(v.number()),   // timestamp del último intento HTTP
photosAvailableAt: v.optional(v.number()), // timestamp en que se detectó disponible
```

Mismo patrón que los campos de resultados (`resultsUrl`/`scraperAdapter`) ya presentes
en la tabla — opcionales, sin índice propio (el cron filtra sobre `by_published_date`
o similar, ver sección Cron).

### `notificationLog` (cambios)

- Añadir `v.literal("photos_available")` a la unión `type`.
- Añadir `readAt: v.optional(v.number())` — usado solo para la campanita in-app; no
  afecta a la idempotencia de envío de email, que sigue basándose en la existencia de
  la fila (igual que hoy).

## Resolución de la URL

Nuevo helper `lib/photos/resolve-url.ts`, mismo espíritu que la resolución de adapter
en `convex/scraper.ts`:

- Si `race.photosProvider === "manual"` o el admin ya guardó `photosUrl` a mano →
  esa URL se usa tal cual, sin tocar.
- Si `race.photosProvider` es un proveedor conocido y no hay `photosUrl` aún → se
  construye desde una plantilla (`PROVIDER_TEMPLATES[provider]`) usando el
  identificador de evento correspondiente (a definir por proveedor durante la
  implementación, ej. slug o UUID según cómo estructure sus URLs cada uno).
- La URL resuelta se persiste en `race.photosUrl` la primera vez, para no
  recalcularla en cada tick del cron.

## Cron `check-photos`

Nuevo archivo `convex/crons/checkPhotos.ts`, registrado en `convex/cronJobs.ts`,
1 vez al día (franja sin solapar con otros crons diarios, ej. 10:30 UTC).

Flujo:

1. Query interna: carreras con `startDate` en el pasado, `photosUrl` definida, y
   `photosCheckStatus` en `"pending"` (o `undefined`), agrupando por `raceId` — **una
   petición HTTP por carrera**, no por usuario, a diferencia de `check-results` que
   sí itera por `myRace` porque cada dorsal necesita su propia búsqueda.
2. Para cada carrera: petición `HEAD` (fallback a `GET` si el proveedor no soporta
   `HEAD`) a `photosUrl`.
   - `200 OK` → `photosCheckStatus: "available"`, `photosAvailableAt: Date.now()`.
     Se listan todas las `myRaces` de esa carrera y se envía la notificación
     (email + fila `notificationLog`) a cada usuario, con idempotencia por
     `(userId, "photos_available", myRaceId)`.
   - Cualquier otro status / error de red → se actualiza solo `photosCheckedAt`, sigue
     `pending`.
   - Si han pasado ≥30 días desde `startDate` sin haber obtenido `200 OK` →
     `photosCheckStatus: "gave_up"` (no se vuelve a comprobar; consistente con el
     patrón de `result-not-found`, que también se rinde tras una ventana fija).
3. Log de resumen al final (nº disponibles nuevas, nº comprobadas, nº abandonadas) —
   mismo estilo que el resto de crons (`console.log` con prefijo `[check-photos]`).

## Notificación

### Email

Nueva plantilla React Email (`convex/emails/`) para `photos_available`: nombre de la
carrera, fecha, imagen del cartel si existe (`race.imageUrl`), botón "Ver mis fotos"
enlazando a `race.photosUrl`. Enviado a través de `dispatchAndLog` en
`emailDispatch.ts` — no se añade ningún envío de Resend fuera de ese archivo.

### In-app (campanita)

Componente nuevo simple (dropdown en el header, reutilizando `components/ui`) que:
- Lee vía `useQuery` las filas de `notificationLog` del usuario logueado con
  `readAt === undefined` (índice `by_user_type` o `by_user`, a decidir en el plan
  según cardinalidad esperada).
- Muestra un badge con el recuento de no leídas.
- Al abrir el dropdown o pulsar una notificación, `patch(readAt: Date.now())`.
- Reutilizable para futuros tipos de notificación in-app además de `photos_available`
  (el mecanismo no es específico de fotos, pero esta iteración solo lo alimenta con
  ese tipo).

## Alta del proveedor/URL (admin)

Se añaden `photosProvider` (select) y `photosUrl` (texto, opcional, override manual) al
formulario existente de `/admin/races/[id]`, en la misma sección donde ya se edita
`resultsUrl`/`scraperAdapter`. Sin flujo de alta nuevo ni pantalla nueva.

## Errores y casos límite

- Carrera sin `photosProvider` ni `photosUrl`: el cron la ignora (igual que
  `check-results` ignora carreras sin `resultsUrl`) — no se genera warning por tick,
  solo se cuenta como "sin URL" en el log de resumen.
- Proveedor caído temporalmente (error de red, timeout): no se penaliza, se reintenta
  al día siguiente; solo cuenta para la ventana de 30 días.
- Usuario añade su `myRace` a una carrera **después** de que ya se marcó `available`:
  no está cubierto por esta iteración (el cron ya no la revisita); se documenta como
  limitación conocida, no como bug.
- Un usuario con `status: "dns"` (no se presentó) también recibe el aviso si tiene una
  `myRace` de esa carrera — no se filtra por estado, ya que el corredor pudo participar
  igualmente y solo desactualizó su estado.

## Testing

- Test del helper de resolución de URL: plantilla por proveedor conocido, prioridad de
  URL manual, proveedor desconocido sin plantilla.
- Test del cron: agrupación por carrera (no por myRace), transición `pending` →
  `available` en `200 OK`, transición a `gave_up` tras 30 días, idempotencia del envío
  (no reenvía si ya hay fila en `notificationLog`).
- Test manual en dev: forzar `photosCheckStatus: "pending"` en una carrera con
  `photosUrl` apuntando a una URL de prueba, ejecutar el cron manualmente, verificar
  email (modo mock si no hay `RESEND_API_KEY`) y aparición en la campanita.

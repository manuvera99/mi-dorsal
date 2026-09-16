# Indicador visual: "esta carrera tiene fotos buscables por IA"

## Contexto

"Encuentra tus fotos" permite buscar por selfie en el álbum de una
carrera, pero solo funciona de verdad si `race.photosUrl` es de un
proveedor con adapter real (Flickr, ChipLevante, Grupo Brotons, Lumepic —
ver `docs/optional/photo-sources.md`). Hoy el usuario no tiene ninguna
pista de esto hasta que entra en `/perfil/fotos/[raceId]` y lo intenta.

Objetivo: mostrar un indicador visual en las tarjetas de carrera
(`RaceCard`) y en la página de detalle (`/carreras/[slug]`) cuando la
carrera SÍ tiene un álbum de un proveedor soportado — para que el usuario
sepa de antemano, sin tener que navegar hasta el formulario, si puede
buscarse a sí mismo por IA en esa carrera.

## Alcance de esta iteración

- Se enciende **solo** si `race.photosUrl` es de un proveedor en
  `SUPPORTED_ALBUM_DOMAINS` (flickr.com, chiplevante.com,
  grupobrotons.com, lumepic.com) — no si `photosUrl` existe pero es de un
  proveedor no soportado (Facebook, Google Photos, Google Drive) ni si
  está vacío.
- **Mismo indicador para fuentes gratuitas y de pago** (hoy solo Lumepic
  es de pago) — la distinción "de pago" ya se ve más adelante, dentro del
  propio resultado de búsqueda (badge "De pago" existente en
  `photo-search-results.tsx`), no hace falta duplicarla aquí.
- Aparece en dos sitios: la tarjeta (`RaceCard`, y por tanto en los 4
  listados que la usan: home, `/carreras`, carrusel, `/ranking`) y la
  página de detalle `/carreras/[slug]`.
- No se toca ninguna query de Convex — confirmado que `race.photosUrl` ya
  llega completo a `RaceCard` en los 4 sitios de uso sin proyección de
  campos.

## 1. Lógica compartida: `lib/photo-source-support.ts`

Este archivo ya existe (hoy solo tiene `detectUnsearchablePhotoProvider`
para el caso inverso: qué proveedores NO se pueden buscar). Se añade:

```ts
export const SUPPORTED_ALBUM_DOMAINS = [
  "flickr.com",
  "chiplevante.com",
  "grupobrotons.com",
  "lumepic.com",
];

/** true si `url` es de un proveedor con adapter real (ver
 *  findmyrace/sources/) — el mismo criterio que usa
 *  convex/photoSearch.ts::create para aceptar o rechazar un álbum. Usado
 *  por RaceCard y el detalle de carrera para decidir si mostrar el
 *  indicador "puedes buscar tus fotos por IA aquí". */
export function isSearchablePhotoUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return SUPPORTED_ALBUM_DOMAINS.some((d) => url.includes(d));
}
```

`convex/photoSearch.ts::create` deja de tener su propia copia local de
`SUPPORTED_ALBUM_DOMAINS` — importa la constante desde
`lib/photo-source-support.ts`. Una sola fuente de verdad: añadir un
proveedor nuevo en el futuro (como pasó con Lumepic) ya no exige
recordar actualizar dos sitios.

**Nota de plataforma**: `convex/photoSearch.ts` corre en el runtime de
Convex (no Node "use node"), y `lib/photo-source-support.ts` es un módulo
puro sin dependencias de Next/browser — importable desde ambos lados sin
problema, mismo patrón que ya usa `lib/utils.ts` en otros archivos de
Convex.

## 2. `RaceCard` (`components/race-card.tsx`)

Se importa `Camera` de `lucide-react` (ya se usa en otros archivos de la
app para "fotos") y `isSearchablePhotoUrl`. Dentro del componente:

```tsx
const showsPhotoSearchBadge = isSearchablePhotoUrl(race.photosUrl);
```

Se renderiza como una píldora blanca translúcida en la esquina superior
izquierda — mismo tratamiento visual que el badge de votos ya existente
en la esquina superior derecha (`bg-white/80 backdrop-blur-sm
rounded-full border border-gray-100`), con el icono en verde
(`text-runner-accent`):

```tsx
{showsPhotoSearchBadge && (
  <div
    className="absolute top-3 left-3 flex items-center gap-1 text-xs font-medium text-runner-accent bg-white/80 backdrop-blur-sm rounded-full p-1.5 border border-gray-100"
    title="Puedes buscar tus fotos por IA en esta carrera"
  >
    <Camera className="h-3 w-3" />
  </div>
)}
```

No requiere cambios en ninguno de los 4 callers de `RaceCard`
(`components/home/featured-races.tsx`, `app/carreras/client.tsx`,
`components/carreras/race-carousel.tsx`, `app/ranking/page.tsx`) — todos
ya pasan el documento `race` completo, confirmado por investigación
directa de cada query (`api.races.getFeatured`, `api.races.list`,
`api.ratings.topRaces` — ninguna proyecta campos, todas devuelven el
documento completo o un spread `{...race, ...}`).

## 3. Página de detalle (`app/carreras/[slug]/client.tsx`)

Dentro de `RaceDetailContent`, junto a los demás enlaces de la carrera
(`officialUrl`/`registrationUrl`/`resultsUrl`), se añade:

```tsx
{isSearchablePhotoUrl(race.photosUrl) && (
  <Link
    href={`/perfil/fotos/${race._id}`}
    className="inline-flex items-center gap-1.5 text-sm text-runner-accent hover:underline"
  >
    <Camera className="h-3.5 w-3.5" />
    Busca tus fotos con IA en esta carrera
  </Link>
)}
```

- `Camera` ya está importado en este archivo (usado para las etiquetas de
  servicio `photoService`/`videoService`) — no añade un import nuevo.
- El enlace usa `race._id` directamente. Confirmado:
  `app/perfil/fotos/[raceId]/page.tsx` acepta el id de `races` tal cual
  (no requiere resolver primero un `myRaces._id`) — la propia página
  (`PhotoSearchDetailClient` → `getRaceContext`) ya gestiona sesión no
  iniciada y gate de Premium (redirección a `/premium`), así que no se
  duplica esa lógica en el detalle.

## Testing

- Test unitario para `isSearchablePhotoUrl` en el mismo patrón que ya
  cubre `detectUnsearchablePhotoProvider` (si existe un archivo de test
  para `photo-source-support.ts`; si no existe, no es bloqueante crear
  uno nuevo solo para esta función, dado que es una función pura trivial
  de un `.some(includes)`).
- `npx tsc --noEmit` + `npm run build`.
- Prueba visual manual: una carrera real con `photosUrl` de Flickr/
  ChipLevante/GrupoBrotons/Lumepic debe mostrar el icono en su tarjeta en
  `/carreras`, home y `/ranking`, y el enlace en su página de detalle. Una
  carrera sin `photosUrl` o con uno de un proveedor no soportado
  (Facebook, Drive) no debe mostrar nada nuevo.

## Fuera de alcance (explícitamente no se hace en esta iteración)

- No se distingue visualmente pago vs. gratuito en el propio icono.
- No se toca `/calendario` (usa timeline, no `RaceCard`).
- No se autocompleta `photosUrl` desde ningún adapter — esto ya se
  investigó como pendiente en `docs/optional/photo-sources.md` §7.3 y es
  un trabajo independiente.

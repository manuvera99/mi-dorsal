# Indicador "fotos buscables por IA" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar un icono en `RaceCard` y un enlace en el detalle de carrera cuando `race.photosUrl` es de un proveedor con adapter real de "Encuentra tus fotos" (Flickr, ChipLevante, Grupo Brotons, Lumepic).

**Architecture:** Una función pura compartida (`isSearchablePhotoUrl`) en `lib/photo-source-support.ts` decide si el icono se muestra — la usan tanto `RaceCard` (cliente) como `convex/photoSearch.ts` (que hoy tiene su propia copia de la lista de dominios soportados y pasa a importarla de ahí). `RaceCard` no cambia su interfaz de props — deriva el estado del `race` que ya recibe.

**Tech Stack:** Next.js 15 (App Router, TS), Convex, lucide-react, Vitest/Jest (el que use el repo para `lib/`).

---

## Task 0: Confirmar el test runner de `lib/`

**Files:**
- Lectura: `package.json`
- Lectura: cualquier test existente de `lib/*.ts` (buscar con glob `lib/**/*.test.ts` o `lib/**/__tests__/*`)

- [ ] **Step 1: Buscar cómo se testean módulos de `lib/` hoy**

Run: `grep -n "\"test\"\|vitest\|jest" package.json`

Y: `find lib -iname "*.test.ts" -o -iname "*.spec.ts" 2>/dev/null | head -5` (si no hay ninguno, `lib/` no tiene tests unitarios hoy — anotarlo y en la Task 2 el test se escribe igual, siguiendo el mismo runner que use el resto del repo, o se omite si el repo no tiene infraestructura de test unitario de TS fuera de Convex/Python).

Expected: confirmar el comando de test (`npm test`, `npx vitest run`, etc.) y si existe ya un archivo hermano a modificar/imitar. Si no hay ningún test de `lib/` en todo el repo, saltar Task 2's parte de test y solo hacer verificación manual vía `tsc`.

---

## Task 1: Función compartida `isSearchablePhotoUrl`

**Files:**
- Modify: `lib/photo-source-support.ts`

- [ ] **Step 1: Añadir la constante y la función al final del archivo**

Abrir `lib/photo-source-support.ts` (63 líneas hoy, termina con
`unsearchableProviderLabel`). Añadir al final:

```ts
// -----------------------------------------------------------------------------
// Proveedores SOPORTADOS (lo contrario de UNSEARCHABLE_DOMAIN_PATTERNS de
// arriba): dominios con adapter real en findmyrace/sources/ — misma lista
// que usa convex/photoSearch.ts::create para aceptar o rechazar un álbum.
// Se define aquí (no solo en photoSearch.ts) para que también la pueda usar
// código de cliente (RaceCard) sin duplicar la lista.
// -----------------------------------------------------------------------------

export const SUPPORTED_ALBUM_DOMAINS = [
  "flickr.com",
  "chiplevante.com",
  "grupobrotons.com",
  "lumepic.com",
];

/** true si `url` es de un proveedor con adapter real (Flickr, ChipLevante,
 *  Grupo Brotons, Lumepic) — el mismo criterio que usa
 *  convex/photoSearch.ts::create para aceptar o rechazar un álbum de
 *  "Encuentra tus fotos". Usado por RaceCard y el detalle de carrera para
 *  decidir si mostrar el indicador "puedes buscar tus fotos por IA aquí". */
export function isSearchablePhotoUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return SUPPORTED_ALBUM_DOMAINS.some((d) => url.includes(d));
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos.

- [ ] **Step 3 (solo si Task 0 confirmó que hay infraestructura de test unitario para `lib/`): escribir el test**

Crear (o añadir a un archivo existente si Task 0 encontró uno para este mismo módulo) `lib/photo-source-support.test.ts`:

```ts
import { describe, it, expect } from "vitest"; // ajustar import al runner real confirmado en Task 0
import { isSearchablePhotoUrl } from "./photo-source-support";

describe("isSearchablePhotoUrl", () => {
  it("returns true for each supported domain", () => {
    expect(isSearchablePhotoUrl("https://www.flickr.com/photos/x/albums/1/")).toBe(true);
    expect(isSearchablePhotoUrl("https://chiplevante.com/es/prueba/x")).toBe(true);
    expect(isSearchablePhotoUrl("https://grupobrotons.com/fotografias/nggallery/album/x")).toBe(true);
    expect(isSearchablePhotoUrl("https://www.lumepic.com/es/album/x")).toBe(true);
  });

  it("returns false for an unsupported provider", () => {
    expect(isSearchablePhotoUrl("https://www.facebook.com/events/123/photos")).toBe(false);
  });

  it("returns false for null, undefined, or empty string", () => {
    expect(isSearchablePhotoUrl(null)).toBe(false);
    expect(isSearchablePhotoUrl(undefined)).toBe(false);
    expect(isSearchablePhotoUrl("")).toBe(false);
  });
});
```

- [ ] **Step 4 (solo si Step 3 se ejecutó): correr el test**

Run: `npx vitest run lib/photo-source-support.test.ts` (ajustar al comando real confirmado en Task 0)
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/photo-source-support.ts lib/photo-source-support.test.ts
git commit -m "feat(photo-search): añadir isSearchablePhotoUrl compartida cliente/backend"
```

(Si no se creó el archivo de test en Step 3, omitir `lib/photo-source-support.test.ts` del `git add`.)

---

## Task 2: `convex/photoSearch.ts` usa la constante compartida

**Files:**
- Modify: `convex/photoSearch.ts:1-30` (imports), `convex/photoSearch.ts:103-126` (mutation `create`)

- [ ] **Step 1: Añadir el import**

En la cabecera de imports de `convex/photoSearch.ts` (junto a los demás imports de `lib/`, o si no hay ninguno hoy, después de la línea 22 `import { Doc, Id } from "./_generated/dataModel";`):

```ts
import { SUPPORTED_ALBUM_DOMAINS } from "../lib/photo-source-support";
```

- [ ] **Step 2: Quitar la constante local, dejar solo el uso**

Localizar en `convex/photoSearch.ts` (alrededor de la línea 116-121):

```ts
    const SUPPORTED_ALBUM_DOMAINS = [
      "flickr.com",
      "chiplevante.com",
      "grupobrotons.com",
      "lumepic.com",
    ];
```

Borrar ese bloque completo (la constante ahora viene del import de Step 1). El `if` que la usa justo debajo (línea 122) queda sin cambios — sigue leyendo `SUPPORTED_ALBUM_DOMAINS`, ahora resuelto por el import en vez de una constante local.

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.

- [ ] **Step 4: Regenerar bindings de Convex y verificar**

Run: `npx convex codegen`
Expected: termina sin errores (el propio comando corre `tsc` al final).

- [ ] **Step 5: Correr los tests de Convex existentes de este archivo (si existen)**

Run: `grep -rl "photoSearch" convex/*.test.ts 2>/dev/null` para localizar el archivo de test, si existe.
Si existe, correrlo: `npx vitest run <archivo encontrado>` (ajustar comando real).
Expected: PASS sin cambios de comportamiento — este paso es un refactor puro (mismos valores, distinta fuente).

- [ ] **Step 6: Commit**

```bash
git add convex/photoSearch.ts
git commit -m "refactor(photo-search): usar SUPPORTED_ALBUM_DOMAINS compartida en photoSearch.create"
```

---

## Task 3: Icono en `RaceCard`

**Files:**
- Modify: `components/race-card.tsx`

- [ ] **Step 1: Añadir los imports**

En `components/race-card.tsx`, línea 1-4 hoy:

```tsx
import Link from "next/link";
import { MapPin, Calendar, Mountain, ThumbsUp, Navigation } from "lucide-react";
import { formatDate, formatProvince, formatRaceType } from "@/lib/utils";
import { formatDistance } from "@/lib/geo/distance";
```

Cambiar a:

```tsx
import Link from "next/link";
import { MapPin, Calendar, Mountain, ThumbsUp, Navigation, Camera } from "lucide-react";
import { formatDate, formatProvince, formatRaceType } from "@/lib/utils";
import { formatDistance } from "@/lib/geo/distance";
import { isSearchablePhotoUrl } from "@/lib/photo-source-support";
```

- [ ] **Step 2: Derivar el flag dentro del componente**

Dentro de `export function RaceCard({...}: RaceCardProps) {`, justo después de la línea `const hasVotes = voteUps + voteDowns > 0;` (línea 26), añadir:

```tsx
  const showsPhotoSearchBadge = isSearchablePhotoUrl(race.photosUrl);
```

- [ ] **Step 3: Renderizar la píldora**

Justo después del bloque `{/* Indicador de votos en la esquina */}` (líneas 32-38, termina en `)}`), añadir un bloque hermano:

```tsx
      {/* Indicador: esta carrera tiene fotos buscables por IA */}
      {showsPhotoSearchBadge && (
        <div
          className="absolute top-3 left-3 flex items-center gap-1 text-xs font-medium text-runner-accent bg-white/80 backdrop-blur-sm rounded-full p-1.5 border border-gray-100"
          title="Puedes buscar tus fotos por IA en esta carrera"
        >
          <Camera className="h-3 w-3" />
        </div>
      )}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.

- [ ] **Step 5: Verificación visual manual**

Run: `npm run dev`
Abrir `/carreras` en el navegador. Confirmar:
- Una carrera cuyo `photosUrl` sea de flickr.com/chiplevante.com/grupobrotons.com/lumepic.com muestra el icono de cámara en la esquina superior izquierda.
- Una carrera sin `photosUrl`, o con uno de un proveedor no soportado (ej. un enlace de facebook.com si existe alguna en el catálogo de desarrollo), NO muestra el icono.
- Si una carrera tiene tanto votos como el badge nuevo, ambos coexisten sin solaparse (esquina derecha vs. izquierda).

Si no hay ninguna carrera con `photosUrl` soportado en los datos de desarrollo, editar temporalmente una carrera de prueba desde `/admin/races/[id]` poniéndole un `photosUrl` de `https://www.flickr.com/photos/test/albums/1/` solo para esta verificación, y revertirlo después.

- [ ] **Step 6: Commit**

```bash
git add components/race-card.tsx
git commit -m "feat(race-card): mostrar icono cuando la carrera tiene fotos buscables por IA"
```

---

## Task 4: Enlace en el detalle de carrera (`/carreras/[slug]`)

**Files:**
- Modify: `app/carreras/[slug]/client.tsx`

- [ ] **Step 1: Añadir el import**

En `app/carreras/[slug]/client.tsx`, la línea de import de `lucide-react` (línea 18-24) ya incluye `Camera` — no requiere cambio ahí. Añadir el nuevo import justo después del bloque de imports existente (después de la línea 24, antes de `function MockRaceDetail`):

```tsx
import { isSearchablePhotoUrl } from "@/lib/photo-source-support";
```

- [ ] **Step 2: Localizar dónde viven los demás enlaces de la carrera**

Buscar dentro de `RaceDetailContent` (función que recibe `{ race, summary }`) el bloque donde se renderizan `officialUrl`/`registrationUrl`/`resultsUrl` como enlaces — es el punto de inserción natural para el nuevo enlace. Confirmar la ubicación exacta con:

Run: `grep -n "officialUrl\|registrationUrl\|resultsUrl" "app/carreras/[slug]/client.tsx"`

- [ ] **Step 3: Añadir el enlace**

Inmediatamente después del último de esos enlaces existentes (mismo nivel de anidación, dentro del mismo contenedor flex/grid de enlaces), añadir:

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

(Ajustar la indentación exacta al bloque circundante real una vez localizado en Step 2 — el nivel mostrado aquí es orientativo.)

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.

- [ ] **Step 5: Verificación visual manual**

Run: `npm run dev` (si no sigue corriendo de la Task 3)
Abrir `/carreras/[slug]` de una carrera con `photosUrl` soportado (la misma de prueba usada en Task 3, Step 5, si aplica). Confirmar:
- El enlace "Busca tus fotos con IA en esta carrera" aparece.
- Al hacer clic, navega a `/perfil/fotos/<raceId>` (verificar en la URL del navegador que el id coincide con `race._id` de esa carrera).
- Si el usuario no está logueado o no tiene Premium, comprobar que `/perfil/fotos/[raceId]` sigue gestionando ese caso como ya hacía antes de este cambio (redirección a `/premium` o pantalla de login) — este plan no modifica esa lógica, solo confirma que no se rompió.
- Abrir el detalle de una carrera SIN `photosUrl` soportado y confirmar que el enlace no aparece.

- [ ] **Step 6: Commit**

```bash
git add "app/carreras/[slug]/client.tsx"
git commit -m "feat(carreras): enlazar a Encuentra tus fotos desde el detalle cuando hay álbum buscable"
```

---

## Task 5: Verificación final y build completo

**Files:** ninguno nuevo — solo comandos de verificación sobre todo lo tocado en Tasks 1-4.

- [ ] **Step 1: Typecheck completo**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 0 errores.

- [ ] **Step 2: Build de producción**

Run: `npm run build`
Expected: build completo sin errores ni warnings nuevos relacionados con los archivos tocados.

- [ ] **Step 3: Revisar el diff completo antes de considerar la feature terminada**

Run: `git log --oneline -5` y `git diff HEAD~5 --stat` (ajustar el rango al número real de commits de este plan)
Expected: solo los archivos de Tasks 1-4 (`lib/photo-source-support.ts`, `convex/photoSearch.ts`, `components/race-card.tsx`, `app/carreras/[slug]/client.tsx`, y el test de Task 1 si se creó) — ningún archivo no relacionado incluido.

- [ ] **Step 4: Actualizar el doc de fuentes de fotos (opcional, no bloqueante)**

Si se quiere dejar constancia de este indicador en `docs/optional/photo-sources.md`, añadir una línea breve en la sección de UI (§7) mencionando que ahora existe un indicador visual en `RaceCard`/detalle — no forma parte del contrato de esta feature, es solo trazabilidad para el propio doc de investigación. Omitir si no se considera necesario.

No hay Step 5 de commit aquí — Task 5 es solo verificación; si el Step 4 se ejecuta, commitear ese cambio de doc por separado con:

```bash
git add docs/optional/photo-sources.md
git commit -m "docs(photo-search): anotar el indicador visual de RaceCard en el doc de fuentes"
```

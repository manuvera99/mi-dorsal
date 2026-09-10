# Editor de sticker personalizable — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a los usuarios premium una pantalla de edición donde eligen plantilla, mueven/ocultan/redimensionan campos (tiempo, pace, posición, dorsal, ruta GPS...) sobre un lienzo 1080×1920 y exportan un PNG transparente client-side, con opción de guardar su propia plantilla reutilizable.

**Architecture:** Módulo de lógica pura (`lib/sticker-editor/`) con plantillas, catálogo de campos y decodificador de polyline — sin dependencias de React ni Convex, testeable con scripts standalone. Encima, un `StickerCanvas` client-side con Pointer Events para drag/resize, y `html-to-image` para exportar. Persistencia vía Convex: `myRaces.customStickerStorageId` (PNG, sobrescribible) y `profiles.customStickerTemplate` (1 plantilla propia). Dos páginas Next.js (`/editor-sticker/[myRaceId]`, `/mi-sticker`) con gate premium client-side (mismo patrón que `app/admin/layout.tsx`).

**Tech Stack:** Next.js 15 App Router (client components), Convex, `html-to-image` (nuevo), Pointer Events nativos (sin librería drag&drop), TypeScript, Tailwind. Ver spec: `docs/superpowers/specs/2026-09-10-sticker-editor-design.md`.

---

## Fase 1 — Schema y lógica pura (sin UI)

### Task 1: Añadir campos nuevos al schema de Convex

**Files:**
- Modify: `convex/schema.ts:437-491` (tabla `myRaces`)
- Modify: `convex/schema.ts:14-95` (tabla `profiles`)

- [ ] **Step 1: Añadir `customStickerStorageId` a `myRaces`**

En `convex/schema.ts`, dentro de la definición de `myRaces` (línea ~483, justo después de `storyStickerStorageId`), añade:

```ts
    // Story sticker PERSONALIZADO (editor premium). PNG exportado
    // client-side desde /editor-sticker/{myRaceId}. Se sobrescribe con
    // cada nueva exportación (attachCustomSticker borra el blob anterior).
    // Independiente de storyStickerStorageId (el fijo automático).
    customStickerStorageId: v.optional(v.id("_storage")),
```

- [ ] **Step 2: Añadir `customStickerTemplate` a `profiles`**

En la definición de `profiles` (después del campo `garminUserId` y sus vecinos, línea ~83, en cualquier punto del bloque de campos opcionales), añade:

```ts
    // Plantilla propia del editor de sticker (premium). 1 sola por
    // usuario — se sobrescribe al guardar una nueva. baseTemplateId
    // identifica de qué plantilla predefinida partió (solo informativo,
    // no se usa para resolver el layout: los `elements` ya son
    // autocontenidos).
    customStickerTemplate: v.optional(v.object({
      baseTemplateId: v.string(),
      elements: v.array(v.object({
        fieldId: v.string(),
        visible: v.boolean(),
        x: v.number(),
        y: v.number(),
        scale: v.number(),
      })),
    })),
```

- [ ] **Step 3: Verificar que Convex acepta el schema**

Run: `npx convex dev --once`
Expected: termina sin errores de tipos, imprime algo como `Convex functions ready!` o similar (sin excepciones de validación de schema).

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(sticker-editor): añadir campos customStickerStorageId y customStickerTemplate al schema"
```

---

### Task 2: Decodificador de Google Polyline Encoding

**Files:**
- Create: `lib/sticker-editor/polyline.ts`
- Test: `scripts/test-sticker-polyline.ts`

- [ ] **Step 1: Escribir el script de test (falla primero, no existe la función aún)**

Crea `scripts/test-sticker-polyline.ts`:

```ts
// =============================================================================
// scripts/test-sticker-polyline.ts
// =============================================================================
// Test del decodificador de Google Polyline Encoding usado por el editor
// de sticker para dibujar la silueta de la ruta GPS.
// =============================================================================

import { decodePolyline, polylineToSvgPath } from "../lib/sticker-editor/polyline";

let failures = 0;

function assertClose(actual: number, expected: number, tolerance: number, label: string) {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    console.log(`  ✗ ${label}: esperado ~${expected}, obtenido ${actual} (diff ${diff})`);
    failures++;
  } else {
    console.log(`  ✓ ${label}: ${actual}`);
  }
}

// Ejemplo oficial de la doc de Google Maps Encoding:
// https://developers.google.com/maps/documentation/utilities/polylinealgorithm
// "_p~iF~ps|U_ulLnnqC_mqNvxq`@" decodifica a:
// [(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)]
console.log("=== decodePolyline: ejemplo oficial de Google ===");
const points = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
console.log("Puntos decodificados:", points);
if (points.length !== 3) {
  console.log(`  ✗ Longitud: esperada 3, obtenida ${points.length}`);
  failures++;
} else {
  console.log(`  ✓ Longitud: 3`);
}
assertClose(points[0][0], 38.5, 0.001, "punto 0 lat");
assertClose(points[0][1], -120.2, 0.001, "punto 0 lng");
assertClose(points[1][0], 40.7, 0.001, "punto 1 lat");
assertClose(points[1][1], -120.95, 0.001, "punto 1 lng");
assertClose(points[2][0], 43.252, 0.001, "punto 2 lat");
assertClose(points[2][1], -126.453, 0.001, "punto 2 lng");

console.log("\n=== decodePolyline: string vacía ===");
const empty = decodePolyline("");
if (empty.length !== 0) {
  console.log(`  ✗ Esperado array vacío, obtenido longitud ${empty.length}`);
  failures++;
} else {
  console.log("  ✓ Array vacío para string vacía");
}

console.log("\n=== polylineToSvgPath: genera un <path> d= no vacío ===");
const svgPath = polylineToSvgPath(points, 200);
console.log("Path:", svgPath);
if (typeof svgPath !== "string" || svgPath.length === 0 || !svgPath.startsWith("M")) {
  console.log(`  ✗ Esperado un path SVG que empiece con "M", obtenido: "${svgPath}"`);
  failures++;
} else {
  console.log("  ✓ Path SVG válido (empieza con M)");
}

console.log("\n=== polylineToSvgPath: con 0 o 1 puntos no rompe ===");
const zeroPoints = polylineToSvgPath([], 200);
const onePoint = polylineToSvgPath([[38.5, -120.2]], 200);
if (zeroPoints !== "") {
  console.log(`  ✗ 0 puntos: esperado "", obtenido "${zeroPoints}"`);
  failures++;
} else {
  console.log("  ✓ 0 puntos → path vacío");
}
if (typeof onePoint !== "string") {
  console.log(`  ✗ 1 punto: esperado string, obtenido ${typeof onePoint}`);
  failures++;
} else {
  console.log("  ✓ 1 punto no rompe");
}

console.log(`\n${failures === 0 ? "✓ TODOS PASAN" : `✗ ${failures} FALLO(S)`}`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Ejecutar y verificar que falla (el módulo no existe todavía)**

Run: `npx tsx scripts/test-sticker-polyline.ts`
Expected: FAIL — error de módulo no encontrado, algo como `Cannot find module '../lib/sticker-editor/polyline'`.

- [ ] **Step 3: Implementar `lib/sticker-editor/polyline.ts`**

Crea `lib/sticker-editor/polyline.ts`:

```ts
// =============================================================================
// mi-dorsal — Decodificador de Google Polyline Encoding
// =============================================================================
// Strava codifica el track GPS de una actividad (activities.mapPolyline)
// con el algoritmo estándar de Google Polyline Encoding. Lo decodificamos
// a [lat, lng][] y lo normalizamos a un <path> SVG cuadrado para dibujar
// la silueta de la ruta en el editor de sticker — sin librería externa,
// el algoritmo es ~20 líneas.
//
// Referencia del algoritmo:
// https://developers.google.com/maps/documentation/utilities/polylinealgorithm
// =============================================================================

/**
 * Decodifica un string en formato Google Polyline Encoding a una lista de
 * coordenadas [lat, lng]. Precisión estándar (factor 1e5, la que usa Strava).
 */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 1;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 1;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat * 1e-5, lng * 1e-5]);
  }

  return points;
}

/**
 * Normaliza una lista de puntos [lat, lng] a un <path> SVG cuadrado de
 * lado `viewBoxSize`, centrado y escalado para que la ruta completa quepa
 * dentro del viewBox con un margen del 10%. Usa lng como X y -lat como Y
 * (para que "arriba" en el mapa quede arriba en pantalla).
 *
 * Devuelve "" si no hay puntos suficientes para dibujar una ruta.
 */
export function polylineToSvgPath(
  points: [number, number][],
  viewBoxSize: number,
): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const size = viewBoxSize / 2;
    return `M ${size} ${size} L ${size} ${size}`;
  }

  const lats = points.map((p) => p[0]);
  const lngs = points.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latRange = maxLat - minLat || 1;
  const lngRange = maxLng - minLng || 1;
  const scale = (viewBoxSize * 0.8) / Math.max(latRange, lngRange);
  const margin = viewBoxSize * 0.1;

  const toXY = ([lat, lng]: [number, number]): [number, number] => {
    const x = margin + (lng - minLng) * scale;
    const y = margin + (maxLat - lat) * scale;
    return [x, y];
  };

  const [startX, startY] = toXY(points[0]);
  let d = `M ${startX.toFixed(2)} ${startY.toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    const [x, y] = toXY(points[i]);
    d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `npx tsx scripts/test-sticker-polyline.ts`
Expected: PASS — todas las líneas con `✓`, termina con `✓ TODOS PASAN`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add lib/sticker-editor/polyline.ts scripts/test-sticker-polyline.ts
git commit -m "feat(sticker-editor): decodificador de Google Polyline + normalizador a SVG path"
```

---

### Task 3: Catálogo de campos disponibles (`fields.ts`)

**Files:**
- Create: `lib/sticker-editor/fields.ts`
- Test: `scripts/test-sticker-fields.ts`

Este módulo define QUÉ campos existen (id, etiqueta, tamaño default) y una
función pura `getAvailableFields(data)` que, dado el objeto de datos de una
carrera, devuelve solo los `fieldId` que tienen dato real que mostrar (ej.
sin `mapPolyline` no se ofrece "routeMap"; sin PR no se ofrece "pr").

- [ ] **Step 1: Escribir el test (falla primero)**

Crea `scripts/test-sticker-fields.ts`:

```ts
// =============================================================================
// scripts/test-sticker-fields.ts
// =============================================================================
// Test de FIELD_CATALOG y getAvailableFields: verifica que solo se ofrecen
// campos con dato real, y que el catálogo tiene entradas coherentes.
// =============================================================================

import { FIELD_CATALOG, getAvailableFields, type StickerFieldId, type StickerData } from "../lib/sticker-editor/fields";

let failures = 0;
function check(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.log(`  ✗ ${label}`);
    failures++;
  }
}

const FULL_DATA: StickerData = {
  timeFormatted: "1:59:25",
  paceFormatted: "5:40",
  positionOverall: 120,
  totalRunners: 500,
  positionCategory: 15,
  isPersonalRecord: true,
  dorsalNumber: "1234",
  raceName: "Maratón de Valencia",
  raceDate: "25 de octubre de 2025",
  runnerName: "Manu Vera",
  distanceLabel: "Maratón",
  routeSvgPath: "M 10 10 L 20 20",
};

const MINIMAL_DATA: StickerData = {
  timeFormatted: "1:59:25",
  paceFormatted: "5:40",
  positionOverall: undefined,
  totalRunners: undefined,
  positionCategory: undefined,
  isPersonalRecord: false,
  dorsalNumber: undefined,
  raceName: "Maratón de Valencia",
  raceDate: "25 de octubre de 2025",
  runnerName: "Manu Vera",
  distanceLabel: "Maratón",
  routeSvgPath: undefined,
};

console.log("=== FIELD_CATALOG tiene entradas coherentes ===");
const ids = Object.keys(FIELD_CATALOG) as StickerFieldId[];
check(ids.length >= 9, `al menos 9 campos definidos (hay ${ids.length})`);
for (const id of ids) {
  const def = FIELD_CATALOG[id];
  check(typeof def.label === "string" && def.label.length > 0, `${id}: label no vacío`);
  check(typeof def.defaultScale === "number" && def.defaultScale > 0, `${id}: defaultScale > 0`);
}

console.log("\n=== getAvailableFields con datos completos ===");
const fullAvailable = getAvailableFields(FULL_DATA);
check(fullAvailable.includes("time"), "incluye 'time'");
check(fullAvailable.includes("pr"), "incluye 'pr' cuando isPersonalRecord=true");
check(fullAvailable.includes("routeMap"), "incluye 'routeMap' cuando hay routeSvgPath");
check(fullAvailable.includes("dorsal"), "incluye 'dorsal' cuando hay dorsalNumber");
check(fullAvailable.includes("positionCategory"), "incluye 'positionCategory' cuando hay dato");

console.log("\n=== getAvailableFields con datos mínimos ===");
const minimalAvailable = getAvailableFields(MINIMAL_DATA);
check(minimalAvailable.includes("time"), "incluye 'time' (siempre presente)");
check(!minimalAvailable.includes("pr"), "NO incluye 'pr' sin PR");
check(!minimalAvailable.includes("routeMap"), "NO incluye 'routeMap' sin polyline");
check(!minimalAvailable.includes("dorsal"), "NO incluye 'dorsal' sin dorsalNumber");
check(!minimalAvailable.includes("position"), "NO incluye 'position' sin positionOverall");
check(!minimalAvailable.includes("positionCategory"), "NO incluye 'positionCategory' sin dato");

console.log(`\n${failures === 0 ? "✓ TODOS PASAN" : `✗ ${failures} FALLO(S)`}`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx tsx scripts/test-sticker-fields.ts`
Expected: FAIL — `Cannot find module '../lib/sticker-editor/fields'`.

- [ ] **Step 3: Implementar `lib/sticker-editor/fields.ts`**

Crea `lib/sticker-editor/fields.ts`:

```ts
// =============================================================================
// mi-dorsal — Catálogo de campos del editor de sticker
// =============================================================================
// Cada campo (fieldId) representa un dato que el usuario puede mostrar,
// mover y redimensionar en el lienzo del editor. Este módulo NO sabe
// renderizar JSX — solo define metadata (etiqueta, tamaño default) y la
// lógica pura de "¿qué campos tienen dato real para esta carrera?".
// El render visual de cada campo vive en StickerCanvas.tsx (componente
// React), que importa este catálogo para iterar sobre los fieldId activos.
// =============================================================================

export type StickerFieldId =
  | "time"
  | "pace"
  | "position"
  | "positionCategory"
  | "pr"
  | "dorsal"
  | "raceNameDate"
  | "runnerName"
  | "distance"
  | "routeMap";

export interface StickerFieldDef {
  label: string;
  /** Escala default (multiplicador 1.0 = tamaño base definido en StickerCanvas). */
  defaultScale: number;
}

export const FIELD_CATALOG: Record<StickerFieldId, StickerFieldDef> = {
  time: { label: "Tiempo oficial", defaultScale: 1 },
  pace: { label: "Pace", defaultScale: 1 },
  position: { label: "Posición general", defaultScale: 1 },
  positionCategory: { label: "Posición categoría", defaultScale: 1 },
  pr: { label: "Badge Nuevo PR", defaultScale: 1 },
  dorsal: { label: "Dorsal", defaultScale: 1 },
  raceNameDate: { label: "Nombre carrera + fecha", defaultScale: 1 },
  runnerName: { label: "Tu nombre", defaultScale: 1 },
  distance: { label: "Distancia", defaultScale: 1 },
  routeMap: { label: "Silueta de la ruta", defaultScale: 1 },
};

/**
 * Shape común de datos de carrera que el editor necesita para decidir qué
 * campos ofrecer y qué valor renderizar en cada uno. `routeSvgPath` ya
 * viene pre-calculado (ver lib/sticker-editor/polyline.ts) — este módulo
 * no decodifica polylines, solo comprueba si hay algo que mostrar.
 */
export interface StickerData {
  timeFormatted?: string;
  paceFormatted?: string;
  positionOverall?: number;
  totalRunners?: number;
  positionCategory?: number;
  isPersonalRecord?: boolean;
  dorsalNumber?: string;
  raceName?: string;
  raceDate?: string;
  runnerName?: string;
  distanceLabel?: string;
  routeSvgPath?: string;
}

/**
 * Devuelve la lista de fieldId que tienen dato real para esta carrera.
 * "time" y "pace" se consideran siempre disponibles (son el corazón del
 * sticker); el resto solo se ofrece si hay valor.
 */
export function getAvailableFields(data: StickerData): StickerFieldId[] {
  const available: StickerFieldId[] = ["time", "pace"];
  if (data.positionOverall != null) available.push("position");
  if (data.positionCategory != null) available.push("positionCategory");
  if (data.isPersonalRecord) available.push("pr");
  if (data.dorsalNumber) available.push("dorsal");
  if (data.raceName && data.raceDate) available.push("raceNameDate");
  if (data.runnerName) available.push("runnerName");
  if (data.distanceLabel) available.push("distance");
  if (data.routeSvgPath) available.push("routeMap");
  return available;
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `npx tsx scripts/test-sticker-fields.ts`
Expected: PASS — todas `✓`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add lib/sticker-editor/fields.ts scripts/test-sticker-fields.ts
git commit -m "feat(sticker-editor): catálogo de campos disponibles y resolución por disponibilidad de dato"
```

---

### Task 4: Plantillas predefinidas (`templates.ts`)

**Files:**
- Create: `lib/sticker-editor/templates.ts`
- Test: `scripts/test-sticker-templates.ts`

Define 3 plantillas ("classic", "minimal", "bold") como constantes: cada
una es una lista de `{ fieldId, visible, x, y, scale }` con posiciones
normalizadas 0-1 sobre el lienzo lógico 1080×1920. También expone
`applyTemplate(templateId, activeFieldIds)` — cambia de plantilla
conservando qué campos estaban activos (requisito UX del spec).

- [ ] **Step 1: Escribir el test (falla primero)**

Crea `scripts/test-sticker-templates.ts`:

```ts
// =============================================================================
// scripts/test-sticker-templates.ts
// =============================================================================
// Test de STICKER_TEMPLATES y applyTemplate: verifica que cada plantilla
// tiene coordenadas válidas (0-1) y que cambiar de plantilla conserva los
// campos activos del usuario.
// =============================================================================

import {
  STICKER_TEMPLATES,
  applyTemplate,
  type StickerTemplateId,
} from "../lib/sticker-editor/templates";
import type { StickerFieldId } from "../lib/sticker-editor/fields";

let failures = 0;
function check(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.log(`  ✗ ${label}`);
    failures++;
  }
}

console.log("=== STICKER_TEMPLATES: 2-3 plantillas con coordenadas válidas ===");
const templateIds = Object.keys(STICKER_TEMPLATES) as StickerTemplateId[];
check(templateIds.length >= 2 && templateIds.length <= 3, `entre 2 y 3 plantillas (hay ${templateIds.length})`);

for (const id of templateIds) {
  const template = STICKER_TEMPLATES[id];
  check(template.elements.length > 0, `${id}: tiene elementos`);
  for (const el of template.elements) {
    check(el.x >= 0 && el.x <= 1, `${id}/${el.fieldId}: x=${el.x} en rango 0-1`);
    check(el.y >= 0 && el.y <= 1, `${id}/${el.fieldId}: y=${el.y} en rango 0-1`);
    check(el.scale > 0, `${id}/${el.fieldId}: scale=${el.scale} > 0`);
  }
  // time y pace deben estar en toda plantilla predefinida (son el core del sticker)
  const fieldIds = template.elements.map((e) => e.fieldId);
  check(fieldIds.includes("time"), `${id}: incluye 'time'`);
  check(fieldIds.includes("pace"), `${id}: incluye 'pace'`);
}

console.log("\n=== applyTemplate: conserva campos activos al cambiar de plantilla ===");
const templateAIds = Object.keys(STICKER_TEMPLATES) as StickerTemplateId[];
const fromId = templateAIds[0];
const toId = templateAIds[1];

// Simula que el usuario activó "dorsal" además de lo default de la plantilla origen.
const activeFields: StickerFieldId[] = [...STICKER_TEMPLATES[fromId].elements.map((e) => e.fieldId), "dorsal"];
const result = applyTemplate(toId, activeFields);

check(result.elements.some((e) => e.fieldId === "dorsal"), "'dorsal' sigue presente tras cambiar de plantilla");
check(
  result.elements.every((e) => e.visible === activeFields.includes(e.fieldId)),
  "visible=true solo para los fieldId que estaban activos",
);
check(
  result.elements.every((e) => e.x >= 0 && e.x <= 1 && e.y >= 0 && e.y <= 1),
  "todas las posiciones resultantes están en rango 0-1",
);

console.log(`\n${failures === 0 ? "✓ TODOS PASAN" : `✗ ${failures} FALLO(S)`}`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx tsx scripts/test-sticker-templates.ts`
Expected: FAIL — `Cannot find module '../lib/sticker-editor/templates'`.

- [ ] **Step 3: Implementar `lib/sticker-editor/templates.ts`**

Crea `lib/sticker-editor/templates.ts`:

```ts
// =============================================================================
// mi-dorsal — Plantillas predefinidas del editor de sticker
// =============================================================================
// 3 layouts de partida sobre el lienzo lógico 1080x1920 (coordenadas
// normalizadas 0-1). El usuario elige una al abrir el editor; puede
// cambiar de plantilla más adelante sin perder qué campos tenía activos
// (ver applyTemplate). Reutilizan la paleta de lib/share-card/render.tsx
// a nivel visual (eso vive en StickerCanvas.tsx, no aquí — este módulo
// solo define layout, no estilo).
// =============================================================================

import { FIELD_CATALOG, type StickerFieldId } from "./fields";

export type StickerTemplateId = "classic" | "minimal" | "bold";

export interface StickerElementLayout {
  fieldId: StickerFieldId;
  visible: boolean;
  x: number;
  y: number;
  scale: number;
}

export interface StickerTemplate {
  id: StickerTemplateId;
  label: string;
  elements: StickerElementLayout[];
}

// "Classic": todo centrado verticalmente, apilado — mismo espíritu que
// el story-sticker.tsx fijo actual (pr badge, tiempo hero, pace+posición
// en fila).
const CLASSIC: StickerTemplate = {
  id: "classic",
  label: "Clásica",
  elements: [
    { fieldId: "pr", visible: true, x: 0.5, y: 0.32, scale: 1 },
    { fieldId: "time", visible: true, x: 0.5, y: 0.42, scale: 1 },
    { fieldId: "pace", visible: true, x: 0.35, y: 0.52, scale: 1 },
    { fieldId: "position", visible: true, x: 0.65, y: 0.52, scale: 1 },
  ],
};

// "Minimal": solo el tiempo, grande, en el tercio superior, sin badges.
const MINIMAL: StickerTemplate = {
  id: "minimal",
  label: "Minimal",
  elements: [
    { fieldId: "time", visible: true, x: 0.5, y: 0.25, scale: 1.15 },
    { fieldId: "pace", visible: true, x: 0.5, y: 0.35, scale: 0.85 },
  ],
};

// "Bold": tiempo arriba, dorsal grande abajo, ruta como fondo decorativo
// en el centro (si hay dato).
const BOLD: StickerTemplate = {
  id: "bold",
  label: "Bold",
  elements: [
    { fieldId: "time", visible: true, x: 0.5, y: 0.2, scale: 1.1 },
    { fieldId: "routeMap", visible: true, x: 0.5, y: 0.5, scale: 1 },
    { fieldId: "dorsal", visible: true, x: 0.5, y: 0.78, scale: 1 },
    { fieldId: "position", visible: true, x: 0.5, y: 0.88, scale: 0.9 },
  ],
};

export const STICKER_TEMPLATES: Record<StickerTemplateId, StickerTemplate> = {
  classic: CLASSIC,
  minimal: MINIMAL,
  bold: BOLD,
};

/**
 * Posición/escala default de un fieldId cuando el usuario lo añade con
 * "+ Añadir dato" y esa plantilla no lo incluye por defecto. Simplemente
 * lo centra en el tercio inferior libre — el usuario lo reposiciona.
 */
function defaultPositionFor(fieldId: StickerFieldId): { x: number; y: number; scale: number } {
  return { x: 0.5, y: 0.65, scale: FIELD_CATALOG[fieldId].defaultScale };
}

/**
 * Cambia a la plantilla `templateId` conservando cuáles de los
 * `activeFieldIds` (fieldId que el usuario tenía visibles antes del
 * cambio) siguen visibles. Un campo activo que la nueva plantilla no
 * define de forma nativa se añade con una posición default centrada.
 * Un campo que la plantilla SÍ define pero no estaba en `activeFieldIds`
 * queda con visible=false (el usuario tendría que reactivarlo).
 */
export function applyTemplate(
  templateId: StickerTemplateId,
  activeFieldIds: StickerFieldId[],
): StickerTemplate {
  const base = STICKER_TEMPLATES[templateId];
  const baseFieldIds = new Set(base.elements.map((e) => e.fieldId));

  const elements: StickerElementLayout[] = base.elements.map((el) => ({
    ...el,
    visible: activeFieldIds.includes(el.fieldId),
  }));

  for (const fieldId of activeFieldIds) {
    if (!baseFieldIds.has(fieldId)) {
      elements.push({
        fieldId,
        visible: true,
        ...defaultPositionFor(fieldId),
      });
    }
  }

  return { id: templateId, label: base.label, elements };
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `npx tsx scripts/test-sticker-templates.ts`
Expected: PASS — todas `✓`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add lib/sticker-editor/templates.ts scripts/test-sticker-templates.ts
git commit -m "feat(sticker-editor): plantillas predefinidas classic/minimal/bold + applyTemplate"
```

---

## Fase 2 — Backend Convex

### Task 5: Módulo `convex/stickerEditor.ts` (queries + mutations)

**Files:**
- Create: `convex/stickerEditor.ts`
- Modify: `convex/schema.ts` (ya hecho en Task 1, sin cambios adicionales)

**Nota de arquitectura importante:** `lib/convexStorage.ts` (`convexStorageGenerateUploadUrl`)
usa `ConvexHttpClient`, que es **solo server-side** (Next.js API routes) — no
sirve desde un client component en el navegador. Como el editor exporta
100% client-side, necesitamos una **mutation pública** propia que envuelva
`ctx.storage.generateUploadUrl()`, invocable con `useMutation` desde React.

- [ ] **Step 1: Implementar `convex/stickerEditor.ts`**

Crea `convex/stickerEditor.ts`:

```ts
// =============================================================================
// mi-dorsal — Editor de sticker personalizable (feature premium)
// =============================================================================
// Queries/mutations para /editor-sticker/{myRaceId} y /mi-sticker. Ver spec
// docs/superpowers/specs/2026-09-10-sticker-editor-design.md.
//
// A diferencia de diploma/share-card/story-sticker (generados server-side
// por convex/emailNotificationsAction.ts), el PNG personalizado se exporta
// 100% client-side (html-to-image) y solo se sube aquí para persistirlo.
// =============================================================================

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./_helpers";
import { hasPremiumAccess } from "./subscriptions";
import { getEffectiveDistance } from "../lib/prediction/effective-distance";
import { Id } from "./_generated/dataModel";

/**
 * Datos completos para montar el editor: carrera + corredor + PR + mapa de
 * ruta (si hay actividad vinculada) + plantilla propia del usuario (si la
 * guardó antes) + storageId del sticker personalizado ya exportado (si
 * existe, para poder mostrarlo/redescargarlo).
 */
export const getEditorData = query({
  args: { myRaceId: v.id("myRaces") },
  handler: async (ctx, { myRaceId }) => {
    const user = await requireUser(ctx);
    const myRace = await ctx.db.get(myRaceId);
    if (!myRace) return null;
    if (myRace.userId !== user._id) return null;

    const race = await ctx.db.get(myRace.raceId);
    if (!race) return null;

    const effectiveDistance = getEffectiveDistance(myRace, race);
    const distanceM = Math.round(effectiveDistance.distanceKm * 1000);

    const currentPR = await ctx.db
      .query("personalRecords")
      .withIndex("by_user_distance_current", (q) =>
        q.eq("userId", user._id).eq("distanceM", distanceM).eq("isCurrent", true),
      )
      .unique();

    // Resolución del mapa de ruta: no hay vínculo directo myRace→activity.
    // Buscamos actividades del usuario vinculadas a esta carrera
    // (matchedRaceId == myRace.raceId) y nos quedamos con la de mayor
    // distancia (heurística: la carrera real, no un calentamiento corto).
    const candidateActivities = await ctx.db
      .query("activities")
      .withIndex("by_matched_race", (q) => q.eq("matchedRaceId", myRace.raceId))
      .filter((q) => q.eq(q.field("userId"), myRace.userId))
      .collect();
    const bestActivity = candidateActivities.sort((a, b) => b.distanceM - a.distanceM)[0];
    const mapPolyline = bestActivity?.mapPolyline;

    return {
      myRace: {
        _id: myRace._id,
        dorsalNumber: myRace.dorsalNumber,
        actualTimeSeconds: myRace.actualTimeSeconds,
        actualPosition: myRace.actualPosition,
        actualPositionCategory: myRace.actualPositionCategory,
        customStickerStorageId: myRace.customStickerStorageId,
      },
      race: {
        name: race.name,
        startDate: race.startDate,
        distanceLabel: effectiveDistance.label,
        distanceKm: effectiveDistance.distanceKm,
      },
      runnerName: user.displayName ?? "Corredor",
      currentPR: currentPR ? { timeSeconds: currentPR.timeSeconds } : null,
      mapPolyline: mapPolyline ?? null,
      customStickerTemplate: user.customStickerTemplate ?? null,
    };
  },
});

/**
 * Guarda (o sobrescribe) la plantilla propia del usuario actual. 1 sola
 * por usuario — sin historial. Requiere premium (mismo criterio de
 * feature gating que el resto del editor).
 */
export const saveCustomTemplate = mutation({
  args: {
    baseTemplateId: v.string(),
    elements: v.array(
      v.object({
        fieldId: v.string(),
        visible: v.boolean(),
        x: v.number(),
        y: v.number(),
        scale: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const isPremium = await hasPremiumAccess(ctx, identity.subject);
    if (!isPremium) {
      throw new Error("Esta función requiere una cuenta Premium");
    }
    await ctx.db.patch(user._id, {
      customStickerTemplate: {
        baseTemplateId: args.baseTemplateId,
        elements: args.elements,
      },
    });
  },
});

/**
 * Genera una signed upload URL de Convex Storage, invocable directamente
 * desde el navegador (a diferencia de convexStorageGenerateUploadUrl en
 * lib/convexStorage.ts, que usa ConvexHttpClient y solo funciona
 * server-side). Requiere premium.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const isPremium = await hasPremiumAccess(ctx, identity.subject);
    if (!isPremium) {
      throw new Error("Esta función requiere una cuenta Premium");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Asocia el PNG recién subido (storageId) a la myRace, sobrescribiendo el
 * anterior si existía. A diferencia de diploma/share-card (que se generan
 * una sola vez), este campo se puede regenerar muchas veces — hay que
 * borrar el blob previo o se acumulan huérfanos en Storage.
 */
export const attachCustomSticker = mutation({
  args: {
    myRaceId: v.id("myRaces"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { myRaceId, storageId }) => {
    const user = await requireUser(ctx);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const isPremium = await hasPremiumAccess(ctx, identity.subject);
    if (!isPremium) {
      throw new Error("Esta función requiere una cuenta Premium");
    }

    const myRace = await ctx.db.get(myRaceId);
    if (!myRace) throw new Error("myRace no encontrada");
    if (myRace.userId !== user._id) {
      throw new Error("Forbidden: esta myRace pertenece a otro usuario");
    }

    if (myRace.customStickerStorageId) {
      await ctx.storage.delete(myRace.customStickerStorageId);
    }

    await ctx.db.patch(myRaceId, { customStickerStorageId: storageId as Id<"_storage"> });
  },
});
```

- [ ] **Step 2: Verificar que Convex acepta el módulo nuevo**

Run: `npx convex dev --once`
Expected: termina sin errores de tipos ni de validación de schema. Si aparece
un error de import (`hasPremiumAccess` no exportado, etc.), revisa que
`convex/subscriptions.ts:108` exporte `hasPremiumAccess` — ya lo hace, según
lectura del código en la fase de brainstorming.

- [ ] **Step 3: Commit**

```bash
git add convex/stickerEditor.ts
git commit -m "feat(sticker-editor): queries/mutations Convex (getEditorData, saveCustomTemplate, generateUploadUrl, attachCustomSticker)"
```

---

### Task 6: Query pública + endpoint de descarga del sticker personalizado

**Files:**
- Modify: `convex/stickerEditor.ts`
- Create: `app/api/result/[myRaceId]/custom-sticker.png/route.ts`

Sigue exactamente el mismo patrón que
`app/api/result/[myRaceId]/story-sticker.png/route.ts` (ya existente), pero
leyendo `customStickerStorageId` en vez de `storyStickerStorageId`. Igual que
ese endpoint, la query que resuelve el storageId es pública (sin auth) — el
mismo criterio que ya usan `getMyRaceForShareCard`/`getMyRaceForStorySticker`
en `convex/emailNotificationsHelpers.ts`, porque estos PNGs se sirven desde
la página pública `/resultado/{myRaceId}`.

- [ ] **Step 1: Añadir la query pública a `convex/stickerEditor.ts`**

Añade al final de `convex/stickerEditor.ts`:

```ts
/**
 * Devuelve los datos mínimos del myRace para servir el sticker
 * personalizado PNG. Pública (sin auth) — mismo criterio que
 * getMyRaceForShareCard/getMyRaceForStorySticker en
 * emailNotificationsHelpers.ts: el endpoint de descarga es público.
 */
export const getMyRaceForCustomSticker = query({
  args: { myRaceId: v.id("myRaces") },
  handler: async (ctx, { myRaceId }) => {
    const myRace = await ctx.db.get(myRaceId);
    if (!myRace) return null;
    return {
      _id: myRace._id,
      customStickerStorageId: myRace.customStickerStorageId,
    };
  },
});
```

- [ ] **Step 2: Crear el endpoint de descarga**

Crea `app/api/result/[myRaceId]/custom-sticker.png/route.ts` (copia adaptada
de `story-sticker.png/route.ts`):

```ts
// =============================================================================
// mi-dorsal — Endpoint: sticker personalizado PNG (editor premium)
// =============================================================================
// GET /api/result/{myRaceId}/custom-sticker.png
//
// Sirve el PNG exportado desde /editor-sticker/{myRaceId} (html-to-image,
// client-side) y persistido vía convex/stickerEditor.attachCustomSticker.
// Mismo patrón que story-sticker.png/route.ts, pero leyendo
// customStickerStorageId. Si la myRace no tiene ninguno exportado todavía,
// devuelve 404 con placeholder — sin regeneración on-demand (el usuario
// tiene que volver al editor para generarlo).
//
// Cache: NO inmutable — a diferencia de diploma/share-card/story-sticker
// (que se generan una vez), este PNG se puede sobrescribir cuando el
// usuario reedita y vuelve a exportar. Cache corto con revalidación.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ myRaceId: string }> },
) {
  try {
    const { myRaceId: rawMyRaceId } = await params;
    const myRaceId = rawMyRaceId as Id<"myRaces">;

    let data;
    try {
      data = await fetchQuery(api.stickerEditor.getMyRaceForCustomSticker, {
        myRaceId,
      });
    } catch (convexErr) {
      console.error("[custom-sticker] Convex query failed:", convexErr);
      return new NextResponse(generatePlaceholderSvg("Servicio no disponible"), {
        status: 503,
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (!data) {
      return new NextResponse(generatePlaceholderSvg("Resultado no encontrado"), {
        status: 404,
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
      });
    }
    if (!data.customStickerStorageId) {
      return new NextResponse(generatePlaceholderSvg("Aún no has personalizado tu sticker"), {
        status: 404,
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
      });
    }

    let blobUrl;
    try {
      blobUrl = await fetchQuery(api.emailNotificationsHelpers.getStorageUrl, {
        storageId: data.customStickerStorageId,
      });
    } catch (convexErr) {
      console.error("[custom-sticker] Convex storage query failed:", convexErr);
      return new NextResponse(generatePlaceholderSvg("Storage no disponible"), {
        status: 503,
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
      });
    }
    if (!blobUrl) {
      return new NextResponse(generatePlaceholderSvg("Imagen expirada"), {
        status: 404,
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
      });
    }

    const upstream = await fetch(blobUrl);
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `upstream fetch failed: ${upstream.status}` },
        { status: 502 },
      );
    }
    const buf = Buffer.from(await upstream.arrayBuffer());

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="mi-dorsal-sticker-${myRaceId}.png"`,
        // No inmutable: el usuario puede reeditar y sobrescribir.
        "Cache-Control": "public, max-age=60, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[custom-sticker] Error serving PNG:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function generatePlaceholderSvg(message: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
    <rect width="1080" height="1920" fill="#fafaf9"/>
    <text x="540" y="960" font-family="system-ui" font-size="32" fill="#78716c" text-anchor="middle">${message}</text>
  </svg>`;
}
```

- [ ] **Step 3: Verificar manualmente con curl (usando una myRaceId real del entorno dev)**

Run: `npx convex dev --once && npm run dev` (en dos terminales, o usa el dev
server ya corriendo), luego:

```bash
curl -i http://localhost:3000/api/result/<UNA_MY_RACE_ID_REAL>/custom-sticker.png
```

Expected: `404` con `Content-Type: image/svg+xml` y el mensaje "Aún no has
personalizado tu sticker" (porque `attachCustomSticker` todavía no se ha
llamado para ninguna myRace) — confirma que el endpoint responde sin
crashear antes de que exista contenido real que servir.

- [ ] **Step 4: Commit**

```bash
git add convex/stickerEditor.ts "app/api/result/[myRaceId]/custom-sticker.png/route.ts"
git commit -m "feat(sticker-editor): endpoint de descarga del sticker personalizado"
```

---

## Fase 3 — Componentes UI del editor

### Task 7: Instalar `html-to-image` y hook `usePointerDrag`

**Files:**
- Modify: `package.json`
- Create: `lib/sticker-editor/usePointerDrag.ts`

- [ ] **Step 1: Instalar la dependencia**

Run: `npm install html-to-image@1.11.13`
Expected: se añade `"html-to-image": "^1.11.13"` a `dependencies` en `package.json`.

- [ ] **Step 2: Implementar el hook `usePointerDrag`**

Este hook es genérico: dado un contenedor de referencia (el lienzo) y un
callback, convierte movimientos de puntero (mouse o touch, vía Pointer
Events) en deltas normalizados 0-1 respecto al tamaño del contenedor.
Se usa tanto para mover un elemento como para redimensionarlo (el
componente que lo consume decide qué hacer con el delta).

Crea `lib/sticker-editor/usePointerDrag.ts`:

```ts
// =============================================================================
// mi-dorsal — usePointerDrag
// =============================================================================
// Hook genérico para arrastrar/redimensionar elementos del editor de
// sticker con Pointer Events nativos (funciona con mouse y touch sin
// código separado). No sabe nada de "elementos del sticker" — solo emite
// deltas normalizados (0-1) respecto al tamaño de un contenedor de
// referencia. StickerCanvas.tsx lo usa dos veces: una para mover, otra
// para redimensionar (con distinto onDelta).
// =============================================================================

"use client";

import { useCallback, useRef } from "react";

export interface PointerDragHandlers {
  /** Poner en onPointerDown del elemento arrastrable. */
  onPointerDown: (e: React.PointerEvent) => void;
}

/**
 * `containerRef` debe apuntar al lienzo (el elemento cuyo tamaño define la
 * escala 0-1 de los deltas). `onDelta` se llama en cada movimiento con el
 * delta normalizado desde el punto de inicio del drag; `onDragEnd` se
 * llama una vez al soltar.
 */
export function usePointerDrag(
  containerRef: React.RefObject<HTMLElement | null>,
  onDelta: (deltaX: number, deltaY: number) => void,
  onDragEnd?: () => void,
): PointerDragHandlers {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      startRef.current = { x: e.clientX, y: e.clientY };

      const handleMove = (moveEvent: PointerEvent) => {
        if (!startRef.current) return;
        const deltaX = (moveEvent.clientX - startRef.current.x) / rect.width;
        const deltaY = (moveEvent.clientY - startRef.current.y) / rect.height;
        onDelta(deltaX, deltaY);
        startRef.current = { x: moveEvent.clientX, y: moveEvent.clientY };
      };

      const handleUp = () => {
        startRef.current = null;
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        onDragEnd?.();
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [containerRef, onDelta, onDragEnd],
  );

  return { onPointerDown };
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos relacionados con `lib/sticker-editor/usePointerDrag.ts`.
(Puede haber warnings preexistentes de otras partes del repo — ignóralos,
solo verifica que no aparecen errores en este archivo nuevo.)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json lib/sticker-editor/usePointerDrag.ts
git commit -m "feat(sticker-editor): instalar html-to-image + hook usePointerDrag"
```

---

### Task 8: Componente `StickerCanvas` (lienzo del editor)

**Files:**
- Create: `lib/sticker-editor/StickerCanvas.tsx`

Renderiza el lienzo lógico 1080×1920 con checkerboard de fondo (transparencia
de referencia — no forma parte del PNG exportado, ver Task 9), itera sobre
los `elements` visibles y dibuja cada campo según su `fieldId` con estilo
"panel blanco semi-opaco" (spec: `rgba(255,255,255,0.92)`, texto oscuro,
paleta de `lib/share-card/render.tsx`). Gestiona selección (click/tap) y usa
`usePointerDrag` dos veces por elemento seleccionado: una para mover, otra
para el handle de resize.

- [ ] **Step 1: Implementar `lib/sticker-editor/StickerCanvas.tsx`**

Crea `lib/sticker-editor/StickerCanvas.tsx`:

```tsx
// =============================================================================
// mi-dorsal — StickerCanvas
// =============================================================================
// Lienzo del editor de sticker: 1080x1920 lógico, renderizado a un tamaño
// visual menor en pantalla (CSS transform: scale), pero el DOM interno
// mantiene las dimensiones lógicas para que html-to-image capture a
// resolución completa (ver Task 9, exportStickerToBlob). El checkerboard
// vive en el wrapper exterior (fuera de canvasRef), así que nunca aparece
// en el PNG capturado.
// =============================================================================

"use client";

import { useRef } from "react";
import type { StickerElementLayout } from "./templates";
import type { StickerData, StickerFieldId } from "./fields";
import { usePointerDrag } from "./usePointerDrag";

export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1920;

const PALETTE = {
  accent: "#16a34a",
  primary: "#dc2626",
  ink: "#1c1917",
  muted: "#78716c",
  prBg: "#dcfce7",
  prText: "#15803d",
  panelBg: "rgba(255, 255, 255, 0.92)",
};

interface StickerCanvasProps {
  elements: StickerElementLayout[];
  data: StickerData;
  selectedFieldId: StickerFieldId | null;
  onSelect: (fieldId: StickerFieldId | null) => void;
  onMove: (fieldId: StickerFieldId, x: number, y: number) => void;
  onResize: (fieldId: StickerFieldId, scale: number) => void;
  /** Tamaño visual en pantalla (px). El lienzo lógico sigue siendo 1080x1920. */
  displayWidth: number;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

export function StickerCanvas({
  elements,
  data,
  selectedFieldId,
  onSelect,
  onMove,
  onResize,
  displayWidth,
  canvasRef,
}: StickerCanvasProps) {
  const scaleRatio = displayWidth / CANVAS_WIDTH;
  const displayHeight = CANVAS_HEIGHT * scaleRatio;

  return (
    <div
      data-sticker-checkerboard
      style={{
        width: displayWidth,
        height: displayHeight,
        overflow: "hidden",
        position: "relative",
        backgroundImage:
          "repeating-conic-gradient(#e5e5e5 0% 25%, #f5f5f5 0% 50%)",
        backgroundSize: "24px 24px",
        borderRadius: "8px",
      }}
      onClick={() => onSelect(null)}
    >
      <div
        ref={canvasRef}
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scaleRatio})`,
          transformOrigin: "top left",
          position: "relative",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {elements
          .filter((el) => el.visible)
          .map((el) => (
            <StickerElementView
              key={el.fieldId}
              element={el}
              data={data}
              isSelected={selectedFieldId === el.fieldId}
              onSelect={() => onSelect(el.fieldId)}
              onMove={(x, y) => onMove(el.fieldId, x, y)}
              onResize={(scale) => onResize(el.fieldId, scale)}
              dragContainerRef={canvasRef}
            />
          ))}
      </div>
    </div>
  );
}

function StickerElementView({
  element,
  data,
  isSelected,
  onSelect,
  onMove,
  onResize,
  dragContainerRef,
}: {
  element: StickerElementLayout;
  data: StickerData;
  isSelected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (scale: number) => void;
  /** El lienzo completo (1080x1920 lógico, escalado visualmente con CSS
   *  transform), NO el propio elemento — el delta de arrastre debe
   *  normalizarse contra el tamaño del lienzo, no contra un elemento que
   *  cambia de tamaño mientras lo redimensionas (eso crearía un bucle de
   *  feedback: el delta cambiaría de escala en cada frame de resize). */
  dragContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const moveDrag = usePointerDrag(dragContainerRef, (deltaX, deltaY) => {
    const nextX = Math.min(1, Math.max(0, element.x + deltaX));
    const nextY = Math.min(1, Math.max(0, element.y + deltaY));
    onMove(nextX, nextY);
  });

  const resizeDrag = usePointerDrag(dragContainerRef, (deltaX) => {
    const nextScale = Math.min(3, Math.max(0.3, element.scale + deltaX * 2));
    onResize(nextScale);
  });

  return (
    <div
      ref={wrapperRef}
      onPointerDown={(e) => {
        onSelect();
        moveDrag.onPointerDown(e);
      }}
      style={{
        position: "absolute",
        left: `${element.x * 100}%`,
        top: `${element.y * 100}%`,
        transform: `translate(-50%, -50%) scale(${element.scale})`,
        cursor: "move",
        outline: isSelected ? "3px dashed #4ade80" : "none",
        outlineOffset: "4px",
        touchAction: "none",
      }}
    >
      <StickerFieldContent fieldId={element.fieldId} data={data} />
      {isSelected && (
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            resizeDrag.onPointerDown(e);
          }}
          style={{
            position: "absolute",
            right: "-16px",
            bottom: "-16px",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            backgroundColor: "#4ade80",
            border: "3px solid white",
            cursor: "nwse-resize",
            touchAction: "none",
          }}
        />
      )}
    </div>
  );
}

/** Renderiza el contenido visual de cada fieldId. Sin lógica de posición
 *  (eso vive en el wrapper) — solo el "cómo se ve" cada dato. */
function StickerFieldContent({
  fieldId,
  data,
}: {
  fieldId: StickerFieldId;
  data: StickerData;
}) {
  const panelStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: PALETTE.panelBg,
    borderRadius: "24px",
    padding: "24px 40px",
    whiteSpace: "nowrap",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "18px",
    fontWeight: 700,
    color: PALETTE.muted,
    letterSpacing: "2px",
    textTransform: "uppercase",
    marginBottom: "8px",
  };

  switch (fieldId) {
    case "time":
      return (
        <div style={panelStyle}>
          <div style={labelStyle}>Tu tiempo oficial</div>
          <div style={{ fontSize: "96px", fontWeight: 700, fontFamily: "JetBrains Mono", color: PALETTE.accent, lineHeight: 1 }}>
            {data.timeFormatted ?? "—"}
          </div>
        </div>
      );
    case "pace":
      return (
        <div style={panelStyle}>
          <div style={labelStyle}>Pace</div>
          <div style={{ fontSize: "40px", fontWeight: 700, fontFamily: "JetBrains Mono", color: PALETTE.ink }}>
            {data.paceFormatted ?? "—"} /km
          </div>
        </div>
      );
    case "position":
      return (
        <div style={panelStyle}>
          <div style={labelStyle}>Pos. general</div>
          <div style={{ fontSize: "40px", fontWeight: 700, fontFamily: "JetBrains Mono", color: PALETTE.ink }}>
            {data.positionOverall ?? "—"}
            {data.totalRunners ? ` / ${data.totalRunners}` : ""}
          </div>
        </div>
      );
    case "positionCategory":
      return (
        <div style={panelStyle}>
          <div style={labelStyle}>Pos. categoría</div>
          <div style={{ fontSize: "40px", fontWeight: 700, fontFamily: "JetBrains Mono", color: PALETTE.ink }}>
            {data.positionCategory ?? "—"}
          </div>
        </div>
      );
    case "pr":
      return (
        <div
          style={{
            display: "flex",
            backgroundColor: PALETTE.prBg,
            borderRadius: "999px",
            padding: "12px 28px",
          }}
        >
          <div style={{ fontSize: "24px", fontWeight: 700, color: PALETTE.prText, letterSpacing: "0.5px" }}>
            🎉 Nuevo PR
          </div>
        </div>
      );
    case "dorsal":
      return (
        <div style={{ ...panelStyle, backgroundColor: PALETTE.primary }}>
          <div style={{ ...labelStyle, color: "rgba(255,255,255,0.85)" }}>Dorsal</div>
          <div style={{ fontSize: "72px", fontWeight: 700, fontFamily: "JetBrains Mono", color: "white" }}>
            {data.dorsalNumber ?? "—"}
          </div>
        </div>
      );
    case "raceNameDate":
      return (
        <div style={panelStyle}>
          <div style={{ fontSize: "28px", fontWeight: 700, color: PALETTE.ink }}>{data.raceName ?? "—"}</div>
          <div style={{ fontSize: "18px", color: PALETTE.muted, marginTop: "4px" }}>{data.raceDate ?? ""}</div>
        </div>
      );
    case "runnerName":
      return (
        <div style={panelStyle}>
          <div style={{ fontSize: "32px", fontWeight: 700, color: PALETTE.ink }}>{data.runnerName ?? "—"}</div>
        </div>
      );
    case "distance":
      return (
        <div style={panelStyle}>
          <div style={{ fontSize: "28px", fontWeight: 700, color: PALETTE.ink }}>{data.distanceLabel ?? "—"}</div>
        </div>
      );
    case "routeMap":
      return (
        <svg width="300" height="300" viewBox="0 0 300 300">
          <path
            d={data.routeSvgPath ?? ""}
            fill="none"
            stroke={PALETTE.accent}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return null;
  }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `lib/sticker-editor/StickerCanvas.tsx`.

- [ ] **Step 3: Commit**

```bash
git add lib/sticker-editor/StickerCanvas.tsx
git commit -m "feat(sticker-editor): componente StickerCanvas con drag/resize y render de campos"
```

---

### Task 9: Función de exportación PNG (`exportStickerToBlob`)

**Files:**
- Create: `lib/sticker-editor/export.ts`

Captura el `<div>` lógico del lienzo (el `canvasRef` de `StickerCanvas`,
NO el wrapper con checkerboard) con `html-to-image`, a resolución completa
1080×1920 (el DOM interno ya está a ese tamaño — no hace falta
`pixelRatio` extra). El checkerboard vive en el wrapper exterior, fuera
del nodo capturado, así que nunca aparece en el PNG.

- [ ] **Step 1: Implementar `lib/sticker-editor/export.ts`**

Crea `lib/sticker-editor/export.ts`:

```ts
// =============================================================================
// mi-dorsal — Exportación del sticker a PNG (client-side)
// =============================================================================
// Captura el nodo del lienzo (StickerCanvas, canvasRef) con html-to-image
// y devuelve un Blob PNG con fondo transparente. El nodo capturado tiene
// las dimensiones lógicas 1080x1920 SIN el transform: scale() de
// visualización ni el checkerboard (ambos viven en el wrapper exterior,
// fuera de canvasRef) — por eso el PNG sale a resolución completa y sin
// el ayudante visual del editor.
// =============================================================================

import { toBlob } from "html-to-image";

export async function exportStickerToBlob(canvasNode: HTMLElement): Promise<Blob> {
  const blob = await toBlob(canvasNode, {
    width: 1080,
    height: 1920,
    backgroundColor: undefined, // mantiene transparencia
    pixelRatio: 1,
  });
  if (!blob) {
    throw new Error("No se pudo generar el PNG del sticker");
  }
  return blob;
}

/** Dispara la descarga local de un Blob en el navegador, sin depender de
 *  que la subida a Convex Storage haya terminado. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `lib/sticker-editor/export.ts`. Si aparece
`Cannot find module 'html-to-image'`, revisa que la Task 7 (instalación)
se completó correctamente (`npm install html-to-image@1.11.13`).

- [ ] **Step 3: Commit**

```bash
git add lib/sticker-editor/export.ts
git commit -m "feat(sticker-editor): exportación del lienzo a PNG con html-to-image"
```

---

### Task 10: Paneles de plantillas y propiedades

**Files:**
- Create: `lib/sticker-editor/TemplatePanel.tsx`
- Create: `lib/sticker-editor/PropertiesPanel.tsx`

Dos componentes de presentación puros (reciben datos y callbacks por
props, sin `useQuery`/`useMutation` propios) para poder reutilizarlos tanto
en el layout de columnas de desktop como dentro de un bottom sheet en
móvil (spec: mismo contenido, contenedor distinto).

- [ ] **Step 1: Implementar `lib/sticker-editor/TemplatePanel.tsx`**

Crea `lib/sticker-editor/TemplatePanel.tsx`:

```tsx
// =============================================================================
// mi-dorsal — TemplatePanel
// =============================================================================
// Lista de plantillas seleccionables (predefinidas + "Mi plantilla" si el
// usuario tiene una guardada) y el botón "Guardar como mi plantilla".
// Componente de presentación puro — el layout que lo envuelve (columna
// fija en desktop, bottom sheet en móvil) decide el contenedor.
// =============================================================================

"use client";

import { STICKER_TEMPLATES, type StickerTemplateId } from "./templates";
import { Sparkles, Save } from "lucide-react";

interface TemplatePanelProps {
  activeTemplateId: StickerTemplateId;
  hasCustomTemplate: boolean;
  onSelectTemplate: (id: StickerTemplateId) => void;
  onSelectCustomTemplate: () => void;
  onSaveCustomTemplate: () => void;
  isSaving: boolean;
}

export function TemplatePanel({
  activeTemplateId,
  hasCustomTemplate,
  onSelectTemplate,
  onSelectCustomTemplate,
  onSaveCustomTemplate,
  isSaving,
}: TemplatePanelProps) {
  const predefinedIds = Object.keys(STICKER_TEMPLATES) as StickerTemplateId[];

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1">
        Plantillas
      </div>
      {predefinedIds.map((id) => (
        <button
          key={id}
          onClick={() => onSelectTemplate(id)}
          className={`text-left px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
            activeTemplateId === id
              ? "border-runner-primary bg-red-50 text-runner-primary"
              : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
          }`}
        >
          {STICKER_TEMPLATES[id].label}
        </button>
      ))}

      <button
        onClick={onSelectCustomTemplate}
        disabled={!hasCustomTemplate}
        className={`text-left px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1.5 ${
          !hasCustomTemplate
            ? "border-dashed border-stone-300 text-stone-400 cursor-not-allowed"
            : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
        }`}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Mi plantilla
      </button>

      <button
        onClick={onSaveCustomTemplate}
        disabled={isSaving}
        className="btn-secondary mt-2 flex items-center gap-1.5 justify-center text-sm disabled:opacity-50"
      >
        <Save className="h-3.5 w-3.5" />
        {isSaving ? "Guardando..." : "Guardar como mi plantilla"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Implementar `lib/sticker-editor/PropertiesPanel.tsx`**

Crea `lib/sticker-editor/PropertiesPanel.tsx`:

```tsx
// =============================================================================
// mi-dorsal — PropertiesPanel
// =============================================================================
// Dos modos:
//   - Si hay un elemento seleccionado: toggle "Mostrar", slider de tamaño.
//   - Si no hay selección: lista de campos disponibles NO visibles todavía,
//     con botón "+ Añadir" por cada uno (spec: "Sin datos para un campo" —
//     `availableFieldIds` ya viene filtrado por getAvailableFields, así que
//     este componente no decide disponibilidad, solo visibilidad actual).
// =============================================================================

"use client";

import { FIELD_CATALOG, type StickerFieldId } from "./fields";
import type { StickerElementLayout } from "./templates";
import { Eye, EyeOff, Plus } from "lucide-react";

interface PropertiesPanelProps {
  selectedElement: StickerElementLayout | null;
  availableFieldIds: StickerFieldId[];
  activeFieldIds: StickerFieldId[];
  onToggleVisible: (fieldId: StickerFieldId) => void;
  onScaleChange: (fieldId: StickerFieldId, scale: number) => void;
  onAddField: (fieldId: StickerFieldId) => void;
}

export function PropertiesPanel({
  selectedElement,
  availableFieldIds,
  activeFieldIds,
  onToggleVisible,
  onScaleChange,
  onAddField,
}: PropertiesPanelProps) {
  if (selectedElement) {
    const def = FIELD_CATALOG[selectedElement.fieldId];
    return (
      <div className="flex flex-col gap-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          {def.label}
        </div>
        <button
          onClick={() => onToggleVisible(selectedElement.fieldId)}
          className="btn-secondary flex items-center gap-1.5 justify-center text-sm"
        >
          {selectedElement.visible ? (
            <>
              <Eye className="h-3.5 w-3.5" /> Visible
            </>
          ) : (
            <>
              <EyeOff className="h-3.5 w-3.5" /> Oculto
            </>
          )}
        </button>
        <div>
          <label className="text-xs font-medium text-stone-600 mb-1 block">
            Tamaño
          </label>
          <input
            type="range"
            min={0.3}
            max={3}
            step={0.05}
            value={selectedElement.scale}
            onChange={(e) => onScaleChange(selectedElement.fieldId, Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>
    );
  }

  const notYetVisible = availableFieldIds.filter((id) => !activeFieldIds.includes(id));

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1">
        Añadir dato
      </div>
      {notYetVisible.length === 0 ? (
        <p className="text-xs text-stone-400">Todos los datos disponibles ya están en el lienzo.</p>
      ) : (
        notYetVisible.map((fieldId) => (
          <button
            key={fieldId}
            onClick={() => onAddField(fieldId)}
            className="text-left px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm text-stone-700 hover:bg-stone-50 flex items-center justify-between"
          >
            {FIELD_CATALOG[fieldId].label}
            <Plus className="h-3.5 w-3.5 text-stone-400" />
          </button>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `TemplatePanel.tsx` ni `PropertiesPanel.tsx`.

- [ ] **Step 4: Commit**

```bash
git add lib/sticker-editor/TemplatePanel.tsx lib/sticker-editor/PropertiesPanel.tsx
git commit -m "feat(sticker-editor): paneles de plantillas y propiedades"
```

---

## Fase 4 — Páginas Next.js

### Task 11: Página `/editor-sticker/[myRaceId]`

**Files:**
- Create: `app/editor-sticker/[myRaceId]/page.tsx`
- Create: `app/editor-sticker/[myRaceId]/client.tsx`

`page.tsx` es un wrapper mínimo que solo lee el param de ruta y delega en
el client component (patrón exacto de `app/resultado/[myRaceId]/`). Todo
el estado y la lógica de UI viven en `client.tsx`.

- [ ] **Step 1: Crear `app/editor-sticker/[myRaceId]/page.tsx`**

```tsx
import { EditorStickerClient } from "./client";

export default async function EditorStickerPage({
  params,
}: {
  params: Promise<{ myRaceId: string }>;
}) {
  const { myRaceId } = await params;
  return <EditorStickerClient myRaceId={myRaceId} />;
}
```

- [ ] **Step 2: Crear `app/editor-sticker/[myRaceId]/client.tsx`**

```tsx
"use client";

// =============================================================================
// mi-dorsal — /editor-sticker/{myRaceId}
// =============================================================================
// Editor visual del sticker personalizado (feature premium). Gate premium
// client-side (mismo patrón que app/admin/layout.tsx: useHasPremium() +
// useEffect + router.push, sin redirect() de servidor). Layout responsive:
// 3 columnas fijas en desktop, bottom sheets en móvil (ver spec).
// =============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { isMockMode } from "@/lib/mock/provider";
import { useToast } from "@/components/ui/toast";
import { formatTime, formatPace, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Download, Loader2 } from "lucide-react";

import { StickerCanvas, CANVAS_WIDTH } from "@/lib/sticker-editor/StickerCanvas";
import { TemplatePanel } from "@/lib/sticker-editor/TemplatePanel";
import { PropertiesPanel } from "@/lib/sticker-editor/PropertiesPanel";
import { STICKER_TEMPLATES, applyTemplate, type StickerTemplateId, type StickerElementLayout } from "@/lib/sticker-editor/templates";
import { getAvailableFields, type StickerData, type StickerFieldId } from "@/lib/sticker-editor/fields";
import { decodePolyline, polylineToSvgPath } from "@/lib/sticker-editor/polyline";
import { exportStickerToBlob, downloadBlob } from "@/lib/sticker-editor/export";

export function EditorStickerClient({ myRaceId }: { myRaceId: string }) {
  const useMock = isMockMode();
  const router = useRouter();
  const toast = useToast();

  // OJO: usamos la query cruda (no el hook useHasPremium) porque ese hook
  // colapsa el estado "cargando" (undefined) a `hasAccess: false` para
  // evitar parpadeos en UI que solo MUESTRAN el badge premium — aquí
  // necesitamos distinguir "aún cargando" de "confirmado free" para no
  // redirigir de golpe a un usuario premium cuya query todavía no resolvió
  // (mismo motivo por el que app/admin/layout.tsx comprueba
  // `myProfile !== undefined` en vez de usar un hook que ya colapse eso).
  const premiumStatus = useMock ? undefined : useQuery(api.subscriptions.getMyPremiumStatus, {});
  const isLoaded = useMock || premiumStatus !== undefined;
  const hasAccess = premiumStatus?.hasAccess ?? false;

  const editorData = useMock
    ? null
    : useQuery(api.stickerEditor.getEditorData, { myRaceId: myRaceId as Id<"myRaces"> });
  const saveCustomTemplate = useMutation(api.stickerEditor.saveCustomTemplate);
  const generateUploadUrl = useMutation(api.stickerEditor.generateUploadUrl);
  const attachCustomSticker = useMutation(api.stickerEditor.attachCustomSticker);

  const [templateId, setTemplateId] = useState<StickerTemplateId>("classic");
  const [usingCustomTemplate, setUsingCustomTemplate] = useState(false);
  const [elements, setElements] = useState<StickerElementLayout[]>(STICKER_TEMPLATES.classic.elements);
  const [selectedFieldId, setSelectedFieldId] = useState<StickerFieldId | null>(null);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  // Bottom sheet activo en móvil (spec: "Responsive real" — paneles ocultos
  // por defecto en <768px, se abren a demanda). null = ningún sheet abierto.
  const [mobileSheet, setMobileSheet] = useState<"templates" | "properties" | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Gate premium: mismo patrón que app/admin/layout.tsx (useEffect +
  // router.push tras confirmar que la query resolvió, nunca redirect()
  // de servidor).
  useEffect(() => {
    if (useMock) return;
    if (isLoaded && !hasAccess) {
      router.push("/premium");
    }
  }, [useMock, isLoaded, hasAccess, router]);

  // Precarga inicial: plantilla propia si existe, si no "classic".
  useEffect(() => {
    if (!editorData?.customStickerTemplate) return;
    setUsingCustomTemplate(true);
    setElements(editorData.customStickerTemplate.elements as StickerElementLayout[]);
  }, [editorData?.customStickerTemplate]);

  const data: StickerData | null = useMemo(() => {
    if (!editorData) return null;
    const distanceM = Math.round(editorData.race.distanceKm * 1000);
    const routeSvgPath = editorData.mapPolyline
      ? polylineToSvgPath(decodePolyline(editorData.mapPolyline), 300)
      : undefined;
    return {
      timeFormatted: editorData.myRace.actualTimeSeconds != null ? formatTime(editorData.myRace.actualTimeSeconds) : undefined,
      paceFormatted:
        editorData.myRace.actualTimeSeconds != null
          ? formatPace(editorData.myRace.actualTimeSeconds / Math.max(editorData.race.distanceKm, 0.001))
          : undefined,
      positionOverall: editorData.myRace.actualPosition,
      positionCategory: editorData.myRace.actualPositionCategory,
      isPersonalRecord:
        editorData.currentPR != null &&
        editorData.myRace.actualTimeSeconds != null &&
        editorData.myRace.actualTimeSeconds < editorData.currentPR.timeSeconds,
      dorsalNumber: editorData.myRace.dorsalNumber,
      raceName: editorData.race.name,
      raceDate: formatDate(editorData.race.startDate),
      runnerName: editorData.runnerName,
      distanceLabel: editorData.race.distanceLabel,
      routeSvgPath,
    };
  }, [editorData]);

  const availableFieldIds = useMemo(() => (data ? getAvailableFields(data) : []), [data]);
  const activeFieldIds = useMemo(() => elements.filter((e) => e.visible).map((e) => e.fieldId), [elements]);
  const selectedElement = elements.find((e) => e.fieldId === selectedFieldId) ?? null;

  function handleSelectTemplate(id: StickerTemplateId) {
    setTemplateId(id);
    setUsingCustomTemplate(false);
    setElements(applyTemplate(id, activeFieldIds).elements);
    setSelectedFieldId(null);
  }

  function handleSelectCustomTemplate() {
    if (!editorData?.customStickerTemplate) return;
    setUsingCustomTemplate(true);
    setElements(editorData.customStickerTemplate.elements as StickerElementLayout[]);
    setSelectedFieldId(null);
  }

  function handleMove(fieldId: StickerFieldId, x: number, y: number) {
    setElements((prev) => prev.map((el) => (el.fieldId === fieldId ? { ...el, x, y } : el)));
  }

  function handleResize(fieldId: StickerFieldId, scale: number) {
    setElements((prev) => prev.map((el) => (el.fieldId === fieldId ? { ...el, scale } : el)));
  }

  function handleToggleVisible(fieldId: StickerFieldId) {
    setElements((prev) =>
      prev.map((el) => (el.fieldId === fieldId ? { ...el, visible: !el.visible } : el)),
    );
  }

  function handleAddField(fieldId: StickerFieldId) {
    const existing = elements.find((el) => el.fieldId === fieldId);
    if (existing) {
      handleToggleVisible(fieldId);
    } else {
      setElements((prev) => [...prev, { fieldId, visible: true, x: 0.5, y: 0.65, scale: 1 }]);
    }
    setSelectedFieldId(fieldId);
  }

  async function handleSaveTemplate() {
    setIsSavingTemplate(true);
    try {
      await saveCustomTemplate({
        baseTemplateId: templateId,
        elements,
      });
      toast.show({ title: "Plantilla guardada", variant: "success" });
    } catch (e: any) {
      toast.show({ title: "No se pudo guardar la plantilla", description: e?.message, variant: "warning" });
    } finally {
      setIsSavingTemplate(false);
    }
  }

  async function handleExport() {
    if (!canvasRef.current) return;
    setIsExporting(true);
    try {
      const blob = await exportStickerToBlob(canvasRef.current);
      downloadBlob(blob, `mi-dorsal-sticker-${myRaceId}.png`);

      try {
        const uploadUrl = await generateUploadUrl({});
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": "image/png" },
          body: blob,
        });
        const { storageId } = await uploadRes.json();
        await attachCustomSticker({ myRaceId: myRaceId as Id<"myRaces">, storageId });
        toast.show({ title: "Sticker descargado y guardado", variant: "success" });
      } catch (uploadErr: any) {
        // La descarga local ya ocurrió — solo avisamos que no se pudo persistir.
        toast.show({
          title: "Descargado, pero no se pudo guardar en tu cuenta",
          description: uploadErr?.message,
          variant: "warning",
        });
      }
    } catch (e: any) {
      toast.show({ title: "No se pudo exportar el sticker", description: e?.message, variant: "warning" });
    } finally {
      setIsExporting(false);
    }
  }

  if (useMock) {
    return (
      <div className="p-8 text-center text-stone-500">
        Editor de sticker no disponible en modo mock.
      </div>
    );
  }

  const canRender = useMock || (isLoaded && hasAccess);
  if (!canRender) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
      </div>
    );
  }

  if (editorData === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
      </div>
    );
  }

  if (editorData === null || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 text-center">
        <p className="text-stone-600">No se encontró esta carrera o no tienes acceso.</p>
        <Link href="/mi-sticker" className="text-runner-primary hover:underline text-sm mt-2 inline-block">
          Volver a mis carreras
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-white">
        <Link href={`/resultado/${myRaceId}`} className="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-runner-primary">
          <ArrowLeft className="h-4 w-4" />
          {editorData.race.name}
        </Link>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50"
        >
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Descargar PNG
        </button>
      </header>

      {/* Layout: 3 columnas fijas en desktop (md+). En móvil, el lienzo
          ocupa toda la pantalla y los paneles viven en bottom sheets
          (spec: "Responsive real" — no basta apilar, hay que ocultar los
          paneles hasta que el usuario los abre explícitamente). */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 max-w-6xl mx-auto w-full">
        {/* Paneles: columna fija en desktop, ocultos en móvil (se muestran vía bottom sheet) */}
        <aside className="hidden md:block md:w-40 flex-shrink-0">
          <TemplatePanel
            activeTemplateId={templateId}
            hasCustomTemplate={!!editorData.customStickerTemplate}
            onSelectTemplate={handleSelectTemplate}
            onSelectCustomTemplate={handleSelectCustomTemplate}
            onSaveCustomTemplate={handleSaveTemplate}
            isSaving={isSavingTemplate}
          />
        </aside>

        <div className="flex-1 flex items-center justify-center">
          <StickerCanvas
            elements={elements}
            data={data}
            selectedFieldId={selectedFieldId}
            onSelect={setSelectedFieldId}
            onMove={handleMove}
            onResize={handleResize}
            displayWidth={Math.min(320, CANVAS_WIDTH)}
            canvasRef={canvasRef}
          />
        </div>

        <aside className="hidden md:block md:w-48 flex-shrink-0">
          <PropertiesPanel
            selectedElement={selectedElement}
            availableFieldIds={availableFieldIds}
            activeFieldIds={activeFieldIds}
            onToggleVisible={handleToggleVisible}
            onScaleChange={handleResize}
            onAddField={handleAddField}
          />
        </aside>
      </div>

      {/* Barra inferior móvil: abre cada panel como bottom sheet.
          Oculta en desktop (md:hidden) porque ahí los paneles ya son
          columnas visibles siempre. */}
      <div className="md:hidden flex border-t border-stone-200 bg-white">
        <button
          onClick={() => setMobileSheet("templates")}
          className="flex-1 py-3 text-sm font-medium text-stone-700 border-r border-stone-200"
        >
          Plantillas
        </button>
        <button
          onClick={() => setMobileSheet("properties")}
          className="flex-1 py-3 text-sm font-medium text-stone-700"
        >
          {selectedElement ? "Propiedades" : "+ Añadir dato"}
        </button>
      </div>

      {mobileSheet && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileSheet(null)}
          />
          <div className="relative bg-white rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-center mb-2">
              <div className="w-10 h-1 rounded-full bg-stone-300" />
            </div>
            {mobileSheet === "templates" ? (
              <TemplatePanel
                activeTemplateId={templateId}
                hasCustomTemplate={!!editorData.customStickerTemplate}
                onSelectTemplate={(id) => {
                  handleSelectTemplate(id);
                  setMobileSheet(null);
                }}
                onSelectCustomTemplate={() => {
                  handleSelectCustomTemplate();
                  setMobileSheet(null);
                }}
                onSaveCustomTemplate={handleSaveTemplate}
                isSaving={isSavingTemplate}
              />
            ) : (
              <PropertiesPanel
                selectedElement={selectedElement}
                availableFieldIds={availableFieldIds}
                activeFieldIds={activeFieldIds}
                onToggleVisible={handleToggleVisible}
                onScaleChange={handleResize}
                onAddField={(fieldId) => {
                  handleAddField(fieldId);
                  setMobileSheet(null);
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `app/editor-sticker/[myRaceId]/client.tsx`.

- [ ] **Step 4: Arrancar el dev server y probar manualmente**

Run: `npm run dev` (déjalo corriendo en background si tu entorno lo permite).

Abre en el navegador `http://localhost:3000/editor-sticker/<UNA_MY_RACE_ID_REAL_CON_RESULTADO>`
con una cuenta premium (o admin/test, que bypassean el gate). Verifica:
- El lienzo aparece centrado con checkerboard de fondo y los elementos de
  la plantilla "Clásica" ya posicionados.
- Arrastrar el tiempo con el mouse lo mueve.
- Seleccionarlo y arrastrar el handle verde (esquina inferior derecha) lo
  redimensiona.
- Cambiar a "Minimal" resetea posiciones pero conserva qué campos estaban
  activos.
- "+ Añadir dato" en el panel de propiedades (sin selección) añade un
  campo nuevo al lienzo.
- "Descargar PNG" dispara una descarga en el navegador con fondo
  transparente (comprobar abriendo el PNG descargado en un editor de
  imágenes o arrastrándolo sobre un fondo oscuro).

Con las DevTools en modo responsive (~375px de ancho, ej. iPhone SE) o en
un móvil real:
- Los paneles laterales de plantillas/propiedades NO son visibles como
  columnas — el lienzo ocupa el ancho disponible.
- Aparece una barra inferior con "Plantillas" y "+ Añadir dato"/"Propiedades".
- Tocar "Plantillas" abre un bottom sheet deslizándose desde abajo con las
  3 plantillas + "Mi plantilla" + "Guardar como mi plantilla"; tocar fuera
  del sheet (el overlay oscuro) lo cierra.
- Tocar un elemento del lienzo y luego "Propiedades" en la barra inferior
  abre el bottom sheet con el toggle de visibilidad y el slider de tamaño
  de ESE elemento.
- Arrastrar un elemento con el dedo (touch) lo mueve igual que con el mouse
  en desktop.

Con una cuenta free (rol `user` sin suscripción premium): verificar que la
página muestra el loader brevemente y luego redirige a `/premium`.

- [ ] **Step 5: Commit**

```bash
git add "app/editor-sticker/[myRaceId]/page.tsx" "app/editor-sticker/[myRaceId]/client.tsx"
git commit -m "feat(sticker-editor): página /editor-sticker/{myRaceId} con gate premium y layout responsive"
```

---

### Task 12: Página `/mi-sticker` (segundo punto de entrada)

**Files:**
- Create: `app/mi-sticker/page.tsx`
- Create: `app/mi-sticker/client.tsx`

Lista las carreras completadas del usuario (`myRaces.listMine({status:
"done"})`, filtrando las que tienen `actualTimeSeconds`), cada una con
link a `/editor-sticker/{myRaceId}`. Mismo gate premium que la Task 11.

- [ ] **Step 1: Crear `app/mi-sticker/page.tsx`**

```tsx
import { MiStickerClient } from "./client";

export default function MiStickerPage() {
  return <MiStickerClient />;
}
```

- [ ] **Step 2: Crear `app/mi-sticker/client.tsx`**

```tsx
"use client";

// =============================================================================
// mi-dorsal — /mi-sticker
// =============================================================================
// Segundo punto de entrada al editor de sticker (el primero es el botón
// "Personalizar sticker" en /resultado/{myRaceId} — ver Task 13). Aquí el
// usuario elige de su historial qué carrera personalizar. Mismo gate
// premium client-side que /editor-sticker/{myRaceId}.
// =============================================================================

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import { formatTime, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";

export function MiStickerClient() {
  const useMock = isMockMode();
  const router = useRouter();

  const premiumStatus = useMock ? undefined : useQuery(api.subscriptions.getMyPremiumStatus, {});
  const isLoaded = useMock || premiumStatus !== undefined;
  const hasAccess = premiumStatus?.hasAccess ?? false;

  const myRaces = useMock ? null : useQuery(api.myRaces.listMine, { status: "done" });
  const completedRaces = (myRaces ?? []).filter((r) => r.actualTimeSeconds != null);

  useEffect(() => {
    if (useMock) return;
    if (isLoaded && !hasAccess) {
      router.push("/premium");
    }
  }, [useMock, isLoaded, hasAccess, router]);

  const canRender = useMock || (isLoaded && hasAccess);
  if (!canRender) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-runner-primary mb-4">
        <ArrowLeft className="h-4 w-4" />
        Inicio
      </Link>

      <h1 className="text-2xl font-bold text-runner-dark mb-1 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-runner-primary" />
        Personaliza tu sticker
      </h1>
      <p className="text-sm text-stone-600 mb-6">
        Elige una carrera para editar su sticker de Stories.
      </p>

      {myRaces === undefined ? (
        <div className="space-y-2">
          <div className="h-16 bg-stone-100 rounded-lg animate-pulse" />
          <div className="h-16 bg-stone-100 rounded-lg animate-pulse" />
        </div>
      ) : completedRaces.length === 0 ? (
        <div className="card text-center text-sm text-stone-500">
          Todavía no tienes carreras completadas con resultado.
        </div>
      ) : (
        <div className="space-y-2">
          {completedRaces.map((myRace) => (
            <Link
              key={myRace._id}
              href={`/editor-sticker/${myRace._id}`}
              className="card flex items-center justify-between hover:border-runner-primary transition-colors"
            >
              <div>
                <div className="text-sm font-semibold text-stone-800">{myRace.race?.name ?? "Carrera"}</div>
                <div className="text-xs text-stone-500 mt-0.5">
                  {myRace.race?.startDate ? formatDate(myRace.race.startDate) : ""}
                  {myRace.actualTimeSeconds != null ? ` · ${formatTime(myRace.actualTimeSeconds)}` : ""}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `app/mi-sticker/page.tsx` ni `app/mi-sticker/client.tsx`.

- [ ] **Step 4: Probar manualmente**

Con el dev server corriendo, abre `http://localhost:3000/mi-sticker` con
una cuenta premium: debe listar las carreras completadas y cada una debe
enlazar a su editor. Con una cuenta free, debe redirigir a `/premium`.

- [ ] **Step 5: Commit**

```bash
git add app/mi-sticker/page.tsx app/mi-sticker/client.tsx
git commit -m "feat(sticker-editor): página /mi-sticker para elegir carrera a personalizar"
```

---

### Task 13: Botón "Personalizar sticker" en `/resultado/[myRaceId]`

**Files:**
- Modify: `app/resultado/[myRaceId]/client.tsx`

Añade el primer punto de entrada al editor (spec sección 7). El botón es
visible para cualquier usuario (no solo premium) — el gate premium vive en
la página del editor, no aquí; free simplemente será redirigido a
`/premium` al hacer click y llegar a `/editor-sticker/{myRaceId}`.

- [ ] **Step 1: Importar el icono `Sparkles`**

En `app/resultado/[myRaceId]/client.tsx:22-33`, el bloque de imports de
`lucide-react` ya incluye `Instagram` (línea 32). Añade `Sparkles`:

```tsx
import {
  Trophy,
  Download,
  Share2,
  ExternalLink,
  ArrowLeft,
  MapPin,
  Calendar,
  Hash,
  TrendingDown,
  Check,
  Instagram,
  Sparkles,
} from "lucide-react";
```

- [ ] **Step 2: Añadir el botón justo después del bloque `{hasSticker && (...)}`**

En `app/resultado/[myRaceId]/client.tsx`, localiza el bloque existente
(línea ~259-268):

```tsx
          {hasSticker && (
            <a
              href={stickerUrl}
              download={`mi-dorsal-story-${myRaceId}.png`}
              className="btn bg-white border border-runner-primary text-runner-primary hover:bg-red-50 inline-flex items-center gap-1.5"
            >
              <Instagram className="h-4 w-4" />
              Descargar para Stories
            </a>
          )}
```

Justo después de ese bloque (antes del botón "Compartir" que sigue en el
archivo), añade:

```tsx
          <Link
            href={`/editor-sticker/${myRaceId}`}
            className="btn bg-white border border-runner-primary text-runner-primary hover:bg-red-50 inline-flex items-center gap-1.5"
          >
            <Sparkles className="h-4 w-4" />
            Personalizar sticker
          </Link>
```

`Link` ya está importado en este archivo (línea 35: `import Link from
"next/link";`), no requiere import nuevo.

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `app/resultado/[myRaceId]/client.tsx`.

- [ ] **Step 4: Probar manualmente**

Con el dev server corriendo, abre `http://localhost:3000/resultado/<UNA_MY_RACE_ID_REAL>`
y verifica que aparece el botón "Personalizar sticker" junto a los demás
botones de descarga, y que al hacer click navega a
`/editor-sticker/<esa misma myRaceId>`.

- [ ] **Step 5: Commit**

```bash
git add "app/resultado/[myRaceId]/client.tsx"
git commit -m "feat(sticker-editor): botón 'Personalizar sticker' en la página de resultado"
```

---

## Fase 5 — Verificación final end-to-end

### Task 14: Verificación completa del flujo

**Files:** ninguno nuevo — solo verificación manual + regresión.

- [ ] **Step 1: Ejecutar todos los tests de lógica pura**

Run:
```bash
npx tsx scripts/test-sticker-polyline.ts && \
npx tsx scripts/test-sticker-fields.ts && \
npx tsx scripts/test-sticker-templates.ts
```
Expected: los 3 scripts terminan con `✓ TODOS PASAN` y exit code 0.

- [ ] **Step 2: Type-check completo del proyecto**

Run: `npx tsc --noEmit`
Expected: 0 errores (o solo los que ya existían antes de este plan — si
hay dudas, compara con `git stash` + `npx tsc --noEmit` en la rama base).

- [ ] **Step 3: Deploy de Convex a dev y verificar funciones**

Run: `npx convex dev --once`
Expected: sin errores, y `npx convex dev` (dashboard o CLI) muestra
`stickerEditor:getEditorData`, `stickerEditor:saveCustomTemplate`,
`stickerEditor:generateUploadUrl`, `stickerEditor:attachCustomSticker`,
`stickerEditor:getMyRaceForCustomSticker` en el listado de funciones.

- [ ] **Step 4: Flujo end-to-end manual con una cuenta premium**

Con `npm run dev` corriendo y una cuenta con rol `admin` o `test` (bypass
premium) o una suscripción premium real activa:

1. Ir a `/resultado/{myRaceId}` de una carrera completada → click en
   "Personalizar sticker" → llega a `/editor-sticker/{myRaceId}`.
2. Cambiar entre las 3 plantillas, comprobar que los campos que estaban
   activos siguen activos al cambiar.
3. Mover el elemento "Tiempo" arrastrándolo con el mouse.
4. Seleccionarlo y arrastrar el handle verde para redimensionarlo.
5. Si la carrera tiene una actividad Strava vinculada con `mapPolyline`,
   añadir el campo "Silueta de la ruta" y comprobar que dibuja una línea
   (no vacío).
6. Pulsar "Guardar como mi plantilla" → toast de confirmación.
7. Ir a `/mi-sticker`, abrir OTRA carrera distinta → comprobar que se
   precarga automáticamente "Mi plantilla" (no "Clásica").
8. Pulsar "Descargar PNG" → se descarga un archivo en el navegador.
9. Abrir el PNG descargado (o arrastrarlo sobre un fondo oscuro en el
   propio SO) → confirmar que el fondo es transparente, no blanco/negro.
10. Recargar `/editor-sticker/{myRaceId}` de la primera carrera → verificar
    en el dashboard de Convex que `myRaces.customStickerStorageId` tiene un
    valor para esa fila.
11. Visitar `/api/result/{myRaceId}/custom-sticker.png` directamente en el
    navegador → debe mostrar el PNG (no el placeholder 404).

- [ ] **Step 5: Verificar el gate premium con una cuenta free**

Con una cuenta sin premium ni rol admin/test:
1. Ir a `/editor-sticker/{myRaceId}` directamente por URL → debe mostrar
   un loader breve y terminar en `/premium`.
2. Ir a `/mi-sticker` directamente por URL → mismo comportamiento.

- [ ] **Step 6: Confirmar que nada existente se rompió**

Verifica que el sticker automático fijo sigue funcionando sin cambios:
1. Ve a `/resultado/{myRaceId}` de una carrera con resultado ya publicado
   hace tiempo → el botón "Descargar para Stories" (icono Instagram, el
   YA EXISTENTE, distinto del nuevo "Personalizar sticker") sigue
   funcionando y descarga el PNG fijo automático.
2. Confirma visualmente que ambos botones ("Descargar para Stories" y
   "Personalizar sticker") aparecen juntos, sin solaparse ni romper el
   layout en móvil (ancho ~375px) y desktop.

- [ ] **Step 7: Commit final (si hubo ajustes durante la verificación)**

Si algún paso de verificación requirió tocar código, haz un commit
separado describiendo el fix concreto — no agrupes fixes de verificación
con las tasks anteriores ya commiteadas.

```bash
git status
# Si hay cambios sin commitear tras la verificación:
git add -A
git commit -m "fix(sticker-editor): ajustes tras verificación end-to-end"
```

# Selección de distancia en carreras multi-modalidad — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que un usuario elija, al añadir una carrera multi-modalidad (ej. "Media Maratón de Albacete" con 10K y 21K) a su calendario, la distancia que realmente va a correr — y que esa elección (no la distancia "principal" de la carrera) alimente la predicción, el PR, el diploma, los emails y el filtro del catálogo.

**Architecture:** `myRaces` gana 3 campos snapshot opcionales (`selectedDistanceKm/Label/ElevationGainM`). Un helper puro `getEffectiveDistance(myRace, race)` centraliza el fallback a `race.distanceKm` cuando no hay selección. Un selector de modalidad (nuevo componente) se usa tanto al añadir la carrera como al editarla después desde el calendario. Se corrigen 5 puntos backend que hoy leen `race.distanceKm` directamente para que usen la distancia efectiva. El filtro de `/carreras` se amplía para mirar también `race.raceFormats`.

**Tech Stack:** Next.js 15 (App Router) + TypeScript, Convex (schema/mutations/queries), Tailwind. Sin test runner en el repo — verificación vía `tsc --noEmit`, `npm run build`, `npx convex run` y pruebas manuales en navegador.

**Spec de referencia:** `docs/superpowers/specs/2026-09-09-multi-distancia-carreras-design.md`

**Convenciones del repo a respetar en cada tarea:**
- Pre-deploy checklist (`docs/core/deploy-checklist.md`): `npx tsc --noEmit` → `npm run build` → commit selectivo (nunca `git add -A` sin `git status`) → push.
- Naming: español para dominio (`distanciaSeleccionada` en copy/UI), inglés para código (`selectedDistanceKm`).
- `any` tolerado en boundaries con Convex, tipar el resto.

---

## Task 1: Schema — nuevos campos en `myRaces`

**Files:**
- Modify: `convex/schema.ts:437-477` (tabla `myRaces`)

- [ ] **Step 1: Añadir los 3 campos opcionales a la tabla `myRaces`**

En `convex/schema.ts`, dentro de `myRaces: defineTable({ ... })` (línea ~437), justo después de `category: v.optional(v.string()),` (línea ~449), añade:

```ts
    // Snapshot de la modalidad/distancia que el usuario eligió al añadir
    // la carrera (o al editarla después). Copia de datos, NO referencia a
    // un índice de race.raceFormats — así, si el admin re-extrae o edita
    // las modalidades de la carrera más tarde, esta inscripción no se ve
    // afectada. undefined = usuario no eligió (carrera sin raceFormats, o
    // fila creada antes de este cambio) → toda lectura debe caer de vuelta
    // a race.distanceKm (ver lib/prediction/effective-distance.ts).
    selectedDistanceKm: v.optional(v.number()),
    selectedDistanceLabel: v.optional(v.string()),
    selectedElevationGainM: v.optional(v.number()),
```

El bloque completo de la tabla debe quedar así (sin tocar los índices, que van después):

```ts
  myRaces: defineTable({
    userId: v.id("profiles"),
    raceId: v.id("races"),
    dorsalNumber: v.optional(v.string()),
    registrationDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.union(
      v.literal("planned"),
      v.literal("done"),
      v.literal("dns"),
      v.literal("dnf"),
    ),
    category: v.optional(v.string()),
    // Snapshot de la modalidad/distancia que el usuario eligió al añadir
    // la carrera (o al editarla después). Copia de datos, NO referencia a
    // un índice de race.raceFormats — así, si el admin re-extrae o edita
    // las modalidades de la carrera más tarde, esta inscripción no se ve
    // afectada. undefined = usuario no eligió (carrera sin raceFormats, o
    // fila creada antes de este cambio) → toda lectura debe caer de vuelta
    // a race.distanceKm (ver lib/prediction/effective-distance.ts).
    selectedDistanceKm: v.optional(v.number()),
    selectedDistanceLabel: v.optional(v.string()),
    selectedElevationGainM: v.optional(v.number()),
    predictedTimeSeconds: v.optional(v.number()),
    predictionConfidence: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
    )),
    predictionFactors: v.optional(v.any()),
    actualTimeSeconds: v.optional(v.number()),
    actualPosition: v.optional(v.number()),
    actualPositionCategory: v.optional(v.number()),
    resultSource: v.optional(v.union(
      v.literal("auto_scrape"),
      v.literal("manual"),
    )),
    resultScrapedAt: v.optional(v.number()),
    diplomaStorageId: v.optional(v.id("_storage")),
    shareCardStorageId: v.optional(v.id("_storage")),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_race", ["raceId"])
    .index("by_user_race", ["userId", "raceId"])
    .index("by_user_dorsal", ["userId", "dorsalNumber"])
    .index("by_race_dorsal", ["raceId", "dorsalNumber"])
    .index("by_status", ["status"]),
```

- [ ] **Step 2: Verificar el schema con Convex**

Run: `npx convex dev --once`
Expected: termina sin errores, confirma que el schema se subió (salida tipo `✓ Schema pushed` o similar, sin `Error` en la consola).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errores (los 3 campos son opcionales, no rompen ningún código existente que inserte en `myRaces`).

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(schema): añadir snapshot de distancia seleccionada a myRaces

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Helper puro `getEffectiveDistance`

**Files:**
- Create: `lib/prediction/effective-distance.ts`

- [ ] **Step 1: Crear el helper**

Este helper centraliza la regla de fallback: si el `myRace` tiene una distancia seleccionada, se usa esa; si no, se usa la distancia principal de la carrera. Se usará tanto desde `convex/*.ts` como potencialmente desde componentes (es código puro, sin dependencias de Convex).

Crea `lib/prediction/effective-distance.ts`:

```ts
// =============================================================================
// mi-dorsal — Distancia efectiva de un myRace
// =============================================================================
// Una carrera puede tener varias modalidades (race.raceFormats). El usuario
// elige una al añadirla a su calendario (o la cambia después). Esta función
// es la ÚNICA fuente de verdad para "qué distancia hay que usar" en
// predicción, PR, diploma, emails y la card del calendario.
//
// Regla: si myRace.selectedDistanceKm existe, es la elegida por el usuario.
// Si no (carrera sin raceFormats, o myRace creado antes de este cambio),
// cae de vuelta a race.distanceKm — el comportamiento de siempre.
// =============================================================================

export interface EffectiveDistance {
  distanceKm: number;
  label: string;
  elevationGainM?: number;
}

/** Subset de campos de `myRaces` que este helper necesita. */
export interface MyRaceDistanceFields {
  selectedDistanceKm?: number;
  selectedDistanceLabel?: string;
  selectedElevationGainM?: number;
}

/** Subset de campos de `races` que este helper necesita. */
export interface RaceDistanceFields {
  distanceKm: number;
  elevationGainM?: number;
}

/**
 * Etiqueta legible de una distancia en km. Duplica intencionalmente la
 * lógica de `convex/_helpers.ts` `getDistanceLabel` (que trabaja en metros)
 * porque este archivo es código puro sin imports de Convex — se usa desde
 * `lib/prediction/predict.ts` y potencialmente desde componentes cliente.
 */
export function labelForDistanceKm(distanceKm: number): string {
  const m = Math.round(distanceKm * 1000);
  if (m === 5000) return "5K";
  if (m === 10000) return "10K";
  if (m === 15000) return "15K";
  if (m === 21097 || (m > 20000 && m < 22000)) return "Media maratón";
  if (m === 42195 || (m > 40085 && m < 44305)) return "Maratón";
  if (m === 50000 || (m > 47500 && m < 52500)) return "50K";
  return `${distanceKm.toFixed(distanceKm % 1 === 0 ? 0 : 1)}K`;
}

/**
 * Devuelve la distancia que hay que usar para predicción/PR/diploma/pace
 * de un myRace concreto: la que eligió el usuario, o si no eligió ninguna,
 * la distancia principal de la carrera.
 */
export function getEffectiveDistance(
  myRace: MyRaceDistanceFields,
  race: RaceDistanceFields,
): EffectiveDistance {
  if (myRace.selectedDistanceKm != null) {
    return {
      distanceKm: myRace.selectedDistanceKm,
      label: myRace.selectedDistanceLabel ?? labelForDistanceKm(myRace.selectedDistanceKm),
      elevationGainM: myRace.selectedElevationGainM,
    };
  }
  return {
    distanceKm: race.distanceKm,
    label: labelForDistanceKm(race.distanceKm),
    elevationGainM: race.elevationGainM,
  };
}
```

- [ ] **Step 2: Verificar manualmente con `tsx`**

Run:
```bash
npx tsx -e "
import { getEffectiveDistance, labelForDistanceKm } from './lib/prediction/effective-distance';
console.log(getEffectiveDistance({}, { distanceKm: 21.1 }));
console.log(getEffectiveDistance({ selectedDistanceKm: 10, selectedDistanceLabel: '10K' }, { distanceKm: 21.1 }));
console.log(labelForDistanceKm(10));
console.log(labelForDistanceKm(21.1));
"
```
Expected:
```
{ distanceKm: 21.1, label: 'Media maratón', elevationGainM: undefined }
{ distanceKm: 10, label: '10K', elevationGainM: undefined }
10K
Media maratón
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add lib/prediction/effective-distance.ts
git commit -m "feat(prediction): helper getEffectiveDistance para distancia elegida por el usuario

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `myRaces.add` acepta `selectedDistance`

**Files:**
- Modify: `convex/myRaces.ts:71-170` (mutation `add`)

- [ ] **Step 1: Añadir el argumento `selectedDistance` y usarlo en la predicción**

En `convex/myRaces.ts`, la mutation `add` (línea ~71) recibe hoy `raceId`, `dorsalNumber`, `registrationDate`, `notes`. Añade un argumento opcional `selectedDistance` y pásalo tanto a `predictForMyRace` como al `insert`.

Reemplaza el bloque `args: { ... }` (líneas 72-77):

```ts
  args: {
    raceId: v.id("races"),
    dorsalNumber: v.optional(v.string()),
    registrationDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    selectedDistance: v.optional(v.object({
      distanceKm: v.number(),
      label: v.string(),
      elevationGainM: v.optional(v.number()),
    })),
  },
```

Reemplaza el bloque de cálculo de predicción (líneas ~111-133, desde `let prediction: ReturnType<typeof predictForMyRace> | null = null;` hasta el `catch` que la deja en `null`) para que use la distancia elegida si existe:

```ts
    const effectiveDistanceKm = args.selectedDistance?.distanceKm ?? race.distanceKm;
    const effectiveElevationGainM = args.selectedDistance?.elevationGainM ?? race.elevationGainM;

    let prediction: ReturnType<typeof predictForMyRace> | null = null;
    try {
      prediction = predictForMyRace({
        race: {
          distanceKm: effectiveDistanceKm,
          elevationGainM: effectiveElevationGainM,
          raceType: race.raceType,
          startDate: race.startDate,
        },
        userPRs: prs.map((pr) => ({
          distanceM: pr.distanceM,
          distanceLabel: pr.distanceLabel,
          timeSeconds: pr.timeSeconds,
        })),
        expectedTempC: estimateTempForRace(race.startDate, race.locality),
      });
    } catch (e) {
      // Sin PRs o cualquier error del predictor: añadimos la carrera sin predicción.
      console.warn(
        `[myRaces.add] Sin predicción para raceId=${args.raceId} userId=${user._id}:`,
        e instanceof Error ? e.message : e,
      );
    }
```

Reemplaza el `ctx.db.insert("myRaces", { ... })` (líneas ~135-145) para guardar el snapshot:

```ts
    const id = await ctx.db.insert("myRaces", {
      userId: user._id,
      raceId: args.raceId,
      dorsalNumber: args.dorsalNumber,
      registrationDate: args.registrationDate,
      notes: args.notes,
      status: "planned",
      selectedDistanceKm: args.selectedDistance?.distanceKm,
      selectedDistanceLabel: args.selectedDistance?.label,
      selectedElevationGainM: args.selectedDistance?.elevationGainM,
      predictedTimeSeconds: prediction?.predictedTimeSeconds,
      predictionConfidence: prediction?.confidence,
      predictionFactors: prediction?.factors,
    });
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Verificación manual con `convex run`**

Necesitas un `raceId` real con `raceFormats` y un usuario de prueba. Usa el seed existente (`devOnly/seedTestUser.ts`) o una carrera cualquiera del catálogo. Ejemplo (ajusta el id):

```bash
npx convex run myRaces:add '{"raceId": "<ID_DE_UNA_CARRERA_REAL>", "selectedDistance": {"distanceKm": 10, "label": "10K"}}'
```
Expected: no lanza error; el objeto devuelto tiene `id`, `totalCount`, `isFirstRace`. (Si no hay usuario autenticado en la sesión de `convex run`, este comando fallará con `Unauthorized` — en ese caso, basta con confirmar que el `tsc --noEmit` del Step 2 pasó y seguir; la verificación end-to-end real se hace en el navegador en la Task 5).

- [ ] **Step 4: Commit**

```bash
git add convex/myRaces.ts
git commit -m "feat(myraces): add acepta selectedDistance y predice sobre esa distancia

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Mutation `myRaces.updateDistance`

**Files:**
- Modify: `convex/myRaces.ts` (añadir nueva mutation, después de `update` en línea ~191)

- [ ] **Step 1: Escribir la mutation**

Esta mutation permite cambiar la modalidad elegida DESPUÉS de haber añadido la carrera (desde el calendario). Solo mientras `status === "planned"`. Recalcula la predicción y resetea cualquier objetivo manual (`setTargetTime`) porque ya no aplica a la nueva distancia.

En `convex/myRaces.ts`, justo después del cierre de la mutation `update` (línea ~191, `});`), añade:

```ts
/**
 * Cambia la modalidad/distancia elegida por el usuario para una carrera ya
 * en su calendario (ej. se apuntó al 10K pero en realidad corre el 21K).
 * Solo permitido mientras la carrera está "planned": una vez corrida, la
 * distancia real ya quedó fijada por el resultado.
 *
 * Recalcula la predicción automática con la nueva distancia y SIEMPRE
 * sobreescribe cualquier objetivo manual que hubiera (setTargetTime) — un
 * objetivo puesto a mano para 21K no tiene sentido si el usuario cambia a
 * 10K. El cliente debe avisar al usuario de que su objetivo se recalculó.
 */
export const updateDistance = mutation({
  args: {
    id: v.id("myRaces"),
    selectedDistance: v.object({
      distanceKm: v.number(),
      label: v.string(),
      elevationGainM: v.optional(v.number()),
    }),
  },
  handler: async (ctx, { id, selectedDistance }) => {
    const user = await requireUser(ctx);
    const myRace = await ctx.db.get(id);
    if (!myRace) throw new Error("Not found");
    if (myRace.userId !== user._id) throw new Error("Forbidden");
    if (myRace.status !== "planned") {
      throw new Error("Solo puedes cambiar la distancia de una carrera planeada");
    }

    const race = await ctx.db.get(myRace.raceId);
    if (!race) throw new Error("Race not found");

    const prs = await ctx.db
      .query("personalRecords")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("isCurrent"), true))
      .collect();

    let prediction: ReturnType<typeof predictForMyRace> | null = null;
    try {
      prediction = predictForMyRace({
        race: {
          distanceKm: selectedDistance.distanceKm,
          elevationGainM: selectedDistance.elevationGainM,
          raceType: race.raceType,
          startDate: race.startDate,
        },
        userPRs: prs.map((pr) => ({
          distanceM: pr.distanceM,
          distanceLabel: pr.distanceLabel,
          timeSeconds: pr.timeSeconds,
        })),
        expectedTempC: estimateTempForRace(race.startDate, race.locality),
      });
    } catch (e) {
      console.warn(
        `[myRaces.updateDistance] Sin predicción para myRaceId=${id}:`,
        e instanceof Error ? e.message : e,
      );
    }

    await ctx.db.patch(id, {
      selectedDistanceKm: selectedDistance.distanceKm,
      selectedDistanceLabel: selectedDistance.label,
      selectedElevationGainM: selectedDistance.elevationGainM,
      predictedTimeSeconds: prediction?.predictedTimeSeconds,
      predictionConfidence: prediction?.confidence,
      predictionFactors: prediction?.factors,
    });

    if (prediction) {
      await ctx.db.insert("predictions", {
        userId: user._id,
        raceId: myRace.raceId,
        myRaceId: id,
        predictedTimeSeconds: prediction.predictedTimeSeconds,
        confidence: prediction.confidence,
        modelVersion: "daniels-vdot-v1",
        factors: prediction.factors,
      });
    }

    return { predictedTimeSeconds: prediction?.predictedTimeSeconds };
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add convex/myRaces.ts
git commit -m "feat(myraces): updateDistance recalcula predicción al cambiar de modalidad

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Componente `DistanceModalityPicker`

**Files:**
- Create: `components/distance-modality-picker.tsx`

Este componente es la pieza de UI compartida por el selector "al añadir" (Task 6) y "al editar desde el calendario" (Task 7). Construye la lista de opciones (principal + `raceFormats`), maneja la selección y muestra el aviso de detección automática.

- [ ] **Step 1: Crear el tipo de opción y el componente**

Crea `components/distance-modality-picker.tsx`:

```tsx
"use client";

// =============================================================================
// mi-dorsal — DistanceModalityPicker
// =============================================================================
// Selector de modalidad/distancia para carreras con varias pruebas (ej.
// "Media Maratón de Albacete" con 10K y 21K). Se usa tanto al añadir una
// carrera al calendario (AddToCalendarWidget) como al editarla después
// (HiloNode). Construye las opciones a partir de la distancia principal
// de la carrera + `race.raceFormats`.
// =============================================================================

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { labelForDistanceKm } from "@/lib/prediction/effective-distance";

export interface DistanceOption {
  distanceKm: number;
  label: string;
  elevationGainM?: number;
}

interface RaceForPicker {
  distanceKm: number;
  elevationGainM?: number;
  raceFormats?: Array<{
    name: string;
    distanceKm: number;
    elevationGainM?: number;
  }>;
}

/**
 * Construye las opciones del selector: la distancia principal de la
 * carrera + cada entrada de raceFormats. Devuelve [] si la carrera no
 * tiene raceFormats (no hace falta selector, comportamiento actual).
 */
export function buildDistanceOptions(race: RaceForPicker): DistanceOption[] {
  if (!race.raceFormats || race.raceFormats.length === 0) return [];
  const options: DistanceOption[] = [
    {
      distanceKm: race.distanceKm,
      label: labelForDistanceKm(race.distanceKm),
      elevationGainM: race.elevationGainM,
    },
    ...race.raceFormats.map((f) => ({
      distanceKm: f.distanceKm,
      label: f.name,
      elevationGainM: f.elevationGainM,
    })),
  ];
  // Deduplicar por distanceKm (si raceFormats ya incluye la principal)
  const seen = new Set<number>();
  return options.filter((o) => {
    if (seen.has(o.distanceKm)) return false;
    seen.add(o.distanceKm);
    return true;
  });
}

interface DistanceModalityPickerProps {
  options: DistanceOption[];
  selected: DistanceOption | null;
  onSelect: (option: DistanceOption) => void;
  className?: string;
}

export function DistanceModalityPicker({
  options,
  selected,
  onSelect,
  className,
}: DistanceModalityPickerProps) {
  if (options.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <label className="label flex items-center justify-between">
        <span>¿A qué distancia te apuntas?</span>
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((opt) => {
          const isSelected = selected?.distanceKm === opt.distanceKm;
          return (
            <button
              key={opt.distanceKm}
              type="button"
              onClick={() => onSelect(opt)}
              className={cn(
                "rounded-lg border-2 px-3 py-2 text-left transition-colors",
                isSelected
                  ? "border-runner-primary bg-runner-primary/5"
                  : "border-gray-200 hover:border-runner-primary/50",
              )}
            >
              <div className="text-sm font-semibold text-runner-dark">{opt.label}</div>
              <div className="text-xs text-gray-500">
                {opt.distanceKm.toFixed(opt.distanceKm % 1 === 0 ? 0 : 1)} km
              </div>
            </button>
          );
        })}
      </div>
      <p className="flex items-start gap-1.5 text-xs text-gray-500">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-500" aria-hidden="true" />
        <span>
          Detectamos las modalidades de esta carrera automáticamente — puede
          faltar alguna o estar mal. Si es tu caso,{" "}
          <a href="/feedback" className="underline font-semibold">
            dínoslo
          </a>
          .
        </span>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add components/distance-modality-picker.tsx
git commit -m "feat(ui): componente DistanceModalityPicker para elegir modalidad

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Selector en `AddToCalendarWidget`

**Files:**
- Modify: `components/add-to-calendar-widget.tsx` (props, `MockAddToCalendar`, `RealAddToCalendar`)
- Modify: `app/carreras/[slug]/client.tsx:632-635` (pasar las nuevas props)

`AddToCalendarWidget` hoy solo recibe `raceId` y `footerText` — no tiene los datos de la carrera (`distanceKm`, `elevationGainM`, `raceFormats`). Hay que pasárselos desde `app/carreras/[slug]/client.tsx`, que ya tiene la `race` completa cargada.

- [ ] **Step 1: Ampliar `AddToCalendarWidgetProps`**

En `components/add-to-calendar-widget.tsx`, reemplaza la interface (líneas 26-30):

```ts
interface AddToCalendarWidgetProps {
  raceId: Id<"races">;
  /** Distancia principal de la carrera, en km. */
  distanceKm: number;
  elevationGainM?: number;
  /** Modalidades alternativas (5K/10K/21K...), si la carrera las tiene. */
  raceFormats?: Array<{ name: string; distanceKm: number; elevationGainM?: number }>;
  /** Texto del footer ("X corredores la han valorado"). Opcional. */
  footerText?: string;
}
```

- [ ] **Step 2: Añadir el selector a `MockAddToCalendar`**

En `components/add-to-calendar-widget.tsx`, la función `MockAddToCalendar` (línea ~38). Añade el import al principio del archivo, junto a los demás imports:

```ts
import {
  buildDistanceOptions,
  DistanceModalityPicker,
  type DistanceOption,
} from "@/components/distance-modality-picker";
```

Cambia la firma de la función para recibir las nuevas props:

```ts
function MockAddToCalendar({
  raceId,
  distanceKm,
  elevationGainM,
  raceFormats,
  footerText,
}: AddToCalendarWidgetProps) {
```

Dentro de `MockAddToCalendar`, después de la declaración de `hydrated` (línea ~43), añade el estado de la modalidad elegida y las opciones:

```ts
  const distanceOptions = buildDistanceOptions({ distanceKm, elevationGainM, raceFormats });
  const [selectedDistance, setSelectedDistance] = useState<DistanceOption | null>(null);
```

En `handleAdd` (línea ~54), guarda también la modalidad elegida en localStorage (mock, solo para reflejar la elección en la UI de esta sesión):

```ts
  const handleAdd = () => {
    // En mock solo necesitamos feedback
    localStorage.setItem(STORAGE_ADDED, "1");
    if (dorsal.trim()) {
      localStorage.setItem(`mock-myRace-${raceId}-dorsal`, dorsal.trim());
    }
    if (selectedDistance) {
      localStorage.setItem(`mock-myRace-${raceId}-distance`, selectedDistance.label);
    }
    setAlreadyAdded(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };
```

En el JSX del estado "signed in, no añadida" (el `return` que empieza en línea ~142, justo antes del `<div className="space-y-2">` del dorsal), añade el picker:

```tsx
      <DistanceModalityPicker
        options={distanceOptions}
        selected={selectedDistance}
        onSelect={setSelectedDistance}
        className="mb-3"
      />
      <div className="space-y-2">
```

- [ ] **Step 3: Añadir el selector a `RealAddToCalendar` y pasar `selectedDistance` a la mutation**

En `RealAddToCalendar` (línea ~210), cambia la firma:

```ts
function RealAddToCalendar({
  raceId,
  distanceKm,
  elevationGainM,
  raceFormats,
  footerText,
}: AddToCalendarWidgetProps) {
```

Después de la declaración de `existing`/`alreadyAdded` (línea ~218-220), añade:

```ts
  const distanceOptions = buildDistanceOptions({ distanceKm, elevationGainM, raceFormats });
  const [selectedDistance, setSelectedDistance] = useState<DistanceOption | null>(null);
```

En `handleAdd` (línea ~227), pasa `selectedDistance` a la mutation:

```ts
  const handleAdd = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await addMutation({
        raceId,
        dorsalNumber: dorsal.trim() || undefined,
        selectedDistance: selectedDistance ?? undefined,
      });
```
(el resto de `handleAdd` no cambia)

En el JSX del estado "signed in, no añadida" (el `return` final, línea ~342, justo antes de `<div className="space-y-2">` del dorsal), añade el picker igual que en el mock:

```tsx
      <DistanceModalityPicker
        options={distanceOptions}
        selected={selectedDistance}
        onSelect={setSelectedDistance}
        className="mb-3"
      />
      <div className="space-y-2">
```

- [ ] **Step 4: Pasar las nuevas props desde la ficha de carrera**

En `app/carreras/[slug]/client.tsx:632-635`, reemplaza:

```tsx
              <AddToCalendarWidget
                raceId={race._id}
                footerText={`${summary?.totalRatings ?? 0} corredores la han valorado`}
              />
```

por:

```tsx
              <AddToCalendarWidget
                raceId={race._id}
                distanceKm={race.distanceKm}
                elevationGainM={race.elevationGainM}
                raceFormats={race.raceFormats}
                footerText={`${summary?.totalRatings ?? 0} corredores la han valorado`}
              />
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 7: Verificación manual en navegador**

1. Necesitas una carrera con `raceFormats` en el catálogo. Si no hay ninguna con datos reales, usa `npx convex run races:systemUpdate` para añadir `raceFormats` de prueba a una carrera existente, ej.:
   ```bash
   npx convex run races:systemUpdate '{"id": "<ID_DE_UNA_CARRERA>", "patch": {"raceFormats": [{"name": "10K", "distanceKm": 10}, {"name": "5K", "distanceKm": 5}]}}'
   ```
2. Arranca el dev server: `npm run dev` (con `NEXT_PUBLIC_USE_MOCK=false` y credenciales reales, o `=true` para mock).
3. Abre `/carreras/<slug-de-esa-carrera>`, inicia sesión.
4. En el sidebar, confirma que aparece el selector "¿A qué distancia te apuntas?" con 3 opciones (principal + 10K + 5K) y el aviso de detección automática con link a `/feedback`.
5. Elige "10K" y pulsa "Añadir a mi calendario".
6. Ve a `/calendario` y confirma que la carrera aparece.

Expected: la carrera se añade sin error; en la Task 7 se verificará que el calendario permite editar la distancia elegida.

- [ ] **Step 8: Commit**

```bash
git add components/add-to-calendar-widget.tsx "app/carreras/[slug]/client.tsx"
git commit -m "feat(calendario): selector de modalidad al añadir carrera al calendario

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Editar la modalidad desde `HiloNode` (calendario)

**Files:**
- Modify: `components/calendario/hilo-node.tsx`

Añade un control "editar distancia" al chip de distancia de la card, que abre el mismo `DistanceModalityPicker` y llama a `myRaces.updateDistance` (creada en Task 4). Solo visible si `race.raceFormats` existe y `myRace.status === "planned"`.

- [ ] **Step 1: Imports y nuevo estado**

En `components/calendario/hilo-node.tsx`, añade a los imports existentes (línea 17-20):

```tsx
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Pencil } from "lucide-react";
import {
  buildDistanceOptions,
  DistanceModalityPicker,
  type DistanceOption,
} from "@/components/distance-modality-picker";
import { getEffectiveDistance } from "@/lib/prediction/effective-distance";
import { useToast } from "@/components/ui/toast";
```

- [ ] **Step 2: Calcular la distancia efectiva y sustituir todos los usos de `race.distanceKm`**

Dentro de `HiloNode` (línea 151), justo después de `const race = myRace.race;` (línea 155), añade:

```ts
  const effectiveDistance = race ? getEffectiveDistance(myRace, race) : null;
```

Reemplaza la línea 157 (`const matchingPR = race ? findMatchingPR(race.distanceKm, userPRs) : null;`) por:

```ts
  const matchingPR = effectiveDistance ? findMatchingPR(effectiveDistance.distanceKm, userPRs) : null;
```

En el bloque de "chip de distancia" (líneas ~278-284):

```tsx
          {race && (
            <span className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5" />
              {race.distanceKm.toFixed(race.distanceKm % 1 === 0 ? 0 : 1)} km
              · {formatRaceType(race.raceType)}
            </span>
          )}
```

reemplázalo por (usa `effectiveDistance` y añade el botón de editar si hay `raceFormats` y la carrera sigue `planned`):

```tsx
          {race && effectiveDistance && (
            <span className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5" />
              {effectiveDistance.label} ({effectiveDistance.distanceKm.toFixed(effectiveDistance.distanceKm % 1 === 0 ? 0 : 1)} km)
              · {formatRaceType(race.raceType)}
              {race.raceFormats && race.raceFormats.length > 0 && status === "planned" && (
                <button
                  type="button"
                  onClick={() => setEditingDistance(true)}
                  className="ml-1 inline-flex items-center rounded p-0.5 text-stone-400 hover:text-runner-primary hover:bg-stone-100"
                  aria-label="Cambiar distancia elegida"
                  title="Cambiar distancia elegida"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </span>
          )}
```

Reemplaza los otros 3 usos de `race.distanceKm` dentro del bloque de la calculadora (líneas ~304-328) por `effectiveDistance.distanceKm`:

```tsx
        {(race && effectiveDistance && effectiveDistance.distanceKm > 0) || myRace.actualTimeSeconds ? (
          <div className="mt-4 border-t border-stone-100 pt-3">
            {matchingPR && (
              <div className="mb-3 flex items-baseline justify-between gap-2 rounded-md bg-stone-50 px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                  Tu PR en {Math.round(matchingPR.distanceM / 1000)} km
                </span>
                <span className="font-mono text-sm font-bold text-stone-700">
                  {formatTime(matchingPR.timeSeconds)}
                  {effectiveDistance && effectiveDistance.distanceKm > 0 && (
                    <span className="ml-2 text-[11px] font-normal text-stone-500">
                      ({formatPaceLong(matchingPR.timeSeconds / effectiveDistance.distanceKm)})
                    </span>
                  )}
                </span>
              </div>
            )}

            {effectiveDistance && effectiveDistance.distanceKm > 0 && (
              <TimePaceCalculator
                myRaceId={myRace._id}
                distanceKm={effectiveDistance.distanceKm}
                initialTimeSeconds={myRace.predictedTimeSeconds}
              />
            )}
```
(el bloque de `myRace.actualTimeSeconds` que sigue no cambia)

- [ ] **Step 3: Estado del modal de edición y mutation**

Dentro de `HiloNode`, después del `const effectiveDistance = ...` del Step 2, añade:

```ts
  const [editingDistance, setEditingDistance] = useState(false);
  const [pendingDistance, setPendingDistance] = useState<DistanceOption | null>(null);
  const updateDistance = useMutation(api.myRaces.updateDistance);
  const toast = useToast();

  const distanceOptions = race ? buildDistanceOptions(race) : [];

  const handleSaveDistance = async () => {
    if (!pendingDistance) return;
    await updateDistance({ id: myRace._id, selectedDistance: pendingDistance });
    toast.show({
      variant: "info",
      title: "Distancia actualizada",
      description: "Recalculamos tu predicción para la nueva distancia.",
    });
    setEditingDistance(false);
    setPendingDistance(null);
  };
```

- [ ] **Step 4: Renderizar el modal/panel de edición**

Justo antes del cierre del `</article>` (línea ~349, después del bloque `{myRace.actualTimeSeconds && (...)}`), añade:

```tsx
        {editingDistance && (
          <div className="mt-4 border-t border-stone-100 pt-3">
            <DistanceModalityPicker
              options={distanceOptions}
              selected={pendingDistance ?? effectiveDistance}
              onSelect={setPendingDistance}
            />
            <div className="mt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingDistance(false);
                  setPendingDistance(null);
                }}
                className="text-xs text-stone-500 hover:underline"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveDistance}
                disabled={!pendingDistance}
                className="rounded-md bg-runner-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-50"
              >
                Guardar distancia
              </button>
            </div>
          </div>
        )}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 7: Verificación manual en navegador**

1. Con la carrera de prueba de la Task 6 (con `raceFormats` 10K/5K) ya añadida al calendario con distancia "10K":
2. Ve a `/calendario`, localiza la card de esa carrera.
3. Confirma que el chip de distancia muestra "10K (10 km)" y tiene el icono de lápiz.
4. Click en el lápiz → aparece el picker con "10K" preseleccionado.
5. Elige "5K" → "Guardar distancia".
6. Expected: toast "Distancia actualizada"; el chip pasa a mostrar "5K (5 km)"; la calculadora de pace debajo se recalcula con 5 km.
7. Marca la carrera como `done` (usa `setManualResult` vía la UI si existe, o `npx convex run myRaces:setManualResult '{"id": "<ID>", "timeSeconds": 1500}'`) y confirma que el icono de lápiz desaparece (ya no se puede editar).

- [ ] **Step 8: Commit**

```bash
git add components/calendario/hilo-node.tsx
git commit -m "feat(calendario): permitir cambiar la distancia elegida desde el hilo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: `myRaces.setManualResult` guarda el PR en la distancia efectiva

**Files:**
- Modify: `convex/myRaces.ts:237-303` (mutation `setManualResult`)

Hoy, al pegar un resultado manual, el PR se registra siempre con `race.distanceKm` (línea ~276). Si el usuario eligió el 10K de una carrera con `distanceKm` principal 21.1, el PR se guardaría como si hubiera corrido 21K. Hay que usar `getEffectiveDistance`.

- [ ] **Step 1: Importar el helper**

En `convex/myRaces.ts`, añade el import junto a los existentes (línea ~9):

```ts
import { getEffectiveDistance } from "../lib/prediction/effective-distance";
```

- [ ] **Step 2: Sustituir el cálculo de `distanceM`**

En la mutation `setManualResult`, el bloque (líneas ~273-302):

```ts
    // Actualizar PR si aplica
    const race = await ctx.db.get(myRace.raceId);
    if (race) {
      const distanceM = Math.round(race.distanceKm * 1000);
```

reemplázalo por:

```ts
    // Actualizar PR si aplica
    const race = await ctx.db.get(myRace.raceId);
    if (race) {
      const effectiveDistance = getEffectiveDistance(myRace, race);
      const distanceM = Math.round(effectiveDistance.distanceKm * 1000);
```

El resto del bloque (búsqueda de `currentPR`, inserción del nuevo PR con `distanceLabel: getDistanceLabel(distanceM)`) no cambia — ya usa la variable `distanceM` que ahora es correcta.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 4: Verificación manual**

Usando el `myRace` con distancia "5K" seleccionada de la Task 7 (o cualquier `myRace` con `selectedDistanceKm` guardado):

```bash
npx convex run myRaces:setManualResult '{"id": "<ID_MYRACE_CON_5K>", "timeSeconds": 1350}'
```

Luego:
```bash
npx convex run personalRecords:listMine '{}'
```
Expected: aparece (o se actualiza) un PR con `distanceM: 5000` (no 21097), `timeSeconds: 1350`.

- [ ] **Step 5: Commit**

```bash
git add convex/myRaces.ts
git commit -m "fix(myraces): setManualResult registra el PR en la distancia elegida, no la principal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Diploma y emails usan la distancia efectiva

**Files:**
- Modify: `convex/emailNotificationsHelpers.ts:21-45` (`getDataForEmail`), `convex/emailNotificationsHelpers.ts:179-225` (`getMyRaceForPublicPage`)
- Modify: `convex/emailNotificationsAction.ts:107-330` (`sendResultFoundEmail`), `convex/emailNotificationsAction.ts:343-480` (`sendReminderEmail`)

Estos 4 puntos calculan `distanceM`/`distanceKm`/`distanceLabel`/`paceFormatted` a partir de `race.distanceKm` para el diploma PDF y los emails. Deben usar `getEffectiveDistance(myRace, race)`.

- [ ] **Step 1: `getDataForEmail` — devolver también la distancia efectiva**

En `convex/emailNotificationsHelpers.ts`, añade el import al principio del archivo (línea ~15):

```ts
import { getEffectiveDistance } from "../lib/prediction/effective-distance";
```

Reemplaza el cuerpo de `getDataForEmail` (líneas 21-45):

```ts
export const getDataForEmail = internalQuery({
  args: { myRaceId: v.id("myRaces") },
  handler: async (ctx, { myRaceId }) => {
    const myRace = await ctx.db.get(myRaceId);
    if (!myRace) return null;
    const profile = await ctx.db.get(myRace.userId);
    if (!profile) return null;
    const race = await ctx.db.get(myRace.raceId);
    if (!race) return null;

    // PR actual en la distancia EFECTIVA (la que el usuario eligió, o la
    // principal de la carrera si no eligió ninguna), sin modificarlo.
    const effectiveDistance = getEffectiveDistance(myRace, race);
    const distanceM = Math.round(effectiveDistance.distanceKm * 1000);
    const currentPR = await ctx.db
      .query("personalRecords")
      .withIndex("by_user_distance_current", (q) =>
        q
          .eq("userId", profile._id)
          .eq("distanceM", distanceM)
          .eq("isCurrent", true),
      )
      .unique();

    return { myRace, profile, race, currentPR, effectiveDistance };
  },
});
```

- [ ] **Step 2: `getMyRaceForPublicPage` — igual, para la página pública de resultado**

En el mismo archivo, reemplaza el cuerpo de `getMyRaceForPublicPage` (líneas 179-225):

```ts
export const getMyRaceForPublicPage = query({
  args: { myRaceId: v.id("myRaces") },
  handler: async (ctx, { myRaceId }) => {
    const myRace = await ctx.db.get(myRaceId);
    if (!myRace) return null;
    const profile = await ctx.db.get(myRace.userId);
    const race = await ctx.db.get(myRace.raceId);
    if (!profile || !race) return null;
    const effectiveDistance = getEffectiveDistance(myRace, race);
    const distanceM = Math.round(effectiveDistance.distanceKm * 1000);
    const currentPR = await ctx.db
      .query("personalRecords")
      .withIndex("by_user_distance_current", (q) =>
        q
          .eq("userId", profile._id)
          .eq("distanceM", distanceM)
          .eq("isCurrent", true),
      )
      .unique();
    return {
      myRace: {
        _id: myRace._id,
        dorsalNumber: myRace.dorsalNumber,
        actualTimeSeconds: myRace.actualTimeSeconds,
        actualPosition: myRace.actualPosition,
        actualPositionCategory: myRace.actualPositionCategory,
        diplomaStorageId: myRace.diplomaStorageId,
        shareCardStorageId: myRace.shareCardStorageId,
      },
      profile: {
        _id: profile._id,
        displayName: profile.displayName,
      },
      race: {
        _id: race._id,
        name: race.name,
        slug: race.slug,
        distanceKm: effectiveDistance.distanceKm,
        startDate: race.startDate,
        locality: race.locality,
        resultsUrl: race.resultsUrl,
      },
      currentPR: currentPR
        ? { timeSeconds: currentPR.timeSeconds, achievedAt: currentPR.achievedAt }
        : null,
    };
  },
});
```

Nota: aquí se devuelve `race.distanceKm` ya sustituido por `effectiveDistance.distanceKm` dentro del objeto `race` que consume la página pública — no se cambia la forma del objeto devuelto, solo el valor.

- [ ] **Step 3: `sendResultFoundEmail` — usar la distancia efectiva del diploma**

En `convex/emailNotificationsAction.ts`, dentro de `sendResultFoundEmail` (línea 107), el bloque (líneas ~130-134):

```ts
    const { myRace, profile, race, currentPR } = data;
```

reemplázalo por:

```ts
    const { myRace, profile, race, currentPR, effectiveDistance } = data;
```

Y el bloque (líneas ~146-154):

```ts
    // ---------- 2. Calcular PR ----------
    const distanceM = Math.round(race.distanceKm * 1000);
    const isPR =
      currentPR != null &&
      args.timeSeconds < currentPR.timeSeconds;
    const prDeltaSeconds =
      isPR && currentPR ? currentPR.timeSeconds - args.timeSeconds : undefined;
    const previousRecordFormatted = currentPR ? formatHMS(currentPR.timeSeconds) : undefined;
    const distanceLabel = getDistanceLabel(distanceM);
```

reemplázalo por:

```ts
    // ---------- 2. Calcular PR ----------
    const distanceM = Math.round(effectiveDistance.distanceKm * 1000);
    const isPR =
      currentPR != null &&
      args.timeSeconds < currentPR.timeSeconds;
    const prDeltaSeconds =
      isPR && currentPR ? currentPR.timeSeconds - args.timeSeconds : undefined;
    const previousRecordFormatted = currentPR ? formatHMS(currentPR.timeSeconds) : undefined;
    const distanceLabel = effectiveDistance.label;
```

Más abajo, en la construcción de `diplomaProps` (líneas ~160-169):

```ts
    const diplomaProps: DiplomaProps = {
      runnerName: profile.displayName ?? "Corredor",
      raceName: race.name,
      raceDate: args.raceDate,
      distanceKm: race.distanceKm,
      distanceLabel,
      timeFormatted: formatHMS(args.timeSeconds),
      timeSeconds: args.timeSeconds,
      dorsalNumber: myRace.dorsalNumber ?? "—",
      paceFormatted: formatPace(args.timeSeconds, race.distanceKm),
```

reemplaza `distanceKm: race.distanceKm,` por `distanceKm: effectiveDistance.distanceKm,` y `paceFormatted: formatPace(args.timeSeconds, race.distanceKm),` por `paceFormatted: formatPace(args.timeSeconds, effectiveDistance.distanceKm),`. El resto de `diplomaProps` no cambia.

- [ ] **Step 4: `sendReminderEmail` — usar la distancia efectiva del email de recordatorio**

`sendReminderEmail` usa `getDataForEmail` igual que `sendResultFoundEmail`. En el bloque donde desestructura los datos (busca `const { myRace, profile, race } = data;` dentro de `sendReminderEmail`, línea ~366), reemplaza por:

```ts
    const { myRace, profile, race, effectiveDistance } = data;
```

Y el bloque (líneas ~389-391):

```ts
    // ---------- 2. Preparar datos para la plantilla ----------
    const distanceM = Math.round(race.distanceKm * 1000);
    const distanceLabel = getDistanceLabel(distanceM);
```

reemplázalo por:

```ts
    // ---------- 2. Preparar datos para la plantilla ----------
    const distanceLabel = effectiveDistance.label;
```

(la variable `distanceM` ya no se usa en el resto de la función — confirma que no queda ninguna referencia suelta a `distanceM` más abajo en `sendReminderEmail` antes de borrar la línea; si algún otro punto de la función la necesitara, mantenla calculada desde `effectiveDistance.distanceKm`).

- [ ] **Step 5: Eliminar la función local `getDistanceLabel` si queda sin uso**

`getDistanceLabel` en `convex/emailNotificationsAction.ts` (línea ~680) es una función **local** definida en ese mismo archivo (helper puro al final del fichero), no un import de `_helpers`. Tras los cambios de los Steps 3 y 4, sus dos únicos call-sites (`sendResultFoundEmail` línea ~154 y `sendReminderEmail` línea ~391) ya no la llaman.

Run: `grep -n "getDistanceLabel" convex/emailNotificationsAction.ts`
Expected: solo aparece la línea de la propia `function getDistanceLabel(distanceM: number): string { ... }` (definición, sin ningún call-site).

Si es así, borra esa función (líneas ~680-689, el bloque `function getDistanceLabel(distanceM: number): string { ... }` completo) — queda código muerto si no.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 8: Verificación manual**

Con el `myRace` de la Task 7/8 (distancia efectiva 5K, tras `setManualResult`):

```bash
npx convex run emailNotificationsAction:sendResultFoundEmail '{"userId": "<PROFILE_ID>", "myRaceId": "<MYRACE_ID>", "raceName": "<NOMBRE>", "raceDate": "2026-09-09", "timeSeconds": 1350}'
```
Expected: no lanza error. Si `RESEND_API_KEY` no está configurada localmente, revisa el log — debe mostrar modo mock, pero el diploma generado (o el intento) debe usar `distanceKm: 5` y `distanceLabel: "5K"`, no 21.1/"Media maratón". Puedes confirmarlo con un `console.log(diplomaProps)` temporal si tienes dudas, y quitarlo antes de commitear.

- [ ] **Step 9: Commit**

```bash
git add convex/emailNotificationsHelpers.ts convex/emailNotificationsAction.ts
git commit -m "fix(emails): diploma y recordatorios usan la distancia elegida por el usuario

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Cron `checkResults` registra el PR en la distancia efectiva

**Files:**
- Modify: `convex/crons/checkResults.ts:238` (dentro de la acción principal `checkResults`)

Cuando el cron detecta un resultado scrapeado y actualiza el PR del usuario, usa `notifData.race.distanceKm` (línea 238). Debe usar la distancia efectiva del `myRace` que se está procesando.

- [ ] **Step 1: Importar el helper**

En `convex/crons/checkResults.ts`, añade el import junto a los existentes (línea ~19):

```ts
import { getEffectiveDistance } from "../../lib/prediction/effective-distance";
```

- [ ] **Step 2: Sustituir el cálculo de `distanceM`**

El bloque (líneas ~233-248):

```ts
          try {
            const distanceM = Math.round(notifData.race.distanceKm * 1000);
            const prResult = await ctx.runMutation(
              internal.personalRecords.updateIfBetter,
              {
                userId: notifData.profile._id,
                distanceM,
                timeSeconds: result.timeSeconds,
                raceId: notifData.race._id,
                achievedAt: notifData.race.startDate,
              },
            );
```

reemplázalo por:

```ts
          try {
            const effectiveDistance = getEffectiveDistance(notifData.myRace, notifData.race);
            const distanceM = Math.round(effectiveDistance.distanceKm * 1000);
            const prResult = await ctx.runMutation(
              internal.personalRecords.updateIfBetter,
              {
                userId: notifData.profile._id,
                distanceM,
                timeSeconds: result.timeSeconds,
                raceId: notifData.race._id,
                achievedAt: notifData.race.startDate,
              },
            );
```

`notifData` viene de `getMyRaceForNotification` (línea 133), que ya devuelve `{ myRace, profile, race }` — `notifData.myRace` está disponible sin cambios adicionales.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add convex/crons/checkResults.ts
git commit -m "fix(cron): checkResults registra el PR en la distancia elegida por el usuario

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: Filtro de distancia del catálogo mira todas las modalidades

**Files:**
- Modify: `convex/races.ts:29-39` (`distanceToCategories`) y `convex/races.ts:114-119` (uso en `list`)
- Modify: `lib/utils.ts:200-208` (`distanceToCategories`)
- Modify: `lib/mock/provider.tsx:32-42` (`distanceToCategories`) y `lib/mock/provider.tsx:77-82` (uso en `mockApi.races.list`)

Hay 3 copias intencionalmente duplicadas de `distanceToCategories` (Convex, `lib/utils.ts`, mock) — mismo criterio, sin import cruzado entre capas. Las 3 deben pasar a devolver las categorías de TODAS las distancias de una carrera (principal + `raceFormats`), no solo la principal.

- [ ] **Step 1: `convex/races.ts` — nueva función que agrega categorías de todas las modalidades**

En `convex/races.ts`, después de la función `distanceToCategories` existente (líneas 29-39), añade una nueva función que la reutiliza sobre todas las distancias de la carrera:

```ts
/**
 * Igual que distanceToCategories, pero considerando TODAS las distancias
 * de una carrera: la principal (distanceKm) y cada raceFormats[].distanceKm.
 * Así, filtrar por "10K" encuentra también una "Media Maratón" que tiene
 * un raceFormat de 10K, aunque su distanceKm principal sea 21.1.
 */
function allDistanceCategories(race: {
  distanceKm: number;
  raceFormats?: Array<{ distanceKm: number }>;
}): string[] {
  const cats = new Set<string>(distanceToCategories(race.distanceKm));
  for (const f of race.raceFormats ?? []) {
    for (const c of distanceToCategories(f.distanceKm)) {
      cats.add(c);
    }
  }
  return Array.from(cats);
}
```

Reemplaza el bloque de filtro en `list` (líneas 114-119):

```ts
    if (args.distanceCategories && args.distanceCategories.length > 0) {
      filtered = filtered.filter((r) => {
        const cats = distanceToCategories(r.distanceKm);
        return cats.some((c) => args.distanceCategories!.includes(c as never));
      });
    }
```

por:

```ts
    if (args.distanceCategories && args.distanceCategories.length > 0) {
      filtered = filtered.filter((r) => {
        const cats = allDistanceCategories(r);
        return cats.some((c) => args.distanceCategories!.includes(c as never));
      });
    }
```

- [ ] **Step 2: `lib/utils.ts` — misma ampliación para `filterByDistanceCategories`**

En `lib/utils.ts`, la función `filterByDistanceCategories` (líneas ~213-221) se usa hoy con `{ distanceKm: number }`. Amplía el tipo genérico y la lógica para incluir `raceFormats`. Reemplaza:

```ts
export function filterByDistanceCategories<T extends { distanceKm: number }>(
  races: T[],
  categories: DistanceCategory[],
): T[] {
  if (categories.length === 0) return races;
  return races.filter((r) => {
    const cats = distanceToCategories(r.distanceKm);
    return cats.some((c) => categories.includes(c));
  });
}
```

por:

```ts
export function filterByDistanceCategories<
  T extends { distanceKm: number; raceFormats?: Array<{ distanceKm: number }> },
>(races: T[], categories: DistanceCategory[]): T[] {
  if (categories.length === 0) return races;
  return races.filter((r) => {
    const cats = new Set<DistanceCategory>(distanceToCategories(r.distanceKm));
    for (const f of r.raceFormats ?? []) {
      for (const c of distanceToCategories(f.distanceKm)) {
        cats.add(c);
      }
    }
    return categories.some((c) => cats.has(c));
  });
}
```

- [ ] **Step 3: `lib/mock/provider.tsx` — misma ampliación para el mock**

En `lib/mock/provider.tsx`, después de la función `distanceToCategories` (líneas 32-42), añade:

```ts
function allDistanceCategories(r: {
  distanceKm: number;
  raceFormats?: Array<{ distanceKm: number }>;
}): string[] {
  const cats = new Set<string>(distanceToCategories(r.distanceKm));
  for (const f of r.raceFormats ?? []) {
    for (const c of distanceToCategories(f.distanceKm)) {
      cats.add(c);
    }
  }
  return Array.from(cats);
}
```

Reemplaza el uso en `mockApi.races.list` (líneas ~77-82):

```ts
      if (args.distanceCategories && args.distanceCategories.length > 0) {
        filtered = filtered.filter((r) => {
          const cats = distanceToCategories(r.distanceKm);
          return cats.some((c) => args.distanceCategories.includes(c));
        });
      }
```

por:

```ts
      if (args.distanceCategories && args.distanceCategories.length > 0) {
        filtered = filtered.filter((r) => {
          const cats = allDistanceCategories(
            r as { distanceKm: number; raceFormats?: Array<{ distanceKm: number }> },
          );
          return cats.some((c) => args.distanceCategories.includes(c));
        });
      }
```

(el cast tipado sigue el mismo patrón que ya usa este archivo para campos opcionales no declarados en `MockRace`, ej. `(r as { organizer?: string })` en las líneas 68 y 74).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 6: Verificación manual en navegador**

1. Con la carrera de prueba de la Task 6 (`distanceKm` principal ≈21K con `raceFormats` 10K/5K):
2. Ve a `/carreras`, aplica el filtro de distancia "10K" (o "5K") en `QuickFilterChips`/`AdvancedFilters`.
3. Expected: la carrera de prueba aparece en los resultados, aunque su distancia principal sea 21K.
4. Quita el filtro y aplica "Media maratón" — la carrera debe seguir apareciendo (por su distancia principal).

- [ ] **Step 7: Commit**

```bash
git add convex/races.ts lib/utils.ts lib/mock/provider.tsx
git commit -m "feat(carreras): filtro de distancia considera todas las modalidades de la carrera

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: Verificación end-to-end completa + deploy checklist

**Files:** ninguno (solo verificación manual, siguiendo `docs/core/deploy-checklist.md`)

Esta tarea no escribe código nuevo — es el pase final de verificación manual en local antes de considerar la feature terminada, siguiendo el checklist obligatorio del repo.

- [ ] **Step 1: Typecheck completo**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 2: Build completo**

Run: `npm run build`
Expected: termina con `✓ Compiled successfully`. Revisa en la tabla de rutas del output que `/carreras/[slug]` y `/calendario` siguen apareciendo.

- [ ] **Step 3: Flujo completo en navegador (dev server real, sin mock)**

Con `NEXT_PUBLIC_USE_MOCK=false` y credenciales reales de Convex/Clerk:

1. `npm run dev`.
2. Como admin, en `/admin/races/<id>` de una carrera real, añade manualmente 2 `raceFormats` (ej. "10K" y "5K") usando el formulario de edición o `npx convex run races:systemUpdate` (ver Task 6, Step 7.1).
3. Como usuario normal, entra a la ficha de esa carrera (`/carreras/<slug>`).
4. Confirma el selector de modalidad con 3 opciones + aviso de detección automática enlazando a `/feedback`.
5. Elige "10K", añade al calendario.
6. En `/calendario`, confirma: chip "10K (10 km)", icono de editar visible, calculadora de pace usando 10 km.
7. Cambia a "5K" desde el lápiz → confirma toast, chip actualizado a "5K (5 km)", pace recalculado.
8. Pega un resultado manual (o espera al cron/scraper si hay uno real disponible) y confirma en `/perfil` que el PR nuevo aparece bajo 5K (`distanceM: 5000`), no bajo la distancia principal de la carrera.
9. Si `RESEND_API_KEY` está configurada, confirma que el email de resultado (o el diploma, si accesible vía `/resultado/<myRaceId>`) muestra "5K" y no la distancia principal.
10. En `/carreras`, filtra por "10K" y confirma que la carrera de prueba aparece aunque su distancia principal sea otra.

- [ ] **Step 4: Revisar `git status` antes de cualquier commit final**

Run: `git status`
Expected: solo los archivos tocados en las Tasks 1-11 aparecen modificados. Si hay archivos inesperados (generados por el IDE u otros procesos, ver advertencia en `docs/core/deploy-checklist.md`), NO los incluyas en el commit.

- [ ] **Step 5: Deploy de Convex (si se va a desplegar)**

Run: `npx convex deploy`
Expected: termina sin errores, confirma el push del nuevo schema (`myRaces` con los 3 campos nuevos) y las funciones nuevas/modificadas.

No se requiere ningún script de migración: los `myRaces` existentes simplemente no tienen `selectedDistanceKm` y siguen funcionando vía el fallback de `getEffectiveDistance`.

---

## Resumen de archivos tocados

- `convex/schema.ts` — 3 campos nuevos en `myRaces` (Task 1).
- `lib/prediction/effective-distance.ts` — nuevo, helper puro (Task 2).
- `convex/myRaces.ts` — `add` acepta `selectedDistance`, nueva mutation `updateDistance`, `setManualResult` corregido (Tasks 3, 4, 8).
- `components/distance-modality-picker.tsx` — nuevo componente compartido (Task 5).
- `components/add-to-calendar-widget.tsx`, `app/carreras/[slug]/client.tsx` — selector al añadir (Task 6).
- `components/calendario/hilo-node.tsx` — editar distancia desde el calendario (Task 7).
- `convex/emailNotificationsHelpers.ts`, `convex/emailNotificationsAction.ts` — diploma/emails corregidos (Task 9).
- `convex/crons/checkResults.ts` — cron corregido (Task 10).
- `convex/races.ts`, `lib/utils.ts`, `lib/mock/provider.tsx` — filtro de catálogo ampliado (Task 11).


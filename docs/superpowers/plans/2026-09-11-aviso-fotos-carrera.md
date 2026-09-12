# Aviso de fotos de carrera disponibles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando un admin pega la URL de la galería de fotos de una carrera en `/admin/races/[id]`, avisar por email a todos los corredores con una `myRace` de esa carrera.

**Architecture:** `races.adminUpdate` (mutation) detecta la transición `photosUrl` de vacío a con-valor y agenda (`ctx.scheduler.runAfter(0, ...)`) una nueva `internalAction` (`convex/crons/notifyPhotosAvailable.ts`) que itera las `myRaces` de esa carrera, renderiza una plantilla de email nueva y envía+loguea cada email con `emailDispatch.dispatchAndLog` (la única función que debe llamar a Resend, según `docs/core/emails-crons.md`). Sin cron periódico, sin scraping — el spec (`docs/superpowers/specs/2026-09-11-aviso-fotos-carrera-design.md`) descartó ambos porque no hay proveedor de fotos con URL detectable automáticamente.

**Tech Stack:** Convex (mutations/actions/scheduler), TypeScript, Resend (vía `emailDispatch.dispatchAndLog`), Next.js (panel admin en `app/admin/races/[id]/page.tsx`).

---

## Contexto que el implementador necesita antes de tocar código

- **`emailDispatch.dispatchAndLog`** (`convex/emailDispatch.ts:78-140`) ya existe: es una `internalAction` que recibe `{ to, subject, html, text?, userId, myRaceId, type }`, envía por Resend (o logea en modo mock si falta `RESEND_API_KEY`), y escribe la fila en `notificationLog` — todo en una llamada. **Hoy ningún cron real la usa** (los crons en producción — `checkResults.ts`, `reminderPreRace.ts` — tienen su propio código Resend inline en `emailNotificationsAction.ts` porque necesitan adjuntar PDF/PNG). Esta será la primera vez que se usa `dispatchAndLog` desde un flujo real. No repliques el patrón de `emailNotificationsAction.ts` — este email no lleva adjuntos, así que no hay motivo para bypasear `dispatchAndLog`.
- La unión de tipos de `notificationLog.type` está **duplicada en 3 archivos, 6 apariciones**: `convex/schema.ts` (1), `convex/emailDispatch.ts` (3, una por función: `hasLog`, `writeLog`, `dispatchAndLog`), `convex/emailNotificationsHelpers.ts` (2: `hasLogForMyRace`, `writeLog`). Hay que añadir `v.literal("photos_available")` en las **6**. Si se te olvida una, TypeScript falla al compilar en esa función, no en runtime — confía en `tsc`/`next build`, no solo en tu memoria de la lista.
- Todas las carreras se identifican por `Id<"races">`, todas las inscripciones por `Id<"myRaces">` (`convex/schema.ts:452-511`). El índice `by_race` de `myRaces` (`schema.ts:507`) ya existe — se usa para listar inscritos de una carrera sin `.collect()` sobre toda la tabla.
- El panel admin de carreras vive en `app/admin/races/[id]/page.tsx`, es un client component que llama a `api.races.adminUpdate` (mutation, `convex/races.ts:370-521`). El array de campos del formulario (`form`) y el `patch` que se envía a `adminUpdate` son manuales — no hay generación automática desde el schema, así que añadir un campo significa tocar 4 sitios: el estado inicial del `useEffect` (línea 40-56), el objeto `patch` del `submit` (línea 108-127), el `<input>` en el JSX (línea 379-389), y la unión de `adminUpdate.args.patch` en `convex/races.ts` (línea 373-493).
- No hay test runner (`vitest`/`jest`) instalado en este repo. Los "tests" existentes en `scripts/*.ts` (ej. `scripts/test-chiplevante-parser.ts`) son scripts standalone ejecutados con `tsx scripts/nombre.ts`, que imprimen resultados por consola y hacen `process.exit(1)` si algo falla. Sigue ese mismo patrón — no instales vitest para esto.

## File Structure

- **Modify** `convex/schema.ts` — añade `photosUrl` a `races` y `"photos_available"` a la unión de `notificationLog.type`.
- **Modify** `convex/races.ts` — añade `photosUrl` a `adminUpdate.args.patch`; tras el `ctx.db.patch`, detecta la transición y agenda la notificación.
- **Modify** `convex/emailDispatch.ts` — añade `"photos_available"` a las 3 uniones de tipo.
- **Modify** `convex/emailNotificationsHelpers.ts` — añade `"photos_available"` a las 2 uniones de tipo (para que `hasLogForMyRace`/`writeLog`, usadas por otros flujos, sigan aceptando el tipo si algo las reutiliza; no se usan en este flujo nuevo, pero deben compilar con el resto del código que sí referencia la unión completa vía `Doc<"notificationLog">`).
- **Create** `convex/emails/templates/photosAvailable.ts` — plantilla del email (mismo patrón que `reminder.ts`).
- **Create** `convex/crons/notifyPhotosAvailable.ts` — pese al directorio `crons/`, no es periódico: vive ahí porque es donde ya vive el resto de lógica de notificación disparada por evento de carrera (mismo criterio que `checkResults.ts`). Contiene la query interna (listar `myRaces` de una carrera con su `profile`) y la `internalAction` que itera y llama a `dispatchAndLog`.
- **Modify** `app/admin/races/[id]/page.tsx` — añade el campo `photosUrl` al formulario.
- **Create** `scripts/test-photos-available-template.ts` — smoke test standalone de la plantilla (mismo patrón que `scripts/test-chiplevante-parser.ts`).

---

### Task 1: Schema — campo `photosUrl` en `races` y tipo `photos_available` en `notificationLog`

**Files:**
- Modify: `convex/schema.ts:213` (bloque "URLs clave" de `races`)
- Modify: `convex/schema.ts:561-569` (unión `type` de `notificationLog`)

- [ ] **Step 1: Añadir `photosUrl` al schema de `races`**

En `convex/schema.ts`, justo debajo de la línea `resultsUrl: v.optional(v.string()),` (línea 213):

```ts
    resultsUrl: v.optional(v.string()),            // link a resultados del cronometrador
    photosUrl: v.optional(v.string()),             // link a la galería de fotos del proveedor (pegado a mano por el admin)
```

- [ ] **Step 2: Añadir `"photos_available"` a la unión `type` de `notificationLog`**

En `convex/schema.ts`, dentro de `notificationLog: defineTable({ type: v.union(...) })` (líneas 561-569), añade la línea nueva al final de la unión, antes del paréntesis de cierre:

```ts
    type: v.union(
      v.literal("welcome"),
      v.literal("reminder_7d"),
      v.literal("reminder_1d"),
      v.literal("result_found"),
      v.literal("result_not_found"),
      v.literal("weekly_digest"),
      v.literal("year_review"),
      v.literal("photos_available"),
    ),
```

- [ ] **Step 3: Verificar que Convex acepta el schema**

Run: `npx convex dev --once`
Expected: termina sin error de schema (puede tardar unos segundos; si no hay `CONVEX_DEPLOYMENT` configurado localmente, usa el comando que ya uses para deployar a dev — revisa `README.md` o pregunta si no es obvio).

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(fotos-carrera): añadir photosUrl a races y photos_available a notificationLog"
```

---

### Task 2: Propagar el nuevo tipo `photos_available` a `emailDispatch.ts` y `emailNotificationsHelpers.ts`

**Files:**
- Modify: `convex/emailDispatch.ts:20-33` (`hasLog`), `convex/emailDispatch.ts:47-60` (`writeLog`), `convex/emailDispatch.ts:78-95` (`dispatchAndLog`)
- Modify: `convex/emailNotificationsHelpers.ts:50-63` (`hasLogForMyRace`), `convex/emailNotificationsHelpers.ts:90-102` (`writeLog`)

- [ ] **Step 1: Añadir el literal en las 3 uniones de `convex/emailDispatch.ts`**

Busca las 3 apariciones de este bloque (en `hasLog`, `writeLog`, `dispatchAndLog`) y añade la línea nueva en cada una, igual que en Task 1:

```ts
    type: v.union(
      v.literal("welcome"),
      v.literal("reminder_7d"),
      v.literal("reminder_1d"),
      v.literal("result_found"),
      v.literal("result_not_found"),
      v.literal("weekly_digest"),
      v.literal("year_review"),
      v.literal("photos_available"),
    ),
```

- [ ] **Step 2: Añadir el literal en las 2 uniones de `convex/emailNotificationsHelpers.ts`**

Mismo bloque, mismo literal nuevo, en `hasLogForMyRace` (línea ~54-62) y `writeLog` (línea ~94-102).

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit -p convex/tsconfig.json`

Si no existe ese tsconfig específico, usa: `npx tsc --noEmit`

Expected: sin errores nuevos relacionados con `photos_available` o con las uniones tocadas. (Puede haber otros errores preexistentes en el repo no relacionados — ignóralos si ya estaban antes de este cambio; compara con `git stash` si tienes dudas.)

- [ ] **Step 4: Commit**

```bash
git add convex/emailDispatch.ts convex/emailNotificationsHelpers.ts
git commit -m "feat(fotos-carrera): propagar tipo photos_available a emailDispatch y emailNotificationsHelpers"
```

---

### Task 3: Plantilla de email `photosAvailable`

**Files:**
- Create: `convex/emails/templates/photosAvailable.ts`
- Create: `scripts/test-photos-available-template.ts`

- [ ] **Step 1: Escribir la plantilla**

Crea `convex/emails/templates/photosAvailable.ts` con este contenido (mismo esqueleto visual que `reminder.ts`, sin bloque de info-rows porque no hay dorsal/predicción que mostrar aquí):

```ts
// =============================================================================
// mi-dorsal — Email: fotos de carrera disponibles
// =============================================================================
// Se envía cuando el admin pega photosUrl por primera vez en una carrera
// (ver convex/races.ts adminUpdate + convex/crons/notifyPhotosAvailable.ts).
// Sin adjuntos, sin diploma — un único CTA a la galería del proveedor.
// =============================================================================

const COLORS = {
  primary: "#dc2626",
  warm: "#fafaf9",
  dark: "#0a0a0a",
  ink: "#1c1917",
  muted: "#78716c",
  subtle: "#a8a29e",
  line: "#e7e5e4",
  card: "#ffffff",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function photosAvailableEmail(args: {
  userName: string;
  raceName: string;
  raceDate: string; // ya formateada, ej "25 de octubre de 2026"
  photosUrl: string;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const { userName, raceName, raceDate, photosUrl, appUrl } = args;

  const safeUserName = escapeHtml(userName);
  const safeRaceName = escapeHtml(raceName);
  const safeRaceDate = escapeHtml(raceDate);
  const safePhotosUrl = escapeHtml(photosUrl);

  const subject = `📸 ¡Ya están tus fotos de ${safeRaceName}!`;
  const preheader = `Las fotos oficiales de ${safeRaceName} ya están disponibles. Busca tu dorsal.`;

  const footerHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px; border-top: 1px solid ${COLORS.line}; padding-top: 20px;">
      <tr>
        <td style="color: ${COLORS.muted}; font-size: 13px; line-height: 1.6;">
          <div>— Manu, en mi-dorsal</div>
          <div style="margin-top: 4px; font-style: italic; color: ${COLORS.subtle};">El hilo que te une a tu dorsal.</div>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 16px;">
          <a href="${appUrl}/perfil" style="color: ${COLORS.muted}; font-size: 12px; text-decoration: underline; margin-right: 16px;">Tu perfil</a>
          <a href="${appUrl}/calendario" style="color: ${COLORS.muted}; font-size: 12px; text-decoration: underline;">Calendario</a>
        </td>
      </tr>
    </table>
  `;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background: ${COLORS.warm}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: ${COLORS.ink}; -webkit-font-smoothing: antialiased;">
  <span style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">${escapeHtml(preheader)}</span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${COLORS.warm}; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background: ${COLORS.card}; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04);">

          <!-- Brand header -->
          <tr>
            <td style="padding: 16px 28px; border-bottom: 1px solid ${COLORS.line};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <span style="display: inline-block; width: 24px; height: 24px; background: ${COLORS.primary}; border-radius: 6px; vertical-align: middle; margin-right: 8px; line-height: 24px; text-align: center; color: white; font-size: 14px; font-weight: 700;">m</span>
                    <span style="font-size: 15px; font-weight: 600; color: ${COLORS.dark}; vertical-align: middle;">mi-dorsal</span>
                  </td>
                  <td align="right" style="color: ${COLORS.muted}; font-size: 12px; vertical-align: middle;">
                    Fotos disponibles
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding: 32px 28px 16px; text-align: center;">
              <div style="display: inline-block; background: ${COLORS.primary}; color: white; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; padding: 4px 10px; border-radius: 4px; margin-bottom: 14px;">
                📸 Fotos disponibles
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: ${COLORS.dark}; line-height: 1.3;">
                Hola, ${safeUserName}
              </h1>
              <p style="margin: 10px 0 0; font-size: 16px; color: ${COLORS.ink}; line-height: 1.5;">
                Ya están las fotos de <strong>${safeRaceName}</strong>
              </p>
              <div style="margin-top: 6px; color: ${COLORS.muted}; font-size: 14px;">
                ${safeRaceDate}
              </div>
            </td>
          </tr>

          <!-- Body copy + CTA -->
          <tr>
            <td style="padding: 8px 28px 28px;">
              <p style="font-size: 15px; line-height: 1.65; color: ${COLORS.ink}; margin: 0;">
                Busca tu dorsal en la galería oficial para encontrar tus fotos de meta.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
                <tr>
                  <td align="center">
                    <a href="${safePhotosUrl}" style="display: inline-block; background: ${COLORS.primary}; color: white; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px;">
                      Ver mis fotos
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 0 28px 28px;">
              ${footerHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Hola, ${userName}.`,
    "",
    `Ya están las fotos de ${raceName} (${raceDate}).`,
    "",
    "Busca tu dorsal en la galería oficial para encontrar tus fotos de meta.",
    "",
    `Fotos: ${photosUrl}`,
    "",
    "— Manu, en mi-dorsal",
  ].join("\n");

  return { subject, html, text };
}
```

- [ ] **Step 2: Escribir el smoke test standalone**

Crea `scripts/test-photos-available-template.ts`:

```ts
// Smoke test de la plantilla de email photos_available
import { photosAvailableEmail } from "../convex/emails/templates/photosAvailable";

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗"}  ${label}`);
  if (cond) pass++;
  else fail++;
}

const { subject, html, text } = photosAvailableEmail({
  userName: "María",
  raceName: "10K Ciudad de Valencia",
  raceDate: "25 de octubre de 2026",
  photosUrl: "https://fotos-proveedor.example.com/evento/123",
  appUrl: "https://www.mi-dorsal.com",
});

check("subject incluye el nombre de la carrera", subject.includes("10K Ciudad de Valencia"));
check("html incluye el enlace a photosUrl", html.includes("https://fotos-proveedor.example.com/evento/123"));
check("html escapa el nombre de usuario", !html.includes("<script>"));
check("text incluye el enlace a photosUrl", text.includes("https://fotos-proveedor.example.com/evento/123"));
check("text incluye el nombre del usuario", text.includes("María"));

// Caso con caracteres especiales en el nombre de carrera (XSS/HTML injection)
const withHtmlInName = photosAvailableEmail({
  userName: "Test",
  raceName: '<script>alert("x")</script>',
  raceDate: "1 de enero de 2027",
  photosUrl: "https://example.com",
  appUrl: "https://www.mi-dorsal.com",
});
check(
  "html escapa nombres de carrera con HTML embebido",
  !withHtmlInName.html.includes("<script>alert"),
);

console.log(`\n${pass} OK, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 3: Ejecutar el smoke test**

Run: `npx tsx scripts/test-photos-available-template.ts`
Expected: las 6 líneas con `✓` y al final `6 OK, 0 fail`, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add convex/emails/templates/photosAvailable.ts scripts/test-photos-available-template.ts
git commit -m "feat(fotos-carrera): plantilla de email photos_available"
```

---

### Task 4: Action de notificación `notifyPhotosAvailable`

**Files:**
- Create: `convex/crons/notifyPhotosAvailable.ts`

- [ ] **Step 1: Escribir la query interna + la action**

Crea `convex/crons/notifyPhotosAvailable.ts`:

```ts
// =============================================================================
// mi-dorsal — Notificación: fotos de carrera disponibles
// =============================================================================
// NO es un cron periódico (a diferencia de los demás archivos en este
// directorio) — se dispara una sola vez, agendado desde
// convex/races.ts adminUpdate cuando el admin pega photosUrl por primera
// vez en una carrera. Vive en convex/crons/ porque es donde ya está el
// resto de la lógica de notificación disparada por evento de carrera
// (mismo criterio que checkResults.ts).
//
// Itera todas las myRaces de la carrera y envía un email a cada corredor
// inscrito, vía emailDispatch.dispatchAndLog (con adjuntos NO — a
// diferencia de result_found, este email es solo texto+enlace).
// =============================================================================

import { internalAction, internalQuery } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { photosAvailableEmail } from "../emails/templates/photosAvailable";

// ---------------------------------------------------------------------------
// Query: myRaces de una carrera + profile + email, listas para notificar
// ---------------------------------------------------------------------------

type NotifyItem = {
  myRaceId: Id<"myRaces">;
  userId: Id<"profiles">;
  email: string;
  displayName: string | undefined;
};

export const getRunnersForRace = internalQuery({
  args: { raceId: v.id("races") },
  handler: async (ctx, { raceId }): Promise<NotifyItem[]> => {
    const myRaces = await ctx.db
      .query("myRaces")
      .withIndex("by_race", (q) => q.eq("raceId", raceId))
      .collect();

    const items: NotifyItem[] = [];
    for (const myRace of myRaces) {
      const profile = await ctx.db.get(myRace.userId);
      if (!profile?.email) continue; // sin email no podemos avisar
      items.push({
        myRaceId: myRace._id,
        userId: profile._id,
        email: profile.email,
        displayName: profile.displayName,
      });
    }
    return items;
  },
});

// ---------------------------------------------------------------------------
// Action: envía el aviso a todos los inscritos de la carrera
// ---------------------------------------------------------------------------

export const notifyPhotosAvailable = internalAction({
  args: { raceId: v.id("races") },
  handler: async (ctx, { raceId }) => {
    const race = await ctx.runQuery(api.races.get, { id: raceId });
    if (!race || !race.photosUrl) {
      console.warn(`[photos-available] race ${raceId} sin photosUrl, abortando`);
      return;
    }

    const runners = await ctx.runQuery(
      internal.crons.notifyPhotosAvailable.getRunnersForRace,
      { raceId },
    );

    const raceDateFormatted = race.startDate
      ? new Date(race.startDate).toLocaleDateString("es-ES", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.mi-dorsal.com").replace(/\/$/, "");

    let sent = 0;
    let skipped = 0;

    for (const runner of runners) {
      const alreadySent = await ctx.runQuery(internal.emailDispatch.hasLog, {
        userId: runner.userId,
        myRaceId: runner.myRaceId,
        type: "photos_available",
      });
      if (alreadySent) {
        skipped++;
        continue;
      }

      const { subject, html, text } = photosAvailableEmail({
        userName: runner.displayName ?? "corredor",
        raceName: race.name,
        raceDate: raceDateFormatted,
        photosUrl: race.photosUrl,
        appUrl,
      });

      await ctx.runAction(internal.emailDispatch.dispatchAndLog, {
        to: runner.email,
        subject,
        html,
        text,
        userId: runner.userId,
        myRaceId: runner.myRaceId,
        type: "photos_available",
      });
      sent++;
    }

    console.log(
      `[photos-available] raceId=${raceId}: ${sent} emails enviados, ${skipped} ya notificados`,
    );
  },
});
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `convex/crons/notifyPhotosAvailable.ts`.

- [ ] **Step 3: Commit**

```bash
git add convex/crons/notifyPhotosAvailable.ts
git commit -m "feat(fotos-carrera): action notifyPhotosAvailable"
```

---

### Task 5: Disparo desde `adminUpdate` al guardar `photosUrl`

**Files:**
- Modify: `convex/races.ts:373-493` (unión `patch` de `adminUpdate.args`)
- Modify: `convex/races.ts:495-520` (handler de `adminUpdate`)

- [ ] **Step 1: Añadir `photosUrl` a la unión `patch`**

En `convex/races.ts`, dentro de `adminUpdate.args.patch` (línea ~390, junto a `resultsUrl`):

```ts
      resultsUrl: v.optional(v.string()),
      photosUrl: v.optional(v.string()),
```

- [ ] **Step 2: Detectar la transición y agendar la notificación**

En `convex/races.ts`, el handler actual de `adminUpdate` es (líneas 495-520):

```ts
  handler: async (ctx, { id, patch }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Race not found");
    // Si cambia el nombre, regeneramos el slug evitando colisiones
    const update: any = { ...patch };
    if (patch.name && patch.name !== existing.name) {
      const baseSlug = slugify(patch.name);
      let finalSlug = baseSlug;
      let suffix = 2;
      while (true) {
        const conflict = await ctx.db
          .query("races")
          .withIndex("by_slug", (q) => q.eq("slug", finalSlug))
          .first();
        if (!conflict || conflict._id === id) break;
        finalSlug = `${baseSlug}-${suffix}`;
        suffix++;
        if (suffix > 100) throw new Error(`Demasiadas colisiones para slug "${baseSlug}"`);
      }
      update.slug = finalSlug;
    }
    await ctx.db.patch(id, update);
    return id;
  },
```

Reemplázalo por (añade la detección de transición ANTES del patch, usando `existing.photosUrl`, y el `scheduler.runAfter` DESPUÉS del patch):

```ts
  handler: async (ctx, { id, patch }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Race not found");
    // Si cambia el nombre, regeneramos el slug evitando colisiones
    const update: any = { ...patch };
    if (patch.name && patch.name !== existing.name) {
      const baseSlug = slugify(patch.name);
      let finalSlug = baseSlug;
      let suffix = 2;
      while (true) {
        const conflict = await ctx.db
          .query("races")
          .withIndex("by_slug", (q) => q.eq("slug", finalSlug))
          .first();
        if (!conflict || conflict._id === id) break;
        finalSlug = `${baseSlug}-${suffix}`;
        suffix++;
        if (suffix > 100) throw new Error(`Demasiadas colisiones para slug "${baseSlug}"`);
      }
      update.slug = finalSlug;
    }

    // Fotos disponibles: solo se avisa en la transición vacío → con valor,
    // para no reenviar el email cada vez que el admin retoca la URL ya
    // publicada. Se comprueba ANTES del patch, comparando contra el valor
    // que existía en BD (no contra `patch.photosUrl`, que solo dice qué
    // vino en esta llamada).
    const isNewPhotosUrl =
      typeof patch.photosUrl === "string" &&
      patch.photosUrl.trim().length > 0 &&
      (!existing.photosUrl || existing.photosUrl.trim().length === 0);

    await ctx.db.patch(id, update);

    if (isNewPhotosUrl) {
      await ctx.scheduler.runAfter(0, internal.crons.notifyPhotosAvailable.notifyPhotosAvailable, {
        raceId: id,
      });
    }

    return id;
  },
```

- [ ] **Step 3: Añadir el import de `internal` si no existe ya**

`convex/races.ts` línea 1-8 no importa `internal` hoy (solo usa `query`/`mutation` directos). Añade el import junto a los demás:

```ts
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
```

- [ ] **Step 4: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `convex/races.ts`.

- [ ] **Step 5: Commit**

```bash
git add convex/races.ts
git commit -m "feat(fotos-carrera): disparar notifyPhotosAvailable al guardar photosUrl por primera vez"
```

---

### Task 6: Campo `photosUrl` en el panel admin

**Files:**
- Modify: `app/admin/races/[id]/page.tsx:40-56` (estado inicial del formulario)
- Modify: `app/admin/races/[id]/page.tsx:108-127` (objeto `patch` enviado)
- Modify: `app/admin/races/[id]/page.tsx:379-389` (JSX del formulario)

- [ ] **Step 1: Añadir `photosUrl` al estado inicial**

En el `useEffect` que rellena `form` desde `race` (línea 40-56), añade la línea junto a `resultsUrl`:

```ts
        resultsUrl: race.resultsUrl ?? "",
        photosUrl: race.photosUrl ?? "",
```

- [ ] **Step 2: Añadir `photosUrl` al `patch` del submit**

En el `submit` (línea 108-127), añade junto a `resultsUrl`:

```ts
          resultsUrl: form.resultsUrl || undefined,
          photosUrl: form.photosUrl || undefined,
```

- [ ] **Step 3: Añadir el `<input>` al JSX**

En el bloque de 3 columnas que ya tiene "Web oficial" / "URL inscripción" / "URL resultados" (línea 379-389), esas 3 columnas están en un `grid grid-cols-1 md:grid-cols-3`. Añade una fila nueva debajo con el campo de fotos (no lo metas en la misma grid de 3 columnas para no forzar 4 columnas en breakpoints intermedios):

```tsx
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Web oficial">
            <input type="url" value={form.officialUrl} onChange={(e) => set("officialUrl", e.target.value)} className="input" />
          </Field>
          <Field label="URL inscripción">
            <input type="url" value={form.registrationUrl} onChange={(e) => set("registrationUrl", e.target.value)} className="input" />
          </Field>
          <Field label="URL resultados">
            <input type="url" value={form.resultsUrl} onChange={(e) => set("resultsUrl", e.target.value)} className="input" />
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="URL fotos (avisa a los inscritos al guardar)">
            <input type="url" value={form.photosUrl} onChange={(e) => set("photosUrl", e.target.value)} className="input" />
          </Field>
        </div>
```

- [ ] **Step 4: Verificar que compila el frontend**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `app/admin/races/[id]/page.tsx`.

- [ ] **Step 5: Commit**

```bash
git add "app/admin/races/[id]/page.tsx"
git commit -m "feat(fotos-carrera): campo photosUrl en el panel admin de carreras"
```

---

### Task 7: Actualizar la documentación de referencia

**Files:**
- Modify: `docs/core/emails-crons.md:22-34` (tabla de tipos de email)

- [ ] **Step 1: Añadir la fila nueva a la tabla de tipos**

En `docs/core/emails-crons.md`, la tabla de "Sistema de emails (7 tipos vía `notificationLog`)" (línea 22) pasa a ser de 8 tipos. Actualiza el título y añade la fila:

```markdown
## Sistema de emails (8 tipos vía `notificationLog`)

Todos pasan por `convex/emailDispatch.ts → dispatchAndLog` — **única función que llama a Resend**. No hardcodear envíos fuera de aquí.

| Tipo | Trigger | Estado |
|---|---|---|
| `welcome` | Al crear profile (onboarding) | Activo |
| `reminder_7d` | Cron reminder-pre-race, 7d antes | Activo |
| `reminder_1d` | Cron reminder-pre-race, 1d antes | Activo |
| `result_found` ⭐ | Cron check-results, al detectar dorsal | Activo. Incluye diploma PDF |
| `result_not_found` | Cron result-not-found, 48h tras carrera | Activo |
| `weekly_digest` | Cron weekly-digest | Placeholder, sin cablear |
| `year_review` | Cron year-review | Placeholder, sin cablear |
| `photos_available` | `races.adminUpdate`, al pegar `photosUrl` por primera vez | Activo. Primer uso real de `dispatchAndLog` (no cron, no adjuntos) |
```

- [ ] **Step 2: Commit**

```bash
git add docs/core/emails-crons.md
git commit -m "docs(fotos-carrera): documentar photos_available en emails-crons.md"
```

---

### Task 8: Prueba manual end-to-end en dev

**Files:** ninguno (verificación manual, sin cambios de código)

- [ ] **Step 1: Arrancar Convex dev**

Run: `npx convex dev`
Expected: sincroniza el schema nuevo sin error.

- [ ] **Step 2: Arrancar Next.js dev en otra terminal**

Run: `npm run dev`
Expected: sirve en `http://localhost:3000`.

- [ ] **Step 3: Preparar una carrera de prueba con al menos una `myRace`**

En el panel admin (`/admin/races`), abre una carrera que ya tengas en local con al menos un usuario inscrito (`myRace`) con email real o de prueba. Si no tienes ninguna, usa el flujo normal de la app para apuntarte a una carrera desde tu propio usuario de dev.

- [ ] **Step 4: Guardar `photosUrl` por primera vez**

En `/admin/races/[id]`, rellena el campo nuevo "URL fotos" con cualquier URL de prueba (ej. `https://example.com/fotos-test`) y guarda.

- [ ] **Step 5: Verificar el log del email**

Si no tienes `RESEND_API_KEY` en `.env.local`, revisa la terminal donde corre `npx convex dev` — debe aparecer una línea `[email-mock] photos_available → <email>: 📸 ¡Ya están tus fotos de ...!` (formato de log de `dispatchAndLog`, confirmar el texto exacto en `convex/emailDispatch.ts` líneas 103-108 al ejecutar, ya que puede diferir ligeramente del de `sendResultFoundEmail`).

Expected: un log por cada `myRace` de esa carrera con email.

- [ ] **Step 6: Verificar idempotencia — guardar otra vez**

Vuelve a `/admin/races/[id]` y guarda sin cambiar `photosUrl` (o cambiándola a otra URL, no vaciándola primero). No debe aparecer ningún log nuevo de email — la transición ya no es "vacío → con valor".

- [ ] **Step 7: Verificar `notificationLog` en el dashboard de Convex**

Run: `npx convex dashboard`
Expected: en la tabla `notificationLog`, una fila nueva por cada corredor notificado, con `type: "photos_available"`, `delivered: true`, `relatedMyRaceId` apuntando a la `myRace` correcta.

No hay commit en esta tarea — es solo verificación manual antes de dar el trabajo por terminado.

---

## Resumen de archivos tocados

| Archivo | Tipo de cambio |
|---|---|
| `convex/schema.ts` | Modify — `photosUrl` en `races`, `photos_available` en `notificationLog` |
| `convex/emailDispatch.ts` | Modify — `photos_available` en 3 uniones |
| `convex/emailNotificationsHelpers.ts` | Modify — `photos_available` en 2 uniones |
| `convex/emails/templates/photosAvailable.ts` | Create — plantilla del email |
| `scripts/test-photos-available-template.ts` | Create — smoke test de la plantilla |
| `convex/crons/notifyPhotosAvailable.ts` | Create — query + action de notificación |
| `convex/races.ts` | Modify — `photosUrl` en `adminUpdate`, disparo del scheduler |
| `app/admin/races/[id]/page.tsx` | Modify — campo `photosUrl` en el formulario |
| `docs/core/emails-crons.md` | Modify — documentar el tipo nuevo |

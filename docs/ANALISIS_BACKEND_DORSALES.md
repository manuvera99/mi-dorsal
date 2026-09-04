# mi-dorsal — Análisis funcional y técnico del backend de tracking de dorsales

> **Autor:** Mavis (análisis como desarrollador senior especializado en scraping + datos de running)
> **Fecha:** 4 sept 2026
> **Estado del documento:** Análisis en frío. Sin código modificado todavía.
> **Veredicto rápido:** la infraestructura está al 60%, el cableado crítico está al 20%. Hay un esqueleto muy bien pensado y TODO comments enormes. Si ejecutamos este plan, en 4-6 semanas podemos tener el flujo end-to-end real funcionando.

---

## 0. Resumen ejecutivo (léeme primero)

### ¿Qué tienes ya?

✅ **Schema de Convex muy bien diseñado** — tablas `myRaces`, `raceResultsCache`, `notificationLog`, `personalRecords`, `predictions` con índices correctos.
✅ **Sistema de ingest robusto** — 6 fuentes (RFEA, FEDME, ITRA, Sportmaniacs, Runedia, Correbirras) + 2 IA (`analyze-source`, `extract-race-deep`).
✅ **Crons configurados** — 5 crons registrados (`check-results`, `reminder-pre-race`, `weekly-digest`, `year-review`, `recalc-stats`).
✅ **Templates de email escritos** — `resultFound`, `reminderEmail` con HTML + texto.
✅ **Wrapper de Resend** — `sendEmail` interno en `convex/emails/sendEmail.ts`.
✅ **Sistema de stats cacheado** — patrón de denormalización para no quemar el plan free.
✅ **Predicción con Riegel + Daniels VDOT** — calibración ya con `errorPct`.

### ¿Qué NO tienes (y es la pregunta que haces)?

❌ **Los emails NO se envían.** Hay un `// TODO: send email` literal en `checkResults.ts:116` y en `reminderPreRace.ts:87`. El template existe, el wrapper existe, pero nadie lo llama.
❌ **`scraperAdapter` está en el schema pero NUNCA se setea** desde la UI admin. Los 4 adapters del `scraper.ts` son genéricos/placeholder. No hay ninguno específico para los cronometradores reales de España.
❌ **No hay detección de cronometrador.** El campo `resultsUrl` se rellena a mano en admin y no hay nada que diga "esta URL es de Dorsalchip, usa adapter X".
❌ **No hay validación "está apuntado en la lista de corredores"** que pides. El sistema asume que si el usuario dice su dorsal, es verdad.
❌ **No hay scraping reactivo el día de carrera** con arranque a las X horas post-salida. El cron `check-results` corre cada 6h en una ventana [-1d, +7d] muy amplia y a ciegas.
❌ **`userEmail` está hardcodeado** como `"user@example.com"` en `checkResults.ts:61`. No hay forma de saber a qué email mandar.
❌ **No hay webhook de Clerk** para sincronizar el email en el `profile`.
❌ **No hay agente IA que monitorice el estado de un dorsal** y notifique contexto (p. ej. "el dorsal X no aparece porque la carrera cambió de chip company el día anterior").
❌ **`weeklyDigest` y `yearReview` son stubs vacíos.**

### Lo crítico: por qué importa

Si mañana un usuario añade su dorsal en una carrera, **no recibe NADA**. Ni recordatorio, ni resultado, ni email. Toda la columna vertebral del producto (que es esto, no la ficha de carrera SEO) está sin cablear.

Esto es lo que diferencia mi-dorsal de "otro listado más": **el corredor mete su dorsal y la app le avisa cuando sale su tiempo**. Sin esto, no hay retención ni enganche.

---

## 1. Análisis funcional (qué hace falta desde el punto de vista del usuario)

### 1.1. El viaje ideal del usuario (definición funcional)

```
Semana 0:
  - El usuario descubre la carrera en mi-dorsal
  - Se inscribe en la web del organizador
  - Añade la carrera a "Mis carreras" en mi-dorsal
  - Mete su dorsal cuando lo recibe

Semana -1 (7 días antes):
  - Recibe email: "Tu carrera X es en 7 días, dorsal #1234, hora 09:30"
  - App muestra: "Faltan 7 días, 23 horas"

Día -1 (24h antes):
  - Recibe email: "Mañana es el día, X, lugar Y, dorsal #1234"
  - Email incluye predicción de tiempo, recomendaciones (desayuno, meteo)
  - App badge con cuenta atrás

Día 0 — SALIDA (T+0):
  - El corredor está en la línea de salida con su dorsal

Día 0 — T+2h/4h (post-carrera):
  - La app empieza a scrapear los resultados del cronometrador
  - Si el dorsal aparece: el sistema cachea el resultado
  - Email automático: "🏁 Tu tiempo en X: 1:42:35, posición 234 de 3500"

Día 0 — T+6h/12h:
  - Si el dorsal no aparece todavía (cronometrador no ha publicado, o el dorsal es incorrecto):
    - Email "Aún no hemos encontrado tu tiempo en X, te avisaremos cuando esté"
    - Reintentos cada 2-4h hasta 48h después

Día 0 — T+24h (carreras grandes, 10K Valencia, Maratón Valencia):
  - Si sigue sin aparecer: email "Seguimos buscando tu tiempo. ¿Quieres meterlo a mano?"
  - Link a /perfil con el formulario de resultado manual

Día +2/+3:
  - Si aparece: email definitivo con tiempo + posición + categoría
  - Genera diploma PDF
  - Genera entrada en "Personal Records" si es PR

Día +7:
  - Si NO apareció nunca (caso raro): email final
    "No hemos podido encontrar tu tiempo en X. ¿Te apuntaste con otro dorsal? Puedes añadirlo a mano."

Cada lunes 9am:
  - Resumen semanal: "Esta semana tienes N carreras, 1 en 7 días, 2 resultados nuevos"

1 de enero:
  - "Tu año en carreras: N carreras, M km totales, mejor tiempo X, posición media Y"
```

### 1.2. Gaps funcionales concretos (mapeados a archivos)

| # | Gap funcional | Estado actual | Archivo a tocar | Prioridad |
|---|---|---|---|---|
| **G1** | Email de recordatorio 7d/1d | Template existe, NO se llama | `crons/reminderPreRace.ts` | 🔴 P0 |
| **G2** | Email "resultado encontrado" | Template existe, NO se llama | `crons/checkResults.ts:116` | 🔴 P0 |
| **G3** | Webhook de Clerk → guarda email real en profile | NO existe | `convex/http.ts` (nuevo) | 🔴 P0 |
| **G4** | Hardcoded `userEmail = "user@example.com"` | Literal en código | `crons/checkResults.ts:61` | 🔴 P0 |
| **G5** | Detección automática de cronometrador desde `resultsUrl` | NO existe | `lib/ai/detect-timing.ts` (nuevo) | 🔴 P0 |
| **G6** | Adapters reales para cronometradores de España | Solo 4 genéricos | `convex/scraper.ts` | 🔴 P0 |
| **G7** | UI admin para elegir/ver `scraperAdapter` | Solo campo de texto libre | `app/admin/races/[id]/page.tsx` | 🟠 P1 |
| **G8** | Validación "el corredor está apuntado" (startlist) | NO existe | nueva lógica | 🟠 P1 |
| **G9** | Cron "el día de carrera, scraping temprano" | Cron existe pero no es inteligente | `crons/checkResults.ts` | 🟠 P1 |
| **G10** | Reintentos progresivos tras carrera (2h, 6h, 24h, 48h) | NO existe | nuevo flujo | 🟠 P1 |
| **G11** | Email "no hemos encontrado tu tiempo" | NO existe | nueva action | 🟡 P2 |
| **G12** | Weekly digest funcional | Stub vacío | `crons/weeklyDigest.ts` | 🟡 P2 |
| **G13** | Year in review funcional | Stub vacío | `crons/yearReview.ts` | 🟡 P2 |
| **G14** | Generación de diploma PDF | Función `lib/pdf/diploma.tsx` existe, ¿se llama? | verificar | 🟡 P2 |
| **G15** | UI para meter resultado manual desde email | ¿Existe? | verificar | 🟡 P2 |
| **G16** | Agente IA que explique "no encuentro tu dorsal porque..." | NO existe | nuevo | 🟢 P3 (nice-to-have) |

---

## 2. Análisis técnico (por qué cada gap es importante y qué cuesta)

### 2.1. G1 + G2: Los emails NO se envían (el cableado crítico)

**Qué falta técnicamente:**

```typescript
// AHORA en checkResults.ts:116
// TODO: enviar email
// await ctx.runAction(internal.emails.sendResultFound, { ... });

// LO QUE TIENE QUE HABER
await ctx.runAction(internal.emails.sendResultFoundEmail, {
  to: userEmail,                            // ← primero: ¿de dónde sale?
  userName: profile.displayName,
  raceName: race.name,
  raceDate: race.startDate,
  timeFormatted: formatTime(result.timeSeconds),
  positionOverall: result.positionOverall,
  positionCategory: result.positionCategory,
  totalRunners: result.totalRunners,         // ← ¿lo scrapeamos?
  predictedTimeFormatted: formatTime(myRace.predictedTimeSeconds),
  errorPct: calculateErrorPct(myRace.predictedTimeSeconds, result.timeSeconds),
  appUrl: process.env.APP_URL!,
});
```

**Dependencias:**
- Necesita `userEmail` real (G3 + G4)
- Necesita el action `sendResultFoundEmail` (NO existe en `convex/emails/sendEmail.ts` — solo existe el template `resultFoundEmail(...)` y el wrapper genérico `sendEmail(...)`)
- Necesita `totalRunners` del scrape (G6)

**Coste:** Bajo. 30 min. Escribir el action que llama al template y al wrapper.

---

### 2.2. G3 + G4: Webhook de Clerk + email real

**Por qué es bloqueante:**

`Convex` puede leer el email del `ctx.auth.getUserIdentity()` SOLO si está configurado en `convex/auth.config.ts`. Si no, el `identity.email` viene vacío.

**Verificar ahora mismo:**
- Leer `convex/auth.config.ts` para ver qué providers están configurados
- Verificar si Clerk pasa el email o no
- Si no, configurar `email_address` en el JWT template de Clerk

**Webhook alternativo (más fiable):**

```typescript
// convex/http.ts (NUEVO)
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const event = await request.json();
    if (event.type === "user.created" || event.type === "user.updated") {
      await ctx.runMutation(internal.users.upsertFromClerkWebhook, {
        clerkUserId: event.data.id,
        email: event.data.email_addresses[0]?.email_address,
        displayName: event.data.first_name
          ? `${event.data.first_name} ${event.data.last_name ?? ""}`.trim()
          : event.data.username,
        avatarUrl: event.data.image_url,
      });
    }
    return new Response("ok", { status: 200 });
  }),
});

export default http;
```

Y guardar el email como campo en `profiles` (¡OJO: **NO está en el schema actual**! Hay que añadirlo).

**Cambio de schema requerido:**

```typescript
// En convex/schema.ts → tabla profiles
email: v.optional(v.string()),  // ← AÑADIR
emailVerified: v.optional(v.boolean()),
```

**Coste:** 1-2h (cambio schema + http.ts + webhook handler + secret de Clerk en Convex env).

---

### 2.3. G5: Detección automática de cronometrador

**El problema:**

Cuando el admin mete `resultsUrl: "https://dorsalchip.com/carrera/123"`, no hay nada que diga "esto es Dorsalchip, usa adapter `dorsalchip`". El `scraperAdapter` está vacío y el cron cae al adapter `generic` que es basura.

**Solución: función `detectTimingProvider(url: string)` con heurística + LLM fallback.**

```typescript
// lib/ai/detect-timing.ts (NUEVO)

export type TimingProvider =
  | "mysports"
  | "dorsalchip"
  | "championchip"
  | "rockthesport"
  | "sportmaniacs"
  | "runedia"
  | "correbirras"
  | "finishers"
  | "toprun"
  | "evoltiming"
  | "manual";   // no scrapeable

const HEURISTIC_MAP: Array<{ pattern: RegExp; provider: TimingProvider }> = [
  { pattern: /mysportsresults\.com/i, provider: "mysports" },
  { pattern: /dorsalchip\.com/i, provider: "dorsalchip" },
  { pattern: /championchip\.es|championchip\.com/i, provider: "championchip" },
  { pattern: /rockthesport\.com/i, provider: "rockthesport" },
  { pattern: /sportmaniacs\.com/i, provider: "sportmaniacs" },
  { pattern: /runedia\.es/i, provider: "runedia" },
  { pattern: /correbirras\.com/i, provider: "correbirras" },
  { pattern: /finishers\.com|finishers\.es/i, provider: "finishers" },
  { pattern: /toprun\.es/i, provider: "toprun" },
  { pattern: /evoltiming\.com|evoltiming\.es/i, provider: "evoltiming" },
];

export function detectTimingProviderHeuristic(url: string): TimingProvider | null {
  for (const { pattern, provider } of HEURISTIC_MAP) {
    if (pattern.test(url)) return provider;
  }
  return null;
}

// Fallback con LLM si la heurística no chilla
export async function detectTimingProviderLLM(url: string): Promise<TimingProvider> {
  // 1. fetch la URL
  // 2. mirar el HTML: meta tags, footer, copyright
  // 3. prompt a LLM: "¿qué empresa de cronometraje usa esta web?"
  // 4. devolver el provider
}
```

**Cuándo se llama:**
- En el admin, al meter `resultsUrl` → auto-detectar y autocompletar `scraperAdapter`
- En el cron `checkResults` → si `scraperAdapter` está vacío, detectar al vuelo

**Coste:** 2-3h incluyendo los adapters reales (G6).

---

### 2.4. G6: Adapters reales para cronometradores de España

**Lo que hay ahora (basura):**

```typescript
// scraper.ts — 4 adapters que NO funcionan con ninguna web real
ADAPTERS = {
  mysports: scrapeMysports,        // Heurística rota
  dorsalchip: scrapeDorsalchip,    // Idem
  championchip: scrapeChampionchip,// delega en generic
  generic: scrapeGeneric,          // búsqueda en <tr>, no funciona con web moderna
}
```

**Lo que hay que hacer: 1 adapter por cronometrador real, con un test mínimo por adapter.**

Cronometradores más usados en España (de mayor a menor):

| Cronometrador | URL típica | Cobertura | Dificultad scraping |
|---|---|---|---|
| **MySports** | `resultados.mysportsresults.com/...` | ~40% carreras populares | Media (tabla HTML, sin JS) |
| **Dorsalchip** | `dorsalchip.com/carrera/...` | ~15% | Fácil |
| **ChampionChip** | `championchip.es/...` | ~10% | Media |
| **RockTheSport** | `rockthesport.com/event/...` | ~10% | Fácil (tienen API) |
| **Sportmaniacs** | `sportmaniacs.com/es/races/...` | ~10% | Media |
| **Runedia** | `runedia.es/carrera/...` | ~5% | Media (anti-bot a veces) |
| **TopRun** | `toprun.es/...` | ~3% | Fácil |
| **Correbirras** | `correbirras.com/...` | <3% | Fácil (Supabase REST) |
| **Evoltiming** | `evoltiming.com/...` | <3% | Media |
| **Otros / manuales** | sin URL | resto | No scrapeable |

**Estrategia pragmática:**

No hace falta implementar los 10. Empezar por los 4 que cubren ~75% del mercado:
1. MySports (40%)
2. Dorsalchip (15%)
3. RockTheSport (10%, tiene API)
4. ChampionChip (10%)

Los demás caen en `generic` (que hay que rehacer para que funcione) o `manual` (con aviso al usuario "no podemos scrapear, mételo a mano").

**API de RockTheSport (¡oro!):**

`https://api.rockthesport.com/...` — tiene endpoint público para listar resultados por evento. **Cero scraping HTML.** Esto es lo que debería ser el patrón para el futuro.

**Coste:** 6-8h para los 4 adapters principales + rehacer `generic`.

---

### 2.5. G7: UI admin para `scraperAdapter`

**Ahora mismo en `app/admin/races/[id]/page.tsx:387`:**

```tsx
<Field label="URL resultados">
  <input type="url" value={form.resultsUrl} onChange={(e) => set("resultsUrl", e.target.value)} className="input" />
</Field>
```

**Lo que debería haber:**

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <Field label="URL resultados">
    <input type="url" value={form.resultsUrl} onChange={(e) => {
      set("resultsUrl", e.target.value);
      // Auto-detectar al cambiar
      const detected = detectTimingProviderHeuristic(e.target.value);
      if (detected) set("scraperAdapter", detected);
    }} className="input" />
  </Field>
  <Field label="Cronometrador (auto-detectado)">
    <select value={form.scraperAdapter} onChange={(e) => set("scraperAdapter", e.target.value)} className="input">
      <option value="">— Auto-detectar —</option>
      <option value="mysports">MySports (resultados.mysportsresults.com)</option>
      <option value="dorsalchip">Dorsalchip</option>
      <option value="championchip">ChampionChip</option>
      <option value="rockthesport">RockTheSport (tiene API)</option>
      ...
    </select>
  </Field>
</div>
```

**Coste:** 30 min. Es UI pura, llamar a `detectTimingProviderHeuristic` client-side.

---

### 2.6. G8: Validación "está apuntado en la lista de corredores"

**Por qué importa (tu pregunta clave):**

Si el usuario mete un dorsal inventado o incorrecto, el scraper no va a encontrar nada y vamos a mandar emails falsos. Necesitamos validar que el dorsal está en la lista de inscritos **antes** de empezar a scrapear resultados.

**Cronometradores que publican listas de inscritos:**

- **MySports**: a veces `?mode=inscritos` en la URL, no siempre
- **Dorsalchip**: sí, ruta específica
- **Sportmaniacs**: sí, ruta `/{slug}/inscritos`
- **Correbirras**: sí (es Supabase)
- **RockTheSport**: sí, vía API

**Estrategia:**

```typescript
// lib/ai/scrape-startlist.ts (NUEVO)

export async function scrapeStartlist(
  resultsUrl: string,
  dorsal: string,
  provider: TimingProvider,
): Promise<{ found: boolean; runnerName?: string; category?: string }> {
  // 1. Construir URL de inscritos según el provider
  // 2. Scrapear la tabla
  // 3. Buscar el dorsal del usuario
  // 4. Si está: devolver { found: true, runnerName, category }
  // 5. Si NO está: devolver { found: false }
  // 6. Si no hay lista pública: devolver { found: null, reason: "no_public_list" }
}
```

**Cuándo se llama:**

- En el momento que el usuario mete su dorsal en `/calendario` → validar inmediatamente
- Si NO está en la lista: warning "No hemos encontrado tu dorsal X en la lista de inscritos de Y. ¿Es correcto? Si no, edítalo."

**Por qué IA aquí:**

Algunos cronometradores cambian el formato de la lista. Un LLM que mire el HTML y diga "este es el dorsal 1234, pertenece a Juan Pérez, categoría M35" es más robusto que selectores CSS que rompen con cada release.

**Pero OJO: empezamos SIN IA** para no quemar tokens. Selectores CSS primero, IA solo cuando fallen.

**Coste:** 4-6h para los 4 cronometradores principales sin IA.

---

### 2.7. G9 + G10: Cron reactivo el día de carrera con reintentos

**El problema actual:**

```typescript
// crons/checkResults.ts:6-10
crons.interval("check-results", { hours: 6 }, ...);
```

Esto corre cada 6h en una ventana de **8 días** (-1d a +7d). Para una carrera popular:
- El usuario corre a las 9:00
- Resultados se publican a las 11:00
- El cron siguiente puede ser a las 13:00 o a las 19:00 (depende de cuándo arrancó)
- El email puede llegar 8h después de la carrera

**Lo que queremos:**

- Cuando una carrera está en [-1h, +1h] respecto a su hora de salida: **chequear cada 30 min**
- Cuando está en [+1h, +6h]: **cada 1h**
- Cuando está en [+6h, +48h]: **cada 6h**
- Cuando está en [+48h, +7d]: **cada 24h**

**Implementación:**

Mantener el cron cada 30 min, pero que internamente decida qué carreras chequear con qué frecuencia basándose en la diferencia entre `Date.now()` y `race.startDate`.

```typescript
// crons/checkResults.ts (refactor)
function getCheckFrequency(raceTimeMs: number, nowMs: number): "skip" | "aggressive" | "normal" | "sparse" {
  const diffH = (raceTimeMs - nowMs) / 3600_000;
  if (diffH > 7 * 24) return "skip";
  if (diffH > 48) return "sparse";        // cada 24h
  if (diffH > 6) return "normal";        // cada 6h
  if (diffH > -1) return "aggressive";   // cada 30 min (pre-salida)
  // post-carrera
  const elapsedH = (nowMs - raceTimeMs) / 3600_000;
  if (elapsedH < 6) return "aggressive";  // 30 min post
  if (elapsedH < 48) return "normal";     // cada 6h
  if (elapsedH < 7 * 24) return "sparse"; // cada 24h
  return "skip";
}
```

Y el cron a 30 min:

```typescript
crons.interval("check-results", { minutes: 30 }, internal.crons.checkResults.checkResults);
```

Dentro del action, filtrar por frecuencia y `resultScrapedAt` (ya existe el campo).

**Estado actual del scrape:** se marca `resultScrapedAt` en `updateMyRace` ✅. Solo falta la lógica de frecuencia.

**Coste:** 2-3h.

---

### 2.8. G11: Email "no hemos encontrado tu tiempo"

**Necesario para que el flujo no quede cojo:**

Después de 48h sin resultado, mandar un email "Hemos buscado tu dorsal 1234 en la carrera X y no aparece. Esto puede pasar porque: (a) la organización aún no ha publicado, (b) tu dorsal es incorrecto, (c) la carrera cambió de cronometrador. Si quieres meterlo a mano, hazlo aquí: [link]"

**Implementación:**

```typescript
// crons/checkResults.ts — al final de la action
// Después de cada race, si NO se encontró resultado y han pasado 48h:
// 1. Verificar que no se haya enviado ya el "result_not_found" email
// 2. Enviar email
// 3. Loguear en notificationLog
```

**Coste:** 1h. Es un email nuevo + una entrada en `notificationLog` con `type: "result_not_found"`.

---

### 2.9. G12: Weekly digest funcional

**Estado actual:** stub que cuenta usuarios activos y hace `console.log("Would send to N users")`.

**Lo que tiene que hacer:**

Cada lunes 9am:
- Para cada usuario activo (con `myRaces` en últimos 30 días):
  - Calcular: carreras en próximos 7 días, resultados nuevos esta semana, total de km (estimado)
  - Renderizar email con esos datos
  - Enviar vía Resend

**Datos que ya tienes:**
- `myRaces` con `startDate` y `actualTimeSeconds` ✅
- `notificationLog` para no re-enviar ✅
- `races` con `distanceKm` ✅

**Lo que hay que escribir:**
- Una action `convex/emails/sendWeeklyDigest.ts`
- Una plantilla `convex/emails/templates/weeklyDigest.ts`
- Cablear el cron

**Coste:** 3-4h.

---

### 2.10. G13: Year in review

**Estado actual:** stub. Cuenta carreras del año anterior.

**Lo que tiene que hacer:**

1 de enero 10am:
- Para cada usuario con carreras el año anterior:
  - Calcular: total carreras, total km, mejor tiempo por distancia, posición media, gráfica mensual
  - Renderizar email "Your Year in Races" con gráfica SVG
  - Enviar

**Esto es la guinda del engagement** pero es trabajo gordo. Lo dejaría para Sprint 3.

**Coste:** 6-8h (diseño + cálculo + plantilla + email con gráfica).

---

## 3. Dónde meter IA (con cabeza, no por meterla)

### 3.1. IA que SÍ aporta valor aquí

| Caso | Por qué IA | Cuándo NO usar IA |
|---|---|---|
| **Detectar cronometrador** (G5) | El HTML puede tener firmas sutiles (footer, copyright, "Powered by Dorsalchip") que un LLM pilla mejor que regex | Si la heurística de URL ya funciona, NO gastes tokens |
| **Parsear resultado de un cronometrador nuevo** | Adapter nuevo sin selector CSS conocido: LLM mira el HTML y devuelve `{ dorsal, time, name }` | Si tienes un adapter CSS estable, NO |
| **Explicar al usuario por qué no se encontró su tiempo** | "¿Quieres que te explique qué pasó?" → LLM mira logs del scrape, errores, tiempo desde carrera y genera mensaje empático | Si la regla es fija ("48h, no aparece → email X"), NO |
| **Generar copy de weekly digest / year review** | Personalizar el texto al usuario ("Has corrido un 10% más que el año pasado, tu mejor marca es en media maratón...") | Para emails transaccionales críticos (result_found), NO |
| **Categorización automática de carreras** (ya existe con `extract-race.ts`) | Sí, útil para ingest masiva | — |
| **Matching de carreras duplicadas cross-source** (ya existe `systemUpsert`) | Sí, crítico | — |

### 3.2. IA que NO aporta valor (cuesta más de lo que da)

- ❌ Validar "está apuntado" cuando un selector CSS de Dorsalchip lo hace en 50ms y gratis
- ❌ Parsear emails (nadie envía emails a sí mismo)
- ❌ "Resumen inteligente" de una carrera cuando ya tienes un template fijo
- ❌ Scraping de HTML muy estructurado (tablas claras) — selectores CSS > LLM

### 3.3. El truco: IA como fallback, no como camino feliz

```typescript
async function scrapeRaceResults(
  url: string,
  dorsal: string,
  provider?: TimingProvider,
): Promise<RunnerResult | null> {
  // Camino 1: adapter CSS (gratis, 100ms)
  if (provider) {
    const result = await scrapeWithAdapter(url, dorsal, provider);
    if (result) return result;
  }
  
  // Camino 2: LLM fallback (caro, 2-3s, pero flexible)
  if (process.env.OPENAI_API_KEY) {
    const html = await fetchHtml(url);
    const result = await scrapeWithLLM(html, dorsal);
    if (result) return result;
  }
  
  return null;
}
```

**Coste por scrape con IA:** ~$0.001-0.005 (gpt-4o-mini). A 1000 carreras/día = $1-5/día. **No asusta**, pero NO lo hagas por defecto.

---

## 4. ¿Y un agente? Dónde tiene sentido

### 4.1. Concepto: "Dorsal Agent"

Un agente IA que **vigila** el ciclo de vida de un `myRace` y toma decisiones:

```
Input: myRace con status=planned, dorsal, startDate en -2h
├─ Llama scrapeStartlist(resultsUrl, dorsal)
│  ├─ NO encontrado: ¿es válida la URL? ¿caducó? → sugiere alternativas
│  └─ Encontrado: confirma y actualiza category si estaba vacía
├─ Calcula cuándo empieza la carrera
└─ Programa vigilancia: T-1h, T+2h, T+6h, T+24h, T+48h

Input: myRace con startDate en T+0
├─ ¿Hay resultados scrapeados? 
│  ├─ Sí: notifica, marca como done
│  └─ No: programa reintentos

Input: myRace con startDate en T+48h sin resultados
├─ Lee los logs de los últimos 5 intentos de scrape
├─ Genera un diagnóstico:
│  "He buscado tu dorsal 5 veces. Las 3 primeras la página daba 404, las 2 últimas daba 
│   un error de servidor. Esto sugiere que el cronometrador (Dorsalchip) tuvo un problema
│   técnico, no que tu dorsal sea incorrecto."
├─ Envía email con el diagnóstico
└─ Sugiere: meter resultado manual / verificar dorsal
```

### 4.2. Implementación con agentes (3 opciones, de menos a más)

**Opción A: "Pseudo-agente" con código determinista (RECOMENDADO para empezar)**

No es un agente IA, es un **flujo de estados** bien hecho.

```typescript
// convex/dorsalAgent/stateMachine.ts (NUEVO)
type DorsalState = 
  | "pre_list_check"     // antes de carrera, validar que está apuntado
  | "list_validated"     // está en la lista
  | "list_not_found"     // NO está en la lista (warning al usuario)
  | "race_day"           // día de carrera
  | "scraping_retry"     // post-carrera, reintentando
  | "result_found"       // ¡bingo!
  | "result_not_found"   // no apareció tras 48h
  | "manual_fallback"    // usuario metió a mano
  | "abandoned";         // sin resolución tras 7d

function transition(state: DorsalState, event: Event): DorsalState { ... }
```

Cada vez que un cron corre, transiciona estados y dispara emails. **No hay LLM, es código puro.** Es lo que recomiendo para Sprint 1-2.

**Opción B: Agente IA real con tool use (Sprint 3-4)**

Un agente que tiene herramientas:
- `scrape_startlist(url, dorsal)` → boolean
- `scrape_results(url, dorsal, provider)` → result | null
- `send_email(userId, template, vars)` → void
- `update_my_race(myRaceId, fields)` → void
- `get_last_n_logs(myRaceId, n)` → logs

Y un prompt del sistema: "Eres el agente que gestiona el ciclo de vida del dorsal de un usuario. Tu objetivo es encontrar su tiempo y notificárselo lo antes posible. Si el cronometrador falla, explica por qué. Si no hay datos públicos, sugiere acción manual."

**Cuándo:** Sprint 3+ cuando el flujo determinista esté dominado y queramos diagnóstico inteligente.

**Coste:** 8-12h incluyendo guardrails y tests.

**Opción C: Multi-agente con OpenAI Swarm o similar (futuro)**

Un agente por cronometrador:

```
DorsalMasterAgent
├─ MySportsAgent (sabe cómo scrapear MySports)
├─ DorsalchipAgent
├─ RockTheSportAgent (con API)
└─ GenericAgent (IA para los raros)
```

Tiene sentido si escaleamos a 10+ cronometradores y cada uno tiene lógica compleja. **No es para ahora.**

---

## 5. Plan de implementación por sprints (con honestidad)

### Sprint 0: "Cableado crítico" (3-4 días)

**Objetivo:** que un email llegue de punta a punta.

- [ ] **Añadir `email` y `emailVerified` al schema de `profiles`** (migración en Convex es auto, pero el código que inserta tiene que actualizar)
- [ ] **Configurar Clerk para que pase el email en el JWT** (Clerk Dashboard → JWT Templates → añadir `email_address` claim)
- [ ] **Crear `convex/http.ts` con webhook de Clerk** (`user.created` / `user.updated` → `upsertFromClerkWebhook`)
- [ ] **Action `convex/emails/sendResultFoundEmail.ts`** que toma los args, llama al template y al wrapper
- [ ] **Action `convex/emails/sendReminderEmail.ts`** (7d y 1d)
- [ ] **Modificar `crons/checkResults.ts`** para llamar a `sendResultFoundEmail` cuando hay resultado
- [ ] **Modificar `crons/reminderPreRace.ts`** para enviar emails reales (no console.log)
- [ ] **Test manual end-to-end**: crear usuario, meter dorsal, ver email de recordatorio, simular scrape OK, ver email de resultado

**Salida:** un usuario puede recibir 2 tipos de email (recordatorio + resultado).

---

### Sprint 1: "Cronometradores reales" (1-1.5 semanas)

- [ ] **`lib/ai/detect-timing.ts`** con heurística + LLM fallback
- [ ] **Adapters reales para MySports, Dorsalchip, RockTheSport, ChampionChip** (4 cronometradores, ~75% cobertura)
- [ ] **UI admin**: dropdown con cronometradores auto-detectados
- [ ] **Refactor `scraper.ts`** para que sea extensible (registro dinámico de adapters)
- [ ] **Tests**: para cada adapter, 1 carrera real de muestra. Guardar HTML en `scripts/output/test-adapters/`
- [ ] **Documentar en `docs/SCRAPER_ADAPTERS.md`** la estructura HTML de cada cronometrador

**Salida:** ~75% de carreras populares scrapeables automáticamente.

---

### Sprint 2: "Validación de dorsal + reintentos" (1 semana)

- [ ] **`lib/ai/scrape-startlist.ts`** — validación de dorsal en lista de inscritos
- [ ] **UI `/calendario`**: warning si el dorsal no se valida
- [ ] **Refactor `crons/checkResults.ts`**: frecuencia adaptativa (cada 30 min cerca de la carrera)
- [ ] **Email `result_not_found`**: 48h después sin resultado
- [ ] **Cronometrador en `scraperAdapter`** también con heurística (mismo `detectTimingProvider`)

**Salida:** flujo robusto pre + durante + post carrera con notificaciones.

---

### Sprint 3: "Engagement loop" (1.5 semanas)

- [ ] **Weekly digest funcional** (template + action + cron)
- [ ] **Year in review** (con gráfica SVG)
- [ ] **Diploma PDF automático** (verificar `lib/pdf/diploma.tsx` y cablearlo al email de resultado)
- [ ] **UI en email "result_found"** con link a diploma + share social
- [ ] **Personal Records**: cuando se detecta un PR, celebrarlo en el email

**Salida:** ciclo de retención semanal/anual.

---

### Sprint 4: "Agente IA + diagnóstico" (1 semana, opcional)

- [ ] **Opción A (state machine puro)**: terminarla
- [ ] **Opción B (agente IA con tools)**: empezar si la opción A tiene huecos
- [ ] **Email de diagnóstico inteligente** cuando no se encuentra resultado
- [ ] **Dashboard admin** de "estados de dorsales" (cuántos en scraping_retry, cuántos en abandoned, etc.)

**Salida:** diagnóstico de fallos, recuperación proactiva.

---

## 6. Riesgos y cosas a tener en cuenta

### 6.1. Rate limits y bloqueos

**MySports**, **Dorsalchip** y otros cronometradores pueden:
- Bloquear por IP si haces scraping agresivo
- Devolver CAPTCHA
- Cambiar el HTML y romper tu adapter

**Mitigación:**
- User-Agent real (no `mi-dorsal/0.1`, sino `Mozilla/5.0 (compatible; mi-dorsal/1.0; +https://mi-dorsal.es)`)
- Cachear resultados: si ya scrapeamos una carrera hace 5 min, no volver
- Respetar `robots.txt` (al menos los que sean razonables)
- Si un adapter falla 3 veces seguidas, marcar la carrera como "scrape_failed" y avisar al admin

### 6.2. Coste de IA

- `gpt-4o-mini` a $0.15/1M input tokens
- Un scrape con LLM fallback = ~3000 tokens input + 200 output = $0.0005
- A 1000 scrapes/día = $0.50/día = $15/mes
- A 10.000 scrapes/día = $5/día = $150/mes

**Regla:** IA solo en fallback, solo si el adapter CSS falla. No en happy path.

### 6.3. Email deliverability

- Resend en plan free = 100 emails/día, 3.000/mes
- En cuanto tengas 50+ usuarios activos, te quedas sin free
- Plan Pro de Resend = $20/mes, 50.000 emails
- **Coste esperado a 1.000 usuarios activos**: ~$20-50/mes solo de emails
- **Mitigación**: weekly digest es opt-in (ya hay flag `emailWeeklyDigestEnabled`)

### 6.4. Convex free tier

- 1 GB/mes de Database I/O
- El cron cada 30 min × 24h × 30 días = 1440 calls/mes de checkResults
- Cada call: 1 query de carreras + N scrapes
- **Si 1.000 usuarios con 5 carreras cada uno en ventana = 5.000 scrapes/mes**
- Cada scrape = 1 fetch externo (gratis) + 1 insert en cache (facturable)
- **Mitigación**: el `statsCache` ya está optimizando, copiar el patrón

---

## 7. Lo que NO voy a recomendarte hacer

- ❌ **No hagas un agente IA "porque sí"** sin tener el flujo determinista dominado. Es meter complexity antes de validar.
- ❌ **No scrappees con Playwright/headless browser** a menos que sea estrictamente necesario. Convex actions pueden hacer `fetch` y los adapters HTML son 100x más baratos.
- ❌ **No mandes emails en cada cambio de estado** del state machine. Manda en hitos: 7d, 1d, result_found, result_not_found (48h), y ya.
- ❌ **No intentes cubrir 10 cronometradores en Sprint 1.** Cubre 4 que sumen 75% del mercado. El resto cae en `manual` con email al usuario.
- ❌ **No hagas un sistema de "comentarios de la comunidad sobre el cronometrador"**. No es el core. El core es "encuentro tu tiempo rápido".

---

## 8. Decisiones que tienes que tomar antes de Sprint 0

- [ ] **¿Tienes `RESEND_API_KEY` configurado en Convex?** Si no, todo el Sprint 0 se hace en modo mock.
- [ ] **¿Tienes `OPENAI_API_KEY` para el LLM fallback de scraping?** Si no, el Sprint 1 se hace solo con heurística.
- [ ] **¿Cuál es el dominio de email de salida?** (`resultados@mi-dorsal.es` está en el código, pero verifica que el dominio esté verificado en Resend)
- [ ] **¿Aceptas migrar el schema para añadir `email` a `profiles`?** Es aditivo (no rompe nada), pero requiere deploy.
- [ ] **¿El plan de Resend aguanta el volumen esperado?** A 50 usuarios activos, sí. A 500, necesitas Pro ($20/mes).

---

## 9. Mi recomendación final, resumida

**Si tuviera que elegir UNA sola cosa para hacer esta semana:**

> **Cablea el webhook de Clerk + el email real + el email de recordatorio 1d.**

¿Por qué? Porque es el mínimo que demuestra al usuario que "esta app hace algo por mí". Sin recordatorio, mi-dorsal es un listado. Con recordatorio, es una herramienta.

**Si tuviera que elegir DOS cosas:**

> Lo anterior + el email de resultado encontrado.

¿Por qué? Porque ese es el "¡Bingo!" que justifica todo el producto. Cuando un usuario recibe "🏁 Tu tiempo en X: 1:42:35" sin haber hecho nada, vuelve.

**Si tuviera que elegir TRES cosas:**

> Las dos anteriores + un adapter real (MySports, que cubre el 40% del mercado).

¿Por qué? Porque sin adapter real, el email de resultado se queda sin contenido. Necesitas el scrape funcionando para que el email tenga sentido.

**El resto (agente IA, weekly digest, year review, diploma PDF) puede esperar.** Es la guinda. El core es: detecta cronometrador, scrapea, notifica. Tres cosas.

---

**Próximo paso:** si estás de acuerdo con este plan, empiezo por Sprint 0 el lunes. Avísame de las decisiones del punto 8 y arranco.

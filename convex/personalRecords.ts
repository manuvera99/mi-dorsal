// =============================================================================
// mi-dorsal — Personal Records
// =============================================================================

import { v } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { api } from "./_generated/api";
import { requireUser, getOptionalUser, getDistanceLabel } from "./_helpers";

/**
 * Lista los PRs **actuales** (mejor marca por distancia) del usuario.
 * Devuelve [] si no hay usuario (en vez de throw) para no romper la UI.
 *
 * Filtra `isCurrent = true` porque `upsert` mantiene un histórico: cada vez
 * que el usuario bate un PR, el antiguo se marca como `isCurrent = false` y
 * se inserta el nuevo. Si devolviéramos todos, la UI del perfil mostraría
 * la misma distancia repetida N veces (una por cada mejora histórica), y
 * las predicciones VDOT se contaminarían con tiempos viejos.
 *
 * Deduplicación defensiva extra: si por inconsistencia legacy hubiera
 * varios `isCurrent = true` en la misma distancia, nos quedamos con el de
 * menor `timeSeconds` (la mejor marca, por definición).
 */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    const all = await ctx.db
      .query("personalRecords")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const current = all.filter((pr) => pr.isCurrent === true);
    // Defensivo: una sola fila por distancia, la mejor (menor tiempo).
    const byDistance = new Map<number, (typeof current)[number]>();
    for (const pr of current) {
      const prev = byDistance.get(pr.distanceM);
      if (!prev || pr.timeSeconds < prev.timeSeconds) {
        byDistance.set(pr.distanceM, pr);
      }
    }
    return Array.from(byDistance.values());
  },
});

/**
 * Devuelve un PR concreto por su _id, validando que pertenece al usuario
 * actual. Devuelve `null` si no existe o no es del usuario.
 *
 * Usado por la página de detalle `/perfil/pr/[id]`.
 */
export const getById = query({
  args: { id: v.id("personalRecords") },
  handler: async (ctx, { id }) => {
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    const pr = await ctx.db.get(id);
    if (!pr) return null;
    if (pr.userId !== user._id) return null;
    return pr;
  },
});

/**
 * Historial completo de PRs del usuario en una distancia concreta, incluyendo
 * los históricos (`isCurrent = false`). Ordenado por `timeSeconds` asc — el
 * más rápido primero, que es el PR actual.
 *
 * Usado por la página de detalle de PR para mostrar la evolución: "este es
 * tu 5K actual, antes tenías 24:00, antes 25:30…".
 */
export const getMyDistanceHistory = query({
  args: { distanceM: v.number() },
  handler: async (ctx, { distanceM }) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    const all = await ctx.db
      .query("personalRecords")
      .withIndex("by_user_distance", (q) =>
        q.eq("userId", user._id).eq("distanceM", distanceM),
      )
      .collect();
    return all.sort((a, b) => a.timeSeconds - b.timeSeconds);
  },
});

/**
 * Devuelve el best_effort de Strava que corresponde a este PR dentro de
 * su actividad fuente, o null si no hay actividad fuente / el detail
 * no tiene best_efforts / no hay match por distancia.
 *
 * Útil para mostrar en el detalle del PR el contexto del esfuerzo
 * (splits, latlng de inicio/fin, pr_rank) cuando el PR se logró dentro
 * de una actividad más larga. P.ej. un 5K PR dentro de una carrera
 * de 10K devuelve el best_effort "5k" de esa actividad.
 *
 * No muta nada: el best_effort viene del `rawStravaDetail.best_efforts[]`
 * que Strava devuelve y que guardamos en el ingest.
 */
export const getBestEffortForPr = query({
  args: { prId: v.id("personalRecords") },
  handler: async (ctx, { prId }) => {
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    const pr = await ctx.db.get(prId);
    if (!pr || pr.userId !== user._id) return null;
    if (!pr.sourceActivityId) return null;
    const activity = await ctx.db.get(pr.sourceActivityId);
    if (!activity || activity.userId !== user._id) return null;
    const detail = activity.rawStravaDetail as
      | { best_efforts?: Array<{ name: string; distance: number; moving_time: number; elapsed_time: number; pr_rank?: number | null; start_latlng?: [number, number] | null; end_latlng?: [number, number] | null; start_date_local?: string }> }
      | undefined;
    const efforts = detail?.best_efforts;
    if (!efforts || efforts.length === 0) return null;
    // Strava nombra los best_efforts como "5k", "10k", "Half-Marathon", etc.
    // Buscamos por nombre que case con nuestra distancia (1% tolerancia).
    const target = pr.distanceM;
    const found = efforts.find(
      (e) => Math.abs(e.distance - target) / target < 0.01,
    );
    if (!found) return null;
    return {
      effort: found,
      // Splits subset: si la actividad tiene splits_metric y el esfuerzo
      // viene de una actividad más larga, devolvemos solo los splits que
      // caen dentro del esfuerzo (los primeros N hasta sumar la distancia).
      splits: (() => {
        const all = activity.splitsMetric as
          | Array<{ split: number; distance: number; moving_time: number; elevation_difference: number; average_speed: number; average_heartrate?: number; average_cadence?: number }>
          | undefined;
        if (!all) return null;
        if (!activity.distanceM || activity.distanceM <= target * 1.05) {
          // La actividad coincide con el esfuerzo: todos los splits.
          return all;
        }
        // Subset: primeros splits hasta alcanzar la distancia del esfuerzo.
        const subset: typeof all = [];
        let acc = 0;
        for (const s of all) {
          if (acc >= target) break;
          subset.push(s);
          acc += s.distance;
        }
        return subset;
      })(),
    };
  },
});

/**
 * Upsert de un PR. Marca el antiguo como `isCurrent=false` y el nuevo como true.
 *
 * Dispara automáticamente el trigger de onboarding `users.markFirstPrAdded`
 * (idempotente) cuando se inserta un PR nuevo. Devuelve un objeto con:
 *   - id:          id del PR insertado (o el current si no se insertó nada)
 *   - saved:       true si se ha insertado un registro nuevo (primera marca
 *                  en esta distancia, o mejora de la existente). false si el
 *                  tiempo enviado es igual o peor que el PR actual — no se
 *                  tocó la base de datos.
 *   - isFirstPr:   true si este fue el primer PR del usuario (no había current
 *                  en NINGUNA distancia, no solo esta)
 *   - wasImproved: true si `saved` es true Y ya había un PR previo en esta
 *                  distancia (es decir, se ha batido un récord existente,
 *                  no es la primera marca en esta distancia). Con `saved`
 *                  ya no es ambiguo con "no se guardó".
 */
export const upsert = mutation({
  args: {
    distanceM: v.number(),
    distanceLabel: v.string(),
    timeSeconds: v.number(),
    achievedAt: v.optional(v.string()),
    raceId: v.optional(v.id("races")),
    /** Actividad de Strava de la que se extrajo este PR. Si se pasa, debe
     *  existir y ser del usuario actual (validamos aquí). Permite al
     *  usuario pegar una URL de Strava al crear el PR y obtener el mapa
     *  / splits / gear gratis. */
    sourceActivityId: v.optional(v.id("activities")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Si pasan sourceActivityId, validar que existe y es del usuario.
    // Si no es válido, lo ignoramos (no fallamos — podría ser que Strava
    // aún no se sincronizó y el usuario pegó la URL por adelantado).
    let validatedActivityId: typeof args.sourceActivityId | undefined = undefined;
    if (args.sourceActivityId) {
      const a = await ctx.db.get(args.sourceActivityId);
      if (a && a.userId === user._id) {
        validatedActivityId = args.sourceActivityId;
      }
    }

    // Buscar PR actual para esta distancia
    const current = await ctx.db
      .query("personalRecords")
      .withIndex("by_user_distance_current", (q) =>
        q
          .eq("userId", user._id)
          .eq("distanceM", args.distanceM)
          .eq("isCurrent", true),
      )
      .unique();

    if (current) {
      // Si el nuevo tiempo es peor, no hacer nada
      if (args.timeSeconds >= current.timeSeconds) {
        return { id: current._id, saved: false, isFirstPr: false, wasImproved: false };
      }
      // Marcar el antiguo como histórico
      await ctx.db.patch(current._id, { isCurrent: false });
    }

    // Detectar si este es el primer PR del usuario (en cualquier distancia)
    // antes de hacer el insert.
    const totalPRsBefore = await ctx.db
      .query("personalRecords")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const isFirstPr = totalPRsBefore.length === 0;

    const id = await ctx.db.insert("personalRecords", {
      userId: user._id,
      distanceM: args.distanceM,
      distanceLabel: args.distanceLabel,
      timeSeconds: args.timeSeconds,
      achievedAt: args.achievedAt,
      raceId: args.raceId,
      sourceActivityId: validatedActivityId,
      source: "manual",
      isCurrent: true,
    });

    // Trigger de onboarding (idempotente — solo setea si no estaba)
    await ctx.runMutation(api.users.markFirstPrAdded, {});

    return { id, saved: true, isFirstPr, wasImproved: current != null };
  },
});

/**
 * Vincula un PR existente a una actividad de Strava. Usado desde la página
 * de detalle de PR para que el usuario pueda "Buscar actividad" o pegar
 * una URL de Strava y obtener el mapa / splits / gear sin re-introducir
 * la marca a mano.
 *
 * Valida que:
 *  - El PR es del usuario.
 *  - La actividad es del usuario.
 *
 * Si ya había un `sourceActivityId` previo, lo sobreescribe.
 */
export const linkToActivity = mutation({
  args: {
    prId: v.id("personalRecords"),
    activityId: v.id("activities"),
  },
  handler: async (ctx, { prId, activityId }) => {
    const user = await requireUser(ctx);
    const pr = await ctx.db.get(prId);
    if (!pr) throw new Error("PR not found");
    if (pr.userId !== user._id) throw new Error("Forbidden");
    const a = await ctx.db.get(activityId);
    if (!a) throw new Error("Activity not found");
    if (a.userId !== user._id) throw new Error("Forbidden");
    await ctx.db.patch(prId, { sourceActivityId: activityId });
    return { ok: true };
  },
});

/**
 * Quita el vínculo del PR con la actividad de Strava (deja `sourceActivityId = undefined`).
 * Útil si el usuario se equivoca de actividad y quiere desvincular.
 */
export const unlinkFromActivity = mutation({
  args: { prId: v.id("personalRecords") },
  handler: async (ctx, { prId }) => {
    const user = await requireUser(ctx);
    const pr = await ctx.db.get(prId);
    if (!pr) throw new Error("PR not found");
    if (pr.userId !== user._id) throw new Error("Forbidden");
    await ctx.db.patch(prId, { sourceActivityId: undefined });
    return { ok: true };
  },
});

/**
 * Backfill: para todos los PRs del usuario que tienen sourceActivityId
 * pero no sourceActivityDistanceLabel, calcula el label mirando la
 * actividad fuente. Si la actividad es más larga que el PR, guarda el
 * label (ej. "10K" para un PR de 5K dentro de 10K).
 *
 * También rellena sourceActivityIsRace si la actividad es de tipo "race".
 *
 * Admin: salta el check de auth. Llamar con `profileId` desde dashboard.
 */
export const backfillPrSourceActivityContext = mutation({
  args: { profileId: v.id("profiles"), force: v.optional(v.boolean()) },
  handler: async (ctx, { profileId, force }) => {
    const prs = await ctx.db
      .query("personalRecords")
      .withIndex("by_user", (q) => q.eq("userId", profileId))
      .collect();
    let updated = 0;
    for (const pr of prs) {
      if (!pr.sourceActivityId) continue;
      if (
        !force &&
        pr.sourceActivityDistanceLabel &&
        pr.sourceActivityIsRace !== undefined
      ) {
        continue;
      }
      const activity = await ctx.db.get(pr.sourceActivityId);
      if (!activity) continue;
      const patch: Record<string, unknown> = {};
      if (
        force ||
        !pr.sourceActivityDistanceLabel ||
        activity.distanceM > pr.distanceM * 1.1
      ) {
        if (activity.distanceM > pr.distanceM * 1.1) {
          const standard = getDistanceLabel(activity.distanceM);
          patch.sourceActivityDistanceLabel = standard.includes(".")
            ? `${(activity.distanceM / 1000).toFixed(1)}K`
            : standard;
        } else {
          // La actividad es la misma distancia que el PR: no necesitamos label.
          patch.sourceActivityDistanceLabel = undefined;
        }
      }
      if (force || pr.sourceActivityIsRace === undefined) {
        patch.sourceActivityIsRace = activity.type === "race";
      }
      await ctx.db.patch(pr._id, patch);
      updated++;
    }
    return { scanned: prs.length, updated };
  },
});

/**
 * Elimina un PR.
 */
export const remove = mutation({
  args: { id: v.id("personalRecords") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const pr = await ctx.db.get(id);
    if (!pr) throw new Error("PR not found");
    if (pr.userId !== user._id) throw new Error("Forbidden");
    await ctx.db.delete(id);
  },
});

/**
 * PR actual del usuario en una distancia (para emails: detectar si un
 * nuevo resultado bate el récord antes de enviar el email).
 * Devuelve null si no hay PR en esa distancia.
 */
export const getCurrentForUserAndDistance = internalQuery({
  args: {
    userId: v.id("profiles"),
    distanceM: v.number(),
  },
  handler: async (ctx, { userId, distanceM }) => {
    return await ctx.db
      .query("personalRecords")
      .withIndex("by_user_distance_current", (q) =>
        q.eq("userId", userId).eq("distanceM", distanceM).eq("isCurrent", true),
      )
      .unique();
  },
});

/**
 * Versión server-side de `upsert` para usar desde crons.
 * Si el nuevo tiempo mejora el PR actual (o no hay PR), lo persiste.
 * Marca el antiguo como isCurrent=false e inserta el nuevo con source="race_result".
 * Devuelve { updated, previousTimeSeconds } para que el caller sepa si batió récord.
 *
 * Pensado para llamarse DESPUÉS de enviar el email de resultado, para que
 * el email pueda leer el PR "viejo" como referencia y mostrar el badge
 * correctamente (siguiente vez, el PR nuevo ya es el current).
 */
export const updateIfBetter = internalMutation({
  args: {
    userId: v.id("profiles"),
    distanceM: v.number(),
    timeSeconds: v.number(),
    raceId: v.optional(v.id("races")),
    achievedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const current = await ctx.db
      .query("personalRecords")
      .withIndex("by_user_distance_current", (q) =>
        q
          .eq("userId", args.userId)
          .eq("distanceM", args.distanceM)
          .eq("isCurrent", true),
      )
      .unique();

    // Si el nuevo tiempo es igual o peor que el actual, no tocar nada.
    if (current && args.timeSeconds >= current.timeSeconds) {
      return { updated: false, previousTimeSeconds: current.timeSeconds };
    }

    const previousTimeSeconds = current?.timeSeconds;

    if (current) {
      await ctx.db.patch(current._id, { isCurrent: false });
    }

    const id = await ctx.db.insert("personalRecords", {
      userId: args.userId,
      distanceM: args.distanceM,
      distanceLabel: getDistanceLabel(args.distanceM),
      timeSeconds: args.timeSeconds,
      achievedAt: args.achievedAt,
      raceId: args.raceId,
      source: "race_result",
      isCurrent: true,
    });

    return { updated: true, id, previousTimeSeconds };
  },
});

// ---------------------------------------------------------------------------
// Admin / dev tools
// ---------------------------------------------------------------------------
//
// Estas mutations son herramientas destructivas para reset / testing.
// Reciben `profileId` explícito y saltan el check de auth (requieren que
// quien las llama sea un dev con acceso al dashboard de Convex o al CLI
// `npx convex run`). NO están expuestas en la UI.

/**
 * Borra TODOS los PRs del usuario indicado. Destructivo, sin confirm.
 * Pensado para: hacer un reset completo antes de re-sincronizar Strava
 * y verificar que el flow de extracción de PRs funciona desde cero.
 *
 * Llamada típica desde el dashboard de Convex → Functions →
 * `personalRecords:purgeAllMyPRs` con args `{ "profileId": "..." }` (el
 * profileId se ve en la tabla `profiles`).
 *
 * Orden sugerido: ejecutar esta → desconectar Strava (la mutation
 * `disconnectAndPurge` de stravaOauth borra las actividades OAuth) →
 * volver a conectar → el initial sync repuebla activities y PRs.
 */
export const purgeAllMyPRs = mutation({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, { profileId }) => {
    const all = await ctx.db
      .query("personalRecords")
      .withIndex("by_user", (q) => q.eq("userId", profileId))
      .collect();
    for (const pr of all) {
      await ctx.db.delete(pr._id);
    }
    return { deleted: all.length };
  },
});

/**
 * Para PRs del usuario cuyo `sourceActivityId` apunta a una actividad que
 * ya no existe, limpia el `sourceActivityId` (deja el PR pero desvinculado
 * de Strava). Útil tras un disconnectAndPurge — los PRs quedan huérfanos
 * con un id de actividad que ya no existe, y la query `getActivityFull`
 * devuelve null. Esto limpia esa referencia.
 *
 * Si quieres resetear los PRs también, usa `purgeAllMyPRs` en su lugar.
 */
export const unlinkOrphanedPRs = mutation({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, { profileId }) => {
    const all = await ctx.db
      .query("personalRecords")
      .withIndex("by_user", (q) => q.eq("userId", profileId))
      .collect();
    let unlinked = 0;
    for (const pr of all) {
      if (!pr.sourceActivityId) continue;
      const a = await ctx.db.get(pr.sourceActivityId);
      if (!a) {
        await ctx.db.patch(pr._id, { sourceActivityId: undefined });
        unlinked++;
      }
    }
    return { scanned: all.length, unlinked };
  },
});

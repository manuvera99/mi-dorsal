// =============================================================================
// mi-dorsal — My Races (calendario personal)
// =============================================================================

import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { requireUser, getOptionalUser, raceStatusValidator, getDistanceLabel } from "./_helpers";
import { predictForMyRace } from "../lib/prediction/predict";
import { getEffectiveDistance } from "../lib/prediction/effective-distance";
import { Doc, Id } from "./_generated/dataModel";

/**
 * Lista carreras del usuario actual con filtros.
 */
export const listMine = query({
  args: {
    status: v.optional(raceStatusValidator),
  },
  handler: async (ctx, { status }) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    let q = ctx.db
      .query("myRaces")
      .withIndex("by_user", (q) => q.eq("userId", user._id));
    if (status) {
      q = ctx.db
        .query("myRaces")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", user._id).eq("status", status),
        );
    }
    const myRaces = await q.collect();

    // Enriquecer con la carrera
    return await Promise.all(
      myRaces.map(async (myRace) => {
        const race = await ctx.db.get(myRace.raceId);
        return { ...myRace, race };
      }),
    );
  },
});

/**
 * Mi race específico (id interno).
 */
export const get = query({
  args: { id: v.id("myRaces") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const myRace = await ctx.db.get(id);
    if (!myRace) return null;
    if (myRace.userId !== user._id) return null;
    const race = await ctx.db.get(myRace.raceId);
    return { ...myRace, race };
  },
});

/**
 * Añade una carrera a mi calendario. Calcula predicción automáticamente.
 *
 * Dispara automáticamente el trigger de onboarding `users.markFirstRaceSaved`
 * (idempotente). Devuelve un objeto con info para que el cliente pueda
 * celebrar el momento:
 *   - id:              id del myRace insertado
 *   - totalCount:      total de carreras del calendario tras el insert
 *   - isFirstRace:     true si esta es la primera carrera (0 → 1)
 *   - justReachedThree:true si esta inserción lleva al usuario de 2 a 3
 *                      (primer "hilo real" — momento de delight)
 */
export const add = mutation({
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
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Verificar que no existe ya
    const existing = await ctx.db
      .query("myRaces")
      .withIndex("by_user_race", (q) =>
        q.eq("userId", user._id).eq("raceId", args.raceId),
      )
      .unique();
    if (existing) {
      throw new Error("Esta carrera ya está en tu calendario");
    }

    // Contar carreras ANTES del insert (necesario para detectar onboarding)
    const beforeMyRaces = await ctx.db
      .query("myRaces")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const countBefore = beforeMyRaces.length;

    // Obtener carrera
    const race = await ctx.db.get(args.raceId);
    if (!race) throw new Error("Race not found");

    // Calcular predicción. Si falla (ej. usuario sin PRs) seguimos adelante:
    // añadir al calendario no debe depender de tener PRs.
    const prs = await ctx.db
      .query("personalRecords")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("isCurrent"), true))
      .collect();

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

    // Guardar log de predicción solo si tenemos predicción
    if (prediction) {
      await ctx.db.insert("predictions", {
        userId: user._id,
        raceId: args.raceId,
        myRaceId: id,
        predictedTimeSeconds: prediction.predictedTimeSeconds,
        confidence: prediction.confidence,
        modelVersion: "daniels-vdot-v1",
        factors: prediction.factors,
      });
    }

    // Trigger de onboarding (idempotente — solo setea si no estaba)
    await ctx.runMutation(api.users.markFirstRaceSaved, {});

    return {
      id,
      totalCount: countBefore + 1,
      isFirstRace: countBefore === 0,
      justReachedThree: countBefore === 2, // pasa de 2 a 3
    };
  },
});

/**
 * Actualiza una carrera de mi calendario.
 */
export const update = mutation({
  args: {
    id: v.id("myRaces"),
    dorsalNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.optional(raceStatusValidator),
    category: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...args }) => {
    const user = await requireUser(ctx);
    const myRace = await ctx.db.get(id);
    if (!myRace) throw new Error("Not found");
    if (myRace.userId !== user._id) throw new Error("Forbidden");

    await ctx.db.patch(id, args);
  },
});

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

/**
 * Guarda el **tiempo objetivo** que el usuario ha elegido en la
 * calculadora bidireccional de la card de /calendario.
 *
 * Por qué un mutation dedicado:
 *  - El campo `predictedTimeSeconds` lo venía poblando la predicción
 *    automática de Daniels/Riegel al añadir la carrera. Ahora el usuario
 *    puede sobreescribirlo con un valor explícito desde la calculadora.
 *  - Cuando el usuario guarda, machacamos `predictedTimeSeconds` con su
 *    valor y reseteamos `predictionConfidence` a `undefined` (porque ya
 *    no es una predicción automática, es una decisión del usuario).
 *  - Si quisiéramos distinguir "predicción del sistema" vs "objetivo
 *    del usuario", añadiríamos un campo nuevo (`targetTimeSeconds`).
 *    Por ahora reusamos `predictedTimeSeconds` para no migrar el schema
 *    y mantener compat con el resto de la app (página de carrera, emails
 *    de resultado, etc. siguen mostrando el mismo campo).
 *
 * `timeSeconds` puede ser undefined (el usuario borra su objetivo →
 * la card vuelve al estado "sin definir"). En ese caso, la card
 * mostrará la calculadora vacía con placeholder.
 */
export const setTargetTime = mutation({
  args: {
    id: v.id("myRaces"),
    timeSeconds: v.union(v.number(), v.null()),
  },
  handler: async (ctx, { id, timeSeconds }) => {
    const user = await requireUser(ctx);
    const myRace = await ctx.db.get(id);
    if (!myRace) throw new Error("Not found");
    if (myRace.userId !== user._id) throw new Error("Forbidden");

    // Reseteamos la confianza: ya no es una predicción automática.
    // Si timeSeconds es null, también limpiamos el campo.
    await ctx.db.patch(id, {
      predictedTimeSeconds: timeSeconds ?? undefined,
      predictionConfidence: undefined,
    });
  },
});

/**
 * Pega el resultado real manualmente (fallback si el scraper falla).
 */
export const setManualResult = mutation({
  args: {
    id: v.id("myRaces"),
    timeSeconds: v.number(),
    position: v.optional(v.number()),
    positionCategory: v.optional(v.number()),
  },
  handler: async (ctx, { id, timeSeconds, position, positionCategory }) => {
    const user = await requireUser(ctx);
    const myRace = await ctx.db.get(id);
    if (!myRace) throw new Error("Not found");
    if (myRace.userId !== user._id) throw new Error("Forbidden");

    await ctx.db.patch(id, {
      actualTimeSeconds: timeSeconds,
      actualPosition: position,
      actualPositionCategory: positionCategory,
      resultSource: "manual",
      status: "done",
    });

    // Actualizar log de predicción
    const pred = await ctx.db
      .query("predictions")
      .withIndex("by_my_race", (q) => q.eq("myRaceId", id))
      .first();
    if (pred) {
      const errorSeconds = timeSeconds - pred.predictedTimeSeconds;
      const errorPct = (errorSeconds / pred.predictedTimeSeconds) * 100;
      await ctx.db.patch(pred._id, {
        actualTimeSeconds: timeSeconds,
        errorSeconds,
        errorPct: Math.round(errorPct * 100) / 100,
      });
    }

    // Actualizar PR si aplica
    const race = await ctx.db.get(myRace.raceId);
    if (race) {
      const effectiveDistance = getEffectiveDistance(myRace, race);
      const distanceM = Math.round(effectiveDistance.distanceKm * 1000);
      // Verificar si mejora el PR actual
      const currentPR = await ctx.db
        .query("personalRecords")
        .withIndex("by_user_distance_current", (q) =>
          q
            .eq("userId", user._id)
            .eq("distanceM", distanceM)
            .eq("isCurrent", true),
        )
        .unique();
      if (!currentPR || timeSeconds < currentPR.timeSeconds) {
        if (currentPR) {
          await ctx.db.patch(currentPR._id, { isCurrent: false });
        }
        await ctx.db.insert("personalRecords", {
          userId: user._id,
          distanceM,
          distanceLabel: getDistanceLabel(distanceM),
          timeSeconds,
          achievedAt: race.startDate,
          raceId: race._id,
          source: "race_result",
          isCurrent: true,
        });
      }
    }
  },
});

/**
 * Elimina una carrera de mi calendario.
 */
export const remove = mutation({
  args: { id: v.id("myRaces") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const myRace = await ctx.db.get(id);
    if (!myRace) throw new Error("Not found");
    if (myRace.userId !== user._id) throw new Error("Forbidden");
    await ctx.db.delete(id);
  },
});

/**
 * Devuelve el último myRace con resultado oficial del usuario actual.
 * Usado por el banner 🎉 de la home (sprint 2 de onboarding).
 *
 * Devuelve `null` si:
 *  - El usuario no está logueado
 *  - No tiene carreras con `status === 'done'` y tiempo oficial
 *
 * Solo devuelve EL MÁS RECIENTE. El cliente decide si mostrarlo o no
 * (puede ocultarlo con un "X" persistente en localStorage).
 */
export const getLatestResultBanner = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return null;

    // Buscar el myRace más reciente con resultado oficial
    const candidates = await ctx.db
      .query("myRaces")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "done"),
      )
      .collect();

    // Filtrar los que tienen tiempo real y ordenar por _creationTime desc
    const withResult = candidates
      .filter((m) => typeof m.actualTimeSeconds === "number")
      .sort((a, b) => b._creationTime - a._creationTime);

    if (withResult.length === 0) return null;

    const top = withResult[0];
    const race = await ctx.db.get(top.raceId);
    if (!race) return null;

    return {
      myRaceId: top._id,
      raceSlug: race.slug,
      raceName: race.name,
      distanceKm: race.distanceKm,
      actualTimeSeconds: top.actualTimeSeconds!,
      actualPosition: top.actualPosition,
      resultScrapedAt: top.resultScrapedAt,
      predictedTimeSeconds: top.predictedTimeSeconds,
    };
  },
});

// ---------------------------------------------------------------------------
// Internal queries (usados por crons)
// ---------------------------------------------------------------------------

export const getPlannedRacesForCron = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Carreras planned con startDate en ventana [-1d, +7d]
    const all = await ctx.db
      .query("myRaces")
      .withIndex("by_status", (q) => q.eq("status", "planned"))
      .collect();

    const now = Date.now();
    const oneDayAgo = now - 86400 * 1000;
    const sevenDaysLater = now + 7 * 86400 * 1000;

    const result: Array<{ myRace: Doc<"myRaces">; race: Doc<"races"> | null }> = [];
    for (const myRace of all) {
      const race = await ctx.db.get(myRace.raceId);
      if (!race || !race.startDate) continue;
      const raceTime = new Date(race.startDate).getTime();
      if (raceTime >= oneDayAgo && raceTime <= sevenDaysLater) {
        result.push({ myRace, race });
      }
    }
    return result;
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function estimateTempForRace(
  startDate: string | undefined,
  locality: string | undefined,
): number {
  if (!startDate) return 18;
  const date = new Date(startDate);
  const month = date.getMonth(); // 0-11
  // Estimación muy básica por mes en Levante
  const temps = [12, 13, 16, 18, 22, 27, 30, 30, 26, 21, 16, 13];
  return temps[month];
}



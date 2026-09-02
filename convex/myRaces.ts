// =============================================================================
// mi-dorsal — My Races (calendario personal)
// =============================================================================

import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { requireUser, raceStatusValidator } from "./_helpers";
import { predictForMyRace } from "../lib/prediction/predict";
import { Doc, Id } from "./_generated/dataModel";

/**
 * Lista carreras del usuario actual con filtros.
 */
export const listMine = query({
  args: {
    status: v.optional(raceStatusValidator),
  },
  handler: async (ctx, { status }) => {
    const user = await requireUser(ctx);
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
 */
export const add = mutation({
  args: {
    raceId: v.id("races"),
    dorsalNumber: v.optional(v.string()),
    registrationDate: v.optional(v.string()),
    notes: v.optional(v.string()),
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

    // Obtener carrera
    const race = await ctx.db.get(args.raceId);
    if (!race) throw new Error("Race not found");

    // Calcular predicción
    const prs = await ctx.db
      .query("personalRecords")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("isCurrent"), true))
      .collect();

    const prediction = predictForMyRace({
      race: {
        distanceKm: race.distanceKm,
        elevationGainM: race.elevationGainM,
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

    const id = await ctx.db.insert("myRaces", {
      userId: user._id,
      raceId: args.raceId,
      dorsalNumber: args.dorsalNumber,
      registrationDate: args.registrationDate,
      notes: args.notes,
      status: "planned",
      predictedTimeSeconds: prediction.predictedTimeSeconds,
      predictionConfidence: prediction.confidence,
      predictionFactors: prediction.factors,
    });

    // Guardar log de predicción
    await ctx.db.insert("predictions", {
      userId: user._id,
      raceId: args.raceId,
      myRaceId: id,
      predictedTimeSeconds: prediction.predictedTimeSeconds,
      confidence: prediction.confidence,
      modelVersion: "daniels-vdot-v1",
      factors: prediction.factors,
    });

    return id;
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
      const distanceM = Math.round(race.distanceKm * 1000);
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

// ---------------------------------------------------------------------------
// Internal queries (usados por crons)
// ---------------------------------------------------------------------------

export const getPlannedRacesForCron = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Carreras planned con startDate en ventana [-1d, +7d]
    const all = await ctx.db
      .query("myRaces")
      .withIndex("by_user_status", (q) => q.eq("status", "planned"))
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

function getDistanceLabel(distanceM: number): string {
  if (distanceM === 5000) return "5K";
  if (distanceM === 10000) return "10K";
  if (distanceM === 15000) return "15K";
  if (distanceM === 21097 || (distanceM > 20000 && distanceM < 22000))
    return "Media Maratón";
  if (distanceM === 42195 || (distanceM > 41000 && distanceM < 43000))
    return "Maratón";
  return `${distanceM / 1000}K`;
}

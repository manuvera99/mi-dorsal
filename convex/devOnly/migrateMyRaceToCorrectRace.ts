// =============================================================================
// mi-dorsal — Dev/admin: migrateMyRaceToCorrectRace
// =============================================================================
// Helper one-shot para swap de myRace de un usuario entre carreras, preservando
// predicción y notas. Útil cuando se detecta que un myRace apunta a un duplicado
// de la carrera en el catálogo.
//
// Usar con `npx convex run --deployment precious-goshawk-41
// 'devOnly/migrateMyRaceToCorrectRace:migrateMyRaceToCorrectRace' '{"myRaceId":"jxxx","newRaceId":"kxxx"}'`
//
// Comportamiento:
//   - Lee el myRace origen.
//   - Crea un nuevo myRace apuntando a newRaceId, con dorsalNumber=null (la
//     organización aún no lo ha asignado; se rellena vía web).
//   - Preserva: selectedDistanceKm, selectedDistanceLabel, selectedElevationGainM,
//     predictedTimeSeconds, predictionConfidence, predictionFactors, notes,
//     registrationDate, status="planned".
//   - Borra el myRace origen.
//   - Devuelve el id del nuevo myRace.
//
// NO migra: actualTimeSeconds, actualPosition, actualPositionCategory,
// resultScrapedAt, diplomaStorageId, storyStickerStorageId (porque solo
// se llama en carreras planned).
// =============================================================================

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const migrateMyRaceToCorrectRace = internalMutation({
  args: {
    myRaceId: v.id("myRaces"),
    newRaceId: v.id("races"),
  },
  handler: async (ctx, { myRaceId, newRaceId }) => {
    const old = await ctx.db.get(myRaceId);
    if (!old) {
      throw new Error(`myRace ${myRaceId} not found`);
    }

    const newRace = await ctx.db.get(newRaceId);
    if (!newRace) {
      throw new Error(`race ${newRaceId} not found`);
    }

    // Defense: NO migrar si el myRace ya está done (tiene resultado, diploma, etc.).
    if (old.status === "done" || old.actualTimeSeconds !== undefined) {
      throw new Error(
        `myRace ${myRaceId} is in status ${old.status} with actualTime=${old.actualTimeSeconds}. ` +
        `This migration is only for planned myRaces.`,
      );
    }

    // Ya existe el nuevo myRace? Evitar duplicados.
    const existing = await ctx.db
      .query("myRaces")
      .withIndex("by_user_race", (q) =>
        q.eq("userId", old.userId).eq("raceId", newRaceId),
      )
      .unique();
    if (existing) {
      throw new Error(
        `User ${old.userId} already has a myRace for race ${newRaceId} (myRaceId=${existing._id}). ` +
        `Borrar el duplicado manualmente antes de migrar.`,
      );
    }

    // Crea el nuevo myRace preservando todos los campos planificados.
    const newId = await ctx.db.insert("myRaces", {
      userId: old.userId,
      raceId: newRaceId,
      dorsalNumber: undefined, // se rellenará cuando llegue el correo de la organización
      registrationDate: old.registrationDate,
      notes: old.notes,
      status: "planned",
      selectedDistanceKm: old.selectedDistanceKm,
      selectedDistanceLabel: old.selectedDistanceLabel,
      selectedElevationGainM: old.selectedElevationGainM,
      predictedTimeSeconds: old.predictedTimeSeconds,
      predictionConfidence: old.predictionConfidence,
      predictionFactors: old.predictionFactors,
    });

    // Si había una predicción log, también creamos una nueva entrada en predictions
    // apuntando al nuevo myRace. `factors` está definida como `v.any()` (requerida),
    // así que pasamos un objeto vacío si no hay factores del myRace original.
    if (old.predictedTimeSeconds) {
      await ctx.db.insert("predictions", {
        userId: old.userId,
        raceId: newRaceId,
        myRaceId: newId,
        predictedTimeSeconds: old.predictedTimeSeconds,
        confidence: old.predictionConfidence ?? "low",
        modelVersion: "daniels-vdot-v1",
        factors: old.predictionFactors ?? {},
      });
    }

    // Borra el myRace viejo.
    await ctx.db.delete(myRaceId);

    return {
      success: true,
      deletedMyRaceId: myRaceId,
      newMyRaceId: newId,
      oldRaceId: old.raceId,
      oldRaceName: (await ctx.db.get(old.raceId))?.name,
      newRaceId,
      newRaceName: newRace.name,
      preservedFields: {
        selectedDistanceKm: old.selectedDistanceKm,
        selectedDistanceLabel: old.selectedDistanceLabel,
        predictedTimeSeconds: old.predictedTimeSeconds,
        dorsalNumberWas: old.dorsalNumber,
      },
    };
  },
});
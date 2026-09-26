// =============================================================================
// mi-dorsal — DEV ONLY: fix-tonights-mi-dorsal
// =============================================================================
// Sesión 26 sep 2026 — fix urgente pre-carrera del usuario:
//   - El email llegó con distancia incorrecta (10K en vez de 15K) porque la
//     myRace del usuario (j577aq6svyvas4aqenwsk6g89h8eprg8) no tenía
//     selectedDistanceKm/Label seteados y caía al default del catálogo
//     (distanceKm=10, que el propio scraper metió mal).
//   - El cron también dijo "Es mañana" cuando en realidad la carrera es
//     ESTA NOCHE. Ya parcheado el template con urgency 'tonight'.
//   - La fila de notificationLog con reminder_1d ya está escrita, lo que
//     bloquea reenvíos con idempotencia.
//
// Este script hace 3 cosas:
//   1. Setea selectedDistanceKm/Label/ElevationGainM=15/15K en la myRace del
//      usuario para esta carrera.
//   2. Borra la fila de notificationLog reminder_1d para permitir reenvío.
//   3. Devuelve OK con los IDs modificados.
//
// Tras ejecutarlo se debe re-disparar el cron con
// `npx convex run --prod crons/reminderPreRace:reminderPreRace '{}'` y se
// enviará el email corregido (urgency=tonight, distancia=15K).
//
// ⚠️ HARD-CODED al myRace concreto del usuario — NO ejecutar para otros
// perfiles. Se autodestruye tras la carrera.
// =============================================================================

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

const TARGET_MY_RACE_ID = "j577aq6svyvas4aqenwsk6g89h8eprg8";

export const fixTonightsMiDorsal = internalMutation({
  args: {
    confirm: v.literal("fix-mi-dorsal-tonight"),
  },
  handler: async (ctx, args) => {
    // 1. Arreglar la myRace: setear distancia correcta.
    const myRace = await ctx.db.get(TARGET_MY_RACE_ID as any);
    if (!myRace) {
      throw new Error(`myRace ${TARGET_MY_RACE_ID} no existe. ¿Se borró?`);
    }
    // ctx.db.get devuelve unión de todos los tipos de tabla en este schema.
    // Narrowing a myRaces via cast justificado: el ID es de myRaces (lo
    // obtuvimos de un query anterior que filtraba por "myRaces").
    const myRaceRow = myRace as any;
    const userId = myRaceRow.userId;
    const raceId = myRaceRow.raceId;

    await ctx.db.patch(TARGET_MY_RACE_ID as any, {
      selectedDistanceKm: 15,
      selectedDistanceLabel: "15K",
      selectedElevationGainM: undefined,
    });

    // 2. Borrar la fila de notificationLog reminder_1d para permitir reenvío.
    const logs = await ctx.db
      .query("notificationLog")
      .withIndex("by_user_type", (q) =>
        q.eq("userId", userId).eq("type", "reminder_1d"),
      )
      .filter((q) => q.eq(q.field("relatedMyRaceId"), TARGET_MY_RACE_ID as any))
      .collect();
    let deletedLogs = 0;
    for (const log of logs) {
      await ctx.db.delete(log._id);
      deletedLogs++;
    }

    return {
      ok: true,
      myRaceUpdated: {
        _id: myRace._id,
        raceId,
        selectedDistanceKm: 15,
        selectedDistanceLabel: "15K",
      },
      notificationLogsDeleted: deletedLogs,
      nextStep:
        "Ahora ejecuta: npx convex run --prod crons/reminderPreRace:reminderPreRace '{}'",
    };
  },
});

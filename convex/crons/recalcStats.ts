// =============================================================================
// mi-dorsal — Cron: recalc-stats
// =============================================================================
// Cada 5 min: recalcula los contadores denormalizados del admin dashboard.
//
// ANTES: adminGetStats() y getPublicStats() hacían .collect() de 7 tablas
// (races, profiles, raceVotes, raceRatings, myRaces, personalRecords,
// notificationLog) en cada carga. Con plan free (1 GB/mes de Database I/O)
// eso quemaba 96% del límite en 4 días.
//
// AHORA: estas queries leen 1 fila de ~200 bytes de la tabla statsCache.
// El cron reescribe esa fila cada 5 min con los totales actualizados.
// Coste: ~50-200 KB de I/O cada 5 min (~15 MB/mes, despreciable).
// =============================================================================

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

export const recalcStats = internalAction({
  args: {},
  handler: async (ctx: any) => {
    const result = await ctx.runMutation((internal.stats.recalcStats as any), {});
    console.log(
      `[recalc-stats] OK: ${result.totalRaces} races, ${result.totalUsers} users, ` +
      `${result.totalVotes} votes, ${result.totalRatings} ratings. ` +
      `By province: ${Object.keys(result.racesByProvince).length} provincias.`,
    );
    return result;
  },
});

// =============================================================================
// mi-dorsal — Cron: recalc-stats
// =============================================================================
// Recalcula los contadores denormalizados del admin dashboard (tabla statsCache).
//
// HISTORIAL DE FRECUENCIA (auditoría 8 sep 2026):
// - 5 min (original): quemaba 96% del límite de 1 GB/mes en 4 días.
// - 30 min (después de 5 sep): ~17 MB/día, ~510 MB/mes.
// - 1/día 03:05 UTC (actual): ~360 KB/día, ~11 MB/mes. −98% vs 30 min.
//
// Por qué 03:05 UTC: la GitHub Action daily-ingest corre a las 02:00 UTC
// y sube ~431 carreras a Convex. A las 03:05 (1h después) el cron recalcula
// las stats para que el admin dashboard vea los datos frescos al día
// siguiente. Si necesitas stats más frescas, llama manualmente a
// `recalculateStats` (mutation pública) o a la action `triggerRecalcNow`
// desde el dashboard / un endpoint admin.
//
// Si en el futuro hay ingest de carreras desde el propio Convex (sin pasar
// por la GitHub Action), la action `ingest-to-convex` puede llamar a
// `recalculateStats` directamente para mantener la coherencia sin esperar
// al cron.
// =============================================================================

import { internalAction } from "../_generated/server";

export const recalcStats = internalAction({
  args: {},
  handler: async (ctx: any) => {
    // Cast a string para evitar circular type del API cuando Convex infiere
    // el tipo del internalMutation `stats.recalcStats` desde `_generated/api`.
    // (Bug Convex 1.18 con schema grande, ver memoria agente.)
    const result = await ctx.runMutation("stats:recalcStats" as any, {});
    console.log(
      `[recalc-stats] OK: ${result.totalRaces} races, ${result.totalUsers} users, ` +
      `${result.totalVotes} votes, ${result.totalRatings} ratings. ` +
      `By province: ${Object.keys(result.racesByProvince).length} provincias.`,
    );
    return result;
  },
});

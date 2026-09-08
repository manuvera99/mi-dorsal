// =============================================================================
// mi-dorsal — Cron: reset-coach-usage
// =============================================================================
// Día 1 de cada mes a las 00:05 UTC (5 min después del cambio de mes):
// resetea el contador aiCoachUsageCount de todos los profiles cuyo
// aiCoachUsageResetAt ya haya pasado.
//
// Por qué un cron y no lógica inline en la query getMyCoachUsage:
//   - Aunque la query ya hace el "reset implícito" cuando ve que el
//     mes cambió (isNewMonth), el contador en BD se queda obsoleto
//     hasta que el usuario entre a /perfil y haga un nuevo análisis.
//   - El cron mantiene la BD limpia y permite que queries de admin
//     ("¿cuántos free han usado el coach este mes?") no necesiten
//     filtrar por aiCoachUsageResetAt.
//
// Idempotente: si se ejecuta dos veces el mismo día, no hace nada la
// segunda vez (el helper `resetAllCoachUsage` mira que resetAt > now).
// =============================================================================

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

export const resetCoachUsage = internalAction({
  args: {},
  handler: async (ctx) => {
    // Workaround TS2589 (Convex 1.18 inferencia circular en mapped types
    // cuando hay muchas tablas con uniones grandes). Aplicar `as any` aquí
    // es OK — solo afecta al path de la llamada, no al runtime. Ver
    // AGENTS.md §15.3 para más detalle.
    const result = await ctx.runMutation(
      (internal as any).coachAnalysisHelpers.resetAllCoachUsage,
      {},
    );
    console.log(
      `[resetCoachUsage] scanned=${result.scanned} reset=${result.reset}`,
    );
    return result;
  },
});

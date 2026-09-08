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
  // Workaround TS2589: declarar el return type del handler para cortar la
  // inferencia circular del mapped type de Convex 1.18. Sin este tipo
  // explícito, TS intenta inferirlo desde `result` → `ctx.runMutation(...)`
  // → `internal.<...>` → `api.d.ts` → vuelve aquí = ciclo.
  handler: async (
    ctx,
  ): Promise<{ scanned: number; reset: number }> => {
    const resetMutation = ((internal as any)["coachAnalysisHelpers"] as any)["resetAllCoachUsage"];
    const result = await ctx.runMutation(resetMutation, {});
    console.log(
      `[resetCoachUsage] scanned=${result.scanned} reset=${result.reset}`,
    );
    return result;
  },
});

// =============================================================================
// mi-dorsal — Escaneo manual de resultados (admin)
// =============================================================================
// Action pública que el admin dispara desde `/admin/races/[id]` con el botón
// "Buscar resultados ahora": recorre TODAS las myRaces de esa carrera con
// dorsal asignado y sin resultado aún, y les aplica exactamente el mismo
// pipeline que el cron automático (convex/crons/checkResults.ts →
// processResultCheckItem) — discovery de sportmaniacs si falta, scrape,
// cachear resultado, marcar myRace como done, enviar email, actualizar PR.
//
// Por qué existe aparte del cron: el cron solo actúa dentro de la ventana
// [-7d,+7d] respecto a la fecha de la carrera (getCheckFrequency en
// checkResults.ts) y a intervalos de 30 min. Este escaneo es un disparo
// explícito del admin — sin ventana ni espera — para forzar el flujo
// cuando ya hay resultados publicados fuera de esa ventana, o para
// confirmar que un adapter/URL recién configurado funciona.
//
// Auth: NO hay `requireAdmin` aquí porque `ActionCtx` no tiene `ctx.db`
// (requireAdmin exige QueryCtx|MutationCtx — ver convex/_helpers.ts). La
// comprobación de rol se hace en la capa Next.js (Server Action
// `scanRaceResultsAction` en app/admin/races/[id]/actions.ts), mismo
// patrón ya usado por `deepExtractAndApplyAction` en ese mismo archivo.
// =============================================================================

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { processResultCheckItem, buildItem } from "./crons/checkResults";
import { Doc } from "./_generated/dataModel";

export const adminScanRaceResults = action({
  args: { raceId: v.id("races") },
  handler: async (ctx, { raceId }) => {
    const race: Doc<"races"> | null = await ctx.runQuery(api.races.get, { id: raceId });
    if (!race) {
      return { totalPending: 0, found: 0, notFound: 0, skippedNoUrl: 0, errors: 0, errorMessage: "Carrera no encontrada" };
    }

    const pending: Doc<"myRaces">[] = await ctx.runQuery(
      internal.myRaces.getPendingByRace,
      { raceId },
    );

    let found = 0;
    let notFound = 0;
    let skippedNoUrl = 0;
    let errors = 0;

    for (const myRace of pending) {
      const item = buildItem(myRace, race);
      const outcome = await processResultCheckItem(ctx, item);
      if (outcome.outcome === "found") found++;
      else if (outcome.outcome === "not_found") notFound++;
      else if (outcome.outcome === "skipped_no_url") skippedNoUrl++;
      else errors++;
    }

    return { totalPending: pending.length, found, notFound, skippedNoUrl, errors };
  },
});

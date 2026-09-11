// =============================================================================
// mi-dorsal — Seguimiento automático de resultados
// =============================================================================
// Determina si una carrera tiene seguimiento automático FIABLE del
// resultado oficial (cron check-results, convex/crons/checkResults.ts →
// convex/scraper.ts). No todos los scraperAdapter son igual de fiables:
// solo los que tienen un adapter dedicado (no "generic") Y los datos que
// ese adapter necesita para scrapear deben prometerle al usuario que su
// dorsal se detectará solo.
//
// Whitelist explícita (no "cualquier adapter menos generic") para que
// añadir un adapter nuevo sea una decisión consciente, no automática.
//
// Cada adapter tiene su propio requisito de "listo para scrapear":
//   - chiplevante: basta con tener resultsUrl (el adapter reconstruye
//     evento/edición por regex desde ahí, sin datos cacheados aparte).
//   - sportmaniacs (86% del catálogo, activado 2026-09-11 tras verificar
//     el pipeline completo end-to-end en prod real — ver
//     project_result_tracking_in_progress.md): NO depende de resultsUrl
//     (solo se puebla cuando hay una única modalidad). Depende de
//     `sportmaniacsEventIds` cacheado — por el backfill offline
//     (scripts/backfill-sportmaniacs-event-ids.ts) o por el discovery en
//     caliente que hace el propio cron (checkResults.ts) cuando falta.
//     Antes de tener eventIds, el cron no puede scrapear esta carrera
//     aunque el adapter sea "sportmaniacs" — el badge debe reflejar eso,
//     no solo el nombre del adapter.
// =============================================================================

export interface RaceTrackingFields {
  scraperAdapter?: string;
  resultsUrl?: string;
  sportmaniacsEventIds?: unknown[];
}

const AUTO_TRACKABLE_ADAPTERS = new Set<string>(["chiplevante", "sportmaniacs"]);

export function isAutoTrackable(race: RaceTrackingFields): boolean {
  if (!race.scraperAdapter) return false;
  if (!AUTO_TRACKABLE_ADAPTERS.has(race.scraperAdapter)) return false;
  if (race.scraperAdapter === "sportmaniacs") {
    return !!race.sportmaniacsEventIds?.length;
  }
  return !!race.resultsUrl;
}

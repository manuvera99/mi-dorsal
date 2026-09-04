import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// =============================================================================
// Sprint 0: cableado de emails
// =============================================================================
// check-results: cada 30 min (era 6h). La lógica adaptativa dentro decide
// qué carreras chequear con qué frecuencia, así que este intervalo único
// cubre todo el ciclo: pre-carrera, día de carrera, post-carrera temprana.
crons.interval(
  "check-results",
  { minutes: 30 },
  internal.crons.checkResults.checkResults,
);

// Recordatorios 7d/1d antes de la carrera
crons.cron(
  "reminder-pre-race",
  "0 9 * * *", // 9am UTC diario
  internal.crons.reminderPreRace.reminderPreRace,
);

// Result-not-found: 48h después de una carrera sin resultado scrapeado
crons.cron(
  "result-not-found",
  "0 14 * * *", // 14h UTC diario (8h después del reminder para no solapar)
  internal.crons.resultNotFound.resultNotFound,
);

// Weekly digest y year-review: placeholders, se cablean en Sprint 3
crons.cron(
  "weekly-digest",
  "0 9 * * 1", // lunes 9am UTC
  internal.crons.weeklyDigest.weeklyDigest,
);

crons.cron(
  "year-review",
  "0 10 1 1 *", // 1 enero 10am UTC
  internal.crons.yearReview.yearReview,
);

// Recalcular stats del admin cada 5 min
crons.interval(
  "recalc-stats",
  { minutes: 5 },
  internal["crons/recalcStats"].recalcStats,
);

export default crons;

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

// Recalcular stats del admin cada 30 min
// (antes 5 min quemaba ~6 GB/mes de Database bandwidth en plan free;
// 30 min lo deja en ~1 GB/mes, dentro del límite. Para una app con
// 1 admin y pocos beta testers, 30 min de delay en el dashboard es
// invisible. Si en el futuro hay 50+ usuarios activos, subir a Pro o
// cambiar a 1h + cache en cliente.)
crons.interval(
  "recalc-stats",
  { minutes: 30 },
  (internal as any)["crons/recalcStats"].recalcStats,
);

// Newsletter editorial: día 1 de cada mes a las 10:00 UTC.
// Envía el post editorial más reciente (no enviado aún) a todos los
// suscriptores activos con editorialEnabled=true.
crons.cron(
  "newsletter-editorial",
  "0 10 1 * *", // día 1 de cada mes, 10:00 UTC
  internal.crons.newsletterEditorial.newsletterEditorial,
);

export default crons;

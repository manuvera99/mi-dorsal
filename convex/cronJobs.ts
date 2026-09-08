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

// Recalcular stats del admin cada 6h
// (antes 5 min quemaba ~6 GB/mes de Database bandwidth en plan free;
// 30 min lo dejaba en ~1 GB/mes, dentro del límite. Subido a 6h:
// el dashboard admin no necesita 30 min de freshness, y 6h alinea
// la frecuencia con el auto-sync de Strava (también 24h threshold).
// 4 runs/día = ~4 KB/día = despreciable. Si en el futuro hay 50+
// usuarios activos, evaluar cache en cliente en lugar de subir
// frecuencia del cron.)
crons.interval(
  "recalc-stats",
  { hours: 6 },
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

// Reset mensual del rate limit del entrenador IA: día 1 de cada mes a
// las 00:05 UTC (5 min después del cambio de mes, para que el cron de
// newsletter-editorial del día 1 a las 10:00 ya encuentre los counters
// reseteados). Mantiene la BD limpia sin esperar a que el usuario entre
// a /perfil.
crons.cron(
  "reset-coach-usage",
  "5 0 1 * *", // día 1 de cada mes, 00:05 UTC
  (internal as any)["crons/resetCoachUsage"].resetCoachUsage,
);

// Renovar la suscripción a webhooks de Strava cada 12h (Strava las
// desactiva a las 24h sin eventos).
crons.cron(
  "renew-strava-webhook",
  "0 */12 * * *", // cada 12 horas
  (internal as any)["actions/stravaWebhookSubscription"].ensureWebhookSubscription,
);

export default crons;

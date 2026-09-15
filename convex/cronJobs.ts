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

// year-review: placeholder, se cablea en Sprint 3.
// (weekly-digest se quitó — no queríamos un email semanal recurrente.)
crons.cron(
  "year-review",
  "0 10 1 1 *", // 1 enero 10am UTC
  internal.crons.yearReview.yearReview,
);

// Recalcular stats del admin 1 vez al día a las 03:05 UTC.
// (8 sep 2026: era cada 6h, leía ~1.4 MB/día de las 7 tablas grandes
// en .collect() (Promise.all). Reducido a 1/día → ~360 KB/día, −75%.
// Se ejecuta 1h después de la GitHub Action daily-ingest (02:00 UTC)
// para que las stats reflejen las carreras recién ingestadas al día
// siguiente. Si necesitas stats más frescas, llama manualmente a
// api.stats.recalculateStats.)
crons.cron(
  "recalc-stats",
  "5 3 * * *", // 03:05 UTC diario
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

// Renovar la suscripción a webhooks de Strava. Strava las desactiva a
// las 24h sin eventos; con 1 user activo y 1 admin testeando, 24h es
// suficiente margen. Antes era cada 12h (mitad de ejecuciones innecesarias).
crons.cron(
  "renew-strava-webhook",
  "5 0 * * *", // una vez al día a las 00:05 UTC
  (internal as any)["actions/stravaWebhookSubscription"].ensureWebhookSubscription,
);

// Limpieza de jobs de "Encuentra tus fotos" expirados (>24h). Las selfies ya
// se borran de Storage en cuanto el job termina; esto solo borra el
// documento en sí (ver convex/crons/cleanupPhotoSearch.ts).
crons.cron(
  "cleanup-photo-search",
  "15 3 * * *", // 03:15 UTC diario
  internal.crons.cleanupPhotoSearch.cleanupPhotoSearch,
);

// Comprueba que seguimos pudiendo extraer el site_key/NSID público del
// HTML de flickr.com — vía principal para listar álbumes/fotos hoy, sin
// API key propia (ver convex/crons/checkFlickrSiteKeyHealth.ts). Avisa
// por email al admin si Flickr cambia el HTML y rompe la extracción.
crons.cron(
  "check-flickr-site-key-health",
  "40 8 * * *", // 08:40 UTC diario
  internal.crons.checkFlickrSiteKeyHealth.checkFlickrSiteKeyHealth,
);

export default crons;

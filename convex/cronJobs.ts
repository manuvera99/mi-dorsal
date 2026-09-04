import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "check-results",
  { hours: 6 },
  internal.crons.checkResults.checkResults,
);

crons.cron(
  "reminder-pre-race",
  "0 9 * * *",
  internal.crons.reminderPreRace.reminderPreRace,
);

crons.cron(
  "weekly-digest",
  "0 9 * * 1",
  internal.crons.weeklyDigest.weeklyDigest,
);

crons.cron(
  "year-review",
  "0 10 1 1 *",
  internal.crons.yearReview.yearReview,
);

crons.interval(
  "recalc-stats",
  { minutes: 5 },
  internal["crons/recalcStats"].recalcStats,
);

export default crons;


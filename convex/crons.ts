import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "check-results",
  { hours: 6 },
  internal.crons.checkResults,
);

crons.cron(
  "reminder-pre-race",
  "0 9 * * *",
  internal.crons.reminderPreRace,
);

crons.cron(
  "weekly-digest",
  "0 9 * * 1",
  internal.crons.weeklyDigest,
);

crons.cron(
  "year-review",
  "0 10 1 1 *",
  internal.crons.yearReview,
);

export default crons;

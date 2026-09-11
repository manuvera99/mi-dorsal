/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _helpers from "../_helpers.js";
import type * as actions_coachAnalysis from "../actions/coachAnalysis.js";
import type * as actions_stravaExportIngest from "../actions/stravaExportIngest.js";
import type * as actions_stravaInitialSync from "../actions/stravaInitialSync.js";
import type * as actions_stravaWebhookHandler from "../actions/stravaWebhookHandler.js";
import type * as actions_stravaWebhookSubscription from "../actions/stravaWebhookSubscription.js";
import type * as activities_normalize from "../activities/normalize.js";
import type * as activities_queries from "../activities/queries.js";
import type * as adminTools from "../adminTools.js";
import type * as aiUsage from "../aiUsage.js";
import type * as blog from "../blog.js";
import type * as clubSuggestions from "../clubSuggestions.js";
import type * as clubsCatalog from "../clubsCatalog.js";
import type * as coachAnalysisHelpers from "../coachAnalysisHelpers.js";
import type * as cronJobs from "../cronJobs.js";
import type * as crons_checkResults from "../crons/checkResults.js";
import type * as crons_newsletterEditorial from "../crons/newsletterEditorial.js";
import type * as crons_recalcStats from "../crons/recalcStats.js";
import type * as crons_reminderPreRace from "../crons/reminderPreRace.js";
import type * as crons_resetCoachUsage from "../crons/resetCoachUsage.js";
import type * as crons_resultNotFound from "../crons/resultNotFound.js";
import type * as crons_yearReview from "../crons/yearReview.js";
import type * as dataSources from "../dataSources.js";
import type * as detectIntervalsBackfill from "../detectIntervalsBackfill.js";
import type * as detectIntervalsBackfillHelpers from "../detectIntervalsBackfillHelpers.js";
import type * as devOnly_backfillIsRunning from "../devOnly/backfillIsRunning.js";
import type * as devOnly_cleanTestUserByClerkId from "../devOnly/cleanTestUserByClerkId.js";
import type * as devOnly_enrichTestUserByEmail from "../devOnly/enrichTestUserByEmail.js";
import type * as devOnly_markFeatured from "../devOnly/markFeatured.js";
import type * as devOnly_promoteToAdmin from "../devOnly/promoteToAdmin.js";
import type * as devOnly_seedTestUser from "../devOnly/seedTestUser.js";
import type * as devOnly_slimActivitiesPayload from "../devOnly/slimActivitiesPayload.js";
import type * as emailDispatch from "../emailDispatch.js";
import type * as emailNotificationsAction from "../emailNotificationsAction.js";
import type * as emailNotificationsHelpers from "../emailNotificationsHelpers.js";
import type * as emails_sendEmail from "../emails/sendEmail.js";
import type * as emails_templates_reminder from "../emails/templates/reminder.js";
import type * as emails_templates_resultFound from "../emails/templates/resultFound.js";
import type * as emails_templates_resultNotFound from "../emails/templates/resultNotFound.js";
import type * as feedback from "../feedback.js";
import type * as myRaces from "../myRaces.js";
import type * as newsletter from "../newsletter.js";
import type * as pdfScraper from "../pdfScraper.js";
import type * as personalRecords from "../personalRecords.js";
import type * as predictions from "../predictions.js";
import type * as raceSuggestions from "../raceSuggestions.js";
import type * as races from "../races.js";
import type * as ratings from "../ratings.js";
import type * as runnerType from "../runnerType.js";
import type * as scraper from "../scraper.js";
import type * as stats from "../stats.js";
import type * as stickerEditor from "../stickerEditor.js";
import type * as stravaExport from "../stravaExport.js";
import type * as stravaExportIngestHelpers from "../stravaExportIngestHelpers.js";
import type * as stravaInitialSyncHelpers from "../stravaInitialSyncHelpers.js";
import type * as stravaOauth from "../stravaOauth.js";
import type * as stravaWebhookHandlerInternal from "../stravaWebhookHandlerInternal.js";
import type * as subscriptions from "../subscriptions.js";
import type * as users from "../users.js";
import type * as votes from "../votes.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  _helpers: typeof _helpers;
  "actions/coachAnalysis": typeof actions_coachAnalysis;
  "actions/stravaExportIngest": typeof actions_stravaExportIngest;
  "actions/stravaInitialSync": typeof actions_stravaInitialSync;
  "actions/stravaWebhookHandler": typeof actions_stravaWebhookHandler;
  "actions/stravaWebhookSubscription": typeof actions_stravaWebhookSubscription;
  "activities/normalize": typeof activities_normalize;
  "activities/queries": typeof activities_queries;
  adminTools: typeof adminTools;
  aiUsage: typeof aiUsage;
  blog: typeof blog;
  clubSuggestions: typeof clubSuggestions;
  clubsCatalog: typeof clubsCatalog;
  coachAnalysisHelpers: typeof coachAnalysisHelpers;
  cronJobs: typeof cronJobs;
  "crons/checkResults": typeof crons_checkResults;
  "crons/newsletterEditorial": typeof crons_newsletterEditorial;
  "crons/recalcStats": typeof crons_recalcStats;
  "crons/reminderPreRace": typeof crons_reminderPreRace;
  "crons/resetCoachUsage": typeof crons_resetCoachUsage;
  "crons/resultNotFound": typeof crons_resultNotFound;
  "crons/yearReview": typeof crons_yearReview;
  dataSources: typeof dataSources;
  detectIntervalsBackfill: typeof detectIntervalsBackfill;
  detectIntervalsBackfillHelpers: typeof detectIntervalsBackfillHelpers;
  "devOnly/backfillIsRunning": typeof devOnly_backfillIsRunning;
  "devOnly/cleanTestUserByClerkId": typeof devOnly_cleanTestUserByClerkId;
  "devOnly/enrichTestUserByEmail": typeof devOnly_enrichTestUserByEmail;
  "devOnly/markFeatured": typeof devOnly_markFeatured;
  "devOnly/promoteToAdmin": typeof devOnly_promoteToAdmin;
  "devOnly/seedTestUser": typeof devOnly_seedTestUser;
  "devOnly/slimActivitiesPayload": typeof devOnly_slimActivitiesPayload;
  emailDispatch: typeof emailDispatch;
  emailNotificationsAction: typeof emailNotificationsAction;
  emailNotificationsHelpers: typeof emailNotificationsHelpers;
  "emails/sendEmail": typeof emails_sendEmail;
  "emails/templates/reminder": typeof emails_templates_reminder;
  "emails/templates/resultFound": typeof emails_templates_resultFound;
  "emails/templates/resultNotFound": typeof emails_templates_resultNotFound;
  feedback: typeof feedback;
  myRaces: typeof myRaces;
  newsletter: typeof newsletter;
  pdfScraper: typeof pdfScraper;
  personalRecords: typeof personalRecords;
  predictions: typeof predictions;
  raceSuggestions: typeof raceSuggestions;
  races: typeof races;
  ratings: typeof ratings;
  runnerType: typeof runnerType;
  scraper: typeof scraper;
  stats: typeof stats;
  stickerEditor: typeof stickerEditor;
  stravaExport: typeof stravaExport;
  stravaExportIngestHelpers: typeof stravaExportIngestHelpers;
  stravaInitialSyncHelpers: typeof stravaInitialSyncHelpers;
  stravaOauth: typeof stravaOauth;
  stravaWebhookHandlerInternal: typeof stravaWebhookHandlerInternal;
  subscriptions: typeof subscriptions;
  users: typeof users;
  votes: typeof votes;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

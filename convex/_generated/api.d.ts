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
import type * as blog from "../blog.js";
import type * as cronJobs from "../cronJobs.js";
import type * as crons_checkResults from "../crons/checkResults.js";
import type * as crons_newsletterEditorial from "../crons/newsletterEditorial.js";
import type * as crons_recalcStats from "../crons/recalcStats.js";
import type * as crons_reminderPreRace from "../crons/reminderPreRace.js";
import type * as crons_resultNotFound from "../crons/resultNotFound.js";
import type * as crons_weeklyDigest from "../crons/weeklyDigest.js";
import type * as crons_yearReview from "../crons/yearReview.js";
import type * as dataSources from "../dataSources.js";
import type * as devOnly_markFeatured from "../devOnly/markFeatured.js";
import type * as devOnly_promoteToAdmin from "../devOnly/promoteToAdmin.js";
import type * as emailDispatch from "../emailDispatch.js";
import type * as emailNotifications from "../emailNotifications.js";
import type * as emails_templates_resultFound from "../emails/templates/resultFound.js";
import type * as http from "../http.js";
import type * as myRaces from "../myRaces.js";
import type * as newsletter from "../newsletter.js";
import type * as personalRecords from "../personalRecords.js";
import type * as predictions from "../predictions.js";
import type * as races from "../races.js";
import type * as ratings from "../ratings.js";
import type * as scraper from "../scraper.js";
import type * as stats from "../stats.js";
import type * as users from "../users.js";
import type * as votes from "../votes.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  _helpers: typeof _helpers;
  blog: typeof blog;
  cronJobs: typeof cronJobs;
  "crons/checkResults": typeof crons_checkResults;
  "crons/newsletterEditorial": typeof crons_newsletterEditorial;
  "crons/recalcStats": typeof crons_recalcStats;
  "crons/reminderPreRace": typeof crons_reminderPreRace;
  "crons/resultNotFound": typeof crons_resultNotFound;
  "crons/weeklyDigest": typeof crons_weeklyDigest;
  "crons/yearReview": typeof crons_yearReview;
  dataSources: typeof dataSources;
  "devOnly/markFeatured": typeof devOnly_markFeatured;
  "devOnly/promoteToAdmin": typeof devOnly_promoteToAdmin;
  emailDispatch: typeof emailDispatch;
  emailNotifications: typeof emailNotifications;
  "emails/templates/resultFound": typeof emails_templates_resultFound;
  http: typeof http;
  myRaces: typeof myRaces;
  newsletter: typeof newsletter;
  personalRecords: typeof personalRecords;
  predictions: typeof predictions;
  races: typeof races;
  ratings: typeof ratings;
  scraper: typeof scraper;
  stats: typeof stats;
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

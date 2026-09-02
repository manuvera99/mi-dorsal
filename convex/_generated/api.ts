// Stub de _generated/api.ts — generado por `npx convex dev`.
// En este stub, exponemos una estructura mínima del api object para que el
// código compile. En producción, `npx convex dev` regenera este archivo
// basado en las queries/mutations/actions definidas en convex/.

import { anyApi } from "convex/server";

export const api: any = {
  users: {
    getMyProfile: anyApi.users.getMyProfile,
    upsertMyProfile: anyApi.users.upsertMyProfile,
    getProfileByClerkId: anyApi.users.getProfileByClerkId,
  },
  races: {
    list: anyApi.races.list,
    getBySlug: anyApi.races.getBySlug,
    get: anyApi.races.get,
    getFeatured: anyApi.races.getFeatured,
    getBySlugForUser: anyApi.races.getBySlugForUser,
    create: anyApi.races.create,
  },
  ratings: {
    listForRace: anyApi.ratings.listForRace,
    summary: anyApi.ratings.summary,
    topRaces: anyApi.ratings.topRaces,
    myRating: anyApi.ratings.myRating,
    upsert: anyApi.ratings.upsert,
  },
  myRaces: {
    listMine: anyApi.myRaces.listMine,
    get: anyApi.myRaces.get,
    add: anyApi.myRaces.add,
    update: anyApi.myRaces.update,
    setManualResult: anyApi.myRaces.setManualResult,
    remove: anyApi.myRaces.remove,
    getPlannedRacesForCron: anyApi.myRaces.getPlannedRacesForCron,
  },
  personalRecords: {
    listMine: anyApi.personalRecords.listMine,
    upsert: anyApi.personalRecords.upsert,
    remove: anyApi.personalRecords.remove,
  },
  predictions: {
    listMine: anyApi.predictions.listMine,
    myAccuracy: anyApi.predictions.myAccuracy,
  },
  crons: {
    checkResults: {
      getRacesToCheck: anyApi.crons.checkResults.getRacesToCheck,
      checkResults: anyApi.crons.checkResults.checkResults,
      cacheResult: anyApi.crons.checkResults.cacheResult,
      updateMyRace: anyApi.crons.checkResults.updateMyRace,
    },
    reminderPreRace: {
      getRacesNeedingReminder: anyApi.crons.reminderPreRace.getRacesNeedingReminder,
      reminderPreRace: anyApi.crons.reminderPreRace.reminderPreRace,
    },
    weeklyDigest: {
      getActiveUsers: anyApi.crons.weeklyDigest.getActiveUsers,
      weeklyDigest: anyApi.crons.weeklyDigest.weeklyDigest,
    },
    yearReview: {
      getUsersForYearReview: anyApi.crons.yearReview.getUsersForYearReview,
      yearReview: anyApi.crons.yearReview.yearReview,
    },
  },
};

export const internal: any = api;

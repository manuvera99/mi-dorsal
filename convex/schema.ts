// =============================================================================
// mi-dorsal — Convex schema
// =============================================================================
// Modelo de datos completo. Auto-migración al hacer `npx convex dev`.
// =============================================================================

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ---------------------------------------------------------------------------
  // 1. PROFILES — datos del corredor, referenciados por `clerkUserId`
  // ---------------------------------------------------------------------------
  profiles: defineTable({
    clerkUserId: v.string(),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    club: v.optional(v.string()),
    // Strava (Ola 2)
    stravaUserId: v.optional(v.number()),
    stravaAccessToken: v.optional(v.string()),
    stravaRefreshToken: v.optional(v.string()),
    stravaTokenExpiresAt: v.optional(v.number()),
    // Garmin (Ola 2)
    garminUserId: v.optional(v.string()),
    garminAccessToken: v.optional(v.string()),
    garminRefreshToken: v.optional(v.string()),
    // Preferencias
    preferredLocale: v.optional(v.string()),
    emailResultsEnabled: v.optional(v.boolean()),
    emailRemindersEnabled: v.optional(v.boolean()),
    emailWeeklyDigestEnabled: v.optional(v.boolean()),
  })
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_strava_user_id", ["stravaUserId"]),

  // ---------------------------------------------------------------------------
  // 2. RACES — catálogo de carreras
  // ---------------------------------------------------------------------------
  races: defineTable({
    name: v.string(),
    slug: v.string(),
    locality: v.optional(v.string()),
    province: v.union(
      v.literal("alicante"),
      v.literal("valencia"),
      v.literal("castellon"),
      v.literal("murcia"),
      v.literal("albacete"),
      v.literal("almeria"),
    ),
    distanceKm: v.number(),
    elevationGainM: v.optional(v.number()),
    raceType: v.union(
      v.literal("road"),
      v.literal("trail"),
      v.literal("mixed"),
      v.literal("obstacle"),
    ),
    homologated: v.optional(v.boolean()),
    organizer: v.optional(v.string()),
    organizerUrl: v.optional(v.string()),
    resultsUrl: v.optional(v.string()),
    registrationUrl: v.optional(v.string()),
    officialUrl: v.optional(v.string()),
    startDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    isPublished: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
    scraperAdapter: v.optional(v.string()),
  })
    .index("by_province", ["province"])
    .index("by_date", ["startDate"])
    .index("by_slug", ["slug"])
    .index("by_published_date", ["isPublished", "startDate"])
    .index("by_race_type", ["raceType"])
    .searchIndex("search_races", {
      searchField: "name",
      filterFields: ["province", "raceType", "isPublished"],
    }),

  // ---------------------------------------------------------------------------
  // 3. RACE_RATINGS — votaciones 8D estilo correbirras
  // ---------------------------------------------------------------------------
  raceRatings: defineTable({
    userId: v.id("profiles"),
    raceId: v.id("races"),
    organization: v.optional(v.number()),
    price: v.optional(v.number()),
    swag: v.optional(v.number()),
    aidStations: v.optional(v.number()),
    course: v.optional(v.number()),
    atmosphere: v.optional(v.number()),
    postRace: v.optional(v.number()),
    trophies: v.optional(v.number()),
    comment: v.optional(v.string()),
  })
    .index("by_race", ["raceId"])
    .index("by_user", ["userId"])
    .index("by_user_race", ["userId", "raceId"]),

  // ---------------------------------------------------------------------------
  // 4. PERSONAL_RECORDS — PRs del usuario
  // ---------------------------------------------------------------------------
  personalRecords: defineTable({
    userId: v.id("profiles"),
    distanceM: v.number(),
    distanceLabel: v.string(),
    timeSeconds: v.number(),
    achievedAt: v.optional(v.string()),
    raceId: v.optional(v.id("races")),
    source: v.union(
      v.literal("manual"),
      v.literal("strava"),
      v.literal("garmin"),
      v.literal("race_result"),
    ),
    isCurrent: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_user_distance", ["userId", "distanceM"])
    .index("by_user_distance_current", ["userId", "distanceM", "isCurrent"]),

  // ---------------------------------------------------------------------------
  // 5. MY_RACES — calendario personal del usuario
  // ---------------------------------------------------------------------------
  myRaces: defineTable({
    userId: v.id("profiles"),
    raceId: v.id("races"),
    dorsalNumber: v.optional(v.string()),
    registrationDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.union(
      v.literal("planned"),
      v.literal("done"),
      v.literal("dns"),
      v.literal("dnf"),
    ),
    category: v.optional(v.string()),
    predictedTimeSeconds: v.optional(v.number()),
    predictionConfidence: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
    )),
    predictionFactors: v.optional(v.any()),
    actualTimeSeconds: v.optional(v.number()),
    actualPosition: v.optional(v.number()),
    actualPositionCategory: v.optional(v.number()),
    resultSource: v.optional(v.union(
      v.literal("auto_scrape"),
      v.literal("manual"),
    )),
    resultScrapedAt: v.optional(v.number()),
    diplomaStorageId: v.optional(v.id("_storage")),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_race", ["raceId"])
    .index("by_user_dorsal", ["userId", "dorsalNumber"])
    .index("by_race_dorsal", ["raceId", "dorsalNumber"]),

  // ---------------------------------------------------------------------------
  // 6. RACE_RESULTS_CACHE — resultados scrapeados, indexados por dorsal
  // ---------------------------------------------------------------------------
  raceResultsCache: defineTable({
    raceId: v.id("races"),
    dorsalNumber: v.string(),
    runnerName: v.optional(v.string()),
    category: v.optional(v.string()),
    positionOverall: v.optional(v.number()),
    positionCategory: v.optional(v.number()),
    positionGender: v.optional(v.number()),
    timeSeconds: v.number(),
    sourceUrl: v.optional(v.string()),
    scrapedAt: v.optional(v.number()),
  })
    .index("by_race", ["raceId"])
    .index("by_dorsal", ["dorsalNumber"])
    .index("by_race_dorsal", ["raceId", "dorsalNumber"])
    .index("by_race_position", ["raceId", "positionOverall"]),

  // ---------------------------------------------------------------------------
  // 7. PREDICTIONS — log de predicciones para calibración
  // ---------------------------------------------------------------------------
  predictions: defineTable({
    userId: v.id("profiles"),
    raceId: v.id("races"),
    myRaceId: v.optional(v.id("myRaces")),
    predictedTimeSeconds: v.number(),
    actualTimeSeconds: v.optional(v.number()),
    confidence: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
    )),
    modelVersion: v.string(),
    factors: v.any(),
    errorSeconds: v.optional(v.number()),
    errorPct: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_race", ["raceId"])
    .index("by_my_race", ["myRaceId"]),

  // ---------------------------------------------------------------------------
  // 8. NOTIFICATION_LOG — log de emails enviados
  // ---------------------------------------------------------------------------
  notificationLog: defineTable({
    userId: v.id("profiles"),
    type: v.union(
      v.literal("welcome"),
      v.literal("reminder_7d"),
      v.literal("reminder_1d"),
      v.literal("result_found"),
      v.literal("result_not_found"),
      v.literal("weekly_digest"),
      v.literal("year_review"),
    ),
    relatedRaceId: v.optional(v.id("races")),
    relatedMyRaceId: v.optional(v.id("myRaces")),
    sentAt: v.number(),
    delivered: v.boolean(),
    resendMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_type", ["type"])
    .index("by_user_type", ["userId", "type"]),
});

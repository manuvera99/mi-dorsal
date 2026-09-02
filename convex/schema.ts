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
    role: v.optional(v.union(
      v.literal("user"),
      v.literal("admin"),
    )),
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
    // Básicos
    name: v.string(),
    slug: v.string(),
    locality: v.optional(v.string()),
    province: v.union(
      // C. Valenciana
      v.literal("alicante"),
      v.literal("valencia"),
      v.literal("castellon"),
      // Murcia
      v.literal("murcia"),
      // Castilla-La Mancha
      v.literal("albacete"),
      v.literal("ciudad real"),
      v.literal("cuenca"),
      v.literal("guadalajara"),
      v.literal("toledo"),
      // Andalucía
      v.literal("almeria"),
      v.literal("granada"),
      v.literal("jaen"),
      v.literal("malaga"),
      v.literal("cordoba"),
      v.literal("sevilla"),
      v.literal("huelva"),
      v.literal("cadiz"),
      // Aragón
      v.literal("huesca"),
      v.literal("zaragoza"),
      v.literal("teruel"),
      // Cataluña
      v.literal("barcelona"),
      v.literal("girona"),
      v.literal("tarragona"),
      v.literal("lleida"),
      // Baleares
      v.literal("mallorca"),
      v.literal("menorca"),
      v.literal("ibiza"),
      // Canarias
      v.literal("las palmas"),
      v.literal("santa cruz de tenerife"),
      // Madrid
      v.literal("madrid"),
      // País Vasco
      v.literal("vizcaya"),
      v.literal("gipuzkoa"),
      v.literal("alava"),
      // Navarra
      v.literal("navarra"),
      // Asturias
      v.literal("asturias"),
      // Cantabria
      v.literal("cantabria"),
      // Galicia
      v.literal("a coruna"),
      v.literal("lugo"),
      v.literal("ourense"),
      v.literal("pontevedra"),
      // La Rioja
      v.literal("la rioja"),
      // Extremadura
      v.literal("caceres"),
      v.literal("badajoz"),
      // Castilla y León
      v.literal("leon"),
      v.literal("zamora"),
      v.literal("salamanca"),
      v.literal("valladolid"),
      v.literal("palencia"),
      v.literal("burgos"),
      v.literal("soria"),
      v.literal("avila"),
      v.literal("segovia"),
      // Ceuta y Melilla
      v.literal("ceuta"),
      v.literal("melilla"),
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

    // Fechas y lugar
    startDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    address: v.optional(v.string()),              // dirección exacta de salida
    venue: v.optional(v.string()),                 // lugar de salida/meta (ej. "Plaza del Ayuntamiento")

    // URLs clave (lo que Manu quiere BIEN VISIBLE)
    officialUrl: v.optional(v.string()),          // web oficial de la prueba
    registrationUrl: v.optional(v.string()),      // link directo a inscripción
    resultsUrl: v.optional(v.string()),            // link a resultados del cronometrador
    rulesUrl: v.optional(v.string()),              // reglamento

    // Organización
    organizer: v.optional(v.string()),
    organizerUrl: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),

    // Redes sociales del organizador
    socialInstagram: v.optional(v.string()),
    socialFacebook: v.optional(v.string()),
    socialTwitter: v.optional(v.string()),
    socialYoutube: v.optional(v.string()),
    socialStrava: v.optional(v.string()),

    // Precio
    priceEur: v.optional(v.number()),               // precio actual
    priceIncludes: v.optional(v.string()),          // qué incluye (camiseta, avituallamiento, etc.)

    // Inscripción
    registrationOpenDate: v.optional(v.string()),   // cuándo abren inscripciones
    registrationCloseDate: v.optional(v.string()),  // cuándo cierran
    maxParticipants: v.optional(v.number()),         // cupo máximo
    soldOut: v.optional(v.boolean()),
    chipType: v.optional(v.union(
      v.literal("manual"),
      v.literal("chip"),
      v.literal("disposable_chip"),
    )),

    // Categorías
    categories: v.optional(v.array(v.object({
      name: v.string(),           // "Senior M", "M35", "Sub-23 F", etc.
      gender: v.optional(v.union(v.literal("M"), v.literal("F"), v.literal("mixto"))),
      ageMin: v.optional(v.number()),
      ageMax: v.optional(v.number()),
    }))),

    // Servicios incluidos
    services: v.optional(v.object({
      aidStations: v.optional(v.number()),          // número de avituallamientos
      showers: v.optional(v.boolean()),
      changingRooms: v.optional(v.boolean()),
      bagDrop: v.optional(v.boolean()),
      parking: v.optional(v.boolean()),
      medical: v.optional(v.boolean()),
      physiotherapy: v.optional(v.boolean()),
      timingChip: v.optional(v.boolean()),
      photoService: v.optional(v.boolean()),
      videoService: v.optional(v.boolean()),
      swagBag: v.optional(v.boolean()),             // bolsa del corredor
      tShirt: v.optional(v.boolean()),
      medal: v.optional(v.boolean()),
      refreshments: v.optional(v.boolean()),
    })),

    // Recorrido
    courseType: v.optional(v.union(
      v.literal("loop"),         // circuito cerrado (vueltas)
      v.literal("point_to_point"), // punto a punto
      v.literal("out_and_back"), // ida y vuelta
    )),
    gpxUrl: v.optional(v.string()),                 // descarga del track GPX
    mapImageUrl: v.optional(v.string()),            // imagen del mapa/recorrido
    profileImageUrl: v.optional(v.string()),        // imagen del perfil de elevación
    timeLimitMinutes: v.optional(v.number()),        // tiempo máximo para completar
    cutoffs: v.optional(v.array(v.object({
      km: v.number(),
      timeLimit: v.string(),                         // hora límite
    }))),

    // Premios
    prizes: v.optional(v.string()),                 // descripción de los premios (texto libre)
    trophies: v.optional(v.boolean()),

    // Meta
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),               // cartel oficial
    isPublished: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
    scraperAdapter: v.optional(v.string()),

    // Hashtags / SEO
    hashtags: v.optional(v.array(v.string())),
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
    .index("by_user_race", ["userId", "raceId"])
    .index("by_user_dorsal", ["userId", "dorsalNumber"])
    .index("by_race_dorsal", ["raceId", "dorsalNumber"])
    .index("by_status", ["status"]),

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

  // ---------------------------------------------------------------------------
  // 9. RACE_VOTES — voto 👍/👎 de cada usuario en cada carrera
  // ---------------------------------------------------------------------------
  // Un usuario solo puede tener UN voto por carrera (puede cambiarlo).
  // Si quiere quitar el voto, usa `unvote`. La app móvil: tap otra vez el
  // mismo thumb = unvote.
  // ---------------------------------------------------------------------------
  raceVotes: defineTable({
    userId: v.id("profiles"),
    raceId: v.id("races"),
    vote: v.union(v.literal("up"), v.literal("down")),
  })
    .index("by_race", ["raceId"])
    .index("by_user", ["userId"])
    .index("by_user_race", ["userId", "raceId"]),
});

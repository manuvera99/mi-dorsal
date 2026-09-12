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
      // 'test' = usuario beta-tester marcado a mano por un admin.
      // Tendrá acceso completo a todas las funciones (cuando haya tiers
      // de pago, será tratado como premium a efectos de gating).
      // Mismo nivel de permisos que 'user' para acciones del propio
      // usuario (puede apuntarse a carreras, crear PRs, etc.); la
      // diferencia es que NO pagará cuando metamos Stripe.
      v.literal("test"),
    )),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    club: v.optional(v.string()),
    // Fecha de nacimiento (YYYY-MM-DD). Opcional y privado:
    // solo el propio usuario la ve exacta (en el input de edición);
    // en el resto de la app se muestra la edad calculada.
    birthDate: v.optional(v.string()),
    // Email real (Sprint 0): lo sincronizamos desde Clerk vía webhook o JWT.
    // Hasta entonces puede ser undefined, y los crons saltarán al usuario.
    email: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    // Strava (Ola 2)
    stravaUserId: v.optional(v.number()),
    stravaAccessToken: v.optional(v.string()),
    stravaRefreshToken: v.optional(v.string()),
    stravaTokenExpiresAt: v.optional(v.number()),
    stravaScope: v.optional(v.string()),
    stravaConnectedAt: v.optional(v.number()),
    stravaLastSyncAt: v.optional(v.number()),
    stravaWebhookSubscriptionId: v.optional(v.number()),
    // Strava export (Ola 0)
    stravaExportLastUploadAt: v.optional(v.number()),
    stravaExportLastActivityCount: v.optional(v.number()),
    stravaExportLastRaceCount: v.optional(v.number()),
    stravaExportLastPRCount: v.optional(v.number()),
    stravaAthleteCity: v.optional(v.string()),
    stravaAthleteWeightKg: v.optional(v.number()),
    stravaAthleteMaxHr: v.optional(v.number()),
    stravaAthleteRestHr: v.optional(v.number()),
    // Runner type (Ola 2)
    runnerTypeComputedAt: v.optional(v.number()),
    runnerTypeTags: v.optional(v.array(v.object({
      tag: v.string(),
      score: v.number(),
    }))),
    // Análisis del entrenador IA (Ola 2): texto narrativo generado a
    // petición del usuario desde /perfil, cacheado para no llamar al LLM
    // en cada visita — se regenera solo cuando el usuario pulsa el botón.
    coachAnalysisText: v.optional(v.string()),
    coachAnalysisAt: v.optional(v.number()),
    // Rate limit del entrenador IA (sesión 8 sep 2026):
    //   - free (role=user, sin suscripción premium): 1/mes
    //   - user normal con suscripción premium activa: 3/mes
    //   - pro (premium tier): ilimitado
    //   - admin o test: ilimitado (bypass total de paywall y rate limit)
    // Se resetea el día 1 de cada mes vía cron.
    aiCoachUsageCount: v.optional(v.number()),
    aiCoachUsageResetAt: v.optional(v.number()),
    // Onboarding (primer login)
    onboardingWelcomeSeen: v.optional(v.boolean()),
    onboardingWelcomeEmailSentAt: v.optional(v.number()),
    onboardingFirstRaceSavedAt: v.optional(v.number()),
    onboardingFirstPrAddedAt: v.optional(v.number()),
    // Garmin (Ola 2)
    garminUserId: v.optional(v.string()),
    garminAccessToken: v.optional(v.string()),
    garminRefreshToken: v.optional(v.string()),
    // Plantilla propia del editor de sticker (premium). 1 sola por
    // usuario — se sobrescribe al guardar una nueva. baseTemplateId
    // identifica de qué plantilla predefinida partió (solo informativo,
    // no se usa para resolver el layout: los `elements` ya son
    // autocontenidos).
    customStickerTemplate: v.optional(v.object({
      baseTemplateId: v.string(),
      elements: v.array(v.object({
        fieldId: v.string(),
        visible: v.boolean(),
        x: v.number(),
        y: v.number(),
        scale: v.number(),
        bgOpacity: v.optional(v.number()),
      })),
    })),
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
    // Frase textual detectada en la web oficial que justifica `homologated`
    // (no hay listado oficial de terceros consultable — es "según lo que
    // declara el organizador", no una verificación cruzada real).
    homologationNote: v.optional(v.string()),

    // Fechas y lugar
    startDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    address: v.optional(v.string()),              // dirección exacta de salida
    venue: v.optional(v.string()),                 // lugar de salida/meta (ej. "Plaza del Ayuntamiento")
    // Geolocalización de la carrera (lat/lng de la salida)
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),

    // URLs clave (lo que Manu quiere BIEN VISIBLE)
    officialUrl: v.optional(v.string()),          // web oficial de la prueba
    registrationUrl: v.optional(v.string()),      // link directo a inscripción
    resultsUrl: v.optional(v.string()),            // link a resultados del cronometrador
    photosUrl: v.optional(v.string()),             // link a la galería de fotos del proveedor (pegado a mano por el admin)
    rulesUrl: v.optional(v.string()),              // reglamento

    // URL dentro de la fuente de datos (ej. la ficha de la carrera en RFEA/Sportmaniacs)
    sourceUrl: v.optional(v.string()),             // enlace directo a la carrera en su dataSource

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
    mapUrl: v.optional(v.string()),                 // URL a la página con el mapa (Google Maps, etc.)
    mapEmbedUrl: v.optional(v.string()),            // URL embeddable del mapa (iframe src)
    altimetryImageUrl: v.optional(v.string()),      // imagen del perfil de elevación
    regulationUrl: v.optional(v.string()),          // URL al PDF/documento del reglamento
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

    // -------- CHIPLEVANTE ADAPTER (scraper de resultados) --------
    // El adapter de chiplevante.com necesita IDs internos que no están en la URL.
    // Los cacheamos aquí la primera vez que se scrapa para evitar parsear HTML en cada check.
    //   - chiplevanteEmpresa: "1" o "" (varía por evento)
    //   - chiplevanteCarreraIds: ["1","2","3"] (id de cada modalidad: 10K, 5K, etc.)
    // Solo se usan cuando scraperAdapter === "chiplevante".
    chiplevanteEmpresa: v.optional(v.string()),
    chiplevanteCarreraIds: v.optional(v.array(v.string())),

    // -------- SPORTMANIACS ADAPTER (scraper de resultados) --------
    // Una carrera de sportmaniacs.com puede tener varias modalidades
    // (un <div class="event-card" data-event-id="{uuid}"> por modalidad en
    // la página pública /es/races/{slug}), cada una con su propio UUID de
    // evento y su propia tabla de resultados independiente. El UUID que
    // devuelve el catálogo (api-aws.sportmaniacs.com/api/races) NO es este
    // UUID — es el de la carrera-evento contenedora, no acepta el endpoint
    // de resultados. Cacheamos aquí los UUIDs reales la primera vez que se
    // descubren (backfill) para no volver a parsear el HTML en cada check.
    // Solo se usan cuando scraperAdapter === "sportmaniacs".
    sportmaniacsEventIds: v.optional(v.array(v.object({
      eventId: v.string(),
      name: v.optional(v.string()),
      distanceKm: v.optional(v.number()),
    }))),

    // Hashtags / SEO
    hashtags: v.optional(v.array(v.string())),
    // FK opcional a la fuente de datos (RFEA, FEDME, etc.)
    dataSourceId: v.optional(v.id("dataSources")),
    // Cuándo se ingestó esta carrera por última vez
    ingestedAt: v.optional(v.number()),

    // -------- DEEP EXTRACTION (Fase 1) --------
    // Campos extraídos por IA desde la web oficial. Opcionales: muchas
    // carreras scraped inicialmente no tendrán todo esto hasta re-extraerlas.

    // Descripción larga (markdown o texto plano, hasta ~2000 chars)
    longDescription: v.optional(v.string()),

    // Modalidades alternativas de la misma carrera (5K + 10K + 21K, etc.)
    raceFormats: v.optional(v.array(v.object({
      name: v.string(),                                // "5K", "10K", "Maratón", "Trail 25K"
      distanceKm: v.number(),
      elevationGainM: v.optional(v.number()),
      startTime: v.optional(v.string()),               // HH:MM
      priceEur: v.optional(v.number()),
      maxParticipants: v.optional(v.number()),
    }))),

    // Avituallamientos detallados (con km, qué hay en cada uno)
    aidStations: v.optional(v.array(v.object({
      km: v.number(),                                  // km desde la salida
      name: v.optional(v.string()),                    // "Av. km 5 - Plaza Mayor"
      hasWater: v.optional(v.boolean()),
      hasIsotonic: v.optional(v.boolean()),
      hasFood: v.optional(v.boolean()),                // sólido (fruta, barritas)
      hasMedical: v.optional(v.boolean()),
    }))),

    // Tramos de precio (subida de precio por fecha)
    priceTiers: v.optional(v.array(v.object({
      fromDate: v.string(),                            // YYYY-MM-DD (inclusivo)
      toDate: v.optional(v.string()),                  // YYYY-MM-DD (exclusivo); null = sin límite
      priceEur: v.number(),
      label: v.optional(v.string()),                   // "1ª tanda", "2ª tanda", "Última tanda"
    }))),

    // Recogida de dorsal
    dorsalPickupLocation: v.optional(v.string()),
    dorsalPickupHours: v.optional(v.string()),         // "Vie 14-20h, Sáb 10-13h"

    // Altimetría per-km (para la calculadora de ritmos de Fase 3)
    altimetryData: v.optional(v.array(v.object({
      km: v.number(),                                  // km desde la salida
      altitudeM: v.number(),
    }))),

    // Galería de fotos
    galleryUrls: v.optional(v.array(v.string())),

    // Metadata de la última extracción profunda con IA
    extractedFromUrl: v.optional(v.string()),
    extractedAt: v.optional(v.number()),
    extractionConfidence: v.optional(v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    )),

    // officialUrl resuelta vía búsqueda web (Brave Search + verificación LLM)
    // cuando la URL original de la fuente estaba muerta. Trazabilidad para
    // poder auditar/depurar resultados dudosos después.
    officialUrlResolvedAt: v.optional(v.number()),
    officialUrlResolvedFrom: v.optional(v.string()),

    // -------- CROSS-SOURCE MERGE (Fase anti-duplicados) --------
    // Lista de IDs de carreras que se consolidaron en esta (merge cross-source).
    mergedFromIds: v.optional(v.array(v.string())),
    mergedAt: v.optional(v.number()),
    // Lista de fuentes adicionales que también tienen esta carrera
    // (dataSourceId guarda solo la principal; aquí están las demás para no perderlas).
    additionalDataSourceIds: v.optional(v.array(v.id("dataSources"))),
  })
    .index("by_province", ["province"])
    .index("by_date", ["startDate"])
    .index("by_slug", ["slug"])
    .index("by_published_date", ["isPublished", "startDate"])
    .index("by_data_source", ["dataSourceId"])
    .index("by_race_type", ["raceType"])
    .index("by_official_url", ["officialUrl"])
    .searchIndex("search_races", {
      searchField: "name",
      filterFields: ["province", "raceType", "isPublished"],
    }),

  // ---------------------------------------------------------------------------
  // 3. RACE_RATINGS — votaciones 8D de la comunidad
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
    /** Actividad (Strava/export) de la que se extrajo este PR. Útil para
     *  mostrar la ruta del PR, splits y gear. Null para PRs manuales o
     *  heredados antes de este cambio. */
    sourceActivityId: v.optional(v.id("activities")),
    /** Distancia de la actividad fuente, si es mayor que la del PR.
     *  P.ej. "10K" cuando un 5K PR se logró en una carrera de 10K.
     *  Se usa para mostrar el contexto "Lograda en: X" en la card
     *  y el detalle del PR. */
    sourceActivityDistanceLabel: v.optional(v.string()),
    /** ¿La actividad fuente fue una carrera (type="race")? */
    sourceActivityIsRace: v.optional(v.boolean()),
    source: v.union(
      v.literal("manual"),
      v.literal("strava"),
      v.literal("strava-export"),
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
    // Snapshot de la modalidad/distancia que el usuario eligió al añadir
    // la carrera (o al editarla después). Copia de datos, NO referencia a
    // un índice de race.raceFormats — así, si el admin re-extrae o edita
    // las modalidades de la carrera más tarde, esta inscripción no se ve
    // afectada. undefined = usuario no eligió (carrera sin raceFormats, o
    // fila creada antes de este cambio) → toda lectura debe caer de vuelta
    // a race.distanceKm (ver lib/prediction/effective-distance.ts).
    selectedDistanceKm: v.optional(v.number()),
    selectedDistanceLabel: v.optional(v.string()),
    selectedElevationGainM: v.optional(v.number()),
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
    // LEGACY: share card PNG (1200x630) del diseño anterior, retirado.
    // Ya no se genera ni se lee — se mantiene el campo solo para no
    // invalidar filas antiguas que aún lo tengan. No usar en código nuevo.
    shareCardStorageId: v.optional(v.id("_storage")),
    // Story sticker PNG (1080x1920, fondo transparente, plantilla
    // "clásica"). Pre-generado por
    // convex/emailNotificationsAction.sendResultFoundEmail al publicar
    // resultado. Es la imagen principal de resultado: se envía inline en
    // el email, se usa como og:image de /resultado y se puede descargar
    // desde ahí como overlay para Stories de Instagram/TikTok.
    storyStickerStorageId: v.optional(v.id("_storage")),
    // Story sticker VARIANTE EMAIL (1080x1920, fondo crema opaco + textos
    // oscuros). Generado en paralelo al sticker transparente, pensado para
    // incrustarse inline en el email de resultado sobre fondo claro: legible
    // sin depender de allowlist de imágenes del cliente. El archivo
    // descargado/adjunto sigue siendo el transparente (storyStickerStorageId).
    storyStickerEmailStorageId: v.optional(v.id("_storage")),
    // Story sticker PERSONALIZADO (editor premium). PNG exportado
    // client-side desde /editor-sticker/{myRaceId}. Se sobrescribe con
    // cada nueva exportación (attachCustomSticker borra el blob anterior).
    // Independiente de storyStickerStorageId (el fijo automático).
    customStickerStorageId: v.optional(v.id("_storage")),
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
      v.literal("photos_available"),
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

  // ---------------------------------------------------------------------------
  // 10. STATS_CACHE — contadores denormalizados para el admin dashboard
  // ---------------------------------------------------------------------------
  // Se recalculan vía un cron cada 5 min (convex/crons/recalcStats.ts).
  // La razón: adminGetStats() y getPublicStats() antes hacían
  // .collect() de TODAS las tablas en cada carga, quemando 1GB/mes
  // de Database I/O en plan free. Ahora leen 1 fila y listo.
  // ---------------------------------------------------------------------------
  statsCache: defineTable({
    key: v.string(),                            // "global" (única fila por ahora)
    computedAt: v.number(),                     // Date.now() del último recálculo
    totalRaces: v.number(),
    publishedRaces: v.number(),
    featuredRaces: v.number(),
    totalUsers: v.number(),
    adminUsers: v.number(),
    totalVotes: v.number(),
    totalRatings: v.number(),
    totalMyRaces: v.number(),
    totalPRs: v.number(),
    totalNotifications: v.number(),
    racesByProvince: v.record(v.string(), v.number()),
  })
    .index("by_key", ["key"]),

  // ---------------------------------------------------------------------------
  // 11. DATA_SOURCES — fuentes de donde sacamos las carreras (RFEA, FEDME…)
  // ---------------------------------------------------------------------------
  // Cada carrera puede tener una FK opcional (dataSourceId en races).
  // El admin puede re-sincronizar una fuente desde el panel.
  // ---------------------------------------------------------------------------
  dataSources: defineTable({
    name: v.string(),                            // "RFEA", "FEDME", "ITRA", ...
    slug: v.string(),                            // "rfea", "fedme", "itra", ...
    type: v.union(
      v.literal("scraper"),     // script Node.js en scripts/ingest-*.ts
      v.literal("api"),         // API HTTP externa
      v.literal("manual"),      // carreras añadidas a mano por admin
    ),
    description: v.optional(v.string()),
    baseUrl: v.optional(v.string()),            // URL base de la fuente
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("error"),
    ),
    // Última sincronización
    lastSyncAt: v.optional(v.number()),
    lastSyncDurationMs: v.optional(v.number()),
    lastSyncRaceCount: v.optional(v.number()),          // total (creadas+actualizadas)
    lastSyncCreatedCount: v.optional(v.number()),       // solo carreras nuevas
    lastSyncUpdatedCount: v.optional(v.number()),       // solo carreras ya existentes
    lastSyncError: v.optional(v.string()),
    // Acumulado
    totalRaces: v.optional(v.number()),         // carreras actuales en BBDD con esta fuente
    totalSyncs: v.optional(v.number()),         // número de veces que se ha sincronizado
    // Config
    config: v.optional(v.any()),                // scraper-specific (p.ej. URLs concretas)
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  // ---------------------------------------------------------------------------
  // 11. SYNC_HISTORY — log de sincronizaciones
  // ---------------------------------------------------------------------------
  syncHistory: defineTable({
    dataSourceId: v.id("dataSources"),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    status: v.union(
      v.literal("running"),
      v.literal("success"),
      v.literal("error"),
    ),
    raceCount: v.optional(v.number()),           // total (creadas+actualizadas)
    createdCount: v.optional(v.number()),        // solo carreras nuevas
    updatedCount: v.optional(v.number()),        // solo carreras ya existentes
    error: v.optional(v.string()),
    triggeredBy: v.optional(v.string()),         // "admin:user_id" o "cron"
  })
    .index("by_data_source", ["dataSourceId"])
    .index("by_status", ["status"]),

  // ---------------------------------------------------------------------------
  // 12. BLOG_POSTS — contenido editorial "Historias de dorsal"
  // ---------------------------------------------------------------------------
  // Cada post tiene su slug único, se almacena en markdown y se renderiza
  // con el componente <BlogPost />. La metadata SEO (seoTitle,
  // seoDescription, seoKeywords) se inyecta en <head> y en Schema.org Article.
  //
  // relatedRaceIds permite internal linking automático desde el post hacia
  // fichas de carreras reales del catálogo (mejora SEO y navegación).
  //
  // newsletterSentAt se setea cuando el post se incluye en la newsletter
  // editorial mensual, para no repetir el mismo post dos veces.
  // ---------------------------------------------------------------------------
  blogPosts: defineTable({
    slug: v.string(),
    title: v.string(),
    excerpt: v.string(),                         // máx ~200 chars, se muestra en listados
    content: v.string(),                         // markdown
    coverImageId: v.optional(v.id("_storage")),
    coverImageUrl: v.optional(v.string()),       // url alternativa (CDN, externa)
    coverImageAlt: v.optional(v.string()),
    category: v.union(
      v.literal("historias"),
      v.literal("guias"),
      v.literal("curiosidades"),
      v.literal("tendencias"),
    ),
    tags: v.optional(v.array(v.string())),
    authorId: v.optional(v.id("profiles")),
    authorName: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
    isPublished: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
    seoTitle: v.optional(v.string()),
    seoDescription: v.optional(v.string()),
    seoKeywords: v.optional(v.array(v.string())),
    readingTimeMinutes: v.optional(v.number()),
    views: v.optional(v.number()),
    relatedRaceIds: v.optional(v.array(v.id("races"))),
    newsletterSentAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_published_date", ["isPublished", "publishedAt"])
    .index("by_category", ["category", "isPublished", "publishedAt"])
    .index("by_featured", ["isFeatured", "isPublished", "publishedAt"])
    .searchIndex("search_blog", {
      searchField: "title",
      filterFields: ["category", "isPublished"],
    }),

  // ---------------------------------------------------------------------------
  // 13. NEWSLETTER_SUBSCRIBERS — suscriptores externos (sin cuenta en mi-dorsal)
  // ---------------------------------------------------------------------------
  // Doble opt-in (RGPD España LSSI): status "pending" hasta que confirma
  // vía email, luego "active". "unsubscribed" y "bounced" son terminales.
  //
  // preferences permite segmentar: editorial (mensual), raceReminders
  // (T-14d / T-3d), results (cuando se publica resultado).
  //
  // Si el suscriptor es también usuario de mi-dorsal, profileId lo enlaza
  // para evitar duplicados.
  //
  // subscriptionIp + subscriptionUserAgent son auditoría RGPD; se almacenan
  // hasheados en producción (ver app/api/newsletter/subscribe/route.ts).
  // ---------------------------------------------------------------------------
  newsletterSubscribers: defineTable({
    email: v.string(),
    status: v.union(
      v.literal("pending"),       // doble opt-in pendiente
      v.literal("active"),        // confirmado, recibiendo emails
      v.literal("unsubscribed"),  // baja voluntaria
      v.literal("bounced"),       // email rebotado
    ),
    source: v.union(
      v.literal("blog"),
      v.literal("landing"),
      v.literal("footer"),
      v.literal("admin"),
      v.literal("import"),
    ),
    preferences: v.object({
      editorialEnabled: v.boolean(),
      raceRemindersEnabled: v.boolean(),
      resultsEnabled: v.boolean(),
    }),
    locale: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    confirmToken: v.optional(v.string()),         // one-shot, se borra al confirmar
    unsubscribeToken: v.optional(v.string()),    // estable, se mantiene siempre
    confirmedAt: v.optional(v.number()),
    subscribedAt: v.number(),
    unsubscribedAt: v.optional(v.number()),
    lastSentAt: v.optional(v.number()),
    // RGPD audit
    subscriptionIpHash: v.optional(v.string()),  // SHA-256, nunca IP en claro
    subscriptionUserAgent: v.optional(v.string()),
    unsubscribedReason: v.optional(v.string()),
    profileId: v.optional(v.id("profiles")),
    // Single opt-in (RGPD): el checkbox del frontend es prueba de consentimiento.
    // Guardamos timestamp + IP hasheada + UA como prueba de auditoría.
    consentAt: v.optional(v.number()),
    consentIpHash: v.optional(v.string()),
    consentUserAgent: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_status_locale", ["status", "locale"])
    .index("by_status_editorial", ["status", "preferences.editorialEnabled"])
    .index("by_profile", ["profileId"]),

  // ---------------------------------------------------------------------------
  // 14. ACTIVITIES — actividades ingestadas desde Strava, Garmin, etc.
  // ---------------------------------------------------------------------------
  // El provider indica la fuente:
  //   - "strava"        → OAuth con Strava (Ola 1)
  //   - "strava-export" → ZIP subido por el usuario (Ola 0)
  //   - "garmin"        → futuro
  // source distingue OAuth vs export para que el RGPD sea independiente.
  // (provider, providerActivityId) es único por usuario (índice unique implícito
  // en la combinación con userId, gestionado por upsert con check previo).
  // ---------------------------------------------------------------------------
  activities: defineTable({
    userId: v.id("profiles"),
    provider: v.union(
      v.literal("strava"),
      v.literal("strava-export"),
      v.literal("garmin"),
    ),
    source: v.union(v.literal("oauth"), v.literal("export")),
    providerActivityId: v.string(),
    type: v.union(
      v.literal("race"),
      v.literal("long_run"),
      v.literal("tempo"),
      v.literal("interval"),
      v.literal("easy"),
      v.literal("recovery"),
      v.literal("trail"),
    ),
    name: v.optional(v.string()),
    startedAt: v.number(),
    durationSec: v.number(),
    distanceM: v.number(),
    avgPaceSecPerKm: v.optional(v.number()),
    avgHeartRate: v.optional(v.number()),
    maxHeartRate: v.optional(v.number()),
    avgCadence: v.optional(v.number()),
    elevationGainM: v.optional(v.number()),
    elevationLossM: v.optional(v.number()),
    description: v.optional(v.string()),
    matchedRaceId: v.optional(v.id("races")),
    isOfficialResult: v.optional(v.boolean()),
    isPrivate: v.optional(v.boolean()),
    // ---------------------------------------------------------------------
    // Datos extraídos del detalle de Strava (getActivity), no del listado.
    // Todos opcionales: las actividades ingeridas por export ZIP o antes
    // de este cambio (2026-09-08) no los tienen, y el detalle puede no
    // llegar por rate limit o fallo de fetch — la UI tiene que tratarlos
    // como "no disponible", no como error.
    // ---------------------------------------------------------------------
    /** Polyline codificada del track GPS (formato Google). Decodificar a [lat,lng][]. */
    mapPolyline: v.optional(v.string()),
    /** ID del gear de Strava (zapatillas, bici). */
    gearId: v.optional(v.string()),
    /** Nombre del gear (ej. "Nike Pegasus 41"). */
    gearName: v.optional(v.string()),
    /** Distancia total acumulada en este gear en el momento de la actividad (m). */
    gearDistanceM: v.optional(v.number()),
    /** Nombre del dispositivo con el que se grabó (ej. "Garmin Forerunner 945"). */
    deviceName: v.optional(v.string()),
    /** Splits por km (running) — pace, HR, cadencia, desnivel por km. */
    splitsMetric: v.optional(
      v.array(
        v.object({
          split: v.number(),
          distance: v.number(),
          elapsed_time: v.number(),
          moving_time: v.number(),
          elevation_difference: v.number(),
          average_speed: v.number(),
          average_heartrate: v.optional(v.number()),
          average_cadence: v.optional(v.number()),
        }),
      ),
    ),
    /** Ciudad/estado/país de la actividad (si Strava los tiene). */
    locationCity: v.optional(v.string()),
    locationCountry: v.optional(v.string()),
    // -----------------------------------------------------------------
    // Campos extra de Strava para reports (añadidos 2026-09-08)
    // -----------------------------------------------------------------
    // Engagement / social
    kudosCount: v.optional(v.number()),
    commentCount: v.optional(v.number()),
    achievementCount: v.optional(v.number()),
    athleteCount: v.optional(v.number()),
    photoCount: v.optional(v.number()),
    // Esfuerzo / training load
    calories: v.optional(v.number()),
    workoutType: v.optional(v.number()), // 0=default, 1=race, 2=long_run, 3=interval
    perceivedExertion: v.optional(v.number()),
    sufferScore: v.optional(v.number()),
    /**
     * Detección de series/intervalos a partir de los splits por km
     * (splitsMetric). Se calcula en el ingest y en el backfill. La señal
     * primaria es la variabilidad del pace entre splits (CV>15% + >=2
     * rápidos + >=2 lentos). Se mantiene aunque workoutType venga de
     * Strava porque Garmin Connect no lo rellena.
     */
    detectedIntervals: v.optional(
      v.object({
        isIntervalWorkout: v.boolean(),
        confidence: v.optional(v.union(
          v.literal("high"),
          v.literal("medium"),
          v.literal("low"),
        )),
        detectionMode: v.optional(v.union(
          v.literal("laps"),
          v.literal("splits"),
          v.literal("name"),
          v.null(),
        )),
        paceVariabilityCv: v.number(),
        fastDeltaSecPerKm: v.optional(v.number()),
        slowDeltaSecPerKm: v.optional(v.number()),
        fastSplits: v.number(),
        slowSplits: v.number(),
        estimatedRepetitions: v.number(),
        fastPaceSecPerKm: v.union(v.number(), v.null()),
        slowPaceSecPerKm: v.union(v.number(), v.null()),
        fastAvgHrBpm: v.union(v.number(), v.null()),
        slowAvgHrBpm: v.union(v.number(), v.null()),
        isTrackLike: v.optional(v.boolean()),
        reason: v.string(),
      }),
    ),
    // Potencia (cycling o running con Stryd/PowerPod)
    hasPower: v.optional(v.boolean()),
    averageWatts: v.optional(v.number()),
    maxWatts: v.optional(v.number()),
    weightedAverageWatts: v.optional(v.number()),
    // Cadencia
    maxCadence: v.optional(v.number()),
    // Identificadores y extras de Strava
    utcOffsetSeconds: v.optional(v.number()),
    externalId: v.optional(v.string()),
    averageGradeAdjustedSpeed: v.optional(v.number()),
    gradeAdjustedDistance: v.optional(v.number()),
    embedToken: v.optional(v.string()),
    // Weather (si Strava lo registró; recientes suelen tenerlo)
    averageTemp: v.optional(v.number()),
    minTemp: v.optional(v.number()),
    maxTemp: v.optional(v.number()),
    feelsLikeTemp: v.optional(v.number()),
    averageWindSpeed: v.optional(v.number()),
    precipitationIntensity: v.optional(v.number()),
    weatherObservationTime: v.optional(v.string()),
    // Laps (vueltas/intervalos). v.any() porque Strava devuelve muchos
    // campos extra (activity, athlete, average_cadence, device_watts,
    // pace_zone, etc.) que no necesitamos y que el validator rechaza.
    // Mantenemos los laps por si en el futuro se quiere usar la señal
    // más fiable de series (laps cortos con paces alternantes).
    laps: v.optional(v.array(v.any())),
    // Segment efforts: cada segmento que cruzó la actividad con su
    // tiempo, rank, etc. También v.any() por la misma razón.
    segmentEfforts: v.optional(v.array(v.any())),
    // Detalle crudo completo de Strava (parseado, no stringified).
    // Acceso por reports ad-hoc sin tener que volver a pedir a Strava.
    // v.any() evita que un campo nuevo de Strava rompa el ingest.
    rawStravaDetail: v.optional(v.any()),
    // Tipo de deporte original de Strava (Run, TrailRun, Ride, Padel, Hike,
    // WeightTraining, etc.) — SIN normalizar. `type` (arriba) es NUESTRA
    // clasificación de intensidad de carrera (race/tempo/easy/...), pero
    // Strava también ingiere ciclismo, pádel, esquí, pesas, etc. bajo el
    // mismo endpoint. Sin este campo no hay forma barata de excluir "no es
    // running" de queries de feed/stats.
    // Opcional porque las actividades ingeridas ANTES de este campo (2026-09-07)
    // no lo tienen; para esas, el fallback es asumir "Run" (ya pasaron por
    // classifyActivity, que asume Run/Unknown si no reconoce el tipo).
    stravaSportType: v.optional(v.string()),
    // === 8 sep 2026: optimizaciones de coste ===
    // Precomputado de isRunningSportType(stravaSportType) para poder filtrar
    // en el índice `by_user_running` y NO leer actividades de ciclismo /
    // pádel / esquí / pesas en cada carga del feed. Sin esto, las queries
    // hacían .collect() y filtraban en cliente (enviaba toda la tabla al
    // cliente antes de filtrar). Lo escribe el ingest + la migración.
    isRunning: v.optional(v.boolean()),
    syncedAt: v.number(),
  })
    .index("by_user_started", ["userId", "startedAt"])
    .index("by_user_type", ["userId", "type"])
    // Índice para filtrar solo running en el feed/stats. Con 1 user y 712
    // actividades, filtrar en cliente cuesta ~1.3 MB de bandwidth por query;
    // con índice, solo se leen las ~200-300 actividades de running.
    .index("by_user_running", ["userId", "isRunning", "startedAt"])
    .index("by_matched_race", ["matchedRaceId"])
    .index("by_provider_activity", ["provider", "providerActivityId"]),

  // ---------------------------------------------------------------------------
  // 15. UPLOADS — historial de subidas de export (Strava, Garmin)
  // ---------------------------------------------------------------------------
  // Trackea cada ZIP que el usuario sube, con su estado de procesamiento.
  // El ZIP se borra de Convex File Storage tras la ingesta (exitosa o fallida).
  // ---------------------------------------------------------------------------
  uploads: defineTable({
    userId: v.id("profiles"),
    source: v.literal("strava-export"),
    fileStorageId: v.optional(v.id("_storage")),
    fileName: v.string(),
    fileSizeBytes: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("failed"),
    ),
    totalActivities: v.optional(v.number()),
    processedActivities: v.optional(v.number()),
    matchedRaces: v.optional(v.number()),
    newPRs: v.optional(v.number()),
    candidatesAdded: v.optional(v.number()),
    profileFieldsUpdated: v.optional(v.number()),
    error: v.optional(v.string()),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_user_started", ["userId", "startedAt"]),

  // ---------------------------------------------------------------------------
  // 16. RACE_CANDIDATES — carreras detectadas en uploads que no matchean
  // ---------------------------------------------------------------------------
  // Cuando un usuario sube un export y una actividad de Strava no matchea con
  // ninguna carrera de nuestro catálogo, la guardamos aquí. Si varios usuarios
  // la reportan, la subimos a "pending_review" para que un admin la revise
  // y la añada al catálogo si procede.
  // ---------------------------------------------------------------------------
  raceCandidates: defineTable({
    name: v.string(),
    date: v.number(),
    locality: v.optional(v.string()),
    distanceM: v.optional(v.number()),
    userId: v.id("profiles"),
    occurrenceCount: v.number(),
    status: v.union(
      v.literal("candidate"),
      v.literal("pending_review"),
      v.literal("linked_to_race"),
      v.literal("added_to_catalog"),
      v.literal("rejected"),
    ),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    linkedRaceId: v.optional(v.id("races")),
  })
    .index("by_status", ["status"])
    .index("by_name_date", ["name", "date"])
    .index("by_user", ["userId"]),

  // ---------------------------------------------------------------------------
  // 17. RACE_SUGGESTIONS — carreras que un usuario logueado nos sugiere
  // ---------------------------------------------------------------------------
  // Cuando un usuario busca en /carreras y no encuentra su carrera, puede
  // pegar la URL de la web oficial. Esto crea una entrada "pending" que el
  // admin ve en /admin/race-suggestions y puede convertir en carrera real
  // abriendo /admin/races/from-url con la URL pre-rellena.
  // ---------------------------------------------------------------------------
  raceSuggestions: defineTable({
    userId: v.id("profiles"),
    url: v.string(),
    note: v.optional(v.string()),
    suggestedName: v.optional(v.string()),
    suggestedDate: v.optional(v.string()),
    suggestedLocality: v.optional(v.string()),
    suggestedProvince: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("created"),
    ),
    adminNote: v.optional(v.string()),
    reviewedBy: v.optional(v.id("profiles")),
    reviewedAt: v.optional(v.number()),
    createdRaceId: v.optional(v.id("races")),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_user", ["userId"])
    .index("by_status_created", ["status", "createdAt"]),

  // ---------------------------------------------------------------------------
  // 18. FEEDBACK_REPORTS — feedback y bug reports enviados por usuarios
  // ---------------------------------------------------------------------------
  // Formulario público donde cualquier usuario puede reportar un bug,
  // sugerir una mejora o dejar feedback. userId es opcional (anónimos
  // también pueden reportar). pageUrl es donde estaba cuando reportó.
  // status: new → in_progress → done/wontfix.
  // ---------------------------------------------------------------------------
  feedbackReports: defineTable({
    userId: v.optional(v.id("profiles")),
    type: v.union(
      v.literal("bug"),
      v.literal("idea"),
      v.literal("feedback"),
    ),
    title: v.string(),
    description: v.string(),
    pageUrl: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    // Si el reporte viene desde una ficha de carrera concreta, lo asociamos
    // para que el admin pueda navegar desde /admin/feedback al contexto.
    raceId: v.optional(v.id("races")),
    status: v.union(
      v.literal("new"),
      v.literal("in_progress"),
      v.literal("done"),
      v.literal("wontfix"),
    ),
    adminNote: v.optional(v.string()),
    reviewedBy: v.optional(v.id("profiles")),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_status_created", ["status", "createdAt"])
    .index("by_type", ["type"])
    .index("by_user", ["userId"])
    .index("by_race", ["raceId"]),

  // ---------------------------------------------------------------------------
  // 19. SUBSCRIPTIONS — mirror local del estado de subscripción de Clerk
  // ---------------------------------------------------------------------------
  // Clerk Billing (powered by Stripe) gestiona la pasarela de pago, la
  // creación del customer, los cobros recurrentes, los webhooks y el
  // cumplimiento fiscal. Esta tabla es un MIRROR de solo lectura para:
  //   1) Queries rápidas desde el cliente (getMySubscription) sin
  //      re-loguear al usuario contra Clerk en cada navegación.
  //   2) Feature gating en el backend Convex (hasPremiumFeature) sin
  //      una llamada extra a la API de Clerk.
  //   3) Métricas propias (MRR, churn) sin depender del dashboard de Clerk.
  //   4) Auditoría: histórico de cambios de plan aunque Clerk los borre.
  //
  // Fuente de verdad para PAGOS: Clerk Billing / Stripe. Esta tabla se
  // sincroniza vía /api/webhooks/clerk-billing (Svix-verified). NUNCA
  // escribir en ella desde el cliente: solo mutations internas
  // (`upsertFromClerkEvent`, `cancelFromClerkEvent`).
  //
  // Esquema de activation:
  //   - Plan "free" → status: "active", plan: "free". Cubre todos los
  //     usuarios que nunca pagaron.
  //   - Plan "premium" (o el nombre que se defina) → status: "active" mientras
  //     la suscripción esté viva; "past_due" si falló un cobro; "canceled" si
  //     el usuario canceló (mantenemos acceso hasta currentPeriodEnd).
  //
  // IMPORTANTE: NO activar hasta tener:
  //   1) Clerk Billing habilitado en el dashboard de Clerk
  //   2) Productos creados (Free + Premium) en el dashboard
  //   3) Webhook Svix configurado y firma verificada
  //   4) Permission key "premium" creada y mapeada a la suscripción
  // Mientras tanto, dejar la tabla vacía y `getMySubscription` devuelve null
  // (la app sigue funcionando 100% en plan free).
  // ---------------------------------------------------------------------------
  subscriptions: defineTable({
    /** userId de Clerk (string, no Convex Id porque el user puede
     *  no estar aún en profiles si acaba de pagar y aún no se ha
     *  sincronizado). El webhook hace upsert por clerkUserId. */
    clerkUserId: v.string(),

    /** ID de la suscripción en Clerk (clerk subscription ID).
     *  Una por usuario mientras esté activa; en cancelada mantenemos
     *  el id para histórico. */
    clerkSubscriptionId: v.string(),

    /** ID del plan/producto en Clerk. ej: "free_user", "premium_monthly",
     *  "premium_yearly". Permite distinguir mensual vs anual sin
     *  parsear el nombre. */
    planId: v.string(),
    /** Nombre legible del plan (para mostrar en UI/admin). */
    planName: v.string(),
    /** "free" | "premium" (futuro: "team", "lifetime"...). Es el nivel
     *  lógico, NO el SKU concreto. El feature gating se hace sobre
     *  este campo. */
    tier: v.union(
      v.literal("free"),
      v.literal("premium"),
    ),

    /** Estado reportado por Clerk. Lo guardamos tal cual para poder
     *  mostrar el estado real en /cuenta/suscripcion sin recalcular. */
    status: v.union(
      v.literal("active"),         // suscripción viva, próxima a cobrar
      v.literal("trialing"),       // en trial gratuito
      v.literal("past_due"),       // cobro falló, reintentando
      v.literal("canceled"),       // cancelada por el usuario
      v.literal("incomplete"),     // primer cobro falló, no llegó a activarse
      v.literal("incomplete_expired"),
      v.literal("unpaid"),
      v.literal("paused"),
    ),

    /** Fecha del próximo cobro (unix ms) o null si está cancelada/trial. */
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    /** true si el usuario marcó para cancelar al final del periodo
     *  (sigue teniendo acceso hasta currentPeriodEnd). */
    cancelAtPeriodEnd: v.optional(v.boolean()),
    /** Cuándo se canceló definitivamente (unix ms). */
    canceledAt: v.optional(v.number()),

    /** ID del customer en Clerk/Stripe (útil para soporte). */
    customerId: v.optional(v.string()),
    /** Email del pagador (a veces distinto al email del user). */
    customerEmail: v.optional(v.string()),

    /** Cantidad y moneda del plan (ej: 499 EUR, 3900 EUR). null en free. */
    amountCents: v.optional(v.number()),
    currency: v.optional(v.string()),

    /** Última vez que Clerk nos notificó algo de esta sub (unix ms). */
    lastSyncedAt: v.number(),
    /** Cuándo se creó esta fila (unix ms). */
    createdAt: v.number(),
    /** Evento más reciente de Clerk que la modificó (para debug). */
    lastEventType: v.optional(v.string()),
    lastEventId: v.optional(v.string()),

    // -------------------------------------------------------------------------
    // Campos de Stripe (migración 9 sep 2026, ver docs/BILLING_SETUP.md).
    // Coexisten con los de Clerk durante la transición. Una fila activa
    // actualmente tiene UNO u otro proveedor, no los dos. Mantener ambos
    // deprecated para permitir rollback sin migración de datos.
    // -------------------------------------------------------------------------

    /** ID del customer en Stripe (cus_...). Único por user. Creado al
     *  primer checkout, reutilizado en renovaciones y en el portal.
     *  Lo guardamos para no tener que llamar a stripe.customers.search
     *  en cada webhook. */
    stripeCustomerId: v.optional(v.string()),

    /** ID de la suscripción en Stripe (sub_...). */
    stripeSubscriptionId: v.optional(v.string()),

    /** ID del price (price_...). Distingue mensual de anual. */
    stripePriceId: v.optional(v.string()),
  })
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_clerk_subscription_id", ["clerkSubscriptionId"])
    .index("by_tier", ["tier"])
    .index("by_status", ["status"])
    .index("by_stripe_customer_id", ["stripeCustomerId"])
    .index("by_stripe_subscription_id", ["stripeSubscriptionId"]),

  // ---------------------------------------------------------------------------
  // 20. CLUB_SUGGESTIONS — clubes que un usuario no encontró en la lista RFEA
  // ---------------------------------------------------------------------------
  // Cuando un usuario busca su club en el selector de /perfil y no lo
  // encuentra, puede reportarlo. Llega al admin para que (a) lo añada al
  // próximo ingest de la RFEA, o (b) lo descarte si no procede (duplicado,
  // no es un club de atletismo, etc.).
  //
  // status:
  //   - new: pendiente de revisar por el admin
  //   - added: ya se añadió al catálogo (en el próximo re-ingest)
  //   - duplicate: era un duplicado de uno ya existente
  //   - rejected: no procede (no es club de atletismo, etc.)
  // ---------------------------------------------------------------------------
  clubSuggestions: defineTable({
    // Opcional: el flujo real está en /perfil (logueado), pero dejamos la
    // puerta abierta a reportes anónimos para no romper si en el futuro
    // alguien reporta desde /carreras o /feedback.
    userId: v.optional(v.id("profiles")),
    clubName: v.string(),
    ccaa: v.optional(v.string()),
    note: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    status: v.union(
      v.literal("new"),
      v.literal("added"),
      v.literal("duplicate"),
      v.literal("rejected"),
    ),
    adminNote: v.optional(v.string()),
    reviewedBy: v.optional(v.id("profiles")),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_status_created", ["status", "createdAt"])
    .index("by_user", ["userId"])
    .index("by_club_name", ["clubName"]),

  // ---------------------------------------------------------------------------
  // 20. CLUBS_CATALOG — clubs manuales / añadidos por el admin
  // ---------------------------------------------------------------------------
  // Catálogo extendido de clubes. El catálogo base son los clubs federados
  // de la RFEA (cargados en `lib/data/clubs.json` en build time), pero
  // algunos clubs (populares, secciones de colegio, clubs de running no
  // federados, etc.) se añaden manualmente desde /admin/clubs.
  //
  // El ClubSelect combina ambas fuentes en runtime. Los clubs manuales
  // tienen precedencia sobre la RFEA en caso de duplicado de nombre+ccaa.
  //
  // Cuando el admin marca una sugerencia como "added" en
  // /admin/club-suggestions, el handler crea automáticamente una fila
  // aquí con source: "from_suggestion".
  // ---------------------------------------------------------------------------
  clubsCatalog: defineTable({
    name: v.string(),
    ccaa: v.string(),
    source: v.union(
      v.literal("manual"),
      v.literal("from_suggestion"),
    ),
    // Si viene de una sugerencia, referencia a la fila original.
    suggestionId: v.optional(v.id("clubSuggestions")),
    createdBy: v.id("profiles"),
    createdAt: v.number(),
    // Si el admin lo desactivó (en vez de eliminarlo para mantener
    // referencias históricas en clubSuggestions, etc.).
    isActive: v.optional(v.boolean()),
  })
    .index("by_name_ccaa", ["name", "ccaa"])
    .index("by_active", ["isActive"])
    .index("by_source", ["source"])
    .index("by_suggestion", ["suggestionId"]),

  // ---------------------------------------------------------------------------
  // 19b. CLUB_MEMBERSHIPS — pertenencia de un corredor a un club (Sprint 4)
  // ---------------------------------------------------------------------------
  // Tabla de relación profile↔club. La capa nueva de "comunidad de clubs"
  // se apoya aquí:
  //   - El corredor se "une" a un club del catálogo (mutation joinClub, Pro).
  //   - La query getMyMembership devuelve su club activo (si lo tiene).
  //   - El ranking de temporada (C3) sumará dorsales finalizados de los
  //     miembros activos (leftAt = undefined).
  //
  // Reglas:
  //   - Un corredor puede estar como máximo en 1 club activo. Si quiere
  //     cambiarse, primero leaveClub (setea leftAt) y luego joinClub.
  //   - leftAt se setea en vez de borrar la fila para mantener histórico
  //     de "estuvo en este club hasta X" (futuro: trofeos de antigüedad).
  //   - joinedAt es la fecha del alta, dorsalNumber es opcional (display).
  // ---------------------------------------------------------------------------
  clubMemberships: defineTable({
    clubCatalogId: v.id("clubsCatalog"),
    profileId: v.id("profiles"),
    joinedAt: v.number(),
    // null/undefined = sigue activo. Si se setea, es el momento en que
    // salió del club.
    leftAt: v.optional(v.number()),
    // Dorsal favorito del club (opcional, solo display en el podium del
    // club). Útil para el "dorsal del club" del runner.
    dorsalNumber: v.optional(v.string()),
  })
    .index("by_club", ["clubCatalogId"])
    .index("by_profile", ["profileId"])
    .index("by_club_active", ["clubCatalogId", "leftAt"]),

  // ---------------------------------------------------------------------------
  // 20. AI_USAGE_LOG — registro de cada llamada a un LLM
  // ---------------------------------------------------------------------------
  // Una fila por cada llamada a OpenAI/MiniMax/Claude/etc. desde lib/ai/*.
  // Se usa para:
  //   - Panel /admin/ai-usage: gráfica diaria de tokens, coste estimado en €,
  //     desglose por función de lib/ai/* y por modelo.
  //   - Auditoría: detectar spikes de consumo o errores.
  //
  // El coste se calcula en el momento del log (en el cliente que llama) a
  // partir de los precios hardcoded en lib/ai/pricing.ts y se guarda como
  // costeEur para no tener que re-evaluar cada vez que se cambian las
  // tarifas. Esto significa que el histórico refleja el coste a precio de
  // ese momento — para "coste a precios de hoy" habría que recomputar.
  //
  // functionLabel identifica el origen de la llamada. Valores actuales:
  //   - "extract_race"        → lib/ai/extract-race.ts
  //   - "extract_race_deep"   → lib/ai/extract-race-deep.ts
  //   - "analyze_source"      → lib/ai/analyze-source.ts
  //   - "coach_analysis"      → lib/ai/coach-analysis.ts
  //   - "resolve_race_url"    → lib/ai/resolve-race-url.ts (Brave Search +
  //                            verificación LLM; model="brave-search" para
  //                            la parte de búsqueda, modelo real del LLM
  //                            para la parte de verificación)
  // ---------------------------------------------------------------------------
  aiUsageLog: defineTable({
    /** Cuándo se hizo la llamada (timestamp unix ms). */
    timestamp: v.number(),
    /** Origen de la llamada dentro de lib/ai/. Ver comentario arriba. */
    functionLabel: v.string(),
    /** Modelo usado (ej: "gpt-4o-mini", "MiniMax-M3"). */
    model: v.string(),
    /** Base URL del proveedor (para distinguir OpenAI vs MiniMax vs otros). */
    provider: v.string(),
    /** Tokens de prompt (input). */
    promptTokens: v.number(),
    /** Tokens de completion (output). */
    completionTokens: v.number(),
    /** promptTokens + completionTokens. Lo guardamos pre-computado para
     *  no tener que sumar en cada query de la pantalla admin. */
    totalTokens: v.number(),
    /** Coste estimado en EUR, calculado en el momento del log con
     *  lib/ai/pricing.ts. */
    costEur: v.number(),
    /** "¿Tuvo éxito la llamada?" — false si fue un error (timeout, 4xx/5xx). */
    success: v.boolean(),
    /** Mensaje de error si success=false. Acotado a 500 chars. */
    errorMessage: v.optional(v.string()),
    /** Duración de la llamada en ms (incluye el fetch al LLM, no el pre/post
     *  processing en lib/ai/). Útil para detectar lentitud. */
    durationMs: v.optional(v.number()),
    /** Año-Mes-Día (YYYY-MM-DD) en UTC, pre-computado para queries rápidas
     *  de la pantalla diaria. Lo guardamos como string para poder usar
     *  range queries simples con by_date. */
    dateUtc: v.string(),
  })
    .index("by_date", ["dateUtc"])
    .index("by_function", ["functionLabel", "timestamp"])
    .index("by_model", ["model", "timestamp"])
    .index("by_function_date", ["functionLabel", "dateUtc"])
    .index("by_timestamp", ["timestamp"]),
});

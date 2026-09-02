// =============================================================================
// mi-dorsal — Mock data for dev without credentials
// =============================================================================
// Datos de ejemplo para que la app funcione sin Clerk/Convex.
// Activar con NEXT_PUBLIC_USE_MOCK=true en .env.local.
// =============================================================================

export interface MockRace {
  _id: string;
  _creationTime: number;

  // Básicos
  name: string;
  slug: string;
  locality?: string;
  province: string; // cualquier provincia española
  distanceKm: number;
  elevationGainM?: number;
  raceType: "road" | "trail" | "mixed" | "obstacle";
  homologated?: boolean;

  // Fechas y lugar
  startDate?: string;
  startTime?: string;
  address?: string;
  venue?: string;

  // URLs
  officialUrl?: string;
  registrationUrl?: string;
  resultsUrl?: string;
  rulesUrl?: string;

  // Organización
  organizer?: string;
  organizerUrl?: string;
  contactEmail?: string;
  contactPhone?: string;

  // Redes
  socialInstagram?: string;
  socialFacebook?: string;
  socialTwitter?: string;
  socialYoutube?: string;
  socialStrava?: string;

  // Precio
  priceEur?: number;
  priceIncludes?: string;

  // Inscripción
  registrationOpenDate?: string;
  registrationCloseDate?: string;
  maxParticipants?: number;
  soldOut?: boolean;
  chipType?: "manual" | "chip" | "disposable_chip";

  // Categorías
  categories?: Array<{
    name: string;
    gender?: "M" | "F" | "mixto";
    ageMin?: number;
    ageMax?: number;
  }>;

  // Servicios
  services?: {
    aidStations?: number;
    showers?: boolean;
    changingRooms?: boolean;
    bagDrop?: boolean;
    parking?: boolean;
    medical?: boolean;
    physiotherapy?: boolean;
    timingChip?: boolean;
    photoService?: boolean;
    videoService?: boolean;
    swagBag?: boolean;
    tShirt?: boolean;
    medal?: boolean;
    refreshments?: boolean;
  };

  // Recorrido
  courseType?: "loop" | "point_to_point" | "out_and_back";
  gpxUrl?: string;
  mapImageUrl?: string;
  profileImageUrl?: string;
  timeLimitMinutes?: number;
  cutoffs?: Array<{ km: number; timeLimit: string }>;

  // Premios
  prizes?: string;
  trophies?: boolean;

  // Meta
  description?: string;
  imageUrl?: string;
  isPublished?: boolean;
  isFeatured?: boolean;
  scraperAdapter?: string;

  // Hashtags
  hashtags?: string[];
}

// =============================================================================
// MOCK RACES — 12 carreras del Levante
// =============================================================================

export const MOCK_RACES: MockRace[] = [
  // -------------------------------------------------------------------------
  // 1. 15K Nocturna Valencia
  // -------------------------------------------------------------------------
  {
    _id: "r1",
    _creationTime: Date.now() - 86400000 * 30,
    name: "15K Nocturna Valencia Gana Energía",
    slug: "15k-nocturna-valencia-2026",
    locality: "Valencia",
    province: "valencia",
    address: "Avenida del Puerto, frente al Edificio Veles e Vents",
    venue: "Paseo Marítimo - Edificio Veles e Vents",
    distanceKm: 15.0,
    elevationGainM: 30,
    raceType: "road",
    homologated: true,
    startDate: "2026-09-26",
    startTime: "22:30",
    officialUrl: "https://www.15knocturnavalencia.com/",
    registrationUrl: "https://www.15knocturnavalencia.com/inscripcion",
    resultsUrl: "https://www.15knocturnavalencia.com/resultados",
    rulesUrl: "https://www.15knocturnavalencia.com/reglamento",
    organizer: "15K Nocturna Valencia",
    organizerUrl: "https://www.15knocturnavalencia.com/",
    contactEmail: "info@15knocturnavalencia.com",
    contactPhone: "+34 963 12 34 56",
    socialInstagram: "https://instagram.com/15knocturnavalencia",
    socialFacebook: "https://facebook.com/15knocturnavalencia",
    socialTwitter: "https://twitter.com/15knocturnavalencia",
    socialStrava: "https://www.strava.com/clubs/15knocturna",
    priceEur: 22,
    priceIncludes: "Camiseta técnica, dorsal, chip, avituallamientos, medalla finisher, seguro",
    registrationOpenDate: "2026-04-01",
    registrationCloseDate: "2026-09-22",
    maxParticipants: 12000,
    soldOut: false,
    chipType: "disposable_chip",
    categories: [
      { name: "Senior M", gender: "M", ageMin: 18, ageMax: 34 },
      { name: "Senior F", gender: "F", ageMin: 18, ageMax: 34 },
      { name: "M35", gender: "M", ageMin: 35, ageMax: 39 },
      { name: "F35", gender: "F", ageMin: 35, ageMax: 39 },
      { name: "M40", gender: "M", ageMin: 40, ageMax: 44 },
      { name: "F40", gender: "F", ageMin: 40, ageMax: 44 },
      { name: "M45", gender: "M", ageMin: 45, ageMax: 49 },
      { name: "F45", gender: "F", ageMin: 45, ageMax: 49 },
      { name: "M50", gender: "M", ageMin: 50, ageMax: 54 },
      { name: "F50", gender: "F", ageMin: 50, ageMax: 54 },
      { name: "M55", gender: "M", ageMin: 55, ageMax: 59 },
      { name: "F55", gender: "F", ageMin: 55, ageMax: 59 },
      { name: "M60+", gender: "M", ageMin: 60 },
      { name: "F60+", gender: "F", ageMin: 60 },
    ],
    services: {
      aidStations: 4,
      showers: true,
      changingRooms: true,
      bagDrop: true,
      parking: true,
      medical: true,
      physiotherapy: true,
      timingChip: true,
      photoService: true,
      swagBag: true,
      tShirt: true,
      medal: true,
      refreshments: true,
    },
    courseType: "loop",
    gpxUrl: "https://www.15knocturnavalencia.com/track-15k.gpx",
    timeLimitMinutes: 120,
    cutoffs: [
      { km: 7, timeLimit: "23:30" },
      { km: 12, timeLimit: "00:15" },
    ],
    prizes: "Trofeo a los 3 primeros de cada categoría. Premio especial al récord de la prueba (hombres y mujeres).",
    trophies: true,
    description: "La carrera nocturna más emblemática de Valencia. 15K por el centro y la Ciudad de las Artes y las Ciencias. Salida a las 22:30 desde el Paseo Marítimo. Ambiente único con animación musical a lo largo del recorrido.",
    imageUrl: "https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=1200",
    isPublished: true,
    isFeatured: true,
    scraperAdapter: "mysports",
    hashtags: ["#15KNocturnaValencia", "#GanaEnergía", "#ValenciaCorre"],
  },

  // -------------------------------------------------------------------------
  // 2. Media Maratón Albacete
  // -------------------------------------------------------------------------
  {
    _id: "r2",
    _creationTime: Date.now() - 86400000 * 30,
    name: "Media Maratón Albacete",
    slug: "media-maraton-albacete-2026",
    locality: "Albacete",
    province: "albacete",
    address: "Plaza del Altozano, s/n",
    venue: "Plaza del Altozano",
    distanceKm: 21.097,
    elevationGainM: 80,
    raceType: "road",
    homologated: true,
    startDate: "2026-10-04",
    startTime: "09:30",
    officialUrl: "https://www.mediomaratonAlbacete.es/",
    registrationUrl: "https://www.mediomaratonAlbacete.es/inscripcion",
    resultsUrl: "https://www.mediomaratonAlbacete.es/resultados",
    rulesUrl: "https://www.mediomaratonAlbacete.es/reglamento",
    organizer: "Ayuntamiento de Albacete",
    organizerUrl: "https://www.albacete.es/",
    contactEmail: "deportes@albacete.es",
    contactPhone: "+34 967 59 61 00",
    socialInstagram: "https://instagram.com/mediamaratonalbacete",
    socialFacebook: "https://facebook.com/mediamaratonalbacete",
    socialTwitter: "https://twitter.com/mmabalbacete",
    priceEur: 18,
    priceIncludes: "Dorsal, chip, avituallamientos, camiseta, medalla finisher, seguro RC",
    registrationOpenDate: "2026-05-15",
    registrationCloseDate: "2026-09-30",
    maxParticipants: 3000,
    soldOut: false,
    chipType: "disposable_chip",
    categories: [
      { name: "Senior M/F", ageMin: 18, ageMax: 34 },
      { name: "M35 / F35", ageMin: 35, ageMax: 39 },
      { name: "M40 / F40", ageMin: 40, ageMax: 44 },
      { name: "M45 / F45", ageMin: 45, ageMax: 49 },
      { name: "M50 / F50", ageMin: 50, ageMax: 54 },
      { name: "M55 / F55", ageMin: 55, ageMax: 59 },
      { name: "M60+ / F60+", ageMin: 60 },
      { name: "Local M/F" },
    ],
    services: {
      aidStations: 6,
      showers: true,
      changingRooms: true,
      bagDrop: true,
      parking: true,
      medical: true,
      physiotherapy: true,
      timingChip: true,
      photoService: true,
      swagBag: true,
      tShirt: true,
      medal: true,
      refreshments: true,
    },
    courseType: "loop",
    gpxUrl: "https://www.mediomaratonAlbacete.es/media/track.gpx",
    timeLimitMinutes: 180,
    cutoffs: [
      { km: 10, timeLimit: "11:00" },
      { km: 15, timeLimit: "11:50" },
    ],
    prizes: "Trofeos a los 3 primeros clasificados de cada categoría. Premios en metálico al récord de la prueba.",
    trophies: true,
    description: "Media maratón homologada por la RFEA. Circuito urbano plano, ideal para hacer marca personal. 21,097 km por las principales calles de Albacete con salida y meta en la Plaza del Altozano.",
    imageUrl: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200",
    isPublished: true,
    isFeatured: true,
    scraperAdapter: "generic",
    hashtags: ["#MMAAlbacete", "#MediaMaratónAlbacete", "#AlbaceteCorre"],
  },

  // -------------------------------------------------------------------------
  // 3. Media Maratón Valencia Trinidad Alfonso
  // -------------------------------------------------------------------------
  {
    _id: "r3",
    _creationTime: Date.now() - 86400000 * 30,
    name: "Media Maratón Valencia Trinidad Alfonso",
    slug: "media-maraton-valencia-2026",
    locality: "Valencia",
    province: "valencia",
    address: "Avenida del Puerto, frente a Veles e Vents",
    venue: "Paseo Marítimo - Veles e Vents",
    distanceKm: 21.097,
    elevationGainM: 50,
    raceType: "road",
    homologated: true,
    startDate: "2026-10-25",
    startTime: "08:30",
    officialUrl: "https://www.mediomaratonvalencia.com/",
    registrationUrl: "https://www.mediomaratonvalencia.com/inscripcion",
    resultsUrl: "https://www.mediomaratonvalencia.com/resultados",
    rulesUrl: "https://www.mediomaratonvalencia.com/reglamento",
    organizer: "SD Correcaminos",
    organizerUrl: "https://www.correcaminos.org/",
    contactEmail: "info@mediomaratonvalencia.com",
    contactPhone: "+34 963 44 55 66",
    socialInstagram: "https://instagram.com/mediamaratonvlc",
    socialFacebook: "https://facebook.com/mediamaratonvlc",
    socialTwitter: "https://twitter.com/mmavalencia",
    socialStrava: "https://www.strava.com/clubs/correcaminos",
    priceEur: 35,
    priceIncludes: "Camiseta oficial, dorsal con nombre, chip MySports, avituallamientos, medalla, bolsa corredor, seguro RC",
    registrationOpenDate: "2026-04-15",
    registrationCloseDate: "2026-10-15",
    maxParticipants: 25000,
    soldOut: true,
    chipType: "disposable_chip",
    categories: [
      { name: "Senior M/F", ageMin: 18, ageMax: 34 },
      { name: "M35 / F35", ageMin: 35, ageMax: 39 },
      { name: "M40 / F40", ageMin: 40, ageMax: 44 },
      { name: "M45 / F45", ageMin: 45, ageMax: 49 },
      { name: "M50 / F50", ageMin: 50, ageMax: 54 },
      { name: "M55 / F55", ageMin: 55, ageMax: 59 },
      { name: "M60+ / F60+", ageMin: 60 },
    ],
    services: {
      aidStations: 8,
      showers: true,
      changingRooms: true,
      bagDrop: true,
      parking: false,
      medical: true,
      physiotherapy: true,
      timingChip: true,
      photoService: true,
      videoService: true,
      swagBag: true,
      tShirt: true,
      medal: true,
      refreshments: true,
    },
    courseType: "loop",
    gpxUrl: "https://www.mediomaratonvalencia.com/recorrido-21k.gpx",
    timeLimitMinutes: 150,
    cutoffs: [
      { km: 10, timeLimit: "10:00" },
      { km: 15, timeLimit: "10:45" },
    ],
    prizes: "Trofeos a los 3 primeros de cada categoría. 10.000€ en premios al récord de la prueba. Sorteo de plaza para Valencia Marathon 2027 entre todos los finishers.",
    trophies: true,
    description: "Una de las medias maratones más rápidas del mundo. Récords históricos tanto en hombres como en mujeres. El objetivo de Manu este 25 de octubre: MMP sub-1:55.",
    imageUrl: "https://images.unsplash.com/photo-1532444458054-01a7dd3e9fca?w=1200",
    isPublished: true,
    isFeatured: true,
    scraperAdapter: "mysports",
    hashtags: ["#MMAValencia", "#Valencia42K", "#TrinidadAlfonso", "#RunForBetter"],
  },

  // -------------------------------------------------------------------------
  // 4. 10K Nocturna Alicante
  // -------------------------------------------------------------------------
  {
    _id: "r4",
    _creationTime: Date.now() - 86400000 * 25,
    name: "10K Nocturna Alicante",
    slug: "10k-nocturna-alicante-2026",
    locality: "Alicante",
    province: "alicante",
    address: "Paseo Marítimo, Playa del Postiguet",
    venue: "Paseo Marítimo - Postiguet",
    distanceKm: 10.0,
    elevationGainM: 20,
    raceType: "road",
    homologated: true,
    startDate: "2026-07-12",
    startTime: "22:00",
    officialUrl: "https://www.10knocturnaalicante.com/",
    registrationUrl: "https://www.10knocturnaalicante.com/inscripcion",
    resultsUrl: "https://www.10knocturnaalicante.com/resultados",
    organizer: "Club Atletismo Alicante",
    contactEmail: "info@10knocturnaalicante.com",
    socialInstagram: "https://instagram.com/10knocturnaalicante",
    priceEur: 15,
    priceIncludes: "Dorsal, chip, camiseta, avituallamientos, medalla finisher",
    registrationOpenDate: "2026-04-01",
    registrationCloseDate: "2026-07-08",
    maxParticipants: 4000,
    soldOut: false,
    chipType: "disposable_chip",
    categories: [
      { name: "Senior M/F", ageMin: 18, ageMax: 34 },
      { name: "M35-44 / F35-44", ageMin: 35, ageMax: 44 },
      { name: "M45-54 / F45-54", ageMin: 45, ageMax: 54 },
      { name: "M55+ / F55+", ageMin: 55 },
      { name: "Sub-18 M/F", ageMin: 14, ageMax: 17 },
    ],
    services: {
      aidStations: 3,
      showers: true,
      changingRooms: true,
      bagDrop: true,
      parking: true,
      medical: true,
      timingChip: true,
      swagBag: true,
      tShirt: true,
      medal: true,
      refreshments: true,
    },
    courseType: "loop",
    gpxUrl: "https://www.10knocturnaalicante.com/track.gpx",
    timeLimitMinutes: 90,
    prizes: "Trofeos a los 3 primeros de cada categoría.",
    trophies: true,
    description: "10K nocturna por el paseo marítimo de Alicante. Ambiente espectacular con salida frente al castillo de Santa Bárbara.",
    imageUrl: "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1200",
    isPublished: true,
    isFeatured: true,
    hashtags: ["#10KNocturnaAlicante", "#AlicanteCorre"],
  },

  // -------------------------------------------------------------------------
  // 5. Carrera de la Mujer Valencia
  // -------------------------------------------------------------------------
  {
    _id: "r5",
    _creationTime: Date.now() - 86400000 * 20,
    name: "Carrera de la Mujer Valencia",
    slug: "carrera-mujer-valencia-2026",
    locality: "Valencia",
    province: "valencia",
    address: "Avenida del Puerto - Marina Real",
    venue: "Marina Real Juan Carlos I",
    distanceKm: 6.5,
    raceType: "road",
    startDate: "2026-04-05",
    startTime: "10:00",
    officialUrl: "https://www.carreradelamujer.com/eventos/valencia",
    registrationUrl: "https://www.carreradelamujer.com/inscripcion/valencia",
    resultsUrl: "https://www.carreradelamujer.com/resultados/valencia",
    organizer: "Carrera de la Mujer",
    organizerUrl: "https://www.carreradelamujer.com/",
    contactEmail: "info@carreradelamujer.com",
    socialInstagram: "https://instagram.com/carreradelamujer",
    socialFacebook: "https://facebook.com/carreradelamujer",
    priceEur: 12,
    priceIncludes: "Camiseta rosa, dorsal, chip, bolsa con productos, seguro",
    registrationOpenDate: "2026-01-15",
    registrationCloseDate: "2026-04-01",
    maxParticipants: 8000,
    soldOut: false,
    chipType: "disposable_chip",
    categories: [
      { name: "General F", gender: "F" },
      { name: "Sub-23 F", gender: "F", ageMin: 18, ageMax: 22 },
      { name: "F23-34", gender: "F", ageMin: 23, ageMax: 34 },
      { name: "F35-44", gender: "F", ageMin: 35, ageMax: 44 },
      { name: "F45+", gender: "F", ageMin: 45 },
    ],
    services: {
      aidStations: 2,
      showers: false,
      changingRooms: true,
      bagDrop: true,
      parking: false,
      medical: true,
      timingChip: true,
      swagBag: true,
      tShirt: true,
      medal: false,
      refreshments: true,
    },
    courseType: "out_and_back",
    timeLimitMinutes: 75,
    prizes: "Premios a las 3 primeras clasificadas generales y por categoría.",
    description: "Carrera solidaria con causa benéfica. 6.5K urbanos. Salida desde Marina Real.",
    imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200",
    isPublished: true,
    hashtags: ["#CarreraDeLaMujer", "#Valencia"],
  },

  // -------------------------------------------------------------------------
  // 6. Maratón Murcia
  // -------------------------------------------------------------------------
  {
    _id: "r6",
    _creationTime: Date.now() - 86400000 * 20,
    name: "TotalEnergies Maratón Murcia Costa Cálida",
    slug: "maraton-murcia-2026",
    locality: "Murcia",
    province: "murcia",
    address: "Gran Vía Escultor Salzillo, Murcia",
    venue: "Gran Vía - Centro Murcia",
    distanceKm: 42.195,
    elevationGainM: 150,
    raceType: "road",
    homologated: true,
    startDate: "2026-11-15",
    startTime: "08:30",
    officialUrl: "https://www.maratonmurcia.es/",
    registrationUrl: "https://www.maratonmurcia.es/inscripcion",
    resultsUrl: "https://www.maratonmurcia.es/resultados",
    rulesUrl: "https://www.maratonmurcia.es/reglamento",
    organizer: "Ayuntamiento de Murcia",
    contactEmail: "info@maratonmurcia.es",
    contactPhone: "+34 968 35 86 00",
    socialInstagram: "https://instagram.com/maratonmurcia",
    socialFacebook: "https://facebook.com/maratonmurcia",
    socialTwitter: "https://twitter.com/maratonmurcia",
    priceEur: 45,
    priceIncludes: "Camiseta, dorsal personalizado, chip, medalla, bolsa corredor, avituallamientos, masaje, seguro",
    registrationOpenDate: "2026-03-01",
    registrationCloseDate: "2026-11-10",
    maxParticipants: 5000,
    soldOut: false,
    chipType: "disposable_chip",
    categories: [
      { name: "Senior M/F", ageMin: 18, ageMax: 34 },
      { name: "M35 / F35", ageMin: 35, ageMax: 39 },
      { name: "M40 / F40", ageMin: 40, ageMax: 44 },
      { name: "M45 / F45", ageMin: 45, ageMax: 49 },
      { name: "M50 / F50", ageMin: 50, ageMax: 54 },
      { name: "M55+ / F55+", ageMin: 55 },
    ],
    services: {
      aidStations: 12,
      showers: true,
      changingRooms: true,
      bagDrop: true,
      parking: true,
      medical: true,
      physiotherapy: true,
      timingChip: true,
      photoService: true,
      swagBag: true,
      tShirt: true,
      medal: true,
      refreshments: true,
    },
    courseType: "loop",
    gpxUrl: "https://www.maratonmurcia.es/track.gpx",
    timeLimitMinutes: 360,
    cutoffs: [
      { km: 10, timeLimit: "10:00" },
      { km: 21, timeLimit: "11:30" },
      { km: 30, timeLimit: "13:00" },
      { km: 38, timeLimit: "14:20" },
    ],
    prizes: "Trofeos y premios en metálico (3.000€ al primero, 1.500€ al segundo, 800€ al tercero en categoría absoluta).",
    trophies: true,
    description: "Maratón homologado RFEA. Segunda edición con circuito completo por la huerta murciana. Etiqueta World Athletics Label.",
    imageUrl: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1200",
    isPublished: true,
    isFeatured: true,
    scraperAdapter: "mysports",
    hashtags: ["#MaratónMurcia", "#CostaCálida", "#MurciaCorredora"],
  },

  // -------------------------------------------------------------------------
  // 7. Trail Sierra de Aitana
  // -------------------------------------------------------------------------
  {
    _id: "r7",
    _creationTime: Date.now() - 86400000 * 20,
    name: "Trail Sierra de Aitana",
    slug: "trail-aitana-2026",
    locality: "Alcoleja",
    province: "alicante",
    address: "Plaza del Ayuntamiento, Alcoleja",
    venue: "Alcoleja - Sierra de Aitana",
    distanceKm: 28.0,
    elevationGainM: 1450,
    raceType: "trail",
    startDate: "2026-05-18",
    startTime: "08:00",
    officialUrl: "https://www.trailaiitana.com/",
    registrationUrl: "https://www.trailaiitana.com/inscripcion",
    resultsUrl: "https://www.trailaiitana.com/resultados",
    rulesUrl: "https://www.trailaiitana.com/reglamento",
    organizer: "Club Muntanya Alcoi",
    contactEmail: "info@trailaiitana.com",
    socialInstagram: "https://instagram.com/trailaiitana",
    socialFacebook: "https://facebook.com/trailaiitana",
    priceEur: 30,
    priceIncludes: "Camiseta técnica, dorsal, chip, avituallamientos (3), comida post-carrera, medalla finisher, seguro",
    registrationOpenDate: "2026-01-15",
    registrationCloseDate: "2026-05-15",
    maxParticipants: 400,
    soldOut: false,
    chipType: "chip",
    categories: [
      { name: "Senior M/F", ageMin: 18, ageMax: 39 },
      { name: "M40 / F40", ageMin: 40, ageMax: 49 },
      { name: "M50+ / F50+", ageMin: 50 },
    ],
    services: {
      aidStations: 3,
      showers: true,
      changingRooms: false,
      bagDrop: true,
      parking: true,
      medical: true,
      physiotherapy: false,
      timingChip: true,
      photoService: true,
      swagBag: true,
      tShirt: true,
      medal: true,
      refreshments: true,
    },
    courseType: "loop",
    gpxUrl: "https://www.trailaiitana.com/track.gpx",
    mapImageUrl: "https://www.trailaiitana.com/mapa.jpg",
    timeLimitMinutes: 360,
    cutoffs: [
      { km: 12, timeLimit: "11:00" },
      { km: 22, timeLimit: "13:30" },
    ],
    prizes: "Trofeos a los 3 primeros de cada categoría. Premios a los finishers.",
    description: "Trail técnico por la Sierra de Aitana. 28K con 1.450m+ de desnivel. Cumbres a más de 1.500m de altitud. Vistas al Mediterráneo.",
    imageUrl: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=1200",
    isPublished: true,
    hashtags: ["#TrailAitana", "#SierraDeAitana", "#TrailRunning"],
  },

  // -------------------------------------------------------------------------
  // 8. San Silvestre Vallecana
  // -------------------------------------------------------------------------
  {
    _id: "r8",
    _creationTime: Date.now() - 86400000 * 15,
    name: "San Silvestre Vallecana",
    slug: "san-silvestre-vallecana-2026",
    locality: "Madrid",
    province: "albacete", // (nota: se reasignará)
    address: "Salida: Calle de Jesús del Pino, 7 (Vallecas)",
    venue: "Vallecas - Madrid",
    distanceKm: 10.0,
    raceType: "road",
    homologated: true,
    startDate: "2026-12-31",
    startTime: "18:00",
    officialUrl: "https://www.sansilvestrevallecana.com/",
    registrationUrl: "https://www.sansilvestrevallecana.com/inscripcion",
    resultsUrl: "https://www.sansilvestrevallecana.com/resultados",
    organizer: "Atletismo Vallecas",
    contactEmail: "info@sansilvestrevallecana.com",
    socialInstagram: "https://instagram.com/sansilvestrevallecana",
    priceEur: 14,
    priceIncludes: "Dorsal, camiseta, chip, avituallamiento, bolsa con productos",
    registrationOpenDate: "2026-10-01",
    registrationCloseDate: "2026-12-20",
    maxParticipants: 40000,
    soldOut: false,
    chipType: "disposable_chip",
    categories: [
      { name: "Senior M/F", ageMin: 18, ageMax: 34 },
      { name: "M35-44 / F35-44", ageMin: 35, ageMax: 44 },
      { name: "M45-54 / F45-54", ageMin: 45, ageMax: 54 },
      { name: "M55+ / F55+", ageMin: 55 },
    ],
    services: {
      aidStations: 3,
      showers: false,
      changingRooms: false,
      bagDrop: true,
      parking: false,
      medical: true,
      timingChip: true,
      swagBag: true,
      tShirt: true,
      medal: false,
      refreshments: true,
    },
    courseType: "loop",
    timeLimitMinutes: 90,
    prizes: "Trofeos a los 3 primeros de cada categoría. Premios a disfraces.",
    description: "La San Silvestre más famosa de España. 40.000 corredores cierran el año corriendo por las calles de Vallecas.",
    imageUrl: "https://images.unsplash.com/photo-1483721310020-03333e577078?w=1200",
    isPublished: true,
    hashtags: ["#SanSilvestreVallecana", "#MadridCorre", "#31Diciembre"],
  },

  // -------------------------------------------------------------------------
  // 9. 5K Memorial Zambrana
  // -------------------------------------------------------------------------
  {
    _id: "r9",
    _creationTime: Date.now() - 86400000 * 15,
    name: "5K Memorial Zambrana",
    slug: "5k-memorial-zambrana-2026",
    locality: "Elche",
    province: "alicante",
    address: "Paseo de la Estación, Elche",
    venue: "Paseo de la Estación - Elche",
    distanceKm: 5.0,
    raceType: "road",
    homologated: true,
    startDate: "2026-05-23",
    startTime: "20:00",
    officialUrl: "https://www.atletismoelche.com/5k-zambrana",
    registrationUrl: "https://www.atletismoelche.com/inscripcion-5k",
    resultsUrl: "https://www.atletismoelche.com/resultados-5k",
    organizer: "Club Atletismo Elche",
    contactEmail: "info@atletismoelche.com",
    socialInstagram: "https://instagram.com/atletismoelche",
    priceEur: 8,
    priceIncludes: "Dorsal, chip, camiseta, avituallamiento",
    registrationOpenDate: "2026-03-01",
    registrationCloseDate: "2026-05-20",
    maxParticipants: 1500,
    soldOut: false,
    chipType: "disposable_chip",
    categories: [
      { name: "Senior M/F", ageMin: 18, ageMax: 34 },
      { name: "M35+ / F35+", ageMin: 35 },
      { name: "Sub-18 M/F", ageMin: 14, ageMax: 17 },
      { name: "Local M/F" },
    ],
    services: {
      aidStations: 1,
      showers: true,
      changingRooms: true,
      bagDrop: true,
      parking: true,
      medical: true,
      timingChip: true,
      tShirt: true,
      refreshments: true,
    },
    courseType: "loop",
    gpxUrl: "https://www.atletismoelche.com/5k-track.gpx",
    timeLimitMinutes: 45,
    prizes: "Trofeos a los 3 primeros de cada categoría.",
    description: "5K nocturno en Elche. Rápido y homologado. Memorial al corredor local Zambrana.",
    imageUrl: "https://images.unsplash.com/photo-1486218119243-13883505764c?w=1200",
    isPublished: true,
    hashtags: ["#5KZambrana", "#ElcheCorre"],
  },

  // -------------------------------------------------------------------------
  // 10. 10K Elche Night Race
  // -------------------------------------------------------------------------
  {
    _id: "r10",
    _creationTime: Date.now() - 86400000 * 10,
    name: "10K Elche Night Race",
    slug: "10k-elche-night-race-2026",
    locality: "Elche",
    province: "alicante",
    address: "Plaça de Baix, Elche",
    venue: "Centro histórico - Elche",
    distanceKm: 10.0,
    raceType: "road",
    homologated: true,
    startDate: "2026-05-16",
    startTime: "21:30",
    officialUrl: "https://www.elchenightrace.com/",
    registrationUrl: "https://www.elchenightrace.com/inscripcion",
    resultsUrl: "https://www.elchenightrace.com/resultados",
    organizer: "Club Triatlón Elche",
    contactEmail: "info@elchenightrace.com",
    socialInstagram: "https://instagram.com/elchenightrace",
    socialFacebook: "https://facebook.com/elchenightrace",
    priceEur: 12,
    priceIncludes: "Dorsal, chip, camiseta técnica, avituallamientos, medalla finisher",
    registrationOpenDate: "2026-02-01",
    registrationCloseDate: "2026-05-13",
    maxParticipants: 2500,
    soldOut: false,
    chipType: "disposable_chip",
    categories: [
      { name: "Senior M/F", ageMin: 18, ageMax: 34 },
      { name: "M35-44 / F35-44", ageMin: 35, ageMax: 44 },
      { name: "M45+ / F45+", ageMin: 45 },
    ],
    services: {
      aidStations: 3,
      showers: true,
      changingRooms: true,
      bagDrop: true,
      parking: true,
      medical: true,
      timingChip: true,
      swagBag: true,
      tShirt: true,
      medal: true,
      refreshments: true,
    },
    courseType: "loop",
    gpxUrl: "https://www.elchenightrace.com/track.gpx",
    timeLimitMinutes: 90,
    prizes: "Trofeos a los 3 primeros de cada categoría.",
    description: "10K nocturno por el centro de Elche. Salida y meta en la Plaça de Baix.",
    imageUrl: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1200",
    isPublished: true,
    isFeatured: true,
    hashtags: ["#ElcheNightRace", "#Elche"],
  },

  // -------------------------------------------------------------------------
  // 11. Mitja Marató Santa Pola
  // -------------------------------------------------------------------------
  {
    _id: "r11",
    _creationTime: Date.now() - 86400000 * 10,
    name: "Mitja Marató Santa Pola",
    slug: "mitja-santa-pola-2026",
    locality: "Santa Pola",
    province: "alicante",
    address: "Avenida del Mediterráneo, Santa Pola",
    venue: "Paseo Marítimo Santa Pola",
    distanceKm: 21.097,
    elevationGainM: 40,
    raceType: "road",
    homologated: true,
    startDate: "2026-01-18",
    startTime: "10:00",
    officialUrl: "https://www.mitjasantapola.com/",
    registrationUrl: "https://www.mitjasantapola.com/inscripcion",
    resultsUrl: "https://www.mitjasantapola.com/resultados",
    organizer: "Ayto Santa Pola",
    contactEmail: "deportes@santapola.es",
    socialInstagram: "https://instagram.com/mitjasantapola",
    priceEur: 16,
    priceIncludes: "Dorsal, chip, camiseta, avituallamientos, medalla finisher, seguro",
    registrationOpenDate: "2025-10-01",
    registrationCloseDate: "2026-01-15",
    maxParticipants: 2000,
    soldOut: true,
    chipType: "disposable_chip",
    categories: [
      { name: "Senior M/F", ageMin: 18, ageMax: 34 },
      { name: "M35-44 / F35-44", ageMin: 35, ageMax: 44 },
      { name: "M45-54 / F45-54", ageMin: 45, ageMax: 54 },
      { name: "M55+ / F55+", ageMin: 55 },
    ],
    services: {
      aidStations: 5,
      showers: true,
      changingRooms: true,
      bagDrop: true,
      parking: true,
      medical: true,
      timingChip: true,
      swagBag: true,
      tShirt: true,
      medal: true,
      refreshments: true,
    },
    courseType: "loop",
    gpxUrl: "https://www.mitjasantapola.com/track.gpx",
    timeLimitMinutes: 180,
    prizes: "Trofeos a los 3 primeros de cada categoría.",
    description: "Media maratón costera en Santa Pola. Récord de Manu: 1:57:43.",
    imageUrl: "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1200",
    isPublished: true,
    hashtags: ["#MitjaSantaPola", "#SantaPolaCorre"],
  },

  // -------------------------------------------------------------------------
  // 12. Trail Cabezo de Torres
  // -------------------------------------------------------------------------
  {
    _id: "r12",
    _creationTime: Date.now() - 86400000 * 8,
    name: "Trail Cabezo de Torres",
    slug: "trail-cabezo-torres-2026",
    locality: "Murcia",
    province: "murcia",
    address: "Plaza del Ayuntamiento, Cabezo de Torres",
    venue: "Cabezo de Torres - Sierra de Carrascoy",
    distanceKm: 18.0,
    elevationGainM: 650,
    raceType: "trail",
    startDate: "2026-03-08",
    startTime: "09:00",
    officialUrl: "https://www.trailcabezo.com/",
    registrationUrl: "https://www.trailcabezo.com/inscripcion",
    resultsUrl: "https://www.trailcabezo.com/resultados",
    organizer: "Club Montaña Murcia",
    contactEmail: "info@trailcabezo.com",
    socialInstagram: "https://instagram.com/trailcabezo",
    priceEur: 18,
    priceIncludes: "Dorsal, chip, avituallamientos (2), camiseta, comida post-carrera, seguro",
    registrationOpenDate: "2025-12-01",
    registrationCloseDate: "2026-03-05",
    maxParticipants: 500,
    soldOut: false,
    chipType: "chip",
    categories: [
      { name: "Senior M/F", ageMin: 18, ageMax: 39 },
      { name: "M40+ / F40+", ageMin: 40 },
    ],
    services: {
      aidStations: 2,
      showers: true,
      changingRooms: true,
      bagDrop: true,
      parking: true,
      medical: true,
      timingChip: true,
      swagBag: true,
      tShirt: true,
      refreshments: true,
    },
    courseType: "loop",
    gpxUrl: "https://www.trailcabezo.com/track.gpx",
    mapImageUrl: "https://www.trailcabezo.com/mapa.jpg",
    timeLimitMinutes: 240,
    prizes: "Trofeos a los 3 primeros de cada categoría.",
    description: "Trail por la Sierra de Carrascoy. 18K con 650m+. Vistas a la huerta murciana.",
    imageUrl: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=1200",
    isPublished: true,
    hashtags: ["#TrailCabezo", "#SierraCarrascoy", "#MurciaTrail"],
  },
];






// =============================================================================
// MOCK_RACES_FROM_SCRAPERS — auto-generado por scripts/merge-mock.ts
// Última sync: 2026-09-02T18:42:16.938Z
// Total: 29 carreras oficiales (RFEA, FEDME, ITRA, Sportmaniacs, Runedia)
// =============================================================================
export const MOCK_RACES_FROM_SCRAPERS: MockRace[] = [
  {
    "_id": "scraped-canfranc-canfranc-2026-09-11",
    "_creationTime": 1788288136938,
    "name": "Canfranc-Canfranc",
    "slug": "canfranc-canfranc-2026-09-11",
    "locality": "Canfranc Estación, Huesca",
    "province": "huesca",
    "distanceKm": 100,
    "elevationGainM": 8848,
    "raceType": "trail",
    "homologated": false,
    "startDate": "2026-09-11",
    "startTime": "09:00",
    "organizer": "ITRA",
    "officialUrl": "https://canfranccanfranc.com/",
    "description": "Carrera ITRA.",
    "isPublished": true,
    "isFeatured": true,
    "scraperAdapter": "generic",
    "hashtags": [
      "#ITRA",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-gomera-paradise-trail-mundial-isf-2026-09-18",
    "_creationTime": 1788288136938,
    "name": "Gomera Paradise Trail (Mundial ISF)",
    "slug": "gomera-paradise-trail-mundial-isf-2026-09-18",
    "locality": "Santa Cruz de Tenerife",
    "province": "santa cruz de tenerife",
    "distanceKm": 21,
    "raceType": "trail",
    "homologated": false,
    "startDate": "2026-09-18",
    "startTime": "09:00",
    "organizer": "FEDME",
    "officialUrl": "https://fedme.es/la-fedme-presenta-el-calendario-provisional-oficial-de-carreras-por-montana-2026/",
    "description": "Carrera oficial Línea de FEDME. Nivel: Mundial ISF.",
    "isPublished": true,
    "isFeatured": false,
    "scraperAdapter": "generic",
    "hashtags": [
      "#FEDME",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-madrid-segovia-2026-09-19",
    "_creationTime": 1788288136938,
    "name": "Madrid-Segovia",
    "slug": "madrid-segovia-2026-09-19",
    "locality": "Madrid → Segovia",
    "province": "madrid",
    "distanceKm": 101,
    "elevationGainM": 2030,
    "raceType": "trail",
    "homologated": false,
    "startDate": "2026-09-19",
    "startTime": "09:00",
    "organizer": "ITRA",
    "officialUrl": "https://madrid-segovia.com/",
    "description": "Carrera ITRA.",
    "isPublished": true,
    "isFeatured": true,
    "scraperAdapter": "generic",
    "hashtags": [
      "#ITRA",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-sportmaniacs-cursa-de-la-merce-2026-09-20",
    "_creationTime": 1788288136938,
    "name": "Cursa de la Mercè",
    "slug": "sportmaniacs-cursa-de-la-merce-2026-09-20",
    "locality": "Barcelona",
    "province": "barcelona",
    "distanceKm": 10,
    "raceType": "road",
    "homologated": false,
    "startDate": "2026-09-20",
    "startTime": "09:00",
    "organizer": "Sportmaniacs",
    "officialUrl": "https://sportmaniacs.com/es/race/cursa-merce",
    "description": "Carrera Sportmaniacs.",
    "isPublished": true,
    "isFeatured": false,
    "scraperAdapter": "generic",
    "hashtags": [
      "#Sportmaniacs",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-runedia-15k-nocturna-valencia-2026-09-26",
    "_creationTime": 1788288136938,
    "name": "15K Nocturna Valencia",
    "slug": "runedia-15k-nocturna-valencia-2026-09-26",
    "locality": "Valencia",
    "province": "valencia",
    "distanceKm": 15,
    "raceType": "road",
    "homologated": false,
    "startDate": "2026-09-26",
    "startTime": "09:00",
    "organizer": "Runedia",
    "officialUrl": "https://runedia.mundodeportivo.com/calendario-carreras/",
    "description": "Carrera Runedia.",
    "isPublished": true,
    "isFeatured": false,
    "scraperAdapter": "generic",
    "hashtags": [
      "#Runedia",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-cxm-macael-marmol-2026-09-27",
    "_creationTime": 1788288136938,
    "name": "CxM Macael Mármol",
    "slug": "cxm-macael-marmol-2026-09-27",
    "locality": "Almería",
    "province": "almeria",
    "distanceKm": 21,
    "raceType": "trail",
    "homologated": false,
    "startDate": "2026-09-27",
    "startTime": "09:00",
    "organizer": "FEDME",
    "officialUrl": "https://fedme.es/la-fedme-presenta-el-calendario-provisional-oficial-de-carreras-por-montana-2026/",
    "description": "Carrera oficial Línea de FEDME. Nivel: Copa España 3 + III SNS.",
    "isPublished": true,
    "isFeatured": false,
    "scraperAdapter": "generic",
    "hashtags": [
      "#FEDME",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-runedia-cxm-macael-marmol-2026-09-27",
    "_creationTime": 1788288136938,
    "name": "CxM Macael Mármol",
    "slug": "runedia-cxm-macael-marmol-2026-09-27",
    "locality": "Macael, Almería",
    "province": "almeria",
    "distanceKm": 28,
    "raceType": "trail",
    "homologated": false,
    "startDate": "2026-09-27",
    "startTime": "09:00",
    "organizer": "Runedia",
    "officialUrl": "https://runedia.mundodeportivo.com/calendario-carreras/",
    "description": "Carrera Runedia.",
    "isPublished": true,
    "isFeatured": false,
    "scraperAdapter": "generic",
    "hashtags": [
      "#Runedia",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-runedia-media-maraton-albacete-2026-10-04",
    "_creationTime": 1788288136938,
    "name": "Media Maratón Albacete",
    "slug": "runedia-media-maraton-albacete-2026-10-04",
    "locality": "Albacete",
    "province": "albacete",
    "distanceKm": 21.097,
    "raceType": "road",
    "homologated": false,
    "startDate": "2026-10-04",
    "startTime": "09:00",
    "organizer": "Runedia",
    "officialUrl": "https://runedia.mundodeportivo.com/calendario-carreras/",
    "description": "Carrera Runedia.",
    "isPublished": true,
    "isFeatured": false,
    "scraperAdapter": "generic",
    "hashtags": [
      "#Runedia",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-maraton-valencia-trinidad-alfonso-zurich-2026-10-06",
    "_creationTime": 1788288136938,
    "name": "Maratón Valencia Trinidad Alfonso Zurich",
    "slug": "maraton-valencia-trinidad-alfonso-zurich-2026-10-06",
    "locality": "8",
    "province": "valencia",
    "distanceKm": 10,
    "raceType": "road",
    "homologated": false,
    "startDate": "2026-10-06",
    "startTime": "09:00",
    "organizer": "RFEA",
    "officialUrl": "https://atletismorfea.es/sites/default/files/2026-01/008-2026%20Proyecto%20calendario%202026%20.pdf",
    "description": "Carrera oficial Ruta de RFEA. Nivel: WARRL - Platinum  Valencia.",
    "isPublished": true,
    "isFeatured": false,
    "scraperAdapter": "mysports",
    "hashtags": [
      "#RFEA",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-gran-trail-penalara-2026-10-09",
    "_creationTime": 1788288136938,
    "name": "Gran Trail Peñalara",
    "slug": "gran-trail-penalara-2026-10-09",
    "locality": "Navacerrada, Madrid",
    "province": "madrid",
    "distanceKm": 110,
    "elevationGainM": 5100,
    "raceType": "trail",
    "homologated": false,
    "startDate": "2026-10-09",
    "startTime": "09:00",
    "organizer": "ITRA",
    "officialUrl": "https://grantrailpenalara.com/",
    "description": "Carrera ITRA.",
    "isPublished": true,
    "isFeatured": true,
    "scraperAdapter": "generic",
    "hashtags": [
      "#ITRA",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-runedia-cross-de-castalla-2026-10-11",
    "_creationTime": 1788288136938,
    "name": "Cross de Castalla",
    "slug": "runedia-cross-de-castalla-2026-10-11",
    "locality": "Castalla",
    "province": "alicante",
    "distanceKm": 12,
    "raceType": "trail",
    "homologated": false,
    "startDate": "2026-10-11",
    "startTime": "09:00",
    "organizer": "Runedia",
    "officialUrl": "https://runedia.mundodeportivo.com/calendario-carreras/",
    "description": "Carrera Runedia.",
    "isPublished": true,
    "isFeatured": false,
    "scraperAdapter": "generic",
    "hashtags": [
      "#Runedia",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-campeonato-de-espana-de-marcha-de-invierno-de-promocion-2026-10-13",
    "_creationTime": 1788288136938,
    "name": "Campeonato de España de Marcha de Invierno de Promoción",
    "slug": "campeonato-de-espana-de-marcha-de-invierno-de-promocion-2026-10-13",
    "locality": "Castro Urdiales (Cantabria)",
    "province": "cantabria",
    "distanceKm": 10,
    "raceType": "road",
    "homologated": true,
    "startDate": "2026-10-13",
    "startTime": "09:00",
    "organizer": "RFEA",
    "officialUrl": "https://atletismorfea.es/sites/default/files/2026-01/008-2026%20Proyecto%20calendario%202026%20.pdf",
    "description": "Carrera oficial Marcha de RFEA. Nivel: RFEA.",
    "isPublished": true,
    "isFeatured": false,
    "scraperAdapter": "mysports",
    "hashtags": [
      "#RFEA",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-campeonato-de-espana-10-km-marcha-master-2026-10-13",
    "_creationTime": 1788288136938,
    "name": "Campeonato de España 10 km marcha Master",
    "slug": "campeonato-de-espana-10-km-marcha-master-2026-10-13",
    "locality": "Castro Urdiales (Cantabria)",
    "province": "cantabria",
    "distanceKm": 10,
    "raceType": "road",
    "homologated": true,
    "startDate": "2026-10-13",
    "startTime": "09:00",
    "organizer": "RFEA",
    "officialUrl": "https://atletismorfea.es/sites/default/files/2026-01/008-2026%20Proyecto%20calendario%202026%20.pdf",
    "description": "Carrera oficial Ruta de RFEA. Nivel: RFEA.",
    "isPublished": true,
    "isFeatured": false,
    "scraperAdapter": "mysports",
    "hashtags": [
      "#RFEA",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-47-edicion-media-maraton-sevilla-los-palacios-2026-10-13",
    "_creationTime": 1788288136938,
    "name": "47º Edicion media maraton Sevilla los Palacios",
    "slug": "47-edicion-media-maraton-sevilla-los-palacios-2026-10-13",
    "locality": "Los Palacios y Villafranca (Sevilla)",
    "province": "sevilla",
    "distanceKm": 10,
    "raceType": "road",
    "homologated": false,
    "startDate": "2026-10-13",
    "startTime": "09:00",
    "organizer": "RFEA",
    "officialUrl": "https://atletismorfea.es/sites/default/files/2026-01/008-2026%20Proyecto%20calendario%202026%20.pdf",
    "description": "Carrera oficial Ruta de RFEA. Nivel: Nacional.",
    "isPublished": true,
    "isFeatured": false,
    "scraperAdapter": "mysports",
    "hashtags": [
      "#RFEA",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-brama-stage-run-2026-10-16",
    "_creationTime": 1788288136938,
    "name": "Brama Stage Run",
    "slug": "brama-stage-run-2026-10-16",
    "locality": "Ribes de Freser, Girona",
    "province": "girona",
    "distanceKm": 78,
    "elevationGainM": 4300,
    "raceType": "trail",
    "homologated": false,
    "startDate": "2026-10-16",
    "startTime": "09:00",
    "organizer": "ITRA",
    "officialUrl": "https://bramarun.com/",
    "description": "Carrera ITRA.",
    "isPublished": true,
    "isFeatured": true,
    "scraperAdapter": "generic",
    "hashtags": [
      "#ITRA",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-ultra-trail-guara-somontano-2026-10-17",
    "_creationTime": 1788288136938,
    "name": "Ultra Trail Guara Somontano",
    "slug": "ultra-trail-guara-somontano-2026-10-17",
    "locality": "Alquézar, Huesca",
    "province": "huesca",
    "distanceKm": 102,
    "elevationGainM": 5400,
    "raceType": "trail",
    "homologated": false,
    "startDate": "2026-10-17",
    "startTime": "09:00",
    "organizer": "ITRA",
    "officialUrl": "https://utguarasomontano.com/",
    "description": "Carrera ITRA.",
    "isPublished": true,
    "isFeatured": true,
    "scraperAdapter": "generic",
    "hashtags": [
      "#ITRA",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-barbudo-skyrace-2026-10-18",
    "_creationTime": 1788288136938,
    "name": "Barbudo SkyRace",
    "slug": "barbudo-skyrace-2026-10-18",
    "locality": "Murcia",
    "province": "murcia",
    "distanceKm": 21,
    "raceType": "trail",
    "homologated": false,
    "startDate": "2026-10-18",
    "startTime": "09:00",
    "organizer": "FEDME",
    "officialUrl": "https://fedme.es/la-fedme-presenta-el-calendario-provisional-oficial-de-carreras-por-montana-2026/",
    "description": "Carrera oficial Línea de FEDME. Nivel: Copa España Final.",
    "isPublished": true,
    "isFeatured": false,
    "scraperAdapter": "generic",
    "hashtags": [
      "#FEDME",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-xii-kv-las-hurdes-2026-10-25",
    "_creationTime": 1788288136938,
    "name": "XII KV Las Hurdes",
    "slug": "xii-kv-las-hurdes-2026-10-25",
    "locality": "Cáceres",
    "province": "caceres",
    "distanceKm": 21,
    "raceType": "trail",
    "homologated": false,
    "startDate": "2026-10-25",
    "startTime": "09:00",
    "organizer": "FEDME",
    "officialUrl": "https://fedme.es/la-fedme-presenta-el-calendario-provisional-oficial-de-carreras-por-montana-2026/",
    "description": "Carrera oficial Vertical de FEDME. Nivel: Copa España 4 (Final) + Cto. España Clubes.",
    "isPublished": true,
    "isFeatured": false,
    "scraperAdapter": "generic",
    "hashtags": [
      "#FEDME",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-xl-san-silvestre-internacional-crevillentina-2026-2026-10-31",
    "_creationTime": 1788288136938,
    "name": "XL San Silvestre Internacional Crevillentina 2026",
    "slug": "xl-san-silvestre-internacional-crevillentina-2026-2026-10-31",
    "locality": "Crevillente (Alicante)",
    "province": "alicante",
    "distanceKm": 10,
    "raceType": "road",
    "homologated": false,
    "startDate": "2026-10-31",
    "startTime": "09:00",
    "organizer": "RFEA",
    "officialUrl": "https://atletismorfea.es/sites/default/files/2026-01/008-2026%20Proyecto%20calendario%202026%20.pdf",
    "description": "Carrera oficial Ruta de RFEA. Nivel: Internacional 1.",
    "isPublished": true,
    "isFeatured": false,
    "scraperAdapter": "mysports",
    "hashtags": [
      "#RFEA",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-lxii-nationale-nederlanden-san-silvestre-vallecana-2026-10-31",
    "_creationTime": 1788288136938,
    "name": "LXII Nationale-Nederlanden San Silvestre Vallecana",
    "slug": "lxii-nationale-nederlanden-san-silvestre-vallecana-2026-10-31",
    "locality": "Madrid",
    "province": "madrid",
    "distanceKm": 10,
    "raceType": "road",
    "homologated": false,
    "startDate": "2026-10-31",
    "startTime": "09:00",
    "organizer": "RFEA",
    "officialUrl": "https://atletismorfea.es/sites/default/files/2026-01/008-2026%20Proyecto%20calendario%202026%20.pdf",
    "description": "Carrera oficial Ruta de RFEA. Nivel: WARRL - Label.",
    "isPublished": true,
    "isFeatured": false,
    "scraperAdapter": "mysports",
    "hashtags": [
      "#RFEA",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-lvi-circuito-de-nochevieja-memorial-ramon-gil-2026-10-31",
    "_creationTime": 1788288136938,
    "name": "LVI Circuito de Nochevieja \"Memorial Ramón Gil\"",
    "slug": "lvi-circuito-de-nochevieja-memorial-ramon-gil-2026-10-31",
    "locality": "Galdakao (Bizcaya)",
    "province": "valencia",
    "distanceKm": 10,
    "raceType": "road",
    "homologated": false,
    "startDate": "2026-10-31",
    "startTime": "09:00",
    "organizer": "RFEA",
    "officialUrl": "https://atletismorfea.es/sites/default/files/2026-01/008-2026%20Proyecto%20calendario%202026%20.pdf",
    "description": "Carrera oficial Ruta de RFEA. Nivel: Nacional.",
    "isPublished": true,
    "isFeatured": false,
    "scraperAdapter": "mysports",
    "hashtags": [
      "#RFEA",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-cross-3-refugios-2026-11-01",
    "_creationTime": 1788288136938,
    "name": "Cross 3 Refugios",
    "slug": "cross-3-refugios-2026-11-01",
    "locality": "Manzanares el Real, Madrid",
    "province": "madrid",
    "distanceKm": 24,
    "elevationGainM": 1750,
    "raceType": "trail",
    "homologated": false,
    "startDate": "2026-11-01",
    "startTime": "09:00",
    "organizer": "ITRA",
    "officialUrl": "https://cross3refugios.com/",
    "description": "Carrera ITRA.",
    "isPublished": true,
    "isFeatured": false,
    "scraperAdapter": "generic",
    "hashtags": [
      "#ITRA",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-costa-blanca-trails-2026-11-14",
    "_creationTime": 1788288136938,
    "name": "Costa Blanca Trails",
    "slug": "costa-blanca-trails-2026-11-14",
    "locality": "Finestrat, Alicante",
    "province": "alicante",
    "distanceKm": 66,
    "elevationGainM": 3990,
    "raceType": "trail",
    "homologated": false,
    "startDate": "2026-11-14",
    "startTime": "09:00",
    "organizer": "ITRA",
    "officialUrl": "https://costablancatrails.com/",
    "description": "Carrera ITRA.",
    "isPublished": true,
    "isFeatured": true,
    "scraperAdapter": "generic",
    "hashtags": [
      "#ITRA",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-runedia-totalenergies-maraton-murcia-costa-calida-2026-11-15",
    "_creationTime": 1788288136938,
    "name": "TotalEnergies Maratón Murcia Costa Cálida",
    "slug": "runedia-totalenergies-maraton-murcia-costa-calida-2026-11-15",
    "locality": "Murcia",
    "province": "murcia",
    "distanceKm": 42.195,
    "raceType": "road",
    "homologated": false,
    "startDate": "2026-11-15",
    "startTime": "09:00",
    "organizer": "Runedia",
    "officialUrl": "https://runedia.mundodeportivo.com/calendario-carreras/",
    "description": "Carrera Runedia.",
    "isPublished": true,
    "isFeatured": false,
    "scraperAdapter": "generic",
    "hashtags": [
      "#Runedia",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-runedia-xxv-medio-maraton-y-10k-elche-2026-11-29",
    "_creationTime": 1788288136938,
    "name": "XXV Medio Maratón y 10K Elche",
    "slug": "runedia-xxv-medio-maraton-y-10k-elche-2026-11-29",
    "locality": "Elche",
    "province": "alicante",
    "distanceKm": 21.097,
    "raceType": "road",
    "homologated": false,
    "startDate": "2026-11-29",
    "startTime": "09:00",
    "organizer": "Runedia",
    "officialUrl": "https://runedia.mundodeportivo.com/calendario-carreras/",
    "description": "Carrera Runedia.",
    "isPublished": true,
    "isFeatured": false,
    "scraperAdapter": "generic",
    "hashtags": [
      "#Runedia",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-sportmaniacs-marathon-valencia-modo-muerta-2026-12-06",
    "_creationTime": 1788288136938,
    "name": "Marathon Valencia Modo Muerta",
    "slug": "sportmaniacs-marathon-valencia-modo-muerta-2026-12-06",
    "locality": "Valencia",
    "province": "valencia",
    "distanceKm": 26,
    "raceType": "trail",
    "homologated": false,
    "startDate": "2026-12-06",
    "startTime": "09:00",
    "organizer": "Sportmaniacs",
    "officialUrl": "https://sportmaniacs.com/es/race/marathon-valle-modo-muerta",
    "description": "Carrera Sportmaniacs.",
    "isPublished": true,
    "isFeatured": false,
    "scraperAdapter": "generic",
    "hashtags": [
      "#Sportmaniacs",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-runedia-marathon-valencia-trinidad-alfonso-2026-12-06",
    "_creationTime": 1788288136938,
    "name": "Marathon Valencia Trinidad Alfonso",
    "slug": "runedia-marathon-valencia-trinidad-alfonso-2026-12-06",
    "locality": "Valencia",
    "province": "valencia",
    "distanceKm": 42.195,
    "raceType": "road",
    "homologated": false,
    "startDate": "2026-12-06",
    "startTime": "09:00",
    "organizer": "Runedia",
    "officialUrl": "https://runedia.mundodeportivo.com/calendario-carreras/",
    "description": "Carrera Runedia.",
    "isPublished": true,
    "isFeatured": false,
    "scraperAdapter": "generic",
    "hashtags": [
      "#Runedia",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-runedia-maraton-almeria-2026-2026-12-13",
    "_creationTime": 1788288136938,
    "name": "Maratón Almería 2026",
    "slug": "runedia-maraton-almeria-2026-2026-12-13",
    "locality": "Almería",
    "province": "almeria",
    "distanceKm": 42.195,
    "raceType": "road",
    "homologated": false,
    "startDate": "2026-12-13",
    "startTime": "09:00",
    "organizer": "Runedia",
    "officialUrl": "https://runedia.mundodeportivo.com/calendario-carreras/",
    "description": "Carrera Runedia.",
    "isPublished": true,
    "isFeatured": false,
    "scraperAdapter": "generic",
    "hashtags": [
      "#Runedia",
      "#Scraped",
      "#CarreraOficial"
    ]
  },
  {
    "_id": "scraped-sportmaniacs-cursa-popular-sant-silvestre-sabadell-2026-12-31",
    "_creationTime": 1788288136938,
    "name": "Cursa Popular Sant Silvestre Sabadell",
    "slug": "sportmaniacs-cursa-popular-sant-silvestre-sabadell-2026-12-31",
    "locality": "Sabadell",
    "province": "barcelona",
    "distanceKm": 10,
    "raceType": "road",
    "homologated": false,
    "startDate": "2026-12-31",
    "startTime": "09:00",
    "organizer": "Sportmaniacs",
    "officialUrl": "https://sportmaniacs.com/es/race/sant-silvestre-sabadell",
    "description": "Carrera Sportmaniacs.",
    "isPublished": true,
    "isFeatured": false,
    "scraperAdapter": "generic",
    "hashtags": [
      "#Sportmaniacs",
      "#Scraped",
      "#CarreraOficial"
    ]
  }
];

// =============================================================================
// MOCK USER DATA
// =============================================================================

export const MOCK_PROFILE = {
  _id: "u1",
  clerkUserId: "mock_user_1",
  displayName: "Manu Vera",
  avatarUrl: undefined,
  bio: "Corredor amateur del Levante. Mi objetivo: MMP en Albacete y Valencia 2026.",
  club: "Bull Runners",
  emailResultsEnabled: true,
  emailRemindersEnabled: true,
  emailWeeklyDigestEnabled: true,
};

export const MOCK_PRS = [
  { _id: "pr1", userId: "u1", distanceM: 5000, distanceLabel: "5K", timeSeconds: 1426, source: "manual" as const, isCurrent: true, achievedAt: "2026-05-23" },
  { _id: "pr2", userId: "u1", distanceM: 10000, distanceLabel: "10K", timeSeconds: 2840, source: "manual" as const, isCurrent: true, achievedAt: "2026-05-16" },
  { _id: "pr3", userId: "u1", distanceM: 21097, distanceLabel: "Media Maratón", timeSeconds: 5863, source: "manual" as const, isCurrent: true, achievedAt: "2026-01-18" },
];

export const MOCK_MY_RACES = [
  {
    _id: "mr1",
    userId: "u1",
    raceId: "r1",
    dorsalNumber: "1234",
    status: "planned" as const,
    predictedTimeSeconds: 3920,
    predictionConfidence: "high" as const,
    race: MOCK_RACES[0],
  },
  {
    _id: "mr2",
    userId: "u1",
    raceId: "r2",
    dorsalNumber: "5678",
    status: "planned" as const,
    predictedTimeSeconds: 5650,
    predictionConfidence: "high" as const,
    race: MOCK_RACES[1],
  },
  {
    _id: "mr3",
    userId: "u1",
    raceId: "r3",
    dorsalNumber: "9012",
    status: "planned" as const,
    predictedTimeSeconds: 5520,
    predictionConfidence: "high" as const,
    race: MOCK_RACES[2],
  },
];

export const MOCK_RATINGS: Record<string, any[]> = {
  r1: [
    { organization: 8, price: 7, swag: 8, aidStations: 9, course: 9, atmosphere: 10, postRace: 8, trophies: 7, comment: "Increíble ambiente nocturno" },
    { organization: 9, price: 8, swag: 7, aidStations: 8, course: 8, atmosphere: 9, postRace: 9, trophies: 8 },
    { organization: 7, price: 7, swag: 8, aidStations: 9, course: 9, atmosphere: 10, postRace: 7, trophies: 7 },
    { organization: 8, price: 8, swag: 8, aidStations: 9, course: 9, atmosphere: 10, postRace: 8, trophies: 8 },
  ],
  r2: [
    { organization: 9, price: 9, swag: 7, aidStations: 8, course: 8, atmosphere: 8, postRace: 8, trophies: 7 },
    { organization: 8, price: 9, swag: 7, aidStations: 7, course: 8, atmosphere: 8, postRace: 7, trophies: 7 },
    { organization: 9, price: 9, swag: 7, aidStations: 8, course: 8, atmosphere: 9, postRace: 8, trophies: 7 },
  ],
  r3: [
    { organization: 10, price: 8, swag: 9, aidStations: 10, course: 10, atmosphere: 10, postRace: 9, trophies: 8 },
    { organization: 9, price: 7, swag: 8, aidStations: 9, course: 10, atmosphere: 9, postRace: 8, trophies: 8 },
    { organization: 10, price: 9, swag: 9, aidStations: 10, course: 10, atmosphere: 10, postRace: 9, trophies: 9 },
    { organization: 10, price: 8, swag: 9, aidStations: 10, course: 10, atmosphere: 10, postRace: 9, trophies: 9 },
  ],
  r4: [
    { organization: 8, price: 8, swag: 8, aidStations: 7, course: 8, atmosphere: 9, postRace: 8, trophies: 7 },
    { organization: 8, price: 8, swag: 7, aidStations: 7, course: 8, atmosphere: 9, postRace: 8, trophies: 7 },
    { organization: 9, price: 8, swag: 8, aidStations: 7, course: 8, atmosphere: 10, postRace: 8, trophies: 7 },
  ],
  r6: [
    { organization: 9, price: 7, swag: 9, aidStations: 10, course: 9, atmosphere: 9, postRace: 10, trophies: 8 },
    { organization: 9, price: 7, swag: 8, aidStations: 10, course: 9, atmosphere: 9, postRace: 9, trophies: 8 },
  ],
  r7: [
    { organization: 9, price: 7, swag: 9, aidStations: 8, course: 10, atmosphere: 9, postRace: 9, trophies: 7 },
    { organization: 8, price: 7, swag: 8, aidStations: 7, course: 10, atmosphere: 9, postRace: 8, trophies: 7 },
    { organization: 9, price: 7, swag: 9, aidStations: 8, course: 10, atmosphere: 9, postRace: 9, trophies: 7 },
  ],
  r10: [
    { organization: 9, price: 9, swag: 8, aidStations: 8, course: 8, atmosphere: 9, postRace: 8, trophies: 7 },
    { organization: 8, price: 9, swag: 8, aidStations: 8, course: 8, atmosphere: 9, postRace: 8, trophies: 7 },
    { organization: 9, price: 9, swag: 8, aidStations: 8, course: 8, atmosphere: 9, postRace: 8, trophies: 7 },
  ],
};

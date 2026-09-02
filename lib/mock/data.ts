// =============================================================================
// mi-dorsal — Mock data for dev without credentials
// =============================================================================
// Datos de ejemplo para que la app funcione sin Clerk/Convex.
// Activar con NEXT_PUBLIC_USE_MOCK=true en .env.local.
// =============================================================================

export interface MockRace {
  _id: string;
  _creationTime: number;
  name: string;
  slug: string;
  locality?: string;
  province: "alicante" | "valencia" | "castellon" | "murcia" | "albacete" | "almeria";
  distanceKm: number;
  elevationGainM?: number;
  raceType: "road" | "trail" | "mixed" | "obstacle";
  homologated?: boolean;
  organizer?: string;
  organizerUrl?: string;
  resultsUrl?: string;
  registrationUrl?: string;
  officialUrl?: string;
  startDate?: string;
  startTime?: string;
  description?: string;
  imageUrl?: string;
  isPublished?: boolean;
  isFeatured?: boolean;
}

export const MOCK_RACES: MockRace[] = [
  {
    _id: "r1",
    _creationTime: Date.now() - 86400000 * 30,
    name: "15K Nocturna Valencia Gana Energía",
    slug: "15k-nocturna-valencia-2026",
    locality: "Valencia",
    province: "valencia",
    distanceKm: 15.0,
    elevationGainM: 30,
    raceType: "road",
    homologated: true,
    organizer: "15K Nocturna Valencia",
    startDate: "2026-09-26",
    startTime: "22:30",
    description: "La carrera nocturna más emblemática de Valencia. 15K por el centro y la Ciudad de las Artes.",
    isPublished: true,
    isFeatured: true,
  },
  {
    _id: "r2",
    _creationTime: Date.now() - 86400000 * 30,
    name: "Media Maratón Albacete",
    slug: "media-maraton-albacete-2026",
    locality: "Albacete",
    province: "albacete",
    distanceKm: 21.097,
    elevationGainM: 80,
    raceType: "road",
    homologated: true,
    organizer: "Ayuntamiento de Albacete",
    startDate: "2026-10-04",
    startTime: "09:30",
    description: "Media maratón homologada por la RFEA. Circuito urbano plano.",
    isPublished: true,
    isFeatured: true,
  },
  {
    _id: "r3",
    _creationTime: Date.now() - 86400000 * 30,
    name: "Media Maratón Valencia Trinidad Alfonso",
    slug: "media-maraton-valencia-2026",
    locality: "Valencia",
    province: "valencia",
    distanceKm: 21.097,
    elevationGainM: 50,
    raceType: "road",
    homologated: true,
    organizer: "SD Correcaminos",
    startDate: "2026-10-25",
    startTime: "08:30",
    description: "Una de las medias maratones más rápidas del mundo. Objetivo MMP.",
    isPublished: true,
    isFeatured: true,
  },
  {
    _id: "r4",
    _creationTime: Date.now() - 86400000 * 25,
    name: "10K Nocturna Alicante",
    slug: "10k-nocturna-alicante-2026",
    locality: "Alicante",
    province: "alicante",
    distanceKm: 10.0,
    elevationGainM: 20,
    raceType: "road",
    homologated: true,
    organizer: "Club Atletismo Alicante",
    startDate: "2026-07-12",
    startTime: "22:00",
    description: "10K nocturna por el paseo marítimo de Alicante. Ambiente espectacular.",
    isPublished: true,
    isFeatured: true,
  },
  {
    _id: "r5",
    _creationTime: Date.now() - 86400000 * 25,
    name: "Carrera de la Mujer Valencia",
    slug: "carrera-mujer-valencia-2026",
    locality: "Valencia",
    province: "valencia",
    distanceKm: 6.5,
    raceType: "road",
    organizer: "Carrera de la Mujer",
    startDate: "2026-04-05",
    startTime: "10:00",
    description: "Carrera solidaria con causa benéfica. 6.5K urbanos.",
    isPublished: true,
  },
  {
    _id: "r6",
    _creationTime: Date.now() - 86400000 * 20,
    name: "Maratón Murcia 2026",
    slug: "maraton-murcia-2026",
    locality: "Murcia",
    province: "murcia",
    distanceKm: 42.195,
    elevationGainM: 150,
    raceType: "road",
    homologated: true,
    organizer: "Ayuntamiento de Murcia",
    startDate: "2026-11-15",
    startTime: "08:30",
    description: "Maratón homologado RFEA. Primera edición con circuito completo por la huerta.",
    isPublished: true,
    isFeatured: true,
  },
  {
    _id: "r7",
    _creationTime: Date.now() - 86400000 * 20,
    name: "Trail Sierra de Aitana",
    slug: "trail-aitana-2026",
    locality: "Alcoleja",
    province: "alicante",
    distanceKm: 28.0,
    elevationGainM: 1450,
    raceType: "trail",
    organizer: "Club Muntanya Alcoi",
    startDate: "2026-05-18",
    startTime: "08:00",
    description: "Trail técnico por la Sierra de Aitana. 28K con 1450m+ de desnivel.",
    isPublished: true,
  },
  {
    _id: "r8",
    _creationTime: Date.now() - 86400000 * 15,
    name: "San Silvestre Vallecana",
    slug: "san-silvestre-vallecana-2026",
    locality: "Madrid",
    province: "albacete", // placeholder
    distanceKm: 10.0,
    raceType: "road",
    homologated: true,
    organizer: "Atletismo Vallecas",
    startDate: "2026-12-31",
    startTime: "18:00",
    description: "La San Silvestre más famosa de España.",
    isPublished: true,
  },
  {
    _id: "r9",
    _creationTime: Date.now() - 86400000 * 15,
    name: "5K Memorial Zambrana",
    slug: "5k-memorial-zambrana-2026",
    locality: "Elche",
    province: "alicante",
    distanceKm: 5.0,
    raceType: "road",
    homologated: true,
    organizer: "Club Atletismo Elche",
    startDate: "2026-05-23",
    startTime: "20:00",
    description: "5K nocturno en Elche. Rápido y homologado.",
    isPublished: true,
  },
  {
    _id: "r10",
    _creationTime: Date.now() - 86400000 * 10,
    name: "10K Elche Night Race",
    slug: "10k-elche-night-race-2026",
    locality: "Elche",
    province: "alicante",
    distanceKm: 10.0,
    raceType: "road",
    homologated: true,
    organizer: "Club Triatlón Elche",
    startDate: "2026-05-16",
    startTime: "21:30",
    description: "10K nocturno por el centro de Elche.",
    isPublished: true,
    isFeatured: true,
  },
  {
    _id: "r11",
    _creationTime: Date.now() - 86400000 * 10,
    name: "Mitja Marató Santa Pola",
    slug: "mitja-santa-pola-2026",
    locality: "Santa Pola",
    province: "alicante",
    distanceKm: 21.097,
    elevationGainM: 40,
    raceType: "road",
    homologated: true,
    organizer: "Ayto Santa Pola",
    startDate: "2026-01-18",
    startTime: "10:00",
    description: "Media maratón costera en Santa Pola.",
    isPublished: true,
  },
  {
    _id: "r12",
    _creationTime: Date.now() - 86400000 * 8,
    name: "Trail Cabezo de Torres",
    slug: "trail-cabezo-torres-2026",
    locality: "Murcia",
    province: "murcia",
    distanceKm: 18.0,
    elevationGainM: 650,
    raceType: "trail",
    organizer: "Club Montaña Murcia",
    startDate: "2026-03-08",
    startTime: "09:00",
    description: "Trail por la Sierra de Carrascoy. 18K con 650m+.",
    isPublished: true,
  },
];

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
    predictedTimeSeconds: 3920, // 1:05:20
    predictionConfidence: "high" as const,
    race: MOCK_RACES[0],
  },
  {
    _id: "mr2",
    userId: "u1",
    raceId: "r2",
    dorsalNumber: "5678",
    status: "planned" as const,
    predictedTimeSeconds: 5650, // 1:34:10 estimación rápida
    predictionConfidence: "high" as const,
    race: MOCK_RACES[1],
  },
  {
    _id: "mr3",
    userId: "u1",
    raceId: "r3",
    dorsalNumber: "9012",
    status: "planned" as const,
    predictedTimeSeconds: 5520, // 1:32:00
    predictionConfidence: "high" as const,
    race: MOCK_RACES[2],
  },
];

export const MOCK_RATINGS: Record<string, any[]> = {
  r1: [
    { organization: 8, price: 7, swag: 8, aidStations: 9, course: 9, atmosphere: 10, postRace: 8, trophies: 7, comment: "Increíble ambiente nocturno" },
    { organization: 9, price: 8, swag: 7, aidStations: 8, course: 8, atmosphere: 9, postRace: 9, trophies: 8 },
    { organization: 7, price: 7, swag: 8, aidStations: 9, course: 9, atmosphere: 10, postRace: 7, trophies: 7 },
  ],
  r3: [
    { organization: 10, price: 8, swag: 9, aidStations: 10, course: 10, atmosphere: 10, postRace: 9, trophies: 8 },
    { organization: 9, price: 7, swag: 8, aidStations: 9, course: 10, atmosphere: 9, postRace: 8, trophies: 8 },
    { organization: 10, price: 9, swag: 9, aidStations: 10, course: 10, atmosphere: 10, postRace: 9, trophies: 9 },
  ],
};

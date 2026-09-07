// =============================================================================
// mi-dorsal — Activity normalization
// =============================================================================
// Funciones PURAS reutilizables desde Ola 0 (upload de export) y Ola 1 (OAuth).
// No importan nada de Convex runtime: solo tipos, para que se puedan testear
// y mover entre plataformas (Node, edge, etc.) sin fricción.
//
// Responsabilidades:
//   1. Clasificar una actividad Strava (Run / TrailRun / Race / etc.) en uno
//      de nuestros 7 tipos: race | long_run | tempo | interval | easy |
//      recovery | trail
//   2. Normalizar filas crudas (CSV o JSON de API) a un modelo común
//   3. Cross-reference con `races` por nombre + fecha + localidad + distancia
//      (matching fuzzy con ventana de tolerancia)
//   4. Detectar PRs automáticamente: si la actividad es tipo "race" y está
//      dentro de una distancia PR estándar, comprobar si bate el récord actual
// =============================================================================

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type ActivityType =
  | "race"
  | "long_run"
  | "tempo"
  | "interval"
  | "easy"
  | "recovery"
  | "trail";

export const ACTIVITY_TYPES: ActivityType[] = [
  "race",
  "long_run",
  "tempo",
  "interval",
  "easy",
  "recovery",
  "trail",
];

export type StravaActivityType =
  | "Run"
  | "TrailRun"
  | "VirtualRun"
  | "Race"
  | "Walk"
  | "Hike"
  | "Ride"
  | "VirtualRide"
  | "Workout"
  | "Yoga"
  | "Other";

/**
 * Deportes de Strava que SON correr. Strava ingiere bajo el mismo endpoint
 * cualquier deporte que el usuario registre (pádel, ciclismo, esquí, pesas,
 * senderismo, natación...) — sin este filtro, el feed/stats/perfil de
 * corredor se contaminan con actividades que no son running.
 *
 * "Race" se incluye porque Strava lo usa como sport_type cuando el usuario
 * marca la actividad como carrera oficial — en la práctica siempre es una
 * carrera a pie salvo que el usuario corra en bici y la marque como "Race"
 * por error, caso raro que no merece complejidad adicional aquí.
 */
export const RUNNING_SPORT_TYPES: readonly string[] = ["Run", "TrailRun", "VirtualRun", "Race"];

/** ¿Este sport_type de Strava es running? */
export function isRunningSportType(sportType: string | undefined | null): boolean {
  if (!sportType) return true; // actividades pre-2026-09-07 sin el campo: asumir running (ver nota en schema.ts)
  return RUNNING_SPORT_TYPES.includes(sportType);
}

/**
 * Convierte la cadencia de running que devuelve la API de Strava
 * (`average_cadence` en GET /athlete/activities y GET /activities/{id}) a
 * pasos por minuto reales (spm).
 *
 * Strava, para actividades de running, expresa `average_cadence` en
 * zancadas de UNA sola pierna por minuto (típico ~75-95 en carrera normal),
 * no en pasos totales (~150-190). No está documentado explícitamente en el
 * spec oficial de developers.strava.com, pero se confirma con datos reales
 * de este proyecto: valores crudos de ~50-90 no tienen sentido como "pasos
 * por minuto" para ningún corredor, pero sí como zancadas de una pierna —
 * y ×2 da cifras coherentes con lo que cualquier reloj GPS muestra.
 *
 * IMPORTANTE: esto es específico de la API REST. NO se ha podido verificar
 * si el CSV de bulk export usa la misma unidad o no (no hay documentación
 * oficial ni una muestra real disponible en este proyecto para comparar) —
 * por eso normalizeStravaCsvRow (más abajo) NO aplica esta conversión. Si
 * en el futuro se confirma que el CSV también viene en zancadas/pierna,
 * aplicar aquí también.
 */
export function stravaApiCadenceToSpm(avgCadence: number | undefined): number | undefined {
  if (avgCadence === undefined || avgCadence <= 0) return undefined;
  return avgCadence * 2;
}

/** Fila cruda del CSV de Strava. Tolerante: cualquier campo puede ser undefined. */
export interface StravaCsvRow {
  "Activity ID"?: string | number;
  "Activity Date"?: string;
  "Activity Name"?: string;
  "Activity Type"?: string;
  "Activity Description"?: string;
  "Elapsed Time"?: string | number;
  "Distance"?: string | number;
  "Max Heart Rate"?: string | number;
  "Average Heart Rate"?: string | number;
  "Average Speed"?: string | number;
  "Average Cadence"?: string | number;
  "Total Elevation Gain"?: string | number;
  "Total Elevation Loss"?: string | number;
  "Max Cadence"?: string | number;
  "Relative Effort"?: string | number;
  "Total Work"?: string | number;
  "Calories"?: string | number;
  "Commute"?: string | boolean;
  "Filename"?: string;
  "Athlete Weight"?: string | number;
  "Grade Adjusted Distance"?: string | number;
  "Perceived Exertion"?: string | number;
  "Perceived Effort"?: string | number;
  "Uphill Time"?: string | number;
  "Downhill Time"?: string | number;
  "Other Time"?: string | number;
  "Weather Temperature"?: string | number;
  "Weather Humidity"?: string | number;
  "Weather Wind Speed"?: string | number;
  // Hay duplicados con .1, .2, .3 que ignoramos. Hay una columna vacía
  // al final. El parser debe saltar cualquier columna desconocida.
  [key: string]: string | number | boolean | undefined;
}

/** Modelo normalizado de actividad (lo que guardamos en Convex). */
export interface NormalizedActivity {
  providerActivityId: string;
  name?: string;
  description?: string;
  startedAt: number;            // ms epoch
  durationSec: number;
  distanceM: number;
  avgPaceSecPerKm?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgCadence?: number;
  elevationGainM?: number;
  elevationLossM?: number;
  stravaType: StravaActivityType | "Unknown";
  classifiedType: ActivityType;
  isPrivate: boolean;
  rawPayload?: Record<string, unknown>;
}

/** Fila del profile.csv de Strava. */
export interface StravaProfileRow {
  "Athlete ID"?: string | number;
  "Username"?: string;
  "Name"?: string;
  "First Name"?: string;
  "Last Name"?: string;
  "City"?: string;
  "State"?: string;
  "Country"?: string;
  "Sex"?: string;
  "Bio"?: string;
  "Weight"?: string | number;
  "Height"?: string | number;
  "Max Heart Rate"?: string | number;
  "Resting Heart Rate"?: string | number;
  "Profile Photo"?: string;
  "Profile (Medium)"?: string;
  "Profile (Large)"?: string;
  "Facebook"?: string;
  "Instagram"?: string;
  "Twitter"?: string;
  "Created At"?: string;
  "Updated At"?: string;
  "Badge Type Id"?: string | number;
  "Timezone"?: string;
  "Friend Count"?: string | number;
  "Follower Count"?: string | number;
  "Measurement Preference"?: string;
  "FTP"?: string | number;
  "Bikes"?: string | number;
  "Shoes"?: string | number;
  "Clubs"?: string;
  "Other Gear"?: string;
  [key: string]: string | number | boolean | undefined;
}

// ---------------------------------------------------------------------------
// Utilidades de parseo
// ---------------------------------------------------------------------------

/** Convierte un valor Strava (que puede ser number, string, "NULL", vacío) a number. */
export function toNumber(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "" || s.toUpperCase() === "NULL") return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function toString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string") {
    const s = v.trim();
    return s === "" ? undefined : s;
  }
  if (typeof v === "number") return String(v);
  return undefined;
}

export function toBoolean(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  if (typeof v === "number") return v === 1;
  return false;
}

/**
 * Strava export tiene fechas en formato "2024-03-15 09:32:41" (sin zona).
 * El "Start Time" es el preferente; "Activity Date" es fallback.
 * Devuelve ms epoch. Asumimos hora local del atleta (Strava ya nos lo da en
 * hora local según su timezone).
 */
export function parseStravaDate(s: string | undefined): number | undefined {
  if (!s) return undefined;
  // "2024-03-15 09:32:41" o "2024-03-15T09:32:41Z"
  const iso = s.replace(" ", "T");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.getTime();
}

/** Distancia Strava está en metros. */
export function parseDistance(v: unknown): number {
  return toNumber(v) ?? 0;
}

/** Duración Strava está en segundos. */
export function parseDuration(v: unknown): number {
  return toNumber(v) ?? 0;
}

/** Strava avgSpeed está en m/s. Lo convertimos a pace (segundos por km). */
export function mpsToPaceSecPerKm(mps: number | undefined): number | undefined {
  if (mps === undefined || mps <= 0) return undefined;
  return Math.round(1000 / mps);
}

// ---------------------------------------------------------------------------
// Clasificación de actividades
// ---------------------------------------------------------------------------

/**
 * Distancias estándar para PRs. Si la actividad está cerca de una de estas
 * Y es tipo "race" (o "Race" en Strava), es candidata a PR.
 *
 * Incluye ruta (5K-maratón) y ultra (50K-100 millas). El hueco más pequeño
 * entre dos distancias consecutivas es maratón→50K (18.5%), así que un 5%
 * de tolerancia a cada lado nunca solapa dos distancias entre sí — no se
 * puede confundir un maratón lento con un 50K rápido, por ejemplo.
 */
const PR_DISTANCES_M = [
  5000, // 5K
  10000, // 10K
  15000, // 15K
  21097, // Media maratón
  42195, // Maratón
  50000, // 50K
  80467, // 50 millas (~80.47 km)
  100000, // 100K
  160934, // 100 millas (~160.93 km)
] as const;
const PR_DISTANCE_TOLERANCE_PCT = 0.05; // 5% de tolerancia

/** ¿Esta distancia matchea con un PR estándar? */
export function matchPRDistance(distanceM: number): number | null {
  if (distanceM <= 0) return null;
  for (const target of PR_DISTANCES_M) {
    const tolerance = target * PR_DISTANCE_TOLERANCE_PCT;
    if (Math.abs(distanceM - target) <= tolerance) {
      return target;
    }
  }
  return null;
}

/**
 * Mapea el `name` de un best_effort de Strava (ej. "5k", "Half-Marathon")
 * a una de nuestras PR_DISTANCES_M. Se usa el nombre en vez de re-derivar
 * por `distance` porque Strava ya sabe exactamente qué segmento calculó —
 * más fiable que aplicar de nuevo una tolerancia porcentual sobre metros.
 * Strava solo emite best_efforts para las distancias fijas que reconoce
 * (400m, 1/2 mile, 1k, 1 mile, 2 mile, 5k, 10k, 15k, 10 mile, 20k,
 * Half-Marathon, 30k, Marathon) — de esa lista, solo 5K/10K/15K/Media/
 * Maratón coinciden con las que trackeamos aquí. Strava NO emite
 * best_efforts para ultras (50K+), así que esas siguen detectándose por
 * distancia total de la actividad vía matchPRDistance.
 */
const BEST_EFFORT_NAME_TO_DISTANCE_M: Record<string, number> = {
  "5k": 5000,
  "10k": 10000,
  "15k": 15000,
  "half-marathon": 21097,
  "marathon": 42195,
};

export function matchBestEffortName(name: string): number | null {
  return BEST_EFFORT_NAME_TO_DISTANCE_M[name.trim().toLowerCase()] ?? null;
}

/**
 * Clasifica una actividad en uno de nuestros 7 tipos.
 *
 * Heurística (orden de prioridad):
 *   1. Strava "Race" → race
 *   2. Strava "TrailRun" Y desnivel/km > 15m → trail
 *   3. Strava "TrailRun" → trail (más raro pero posible que sea llano)
 *   4. Strava "VirtualRun" → easy (cinta, no carrera)
 *   5. Strava "Run" + cadence alta + pace rápido → tempo
 *   6. Strava "Run" + pace rápido (< 4:00/km) → tempo
 *   7. Strava "Run" + desnivel/km > 20m → trail
 *   8. Strava "Run" + duración > 1h O distancia ≥ 10km → long_run (no hay
 *      un umbral de distancia universal para "tirada larga" — depende del
 *      nivel del corredor — así que se usa duración como criterio
 *      principal, con la distancia como alternativa)
 *   9. Strava "Run" + distancia < 5km → easy
 *   10. Strava "Run" + resto → easy (sesión estándar)
 *   11. Strava "Workout" → interval (series, fartlek, etc.)
 *   12. Strava "Walk" / "Hike" → recovery
 *   13. Default → easy
 *
 * Esto NO es ML. Es determinista y el corredor puede auditarlo.
 */
export function classifyActivity(
  stravaType: StravaActivityType | "Unknown",
  distanceM: number,
  durationSec: number,
  elevationGainM: number | undefined,
  avgCadence: number | undefined,
): ActivityType {
  const paceSecPerKm = distanceM > 0 && durationSec > 0
    ? durationSec / (distanceM / 1000)
    : Infinity;
  const elevationPerKm = distanceM > 0 && elevationGainM !== undefined
    ? elevationGainM / (distanceM / 1000)
    : 0;

  // 1. Strava marca explícitamente como Race
  if (stravaType === "Race") return "race";

  // 2-3. Trail
  if (stravaType === "TrailRun") {
    // Si tiene desnivel significativo, es trail puro. Si no, es probable
    // que sea un long_run en terreno mixto.
    if (elevationPerKm > 15) return "trail";
    return "long_run";
  }

  // 4. VirtualRun = cinta
  if (stravaType === "VirtualRun") return "easy";

  // 5. Walk / Hike
  if (stravaType === "Walk" || stravaType === "Hike") return "recovery";

  // 6. Workout = sesión estructurada (series, fuerza, etc.)
  if (stravaType === "Workout" || stravaType === "Yoga") return "interval";

  // Para el resto, asumimos Run
  if (stravaType === "Ride" || stravaType === "VirtualRide") {
    // Strava mezcla ciclismo aquí. Para mi-dorsal no aplica pero devolvemos
    // easy para que no se cuele en las stats de running.
    return "easy";
  }

  // Runs puras
  if (stravaType === "Run" || stravaType === "Unknown") {
    if (distanceM === 0 || durationSec === 0) return "easy";

    // Cadencia alta + pace rápido = tempo. Se evalúa ANTES de long_run para
    // que un 10K de carrera a ritmo fuerte no se cuele como "tirada larga"
    // solo por llegar a los 10km — una tirada larga es a ritmo tranquilo,
    // no una carrera rápida de esa distancia.
    if (avgCadence !== undefined && avgCadence > 175 && paceSecPerKm < 270) {
      return "tempo";
    }

    // Pace rápido = tempo
    if (paceSecPerKm > 0 && paceSecPerKm < 240) return "tempo";

    // Distancia media con desnivel = trail
    if (elevationPerKm > 20) return "trail";

    // Tirada larga: más de 1h de duración O al menos 10km, a un ritmo que
    // ya no es "tempo" (descartado arriba). No hay un estándar universal
    // de distancia (depende del nivel del corredor — un 5K-runner y un
    // maratoniano tienen tiradas largas de tamaño muy distinto), así que
    // se usa duración como criterio principal con la distancia como
    // alternativa para salidas cortas en tiempo pero largas en km.
    if (durationSec > 3600 || distanceM >= 10000) return "long_run";

    // Distancia corta = easy
    if (distanceM < 5000) return "easy";

    // Distancia media = easy (sesión estándar)
    return "easy";
  }

  return "easy";
}

// ---------------------------------------------------------------------------
// Normalización de filas crudas
// ---------------------------------------------------------------------------

/** Normaliza una fila del CSV de Strava a nuestro modelo común. */
export function normalizeStravaCsvRow(row: StravaCsvRow): NormalizedActivity | null {
  const providerActivityId = toString(row["Activity ID"]);
  if (!providerActivityId) return null;

  // Strava export tiene "Activity Date" Y "Start Time" como columnas
  // separadas. "Start Time" es más preciso. Si no está, usa "Activity Date".
  const startTimeStr = toString(row["Start Time"]) ?? toString(row["Activity Date"]);
  const startedAt = parseStravaDate(startTimeStr);
  if (startedAt === undefined) return null;

  const distanceM = parseDistance(row["Distance"]);
  const durationSec = parseDuration(row["Elapsed Time"]);
  if (distanceM === 0 && durationSec === 0) {
    // Actividad vacía (probable error de exportación). Saltar.
    return null;
  }

  const stravaTypeRaw = toString(row["Activity Type"]) ?? "Unknown";
  const stravaType = stravaTypeRaw as StravaActivityType | "Unknown";
  const elevationGainM = toNumber(row["Total Elevation Gain"]);
  const avgCadence = toNumber(row["Average Cadence"]);
  const avgSpeedMps = toNumber(row["Average Speed"]);

  const classifiedType = classifyActivity(
    stravaType,
    distanceM,
    durationSec,
    elevationGainM,
    avgCadence,
  );

  return {
    providerActivityId,
    name: toString(row["Activity Name"]),
    description: toString(row["Activity Description"]),
    startedAt,
    durationSec,
    distanceM,
    avgPaceSecPerKm: mpsToPaceSecPerKm(avgSpeedMps),
    avgHeartRate: toNumber(row["Average Heart Rate"]),
    maxHeartRate: toNumber(row["Max Heart Rate"]),
    avgCadence,
    elevationGainM,
    elevationLossM: toNumber(row["Total Elevation Loss"]),
    stravaType,
    classifiedType,
    isPrivate: false, // El export no tiene este campo; las privadas sí vienen en el export
    rawPayload: row as Record<string, unknown>,
  };
}

// ---------------------------------------------------------------------------
// Cross-reference con `races`
// ---------------------------------------------------------------------------

export interface RaceMatchCandidate {
  _id: string;
  name: string;
  slug: string;
  locality?: string;
  startDate?: string; // "YYYY-MM-DD"
  distanceKm: number;
}

/** Normaliza un string para matching fuzzy: lowercase, sin acentos, sin símbolos. */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[áàäâ]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Distancia de Levenshtein entre dos strings. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const m = a.length;
  const n = b.length;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,        // insertion
        prev[j] + 1,            // deletion
        prev[j - 1] + cost,     // substitution
      );
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/** Ratio de similitud entre dos strings (0 a 1, 1 = idénticos). */
export function similarity(a: string, b: string): number {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (na === nb) return 1;
  if (na.length === 0 || nb.length === 0) return 0;
  const maxLen = Math.max(na.length, nb.length);
  const dist = levenshtein(na, nb);
  return 1 - dist / maxLen;
}

/** Convierte ms epoch a "YYYY-MM-DD" en hora local. */
export function msToDateStr(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Diferencia en días entre dos fechas "YYYY-MM-DD" (positiva si b > a). */
export function daysBetween(dateStrA: string, dateStrB: string): number {
  const a = new Date(dateStrA + "T00:00:00Z").getTime();
  const b = new Date(dateStrB + "T00:00:00Z").getTime();
  return Math.abs(b - a) / (1000 * 60 * 60 * 24);
}

/**
 * Busca la mejor coincidencia de una actividad contra una lista de carreras.
 * Estrategia:
 *   1. Ventana de fecha: ±7 días desde la fecha de la actividad
 *   2. Distancia: ±20% de tolerancia
 *   3. Nombre: similitud >= 0.6 (Levenshtein normalizado)
 *
 * Devuelve el raceId ganador o null.
 */
export function findBestRaceMatch(
  activity: NormalizedActivity,
  candidateRaces: RaceMatchCandidate[],
): string | null {
  const activityDateStr = msToDateStr(activity.startedAt);
  const activityName = activity.name ?? "";
  const activityDistanceM = activity.distanceM;

  let bestScore = 0;
  let bestMatch: RaceMatchCandidate | null = null;

  for (const race of candidateRaces) {
    if (!race.startDate) continue;

    // 1. Ventana de fecha
    const dayDiff = daysBetween(race.startDate, activityDateStr);
    if (dayDiff > 7) continue;

    // 2. Distancia (±20%)
    const raceDistanceM = race.distanceKm * 1000;
    if (raceDistanceM > 0 && activityDistanceM > 0) {
      const distanceRatio = activityDistanceM / raceDistanceM;
      if (distanceRatio < 0.8 || distanceRatio > 1.2) continue;
    }

    // 3. Similitud de nombre
    const nameSim = activityName
      ? similarity(race.name, activityName)
      : 0.3; // si no hay nombre de actividad, no podemos comparar → score bajo

    // Bonus por localidad (si está presente)
    let localityBonus = 0;
    if (race.locality && activity.rawPayload) {
      // No tenemos locality de Strava en el CSV. Sin bonus.
      localityBonus = 0;
    }

    // Score combinado
    const dateScore = 1 - (dayDiff / 7); // 1.0 si mismo día, 0 si 7 días
    const distanceScore = raceDistanceM > 0
      ? 1 - Math.abs(1 - activityDistanceM / raceDistanceM)
      : 0.5;

    const finalScore =
      nameSim * 0.6 +
      dateScore * 0.25 +
      distanceScore * 0.1 +
      localityBonus * 0.05;

    if (finalScore > bestScore && finalScore >= 0.55) {
      bestScore = finalScore;
      bestMatch = race;
    }
  }

  return bestMatch?._id ?? null;
}

// ---------------------------------------------------------------------------
// Detección de PRs
// ---------------------------------------------------------------------------

export interface PRCheckResult {
  isPRCandidate: boolean;
  prDistanceM: number | null;
  isCurrent: boolean;
  timeSeconds: number;
}

export interface CurrentPR {
  distanceM: number;
  timeSeconds: number;
}

/**
 * Dado una actividad y los PRs actuales del usuario, ¿esta actividad bate
 * algún PR?
 */
export function checkForNewPR(
  activity: NormalizedActivity,
  currentPRs: CurrentPR[],
): PRCheckResult {
  const prDistanceM = matchPRDistance(activity.distanceM);
  if (!prDistanceM) {
    return {
      isPRCandidate: false,
      prDistanceM: null,
      isCurrent: false,
      timeSeconds: activity.durationSec,
    };
  }

  // Solo considerar PR si la actividad es de tipo "race" o "long_run"
  // (las tiradas largas no son PRs de 5K/10K, pero pueden ser PRs de
  // media/maratón si matchean)
  const isRaceLike = activity.classifiedType === "race"
    || activity.classifiedType === "long_run"
    || activity.classifiedType === "tempo";

  if (!isRaceLike) {
    return {
      isPRCandidate: false,
      prDistanceM,
      isCurrent: false,
      timeSeconds: activity.durationSec,
    };
  }

  const current = currentPRs.find((p) => p.distanceM === prDistanceM);
  const isCurrent = !current || activity.durationSec < current.timeSeconds;

  return {
    isPRCandidate: true,
    prDistanceM,
    isCurrent,
    timeSeconds: activity.durationSec,
  };
}

// ---------------------------------------------------------------------------
// Parseo del profile.csv
// ---------------------------------------------------------------------------

/** Devuelve los campos del perfil extraídos del profile.csv. */
export function parseStravaProfileRow(row: StravaProfileRow): {
  city?: string;
  weightKg?: number;
  maxHr?: number;
  restHr?: number;
} {
  return {
    city: toString(row["City"]),
    weightKg: toNumber(row["Weight"]),
    maxHr: toNumber(row["Max Heart Rate"]),
    restHr: toNumber(row["Resting Heart Rate"]),
  };
}

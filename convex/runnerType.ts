// =============================================================================
// mi-dorsal — Runner type heuristics
// =============================================================================
// Funciones PURAS que calculan el "tipo de corredor" del usuario a partir de
// sus actividades. Sin ML, sin llamadas a Convex runtime: solo tipos.
//
// Output: { tags: [{ tag, score, reason }] } donde:
//   - tag: identificador del rasgo
//   - score: 0-100 (0 = no aplica, 100 = rasgo dominante)
//   - reason: explicación legible para el modal de auditoría
//
// El usuario puede ver cada score individual y entender por qué le sale
// cada tag. Esto es "honesto con la promesa" de la marca (sin inflar).
// =============================================================================

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface ActivityInput {
  type: "race" | "long_run" | "tempo" | "interval" | "easy" | "recovery" | "trail";
  startedAt: number; // ms epoch
  distanceM: number;
  durationSec: number;
  elevationGainM?: number;
  avgHeartRate?: number;
  avgCadence?: number;
}

export interface RunnerTypeTag {
  tag: string;
  score: number;
  reason: string;
}

export interface RunnerTypeResult {
  tags: RunnerTypeTag[];
  computedAt: number;
}

// Distancias estándar en metros
const FIVE_K = 5000;
const TEN_K = 10000;
const HALF = 21097;
const FULL = 42195;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ---------------------------------------------------------------------------
// Inputs derivados
// ---------------------------------------------------------------------------

export interface DerivedInputs {
  totalActivities: number;
  distanceMedianM: number;
  weeklyVolumeMedianKm: number;
  consistencyPct: number; // 0-1
  avgCadenceSpm: number | null;
  elevationPerKm: number;
  trailRatio: number; // 0-1
  raceRatio: number; // 0-1
  longestRunM: number;
  estimated10KTimeSec: number | null;
  intervalRatio: number; // 0-1
  easyRatio: number; // 0-1
  totalDistanceKm: number;
  weeksActive: number;
  isNewbie: boolean;
  paceVariability: number; // 0-1: qué tan variable es el pace entre actividades
}

/**
 * Calcula todos los inputs derivados a partir de las actividades.
 * Actividades de menos de 3 meses se usan para "isNewbie".
 */
export function deriveInputs(activities: ActivityInput[]): DerivedInputs {
  if (activities.length === 0) {
    return {
      totalActivities: 0,
      distanceMedianM: 0,
      weeklyVolumeMedianKm: 0,
      consistencyPct: 0,
      avgCadenceSpm: null,
      elevationPerKm: 0,
      trailRatio: 0,
      raceRatio: 0,
      longestRunM: 0,
      estimated10KTimeSec: null,
      intervalRatio: 0,
      easyRatio: 0,
      totalDistanceKm: 0,
      weeksActive: 0,
      isNewbie: true,
      paceVariability: 0,
    };
  }

  const runTypes: ActivityInput[] = activities.filter(
    (a) => a.type !== "recovery", // recovery walks distorsionan
  );

  // Distancia mediana
  const distances = runTypes.map((a) => a.distanceM).sort((a, b) => a - b);
  const distanceMedianM = median(distances);

  // Volumen semanal: agrupar por semana ISO y sumar distancias, luego mediana
  const weeklyTotals = new Map<number, number>();
  for (const a of runTypes) {
    const week = isoWeek(new Date(a.startedAt));
    weeklyTotals.set(week, (weeklyTotals.get(week) ?? 0) + a.distanceM / 1000);
  }
  const weeklyVolumeMedianKm = median(Array.from(weeklyTotals.values()));

  // Consistencia: % de días ÚNICOS con actividad sobre el rango total
  if (runTypes.length === 0) {
    return deriveInputs([]); // edge case
  }
  const sortedByDate = [...runTypes].sort((a, b) => a.startedAt - b.startedAt);
  const firstMs = sortedByDate[0].startedAt;
  const lastMs = sortedByDate[sortedByDate.length - 1].startedAt;
  const totalDays = Math.max(1, (lastMs - firstMs) / (24 * 60 * 60 * 1000));
  const uniqueDays = new Set(
    runTypes.map((a) => new Date(a.startedAt).toDateString()),
  ).size;
  const consistencyPct = clamp(uniqueDays / totalDays, 0, 1);

  // Cadencia media (solo easy)
  const easyActivities = runTypes.filter(
    (a) => a.type === "easy" || a.type === "long_run" || a.type === "recovery",
  );
  const cadences = easyActivities
    .map((a) => a.avgCadence)
    .filter((c): c is number => c !== undefined && c > 0);
  const avgCadenceSpm = cadences.length > 0 ? median(cadences) : null;

  // Elevación por km
  const totalElevationM = runTypes.reduce(
    (sum, a) => sum + (a.elevationGainM ?? 0),
    0,
  );
  const totalDistanceKm = runTypes.reduce((sum, a) => sum + a.distanceM / 1000, 0);
  const elevationPerKm = totalDistanceKm > 0 ? totalElevationM / totalDistanceKm : 0;

  // Ratios
  const trailCount = runTypes.filter((a) => a.type === "trail").length;
  const raceCount = runTypes.filter((a) => a.type === "race").length;
  const intervalCount = runTypes.filter((a) => a.type === "interval").length;
  const easyCount = runTypes.filter(
    (a) => a.type === "easy" || a.type === "recovery",
  ).length;
  const trailRatio = trailCount / runTypes.length;
  const raceRatio = raceCount / runTypes.length;
  const intervalRatio = intervalCount / runTypes.length;
  const easyRatio = easyCount / runTypes.length;

  // Longest run
  const longestRunM = Math.max(...runTypes.map((a) => a.distanceM));

  // 10K estimado: mejor actividad entre 9-11 km que NO sea tipo recovery
  const tenKcandidates = runTypes.filter(
    (a) => a.distanceM >= 9000 && a.distanceM <= 11000,
  );
  const estimated10KTimeSec = tenKcandidates.length > 0
    ? Math.min(...tenKcandidates.map((a) => a.durationSec))
    : null;

  // Pace variability: desviación estándar del pace entre todas las actividades
  const paces = runTypes
    .filter((a) => a.distanceM > 0 && a.durationSec > 0)
    .map((a) => a.durationSec / (a.distanceM / 1000));
  let paceVariability = 0;
  if (paces.length > 1) {
    const mean = paces.reduce((s, p) => s + p, 0) / paces.length;
    const variance =
      paces.reduce((s, p) => s + Math.pow(p - mean, 2), 0) / paces.length;
    const stdDev = Math.sqrt(variance);
    // Normalizar: stdDev de 30s/km es mucha variabilidad
    paceVariability = clamp(stdDev / 30, 0, 1);
  }

  // Semanas activas
  const weeksActive = Math.max(1, totalDays / 7);

  // Principiante: < 3 meses y pocas actividades
  const isNewbie = totalDays < 90 && runTypes.length < 30;

  return {
    totalActivities: runTypes.length,
    distanceMedianM,
    weeklyVolumeMedianKm,
    consistencyPct,
    avgCadenceSpm,
    elevationPerKm,
    trailRatio,
    raceRatio,
    longestRunM,
    estimated10KTimeSec,
    intervalRatio,
    easyRatio,
    totalDistanceKm,
    weeksActive,
    isNewbie,
    paceVariability,
  };
}

/** Devuelve el número de semana ISO (1-53) para una fecha. */
function isoWeek(d: Date): number {
  // Copiar la fecha para no mutar
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Jueves de la semana actual define el año ISO
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return date.getUTCFullYear() * 100 + week;
}

// ---------------------------------------------------------------------------
// Heurísticas → tags
// ---------------------------------------------------------------------------

function computeSprinter(inputs: DerivedInputs): RunnerTypeTag {
  if (inputs.distanceMedianM < TEN_K && (inputs.avgCadenceSpm ?? 0) >= 178) {
    return {
      tag: "sprinter",
      score: clamp(100 - (inputs.distanceMedianM - FIVE_K) / (TEN_K - FIVE_K) * 30, 60, 100),
      reason: `Distancia mediana ${(inputs.distanceMedianM / 1000).toFixed(1)} km con cadencia ${Math.round(inputs.avgCadenceSpm ?? 0)} spm`,
    };
  }
  return { tag: "sprinter", score: 0, reason: "Distancias o cadencia no encajan con un perfil sprinter" };
}

function computeFondista(inputs: DerivedInputs): RunnerTypeTag {
  // Fondista: distancia mediana >= 15K, o actividad más larga >= 21K, o muchas tiradas largas
  const hasLongRuns = inputs.distanceMedianM >= 15000;
  const hasHalfInHistory = inputs.longestRunM >= HALF;
  const hasMultipleRaces = inputs.raceRatio >= 0.05 && inputs.longestRunM >= HALF;

  if (hasLongRuns || hasHalfInHistory || hasMultipleRaces) {
    const score = clamp(
      40 +
        (inputs.distanceMedianM >= HALF ? 30 : 15) +
        (inputs.longestRunM >= FULL ? 15 : 0) +
        Math.min(15, inputs.raceRatio * 100),
      40,
      100,
    );
    return {
      tag: "fondista",
      score,
      reason: `Distancia mediana ${(inputs.distanceMedianM / 1000).toFixed(1)} km, actividad más larga ${(inputs.longestRunM / 1000).toFixed(1)} km`,
    };
  }
  return { tag: "fondista", score: 0, reason: "Distancias más cortas que 15 km" };
}

function computeUltra(inputs: DerivedInputs): RunnerTypeTag {
  if (inputs.longestRunM > FULL * 1.05) {
    return {
      tag: "ultra_runner",
      score: clamp(50 + (inputs.longestRunM - FULL) / 1000, 60, 100),
      reason: `Actividad más larga: ${(inputs.longestRunM / 1000).toFixed(1)} km`,
    };
  }
  return { tag: "ultra_runner", score: 0, reason: "Sin actividades por encima de maratón" };
}

function computeTrailProfile(inputs: DerivedInputs): RunnerTypeTag {
  // Trail puro: mayoría trail Y desnivel significativo
  if (inputs.trailRatio >= 0.6 && inputs.elevationPerKm > 10) {
    return {
      tag: "trail_puro",
      score: clamp(65 + inputs.trailRatio * 30, 65, 100),
      reason: `${(inputs.trailRatio * 100).toFixed(0)}% trail, ${inputs.elevationPerKm.toFixed(0)} m desnivel/km`,
    };
  }
  if (inputs.trailRatio < 0.1) {
    return {
      tag: "asfalto_puro",
      score: clamp(80 + (1 - inputs.trailRatio) * 20, 80, 100),
      reason: `${(inputs.trailRatio * 100).toFixed(0)}% trail — predominantemente asfalto`,
    };
  }
  if (inputs.trailRatio >= 0.25) {
    return {
      tag: "mixto",
      score: clamp(60 + (1 - Math.abs(0.5 - inputs.trailRatio) * 2) * 30, 60, 90),
      reason: `${(inputs.trailRatio * 100).toFixed(0)}% trail — mix de asfalto y trail`,
    };
  }
  return { tag: "mixto", score: 0, reason: "Sin perfil claro de terreno" };
}

function computeConsistent(inputs: DerivedInputs): RunnerTypeTag {
  // 4+ días/semana = 4/7 = 0.57
  if (inputs.consistencyPct >= 0.5) {
    return {
      tag: "consistente",
      score: clamp(inputs.consistencyPct * 120, 60, 100),
      reason: `${(inputs.consistencyPct * 100).toFixed(0)}% de días con actividad (4-5 días/semana)`,
    };
  }
  if (inputs.consistencyPct >= 0.3) {
    return {
      tag: "consistente",
      score: clamp(inputs.consistencyPct * 100, 30, 60),
      reason: `${(inputs.consistencyPct * 100).toFixed(0)}% de días con actividad (2-3 días/semana)`,
    };
  }
  return { tag: "consistente", score: 0, reason: "Actividad irregular" };
}

function computeVolume(inputs: DerivedInputs): RunnerTypeTag {
  if (inputs.weeklyVolumeMedianKm >= 50) {
    return {
      tag: "volumen_alto",
      score: clamp(70 + (inputs.weeklyVolumeMedianKm - 50) / 2, 70, 100),
      reason: `${Math.round(inputs.weeklyVolumeMedianKm)} km/semana de promedio`,
    };
  }
  if (inputs.weeklyVolumeMedianKm >= 30) {
    return {
      tag: "volumen_alto",
      score: clamp(40 + (inputs.weeklyVolumeMedianKm - 30), 40, 70),
      reason: `${Math.round(inputs.weeklyVolumeMedianKm)} km/semana de promedio`,
    };
  }
  return { tag: "volumen_alto", score: 0, reason: `Solo ${Math.round(inputs.weeklyVolumeMedianKm)} km/semana` };
}

function computeNewbie(inputs: DerivedInputs): RunnerTypeTag {
  if (inputs.isNewbie) {
    return {
      tag: "principiante",
      score: 100,
      reason: `Menos de 3 meses con ${inputs.totalActivities} actividades`,
    };
  }
  return { tag: "principiante", score: 0, reason: "Más de 3 meses de actividad" };
}

function computeRecuperador(inputs: DerivedInputs): RunnerTypeTag {
  if (inputs.easyRatio > 0.6 && inputs.intervalRatio < 0.05) {
    return {
      tag: "recuperador",
      score: clamp(60 + (inputs.easyRatio - 0.6) * 100, 60, 95),
      reason: `${(inputs.easyRatio * 100).toFixed(0)}% de actividades easy, ${(inputs.intervalRatio * 100).toFixed(0)}% series`,
    };
  }
  return { tag: "recuperador", score: 0, reason: "Mezcla de intensidades" };
}

function computePopular(inputs: DerivedInputs): RunnerTypeTag {
  if (inputs.raceRatio > 0.3) {
    return {
      tag: "corredor_popular",
      score: clamp(50 + inputs.raceRatio * 100, 60, 100),
      reason: `${(inputs.raceRatio * 100).toFixed(0)}% de tus actividades son carreras (${inputs.totalActivities} total)`,
    };
  }
  if (inputs.raceRatio > 0.15) {
    return {
      tag: "corredor_popular",
      score: clamp(40 + inputs.raceRatio * 100, 40, 70),
      reason: `${(inputs.raceRatio * 100).toFixed(0)}% de tus actividades son carreras`,
    };
  }
  return { tag: "corredor_popular", score: 0, reason: "Pocas carreras detectadas" };
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Calcula el tipo de corredor del usuario. Devuelve los tags ordenados
 * por score descendente.
 */
export function computeRunnerType(activities: ActivityInput[]): RunnerTypeResult {
  const inputs = deriveInputs(activities);

  if (inputs.totalActivities < 5) {
    return {
      tags: [
        {
          tag: "principiante",
          score: 100,
          reason: `Solo ${inputs.totalActivities} actividades — sube más para descubrir tu tipo`,
        },
      ],
      computedAt: Date.now(),
    };
  }

  const candidates: RunnerTypeTag[] = [
    computeNewbie(inputs),
    computeSprinter(inputs),
    computeFondista(inputs),
    computeUltra(inputs),
    computeTrailProfile(inputs),
    computeVolume(inputs),
    computeConsistent(inputs),
    computeRecuperador(inputs),
    computePopular(inputs),
  ];

  // Filtrar los que tienen score > 0 y ordenar descendente
  const tags = candidates
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score);

  return { tags, computedAt: Date.now() };
}

// ---------------------------------------------------------------------------
// Helpers de formato
// ---------------------------------------------------------------------------

export function formatPace(secPerKm: number | null | undefined): string {
  if (!secPerKm || !Number.isFinite(secPerKm) || secPerKm <= 0) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

export function formatDistanceKm(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function formatDuration(sec: number): string {
  if (!sec || !Number.isFinite(sec)) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

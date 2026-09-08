// =============================================================================
// lib/training/detect-intervals.ts
// =============================================================================
// Detecta si una actividad de running es un entrenamiento de series/intervalos.
//
// Tres modos de detección, en orden de fiabilidad:
//
//  1. LAPS — si la actividad tiene laps (vueltas a la pista o segmentos
//     automáticos), los usamos. Esta es la señal más fiable y universal:
//     cualquier Garmin en modo "Track Run" los manda, y Strava los crea
//     automáticamente para actividades con auto-lap. Patrón típico de
//     series: N laps cortos (< 500m) con paces similares (las
//     repeticiones) + N laps de recuperación (más largos o más lentos).
//
//  2. SPLITS POR KM — si no hay laps, usamos los splits por km. La
//     variabilidad del pace (CV) y la diferencia absoluta (fastDelta) nos
//     dicen si el ritmo fue alternante. Esta señal es menos precisa
//     porque diluye repeticiones sub-km, pero cubre el caso común de
//     Garmin en modo "Run" (no "Track Run") sin laps.
//
//  3. NOMBRE — patrones universales como "5x1000", "8x400", "Fartlek",
//     "Series", "Track" en el nombre. Esta señal es la más débil (depende
//     de cómo el usuario nombre sus actividades) pero cubre casos donde
//     la actividad no tiene laps y los splits son ambiguos.
//
// Precondición (solo para modo 2 y 3): elevación total ≤ 5m O sport_type
// es TrackRun. Esto evita falsos positivos en rodajes por la calle con
// cuestas/semáforos. Las series en treadmill también pasan (elev=0
// típico).
//
// Función pura, sin dependencias externas.
// =============================================================================

export interface SplitMetric {
  split: number;
  distance: number;
  elapsed_time: number;
  moving_time: number;
  elevation_difference: number;
  average_speed: number;
  average_heartrate?: number;
  average_cadence?: number;
}

export interface LapMetric {
  id?: number;
  name?: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  average_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  lap_index?: number;
  start_index?: number;
}

export interface DetectIntervalsArgs {
  /** Splits por km (de Strava `splits_metric`). */
  splits: SplitMetric[] | null | undefined;
  /** Laps de la actividad (de Strava `laps`). Más fiable que splits. */
  laps?: LapMetric[] | null;
  /** Desnivel total en metros (Strava `total_elevation_gain`). */
  totalElevationGainM?: number | null;
  /** Distancia en metros entre el primer y el último punto GPS (loop). */
  startEndLoopM?: number | null;
  /** Nombre de la actividad (Strava `name`). */
  activityName?: string | null;
  /** sport_type de Strava. */
  sportType?: string | null;
}

export type DetectionConfidence = "high" | "medium" | "low";

export interface DetectedIntervals {
  /** ¿Se ha detectado que la actividad es un entrenamiento de series? */
  isIntervalWorkout: boolean;
  /** Confianza en la detección. "high" = laps claros, "medium" = splits + nombre, "low" = solo señal débil. */
  confidence: DetectionConfidence;
  /** Coeficiente de variación del pace entre splits (0.15 = 15%). */
  paceVariabilityCv: number;
  /** Diferencia absoluta entre el pace más rápido y la media (s/km). */
  fastDeltaSecPerKm: number;
  /** Diferencia absoluta entre el pace más lento y la media (s/km). */
  slowDeltaSecPerKm: number;
  /** Nº de splits/laps "rápidos" (<90% de la media). */
  fastSplits: number;
  /** Nº de splits/laps "lentos" (>110% de la media). */
  slowSplits: number;
  /** Nº estimado de repeticiones (mínimo entre rápidos y lentos). */
  estimatedRepetitions: number;
  /** Ritmo medio de los tramos rápidos en s/km. */
  fastPaceSecPerKm: number | null;
  /** Ritmo medio de los tramos lentos en s/km. */
  slowPaceSecPerKm: number | null;
  /** FC media de los tramos rápidos. */
  fastAvgHrBpm: number | null;
  /** FC media de los tramos lentos. */
  slowAvgHrBpm: number | null;
  /** ¿La actividad parece hecha en una pista? */
  isTrackLike: boolean;
  /** Modo que produjo la detección: "laps" | "splits" | "name" | null. */
  detectionMode: "laps" | "splits" | "name" | null;
  /** Razón textual de la decisión. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Umbrales
// ---------------------------------------------------------------------------

// Pista: una serie en pista es muy plana. El treadmill también (elev=0).
const ELEV_MAX_FOR_TRACK = 5; // metros
const LOOP_MAX_FOR_TRACK = 100; // metros

// Laps: para detectar un patrón de series, miramos al menos 4 laps
// (2 repeticiones + 2 recuperaciones) y un CV > 10%.
const LAP_MIN_COUNT = 4;
const LAP_CV_THRESHOLD = 0.1;

// Splits por km: series multi-rep vs cortas
const CV_RULE_A = 0.12; // 12% — series multi-rep clásicas
const CV_RULE_B = 0.05; // 5% — series cortas 1-2 reps
const FAST_THRESHOLD = 0.9; // split < 90% de la media
const SLOW_THRESHOLD = 1.1; // split > 110% de la media
const FAST_DELTA_RULE_B = 12; // s/km
const MIN_SPLITS = 3; // 3 km mínimo

// Nombre: patrones universales (no específicos de un usuario)
const NAME_PATTERNS: Array<[RegExp, string]> = [
  [/\bserie[s]?\b/i, "palabra 'Series'"],
  [/\bfartlek\b/i, "palabra 'Fartlek'"],
  [/\bintervalo[s]?\b/i, "palabra 'Intervalo(s)'"],
  [/\btrack\b/i, "palabra 'Track'"],
  [/\bcambio[s]?\s+de\s+ritmo\b/i, "cambios de ritmo"],
  [/\bcuestas\s+repetida[s]?\b/i, "cuestas repetidas"],
  [/\brepeats?\b/i, "palabra 'Repeats'"],
  // Patrones universales NxM (5x1000, 8x400) y Nx(...). Excluimos
  // "10k" (que es 10K race, no 10xK) exigiendo que la segunda parte
  // termine en 0 (100, 200, 400, 800, 1000, 1600) o sea un paréntesis.
  [/\b\d+\s*[xX]\s*(100|200|300|400|600|800|1000|1200|1600|2000)\b/, "patrón NxM (5x1000, 8x400)"],
  [/\b\d+\s*[xX]\s*\(/, "patrón Nx(...) (2x(200/100))"],
];

export function detectIntervalsFromSplits(
  args: SplitMetric[] | DetectIntervalsArgs | null | undefined,
): DetectedIntervals {
  // Compatibilidad hacia atrás
  const opts: DetectIntervalsArgs =
    Array.isArray(args) || args === null || args === undefined
      ? { splits: (args as SplitMetric[] | null | undefined) ?? null }
      : (args as DetectIntervalsArgs);

  const splits = opts.splits ?? null;
  const laps = opts.laps ?? null;
  const elev = opts.totalElevationGainM ?? null;
  const loop = opts.startEndLoopM ?? null;
  const name = (opts.activityName ?? "").toLowerCase();
  const sport = (opts.sportType ?? "").toLowerCase();

  const empty: DetectedIntervals = {
    isIntervalWorkout: false,
    confidence: "low",
    paceVariabilityCv: 0,
    fastDeltaSecPerKm: 0,
    slowDeltaSecPerKm: 0,
    fastSplits: 0,
    slowSplits: 0,
    estimatedRepetitions: 0,
    fastPaceSecPerKm: null,
    slowPaceSecPerKm: null,
    fastAvgHrBpm: null,
    slowAvgHrBpm: null,
    isTrackLike: false,
    detectionMode: null,
    reason: "sin datos",
  };

  // 1) Intentar con LAPS primero (más fiable)
  if (laps && laps.length >= LAP_MIN_COUNT) {
    const fromLaps = detectFromLaps(laps);
    if (fromLaps.isIntervalWorkout) {
      return { ...fromLaps, isTrackLike: true, detectionMode: "laps", confidence: "high" };
    }
    // Aunque los laps no parezcan series, devolvemos lo que midió el
    // detector para diagnóstico.
    return { ...fromLaps, isTrackLike: true, detectionMode: "laps" };
  }

  // 2) Precondición de pista para splits (sin laps, no podemos fiarnos
  //    solo del pace: cuesta/semáforo = misma señal que serie)
  const isTrackLike =
    (elev !== null && elev <= ELEV_MAX_FOR_TRACK) ||
    sport === "trackrun";
  if (!isTrackLike) {
    // 3) Última oportunidad: nombre con patrón universal
    const nameHint = detectSeriesFromName(name, sport);
    if (nameHint.likely) {
      return {
        isIntervalWorkout: true,
        confidence: "low",
        paceVariabilityCv: 0,
        fastDeltaSecPerKm: 0,
        slowDeltaSecPerKm: 0,
        fastSplits: 0,
        slowSplits: 0,
        estimatedRepetitions: 0,
        fastPaceSecPerKm: null,
        slowPaceSecPerKm: null,
        fastAvgHrBpm: null,
        slowAvgHrBpm: null,
        isTrackLike: false,
        detectionMode: "name",
        reason: `nombre sugiere serie (${nameHint.matched})`,
      };
    }
    return { ...empty, isTrackLike: false, reason: "no es pista y no hay laps" };
  }

  // 4) Modo splits por km (con precondición de pista)
  if (!splits || splits.length < MIN_SPLITS) {
    // Sin splits suficientes pero el nombre puede dar pista
    const nameHint = detectSeriesFromName(name, sport);
    if (nameHint.likely) {
      return {
        isIntervalWorkout: true,
        confidence: "low",
        paceVariabilityCv: 0,
        fastDeltaSecPerKm: 0,
        slowDeltaSecPerKm: 0,
        fastSplits: 0,
        slowSplits: 0,
        estimatedRepetitions: 0,
        fastPaceSecPerKm: null,
        slowPaceSecPerKm: null,
        fastAvgHrBpm: null,
        slowAvgHrBpm: null,
        isTrackLike: true,
        detectionMode: "name",
        reason: `pista + nombre sugiere serie (${nameHint.matched})`,
      };
    }
    return {
      ...empty,
      isTrackLike: true,
      reason: `solo ${splits?.length ?? 0} splits (mín ${MIN_SPLITS})`,
    };
  }

  // Filtrar splits completos (≥700m) para evitar el tramo final < 1km
  const fullSplits = splits.filter((s) => s.distance >= 700 && s.moving_time > 0);
  if (fullSplits.length < MIN_SPLITS) {
    return {
      ...empty,
      isTrackLike: true,
      reason: `solo ${fullSplits.length} splits completos (≥700m)`,
    };
  }

  const stats = computeVariabilityStats(fullSplits);
  if (!stats) {
    return { ...empty, isTrackLike: true, reason: "no se pudo calcular variabilidad" };
  }

  // Regla A — series multi-rep
  const ruleA =
    stats.cv > CV_RULE_A &&
    stats.fastIndices.length >= 2 &&
    stats.slowIndices.length >= 2;

  // Regla B — series cortas 1-2 reps
  const ruleB =
    stats.fastDelta > FAST_DELTA_RULE_B &&
    stats.minP < stats.mean * 0.95;

  // Regla C — nombre con patrón universal + al menos un poco de variación
  const nameHint = detectSeriesFromName(name, sport);
  const ruleC = nameHint.likely && (stats.cv > 0.02 || stats.fastDelta > 5);

  const isIntervalWorkout = ruleA || ruleB || ruleC;

  return {
    isIntervalWorkout,
    confidence: isIntervalWorkout ? (ruleC && !ruleA && !ruleB ? "low" : ruleA ? "high" : "medium") : "low",
    paceVariabilityCv: Number(stats.cv.toFixed(4)),
    fastDeltaSecPerKm: Math.round(stats.fastDelta),
    slowDeltaSecPerKm: Math.round(stats.slowDelta),
    fastSplits: stats.fastIndices.length,
    slowSplits: stats.slowIndices.length,
    estimatedRepetitions: Math.min(stats.fastIndices.length, stats.slowIndices.length),
    fastPaceSecPerKm: stats.fastIndices.length > 0 ? round1(meanOf(stats.fastIndices.map((i) => stats.paces[i]))) : null,
    slowPaceSecPerKm: stats.slowIndices.length > 0 ? round1(meanOf(stats.slowIndices.map((i) => stats.paces[i]))) : null,
    fastAvgHrBpm: meanHr(fullSplits, stats.fastIndices),
    slowAvgHrBpm: meanHr(fullSplits, stats.slowIndices),
    isTrackLike: true,
    detectionMode: isIntervalWorkout && (ruleA || ruleB) ? "splits" : isIntervalWorkout ? "name" : null,
    reason: isIntervalWorkout
      ? `pista: ${ruleA ? "A(multi-rep)" : ruleB ? "B(corta)" : "C(nombre)"} CV=${(stats.cv * 100).toFixed(0)}%, fast=${stats.fastIndices.length}, slow=${stats.slowIndices.length}, fastDelta=${stats.fastDelta.toFixed(0)}s/km`
      : `pista pero no es serie: CV=${(stats.cv * 100).toFixed(0)}%, fast=${stats.fastIndices.length}, slow=${stats.slowIndices.length}, fastDelta=${stats.fastDelta.toFixed(0)}s/km`,
  };
}

// ---------------------------------------------------------------------------
// Detector por LAPS (modo 1, más fiable)
// ---------------------------------------------------------------------------

function detectFromLaps(laps: LapMetric[]): Omit<DetectedIntervals, "isTrackLike" | "detectionMode"> {
  // Filtrar laps con datos válidos (distance > 0 y moving_time > 0)
  const validLaps = laps.filter((l) => l.distance > 0 && l.moving_time > 0);
  if (validLaps.length < LAP_MIN_COUNT) {
    return baseResult("sin laps", false);
  }

  // Pace por lap en s/km
  const paces = validLaps.map((l) => l.moving_time / (l.distance / 1000));
  const mean = paces.reduce((a, b) => a + b, 0) / paces.length;
  const variance = paces.reduce((s, p) => s + (p - mean) ** 2, 0) / paces.length;
  const cv = Math.sqrt(variance) / mean;
  const minP = Math.min(...paces);
  const maxP = Math.max(...paces);
  const fastDelta = mean - minP;
  const slowDelta = maxP - mean;

  // Clasificar cada lap como rápido / lento
  const fastIndices: number[] = [];
  const slowIndices: number[] = [];
  validLaps.forEach((l, i) => {
    const pace = paces[i];
    if (pace < mean * FAST_THRESHOLD) fastIndices.push(i);
    else if (pace > mean * SLOW_THRESHOLD) slowIndices.push(i);
  });

  // Heurística: si el CV de los laps es alto y hay al menos 2 rápidos
  // + 2 lentos, hay un patrón claro de series. Caso típico: 4x250m +
  // 4x100m de recuperación. Los 4 rápidos son cortos y rápidos, los 4
  // lentos son cortos pero más lentos.
  const isIntervalWorkout = cv > LAP_CV_THRESHOLD && fastIndices.length >= 2 && slowIndices.length >= 2;

  return {
    isIntervalWorkout,
    confidence: isIntervalWorkout ? "high" : "low",
    paceVariabilityCv: Number(cv.toFixed(4)),
    fastDeltaSecPerKm: Math.round(fastDelta),
    slowDeltaSecPerKm: Math.round(slowDelta),
    fastSplits: fastIndices.length,
    slowSplits: slowIndices.length,
    estimatedRepetitions: Math.min(fastIndices.length, slowIndices.length),
    fastPaceSecPerKm: fastIndices.length > 0 ? round1(meanOf(fastIndices.map((i) => paces[i]))) : null,
    slowPaceSecPerKm: slowIndices.length > 0 ? round1(meanOf(slowIndices.map((i) => paces[i]))) : null,
    fastAvgHrBpm: meanHrValidLaps(validLaps, fastIndices),
    slowAvgHrBpm: meanHrValidLaps(validLaps, slowIndices),
    reason: isIntervalWorkout
      ? `laps: ${fastIndices.length} rápidos (${(paces[fastIndices[0]]).toFixed(0)}s/km) + ${slowIndices.length} lentos, CV=${(cv * 100).toFixed(0)}%`
      : `laps: CV=${(cv * 100).toFixed(0)}% < ${LAP_CV_THRESHOLD * 100}% o no hay alternancia clara`,
  };
}

function baseResult(reason: string, isInterval: boolean): Omit<DetectedIntervals, "isTrackLike" | "detectionMode"> {
  return {
    isIntervalWorkout: isInterval,
    confidence: "low",
    paceVariabilityCv: 0,
    fastDeltaSecPerKm: 0,
    slowDeltaSecPerKm: 0,
    fastSplits: 0,
    slowSplits: 0,
    estimatedRepetitions: 0,
    fastPaceSecPerKm: null,
    slowPaceSecPerKm: null,
    fastAvgHrBpm: null,
    slowAvgHrBpm: null,
    reason,
  };
}

// ---------------------------------------------------------------------------
// Stats compartidas (splits)
// ---------------------------------------------------------------------------

interface VariabilityStats {
  paces: number[];
  mean: number;
  minP: number;
  maxP: number;
  cv: number;
  fastDelta: number;
  slowDelta: number;
  fastIndices: number[];
  slowIndices: number[];
}

function computeVariabilityStats(splits: SplitMetric[]): VariabilityStats | null {
  const paces = splits.map((s) => s.moving_time / (s.distance / 1000));
  if (paces.length === 0) return null;
  const mean = paces.reduce((a, b) => a + b, 0) / paces.length;
  if (mean <= 0) return null;
  const variance = paces.reduce((s, p) => s + (p - mean) ** 2, 0) / paces.length;
  const cv = Math.sqrt(variance) / mean;
  const minP = Math.min(...paces);
  const maxP = Math.max(...paces);
  const fastIndices: number[] = [];
  const slowIndices: number[] = [];
  splits.forEach((s, i) => {
    const pace = paces[i];
    if (pace < mean * FAST_THRESHOLD) fastIndices.push(i);
    else if (pace > mean * SLOW_THRESHOLD) slowIndices.push(i);
  });
  return {
    paces,
    mean,
    minP,
    maxP,
    cv,
    fastDelta: mean - minP,
    slowDelta: maxP - mean,
    fastIndices,
    slowIndices,
  };
}

// ---------------------------------------------------------------------------
// Nombre
// ---------------------------------------------------------------------------

function detectSeriesFromName(
  name: string,
  sport: string,
): { likely: boolean; matched: string | null } {
  if (sport === "trackrun") {
    return { likely: true, matched: "sport=TrackRun" };
  }
  if (!name) return { likely: false, matched: null };

  for (const [re, label] of NAME_PATTERNS) {
    if (re.test(name)) {
      return { likely: true, matched: label };
    }
  }
  return { likely: false, matched: null };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function meanOf(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

function round1(v: number): number {
  return Number(v.toFixed(1));
}

function meanHr(splits: SplitMetric[], indices: number[]): number | null {
  const values = indices
    .map((i) => splits[i].average_heartrate)
    .filter((h): h is number => typeof h === "number" && h > 0);
  return values.length === 0 ? null : Math.round(meanOf(values));
}

function meanHrValidLaps(laps: LapMetric[], indices: number[]): number | null {
  const values = indices
    .map((i) => laps[i].average_heartrate)
    .filter((h): h is number => typeof h === "number" && h > 0);
  return values.length === 0 ? null : Math.round(meanOf(values));
}

/**
 * Helper para ingests: detecta si una actividad es un entrenamiento de
 * intervalos, sin tener que construir el objeto de args completo.
 */
export function isIntervalActivity(args: {
  workoutType: number | null | undefined;
  splits: SplitMetric[] | null | undefined;
  laps?: LapMetric[] | null;
  totalElevationGainM?: number | null;
  startEndLoopM?: number | null;
  activityName?: string | null;
  sportType?: string | null;
}): boolean {
  if (args.workoutType === 3) return true;
  return detectIntervalsFromSplits({
    splits: args.splits,
    laps: args.laps,
    totalElevationGainM: args.totalElevationGainM,
    startEndLoopM: args.startEndLoopM,
    activityName: args.activityName,
    sportType: args.sportType,
  }).isIntervalWorkout;
}

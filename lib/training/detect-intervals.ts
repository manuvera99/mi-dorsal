// =============================================================================
// lib/training/detect-intervals.ts
// =============================================================================
// Detecta si una actividad de running es un entrenamiento de series/intervalos
// a partir de los splits por km (splitsMetric), sin depender del campo
// `workout_type` de Strava (que en actividades sincronizadas desde Garmin
// Connect viene siempre como null, aunque el usuario las haya marcado como
// "Intervalo" en su Garmin).
//
// Señal primaria: variabilidad del ritmo (pace) entre splits consecutivos.
// - Rodaje suave: CV < 8% (ritmo muy constante)
// - Rodaje con cambios suaves: CV 8-15%
// - Series/intervalos: CV > 15% + >=2 splits rápidos + >=2 splits lentos
//   alternándose
//
// Por qué NO usamos la FC como señal primaria:
// - La FC tiene lag (~30s), se solapa entre repeticiones consecutivas
// - Un rodaje con calor genera picos de FC sin que el ritmo varíe
// - Un entrenamiento de series bien planteado puede tener FC casi plana
//   si se hace en estado de forma
//
// Solo se usa como apoyo (señal secundaria) para reportar la FC media de
// los tramos rápidos vs lentos.
//
// Función pura, sin dependencias. Testeable y reutilizable.
// =============================================================================

export interface SplitMetric {
  /** Número de split (1, 2, 3, ...). */
  split: number;
  /** Distancia del split en metros. */
  distance: number;
  /** Tiempo total del split en segundos. */
  elapsed_time: number;
  /** Tiempo en movimiento del split en segundos. */
  moving_time: number;
  /** Desnivel del split en metros. */
  elevation_difference: number;
  /** Velocidad media en m/s. */
  average_speed: number;
  /** FC media del split (si está disponible). */
  average_heartrate?: number;
  /** Cadencia media del split (si está disponible). */
  average_cadence?: number;
}

export interface DetectedIntervals {
  /** ¿Se ha detectado que la actividad es un entrenamiento de series? */
  isIntervalWorkout: boolean;
  /** Coeficiente de variación del pace entre splits (0.15 = 15%). */
  paceVariabilityCv: number;
  /** Nº de splits "rápidos" (>10% más rápidos que la media). */
  fastSplits: number;
  /** Nº de splits "lentos" (>10% más lentos que la media). */
  slowSplits: number;
  /** Nº de pares rápido-lento detectados (aprox. nº de repeticiones). */
  estimatedRepetitions: number;
  /** Ritmo medio de los splits rápidos en s/km (si hay >=2). */
  fastPaceSecPerKm: number | null;
  /** Ritmo medio de los splits lentos en s/km (si hay >=2). */
  slowPaceSecPerKm: number | null;
  /** FC media de los splits rápidos (si hay datos). */
  fastAvgHrBpm: number | null;
  /** FC media de los splits lentos (si hay datos). */
  slowAvgHrBpm: number | null;
  /** Razón textual de la decisión (para logs y debugging). */
  reason: string;
}

const FAST_THRESHOLD = 0.9; // 10% más rápido que la media
const SLOW_THRESHOLD = 1.1; // 10% más lento que la media
const CV_THRESHOLD = 0.15; // 15% de variabilidad mínima
const MIN_SPLITS = 6; // descartamos actividades < 6 splits (5K exactos)
const MIN_FAST_SPLITS = 2;
const MIN_SLOW_SPLITS = 2;

export function detectIntervalsFromSplits(
  splits: SplitMetric[] | null | undefined,
): DetectedIntervals {
  const empty: DetectedIntervals = {
    isIntervalWorkout: false,
    paceVariabilityCv: 0,
    fastSplits: 0,
    slowSplits: 0,
    estimatedRepetitions: 0,
    fastPaceSecPerKm: null,
    slowPaceSecPerKm: null,
    fastAvgHrBpm: null,
    slowAvgHrBpm: null,
    reason: "sin splits",
  };

  if (!splits || splits.length < MIN_SPLITS) {
    return { ...empty, reason: `solo ${splits?.length ?? 0} splits (mín ${MIN_SPLITS})` };
  }

  // Pace por split en s/km
  const paces = splits
    .filter((s) => s.distance > 0 && s.moving_time > 0)
    .map((s) => s.moving_time / (s.distance / 1000));

  if (paces.length < MIN_SPLITS) {
    return { ...empty, reason: "splits con datos insuficientes" };
  }

  const mean = paces.reduce((a, b) => a + b, 0) / paces.length;
  const variance = paces.reduce((a, b) => a + (b - mean) ** 2, 0) / paces.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;

  // Splits rápidos / lentos por comparación con la media
  const fastIndices: number[] = [];
  const slowIndices: number[] = [];
  splits.forEach((s, i) => {
    if (s.distance <= 0 || s.moving_time <= 0) return;
    const pace = s.moving_time / (s.distance / 1000);
    if (pace < mean * FAST_THRESHOLD) fastIndices.push(i);
    else if (pace > mean * SLOW_THRESHOLD) slowIndices.push(i);
  });

  // Estimación de repeticiones: mínimo entre rápidos y lentos (un set
  // "5x1000" tiene 5 splits rápidos y 4-5 splits lentos, las repeticiones
  // son min(fast, slow) ≈ 4-5)
  const estimatedRepetitions = Math.min(fastIndices.length, slowIndices.length);

  const fastPaceSecPerKm = fastIndices.length > 0
    ? meanOf(fastIndices.map((i) => splits[i].moving_time / (splits[i].distance / 1000)))
    : null;
  const slowPaceSecPerKm = slowIndices.length > 0
    ? meanOf(slowIndices.map((i) => splits[i].moving_time / (splits[i].distance / 1000)))
    : null;

  const fastHrValues = fastIndices
    .map((i) => splits[i].average_heartrate)
    .filter((h): h is number => typeof h === "number" && h > 0);
  const slowHrValues = slowIndices
    .map((i) => splits[i].average_heartrate)
    .filter((h): h is number => typeof h === "number" && h > 0);

  const fastAvgHrBpm = fastHrValues.length > 0 ? Math.round(meanOf(fastHrValues)) : null;
  const slowAvgHrBpm = slowHrValues.length > 0 ? Math.round(meanOf(slowHrValues)) : null;

  const isIntervalWorkout =
    cv > CV_THRESHOLD &&
    fastIndices.length >= MIN_FAST_SPLITS &&
    slowIndices.length >= MIN_SLOW_SPLITS;

  const reason = isIntervalWorkout
    ? `CV=${(cv * 100).toFixed(0)}% > ${CV_THRESHOLD * 100}%, fast=${fastIndices.length}, slow=${slowIndices.length}`
    : `CV=${(cv * 100).toFixed(0)}% (umbral ${CV_THRESHOLD * 100}%), fast=${fastIndices.length}, slow=${slowIndices.length}`;

  return {
    isIntervalWorkout,
    paceVariabilityCv: Number(cv.toFixed(4)),
    fastSplits: fastIndices.length,
    slowSplits: slowIndices.length,
    estimatedRepetitions,
    fastPaceSecPerKm: fastPaceSecPerKm !== null ? Number(fastPaceSecPerKm.toFixed(1)) : null,
    slowPaceSecPerKm: slowPaceSecPerKm !== null ? Number(slowPaceSecPerKm.toFixed(1)) : null,
    fastAvgHrBpm,
    slowAvgHrBpm,
    reason,
  };
}

function meanOf(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Versión simplificada del detector para usar como helper en
 * `runnerType.deriveInputs`: solo necesitamos saber si la actividad es
 * un entrenamiento de intervalos (true/false) y el tipo. No requiere
 * splits (cae al fallback de `workoutType` de Strava).
 */
export function isIntervalActivity(args: {
  /** Workout type de Strava (3 = interval). 0/null si no hay dato. */
  workoutType: number | null | undefined;
  /** Splits por km de la actividad (puede ser null en indoor/track). */
  splits: SplitMetric[] | null | undefined;
}): boolean {
  // Si Strava ya dice que es interval, nos fiamos.
  if (args.workoutType === 3) return true;
  // Si no, intentamos detectar por splits.
  return detectIntervalsFromSplits(args.splits).isIntervalWorkout;
}

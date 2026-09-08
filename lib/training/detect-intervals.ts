// =============================================================================
// lib/training/detect-intervals.ts
// =============================================================================
// Detecta si una actividad de running es un entrenamiento de series/intervalos.
//
// El campo `workout_type` de Strava (3 = interval) viene NULL cuando el
// usuario sincroniza desde Garmin Connect — Garmin no rellena ese campo. Para
// esos casos (la mayoría en España), tenemos que detectar las series a
// partir de:
//
//  1. La FORMA del recorrido (polyline + start/end + elevación).
//     Una serie en pista de Atletismo tiene 3 señales muy claras:
//       - elev ≈ 0 (las pistas son planas)
//       - start ≈ end (loop < 100m)
//       - ritmo por km claramente alternante
//
//  2. La VARIABILIDAD del pace entre splits (CV + fastDelta en s/km).
//     Series largas tipo "5x1000" tienen CV > 15% y muchos splits rápidos.
//     Series cortas tipo "1x2000" tienen CV bajo (5-10%) pero un split al
//     menos 12-20 s/km más rápido que la media.
//
// Reglas:
//
//  REGLA A — Series clásicas multi-repetición:
//    pista + CV > 12% + ≥2 splits rápidos + ≥2 splits lentos
//
//  REGLA B — Series cortas 1-2 repeticiones:
//    pista + CV > 5% + al menos 1 split con pace < 90% de la media
//    + diferencia absoluta entre el más rápido y la media > 12 s/km
//
//  Si NO es pista (desnivel > 5m o loop > 100m), NO marcamos como serie.
//  Las variaciones de ritmo en un rodaje por la calle (cuestas, semáforos)
//  son indistinguibles de una serie solo con el pace; necesitamos la señal
//  de la pista para no tener falsos positivos.
//
// Función pura (sin dependencias externas), testable.
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

export interface DetectIntervalsArgs {
  /** Splits por km de la actividad. */
  splits: SplitMetric[] | null | undefined;
  /** Desnivel total en metros (Strava `total_elevation_gain`). */
  totalElevationGainM?: number | null;
  /** Distancia en metros entre el primer y el último punto GPS (loop). */
  startEndLoopM?: number | null;
}

export interface DetectedIntervals {
  /** ¿Se ha detectado que la actividad es un entrenamiento de series? */
  isIntervalWorkout: boolean;
  /** Coeficiente de variación del pace entre splits (0.15 = 15%). */
  paceVariabilityCv: number;
  /** Diferencia absoluta entre el pace más rápido y la media (s/km). */
  fastDeltaSecPerKm: number;
  /** Diferencia absoluta entre el pace más lento y la media (s/km). */
  slowDeltaSecPerKm: number;
  /** Nº de splits "rápidos" (<90% de la media). */
  fastSplits: number;
  /** Nº de splits "lentos" (>110% de la media). */
  slowSplits: number;
  /** Nº estimado de repeticiones (mínimo entre rápidos y lentos). */
  estimatedRepetitions: number;
  /** Ritmo medio de los splits rápidos en s/km (si hay >=1). */
  fastPaceSecPerKm: number | null;
  /** Ritmo medio de los splits lentos en s/km (si hay >=1). */
  slowPaceSecPerKm: number | null;
  /** FC media de los splits rápidos (si hay datos). */
  fastAvgHrBpm: number | null;
  /** FC media de los splits lentos (si hay datos). */
  slowAvgHrBpm: number | null;
  /** ¿La actividad parece hecha en una pista de Atletismo? */
  isTrackLike: boolean;
  /** Razón textual de la decisión (para logs y debugging). */
  reason: string;
}

// Umbrales de la pista
const ELEV_MAX_FOR_TRACK = 5; // metros de desnivel total
const LOOP_MAX_FOR_TRACK = 100; // metros entre primer y último punto

// Umbrales de la variabilidad de pace
const CV_RULE_A = 0.12; // 12% — series multi-rep clásicas
const CV_RULE_B = 0.05; // 5% — series cortas 1-2 reps
const FAST_THRESHOLD = 0.9; // split < 90% de la media = "rápido"
const SLOW_THRESHOLD = 1.1; // split > 110% de la media = "lento"
const FAST_DELTA_RULE_B = 12; // s/km — diferencia absoluta mínima
const MIN_SPLITS = 3; // 3 km mínimo para evaluar

export function detectIntervalsFromSplits(
  args: SplitMetric[] | DetectIntervalsArgs | null | undefined,
): DetectedIntervals {
  // Compatibilidad hacia atrás: si nos pasan un array, lo tratamos como solo splits.
  const opts: DetectIntervalsArgs =
    Array.isArray(args) || args === null || args === undefined
      ? { splits: (args as SplitMetric[] | null | undefined) ?? null }
      : (args as DetectIntervalsArgs);

  const splits = opts.splits ?? null;
  const elev = opts.totalElevationGainM ?? null;
  const loop = opts.startEndLoopM ?? null;

  const empty: DetectedIntervals = {
    isIntervalWorkout: false,
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
    reason: "sin datos",
  };

  if (!splits || splits.length < MIN_SPLITS) {
    return {
      ...empty,
      reason: `solo ${splits?.length ?? 0} splits (mín ${MIN_SPLITS})`,
    };
  }

  // Pace por split en s/km (filtra splits vacíos o con datos corruptos)
  const fullSplits = splits.filter((s) => s.distance >= 700 && s.moving_time > 0);
  if (fullSplits.length < MIN_SPLITS) {
    return {
      ...empty,
      reason: `solo ${fullSplits.length} splits completos (≥700m)`,
    };
  }

  const paces = fullSplits.map((s) => s.moving_time / (s.distance / 1000));
  const mean = paces.reduce((a, b) => a + b, 0) / paces.length;
  const minP = Math.min(...paces);
  const maxP = Math.max(...paces);
  const variance = paces.reduce((a, p) => a + (p - mean) ** 2, 0) / paces.length;
  const cv = Math.sqrt(variance) / mean;

  // Splits rápidos / lentos por comparación con la media
  const fastIndices: number[] = [];
  const slowIndices: number[] = [];
  fullSplits.forEach((s, i) => {
    const pace = s.moving_time / (s.distance / 1000);
    if (pace < mean * FAST_THRESHOLD) fastIndices.push(i);
    else if (pace > mean * SLOW_THRESHOLD) slowIndices.push(i);
  });

  // ¿La actividad parece hecha en una pista?
  const isTrackLike =
    elev !== null &&
    loop !== null &&
    elev <= ELEV_MAX_FOR_TRACK &&
    loop <= LOOP_MAX_FOR_TRACK;

  // Si no es pista, no marcamos como serie (falsos positivos por
  // cuestas, semáforos, terreno irregular).
  if (!isTrackLike) {
    return {
      isIntervalWorkout: false,
      paceVariabilityCv: Number(cv.toFixed(4)),
      fastDeltaSecPerKm: Math.round(mean - minP),
      slowDeltaSecPerKm: Math.round(maxP - mean),
      fastSplits: fastIndices.length,
      slowSplits: slowIndices.length,
      estimatedRepetitions: Math.min(fastIndices.length, slowIndices.length),
      fastPaceSecPerKm: fastIndices.length > 0 ? round1(meanOf(fastIndices.map((i) => paces[i]))) : null,
      slowPaceSecPerKm: slowIndices.length > 0 ? round1(meanOf(slowIndices.map((i) => paces[i]))) : null,
      fastAvgHrBpm: meanHr(fullSplits, fastIndices),
      slowAvgHrBpm: meanHr(fullSplits, slowIndices),
      isTrackLike: false,
      reason: `no es pista (elev=${elev ?? "?"}m, loop=${loop ?? "?"}m)`,
    };
  }

  // Es pista: aplicar reglas A y B.
  const fastDelta = mean - minP;
  const slowDelta = maxP - mean;

  const ruleA =
    cv > CV_RULE_A &&
    fastIndices.length >= 2 &&
    slowIndices.length >= 2;

  const ruleB =
    fastDelta > FAST_DELTA_RULE_B &&
    fastIndices.length >= 1;

  const isIntervalWorkout = ruleA || ruleB;

  return {
    isIntervalWorkout,
    paceVariabilityCv: Number(cv.toFixed(4)),
    fastDeltaSecPerKm: Math.round(fastDelta),
    slowDeltaSecPerKm: Math.round(slowDelta),
    fastSplits: fastIndices.length,
    slowSplits: slowIndices.length,
    estimatedRepetitions: Math.min(fastIndices.length, slowIndices.length),
    fastPaceSecPerKm: fastIndices.length > 0 ? round1(meanOf(fastIndices.map((i) => paces[i]))) : null,
    slowPaceSecPerKm: slowIndices.length > 0 ? round1(meanOf(slowIndices.map((i) => paces[i]))) : null,
    fastAvgHrBpm: meanHr(fullSplits, fastIndices),
    slowAvgHrBpm: meanHr(fullSplits, slowIndices),
    isTrackLike: true,
    reason: isIntervalWorkout
      ? `pista: ${ruleA ? "A(multi-rep)" : "B(corta)"} CV=${(cv * 100).toFixed(0)}%, fast=${fastIndices.length}, slow=${slowIndices.length}, fastDelta=${fastDelta.toFixed(0)}s/km`
      : `pista pero no es serie: CV=${(cv * 100).toFixed(0)}%, fast=${fastIndices.length}, slow=${slowIndices.length}, fastDelta=${fastDelta.toFixed(0)}s/km`,
  };
}

function meanOf(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round1(v: number): number {
  return Number(v.toFixed(1));
}

function meanHr(
  splits: SplitMetric[],
  indices: number[],
): number | null {
  const values = indices
    .map((i) => splits[i].average_heartrate)
    .filter((h): h is number => typeof h === "number" && h > 0);
  if (values.length === 0) return null;
  return Math.round(meanOf(values));
}

/**
 * Helper para ingests: detecta si una actividad es un entrenamiento de
 * intervalos, sin tener que construir el objeto de args completo. Usa
 * solo los splits (caso simple) — para máxima precisión en el feed, usa
 * `detectIntervalsFromSplits({splits, totalElevationGainM, startEndLoopM})`.
 */
export function isIntervalActivity(args: {
  workoutType: number | null | undefined;
  splits: SplitMetric[] | null | undefined;
  totalElevationGainM?: number | null;
  startEndLoopM?: number | null;
}): boolean {
  if (args.workoutType === 3) return true;
  return detectIntervalsFromSplits({
    splits: args.splits,
    totalElevationGainM: args.totalElevationGainM,
    startEndLoopM: args.startEndLoopM,
  }).isIntervalWorkout;
}

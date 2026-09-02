// =============================================================================
// mi-dorsal — Daniels VDOT calculation
// =============================================================================
// Implementación del VDOT de Jack Daniels. El VDOT es una métrica que
// combina VO2max y eficiencia running, derivada del rendimiento en carrera.
// =============================================================================

/**
 * Calcula VDOT desde un tiempo de carrera.
 * @param distanceM Distancia en metros
 * @param timeSeconds Tiempo en segundos
 * @returns VDOT (ml/kg/min)
 */
export function calculateVDOT(distanceM: number, timeSeconds: number): number {
  if (distanceM <= 0 || timeSeconds <= 0) {
    throw new Error("Distance and time must be positive");
  }
  // Velocidad en metros por minuto
  const velocity = distanceM / (timeSeconds / 60);
  // VO2 demand (Daniels formula)
  const vo2 = -4.60 + 0.182258 * velocity + 0.000104 * velocity * velocity;
  // %VO2max sostenido
  const pctVo2Max =
    0.8 + 0.1894393 * Math.exp(-0.012778 * (timeSeconds / 60)) +
    0.2989558 * Math.exp(-0.1932605 * (timeSeconds / 60));
  return vo2 / pctVo2Max;
}

/**
 * Predice el tiempo en una distancia objetivo a partir del VDOT.
 * Usa búsqueda binaria sobre la relación tiempo/VDOT.
 * @param vdot VDOT del corredor
 * @param targetDistanceM Distancia objetivo en metros
 * @returns Tiempo estimado en segundos
 */
export function predictTimeFromVDOT(
  vdot: number,
  targetDistanceM: number,
): number {
  // Búsqueda binaria: encontrar tiempo `t` tal que calculateVDOT(target, t) === vdot
  let low = 60; // 1 min
  let high = 36000; // 10 horas
  let mid = 0;
  for (let i = 0; i < 100; i++) {
    mid = (low + high) / 2;
    const vdotAtMid = calculateVDOT(targetDistanceM, mid);
    if (vdotAtMid > vdot) {
      // mid demasiado rápido → necesita más tiempo
      low = mid;
    } else {
      high = mid;
    }
    if (high - low < 0.01) break;
  }
  return Math.round(mid);
}

// =============================================================================
// mi-dorsal — Riegel formula
// =============================================================================
// Fórmula clásica de Pete Riegel para predecir tiempos: T2 = T1 × (D2/D1)^1.06
// Menos precisa que Daniels pero más simple. Usada como fallback.
// =============================================================================

/**
 * Predice el tiempo en una distancia objetivo usando la fórmula de Riegel.
 * @param sourceTimeSeconds Tiempo conocido en segundos
 * @param sourceDistanceM Distancia del tiempo conocido (metros)
 * @param targetDistanceM Distancia objetivo (metros)
 * @returns Tiempo predicho en segundos
 */
export function predictTimeRiegel(
  sourceTimeSeconds: number,
  sourceDistanceM: number,
  targetDistanceM: number,
): number {
  if (sourceDistanceM <= 0 || targetDistanceM <= 0 || sourceTimeSeconds <= 0) {
    throw new Error("Distances and time must be positive");
  }
  const ratio = targetDistanceM / sourceDistanceM;
  return sourceTimeSeconds * Math.pow(ratio, 1.06);
}

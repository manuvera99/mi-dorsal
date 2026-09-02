// =============================================================================
// mi-dorsal — Adjustments for race predictions
// =============================================================================
// Ajustes al tiempo base según perfil, temperatura, etc.
// =============================================================================

import type { RaceType } from "./types";

/**
 * Factor de ajuste por perfil/elevación de la carrera.
 * Plano: 0%, mixta: +2-4%, trail con desnivel: +5-15%.
 */
export function adjustForProfile(
  raceType: RaceType,
  elevationGainM: number | undefined,
  distanceKm: number,
): number {
  if (raceType === "road" || (elevationGainM ?? 0) < 50) {
    return 0; // Plano
  }

  // Para mixtas y trail, calcular según desnivel relativo
  const elevationPerKm = (elevationGainM ?? 0) / distanceKm;
  if (elevationPerKm < 5) {
    return 0.02; // 2% — ligeramente ondulada
  } else if (elevationPerKm < 15) {
    return 0.04; // 4% — mixta
  } else if (elevationPerKm < 30) {
    return 0.08; // 8% — trail moderado
  } else {
    return 0.15; // 15% — trail técnico / montaña
  }
}

/**
 * Factor de ajuste por temperatura esperada en race day.
 * 10-18°C: 0%, 18-25°C: +1-3%, 25-32°C: +3-7%, >32°C: +7-12%.
 */
export function adjustForTemperature(tempC: number | undefined): number {
  if (tempC === undefined) return 0;
  if (tempC < 10) return 0.02; // frío también penaliza un poco
  if (tempC <= 18) return 0; // sweet spot
  if (tempC <= 25) return 0.02;
  if (tempC <= 32) return 0.05;
  return 0.10; // >32°C
}

/**
 * Determina el nivel de confianza basándose en el historial del usuario.
 */
export function calculateConfidence(
  numValidPRs: number,
  numResults: number,
): "low" | "medium" | "high" {
  if (numResults >= 3 && numValidPRs >= 2) return "high";
  if (numResults >= 1 || numValidPRs >= 1) return "medium";
  return "low";
}

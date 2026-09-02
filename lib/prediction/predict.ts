// =============================================================================
// mi-dorsal — Main prediction pipeline
// =============================================================================

import { calculateVDOT, predictTimeFromVDOT } from "./daniels-vdot";
import { predictTimeRiegel } from "./riegel";
import {
  adjustForProfile,
  adjustForTemperature,
  calculateConfidence,
} from "./adjustments";
import type { PredictionInput, PredictionOutput } from "./types";

/**
 * Pipeline principal de predicción.
 * 1. Encuentra el PR más cercano
 * 2. Calcula VDOT desde ese PR
 * 3. Predice tiempo base con Daniels
 * 4. Aplica ajustes (perfil + temperatura)
 * 5. Calcula confianza
 */
export function predictForMyRace(input: PredictionInput): PredictionOutput {
  const { race, userPRs, expectedTempC } = input;
  const targetDistanceM = race.distanceKm * 1000;

  if (userPRs.length === 0) {
    // Sin PRs, no podemos predecir
    throw new Error(
      "Necesitas al menos un PR para predecir. Añade tu marca en 5K, 10K o media maratón.",
    );
  }

  // Encontrar PR más cercano a la distancia objetivo
  const closestPR = userPRs.reduce((closest, pr) =>
    Math.abs(pr.distanceM - targetDistanceM) <
    Math.abs(closest.distanceM - targetDistanceM)
      ? pr
      : closest,
  );

  // Calcular VDOT desde el PR
  const vdot = calculateVDOT(closestPR.distanceM, closestPR.timeSeconds);

  // Predecir tiempo base con Daniels
  let baseTime: number;
  try {
    baseTime = predictTimeFromVDOT(vdot, targetDistanceM);
  } catch (e) {
    // Fallback a Riegel si Daniels falla (distancias muy cortas o largas)
    baseTime = predictTimeRiegel(
      closestPR.timeSeconds,
      closestPR.distanceM,
      targetDistanceM,
    );
  }

  // Ajustes
  const profileAdj = adjustForProfile(
    race.raceType,
    race.elevationGainM,
    race.distanceKm,
  );
  const tempAdj = adjustForTemperature(expectedTempC);

  const factor = 1 + profileAdj + tempAdj;
  const predicted = Math.round(baseTime * factor);

  // Confianza
  const confidence = calculateConfidence(userPRs.length, 0);

  return {
    predictedTimeSeconds: predicted,
    confidence,
    factors: {
      vdot: Math.round(vdot * 10) / 10,
      baseTime: Math.round(baseTime),
      profileAdj: Math.round(profileAdj * 1000) / 1000,
      tempAdj: Math.round(tempAdj * 1000) / 1000,
      sourcePR: {
        distanceM: closestPR.distanceM,
        distanceLabel: closestPR.distanceLabel,
        timeSeconds: closestPR.timeSeconds,
      },
    },
  };
}

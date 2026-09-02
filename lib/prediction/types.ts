// =============================================================================
// mi-dorsal — Prediction types
// =============================================================================

export type RaceType = "road" | "trail" | "mixed" | "obstacle";

export interface PR {
  distanceM: number;
  distanceLabel: string;
  timeSeconds: number;
}

export interface RaceInput {
  distanceKm: number;
  elevationGainM?: number;
  raceType: RaceType;
  startDate?: string;
}

export interface PredictionInput {
  race: RaceInput;
  userPRs: PR[];
  expectedTempC?: number;
}

export interface PredictionOutput {
  predictedTimeSeconds: number;
  confidence: "low" | "medium" | "high";
  factors: {
    vdot: number;
    baseTime: number;
    profileAdj: number;
    tempAdj: number;
    sourcePR?: { distanceM: number; distanceLabel: string; timeSeconds: number };
  };
}

// =============================================================================
// mi-dorsal — Distancia efectiva de un myRace
// =============================================================================
// Una carrera puede tener varias modalidades (race.raceFormats). El usuario
// elige una al añadirla a su calendario (o la cambia después). Esta función
// es la ÚNICA fuente de verdad para "qué distancia hay que usar" en
// predicción, PR, diploma, emails y la card del calendario.
//
// Regla: si myRace.selectedDistanceKm existe, es la elegida por el usuario.
// Si no (carrera sin raceFormats, o myRace creado antes de este cambio),
// cae de vuelta a race.distanceKm — el comportamiento de siempre.
// =============================================================================

export interface EffectiveDistance {
  distanceKm: number;
  label: string;
  elevationGainM?: number;
}

/** Subset de campos de `myRaces` que este helper necesita. */
export interface MyRaceDistanceFields {
  selectedDistanceKm?: number;
  selectedDistanceLabel?: string;
  selectedElevationGainM?: number;
}

/** Subset de campos de `races` que este helper necesita. */
export interface RaceDistanceFields {
  distanceKm: number;
  elevationGainM?: number;
}

/**
 * Etiqueta legible de una distancia en km. Duplica intencionalmente la
 * lógica de `convex/_helpers.ts` `getDistanceLabel` (que trabaja en metros)
 * porque este archivo es código puro sin imports de Convex — se usa desde
 * `lib/prediction/predict.ts` y potencialmente desde componentes cliente.
 */
export function labelForDistanceKm(distanceKm: number): string {
  const m = Math.round(distanceKm * 1000);
  if (m === 5000) return "5K";
  if (m === 10000) return "10K";
  if (m === 15000) return "15K";
  if (m === 21097 || (m > 20000 && m < 22000)) return "Media maratón";
  if (m === 42195 || (m > 40085 && m < 44305)) return "Maratón";
  if (m === 50000 || (m > 47500 && m < 52500)) return "50K";
  return `${distanceKm.toFixed(distanceKm % 1 === 0 ? 0 : 1)}K`;
}

/**
 * Devuelve la distancia que hay que usar para predicción/PR/diploma/pace
 * de un myRace concreto: la que eligió el usuario, o si no eligió ninguna,
 * la distancia principal de la carrera.
 */
export function getEffectiveDistance(
  myRace: MyRaceDistanceFields,
  race: RaceDistanceFields,
): EffectiveDistance {
  if (myRace.selectedDistanceKm != null) {
    return {
      distanceKm: myRace.selectedDistanceKm,
      label: myRace.selectedDistanceLabel ?? labelForDistanceKm(myRace.selectedDistanceKm),
      elevationGainM: myRace.selectedElevationGainM,
    };
  }
  return {
    distanceKm: race.distanceKm,
    label: labelForDistanceKm(race.distanceKm),
    elevationGainM: race.elevationGainM,
  };
}

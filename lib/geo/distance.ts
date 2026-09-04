// =============================================================================
// lib/geo/distance.ts
// =============================================================================
// Fórmula de Haversine para calcular distancia en km entre dos puntos
// (latitud, longitud) en la Tierra.
// =============================================================================

export interface Coords {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371; // radio medio de la Tierra en km

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Distancia en km entre dos puntos (fórmula de Haversine).
 * Precisión: ~0.5% (suficiente para filtrar carreras por proximidad).
 */
export function haversineDistanceKm(a: Coords, b: Coords): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

/**
 * Formatea una distancia en km de forma amigable:
 *  - < 1 km → "850 m"
 *  - < 10 km → "5.2 km"
 *  - >= 10 km → "27 km"
 */
export function formatDistance(km: number): string {
  if (!isFinite(km) || km < 0) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

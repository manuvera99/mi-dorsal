// =============================================================================
// mi-dorsal — Decodificador de Google Polyline Encoding
// =============================================================================
// Strava codifica el track GPS de una actividad (activities.mapPolyline)
// con el algoritmo estándar de Google Polyline Encoding. Lo decodificamos
// a [lat, lng][] y lo normalizamos a un <path> SVG cuadrado para dibujar
// la silueta de la ruta en el editor de sticker — sin librería externa,
// el algoritmo es ~20 líneas.
//
// Referencia del algoritmo:
// https://developers.google.com/maps/documentation/utilities/polylinealgorithm
// =============================================================================

/**
 * Decodifica un string en formato Google Polyline Encoding a una lista de
 * coordenadas [lat, lng]. Precisión estándar (factor 1e5, la que usa Strava).
 */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat * 1e-5, lng * 1e-5]);
  }

  return points;
}

/**
 * Normaliza una lista de puntos [lat, lng] a un <path> SVG cuadrado de
 * lado `viewBoxSize`, centrado y escalado para que la ruta completa quepa
 * dentro del viewBox con un margen del 10%. Usa lng como X y -lat como Y
 * (para que "arriba" en el mapa quede arriba en pantalla).
 *
 * Devuelve "" si no hay puntos suficientes para dibujar una ruta.
 */
export function polylineToSvgPath(
  points: [number, number][],
  viewBoxSize: number,
): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const size = viewBoxSize / 2;
    return `M ${size} ${size} L ${size} ${size}`;
  }

  const lats = points.map((p) => p[0]);
  const lngs = points.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latRange = maxLat - minLat || 1;
  const lngRange = maxLng - minLng || 1;
  const scale = (viewBoxSize * 0.8) / Math.max(latRange, lngRange);
  const margin = viewBoxSize * 0.1;

  const toXY = ([lat, lng]: [number, number]): [number, number] => {
    const x = margin + (lng - minLng) * scale;
    const y = margin + (maxLat - lat) * scale;
    return [x, y];
  };

  const [startX, startY] = toXY(points[0]);
  let d = `M ${startX.toFixed(2)} ${startY.toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    const [x, y] = toXY(points[i]);
    d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
}

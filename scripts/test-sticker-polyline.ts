// =============================================================================
// scripts/test-sticker-polyline.ts
// =============================================================================
// Test del decodificador de Google Polyline Encoding usado por el editor
// de sticker para dibujar la silueta de la ruta GPS.
// =============================================================================

import { decodePolyline, polylineToSvgPath } from "../lib/sticker-editor/polyline";

let failures = 0;

function assertClose(actual: number, expected: number, tolerance: number, label: string) {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    console.log(`  ✗ ${label}: esperado ~${expected}, obtenido ${actual} (diff ${diff})`);
    failures++;
  } else {
    console.log(`  ✓ ${label}: ${actual}`);
  }
}

// Ejemplo oficial de la doc de Google Maps Encoding:
// https://developers.google.com/maps/documentation/utilities/polylinealgorithm
// "_p~iF~ps|U_ulLnnqC_mqNvxq`@" decodifica a:
// [(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)]
console.log("=== decodePolyline: ejemplo oficial de Google ===");
const points = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
console.log("Puntos decodificados:", points);
if (points.length !== 3) {
  console.log(`  ✗ Longitud: esperada 3, obtenida ${points.length}`);
  failures++;
} else {
  console.log(`  ✓ Longitud: 3`);
}
assertClose(points[0][0], 38.5, 0.001, "punto 0 lat");
assertClose(points[0][1], -120.2, 0.001, "punto 0 lng");
assertClose(points[1][0], 40.7, 0.001, "punto 1 lat");
assertClose(points[1][1], -120.95, 0.001, "punto 1 lng");
assertClose(points[2][0], 43.252, 0.001, "punto 2 lat");
assertClose(points[2][1], -126.453, 0.001, "punto 2 lng");

console.log("\n=== decodePolyline: string vacía ===");
const empty = decodePolyline("");
if (empty.length !== 0) {
  console.log(`  ✗ Esperado array vacío, obtenido longitud ${empty.length}`);
  failures++;
} else {
  console.log("  ✓ Array vacío para string vacía");
}

console.log("\n=== polylineToSvgPath: genera un <path> d= no vacío ===");
const svgPath = polylineToSvgPath(points, 200);
console.log("Path:", svgPath);
if (typeof svgPath !== "string" || svgPath.length === 0 || !svgPath.startsWith("M")) {
  console.log(`  ✗ Esperado un path SVG que empiece con "M", obtenido: "${svgPath}"`);
  failures++;
} else {
  console.log("  ✓ Path SVG válido (empieza con M)");
}

console.log("\n=== polylineToSvgPath: con 0 o 1 puntos no rompe ===");
const zeroPoints = polylineToSvgPath([], 200);
const onePoint = polylineToSvgPath([[38.5, -120.2]], 200);
if (zeroPoints !== "") {
  console.log(`  ✗ 0 puntos: esperado "", obtenido "${zeroPoints}"`);
  failures++;
} else {
  console.log("  ✓ 0 puntos → path vacío");
}
if (typeof onePoint !== "string") {
  console.log(`  ✗ 1 punto: esperado string, obtenido ${typeof onePoint}`);
  failures++;
} else {
  console.log("  ✓ 1 punto no rompe");
}

console.log(`\n${failures === 0 ? "✓ TODOS PASAN" : `✗ ${failures} FALLO(S)`}`);
process.exit(failures === 0 ? 0 : 1);

// =============================================================================
// mi-dorsal — Catálogo de campos del editor de sticker
// =============================================================================
// Cada campo (fieldId) representa un dato que el usuario puede mostrar,
// mover y redimensionar en el lienzo del editor. Este módulo NO sabe
// renderizar JSX — solo define metadata (etiqueta, tamaño default) y la
// lógica pura de "¿qué campos tienen dato real para esta carrera?".
// El render visual de cada campo vive en StickerCanvas.tsx (componente
// React), que importa este catálogo para iterar sobre los fieldId activos.
// =============================================================================

export type StickerFieldId =
  | "time"
  | "pace"
  | "position"
  | "positionCategory"
  | "pr"
  | "dorsal"
  | "raceNameDate"
  | "runnerName"
  | "distance"
  | "routeMap";

export interface StickerFieldDef {
  label: string;
  /** Escala default (multiplicador 1.0 = tamaño base definido en StickerCanvas). */
  defaultScale: number;
}

export const FIELD_CATALOG: Record<StickerFieldId, StickerFieldDef> = {
  time: { label: "Tiempo oficial", defaultScale: 1 },
  pace: { label: "Pace", defaultScale: 1 },
  position: { label: "Posición general", defaultScale: 1 },
  positionCategory: { label: "Posición categoría", defaultScale: 1 },
  pr: { label: "Badge Nuevo PR", defaultScale: 1 },
  dorsal: { label: "Dorsal", defaultScale: 1 },
  raceNameDate: { label: "Nombre carrera + fecha", defaultScale: 1 },
  runnerName: { label: "Tu nombre", defaultScale: 1 },
  distance: { label: "Distancia (km)", defaultScale: 1 },
  routeMap: { label: "Silueta de la ruta", defaultScale: 1 },
};

/**
 * Shape común de datos de carrera que el editor necesita para decidir qué
 * campos ofrecer y qué valor renderizar en cada uno. `routeSvgPath` ya
 * viene pre-calculado (ver lib/sticker-editor/polyline.ts) — este módulo
 * no decodifica polylines, solo comprueba si hay algo que mostrar.
 */
export interface StickerData {
  timeFormatted?: string;
  paceFormatted?: string;
  positionOverall?: number;
  totalRunners?: number;
  positionCategory?: number;
  isPersonalRecord?: boolean;
  dorsalNumber?: string;
  raceName?: string;
  raceDate?: string;
  runnerName?: string;
  /** Distancia formateada en km exactos, ej. "21,098km" (coma decimal, 3
   *  decimales, sin redondeo previo) — no la etiqueta corta "10K"/"Media
   *  maratón" que se usa en el resto de la app. */
  distanceLabel?: string;
  routeSvgPath?: string;
}

/**
 * Devuelve la lista de fieldId que tienen dato real para esta carrera.
 * "time" y "pace" se consideran siempre disponibles (son el corazón del
 * sticker); el resto solo se ofrece si hay valor.
 *
 * "pr" es un caso especial: a diferencia de time/dorsal/distance, no
 * renderiza ningún dato dinámico — es un texto fijo ("🎉 Nuevo PR"), así
 * que SIEMPRE está disponible para añadir a mano, igual que time/pace.
 * `isPersonalRecord` solo decide si aparece visible POR DEFECTO al abrir
 * el editor (ver client.tsx) — nunca si el usuario puede añadirlo/
 * quitarlo manualmente. Bloquearlo detrás de isPersonalRecord causaba
 * que, si la detección automática decía "no" por cualquier motivo (ej.
 * una carrera posterior superó ese PR, así que ya no es el "actual"),
 * el usuario no pudiera volver a añadir el badge nunca más tras ocultarlo
 * o borrarlo — aunque supiera que sí fue un PR en su momento.
 */
export function getAvailableFields(data: StickerData): StickerFieldId[] {
  const available: StickerFieldId[] = ["time", "pace", "pr"];
  if (data.positionOverall != null) available.push("position");
  if (data.positionCategory != null) available.push("positionCategory");
  if (data.dorsalNumber) available.push("dorsal");
  if (data.raceName && data.raceDate) available.push("raceNameDate");
  if (data.runnerName) available.push("runnerName");
  if (data.distanceLabel) available.push("distance");
  if (data.routeSvgPath) available.push("routeMap");
  return available;
}

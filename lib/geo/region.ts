/**
 * Mapeo de comunidad autónoma ↔ provincias de España.
 * Single source of truth para todo lo relacionado con regionalización.
 *
 * Usos:
 *  - Detectar la CCAA del usuario vía IP (Vercel headers) → filtrar carreras por cercanía.
 *  - Selector manual de comunidad con persistencia en localStorage.
 *  - Filtros de catálogo agrupados por CCAA.
 *
 * NOTA: Ceuta y Melilla NO son CCAA pero se incluyen como "ciudades autónomas"
 * para que el usuario pueda seleccionarlas. Canarias va aparte por el huso horario.
 */

export type AutonomousCommunity =
  | "andalucia"
  | "aragon"
  | "asturias"
  | "baleares"
  | "canarias"
  | "cantabria"
  | "castilla-la-mancha"
  | "castilla-y-leon"
  | "cataluna"
  | "ceuta"
  | "extremadura"
  | "galicia"
  | "la-rioja"
  | "madrid"
  | "melilla"
  | "murcia"
  | "navarra"
  | "pais-vasco"
  | "valencia";

export interface CommunityInfo {
  id: AutonomousCommunity;
  name: string;            // "Comunidad Valenciana"
  shortName: string;       // "C. Valenciana" (para chips, listas compactas)
  emoji: string;           // ícono sutil (no oficial, pero distintivo)
  provinces: readonly string[]; // slugs de provincia en minúscula
}

export const AUTONOMOUS_COMMUNITIES: readonly CommunityInfo[] = [
  {
    id: "andalucia",
    name: "Andalucía",
    shortName: "Andalucía",
    emoji: "🌴",
    provinces: ["almeria", "granada", "jaen", "malaga", "cordoba", "sevilla", "huelva", "cadiz"],
  },
  {
    id: "aragon",
    name: "Aragón",
    shortName: "Aragón",
    emoji: "🏔️",
    provinces: ["huesca", "zaragoza", "teruel"],
  },
  {
    id: "asturias",
    name: "Principado de Asturias",
    shortName: "Asturias",
    emoji: "🌊",
    provinces: ["asturias"],
  },
  {
    id: "baleares",
    name: "Illes Balears",
    shortName: "Baleares",
    emoji: "🏝️",
    provinces: ["mallorca", "menorca", "ibiza"],
  },
  {
    id: "canarias",
    name: "Canarias",
    shortName: "Canarias",
    emoji: "🌋",
    provinces: ["las palmas", "santa cruz de tenerife"],
  },
  {
    id: "cantabria",
    name: "Cantabria",
    shortName: "Cantabria",
    emoji: "🌊",
    provinces: ["cantabria"],
  },
  {
    id: "castilla-la-mancha",
    name: "Castilla-La Mancha",
    shortName: "Castilla-La Mancha",
    emoji: "🌾",
    provinces: ["albacete", "ciudad real", "cuenca", "guadalajara", "toledo"],
  },
  {
    id: "castilla-y-leon",
    name: "Castilla y León",
    shortName: "Castilla y León",
    emoji: "🏰",
    provinces: [
      "avila", "burgos", "leon", "palencia", "salamanca", "segovia", "soria", "valladolid", "zamora",
    ],
  },
  {
    id: "cataluna",
    name: "Cataluña",
    shortName: "Cataluña",
    emoji: "🟨",
    provinces: ["barcelona", "girona", "tarragona", "lleida"],
  },
  {
    id: "ceuta",
    name: "Ceuta",
    shortName: "Ceuta",
    emoji: "🌊",
    provinces: ["ceuta"],
  },
  {
    id: "extremadura",
    name: "Extremadura",
    shortName: "Extremadura",
    emoji: "🌳",
    provinces: ["caceres", "badajoz"],
  },
  {
    id: "galicia",
    name: "Galicia",
    shortName: "Galicia",
    emoji: "🌧️",
    provinces: ["a coruna", "lugo", "ourense", "pontevedra"],
  },
  {
    id: "la-rioja",
    name: "La Rioja",
    shortName: "La Rioja",
    emoji: "🍷",
    provinces: ["la rioja"],
  },
  {
    id: "madrid",
    name: "Comunidad de Madrid",
    shortName: "Madrid",
    emoji: "🏙️",
    provinces: ["madrid"],
  },
  {
    id: "melilla",
    name: "Melilla",
    shortName: "Melilla",
    emoji: "🌊",
    provinces: ["melilla"],
  },
  {
    id: "murcia",
    name: "Región de Murcia",
    shortName: "Murcia",
    emoji: "🌞",
    provinces: ["murcia"],
  },
  {
    id: "navarra",
    name: "Comunidad Foral de Navarra",
    shortName: "Navarra",
    emoji: "🐂",
    provinces: ["navarra"],
  },
  {
    id: "pais-vasco",
    name: "País Vasco",
    shortName: "País Vasco",
    emoji: "🟢",
    provinces: ["vizcaya", "gipuzkoa", "alava"],
  },
  {
    id: "valencia",
    name: "Comunitat Valenciana",
    shortName: "C. Valenciana",
    emoji: "🍊",
    provinces: ["alicante", "valencia", "castellon"],
  },
] as const;

/**
 * Diccionario rápido: id de CCAA → CommunityInfo.
 */
const BY_ID: Record<string, CommunityInfo> = Object.fromEntries(
  AUTONOMOUS_COMMUNITIES.map((c) => [c.id, c])
);

/**
 * Mapa inverso: provincia (slug lowercase) → CCAA.
 * Usado cuando el endpoint de geo nos devuelve una provincia, o cuando
 * el usuario selecciona manualmente una provincia.
 */
const PROVINCE_TO_COMMUNITY: Record<string, AutonomousCommunity> = (() => {
  const map: Record<string, AutonomousCommunity> = {};
  for (const c of AUTONOMOUS_COMMUNITIES) {
    for (const p of c.provinces) {
      map[p.toLowerCase().trim()] = c.id;
    }
  }
  return map;
})();

/**
 * Devuelve la CCAA a partir de un slug de provincia.
 * Si no encuentra, devuelve null.
 */
export function getCommunityByProvince(province: string | null | undefined): CommunityInfo | null {
  if (!province) return null;
  const id = PROVINCE_TO_COMMUNITY[province.toLowerCase().trim()];
  return id ? BY_ID[id] ?? null : null;
}

/**
 * Devuelve la CCAA por id.
 */
export function getCommunityById(id: string | null | undefined): CommunityInfo | null {
  if (!id) return null;
  return BY_ID[id] ?? null;
}

/**
 * Lista las provincias de una CCAA.
 */
export function getProvincesInCommunity(id: AutonomousCommunity): readonly string[] {
  return BY_ID[id]?.provinces ?? [];
}

/**
 * Tipo flexible que acepta tanto id de CCAA como nombre, slug, etc.
 * Útil en endpoints que reciben datos variables (Vercel headers, etc).
 */
export function detectCommunityFromString(input: string | null | undefined): CommunityInfo | null {
  if (!input) return null;
  const norm = input
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // 1) match por id
  if (BY_ID[norm]) return BY_ID[norm];
  // 2) match por nombre normalizado (sin tildes)
  for (const c of AUTONOMOUS_COMMUNITIES) {
    const nameNorm = c.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (nameNorm === norm) return c;
  }
  // 3) match por provincia (Madrid → Madrid, etc)
  return getCommunityByProvince(norm);
}

// =============================================================================
// mi-dorsal — lib utils
// =============================================================================

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number | null | undefined): string {
  if (!seconds && seconds !== 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function formatProvince(province: string): string {
  const map: Record<string, string> = {
    alicante: "Alicante",
    valencia: "Valencia",
    castellon: "Castellón",
    murcia: "Murcia",
    albacete: "Albacete",
    almeria: "Almería",
  };
  return map[province] ?? province;
}

export function formatRaceType(type: string): string {
  const map: Record<string, string> = {
    road: "Asfalto",
    trail: "Trail",
    mixed: "Mixta",
    obstacle: "Obstáculos",
  };
  return map[type] ?? type;
}

export const PROVINCE_LIST = [
  { value: "alicante", label: "Alicante" },
  { value: "valencia", label: "Valencia" },
  { value: "castellon", label: "Castellón" },
  { value: "murcia", label: "Murcia" },
  { value: "albacete", label: "Albacete" },
  { value: "ciudad real", label: "Ciudad Real" },
  { value: "cuenca", label: "Cuenca" },
  { value: "guadalajara", label: "Guadalajara" },
  { value: "toledo", label: "Toledo" },
  { value: "almeria", label: "Almería" },
  { value: "granada", label: "Granada" },
  { value: "jaen", label: "Jaén" },
  { value: "malaga", label: "Málaga" },
  { value: "cordoba", label: "Córdoba" },
  { value: "sevilla", label: "Sevilla" },
  { value: "huelva", label: "Huelva" },
  { value: "cadiz", label: "Cádiz" },
  { value: "huesca", label: "Huesca" },
  { value: "zaragoza", label: "Zaragoza" },
  { value: "teruel", label: "Teruel" },
  { value: "barcelona", label: "Barcelona" },
  { value: "girona", label: "Girona" },
  { value: "tarragona", label: "Tarragona" },
  { value: "lleida", label: "Lleida" },
  { value: "mallorca", label: "Mallorca" },
  { value: "menorca", label: "Menorca" },
  { value: "ibiza", label: "Ibiza" },
  { value: "las palmas", label: "Las Palmas" },
  { value: "santa cruz de tenerife", label: "Santa Cruz de Tenerife" },
  { value: "madrid", label: "Madrid" },
  { value: "vizcaya", label: "Vizcaya" },
  { value: "gipuzkoa", label: "Gipuzkoa" },
  { value: "alava", label: "Álava" },
  { value: "navarra", label: "Navarra" },
  { value: "asturias", label: "Asturias" },
  { value: "cantabria", label: "Cantabria" },
  { value: "a coruna", label: "A Coruña" },
  { value: "lugo", label: "Lugo" },
  { value: "ourense", label: "Ourense" },
  { value: "pontevedra", label: "Pontevedra" },
  { value: "la rioja", label: "La Rioja" },
  { value: "caceres", label: "Cáceres" },
  { value: "badajoz", label: "Badajoz" },
  { value: "leon", label: "León" },
  { value: "zamora", label: "Zamora" },
  { value: "salamanca", label: "Salamanca" },
  { value: "valladolid", label: "Valladolid" },
  { value: "palencia", label: "Palencia" },
  { value: "burgos", label: "Burgos" },
  { value: "soria", label: "Soria" },
  { value: "avila", label: "Ávila" },
  { value: "segovia", label: "Segovia" },
  { value: "ceuta", label: "Ceuta" },
  { value: "melilla", label: "Melilla" },
] as const;

export const MONTH_LIST = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const RACE_TYPE_LIST = [
  { value: "road", label: "Asfalto" },
  { value: "trail", label: "Trail" },
  { value: "mixed", label: "Mixta" },
  { value: "obstacle", label: "Obstáculos" },
] as const;

// =============================================================================
// DISTANCE CATEGORIES — clasificación estándar de carreras por distancia
// =============================================================================
// Usado en filtros y en race-card. Una carrera puede caer en 0, 1 o 2
// categorías adyacentes (p.ej. una 12K es "10K" y "15K" a la vez).
// =============================================================================

export type DistanceCategory =
  | "5k"
  | "10k"
  | "15k"
  | "half_marathon"
  | "marathon"
  | "ultra";

export const DISTANCE_CATEGORY_LIST: Array<{ value: DistanceCategory; label: string; min: number; max: number }> = [
  { value: "5k",            label: "5K",            min: 0,    max: 7.5   },
  { value: "10k",           label: "10K",           min: 7.5,  max: 12.5  },
  { value: "15k",           label: "15K",           min: 12.5, max: 17.5  },
  { value: "half_marathon", label: "Media maratón", min: 17.5, max: 23   },
  { value: "marathon",      label: "Maratón",       min: 40,   max: 44   },
  { value: "ultra",         label: "Ultra (>44K)",  min: 44,   max: 9999 },
];

/**
 * Devuelve todas las categorías en las que cae una distancia dada.
 * Ejemplos:
 *   distanceToCategories(5)   -> ["5k"]
 *   distanceToCategories(10)  -> ["10k"]
 *   distanceToCategories(12)  -> ["10k", "15k"]    (entre dos categorías)
 *   distanceToCategories(21)  -> ["half_marathon"]
 *   distanceToCategories(42)  -> ["marathon"]
 *   distanceToCategories(50)  -> ["ultra"]
 *   distanceToCategories(0)   -> []
 *   distanceToCategories(2.5) -> ["5k"]
 */
export function distanceToCategories(distanceKm: number): DistanceCategory[] {
  if (typeof distanceKm !== "number" || distanceKm <= 0) return [];
  const out: DistanceCategory[] = [];
  for (const c of DISTANCE_CATEGORY_LIST) {
    if (distanceKm >= c.min && distanceKm < c.max) {
      out.push(c.value);
    }
  }
  return out;
}

/**
 * Inversa: filtra una lista de carreras devolviendo solo las que caen
 * en al menos una de las categorías seleccionadas.
 */
export function filterByDistanceCategories<T extends { distanceKm: number }>(
  races: T[],
  categories: DistanceCategory[],
): T[] {
  if (categories.length === 0) return races;
  return races.filter((r) => {
    const cats = distanceToCategories(r.distanceKm);
    return cats.some((c) => categories.includes(c));
  });
}

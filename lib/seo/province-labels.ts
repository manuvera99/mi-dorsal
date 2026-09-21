// =============================================================================
// lib/seo/province-labels.ts
// =============================================================================
// Diccionario label → slug de provincias. Vive en lib/ (no en convex/) para
// que pueda ser importado desde app/ sin meter dependencias de Convex en el
// bundle del cliente / server-component de Next.
//
// IMPORTANTE: si añades una provincia nueva al schema de races, debes
// añadirla también aquí. El slug (key) debe coincidir con el literal del
// union en convex/schema.ts.
// =============================================================================

export const provinceLabels: Record<string, string> = {
  "alicante": "Alicante",
  "valencia": "Valencia",
  "castellon": "Castellón",
  "murcia": "Murcia",
  "albacete": "Albacete",
  "ciudad real": "Ciudad Real",
  "cuenca": "Cuenca",
  "guadalajara": "Guadalajara",
  "toledo": "Toledo",
  "almeria": "Almería",
  "granada": "Granada",
  "jaen": "Jaén",
  "malaga": "Málaga",
  "cordoba": "Córdoba",
  "sevilla": "Sevilla",
  "huelva": "Huelva",
  "cadiz": "Cádiz",
  "huesca": "Huesca",
  "zaragoza": "Zaragoza",
  "teruel": "Teruel",
  "barcelona": "Barcelona",
  "girona": "Girona",
  "tarragona": "Tarragona",
  "lleida": "Lleida",
  "mallorca": "Mallorca",
  "menorca": "Menorca",
  "ibiza": "Ibiza",
  "las palmas": "Las Palmas",
  "santa cruz de tenerife": "Santa Cruz de Tenerife",
  "madrid": "Madrid",
  "vizcaya": "Bizkaia",
  "gipuzkoa": "Gipuzkoa",
  "alava": "Álava",
  "navarra": "Navarra",
  "asturias": "Asturias",
  "cantabria": "Cantabria",
  "a coruna": "A Coruña",
  "lugo": "Lugo",
  "ourense": "Ourense",
  "pontevedra": "Pontevedra",
  "la rioja": "La Rioja",
  "caceres": "Cáceres",
  "badajoz": "Badajoz",
  "leon": "León",
  "zamora": "Zamora",
  "salamanca": "Salamanca",
  "valladolid": "Valladolid",
  "palencia": "Palencia",
  "burgos": "Burgos",
  "soria": "Soria",
  "avila": "Ávila",
  "segovia": "Segovia",
  "ceuta": "Ceuta",
  "melilla": "Melilla",
};

export type ProvinceSlug = keyof typeof provinceLabels;

export function isProvinceSlug(k: string): k is ProvinceSlug {
  return Object.prototype.hasOwnProperty.call(provinceLabels, k);
}

export const distanceLabels: Record<string, string> = {
  "5k": "5K",
  "10k": "10K",
  "media-maraton": "Media maratón",
  "maraton": "Maratón",
  "trail": "Trail",
  "ultra": "Ultramaratón",
};

export type DistanceSlug = keyof typeof distanceLabels;

export const distanceSlugs: DistanceSlug[] = Object.keys(
  distanceLabels,
) as DistanceSlug[];

export function isDistanceSlug(k: string): k is DistanceSlug {
  return Object.prototype.hasOwnProperty.call(distanceLabels, k);
}
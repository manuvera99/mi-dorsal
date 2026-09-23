// =============================================================================
// mi-dorsal — Convex helpers
// =============================================================================

import { v } from "convex/values";
import { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"profiles">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized: no user identity");
  }
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
    .unique();
  if (!profile) {
    throw new Error(`Profile not found for clerkUserId ${identity.subject}`);
  }
  return profile;
}

export async function getOptionalUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"profiles"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("profiles")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
    .unique();
}

export async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"profiles">> {
  const profile = await requireUser(ctx);
  if (profile.role !== "admin") {
    throw new Error("Forbidden: requiere rol admin");
  }
  return profile;
}

export async function isAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<boolean> {
  const profile = await getOptionalUser(ctx);
  return profile?.role === "admin";
}

/** ¿El usuario actual tiene rol admin o test?
 *  - admin: bypass total de paywall y rate limits (uso interno).
 *  - test:  usuario beta-tester marcado a mano por Manu. Mismo bypass
 *           que admin para poder probar features premium en producción
 *           sin tener que suscribirse. NO confundir con user normal.
 *  Usar para feature gating donde se quiere bypass completo, o para
 *  rate limits donde el límite es 0 (ilimitado). */
export async function isAdminOrTest(
  ctx: QueryCtx | MutationCtx,
): Promise<boolean> {
  const profile = await getOptionalUser(ctx);
  return profile?.role === "admin" || profile?.role === "test";
}

/**
 * ¿Este profile puede editar datos del catálogo (carreras, blogs, etc.)?
 *
 * Hoy: solo role="admin". 'test' NO edita catálogo (es para bypass de paywall
 * en features premium, no para crear contenido).
 *
 * Función pura (sin ctx) para poder usarla desde el cliente también
 * (p.ej. para mostrar/ocultar botones "Editar" en la ficha de carrera).
 *
 * Si tienes un Doc<"profiles">, pásalo directo. Si tienes el role suelto
 * (caso típico en el cliente tras `getMyProfile`), acepta también un role opcional.
 */
export function canEditRace(
  profile: { role?: "user" | "admin" | "test" } | null | undefined,
): boolean {
  return profile?.role === "admin";
}

export function assertOwner<T extends { userId: Id<"profiles"> }>(
  resource: T | null,
  userId: Id<"profiles">,
  resourceName: string,
): asserts resource is T {
  if (!resource) {
    throw new Error(`${resourceName} not found`);
  }
  if (resource.userId !== userId) {
    throw new Error(`Forbidden: ${resourceName} belongs to another user`);
  }
}

// ---------------------------------------------------------------------------
// Validators reusables
// ---------------------------------------------------------------------------

export const provinceValidator = v.union(
  // C. Valenciana
  v.literal("alicante"),
  v.literal("valencia"),
  v.literal("castellon"),
  // Murcia
  v.literal("murcia"),
  // Castilla-La Mancha
  v.literal("albacete"),
  v.literal("ciudad real"),
  v.literal("cuenca"),
  v.literal("guadalajara"),
  v.literal("toledo"),
  // Andalucía
  v.literal("almeria"),
  v.literal("granada"),
  v.literal("jaen"),
  v.literal("malaga"),
  v.literal("cordoba"),
  v.literal("sevilla"),
  v.literal("huelva"),
  v.literal("cadiz"),
  // Aragón
  v.literal("huesca"),
  v.literal("zaragoza"),
  v.literal("teruel"),
  // Cataluña
  v.literal("barcelona"),
  v.literal("girona"),
  v.literal("tarragona"),
  v.literal("lleida"),
  // Baleares
  v.literal("mallorca"),
  v.literal("menorca"),
  v.literal("ibiza"),
  // Canarias
  v.literal("las palmas"),
  v.literal("santa cruz de tenerife"),
  // Madrid
  v.literal("madrid"),
  // País Vasco
  v.literal("vizcaya"),
  v.literal("gipuzkoa"),
  v.literal("alava"),
  // Navarra
  v.literal("navarra"),
  // Asturias
  v.literal("asturias"),
  // Cantabria
  v.literal("cantabria"),
  // Galicia
  v.literal("a coruna"),
  v.literal("lugo"),
  v.literal("ourense"),
  v.literal("pontevedra"),
  // La Rioja
  v.literal("la rioja"),
  // Extremadura
  v.literal("caceres"),
  v.literal("badajoz"),
  // Castilla y León
  v.literal("leon"),
  v.literal("zamora"),
  v.literal("salamanca"),
  v.literal("valladolid"),
  v.literal("palencia"),
  v.literal("burgos"),
  v.literal("soria"),
  v.literal("avila"),
  v.literal("segovia"),
  // Ceuta y Melilla
  v.literal("ceuta"),
  v.literal("melilla"),
);

export const raceTypeValidator = v.union(
  v.literal("road"),
  v.literal("trail"),
  v.literal("mixed"),
  v.literal("obstacle"),
);

export const raceStatusValidator = v.union(
  v.literal("planned"),
  v.literal("done"),
  v.literal("dns"),
  v.literal("dnf"),
);

export const predictionConfidenceValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
);

// ---------------------------------------------------------------------------
// Reusable queries
// ---------------------------------------------------------------------------

export async function getCurrentPR(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"profiles">,
  distanceM: number,
): Promise<Doc<"personalRecords"> | null> {
  return await ctx.db
    .query("personalRecords")
    .withIndex("by_user_distance_current", (q) =>
      q.eq("userId", userId).eq("distanceM", distanceM).eq("isCurrent", true),
    )
    .unique();
}

export async function findClosestPR(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"profiles">,
  targetDistanceM: number,
): Promise<Doc<"personalRecords"> | null> {
  const all = await ctx.db
    .query("personalRecords")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("isCurrent"), true))
    .collect();
  if (all.length === 0) return null;
  return all.reduce((closest, pr) =>
    Math.abs(pr.distanceM - targetDistanceM) <
    Math.abs(closest.distanceM - targetDistanceM)
      ? pr
      : closest,
  );
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Etiqueta legible de una distancia. Las bandas de tolerancia (±5%) deben
 * coincidir con PR_DISTANCES_M en convex/activities/normalize.ts — mismo
 * criterio, duplicado aquí porque normalize.ts es intencionalmente "puro"
 * (sin importar nada de fuera) y este helper lo usan mutations de Convex.
 */
export function getDistanceLabel(distanceM: number): string {
  if (distanceM === 5000) return "5K";
  if (distanceM === 10000) return "10K";
  if (distanceM === 15000) return "15K";
  if (distanceM === 21097 || (distanceM > 20000 && distanceM < 22000))
    return "Media maratón";
  if (distanceM === 42195 || (distanceM > 40085 && distanceM < 44305))
    return "Maratón";
  if (distanceM === 50000 || (distanceM > 47500 && distanceM < 52500))
    return "50K";
  if (distanceM === 80467 || (distanceM > 76444 && distanceM < 84490))
    return "50 millas";
  if (distanceM === 100000 || (distanceM > 95000 && distanceM < 105000))
    return "100K";
  if (distanceM === 160934 || (distanceM > 152887 && distanceM < 168981))
    return "100 millas";
  return `${(distanceM / 1000).toFixed(1)}K`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[áàäâ]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// Validación geo: coherencia provincia ↔ coordenadas
// ---------------------------------------------------------------------------
//
// Bug encontrado 2026-09-17: el deep-extract de IA asignó a la carrera
// FEDME "Gomera Paradise Trail" (provincia santa cruz de tenerife) las
// coordenadas de la sede de la FEDME en Valencia (39.46, -0.40). El
// resultado: un usuario en Alicante veía la carrera a "125 km de ti" en
// lugar de los ~1.900 km reales. Mismo patrón con sportmaniacs (su oficina
// devuelve Elche como fallback para carreras insulares) y con varias
// carreras mal asignadas a provincias continentales.
//
// Esta función valida que, si tenemos los 3 datos (lat, lng, province),
// la combinación sea geográficamente plausible. Si falta alguno, no
// podemos validar — el caller puede haber venido con solo lat/lng
// (todavía sin provincia) o solo con provincia. El bbox "España entera"
// sigue siendo la primera red de seguridad para detectar carreras
// claramente fuera del país (Guatemala, México, Polonia: 212 carreras
// filtradas en producción el 2026-09-12).

/**
 * Bounding box por provincia. Cobertura:
 *  - Islas: bbox dedicado (Canarias, Baleares, Ceuta, Melilla).
 *  - Ceuta/Melilla + islas, todas las coords legítimas caen dentro de su bbox.
 *  - Provincias peninsulares: NO tienen bbox aquí (España continental ya
 *    filtra lo obvio, y los bboxes peninsulares se solapan entre CCAA).
 *
 * Coords basadas en los husos reales (IGN/CNIG): cada isla tiene su
 * extensión concreta. Si una carrera está en un islote (Alborán,
 * Columbretes, etc.), cae en bbox "las palmas"/"melilla" por proximidad
 * administrativa.
 */
const PROVINCE_BBOX: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  // Canarias: cubren todas las islas de cada provincia
  "las palmas":              { minLat: 27.5, maxLat: 29.5, minLng: -16.0, maxLng: -13.0 }, // Gran Canaria + Fuerteventura + Lanzarote
  "santa cruz de tenerife":  { minLat: 27.5, maxLat: 29.5, minLng: -18.5, maxLng: -16.0 }, // Tenerife + La Gomera + La Palma + El Hierro
  // Baleares
  "mallorca":                { minLat: 39.0, maxLat: 40.5, minLng:  2.3, maxLng:  3.5 },
  "menorca":                 { minLat: 39.5, maxLat: 40.5, minLng:  3.8, maxLng:  4.5 },
  "ibiza":                   { minLat: 38.4, maxLat: 39.2, minLng:  1.0, maxLng:  1.8 }, // Ibiza + Formentera
  // Ceuta y Melilla
  "ceuta":                   { minLat: 35.5, maxLat: 36.0, minLng: -5.5, maxLng: -5.0 },
  "melilla":                { minLat: 35.2, maxLat: 35.8, minLng: -3.2, maxLng: -2.5 },
};

/**
 * Bbox coarse de España peninsular + islas. Mantenido por compatibilidad y
 * como primera red de seguridad para carreras claramente fuera del país.
 * (2026-09-12: 212 carreras de Guatemala/México/Polonia/etc. fueron
 * filtradas con este mismo bbox en systemUpsert.)
 */
export const SPAIN_BBOX = { minLat: 27.5, maxLat: 44.0, minLng: -18.5, maxLng: 4.5 };

/**
 * Valida que (lat, lng, province) sean coherentes. Lanza Error si:
 *  - lat/lng caen fuera del bbox España entero, o
 *  - la provincia tiene bbox dedicado y lat/lng caen fuera de él.
 *
 * Si falta alguno de los 3 datos, la función es no-op (no podemos validar).
 *
 * Uso típico desde una mutation:
 *   const effectiveLat  = patch.latitude  ?? existing.latitude;
 *   const effectiveLng  = patch.longitude ?? existing.longitude;
 *   const effectiveProv = patch.province  ?? existing.province;
 *   validateRaceGeo(effectiveLat, effectiveLng, effectiveProv, raceName);
 */
export function validateRaceGeo(
  lat: number | null | undefined,
  lng: number | null | undefined,
  province: string | null | undefined,
  raceName?: string,
): void {
  if (typeof lat !== "number" || typeof lng !== "number" || !province) return;

  // Red 1: bbox España entera (carreras claramente fuera del país)
  if (
    lat < SPAIN_BBOX.minLat || lat > SPAIN_BBOX.maxLat ||
    lng < SPAIN_BBOX.minLng || lng > SPAIN_BBOX.maxLng
  ) {
    const tag = raceName ? ` para "${raceName}"` : "";
    throw new Error(
      `Coordenadas (${lat}, ${lng}) fuera del territorio español${tag} (provincia declarada: "${province}"). `
      + `España bbox: lat ${SPAIN_BBOX.minLat}–${SPAIN_BBOX.maxLat}, lng ${SPAIN_BBOX.minLng}–${SPAIN_BBOX.maxLng}.`,
    );
  }

  // Red 2: bbox por provincia (para islas/ceuta/melilla; provincias
  // peninsulares no entran aquí y se quedan solo con la red 1).
  const bbox = PROVINCE_BBOX[province.toLowerCase()];
  if (bbox) {
    if (
      lat < bbox.minLat || lat > bbox.maxLat ||
      lng < bbox.minLng || lng > bbox.maxLng
    ) {
      const tag = raceName ? ` "${raceName}"` : "";
      throw new Error(
        `Coordenadas (${lat.toFixed(4)}, ${lng.toFixed(4)}) no cuadran con la provincia "${province}"${tag}. `
        + `Esperado: lat ${bbox.minLat}–${bbox.maxLat}, lng ${bbox.minLng}–${bbox.maxLng}.`,
      );
    }
  }
}

/**
 * Normaliza un texto para comparaciones de búsqueda "amables":
 * minúsculas + sin diacríticos (á→a, ñ→n, é→e, ç→c, etc.).
 *
 * Usada por las queries públicas (`list`) y admin (`adminList`) del módulo
 * de carreras para que el buscador sea insensible a mayúsculas y tildes.
 *
 * El módulo Convex está deliberadamente aislado de `lib/` (ver
 * `convex/races.ts` línea ~28 sobre la duplicación intencionada de
 * `distanceToCategories`), así que esta función se duplica también en
 * `lib/utils.ts` con el mismo comportamiento. Si se cambia la regla,
 * cambiar en los dos sitios.
 */
export function normalizeSearch(input: string | null | undefined): string {
  if (typeof input !== "string") return "";
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

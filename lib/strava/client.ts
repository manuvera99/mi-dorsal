// =============================================================================
// mi-dorsal — Cliente HTTP de Strava con rate limit + refresh
// =============================================================================
// Encapsula TODAS las llamadas a la API de Strava. Hace:
//   1) Refresh automático del access token si está a <5min de expirar
//   2) Parsea X-RateLimit-* headers y espera si estamos cerca del límite
//   3) Backoff exponencial en 429
//   4) Reintentos en 5xx
//
// Strava rate limits (Standard Tier):
//   - 100 req/15min y 1.000/día en read endpoints
//   - 200 req/15min y 2.000/día overall
//   - Tokens expiran a las 6h
//
// IMPORTANTE: este cliente se ejecuta en SERVER-SIDE (Next.js API routes o
// Convex actions). NUNCA en el cliente.
// =============================================================================

import { encryptToken, decryptToken } from "./encrypt";

const STRAVA_API_BASE = "https://www.strava.com/api/v3";
const STRAVA_OAUTH_BASE = "https://www.strava.com/oauth";
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refrescar si faltan <5min

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // ms epoch
  athleteId: number;
}

export interface CachedStravaTokens {
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  expiresAt: number;
  athleteId: number;
}

/** Codifica tokens para guardar en Convex. */
export function encodeTokens(tokens: StravaTokens): CachedStravaTokens {
  return {
    accessTokenEncrypted: encryptToken(tokens.accessToken),
    refreshTokenEncrypted: encryptToken(tokens.refreshToken),
    expiresAt: tokens.expiresAt,
    athleteId: tokens.athleteId,
  };
}

/** Decodifica tokens de Convex. */
export function decodeTokens(cached: CachedStravaTokens): StravaTokens {
  return {
    accessToken: decryptToken(cached.accessTokenEncrypted),
    refreshToken: decryptToken(cached.refreshTokenEncrypted),
    expiresAt: cached.expiresAt,
    athleteId: cached.athleteId,
  };
}

/** Intercambia un authorization code por tokens. Llamado en el callback. */
export async function exchangeCodeForTokens(code: string): Promise<StravaTokens> {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("STRAVA_CLIENT_ID o STRAVA_CLIENT_SECRET no definidas");
  }

  const res = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Strava token exchange failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    expires_in: number;
    athlete: { id: number };
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at * 1000, // Strava da en segundos
    athleteId: data.athlete.id,
  };
}

/** Refresca el access token usando el refresh token. */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}> {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("STRAVA_CLIENT_ID o STRAVA_CLIENT_SECRET no definidas");
  }

  const res = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Strava token refresh failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at * 1000,
  };
}

/** Revoca un token en Strava. */
export async function revokeToken(token: string): Promise<void> {
  const res = await fetch(`${STRAVA_OAUTH_BASE}/deauthorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: token }),
  });
  // Strava siempre devuelve 200 en deauthorize, pero por si acaso
  if (!res.ok) {
    console.warn(`[strava] revoke returned ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// Rate limit handling
// ---------------------------------------------------------------------------

export interface RateLimitInfo {
  usage15: number;
  limit15: number;
  usageDay: number;
  limitDay: number;
}

/** Parsea los headers X-RateLimit-* de una respuesta de Strava. */
export function parseRateLimitHeaders(res: Response): RateLimitInfo {
  const usage15 = parseInt(res.headers.get("X-RateLimit-Usage")?.split(",")[0] ?? "0");
  const limit15 = parseInt(res.headers.get("X-RateLimit-Limit")?.split(",")[0] ?? "100");
  const usageDay = parseInt(res.headers.get("X-RateLimit-Usage")?.split(",")[1] ?? "0");
  const limitDay = parseInt(res.headers.get("X-RateLimit-Limit")?.split(",")[1] ?? "1000");
  return { usage15, limit15, usageDay, limitDay };
}

/** Espera hasta el siguiente reset del rate limit (cuarto de hora). */
export function msUntilNext15MinWindow(): number {
  const now = new Date();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const ms = now.getMilliseconds();
  const nextSlot = Math.ceil((minutes + 1) / 15) * 15;
  const minutesUntilNext = nextSlot - minutes;
  return minutesUntilNext * 60 * 1000 - seconds * 1000 - ms + 1000; // +1s de margen
}

// ---------------------------------------------------------------------------
// Llamadas autenticadas
// ---------------------------------------------------------------------------

export interface AuthedRequestOptions {
  tokens: StravaTokens;
  /** Si el token está a <5min de expirar, refresca. */
  onTokenRefresh?: (newTokens: StravaTokens) => Promise<void>;
  /** Si true, lanza error si estamos al 90% del rate limit. */
  checkRateLimit?: boolean;
}

export interface StravaAthlete {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  city: string | null;
  country: string | null;
  sex: "M" | "F" | null;
  weight: number | null;
  ftp: number | null;
  max_heartrate: number | null;
  profile: string;
}

/** Asegura que el access token está fresco. Lo refresca si <5min a expirar. */
export async function ensureFreshToken(
  tokens: StravaTokens,
  onRefresh?: (newTokens: StravaTokens) => Promise<void>,
): Promise<StravaTokens> {
  if (Date.now() < tokens.expiresAt - REFRESH_BUFFER_MS) {
    return tokens; // aún válido
  }

  const refreshed = await refreshAccessToken(tokens.refreshToken);
  const newTokens: StravaTokens = {
    ...tokens,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiresAt: refreshed.expiresAt,
  };

  if (onRefresh) {
    await onRefresh(newTokens);
  }

  return newTokens;
}

/** GET autenticado a la API de Strava. */
export async function stravaGet<T>(
  path: string,
  options: AuthedRequestOptions,
  retries = 2,
): Promise<{ data: T; rateLimit: RateLimitInfo }> {
  const tokens = await ensureFreshToken(options.tokens, options.onTokenRefresh);

  const res = await fetch(`${STRAVA_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });

  const rateLimit = parseRateLimitHeaders(res);

  if (res.status === 429 || res.status === 429) {
    // Rate limit. Esperar al siguiente ciclo.
    const wait = msUntilNext15MinWindow();
    console.warn(`[strava] 429 on ${path}, waiting ${wait}ms`);
    if (retries > 0) {
      await sleep(wait);
      return stravaGet<T>(path, options, retries - 1);
    }
    throw new Error(`Strava 429 after retries on ${path}`);
  }

  if (res.status >= 500 && retries > 0) {
    await sleep(1000 * (3 - retries)); // backoff: 1s, 2s
    return stravaGet<T>(path, options, retries - 1);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Strava GET ${path} failed: ${res.status} ${text}`);
  }

  // Si estamos al 90% del rate limit, log warning
  if (rateLimit.limit15 > 0 && rateLimit.usage15 / rateLimit.limit15 > 0.9) {
    console.warn(
      `[strava] rate limit al ${((rateLimit.usage15 / rateLimit.limit15) * 100).toFixed(0)}% en 15min`,
    );
  }

  const data = (await res.json()) as T;
  return { data, rateLimit };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Wrappers tipados de los endpoints que usamos
// ---------------------------------------------------------------------------

/**
 * "Mejor esfuerzo" dentro de una actividad — el tramo continuo más rápido
 * para una distancia estándar (5K, 10K, etc.), calculado por Strava a
 * partir del track GPS. Es EXACTAMENTE lo que la app de Strava muestra en
 * "Mejores tiempos" del atleta: el mínimo de best_efforts de esa distancia
 * a través de todas sus actividades — no existe un endpoint que devuelva
 * esa tabla agregada directamente, hay que construirla nosotros mismos
 * pidiendo el detalle de cada actividad relevante.
 *
 * Campo NO documentado en el spec oficial de Strava (developers.strava.com)
 * pero confirmado real — lo modela stravalib (SDK de referencia de la
 * comunidad) como parte de DetailedActivity. Solo viene en la respuesta de
 * GET /activities/{id} (detalle), NUNCA en GET /athlete/activities (listado).
 */
export interface StravaBestEffort {
  id: number;
  name: string; // ej. "5k", "10k", "15k", "Half-Marathon", "1/2 mile", "10 mile"
  distance: number; // metros
  moving_time: number;
  elapsed_time: number;
  start_date: string;
  start_date_local: string;
  pr_rank: number | null; // 1/2/3 si es de las 3 mejores del atleta EN ESTA actividad, null si no
  achievements?: unknown[];
  /** Coordenadas del inicio/fin del segmento. No hay polyline propia —
   *  para dibujar el segmento en un mapa usamos la polyline de la
   *  actividad + estos puntos como marcadores. */
  start_latlng?: [number, number] | null;
  end_latlng?: [number, number] | null;
}

/**
 * Resumen del equipo (zapatillas, bici, etc.) usado en una actividad.
 * Solo viene en la respuesta de detalle (getActivity), no en el listado.
 */
export interface StravaGear {
  id: string;
  name?: string;
  primary?: boolean;
  distance?: number; // metros totales en este gear
}

/**
 * Split por km (metric) o por milla (standard). Strava devuelve pace medio,
 * HR medio, elevación ganada y cadence media por split. Útil para gráficas
 * de pace por km en el feed y la card del PR.
 */
export interface StravaSplit {
  distance: number; // metros del split (normalmente 1000 o 1609)
  elapsed_time: number;
  moving_time: number;
  elevation_difference: number;
  average_speed: number; // m/s
  average_heartrate?: number;
  average_cadence?: number;
  pace_zone?: number; // 1-5 según zonal habitual de Strava
  split: number; // número de split (1-based)
}

/**
 * Mapa simplificado de una actividad. Strava siempre devuelve `id` y
 * `summary_polyline` en la respuesta de detalle. `summary_polyline` es un
 * string codificado en formato Google polyline encoding (~200-500 chars para
 * un 10K) que se decodifica a [lat, lng][] con la lib `polyline-encoded`
 * o `google-polyline` — listo para pintar en un Leaflet/Mapbox.
 */
export interface StravaMap {
  id: string;
  summary_polyline: string | null;
  polyline?: string | null; // opcional; requiere pedirlo explícitamente
}

export interface StravaActivitySummary {
  id: number;
  external_id: string | null;
  athlete: { id: number };
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  timezone: string;
  start_latlng: [number, number] | null;
  end_latlng: [number, number] | null;
  achievement_count: number;
  kudos_count: number;
  comment_count: number;
  athlete_count: number;
  photo_count: number;
  trainer: boolean;
  commute: boolean;
  manual: boolean;
  private: boolean;
  visibility: "everyone" | "followers_only" | "only_me";
  flagged: boolean;
  gear_id: string | null;
  start_latlng_set: boolean;
  end_latlng_set: boolean;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  description?: string;
  has_heartrate: boolean;
  /** Solo presente en la respuesta de detalle (getActivity), no en el listado. */
  best_efforts?: StravaBestEffort[];
  /** Solo en detalle. summary_polyline (~200-500 chars) → [lat, lng][] para mapa. */
  map?: StravaMap;
  /** Solo en detalle. Nombre del dispositivo (ej. "Garmin Forerunner 945"). */
  device_name?: string;
  /** Solo en detalle. Detalle del gear usado (zapatillas, bici, etc.). */
  gear?: StravaGear;
  /** Solo en detalle. Splits por km (métricas) si la actividad es de running. */
  splits_metric?: StravaSplit[];
  /** Solo en detalle. Splits por milla (standard). */
  splits_standard?: StravaSplit[];
  /** Solo en detalle. Localización textual. */
  location_city?: string | null;
  location_state?: string | null;
  location_country?: string | null;
  // -----------------------------------------------------------------
  // Campos extra para reports (2026-09-08) — todos opcionales porque
  // solo algunos están en la respuesta de detalle, y la disponibilidad
  // varía (p.ej. weather solo en actividades recientes). Los counts
  // (kudos/comment/achievement/athlete/photo) ya están arriba.
  // -----------------------------------------------------------------
  calories?: number;
  workout_type?: number; // 0=default, 1=race, 2=workout
  perceived_exertion?: number;
  suffer_score?: number;
  device_watts?: boolean; // deviceWatts
  has_power?: boolean;
  average_watts?: number;
  max_watts?: number;
  weighted_average_watts?: number;
  max_cadence?: number;
  utc_offset?: number;
  average_grade_adjusted_speed?: number;
  grade_adjusted_distance?: number;
  embed_token?: string;
  // Weather
  average_temp?: number;
  min_temp?: number;
  max_temp?: number;
  feels_like?: number;
  average_wind_speed?: number;
  precipitation_intensity?: number;
  weather_observation_time?: string;
  // Arrays
  laps?: unknown[];
  segment_efforts?: unknown[];
}

export interface StravaActivitiesResponse {
  activities: StravaActivitySummary[];
  rateLimit: RateLimitInfo;
}

/** Lista actividades del atleta autenticado, con paginación. */
export async function listAthleteActivities(
  tokens: StravaTokens,
  options: { before?: number; after?: number; page?: number; perPage?: number } = {},
  onTokenRefresh?: (t: StravaTokens) => Promise<void>,
): Promise<StravaActivitiesResponse> {
  const params = new URLSearchParams();
  if (options.before) params.set("before", String(options.before));
  if (options.after) params.set("after", String(options.after));
  params.set("page", String(options.page ?? 1));
  params.set("per_page", String(Math.min(options.perPage ?? 30, 200)));

  const { data, rateLimit } = await stravaGet<StravaActivitySummary[]>(
    `/athlete/activities?${params.toString()}`,
    { tokens, onTokenRefresh },
  );

  return { activities: data, rateLimit };
}

/** Detalle de una actividad (incluye description, HR, etc.). */
export async function getActivity(
  activityId: number,
  tokens: StravaTokens,
  onTokenRefresh?: (t: StravaTokens) => Promise<void>,
): Promise<{ data: StravaActivitySummary; rateLimit: RateLimitInfo }> {
  return stravaGet<StravaActivitySummary>(`/activities/${activityId}`, {
    tokens,
    onTokenRefresh,
  });
}

/** Perfil del atleta autenticado. */
export async function getAuthenticatedAthlete(
  tokens: StravaTokens,
  onTokenRefresh?: (t: StravaTokens) => Promise<void>,
): Promise<{ data: StravaAthlete; rateLimit: RateLimitInfo }> {
  return stravaGet<StravaAthlete>(`/athlete`, { tokens, onTokenRefresh });
}

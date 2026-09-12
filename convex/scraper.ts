// =============================================================================
// mi-dorsal — Scraper de resultados
// =============================================================================
// Adapters por cronometrador. Cada uno sabe cómo parsear el HTML de su sitio.
// =============================================================================

import * as cheerio from "cheerio";
import { isPdfUrl, scrapePdf } from "./pdfScraper";

export interface RunnerResult {
  runnerName?: string;
  positionOverall?: number;
  positionCategory?: number;
  timeSeconds: number;
}

const ADAPTERS: Record<
  string,
  (html: string, dorsal: string) => RunnerResult | null
> = {
  mysports: scrapeMysports,
  dorsalchip: scrapeDorsalchip,
  championchip: scrapeChampionchip,
  generic: scrapeGeneric,
};

/** UUID de una modalidad de carrera en sportmaniacs.com (ver bloque de abajo). */
export interface SportmaniacsEventRef {
  eventId: string;
  name?: string;
  distanceKm?: number;
}

/**
 * Punto de entrada: scrapea la URL buscando el dorsal, usando el adapter apropiado.
 *
 * Casos especiales (JSON-based o PDF, no HTML):
 *   - `chiplevante` → endpoint AJAX propio.
 *   - `sportmaniacs` → endpoint API público de Sportmaniacs. Necesita los
 *     UUID de modalidad cacheados en `race.sportmaniacsEventIds` (backfill
 *     previo) — sin ellos, no hay forma fiable de scrapear (ver nota en el
 *     bloque de sportmaniacs más abajo).
 *   - `cruzandolameta` → endpoint API público de Cruzando la Meta (JSON).
 *   - `pdf` → PDF descargable (Time Runners, etc.).
 * Por eso los despachamos ANTES del fetch HTML.
 */
export async function scrapeResults(
  url: string,
  dorsal: string,
  adapterName?: string,
  extra?: { sportmaniacsEventIds?: SportmaniacsEventRef[] },
): Promise<RunnerResult | null> {
  if (adapterName === "chiplevante") {
    return scrapeChiplevante(url, dorsal);
  }
  if (adapterName === "sportmaniacs") {
    return scrapeSportmaniacs(extra?.sportmaniacsEventIds ?? [], dorsal);
  }
  if (adapterName === "cruzandolameta") {
    return scrapeCruzandolameta(url, dorsal);
  }
  if (adapterName === "pdf" || /\.pdf(\?|#|$)/i.test(url)) {
    return scrapePdf(url, dorsal);
  }

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 mi-dorsal/0.1" },
    });
    if (!response.ok) {
      console.error(`[scraper] HTTP ${response.status} for ${url}`);
      return null;
    }
    const html = await response.text();
    const adapter =
      ADAPTERS[adapterName ?? "generic"] ?? ADAPTERS.generic;
    return adapter(html, dorsal);
  } catch (err) {
    console.error(`[scraper] Fetch failed for ${url}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

/**
 * Adapter genérico: busca una tabla con filas que contengan el dorsal.
 * Es un fallback razonable para cronometradores que no tengamos un adapter específico.
 */
function scrapeGeneric(html: string, dorsal: string): RunnerResult | null {
  const $ = cheerio.load(html);
  // Buscar fila con el dorsal
  const row = $("tr")
    .filter((_, el) => {
      const text = $(el).text();
      return text.includes(dorsal);
    })
    .first();

  if (row.length === 0) return null;

  const cells = row.find("td");
  if (cells.length < 3) return null;

  // Asumimos formato: Pos | Dorsal | Nombre | Tiempo
  // o: Dorsal | Nombre | Tiempo
  // Parsear heurísticamente
  const cellTexts = cells
    .map((_, el) => $(el).text().trim())
    .get();

  // Buscar el primer string que parezca tiempo (HH:MM:SS o MM:SS)
  const timePattern = /^(\d{1,2}:)?\d{1,2}:\d{2}$/;
  let timeStr = "";
  let positionStr = "";
  let nameStr = "";

  for (const text of cellTexts) {
    if (!timeStr && timePattern.test(text)) {
      timeStr = text;
    } else if (!positionStr && /^\d+$/.test(text) && text !== dorsal) {
      positionStr = text;
    } else if (!nameStr && /[a-zA-Záéíóú]/.test(text) && text !== dorsal) {
      nameStr = text;
    }
  }

  if (!timeStr) return null;
  const timeSeconds = parseTime(timeStr);
  if (timeSeconds === null) return null;

  return {
    runnerName: nameStr || undefined,
    positionOverall: positionStr ? parseInt(positionStr, 10) : undefined,
    timeSeconds,
  };
}

/**
 * Adapter para MySports.
 * URL típica: https://resultados.mysportsresults.com/...
 * Formato: tabla con columnas Pos | Dorsal | Nombre | Cat | Tiempo
 */
function scrapeMysports(html: string, dorsal: string): RunnerResult | null {
  const $ = cheerio.load(html);
  // MySports suele tener clases específicas
  const row = $("tr.result-row, tr[class*='result']")
    .filter((_, el) => $(el).text().includes(dorsal))
    .first();
  if (row.length === 0) return scrapeGeneric(html, dorsal);

  const cells = row.find("td");
  return {
    runnerName: $(cells[2]).text().trim() || undefined,
    positionOverall: parseInt($(cells[0]).text().trim(), 10) || undefined,
    timeSeconds: parseTime($(cells[cells.length - 1]).text().trim()) ?? 0,
  };
}

/**
 * Adapter para Dorsalchip.
 */
function scrapeDorsalchip(html: string, dorsal: string): RunnerResult | null {
  const $ = cheerio.load(html);
  const row = $("tr")
    .filter((_, el) => $(el).text().includes(dorsal))
    .first();
  if (row.length === 0) return null;

  const cells = row.find("td");
  if (cells.length < 4) return scrapeGeneric(html, dorsal);

  return {
    positionOverall: parseInt($(cells[0]).text().trim(), 10) || undefined,
    runnerName: $(cells[2]).text().trim() || undefined,
    timeSeconds: parseTime($(cells[cells.length - 1]).text().trim()) ?? 0,
  };
}

/**
 * Adapter para Championchip.
 */
function scrapeChampionchip(
  html: string,
  dorsal: string,
): RunnerResult | null {
  return scrapeGeneric(html, dorsal);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parsea "HH:MM:SS" o "MM:SS" a segundos.
 */
function parseTime(time: string): number | null {
  const parts = time.split(":").map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Adapter: ChipLevante (chiplevante.com)
// ---------------------------------------------------------------------------
//
// ChipLevante es una empresa de cronometraje con base en Alicante que cubre
// carreras populares de Alicante, Murcia, Albacete y Valencia. Tienen un
// endpoint AJAX público (sin auth) que devuelve los datos de un corredor
// por dorsal en formato JSON:
//
//   POST https://www.chiplevante.com/secciones/clasificaciones/dame_id_corredor.php
//   Content-Type: application/x-www-form-urlencoded
//   body: empresa={1|""}&evento={id}&edicion={year}&carrera={id}&dorsal={n}
//
// Respuesta:
//   { idCorredor, nombre, apellidos, club, categoria,
//     pos_carrera, pos_sexo, pos_categoria,
//     tiempo_real, tiempo_oficial }
//
// Si el dorsal no existe (o la carrera no se ha cerrado), todos los campos
// vienen `null` — perfecto para distinguir "no encontrado" de "en meta pero
// sin clasificar".
//
// URL de la carrera: /es/prueba/{slug}-{evento_id}-{year}
//   → el evento_id y year se sacan por regex.
//   → el "carrera" (id interno de la modalidad: 10K, 5K, marcha...) NO está
//     en la URL; vive en el HTML como `data-carrera="N"`.
//   → "empresa" puede ser "" o "1" según el evento; tampoco está en la URL.
//
// Estrategia actual (v1): probar combinaciones (empresa × carrera_id 1..5)
// hasta que una devuelva `pos_carrera != null`. Cuesta hasta 10 requests,
// pero la mayoría se resuelven en 1-2 y la latencia por request es ~200 ms.
// Si en el futuro hace falta más velocidad, cachear `empresa` y `carrera_id`
// en la tabla `races` (campos `chiplevanteEmpresa` y `chiplevanteCarreraIds`).
// ---------------------------------------------------------------------------

const CHIPLEVANTE_ENDPOINT =
  "https://www.chiplevante.com/secciones/clasificaciones/dame_id_corredor.php";
const CHIPLEVANTE_USER_AGENT = "Mozilla/5.0 mi-dorsal/0.1";

/**
 * Extrae `evento_id` y `edicion` (year) de la URL de una prueba de chiplevante.
 * Devuelve null si la URL no encaja con el patrón esperado.
 */
export function parseChiplevanteUrl(
  url: string,
): { evento: string; edicion: string } | null {
  // Patrón: .../es/prueba/{slug}-{evento_id}-{year}
  // El slug puede tener guiones, así que el regex toma el ÚLTIMO -NUM-YEAR.
  const m = url.match(/\/es\/prueba\/.+?-(\d+)-(\d{4})\/?$/);
  if (!m) return null;
  return { evento: m[1], edicion: m[2] };
}

/**
 * Adapter principal: scrapea chiplevante.com buscando el dorsal del corredor.
 * Devuelve null si:
 *   - la URL no es de chiplevante.com
 *   - el endpoint devuelve 4xx/5xx
 *   - ningún (empresa, carrera_id) devuelve datos para ese dorsal
 *
 * No lanza excepciones: cualquier error se loga y se trata como "no encontrado".
 */
export async function scrapeChiplevante(
  url: string,
  dorsal: string,
): Promise<RunnerResult | null> {
  const parsed = parseChiplevanteUrl(url);
  if (!parsed) {
    console.warn(`[scraper:chiplevante] URL no encaja con el patrón: ${url}`);
    return null;
  }
  const { evento, edicion } = parsed;

  // Probamos empresa "1" primero (más común en eventos actuales) y "" como fallback.
  // Carrera_id 1..5 cubre la mayoría de eventos (típico: 10K=1, 5K=2, marcha=3, infantiles=4).
  const empresas = ["1", ""];
  const carreraIds = ["1", "2", "3", "4", "5"];

  for (const empresa of empresas) {
    for (const carreraId of carreraIds) {
      const result = await scrapeChiplevanteSingle(
        empresa,
        evento,
        edicion,
        carreraId,
        dorsal,
      );
      if (result) return result;
    }
  }

  console.log(
    `[scraper:chiplevante] Dorsal ${dorsal} no encontrado en evento ${evento} edicion ${edicion} (probadas ${empresas.length * carreraIds.length} combinaciones)`,
  );
  return null;
}

/**
 * Hace UNA llamada al endpoint de chiplevante con (empresa, evento, edicion, carrera, dorsal).
 * Devuelve RunnerResult si el endpoint devuelve datos (tiempo_oficial != null),
 * o null si devuelve todos los campos null (dorsal no apuntado / carrera no cerrada / combinación inválida).
 */
async function scrapeChiplevanteSingle(
  empresa: string,
  evento: string,
  edicion: string,
  carreraId: string,
  dorsal: string,
): Promise<RunnerResult | null> {
  const body = new URLSearchParams({
    empresa,
    evento,
    edicion,
    carrera: carreraId,
    dorsal,
  }).toString();

  let res: Response;
  try {
    res = await fetch(CHIPLEVANTE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": CHIPLEVANTE_USER_AGENT,
        Accept: "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
      },
      body,
    });
  } catch (err) {
    console.error(
      `[scraper:chiplevante] Fetch failed (empresa=${empresa} carrera=${carreraId}):`,
      err,
    );
    return null;
  }

  if (!res.ok) {
    console.warn(
      `[scraper:chiplevante] HTTP ${res.status} (empresa=${empresa} carrera=${carreraId})`,
    );
    return null;
  }

  let data: any;
  try {
    data = await res.json();
  } catch (err) {
    console.error(`[scraper:chiplevante] Respuesta no es JSON válido:`, err);
    return null;
  }

  // Si el endpoint devuelve todos los campos null, el dorsal no está en esa combinación.
  // Distinguimos "no encontrado" (data.pos_carrera == null) de "encontrado" (con tiempo).
  if (!data || data.pos_carrera == null || data.tiempo_oficial == null) {
    return null;
  }

  const runnerName =
    [data.nombre, data.apellidos].filter(Boolean).join(" ").trim() || undefined;
  const positionOverall = toIntOrUndefined(data.pos_carrera);
  const positionCategory = toIntOrUndefined(data.pos_categoria);
  const timeSeconds = parseTime(String(data.tiempo_oficial));

  if (timeSeconds == null || timeSeconds <= 0) {
    console.warn(
      `[scraper:chiplevante] Tiempo oficial inválido "${data.tiempo_oficial}" para dorsal ${dorsal}`,
    );
    return null;
  }

  return {
    runnerName,
    positionOverall,
    positionCategory,
    timeSeconds,
  };
}

// ---------------------------------------------------------------------------
// Adapter: PDF genérico (timerunners.es, cronohip, gesconchip, etc.)
// ---------------------------------------------------------------------------
//
// La implementación vive en `pdfScraper.ts` (con `"use node"`) porque usa
// `require("pdf-parse")`, que es CommonJS. Convex exige que las funciones
// que usan Node APIs estén en archivos separados con ese directive.
//
// Aquí re-exportamos para que el cron (`crons/checkResults.ts`) y otros
// callers puedan hacer `import { scrapePdf } from "../scraper"` sin
// preocuparse del split.
// ---------------------------------------------------------------------------

export { isPdfUrl, scrapePdf } from "./pdfScraper";

// Helper compartido por los adapters de chiplevante y sportmaniacs
// para parsear campos numéricos opcionales (pos_carrera, pos_categoria, etc.)
function toIntOrUndefined(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// ---------------------------------------------------------------------------
// Adapter: Sportmaniacs (sportmaniacs.com)
// ---------------------------------------------------------------------------
//
// Sportmaniacs es la mayor plataforma de inscripciones + cronometraje del
// running popular español. Cubre cientos de carreras en todo el país
// (muchas de las grandes maratones y medias están aquí: Zurich Marató
// Barcelona, Maratón Sevilla, Mitja Marató Barcelona, eBay Maratón
// Zaragoza, y muchísimas populares locales).
//
// HISTORIA (2026-09-11): la versión original de este adapter llamaba a
// `api-aws.sportmaniacs.com/api/events/{uuid}/race-rankings` esperando un
// campo `data.Rankings[]`. Verificado empíricamente contra varias carreras
// reales (incluidas con resultados públicos confirmados) que ESE endpoint
// NUNCA devuelve `Rankings` — solo devuelve metadata del evento
// (`{id, distance, name, date, ranking:true, ...}` sin más). El adapter
// llevaba desde su creación mirando el endpoint equivocado.
//
// El endpoint REAL que sirve la tabla de resultados (descubierto
// inspeccionando el HTML de la página pública de resultados, que invoca
// `window.app.getPlugin('Rankings')` contra el propio dominio
// sportmaniacs.com, no api-aws):
//
//   GET https://sportmaniacs.com/es/api/rankings?event={eventId}&page={n}
//   Respuesta: { data: [{event_id, dorsal, name, pos, officialTime, club,
//                        event_name}, ...], status: "ok", totalPages: N }
//   Paginado a 25 resultados por página. IMPORTANTE: filtrar por
//   `?dorsal=X` devuelve el registro pero con `pos`/`officialTime` VACÍOS
//   (bug/limitación de su lado) — hay que pedir sin filtro y paginar hasta
//   encontrar el dorsal, igual que scrapeGeneric hace con cheerio.
//
// El SEGUNDO problema (el `eventId`): el `id` que devuelve la API de
// catálogo (api-aws.sportmaniacs.com/api/races, usada por
// scripts/ingest-sportmaniacs.ts) es el UUID de la carrera-evento
// CONTENEDORA, y ese UUID NO es aceptado por /es/api/rankings (devuelve
// {"status":"ko"}). El UUID correcto es el `data-event-id` de cada bloque
// <div class="event-card"> en el HTML server-rendered de
// https://sportmaniacs.com/es/races/{slug} — una carrera puede tener
// VARIOS event-card (una modalidad/distancia cada uno: "Competitive"/
// "Open", "5K"/"10K", etc.), cada uno con su propio UUID y su propia tabla
// de resultados independiente. Por eso este adapter NO parsea la URL en
// tiempo real: necesita `race.sportmaniacsEventIds`, poblado por
// `scripts/backfill-sportmaniacs-event-ids.ts` (que sí parsea el HTML una
// vez, offline, y cachea los UUIDs — mismo patrón que
// chiplevanteEmpresa/chiplevanteCarreraIds).
// ---------------------------------------------------------------------------

const SPORTMANIACS_RANKINGS_ENDPOINT = "https://sportmaniacs.com/es/api/rankings";
const SPORTMANIACS_USER_AGENT = "Mozilla/5.0 mi-dorsal/0.1";
const SPORTMANIACS_MAX_PAGES = 200; // salvaguarda: ~5000 corredores a 25/página

/**
 * Extrae los `<div class="event-card" data-event-id="{uuid}">` del HTML
 * server-rendered de https://sportmaniacs.com/es/races/{slug}. Compartido
 * entre `scripts/backfill-sportmaniacs-event-ids.ts` (backfill masivo
 * offline) y `discoverSportmaniacsEventIds` (fallback en caliente desde el
 * cron, ver más abajo) — mismo parseo, una sola implementación.
 */
export function extractSportmaniacsEventCards(html: string): SportmaniacsEventRef[] {
  const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const cardRe = /<div class="event-card[^"]*"\s+data-event-id="([^"]+)"/gi;
  const results: SportmaniacsEventRef[] = [];
  let m: RegExpExecArray | null;
  while ((m = cardRe.exec(html)) !== null) {
    const eventId = m[1];
    if (!uuidRe.test(eventId)) continue;
    const start = m.index;
    const nextCardIdx = html.indexOf('class="event-card', start + 20);
    const block = html.slice(start, nextCardIdx > 0 ? nextCardIdx : start + 2000);
    const nameMatch = block.match(/event-title">\s*([^<\n]+?)\s*</);
    const distMatch = block.match(/event-distance">[^<]*<\/span>\s*([\d.,]+)\s*km/i);
    results.push({
      eventId,
      name: nameMatch?.[1]?.trim() || undefined,
      distanceKm: distMatch ? parseFloat(distMatch[1].replace(",", ".")) : undefined,
    });
  }
  return results;
}

/**
 * Fallback en caliente: cuando el cron encuentra una carrera sportmaniacs
 * sin `sportmaniacsEventIds` cacheado (el backfill masivo se corrió antes
 * de que sportmaniacs activara la página de resultados con event-card —
 * pasa con carreras muy próximas en fecha), intenta parsear `officialUrl`
 * directamente. Si sportmaniacs ya sirve el event-card, el cron cachea el
 * resultado (ver `checkResults.ts`) y ya no hace falta re-descubrirlo.
 * Devuelve [] (nunca lanza) si el fetch falla o la página aún no tiene
 * event-card — el caller trata eso igual que "sin backfill todavía".
 */
export async function discoverSportmaniacsEventIds(
  officialUrl: string,
): Promise<SportmaniacsEventRef[]> {
  let html: string;
  try {
    const res = await fetch(officialUrl, {
      headers: { "User-Agent": SPORTMANIACS_USER_AGENT, Accept: "text/html" },
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch (err) {
    console.error(
      `[scraper:sportmaniacs] Discovery fetch failed for ${officialUrl}:`,
      err,
    );
    return [];
  }
  return extractSportmaniacsEventCards(html);
}

/**
 * Adapter principal: scrapea sportmaniacs.com buscando el dorsal del
 * corredor entre las modalidades cacheadas de la carrera.
 *
 * Prueba cada `eventId` en orden (una carrera puede tener varias
 * modalidades y no sabemos cuál corrió el usuario) hasta encontrar el
 * dorsal o agotar todos. Devuelve null si:
 *   - no hay ningún eventId cacheado (carrera aún no backfillada)
 *   - ningún eventId devuelve el dorsal buscado
 *
 * No lanza excepciones: cualquier error se loga y se trata como "no
 * encontrado" — el cron reintentará en el siguiente check.
 */
export async function scrapeSportmaniacs(
  eventIds: SportmaniacsEventRef[],
  dorsal: string,
): Promise<RunnerResult | null> {
  if (!eventIds || eventIds.length === 0) {
    console.log(
      `[scraper:sportmaniacs] Sin sportmaniacsEventIds cacheados — falta backfill para esta carrera`,
    );
    return null;
  }

  for (const { eventId } of eventIds) {
    const result = await scrapeSportmaniacsEvent(eventId, dorsal);
    if (result) return result;
  }
  return null;
}

/**
 * Scrapea UNA modalidad (un eventId) de sportmaniacs.com, paginando hasta
 * encontrar el dorsal o agotar todas las páginas.
 */
async function scrapeSportmaniacsEvent(
  eventId: string,
  dorsal: string,
): Promise<RunnerResult | null> {
  const target = String(dorsal).trim();

  for (let page = 1; page <= SPORTMANIACS_MAX_PAGES; page++) {
    const apiUrl = `${SPORTMANIACS_RANKINGS_ENDPOINT}?event=${eventId}&page=${page}`;

    let res: Response;
    try {
      res = await fetch(apiUrl, {
        headers: {
          Accept: "application/json, text/plain, */*",
          "User-Agent": SPORTMANIACS_USER_AGENT,
          "X-Requested-With": "XMLHttpRequest",
        },
      });
    } catch (err) {
      console.error(`[scraper:sportmaniacs] Fetch failed for ${apiUrl}:`, err);
      return null;
    }

    if (!res.ok) {
      console.warn(`[scraper:sportmaniacs] HTTP ${res.status} for ${apiUrl}`);
      return null;
    }

    let body: any;
    try {
      body = await res.json();
    } catch (err) {
      console.error(`[scraper:sportmaniacs] Respuesta no es JSON válido:`, err);
      return null;
    }

    if (!body || body.status !== "ok" || !Array.isArray(body.data)) {
      return null;
    }

    const rows: any[] = body.data;
    const entry = rows.find((r) => {
      if (r == null) return false;
      const d = r.dorsal ?? r.bib;
      return d != null && String(d).trim() === target;
    });

    if (entry) {
      const runnerName = entry.name ?? undefined;
      const officialTime = entry.officialTime;
      const positionOverall = toIntOrUndefined(entry.pos);

      if (!officialTime) {
        // Dorsal presente pero sin tiempo oficial (abandonó, o el filtro
        // por dorsal — que sí devuelve pos/officialTime vacíos — coló
        // aquí por error). No es un error: seguimos sin resultado válido.
        return null;
      }
      const timeSeconds = parseTime(String(officialTime));
      if (timeSeconds == null || timeSeconds <= 0) {
        console.warn(
          `[scraper:sportmaniacs] Tiempo inválido "${officialTime}" para dorsal ${dorsal} en evento ${eventId}`,
        );
        return null;
      }
      return {
        runnerName: runnerName || undefined,
        positionOverall,
        timeSeconds,
      };
    }

    const totalPages = Number(body.totalPages) || 1;
    if (page >= totalPages) {
      // Recorrimos todas las páginas de esta modalidad, dorsal no encontrado.
      return null;
    }
  }

  console.warn(
    `[scraper:sportmaniacs] Evento ${eventId} superó SPORTMANIACS_MAX_PAGES sin encontrar dorsal ${dorsal}`,
  );
  return null;
}

// ---------------------------------------------------------------------------
// Adapter: Cruzando la Meta (rankings.cruzandolameta.es)
// ---------------------------------------------------------------------------
//
// Cruzando la Meta (CLM) es un cronometrador regional que cubre carreras
// populares de Almería y Granada. Su web de resultados es una SPA (React/Vite,
// sin SSR) que consume una API REST pública sin auth — descubierta
// inspeccionando el bundle JS de la SPA (no hay documentación pública):
//
//   GET https://rankings.cruzandolameta.es/api/e/{slug}
//   Respuesta: { evento: {...}, prueba: {...}, resultados: [
//     { dorsal, nombre, apellidos, sexo, club, categoria, status,
//       tiempo_oficial_ms, tiempo_oficial, tiempo_neto_ms, pos_general,
//       pos_gen, pos_cat, ... }, ...
//   ] }
//
// `{slug}` identifica una MODALIDAD/CATEGORÍA concreta de una prueba (una
// prueba puede tener varias: absoluta, sub-10, sub-12, etc.), cada una con
// su propia tabla `resultados[]` independiente — mismo patrón que un
// event-card de sportmaniacs. `ingest-cruzandolameta.ts` guarda la URL de
// este endpoint directamente en `race.resultsUrl` (una carrera = una
// modalidad = un slug), así que a diferencia de chiplevante/sportmaniacs
// este adapter no necesita descubrimiento ni combinaciones: la URL ya
// apunta al endpoint JSON exacto.
//
// `dorsal` en la respuesta es numérico (no string) — comparamos con
// `String(...)`, igual que hacen los adapters de chiplevante y sportmaniacs.
// 404 (`{"detail": "..."}`) o dorsal no encontrado en `resultados[]` se
// tratan igual: "no encontrado todavía", nunca se lanza excepción.
// ---------------------------------------------------------------------------

const CRUZANDOLAMETA_USER_AGENT = "Mozilla/5.0 mi-dorsal/0.1";

/**
 * Adapter principal: scrapea rankings.cruzandolameta.es buscando el dorsal
 * en la tabla de resultados de la modalidad apuntada por `url`
 * (`https://rankings.cruzandolameta.es/api/e/{slug}`).
 *
 * No lanza excepciones: cualquier error (fetch, HTTP no-ok, JSON inválido,
 * dorsal ausente) se loga y se trata como "no encontrado" — el cron
 * reintentará en el siguiente check.
 */
export async function scrapeCruzandolameta(
  url: string,
  dorsal: string,
): Promise<RunnerResult | null> {
  const target = String(dorsal).trim();

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": CRUZANDOLAMETA_USER_AGENT,
      },
    });
  } catch (err) {
    console.error(`[scraper:cruzandolameta] Fetch failed for ${url}:`, err);
    return null;
  }

  if (!res.ok) {
    // 404 = evento o dorsal no encontrado (la prueba puede no estar
    // publicada todavía) — no es un error, es "no encontrado".
    if (res.status !== 404) {
      console.warn(`[scraper:cruzandolameta] HTTP ${res.status} for ${url}`);
    }
    return null;
  }

  let body: any;
  try {
    body = await res.json();
  } catch (err) {
    console.error(`[scraper:cruzandolameta] Respuesta no es JSON válido:`, err);
    return null;
  }

  const resultados: any[] = Array.isArray(body?.resultados) ? body.resultados : [];
  const entry = resultados.find((r) => {
    if (r == null) return false;
    return String(r.dorsal).trim() === target;
  });

  if (!entry) return null;

  if (entry.status !== "FINALIZADO" || entry.tiempo_oficial_ms == null) {
    // Dorsal presente pero sin tiempo oficial (abandonó, aún no ha cruzado
    // meta). No es un error: seguimos sin resultado válido.
    return null;
  }

  const timeMs = Number(entry.tiempo_oficial_ms);
  if (!Number.isFinite(timeMs) || timeMs <= 0) {
    console.warn(
      `[scraper:cruzandolameta] tiempo_oficial_ms inválido "${entry.tiempo_oficial_ms}" para dorsal ${dorsal}`,
    );
    return null;
  }

  const runnerName =
    [entry.nombre, entry.apellidos].filter(Boolean).join(" ").trim() || undefined;

  return {
    runnerName,
    positionOverall: toIntOrUndefined(entry.pos_general),
    positionCategory: toIntOrUndefined(entry.pos_cat),
    timeSeconds: Math.round(timeMs / 1000),
  };
}

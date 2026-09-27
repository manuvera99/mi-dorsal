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
  // Posición dentro de la categoría de género (M / F). Opcional: no todos
  // los cronometradores lo exponen.
  positionGender?: number;
  timeSeconds: number;

  // Sesión 27 sep 2026 — campos extendidos opcionales. Solo algunos
  // adapters los rellenan (sportmaniacs vía api/athletes). Cuando están,
  // el diploma y el email los usan para mostrar el tiempo neto (chip)
  // junto al oficial, los splits oficiales y la posición neta.
  netTimeSeconds?: number;
  positionOverallNet?: number;
  positionCategoryNet?: number;
  positionGenderNet?: number;
  pacePerKmSeconds?: number; // pace oficial (HH:MM / km)
  pacePerKmNetSeconds?: number; // pace neto (HH:MM / km)
  /**
   * Splits oficiales (no netos). Cada item: { name: "5K" | "10K" | ...,
   * timeSeconds, pacePerKmSeconds? }.
   */
  splits?: Array<{
    name: string;
    timeSeconds: number;
    pacePerKmSeconds?: number;
  }>;
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
const SPORTMANIACS_ATHLETES_ENDPOINT = "https://api-aws.sportmaniacs.com/api/athletes";
const SPORTMANIACS_USER_AGENT = "Mozilla/5.0 mi-dorsal/0.1";
// Constantes legacy mantenidas por compatibilidad (el adapter ya no las usa
// en su flujo principal — consulta directa a /api/athletes — pero las
// conservo porque scrapeSportmaniacsEvent() legacy podría invocarse desde
// tests o scripts externos).
const SPORTMANIACS_MAX_PAGES = 500;

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
 * Fallback por nombre (sesión 27 sep 2026, segunda capa): cuando el
 * cron llega a una carrera con `scraperAdapter === "sportmaniacs"` pero
 * `officialUrl` apunta a otro dominio (no tiene event-card accesible
 * vía discovery HTML) — exactamente lo que pasó con la XV 15K Nocturna
 * Valencia, donde `officialUrl` apuntaba a conocevalencia.es y el
 * discovery devolvía [] — buscamos el slug en el catálogo público de
 * Sportmaniacs por nombre y fecha.
 *
 * Flujo:
 *   1. GET https://sportmaniacs.com/es/api/races?text={nombre}&page=N
 *      → array de 25 hits por página.
 *   2. Filtrar por fecha (mismo año + mismo mes) y ciudad.
 *   3. Si queda 1 candidato, parar y avanzar al paso 4. Si quedan
 *      varios, seguir paginando hasta desambiguar. Si en MAX_PAGES
 *      páginas no hay match único → devolver [].
 *   4. Fetchear https://sportmaniacs.com/es/races/{slug} y pasar el
 *      HTML por `extractSportmaniacsEventCards`.
 *
 * **LIMITACIÓN CONOCIDA** (sesión 27 sep 2026, descubrimiento
 * durante implementación): el search API NO indexa todas las
 * carreras — populares viejas o con nombres genéricos ("Nocturna
 * Los Lagos", "Carrera Solidaria", etc.) no aparecen en el top-300
 * de hits. Verificado empíricamente: para "II CARRERA NOCTURNA LOS
 * LAGOS" (Alginet, 2026-07-18) el search devuelve 0 hits relevantes
 * en 12 páginas. **Esta función NO debe verse como solución
 * universal**, solo como un segundo intento antes de devolver [].
 *
 * Por qué NO auto-dispararse desde el cron:
 *   - Paginar 12 páginas × 5s timeout cada una = ~60s por carrera
 *     huérfana — no escala si tienes docenas pendientes.
 *   - Si la búsqueda no es 100% fiable (ver LIMITACIÓN), tampoco
 *     queremos que el cron gaste cuota sin garantía.
 *
 * Por tanto esta función queda EXPERTA vía
 * `devOnly/discoverSportmaniacs:discoverSportmaniacs` (action + 
 * mutation wrapper). El admin la invoca a mano cuando sospecha
 * una huérfana; si devuelve [], queda como antes: devOnly manual
 * para parchear la carrera, o esperar al próximo backfill masivo.
 *
 * Parámetros:
 *   - name: nombre de la carrera tal y como aparece en `races.name`.
 *   - raceDate: ISO date (YYYY-MM-DD). MUY recomendado.
 *   - city: ciudad opcional. Filtra `city` del hit.
 */
export async function discoverSportmaniacsEventIdsByName(
  name: string,
  raceDate?: string,
  city?: string,
): Promise<SportmaniacsEventRef[]> {
  if (!name || name.trim().length < 3) return [];

  // Limpiar el nombre para la búsqueda — quitar años, distancias
  // entre paréntesis y caracteres raros. Sportmaniacs suele indexar
  // por el "slug" limpio (ej: "15k-nocturna-valencia-gana-energia").
  const cleanName = name
    .replace(/\s*\(\d{4}\)\s*/g, " ") // (2026)
    .replace(/\s+\d{4}\s*/g, " ") // " 2026 "
    .replace(/\s+\d+\s*(km|K)\b/gi, " ") // " 15K"
    .replace(/['']/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Empezamos en página 1. **La search API devuelve carreras ordenadas
  // por futuro, NO por relevancia textual**, así que la edición 2026 de
  // una popular suele caer ~10-15 páginas hacia dentro. Vamos
  // paginando y parando en cuanto tengamos UN candidato válido
  // (filtros aplicados abajo).
  const baseSearch = `https://sportmaniacs.com/es/api/races?text=${encodeURIComponent(cleanName)}`;

  type Hit = {
    id: string;
    name: string;
    date: string;
    slug: string;
    country_id?: string;
    city?: string;
  };
  type SearchResp = {
    data: Hit[];
    status: string;
    totalPages?: number;
    pastPages?: number;
  };

  // Límite duro de páginas para no agotar CPU del cron si la
  // búsqueda nunca encuentra nada. 12 páginas × 25 hits = 300
  // carreras inspeccionadas — más que suficiente para el caso
  // típico (10-15 páginas). Si supera este límite, devolvemos []
  // y se reintenta en el siguiente cron. Verificado empíricamente
  // (sesión 27 sep 2026): la XV 15K Nocturna Valencia cae en página
  // 11 con query "Nocturna Valencia".
  const MAX_PAGES = 12;
  const FETCH_TIMEOUT_MS = 5000;

  // Función helper: cargar una página y devolver hits + metadatos.
  async function fetchPage(pageNum: number): Promise<{ hits: Hit[]; meta: SearchResp | null }> {
    try {
      const url = pageNum === 1 ? baseSearch : `${baseSearch}&page=${pageNum}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let res: Response | null = null;
      try {
        res = await fetch(url, {
          headers: {
            "User-Agent": SPORTMANIACS_USER_AGENT,
            "X-Requested-With": "XMLHttpRequest",
            Accept: "application/json",
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
      if (!res || !res.ok) {
        console.warn(
          `[scraper:sportmaniacs] search HTTP ${res.status} página ${pageNum} para "${cleanName}"`,
        );
        return { hits: [], meta: null };
      }
      const body = (await res.json()) as SearchResp;
      return { hits: Array.isArray(body?.data) ? body.data : [], meta: body };
    } catch (err) {
      console.error(
        `[scraper:sportmaniacs] search fetch failed page ${pageNum} for "${cleanName}":`,
        err,
      );
      return { hits: [], meta: null };
    }
  }

  // Estrategia de filtrado.
  // El filtro por fecha es CLAVE: si raceDate está disponible,
  // paramos en cuanto la PRIMERA página trae un único candidato
  // del mismo año y mismo mes (no usamos mes ±1 como con la search
  // original — la página exacta importa para evitar colisiones tipo
  // "San Silvestre" / "Carrera de la Mujer"). Si la página trae
  // varios del mismo mes, seguimos paginando hasta diferenciar.
  //
  // Si no hay raceDate, paramos al primer candidato ESP que sea
  // razonable (filtro por longitud y similitud básicos sobre el
  // nombre).
  function dateFilterAcceptable(hit: Hit): boolean {
    if (!raceDate || !/^\d{4}-\d{2}-\d{2}$/.test(raceDate)) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(hit.date)) return false;
    const tYear = Number(raceDate.slice(0, 4));
    const tMonth = Number(raceDate.slice(5, 7));
    const hYear = Number(hit.date.slice(0, 4));
    const hMonth = Number(hit.date.slice(5, 7));
    return tYear === hYear && tMonth === hMonth;
  }

  function nameSimilarityAcceptable(hit: Hit): boolean {
    // Match básico: el "core" del nombre (palabras >2 letras) tiene
    // un solapamiento >= 50% con las del nombre de la carrera target.
    // Esto evita aceptar "10K Almendralejo" cuando buscas
    // "XV 15K Nocturna Valencia".
    const norm = (s: string) =>
      s.toLowerCase().replace(/[^a-záéíóúñü0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2);
    const a = new Set(norm(hit.name));
    const b = norm(cleanName);
    if (b.length === 0 || a.size === 0) return true;
    let overlap = 0;
    for (const w of b) if (a.has(w)) overlap++;
    return overlap / b.length >= 0.4;
  }

  // Filtrado por ciudad opcional.
  function cityAcceptable(hit: Hit): boolean {
    if (!city || city.trim().length === 0) return true;
    if (!hit.city) return true; // si el hit no expone ciudad, no penalizamos
    return hit.city.toLowerCase().includes(city.toLowerCase());
  }

  // Primera página.
  let allHits: Hit[] = [];
  let totalPages = MAX_PAGES;
  {
    const { hits, meta } = await fetchPage(1);
    allHits = hits;
    if (meta && typeof meta.totalPages === "number") {
      totalPages = Math.min(meta.totalPages, MAX_PAGES);
    }
  }

  // Si NO hay raceDate, hacemos un primer intento de filtrado en
  // página 1 y, si obtenemos un único candidato ESP con similitud
  // razonable, paramos. Si no, paginamos.
  // Si HAY raceDate, usamos el primer filtrado estricto por
  // fecha y ciudad — y paramos en cuanto tengamos un solo match.
  let chosen: Hit | null = null;
  let triedPages = 1;

  function pickFromHits(hits: Hit[]): Hit | null {
    const esp = hits.filter((h) => h.country_id === "ESP" || true); // no restringir a ESP por ahora
    const filtered = esp.filter(
      (h) => dateFilterAcceptable(h) && cityAcceptable(h) && nameSimilarityAcceptable(h),
    );
    if (filtered.length === 1) return filtered[0];
    // Si hay varios del mismo mes Y mismo nombre exacto, return null (sigue paginando)
    return null;
  }

  chosen = pickFromHits(allHits);

  while (!chosen && triedPages < totalPages) {
    triedPages++;
    const { hits, meta } = await fetchPage(triedPages);
    if (hits.length === 0) break;
    allHits = allHits.concat(hits);
    chosen = pickFromHits(hits);
  }

  if (!chosen) {
    if (allHits.length === 0) {
      console.warn(
        `[scraper:sportmaniacs] search sin resultados para "${cleanName}"`,
      );
    } else {
      console.warn(
        `[scraper:sportmaniacs] ${triedPages} páginas sin match único para "${cleanName}" (${allHits.length} hits totales); no desambiguable`,
      );
    }
    return [];
  }

  // Ahora `chosen` es nuestro candidato.
  const raceUrl = `https://sportmaniacs.com/es/races/${chosen.slug}`;

  let html: string;
  try {
    const res = await fetch(raceUrl, {
      headers: {
        "User-Agent": SPORTMANIACS_USER_AGENT,
        Accept: "text/html",
      },
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch (err) {
    console.error(
      `[scraper:sportmaniacs] race-html fetch failed for ${raceUrl}:`,
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
 * Sesión 27 sep 2026 — cambio grande: el endpoint anterior
 * (/api/rankings?event=X&page=Y) solo expone `officialTime` (tiempo
 * desde tu ola de salida) y exige paginar hasta encontrar el dorsal
 * (hasta 415 páginas en carreras grandes como la 15K Nocturna Valencia).
 *
 * Sportmaniacs expone otro endpoint `/api/athletes?event=X&dorsal=Y` que
 * devuelve en UNA sola llamada:
 *   - Tiempo oficial (splitTime) y neto (splitTimeNet)
 *   - Posiciones oficial y neta (overall/category/gender)
 *   - Splits 5K/10K/15K/etc con tiempo y pace oficiales y netos
 *   - Pace medio oficial y neto
 *
 * Eso es 1 request en vez de 415, y tenemos el tiempo neto que era
 * prioritario para el corredor popular (el "oficial" incluye los minutos
 * de espera en el cajón de salida antes del disparo).
 *
 * Si /api/athletes no devuelve nada (carrera vieja sin ese endpoint,
 * dorsal no clasificado aún), caemos al endpoint legacy paginado.
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

  // Ruta rápida: /api/athletes devuelve datos completos por dorsal.
  for (const { eventId } of eventIds) {
    const direct = await scrapeSportmaniacsAthlete(eventId, dorsal);
    if (direct) return direct;
  }

  // Fallback legacy: si /api/athletes no devuelve nada (carrera sin
  // soporte), paginar /api/rankings. Mucho más lento pero compatible con
  // cualquier carrera histórica.
  console.log(
    `[scraper:sportmaniacs] /api/athletes no devolvió nada para dorsal ${dorsal}, fallback a paginación`,
  );
  for (const { eventId } of eventIds) {
    const result = await scrapeSportmaniacsEvent(eventId, dorsal);
    if (result) return result;
  }
  return null;
}

/**
 * Endpoint rápido: una sola llamada a /api/athletes con dorsal=X nos
 * devuelve los datos completos del corredor (oficial + neto + splits).
 * Devuelve null si el dorsal no aparece (puede ser que aún no esté
 * clasificado o que el endpoint no exista para carreras muy viejas).
 */
async function scrapeSportmaniacsAthlete(
  eventId: string,
  dorsal: string,
): Promise<RunnerResult | null> {
  const target = String(dorsal).trim();
  const apiUrl = `${SPORTMANIACS_ATHLETES_ENDPOINT}?event=${encodeURIComponent(eventId)}&dorsal=${encodeURIComponent(target)}`;

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
    console.warn(`[scraper:sportmaniacs] /api/athletes fetch failed:`, err);
    return null;
  }

  if (!res.ok) {
    console.warn(
      `[scraper:sportmaniacs] /api/athletes HTTP ${res.status} para dorsal ${target}`,
    );
    return null;
  }

  let body: any;
  try {
    body = await res.json();
  } catch {
    return null;
  }
  if (!body || body.status !== "ok" || !body.data || typeof body.data !== "object") {
    return null;
  }

  const d = body.data;
  // El endpoint devuelve data aunque el dorsal NO esté en la carrera —
  // distingue por coincidencia exacta del dorsal (string match).
  const dorsalEnRespuesta = String(d.dorsal ?? d.bib ?? "").trim();
  if (dorsalEnRespuesta !== target) {
    // No es nuestro dorsal (puede ser que la API haya devuelto otro
    // corredor). Tratamos como "no encontrado" para este eventId.
    return null;
  }

  // Tiempo oficial (Meta.splitTime) es lo que necesitamos como timeSeconds
  // (mantenemos compatibilidad con PR detection y email). El neto va aparte.
  const meta = d.Meta ?? {};
  const officialTimeStr: string | undefined = meta.splitTime;
  const netTimeStr: string | undefined = meta.splitTimeNet;
  const officialSeconds = officialTimeStr ? parseTime(officialTimeStr) : null;
  const netSeconds = netTimeStr ? parseTime(netTimeStr) : null;

  if (!officialSeconds || officialSeconds <= 0) {
    // Dorsal presente pero sin tiempo oficial (aún no clasificado o
    // abandonó). El cron reintentará en el siguiente check.
    return null;
  }

  // Splits: filtramos "Meta" (es el total, no un parcial) y armamos
  // la lista de parciales oficiales. Algunos vienen con segundos
  // legibles (00:31:52), otros no — si el parse falla, los omitimos.
  const rawSplits: any[] = Array.isArray(d.Points) ? d.Points : [];
  const splits: RunnerResult["splits"] = [];
  for (const s of rawSplits) {
    if (!s || s.split_name === "Meta" || !s.splitTime) continue;
    const ts = parseTime(String(s.splitTime));
    if (ts == null || ts <= 0) continue;
    splits.push({
      name: String(s.split_name),
      timeSeconds: ts,
      pacePerKmSeconds: undefined, // el API no expone pace por split
    });
  }

  return {
    runnerName: d.complete_name ?? undefined,
    positionOverall: toIntOrUndefined(meta.overallPosition),
    positionCategory: toIntOrUndefined(meta.categoryPosition),
    positionGender: toIntOrUndefined(meta.genderPosition),
    timeSeconds: officialSeconds,
    netTimeSeconds: netSeconds ?? undefined,
    positionOverallNet: toIntOrUndefined(meta.overallPositionNet),
    positionCategoryNet: toIntOrUndefined(meta.categoryPositionNet),
    positionGenderNet: toIntOrUndefined(meta.genderPositionNet),
    // average viene como "06m 03s / km" o "05m 55s / km". parseTime lo
    // entiende porque "06m 03s" parsea a 363s, y el /km lo ignoramos
    // (pace es tiempo por km, no tiempo por km * 1).
    pacePerKmSeconds: meta.average ? parseTime(meta.average) ?? undefined : undefined,
    pacePerKmNetSeconds: meta.averageNet
      ? parseTime(meta.averageNet) ?? undefined
      : undefined,
    splits: splits.length > 0 ? splits : undefined,
  };
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

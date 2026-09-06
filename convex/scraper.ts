// =============================================================================
// mi-dorsal — Scraper de resultados
// =============================================================================
// Adapters por cronometrador. Cada uno sabe cómo parsear el HTML de su sitio.
// =============================================================================

import * as cheerio from "cheerio";

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

/**
 * Punto de entrada: scrapea la URL buscando el dorsal, usando el adapter apropiado.
 *
 * Casos especiales (JSON-based, no HTML):
 *   - `chiplevante` → endpoint AJAX propio.
 *   - `sportmaniacs` → endpoint API público de Sportmaniacs.
 * Por eso los despachamos ANTES del fetch HTML.
 */
export async function scrapeResults(
  url: string,
  dorsal: string,
  adapterName?: string,
): Promise<RunnerResult | null> {
  if (adapterName === "chiplevante") {
    return scrapeChiplevante(url, dorsal);
  }
  if (adapterName === "sportmaniacs") {
    return scrapeSportmaniacs(url, dorsal);
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

function toIntOrUndefined(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// ---------------------------------------------------------------------------
// Adapter: Sportmaniacs (sportmaniacs.com / api-aws.sportmaniacs.com)
// ---------------------------------------------------------------------------
//
// Sportmaniacs es la mayor plataforma de inscripciones + cronometraje del
// running popular español. Cubre cientos de carreras en todo el país
// (muchas de las grandes maratones y medias están aquí: Zurich Marató
// Barcelona, Maratón Sevilla, Mitja Marató Barcelona, eBay Maratón
// Zaragoza, y muchísimas populares locales).
//
// **Limitación importante de la API pública**: el endpoint que devuelve
// el ranking completo de una carrera (`/api/events/{uuid}/race-rankings`)
// solo expone `data.Rankings[]` cuando la carrera está en vivo o recién
// pasada. Una vez que se archiva, devuelve `ranking: false` y
// `Rankings: []`. Por tanto el adapter:
//
//   1. Funcionará en cuanto se publiquen los resultados de cada carrera.
//   2. Devolverá `null` si la carrera aún no tiene resultados públicos.
//   3. NO hace falta hacer reintentos: el cron de `checkResults` se ejecuta
//      periódicamente y volverá a probar cada pocas horas.
//
// URL típica de la carrera en la webapp:
//   https://sportmaniacs.com/es/races/{slug}/{event-uuid}/results
//   https://sportmaniacs.com/es/races/{slug}/{event-uuid}/rankings
//   https://sportmaniacs.com/es/races/{slug}/{event-uuid}/live
//
// Endpoint API:
//   GET https://api-aws.sportmaniacs.com/api/events/{event-uuid}/race-rankings
//   Headers: X-Requested-With: XMLHttpRequest, Origin/Referer: sportmaniacs.com
//   Respuesta:
//     { data: {
//         Event: {id, idEvent, name, distance, ranking, has_diploma, ...},
//         Race: {idRace, name, slug, ...},
//         Splits: [...],
//         Categories: [...],
//         Rankings: [
//           { dorsal, name, club, category, gender,
//             pos, posCategory, posGender,
//             officialTime, realTime, ... },
//           ...
//         ],
//         Averages: {...},
//         Summary: [...]
//     }, status: "ok" }
//
// Cuando no hay resultados: data.Rankings = [] y data.Event.ranking = false.
// ---------------------------------------------------------------------------

const SPORTMANIACS_API_BASE = "https://api-aws.sportmaniacs.com/api";
const SPORTMANIACS_USER_AGENT = "Mozilla/5.0 mi-dorsal/0.1";

/**
 * Extrae el event UUID de una URL de sportmaniacs.com.
 * Devuelve null si la URL no encaja con el patrón.
 *
 * Acepta tanto `sportmaniacs.com` como `api-aws.sportmaniacs.com`.
 * El UUID siempre está en el path: `/races/{slug}/{uuid}/...` o
 * `/events/{uuid}/...` o `/api/events/{uuid}/...`.
 */
export function parseSportmaniacsUrl(url: string): { event: string } | null {
  // Buscamos un UUID v4 en cualquier punto del path después de sportmaniacs.com.
  // Esto cubre todos los formatos:
  //   /es/races/{slug}/{event-uuid}/results   (webapp)
  //   /races/{slug}/{event-uuid}/rankings     (webapp, sin lang)
  //   /races/rankings/{event-uuid}            (webapp classic)
  //   /rankings/{event-uuid}                  (webapp classic, short)
  //   /api/events/{event-uuid}/...            (api-aws.sportmaniacs.com)
  //   /api/races/{event-uuid}/...             (api-aws)
  const m = url.match(
    /sportmaniacs\.com\/[^\s?#]*?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );
  if (!m) return null;
  return { event: m[1] };
}

/**
 * Adapter principal: scrapea sportmaniacs.com buscando el dorsal del corredor.
 * Devuelve null si:
 *   - la URL no es de sportmaniacs.com
 *   - el endpoint devuelve 4xx/5xx
 *   - la carrera no tiene resultados públicos (Rankings = [])
 *   - el dorsal no aparece en los Rankings
 *
 * No lanza excepciones: cualquier error se loga y se trata como "no encontrado".
 */
export async function scrapeSportmaniacs(
  url: string,
  dorsal: string,
): Promise<RunnerResult | null> {
  const parsed = parseSportmaniacsUrl(url);
  if (!parsed) {
    console.warn(`[scraper:sportmaniacs] URL no encaja con el patrón: ${url}`);
    return null;
  }
  const { event } = parsed;

  const apiUrl = `${SPORTMANIACS_API_BASE}/events/${event}/race-rankings`;

  let res: Response;
  try {
    res = await fetch(apiUrl, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": SPORTMANIACS_USER_AGENT,
        "X-Requested-With": "XMLHttpRequest",
        Origin: "https://sportmaniacs.com",
        Referer: `https://sportmaniacs.com/es/races//${event}/results`,
      },
    });
  } catch (err) {
    console.error(`[scraper:sportmaniacs] Fetch failed for ${apiUrl}:`, err);
    return null;
  }

  if (!res.ok) {
    // 404 y similares son esperados: la API devuelve `{"status":"ko"}` con 200
    // para carreras que no expone, pero también puede devolver 404 si el endpoint
    // cambió. Lo tratamos como "sin resultados" sin log de error.
    if (res.status === 404) {
      console.log(`[scraper:sportmaniacs] 404 for ${apiUrl} (endpoint cambió o carrera sin datos)`);
      return null;
    }
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

  // Estructura: { data: { Event, Race, Splits, Categories, Rankings, ... }, status }
  // Si status != "ok" o no hay data, devolvemos null (sin error).
  if (!body || body.status !== "ok" || !body.data) {
    return null;
  }

  const rankings: any[] = body.data.Rankings || [];

  // Si Rankings está vacío, la carrera aún no tiene resultados públicos.
  // NO es un error, simplemente el endpoint público no los expone aún.
  if (rankings.length === 0) {
    console.log(
      `[scraper:sportmaniacs] Carrera ${event} sin Rankings públicos (puede ser que aún no se han publicado)`,
    );
    return null;
  }

  // Buscar el dorsal. Los dorsales pueden ser number o string según la carrera.
  const target = String(dorsal).trim();
  const entry = rankings.find((r) => {
    if (r == null) return false;
    const d = r.dorsal ?? r.bib ?? r.dorsalNumber;
    return d != null && String(d).trim() === target;
  });

  if (!entry) {
    // No es un error: el corredor puede que no participara o no haya terminado.
    return null;
  }

  // Campos confirmados del JSON del bundle Sportmaniacs:
  //   dorsal, name, club, category, pos, posCategory, posGender,
  //   officialTime (HH:MM:SS), realTime (HH:MM:SS)
  // Los nombres exactos los verificamos empíricamente; si difieren,
  // hay fallbacks abajo.
  const runnerName =
    entry.name ?? entry.fullName ?? entry.athleteName ?? undefined;
  const officialTime =
    entry.officialTime ?? entry.time ?? entry.finishTime ?? entry.netTime;
  const positionOverall = toIntOrUndefined(
    entry.pos ?? entry.position ?? entry.positionOverall,
  );
  const positionCategory = toIntOrUndefined(
    entry.posCategory ?? entry.categoryPos ?? entry.positionCategory,
  );

  if (officialTime == null) {
    console.warn(
      `[scraper:sportmaniacs] Dorsal ${dorsal} en carrera ${event} sin officialTime (¿abandonó?)`,
    );
    return null;
  }

  const timeSeconds = parseTime(String(officialTime));
  if (timeSeconds == null || timeSeconds <= 0) {
    console.warn(
      `[scraper:sportmaniacs] Tiempo inválido "${officialTime}" para dorsal ${dorsal} en carrera ${event}`,
    );
    return null;
  }

  return {
    runnerName: runnerName || undefined,
    positionOverall,
    positionCategory,
    timeSeconds,
  };
}

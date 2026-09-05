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
 * Caso especial: `chiplevante` no se basa en parsear HTML — tiene un endpoint
 * AJAX público (`/secciones/clasificaciones/dame_id_corredor.php`) que devuelve
 * JSON con `tiempo_oficial`, `pos_carrera`, `pos_categoria` directamente.
 * Por eso lo despachamos ANTES del fetch HTML.
 */
export async function scrapeResults(
  url: string,
  dorsal: string,
  adapterName?: string,
): Promise<RunnerResult | null> {
  if (adapterName === "chiplevante") {
    return scrapeChiplevante(url, dorsal);
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

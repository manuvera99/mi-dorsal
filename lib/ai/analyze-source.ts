// =============================================================================
// lib/ai/analyze-source.ts
// =============================================================================
// Analiza una URL de una web de carreras para extraer metadata de la fuente.
// Esto NO extrae carreras individuales — para eso está extract-race.ts.
// Aquí analizamos la web a nivel "fuente": qué es, cómo scrapearía, etc.
// =============================================================================

export interface ExtractedSource {
  name: string;
  slug: string;
  type: "scraper" | "api" | "manual";
  description: string;
  baseUrl: string;
  format: "html" | "pdf" | "calendar" | "api" | "json" | "rss" | "unknown";
  /** URL de la página índice/listado de carreras (si la hay) */
  raceListUrl?: string;
  /** 2-3 URLs de ejemplo de páginas de carrera individual (si están visibles) */
  sampleRaceUrls: string[];
  /** Estimación de cuántas carreras futuras puede tener esta fuente */
  estimatedRaces?: number;
  /** 1-2 frases de estrategia recomendada para scrapear */
  recommendedStrategy: string;
  /** Dificultades / bloqueos detectados */
  difficulties: string[];
  /** Tipos de carrera que publica */
  raceTypes: Array<"road" | "trail" | "mixed" | "obstacle" | "other">;
  /** Foco geográfico: "España", "Valencia", "internacional", etc. */
  geoFocus: string;
  /** Confianza del análisis: el LLM está seguro de su output */
  confidence: "high" | "medium" | "low";
  /** Notas adicionales (opcional) */
  notes?: string;
}

// Reutilizamos la utilidad de strip think blocks de extract-race.ts.
// Si en el futuro se mueve a un módulo común, importamos desde ahí.

import { cleanUrl } from "./clean-url";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

function stripThinkBlocks(text: string): string {
  if (!text) return text;
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (!cleaned && text.includes("<think>")) {
    const tail = text.split("</think>").pop()?.trim();
    if (tail) cleaned = tail;
  }
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  return cleaned;
}

function parseJsonLoose(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // fall through
      }
    }
    throw new Error(`No se pudo parsear JSON. Texto: ${text.slice(0, 200)}`);
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/**
 * Analiza una URL y devuelve metadata estructurada de la fuente.
 */
export async function analyzeDataSource(url: string): Promise<ExtractedSource | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY no configurado. Añádelo en .env.local y Vercel.",
    );
  }

  // Limpiar URL: quitar BOM, zero-width, non-ASCII, etc.
  url = cleanUrl(url);
  if (!/^https?:\/\//.test(url)) {
    throw new Error("URL inválida. Debe empezar por http:// o https://");
  }

  const baseUrl = (process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const isMiniMax = /minimax/i.test(baseUrl);

  // 1. Fetch la URL
  const html = await fetchUrl(url);
  const text = htmlToText(html).slice(0, 14000); // algo más que para race, hay más que analizar

  // 2. Llamar al LLM
  const systemPrompt = `Eres un asistente experto en scraping de webs de carreras populares (running).
Tu trabajo: dada una URL y el HTML/texto de la página, analizar la web como POSIBLE FUENTE de datos
para un agregador de carreras, y devolver metadata estructurada.

Devuelve SOLO un JSON con estos campos (sin texto extra, sin markdown):

{
  "name": string,                      // Nombre legible (ej: "RFEA", "Sportmaniacs", "Runedia")
  "slug": string,                      // slug URL-safe en minúsculas sin tildes (ej: "rfea", "sportmaniacs"). Genera del name si no se deduce.
  "type": "scraper" | "api" | "manual", // scraper = web HTML scrapeable; api = tiene API pública/JSON; manual = no scrapeable (anti-bot, login, etc.)
  "description": string,               // 1-2 frases: qué es la web, qué publica
  "baseUrl": string,                   // URL raíz canónica (ej: "https://www.rfea.es")
  "format": "html" | "pdf" | "calendar" | "api" | "json" | "rss" | "unknown",  // Formato principal del contenido
  "raceListUrl": string | null,        // URL de la página donde lista carreras (calendario/index), o null si no se ve
  "sampleRaceUrls": string[],          // 2-3 URLs de ejemplo de páginas de carrera individual que aparezcan enlazadas
  "estimatedRaces": number | null,     // Estimación de carreras futuras publicadas (puede ser null si no se puede estimar)
  "recommendedStrategy": string,       // 1-2 frases: cómo scrapear (selectores CSS, paginación, JS rendering, etc.)
  "difficulties": string[],            // Lista de problemas: ["Anti-bot Cloudflare", "Requiere JS para renderizar", "Login requerido", "PDF parseado complejo", etc.]. Vacío si scrapeable fácil.
  "raceTypes": string[],               // Tipos: ["road"], ["trail"], ["mixed"], ["obstacle"], ["other"]. Vacío si no se sabe.
  "geoFocus": string,                  // Foco geográfico: "España", "Comunidad Valenciana", "Madrid", "Internacional", etc.
  "confidence": "high" | "medium" | "low",  // Tu confianza en el análisis. "low" si la URL es una página de carrera individual, no una fuente.
  "notes": string | null               // Notas adicionales opcionales
}

REGLAS:
- Si la URL es una PÁGINA DE CARRERA INDIVIDUAL (no un índice/listado de carreras), marca confidence="low" y explica en notes que es una sola carrera.
- Si la web tiene calendario/calendario.php/calendario.html, sugiere esa URL en raceListUrl.
- Sé conciso en description (max 200 chars).
- NO inventes datos. Si no ves nada, devuelve null/[]/"".

IDIOMA: todos los textos (description, recommendedStrategy, difficulties, notes) en español.`;

  const userPrompt = `URL: ${url}

Contenido de la web (texto limpio, sin HTML):
"""
${text}
"""

Analiza la web como fuente de datos para scraping.`;

  const payload: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  };

  if (isMiniMax) {
    payload.extra_body = { thinking: { type: "disabled" } };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 50_000);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e?.name === "AbortError") {
      throw new Error(`Timeout (50s) llamando a ${baseUrl} con ${model}`);
    }
    throw new Error(`Error de red: ${e?.message ?? e}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 400 && /response_format/i.test(errText)) {
      delete payload.response_format;
      const retry = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      if (!retry.ok) {
        const t = await retry.text();
        throw new Error(`LLM error ${retry.status} (sin response_format): ${t.slice(0, 300)}`);
      }
      const data2 = await retry.json();
      const c2 = data2?.choices?.[0]?.message?.content;
      if (!c2) throw new Error("LLM no devolvió contenido");
      return sanitize(parseJsonLoose(stripThinkBlocks(c2)), url);
    }
    throw new Error(`LLM error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM no devolvió contenido");

  return sanitize(parseJsonLoose(stripThinkBlocks(content)), url);
}

async function fetchUrl(url: string): Promise<string> {
  // Defense in depth: limpiar URL de nuevo antes de fetch
  url = cleanUrl(url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; mi-dorsal/1.0; +https://mi-dorsal.es)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-ES,es;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Fetch error ${res.status} al acceder a ${url}`);
    }
    return await res.text();
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error(`Timeout (15s) al hacer fetch de ${url}`);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const VALID_TYPES = new Set(["road", "trail", "mixed", "obstacle", "other"]);
const VALID_FORMATS = new Set(["html", "pdf", "calendar", "api", "json", "rss", "unknown"]);
const VALID_SOURCE_TYPES = new Set(["scraper", "api", "manual"]);

function sanitize(r: any, fallbackUrl: string): ExtractedSource {
  const name = String(r?.name ?? "Sin nombre").slice(0, 100);
  const rawSlug = String(r?.slug ?? "").trim();
  const slug = rawSlug && /^[a-z0-9-]+$/.test(rawSlug)
    ? rawSlug
    : slugify(name) || slugify(fallbackUrl);

  const st = String(r?.type ?? "scraper").toLowerCase();
  const fmt = String(r?.format ?? "html").toLowerCase();
  const raceTypes = Array.isArray(r?.raceTypes)
    ? r.raceTypes.filter((t: any) => VALID_TYPES.has(String(t).toLowerCase()))
    : [];
  const difficulties = Array.isArray(r?.difficulties)
    ? r.difficulties.map((d: any) => String(d).slice(0, 200)).filter(Boolean)
    : [];
  const sampleRaceUrls = Array.isArray(r?.sampleRaceUrls)
    ? r.sampleRaceUrls
        .filter((u: any) => typeof u === "string" && /^https?:\/\//.test(u))
        .slice(0, 5)
    : [];

  let baseUrl = String(r?.baseUrl ?? fallbackUrl).trim();
  try {
    const u = new URL(baseUrl);
    baseUrl = `${u.protocol}//${u.host}`;
  } catch {
    // keep as-is
  }

  return {
    name,
    slug,
    type: (VALID_SOURCE_TYPES.has(st) ? st : "scraper") as "scraper" | "api" | "manual",
    description: String(r?.description ?? "").slice(0, 500),
    baseUrl,
    format: (VALID_FORMATS.has(fmt) ? fmt : "html") as ExtractedSource["format"],
    raceListUrl: r?.raceListUrl && /^https?:\/\//.test(r.raceListUrl)
      ? r.raceListUrl
      : undefined,
    sampleRaceUrls,
    estimatedRaces: typeof r?.estimatedRaces === "number" && r.estimatedRaces > 0
      ? r.estimatedRaces
      : undefined,
    recommendedStrategy: String(r?.recommendedStrategy ?? "").slice(0, 500),
    difficulties,
    raceTypes: raceTypes as ExtractedSource["raceTypes"],
    geoFocus: String(r?.geoFocus ?? "").slice(0, 100),
    confidence: ["high", "medium", "low"].includes(r?.confidence) ? r.confidence : "low",
    notes: r?.notes ? String(r.notes).slice(0, 500) : undefined,
  };
}

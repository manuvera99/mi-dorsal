// =============================================================================
// lib/ai/extract-race.ts
// =============================================================================
// Extrae info de una carrera desde una URL usando un LLM OpenAI-compatible.
// Por defecto OpenAI; configurable a MiniMax M3 u otro proveedor vía env.
//
// Env vars:
//   OPENAI_API_KEY      — required
//   OPENAI_BASE_URL     — optional, default https://api.openai.com/v1
//   OPENAI_MODEL        — optional, default gpt-4o-mini
//
// Para usar MiniMax M3 (gratis vía Maverick / Correr):
//   OPENAI_BASE_URL=https://api.minimax.io/v1
//   OPENAI_MODEL=MiniMax-M3
//   OPENAI_API_KEY=sk-cp-...
// =============================================================================

export interface ExtractedRace {
  name: string;
  startDate?: string;
  locality?: string;
  province?: string;
  distanceKm?: number;
  raceType?: "road" | "trail" | "mixed" | "obstacle";
  description?: string;
  organizer?: string;
  officialUrl?: string;
  registrationUrl?: string;
  imageUrl?: string;
  elevationGainM?: number;
}

const PROVINCES = [
  "alicante", "valencia", "castellon", "murcia", "albacete",
  "ciudad real", "cuenca", "guadalajara", "toledo",
  "almeria", "granada", "jaen", "malaga", "cordoba", "sevilla", "huelva", "cadiz",
  "huesca", "zaragoza", "teruel",
  "barcelona", "girona", "tarragona", "lleida",
  "mallorca", "menorca", "ibiza",
  "las palmas", "santa cruz de tenerife",
  "madrid", "vizcaya", "gipuzkoa", "alava", "navarra", "asturias", "cantabria",
  "a coruna", "lugo", "ourense", "pontevedra",
  "la rioja", "caceres", "badajoz",
  "leon", "zamora", "salamanca", "valladolid", "palencia", "burgos", "soria", "avila", "segovia",
  "ceuta", "melilla",
];

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

/** MiniMax-M3 leaks <think>...</think> blocks; strip them. */
function stripThinkBlocks(text: string): string {
  if (!text) return text;
  // Closed think block
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  // If response is only an unclosed think, try to recover tail
  if (!cleaned && text.includes("<think>")) {
    const tail = text.split("</think>").pop()?.trim();
    if (tail) cleaned = tail;
  }
  // Strip markdown code fences the model may add even with response_format
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  return cleaned;
}

/**
 * Extrae info de una carrera desde una URL usando un LLM.
 * Devuelve null si no hay API key. Lanza error si falla.
 */
export async function extractRaceFromUrl(url: string): Promise<ExtractedRace | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY no configurado. Añádelo en .env.local y Vercel. " +
        "Para MiniMax M3, también necesitas OPENAI_BASE_URL=https://api.minimax.io/v1 y OPENAI_MODEL=MiniMax-M3."
    );
  }

  const baseUrl = (process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const isMiniMax = /minimax/i.test(baseUrl);

  // 1. Fetch la URL
  const html = await fetchUrl(url);

  // 2. Limpiar HTML (quitar scripts, estilos, comentarios)
  const text = htmlToText(html).slice(0, 12000); // max ~12k chars para el LLM

  // 3. Llamar al LLM
  const systemPrompt = `Eres un asistente que extrae información de carreras populares de España desde el contenido de una web.
Devuelve SOLO un JSON con estos campos (sin texto extra, sin markdown):
{
  "name": string,                       // Nombre de la carrera
  "startDate": string | null,           // Fecha en formato YYYY-MM-DD o null
  "locality": string | null,            // Ciudad/pueblo
  "province": string | null,            // Una de: ${PROVINCES.join(", ")} (en minúsculas, sin tildes, formato slug). null si no sabes
  "distanceKm": number | null,          // Distancia en km (puede haber varias; toma la principal)
  "raceType": "road" | "trail" | "mixed" | "obstacle" | null,  // Tipo
  "description": string | null,         // Descripción corta (max 300 chars)
  "organizer": string | null,            // Nombre del organizador
  "officialUrl": string | null,         // URL oficial
  "registrationUrl": string | null,     // URL de inscripción
  "imageUrl": string | null,            // URL del cartel/imagen
  "elevationGainM": number | null       // Desnivel en metros
}

Si falta información, devuelve null en ese campo. NO inventes datos.`;

  const userPrompt = `URL: ${url}

Contenido de la web:
"""
${text}
"""

Extrae la información de la carrera.`;

  // Build payload
  const payload: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  };

  // MiniMax M3: disable thinking for fast responses (~2-4s vs 80-120s)
  if (isMiniMax) {
    payload.extra_body = { thinking: { type: "disabled" } };
  }

  // 50s timeout to stay under Vercel Pro 60s (free plan 10s will fail anyway — scrape from server action is best-effort)
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
    throw new Error(`Error de red llamando al LLM: ${e?.message ?? e}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const errText = await res.text();
    // Si falla con response_format (algunos clones no lo soportan), reintenta sin él
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
      const content2 = data2?.choices?.[0]?.message?.content;
      if (!content2) throw new Error("LLM no devolvió contenido");
      const cleaned2 = stripThinkBlocks(content2);
      return sanitize(parseJsonLoose(cleaned2));
    }
    throw new Error(`LLM error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM no devolvió contenido");

  const cleaned = stripThinkBlocks(content);
  return sanitize(parseJsonLoose(cleaned));
}

async function fetchUrl(url: string): Promise<string> {
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

/** Parsea JSON tolerante: a veces el modelo envuelve con texto extra pese a response_format. */
function parseJsonLoose(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    // Intenta extraer el primer {...} balanceado
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // fall through
      }
    }
    throw new Error(`No se pudo parsear JSON del LLM. Texto: ${text.slice(0, 200)}`);
  }
}

function sanitize(r: any): ExtractedRace {
  return {
    name: String(r?.name ?? "").slice(0, 200),
    startDate: r?.startDate && /^\d{4}-\d{2}-\d{2}$/.test(r.startDate) ? r.startDate : undefined,
    locality: r?.locality ? String(r.locality).slice(0, 100) : undefined,
    province: PROVINCES.includes(r?.province) ? r.province : undefined,
    distanceKm: typeof r?.distanceKm === "number" && r.distanceKm > 0 ? r.distanceKm : undefined,
    raceType: ["road", "trail", "mixed", "obstacle"].includes(r?.raceType) ? r.raceType : undefined,
    description: r?.description ? String(r.description).slice(0, 500) : undefined,
    organizer: r?.organizer ? String(r.organizer).slice(0, 100) : undefined,
    officialUrl: r?.officialUrl && /^https?:\/\//.test(r.officialUrl) ? r.officialUrl : undefined,
    registrationUrl: r?.registrationUrl && /^https?:\/\//.test(r.registrationUrl) ? r.registrationUrl : undefined,
    imageUrl: r?.imageUrl && /^https?:\/\//.test(r.imageUrl) ? r.imageUrl : undefined,
    elevationGainM: typeof r?.elevationGainM === "number" && r.elevationGainM > 0 ? r.elevationGainM : undefined,
  };
}

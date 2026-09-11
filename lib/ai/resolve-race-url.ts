// =============================================================================
// lib/ai/resolve-race-url.ts
// =============================================================================
// Cuando la `officialUrl` conocida de una carrera está muerta (404/5xx), esta
// función intenta encontrar la web real del organizador vía búsqueda web
// (Brave Search API) + verificación de confianza con el mismo LLM que ya usa
// extract-race-deep.ts.
//
// Por qué hace falta: confirmado con datos reales (auditoría 2026-09-11) que
// ~2200 carreras (98% de Sportmaniacs) nunca se han enriquecido porque su
// officialUrl guardada ya no resuelve — no es un problema de formato de URL
// corregible por patrón, las páginas fueron borradas o nunca existieron.
// No hay ninguna fuente barata (API de Sportmaniacs no trae web externa del
// organizador) — la búsqueda web es la única vía real.
//
// Coste: Brave Search API, ~$5 por 1000 queries (tier gratuito incluye
// ~$5/mes de crédito ≈ 1000 búsquedas). Se registra en aiUsageLog con
// functionLabel "resolve_race_url" para trazabilidad en /admin/ai-usage,
// con un coste aproximado fijo (no es un LLM, no tiene tokens de input/output
// reales que medir de la misma forma).
// =============================================================================

import { cleanUrl } from "./clean-url";
import { logAiUsage } from "./log-usage";

export interface ResolvedRaceUrl {
  url: string;
  confidence: "high" | "medium" | "low";
  searchQuery: string;
}

interface BraveSearchResult {
  title: string;
  url: string;
  description?: string;
}

const BRAVE_SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

/**
 * Busca en la web la URL oficial de una carrera cuya `officialUrl` conocida
 * está muerta. Devuelve null si Brave Search no está configurado, si no hay
 * resultados, o si el LLM no encuentra ningún candidato suficientemente
 * fiable como para ser la web oficial de ESTA carrera concreta.
 */
export async function resolveRaceUrl(race: {
  name: string;
  locality?: string;
  province?: string;
  startDate?: string;
}): Promise<ResolvedRaceUrl | null> {
  const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!braveApiKey) {
    // Sin key configurada: no es un error, simplemente esta función no
    // hace nada (comportamiento equivalente a no tenerla implementada).
    return null;
  }

  const year = race.startDate?.slice(0, 4);
  const place = race.locality ?? race.province ?? "";
  const searchQuery = [race.name, place, "carrera", year].filter(Boolean).join(" ");

  const results = await braveSearch(searchQuery, braveApiKey);
  if (!results || results.length === 0) return null;

  const chosen = await pickOfficialUrl(race, results);
  if (!chosen) return null;

  return { ...chosen, searchQuery };
}

async function braveSearch(
  query: string,
  apiKey: string,
): Promise<BraveSearchResult[] | null> {
  const url = `${BRAVE_SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&count=5`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  const t0 = Date.now();

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": cleanUrl(apiKey),
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      logAiUsage({
        functionLabel: "resolve_race_url",
        model: "brave-search",
        provider: "brave.com",
        // Ver nota en lib/ai/pricing.ts: 1000 "tokens" de input modelan
        // el coste fijo de $5/1000 requests de Brave Search. Se cuenta
        // igual aunque la request falle — Brave ya cobró el request.
        promptTokens: 1000,
        completionTokens: 0,
        success: false,
        errorMessage: `Brave Search error ${res.status}`,
        durationMs: Date.now() - t0,
      });
      return null;
    }

    const data = await res.json();
    const webResults = data?.web?.results ?? [];
    logAiUsage({
      functionLabel: "resolve_race_url",
      model: "brave-search",
      provider: "brave.com",
      promptTokens: 1000,
      completionTokens: 0,
      success: true,
      durationMs: Date.now() - t0,
    });
    return webResults.map((r: any) => ({
      title: String(r.title ?? ""),
      url: String(r.url ?? ""),
      description: r.description ? String(r.description) : undefined,
    }));
  } catch (e: any) {
    logAiUsage({
      functionLabel: "resolve_race_url",
      model: "brave-search",
      provider: "brave.com",
      promptTokens: 0,
      completionTokens: 0,
      success: false,
      errorMessage: e?.name === "AbortError" ? "Timeout (10s)" : `Error de red: ${e?.message ?? e}`,
      durationMs: Date.now() - t0,
    });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Le pide al LLM que ya usa extract-race-deep.ts que elija, de los
 * resultados de búsqueda, cuál (si alguno) es la web oficial de ESTA
 * carrera concreta. Este es el paso de "verificación de confianza" que
 * evita colar la web de una carrera homónima en otra ciudad/año.
 */
async function pickOfficialUrl(
  race: { name: string; locality?: string; province?: string; startDate?: string },
  results: BraveSearchResult[],
): Promise<{ url: string; confidence: "high" | "medium" | "low" } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const baseUrl = cleanUrl(process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = cleanUrl(process.env.OPENAI_MODEL ?? "gpt-4o-mini");
  const isMiniMax = /minimax/i.test(baseUrl);

  const resultsText = results
    .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.description ?? ""}`)
    .join("\n\n");

  const systemPrompt = `Eres un asistente que identifica la web oficial de una carrera popular a partir de resultados de búsqueda.

Se te da el nombre de una carrera (con localidad/provincia y año) y una lista de resultados de
búsqueda web. Debes decidir cuál de esos resultados (si alguno) es la web OFICIAL del
organizador de ESA carrera concreta — no una web genérica de resultados, ranking, noticia sobre
la carrera, o la web oficial de una carrera HOMÓNIMA en otra localidad o año distinto.

Devuelve JSON: { "url": string | null, "confidence": "high" | "medium" | "low" | null }
- "high": el resultado coincide claramente en nombre + localidad + año/edición.
- "medium": coincide en nombre y localidad, pero no se puede confirmar el año/edición exacta.
- "low": hay coincidencia parcial dudosa (mismo nombre pero localidad distinta o ambigua).
- null (tanto url como confidence): ningún resultado parece ser la web oficial de esta carrera.

NUNCA elijas una web que sea claramente de una carrera distinta solo porque el nombre se
parece. Ante la duda, devuelve null — es preferible no resolver que resolver mal.`;

  const userPrompt = `Carrera a identificar: "${race.name}"${race.locality ? `, ${race.locality}` : ""}${race.province ? ` (${race.province})` : ""}${race.startDate ? `, fecha ${race.startDate}` : ""}

Resultados de búsqueda:
${resultsText}

¿Cuál es la web oficial de esta carrera concreta?`;

  const payload: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  };
  if (isMiniMax) {
    payload.extra_body = { thinking: { type: "disabled" } };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  const t0 = Date.now();

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cleanUrl(apiKey)}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      logAiUsage({
        functionLabel: "resolve_race_url",
        model,
        provider: baseUrl,
        promptTokens: 0,
        completionTokens: 0,
        success: false,
        errorMessage: `LLM error ${res.status}: ${errText.slice(0, 200)}`,
        durationMs: Date.now() - t0,
      });
      return null;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      logAiUsage({
        functionLabel: "resolve_race_url",
        model,
        provider: baseUrl,
        promptTokens: data?.usage?.prompt_tokens ?? 0,
        completionTokens: data?.usage?.completion_tokens ?? 0,
        success: false,
        errorMessage: "LLM no devolvió contenido",
        durationMs: Date.now() - t0,
      });
      return null;
    }

    logAiUsage({
      functionLabel: "resolve_race_url",
      model,
      provider: baseUrl,
      promptTokens: data?.usage?.prompt_tokens ?? 0,
      completionTokens: data?.usage?.completion_tokens ?? 0,
      success: true,
      durationMs: Date.now() - t0,
    });

    const parsed = parseJson(content);
    if (!parsed?.url || !/^https?:\/\//.test(parsed.url)) return null;
    if (!["high", "medium", "low"].includes(parsed.confidence)) return null;
    return { url: parsed.url, confidence: parsed.confidence };
  } catch (e: any) {
    logAiUsage({
      functionLabel: "resolve_race_url",
      model,
      provider: baseUrl,
      promptTokens: 0,
      completionTokens: 0,
      success: false,
      errorMessage: e?.name === "AbortError" ? "Timeout (30s)" : `Error de red: ${e?.message ?? e}`,
      durationMs: Date.now() - t0,
    });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseJson(text: string): any {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

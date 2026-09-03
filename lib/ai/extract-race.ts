// =============================================================================
// lib/ai/extract-race.ts
// =============================================================================
// Extrae info de una carrera desde una URL usando OpenAI.
// Devuelve un objeto con los campos del schema de Race.
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

/**
 * Llama a OpenAI para extraer info de carrera de una URL.
 * Devuelve null si no hay API key configurada o falla.
 */
export async function extractRaceFromUrl(url: string): Promise<ExtractedRace | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no configurado. Añádelo en .env.local y Vercel.");
  }

  // 1. Fetch la URL
  const html = await fetchUrl(url);

  // 2. Limpiar HTML (quitar scripts, estilos, comentarios)
  const text = htmlToText(html).slice(0, 12000); // max ~12k chars para el LLM

  // 3. Llamar a OpenAI
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

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI no devolvió contenido");

  const parsed = JSON.parse(content);
  return sanitize(parsed);
}

async function fetchUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; mi-dorsal/1.0; +https://mi-dorsal.es)",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "es-ES,es;q=0.9",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Fetch error ${res.status} al acceder a ${url}`);
  }
  return await res.text();
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

function sanitize(r: any): ExtractedRace {
  return {
    name: String(r.name ?? "").slice(0, 200),
    startDate: r.startDate && /^\d{4}-\d{2}-\d{2}$/.test(r.startDate) ? r.startDate : undefined,
    locality: r.locality ? String(r.locality).slice(0, 100) : undefined,
    province: PROVINCES.includes(r.province) ? r.province : undefined,
    distanceKm: typeof r.distanceKm === "number" && r.distanceKm > 0 ? r.distanceKm : undefined,
    raceType: ["road", "trail", "mixed", "obstacle"].includes(r.raceType) ? r.raceType : undefined,
    description: r.description ? String(r.description).slice(0, 500) : undefined,
    organizer: r.organizer ? String(r.organizer).slice(0, 100) : undefined,
    officialUrl: r.officialUrl && /^https?:\/\//.test(r.officialUrl) ? r.officialUrl : undefined,
    registrationUrl: r.registrationUrl && /^https?:\/\//.test(r.registrationUrl) ? r.registrationUrl : undefined,
    imageUrl: r.imageUrl && /^https?:\/\//.test(r.imageUrl) ? r.imageUrl : undefined,
    elevationGainM: typeof r.elevationGainM === "number" && r.elevationGainM > 0 ? r.elevationGainM : undefined,
  };
}

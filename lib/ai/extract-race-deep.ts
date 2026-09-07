// =============================================================================
// lib/ai/extract-race-deep.ts
// =============================================================================
// Extracción PROFUNDA desde la URL oficial de una carrera.
// A diferencia de extract-race.ts (que es para crear carreras desde cero),
// aquí vamos a una URL ya identificada y le pedimos al LLM TODO lo que
// pueda extraer: modalidades, avituallamientos detallados, precios por
// tramos, altimetría, dorsal pickup, etc.
//
// Esto nutre los ~25 campos nuevos que se añadieron al schema en Fase 1.
// =============================================================================

export interface ExtractedRaceDeep {
  // Básicos (sobrescribe si hay algo mejor en la web)
  name?: string;
  startTime?: string;
  address?: string;
  venue?: string;
  longDescription?: string;

  // Modalidades
  raceFormats?: Array<{
    name: string;
    distanceKm: number;
    elevationGainM?: number;
    startTime?: string;
    priceEur?: number;
    maxParticipants?: number;
  }>;

  // Avituallamientos
  aidStations?: Array<{
    km: number;
    name?: string;
    hasWater?: boolean;
    hasIsotonic?: boolean;
    hasFood?: boolean;
    hasMedical?: boolean;
  }>;

  // Tramos de precio
  priceTiers?: Array<{
    fromDate: string;
    toDate?: string;
    priceEur: number;
    label?: string;
  }>;

  // Dorsal
  dorsalPickupLocation?: string;
  dorsalPickupHours?: string;

  // URLs extra
  regulationUrl?: string;
  mapUrl?: string;
  mapEmbedUrl?: string;
  altimetryImageUrl?: string;

  // Altimetría per-km (si la web publica tabla; raro)
  altimetryData?: Array<{
    km: number;
    altitudeM: number;
  }>;

  // Fotos
  galleryUrls?: string[];

  // Contacto y redes
  contactEmail?: string;
  contactPhone?: string;
  organizer?: string;
  organizerUrl?: string;
  socialInstagram?: string;
  socialFacebook?: string;
  socialTwitter?: string;
  socialYoutube?: string;

  // Inscripción
  registrationOpenDate?: string;
  registrationCloseDate?: string;
  maxParticipants?: number;
  soldOut?: boolean;

  // Servicios
  services?: {
    aidStations?: number;
    showers?: boolean;
    changingRooms?: boolean;
    bagDrop?: boolean;
    parking?: boolean;
    medical?: boolean;
    physiotherapy?: boolean;
    timingChip?: boolean;
    photoService?: boolean;
    videoService?: boolean;
    swagBag?: boolean;
    tShirt?: boolean;
    medal?: boolean;
    refreshments?: boolean;
  };

  // Recorrido
  courseType?: "loop" | "point_to_point" | "out_and_back";
  gpxUrl?: string;
  mapImageUrl?: string;
  profileImageUrl?: string;
  timeLimitMinutes?: number;
  cutoffs?: Array<{ km: number; timeLimit: string }>;

  // Premios
  prizes?: string;
  trophies?: boolean;

  // Categorías
  categories?: Array<{
    name: string;
    gender?: "M" | "F" | "mixto";
    ageMin?: number;
    ageMax?: number;
  }>;

  // Metadata de la extracción
  confidence: "high" | "medium" | "low";
  notes?: string;
}

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

export async function deepExtractRace(url: string): Promise<ExtractedRaceDeep | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no configurado. Añádelo en .env.local y Vercel.");
  }
  // (cleanUrl aplicada más abajo en fetchUrl — defense in depth)

  // Limpiar URL: quitar BOM, zero-width, non-ASCII, etc.
  url = cleanUrl(url);
  if (!/^https?:\/\//.test(url)) {
    throw new Error("URL inválida. Debe empezar por http:// o https://");
  }

  const baseUrl = cleanUrl(process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = cleanUrl(process.env.OPENAI_MODEL ?? DEFAULT_MODEL);
  const isMiniMax = /minimax/i.test(baseUrl);

  const html = await fetchUrl(url);
  const text = htmlToText(html).slice(0, 16000);

  const systemPrompt = `Eres un asistente experto en extraer información de carreras populares desde su web oficial.
A partir del contenido de la web, extrae TODOS los datos posibles y devuélvelos como JSON.

CAMPOS A EXTRAER (usa null si NO encuentras el dato; NUNCA inventes datos que no estén en la web):

{
  "name": string | null,
  "startTime": string | null,
  "address": string | null,
  "venue": string | null,
  "longDescription": string | null,
  "raceFormats": [
    { "name": string, "distanceKm": number, "elevationGainM": number | null, "startTime": string | null, "priceEur": number | null, "maxParticipants": number | null }
  ],
  "aidStations": [
    { "km": number, "name": string | null, "hasWater": boolean | null, "hasIsotonic": boolean | null, "hasFood": boolean | null, "hasMedical": boolean | null }
  ],
  "priceTiers": [
    { "fromDate": string, "toDate": string | null, "priceEur": number, "label": string | null }
  ],
  "dorsalPickupLocation": string | null,
  "dorsalPickupHours": string | null,
  "regulationUrl": string | null,
  "mapUrl": string | null,
  "mapEmbedUrl": string | null,
  "altimetryImageUrl": string | null,
  "gpxUrl": string | null,
  "mapImageUrl": string | null,
  "profileImageUrl": string | null,
  "altimetryData": [{ "km": number, "altitudeM": number }],
  "galleryUrls": [string],
  "contactEmail": string | null,
  "contactPhone": string | null,
  "organizer": string | null,
  "organizerUrl": string | null,
  "socialInstagram": string | null,
  "socialFacebook": string | null,
  "socialTwitter": string | null,
  "socialYoutube": string | null,
  "registrationOpenDate": string | null,
  "registrationCloseDate": string | null,
  "maxParticipants": number | null,
  "soldOut": boolean | null,
  "services": {
    "aidStations": number | null, "showers": boolean | null, "changingRooms": boolean | null, "bagDrop": boolean | null, "parking": boolean | null, "medical": boolean | null, "physiotherapy": boolean | null, "timingChip": boolean | null, "photoService": boolean | null, "videoService": boolean | null, "swagBag": boolean | null, "tShirt": boolean | null, "medal": boolean | null, "refreshments": boolean | null
  } | null,
  "courseType": "loop" | "point_to_point" | "out_and_back" | null,
  "timeLimitMinutes": number | null,
  "cutoffs": [{ "km": number, "timeLimit": string }],
  "prizes": string | null,
  "trophies": boolean | null,
  "categories": [
    { "name": string, "gender": "M" | "F" | "mixto" | null, "ageMin": number | null, "ageMax": number | null }
  ],
  "confidence": "high" | "medium" | "low",
  "notes": string | null
}

REGLAS:
- NO inventes. Si no ves un dato, null. Es preferible devolver null que inventar.
- URLs completas con https://. Si solo ves "/img/mapa.jpg", pon "URL_COMPLETA_AQUÍ".
- Fechas en YYYY-MM-DD. Horas en HH:MM 24h.
- Si la web tiene un único precio actual sin tramos, mete UN objeto en priceTiers con fromDate=registrationOpenDate y toDate=null.

===== MODO SÍNTESIS (CRÍTICO) =====
La web de una carrera popular española puede ser:
  (A) Web oficial completa con reglamento, mapa, altimetría, precios por tramos, etc.
  (B) Landing page de Sportmaniacs/Runedia con un párrafo de descripción y botón de inscripción.
  (C) Página de Facebook/noticia de la Federación con info básica.

OBJETIVO: que la ficha en mi-dorsal SIEMPRE tenga contenido útil, incluso en los casos (B) y (C).

Para el campo "longDescription" — SIEMPRE escribe un párrafo en español, 80-400 chars, sintetizando lo que SÍ sepas:
  - Caso (A): 1-3 párrafos con todo el detalle de la web.
  - Caso (B/C): 1 párrafo corto que combine nombre, distancia, fecha, localidad y organizador
    en una frase natural. Ej: "Carrera popular de 10K organizada por el Club Atletismo X en
    Valencia. Salida el 5 de octubre a las 09:00 desde la Plaza del Ayuntamiento. Inscripciones
    a través de Sportmaniacs." — incluso si esto es casi todo lo que dice la web, ES MEJOR que
    null. NO inventes info que no esté (modalidades extra, premios, etc.).
  - Si la página está casi vacía (solo el nombre): devuelve igualmente un longDescription
    de UNA frase con "[Nombre] — [distancia] en [localidad], [fecha]. Datos vía [source]."

Para "services" — pon a true CUALQUIER servicio que la web mencione explícitamente aunque sea
de pasada (ej: "habrá avituallamiento en meta" → refreshments: true; "parking gratuito" →
parking: true). Solo null si NO se menciona.

Para "categories" — si la web menciona "Senior M/F", "Sub-23", "Máster 35-44", "Veteranos" etc.,
rellena al menos las obvias. Si la web no menciona ninguna, deja null.

Para "galleryUrls" — si no hay galería visible, pon null (mejor null que una URL rota del logo
de la cabecera). El imageUrl del campo raíz (description corta) NO va aquí.

Para "organizer" — si la página es de Sportmaniacs/Runedia y no menciona organizador explícito,
escribe "vía [source]" (ej: "vía Sportmaniacs"). Si la web oficial SÍ nombra organizador, ese.

Para "confidence":
  - high: web oficial con info completa y clara.
  - medium: web oficial con info parcial, o plataforma de inscripción con detalles.
  - low: landing page muy escueta, solo nombre+fecha+localidad.

Para "notes": breve, max 200 chars, en español, sobre problemas/limitaciones
(ej: "Web en Flash, no scrapeable" o "Solo info de 2025, próxima edición TBD" o
"Landing de Sportmaniacs, sin datos de organizador").

IDIOMA: todos los textos (longDescription, notes, organizer) en español.`;

  const userPrompt = `URL: ${url}

Contenido de la web (texto limpio):
"""
${text}
"""

Extrae toda la información de la carrera en el JSON especificado.`;

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
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cleanUrl(apiKey)}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e?.name === "AbortError") {
      throw new Error(`Timeout (60s) llamando a ${baseUrl} con ${model}`);
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
          Authorization: `Bearer ${cleanUrl(apiKey)}`,
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
      return sanitize(parseJsonLoose(stripThinkBlocks(c2)));
    }
    throw new Error(`LLM error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM no devolvió contenido");

  return sanitize(parseJsonLoose(stripThinkBlocks(content)));
}

async function fetchUrl(url: string): Promise<string> {
  // Defense in depth: limpiar URL de nuevo antes de fetch
  url = cleanUrl(url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; mi-dorsal/1.0; +https://mi-dorsal.es)",
        Accept: "text/html,application/xhtml+xml,application/pdf",
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
      throw new Error(`Timeout (20s) al hacer fetch de ${url}`);
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

const URL_RE = /^https?:\/\/.+/;
const TIME_RE = /^\d{1,2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function sanitize(r: any): ExtractedRaceDeep {
  const out: ExtractedRaceDeep = {
    confidence: ["high", "medium", "low"].includes(r?.confidence) ? r.confidence : "low",
    notes: r?.notes ? String(r.notes).slice(0, 500) : undefined,
  };

  // Strings simples
  if (r?.name) out.name = String(r.name).slice(0, 200);
  if (r?.startTime && TIME_RE.test(r.startTime)) out.startTime = r.startTime;
  if (r?.address) out.address = String(r.address).slice(0, 300);
  if (r?.venue) out.venue = String(r.venue).slice(0, 200);
  if (r?.longDescription) out.longDescription = String(r.longDescription).slice(0, 2500);
  if (r?.organizer) out.organizer = String(r.organizer).slice(0, 200);
  if (r?.contactEmail && /@/.test(r.contactEmail)) out.contactEmail = r.contactEmail;
  if (r?.contactPhone) out.contactPhone = String(r.contactPhone).slice(0, 50);
  if (r?.dorsalPickupLocation) out.dorsalPickupLocation = String(r.dorsalPickupLocation).slice(0, 200);
  if (r?.dorsalPickupHours) out.dorsalPickupHours = String(r.dorsalPickupHours).slice(0, 200);
  if (r?.prizes) out.prizes = String(r.prizes).slice(0, 1000);
  if (typeof r?.soldOut === "boolean") out.soldOut = r.soldOut;
  if (typeof r?.trophies === "boolean") out.trophies = r.trophies;
  if (typeof r?.maxParticipants === "number" && r.maxParticipants > 0) {
    out.maxParticipants = r.maxParticipants;
  }
  if (typeof r?.timeLimitMinutes === "number" && r.timeLimitMinutes > 0) {
    out.timeLimitMinutes = r.timeLimitMinutes;
  }
  if (["loop", "point_to_point", "out_and_back"].includes(r?.courseType)) {
    out.courseType = r.courseType;
  }

  // URLs
  for (const k of [
    "regulationUrl", "mapUrl", "mapEmbedUrl", "altimetryImageUrl",
    "gpxUrl", "mapImageUrl", "profileImageUrl",
    "organizerUrl", "socialInstagram", "socialFacebook", "socialTwitter", "socialYoutube",
  ] as const) {
    if (r?.[k] && URL_RE.test(r[k])) {
      if (!r[k].includes("URL_COMPLETA")) {
        (out as any)[k] = r[k];
      }
    }
  }

  // Fechas
  if (r?.registrationOpenDate && DATE_RE.test(r.registrationOpenDate)) {
    out.registrationOpenDate = r.registrationOpenDate;
  }
  if (r?.registrationCloseDate && DATE_RE.test(r.registrationCloseDate)) {
    out.registrationCloseDate = r.registrationCloseDate;
  }

  // raceFormats
  if (Array.isArray(r?.raceFormats)) {
    out.raceFormats = r.raceFormats
      .filter((f: any) => f?.name && typeof f?.distanceKm === "number" && f.distanceKm > 0)
      .slice(0, 10)
      .map((f: any) => ({
        name: String(f.name).slice(0, 80),
        distanceKm: f.distanceKm,
        elevationGainM: typeof f.elevationGainM === "number" && f.elevationGainM > 0 ? f.elevationGainM : undefined,
        startTime: f.startTime && TIME_RE.test(f.startTime) ? f.startTime : undefined,
        priceEur: typeof f.priceEur === "number" && f.priceEur > 0 ? f.priceEur : undefined,
        maxParticipants: typeof f.maxParticipants === "number" && f.maxParticipants > 0 ? f.maxParticipants : undefined,
      }));
  }

  // aidStations
  if (Array.isArray(r?.aidStations)) {
    out.aidStations = r.aidStations
      .filter((a: any) => typeof a?.km === "number" && a.km >= 0)
      .slice(0, 30)
      .map((a: any) => ({
        km: a.km,
        name: a.name ? String(a.name).slice(0, 100) : undefined,
        hasWater: typeof a.hasWater === "boolean" ? a.hasWater : undefined,
        hasIsotonic: typeof a.hasIsotonic === "boolean" ? a.hasIsotonic : undefined,
        hasFood: typeof a.hasFood === "boolean" ? a.hasFood : undefined,
        hasMedical: typeof a.hasMedical === "boolean" ? a.hasMedical : undefined,
      }))
      .sort((a, b) => a.km - b.km);
  }

  // priceTiers
  if (Array.isArray(r?.priceTiers)) {
    out.priceTiers = r.priceTiers
      .filter((t: any) => typeof t?.priceEur === "number" && t.priceEur > 0 && t?.fromDate && DATE_RE.test(t.fromDate))
      .slice(0, 10)
      .map((t: any) => ({
        fromDate: t.fromDate,
        toDate: t.toDate && DATE_RE.test(t.toDate) ? t.toDate : undefined,
        priceEur: t.priceEur,
        label: t.label ? String(t.label).slice(0, 50) : undefined,
      }));
  }

  // cutoffs
  if (Array.isArray(r?.cutoffs)) {
    out.cutoffs = r.cutoffs
      .filter((c: any) => typeof c?.km === "number" && c?.timeLimit && TIME_RE.test(c.timeLimit))
      .slice(0, 20)
      .map((c: any) => ({ km: c.km, timeLimit: c.timeLimit }))
      .sort((a, b) => a.km - b.km);
  }

  // categories
  if (Array.isArray(r?.categories)) {
    out.categories = r.categories
      .filter((c: any) => c?.name)
      .slice(0, 20)
      .map((c: any) => ({
        name: String(c.name).slice(0, 60),
        gender: ["M", "F", "mixto"].includes(c.gender) ? c.gender : undefined,
        ageMin: typeof c.ageMin === "number" ? c.ageMin : undefined,
        ageMax: typeof c.ageMax === "number" ? c.ageMax : undefined,
      }));
  }

  // services
  if (r?.services && typeof r.services === "object") {
    const s: any = {};
    for (const k of [
      "aidStations", "showers", "changingRooms", "bagDrop", "parking",
      "medical", "physiotherapy", "timingChip", "photoService", "videoService",
      "swagBag", "tShirt", "medal", "refreshments",
    ]) {
      const v = r.services[k];
      if (k === "aidStations") {
        if (typeof v === "number" && v >= 0) s[k] = v;
      } else if (typeof v === "boolean") {
        s[k] = v;
      }
    }
    if (Object.keys(s).length > 0) out.services = s;
  }

  // altimetryData
  if (Array.isArray(r?.altimetryData)) {
    out.altimetryData = r.altimetryData
      .filter((a: any) => typeof a?.km === "number" && typeof a?.altitudeM === "number")
      .slice(0, 200)
      .map((a: any) => ({ km: a.km, altitudeM: a.altitudeM }))
      .sort((a, b) => a.km - b.km);
  }

  // galleryUrls
  if (Array.isArray(r?.galleryUrls)) {
    out.galleryUrls = r.galleryUrls
      .filter((u: any) => typeof u === "string" && URL_RE.test(u) && !u.includes("URL_COMPLETA"))
      .slice(0, 30);
  }

  return out;
}

// =============================================================================
// buildExtractionPatch
// =============================================================================
// Convierte el resultado del LLM en un patch listo para `db.patch` en Convex.
// Single source of truth — usado por:
//   - scripts/deep-extract-all.ts (bulk por CLI)
//   - app/admin/races/[id]/actions.ts (botón "Extraer y aplicar" en admin)
// =============================================================================

/** Lista de campos escalares (string) que se copian si vienen no vacíos. */
const PATCH_SCALAR_FIELDS = [
  "name", "startTime", "address", "venue", "longDescription",
  "organizer", "organizerUrl", "contactEmail", "contactPhone",
  "dorsalPickupLocation", "dorsalPickupHours",
  "regulationUrl", "mapUrl", "mapEmbedUrl", "altimetryImageUrl",
  "gpxUrl", "mapImageUrl", "profileImageUrl",
  "registrationOpenDate", "registrationCloseDate",
  "socialInstagram", "socialFacebook", "socialTwitter", "socialYoutube",
  "prizes",
] as const;

export function buildExtractionPatch(
  data: ExtractedRaceDeep,
  sourceUrl: string
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    extractedFromUrl: sourceUrl,
    extractedAt: Date.now(),
  };

  for (const key of PATCH_SCALAR_FIELDS) {
    const v = (data as any)[key];
    if (v !== null && v !== undefined && v !== "") patch[key] = v;
  }

  if (typeof data.maxParticipants === "number" && data.maxParticipants > 0) {
    patch.maxParticipants = data.maxParticipants;
  }
  if (typeof data.timeLimitMinutes === "number" && data.timeLimitMinutes > 0) {
    patch.timeLimitMinutes = data.timeLimitMinutes;
  }
  if (typeof data.soldOut === "boolean") patch.soldOut = data.soldOut;
  if (typeof data.trophies === "boolean") patch.trophies = data.trophies;
  if (data.courseType) patch.courseType = data.courseType;
  if (data.confidence) patch.extractionConfidence = data.confidence;

  if (data.raceFormats?.length) patch.raceFormats = data.raceFormats;
  if (data.aidStations?.length) patch.aidStations = data.aidStations;
  if (data.priceTiers?.length) patch.priceTiers = data.priceTiers;
  if (data.cutoffs?.length) patch.cutoffs = data.cutoffs;
  if (data.categories?.length) patch.categories = data.categories;
  if (data.galleryUrls?.length) patch.galleryUrls = data.galleryUrls;
  if (data.altimetryData?.length) patch.altimetryData = data.altimetryData;
  if (data.services && Object.keys(data.services).length > 0) {
    patch.services = data.services;
  }

  return patch;
}

/** Helper para logging consistente en los dos callers. */
export function countAppliedFields(patch: Record<string, unknown>): number {
  // Restar los 2 campos de metadata (extractedFromUrl + extractedAt)
  return Object.keys(patch).length - 2;
}

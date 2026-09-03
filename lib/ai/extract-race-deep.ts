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

  const baseUrl = (process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const isMiniMax = /minimax/i.test(baseUrl);

  const html = await fetchUrl(url);
  const text = htmlToText(html).slice(0, 16000);

  const systemPrompt = `Eres un asistente experto en extraer información de carreras populares desde su web oficial.
A partir del contenido de la web, extrae TODOS los datos posibles y devuélvelos como JSON.

CAMPOS A EXTRAER (usa null si NO encuentras el dato; NUNCA inventes):

{
  "name": string | null,                 // Nombre completo de la carrera
  "startTime": string | null,            // Hora de salida principal, formato "HH:MM" (24h)
  "address": string | null,              // Dirección exacta de salida (calle, número, ciudad)
  "venue": string | null,                // Lugar/punto de salida ("Plaza del Ayuntamiento", "Polideportivo municipal", etc.)
  "longDescription": string | null,      // Descripción completa de la carrera (1-3 párrafos, max 2000 chars). En español.

  "raceFormats": [                      // Modalidades (si la carrera tiene varias distancias, ej: 5K + 10K + 21K)
    {
      "name": string,                    // "5K", "10K", "Maratón", "Trail 25K", "Marcha nórdica"
      "distanceKm": number,              // 5, 10, 21.0975, 42.195, etc.
      "elevationGainM": number | null,   // Desnivel + en metros
      "startTime": string | null,        // "HH:MM" si tiene hora propia
      "priceEur": number | null,         // Precio actual en euros
      "maxParticipants": number | null   // Cupo si lo hay
    }
  ],

  "aidStations": [                       // Avituallamientos en ruta con detalle
    {
      "km": number,                      // km desde la salida (0 = salida, total = meta)
      "name": string | null,             // "Av. km 5 - Plaza Mayor"
      "hasWater": boolean | null,
      "hasIsotonic": boolean | null,
      "hasFood": boolean | null,         // Sólido (fruta, barritas, geles)
      "hasMedical": boolean | null
    }
  ],

  "priceTiers": [                        // Tramos de precio si suben por fecha
    {
      "fromDate": string,                // "YYYY-MM-DD"
      "toDate": string | null,           // "YYYY-MM-DD" o null si abierto
      "priceEur": number,
      "label": string | null             // "1ª tanda", "Última semana"
    }
  ],

  "dorsalPickupLocation": string | null, // Dónde se recoge el dorsal
  "dorsalPickupHours": string | null,    // Horario ("Vie 14-20h, Sáb 10-13h")

  "regulationUrl": string | null,        // URL del PDF de reglamento
  "mapUrl": string | null,               // URL del mapa en alta res (imagen)
  "mapEmbedUrl": string | null,          // URL iframe de Google Maps / wikiloc
  "altimetryImageUrl": string | null,    // URL de la imagen del perfil de elevación
  "gpxUrl": string | null,               // URL de descarga del track GPX (si hay)
  "mapImageUrl": string | null,         // Imagen del recorrido (alternativa a mapUrl)
  "profileImageUrl": string | null,      // Imagen del perfil (alternativa a altimetryImageUrl)

  "altimetryData": [                     // Tabla de altitud per-km si está visible (raro)
    { "km": number, "altitudeM": number }
  ],

  "galleryUrls": [string],               // URLs de fotos del evento (cartel + galería si hay)

  "contactEmail": string | null,
  "contactPhone": string | null,
  "organizer": string | null,
  "organizerUrl": string | null,
  "socialInstagram": string | null,      // URL completa, no handle
  "socialFacebook": string | null,
  "socialTwitter": string | null,
  "socialYoutube": string | null,

  "registrationOpenDate": string | null, // "YYYY-MM-DD"
  "registrationCloseDate": string | null,
  "maxParticipants": number | null,
  "soldOut": boolean | null,

  "services": {                          // true si el servicio existe
    "aidStations": number | null,        // número
    "showers": boolean | null,
    "changingRooms": boolean | null,
    "bagDrop": boolean | null,
    "parking": boolean | null,
    "medical": boolean | null,
    "physiotherapy": boolean | null,
    "timingChip": boolean | null,
    "photoService": boolean | null,
    "videoService": boolean | null,
    "swagBag": boolean | null,
    "tShirt": boolean | null,
    "medal": boolean | null,
    "refreshments": boolean | null
  } | null,

  "courseType": "loop" | "point_to_point" | "out_and_back" | null,
  "timeLimitMinutes": number | null,
  "cutoffs": [                           // Tiempos máximos por km
    { "km": number, "timeLimit": string } // "HH:MM" hora límite
  ],

  "prizes": string | null,               // Descripción premios (texto)
  "trophies": boolean | null,

  "categories": [                        // Categorías de edad/género
    { "name": string, "gender": "M" | "F" | "mixto" | null, "ageMin": number | null, "ageMax": number | null }
  ],

  "confidence": "high" | "medium" | "low",  // Tu confianza global
  "notes": string | null                 // Notas (ej: "Web en Flash, no scrapeable" o "Solo info de 2025, próxima edición TBD")
}

REGLAS:
- NO inventes. Si no ves un dato, null. Es preferible devolver null que inventar.
- URLs completas con https://. Si solo ves "/img/mapa.jpg", pon "URL_COMPLETA_AQUÍ".
- Fechas en YYYY-MM-DD. Horas en HH:MM 24h.
- Si la web tiene un único precio actual sin tramos, mete UN objeto en priceTiers con fromDate=registrationOpenDate y toDate=null.
- "confidence": high si la web tiene info clara; medium si faltan datos; low si la web es ambigua o es de un año pasado.
- "notes": breve, max 200 chars, en español, sobre problemas/limitaciones.

IDIOMA: todos los textos (longDescription, notes) en español.`;

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
        Authorization: `Bearer ${apiKey}`,
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
      // Skip the LLM's literal "URL_COMPLETA_AQUÍ" placeholder
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

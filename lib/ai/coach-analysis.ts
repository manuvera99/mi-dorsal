// =============================================================================
// lib/ai/coach-analysis.ts
// =============================================================================
// Llama a un LLM OpenAI-compatible para generar un análisis narrativo del
// registro de entrenamiento de un corredor, con voz de entrenador
// experimentado (no un chatbot genérico de fitness).
//
// A diferencia de lib/ai/extract-race.ts (que pide JSON estructurado), este
// módulo pide TEXTO LIBRE — el análisis es para que el corredor lo lea, no
// para parsearlo de vuelta.
//
// Env vars: mismas que el resto de lib/ai/* (OPENAI_API_KEY, OPENAI_BASE_URL,
// OPENAI_MODEL). Ver extract-race.ts para el setup de MiniMax M3.
// =============================================================================

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

/** MiniMax-M3 leaks <think>...</think> blocks; strip them. */
function stripThinkBlocks(text: string): string {
  if (!text) return text;
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (!cleaned && text.includes("<think>")) {
    const tail = text.split("</think>").pop()?.trim();
    if (tail) cleaned = tail;
  }
  return cleaned.trim();
}

export interface CoachAnalysisInput {
  // Resumen agregado (de runnerType.ts deriveInputs)
  totalActivities: number;
  totalDistanceKm: number;
  weeklyVolumeMedianKm: number;
  consistencyPct: number;
  avgCadenceSpm: number | null;
  elevationPerKm: number;
  trailRatio: number;
  raceRatio: number;
  longestRunKm: number;
  estimated10KTimeSec: number | null;
  /** Ratio declarado por el sistema (basado en workoutType de Strava). */
  intervalRatio: number;
  easyRatio: number;
  weeksActive: number;
  isNewbie: boolean;
  paceVariability: number;
  // Tags de tipo de corredor ya calculados (con score y motivo)
  runnerTypeTags: { tag: string; score: number; reason: string }[];
  // PRs actuales (isCurrent=true), ordenados por distancia
  personalRecords: { distanceLabel: string; timeSeconds: number; achievedAt?: string }[];
  // Nombre para dirigirse al corredor (opcional)
  displayName?: string;
  // Perfil del usuario (opcional, para personalizar el análisis)
  age?: number | null;
  weightKg?: number | null;
  restingHrBpm?: number | null;
  maxHrBpm?: number | null;
}

function formatPaceMinPerKm(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function buildUserPrompt(input: CoachAnalysisInput): string {
  const lines: string[] = [];

  // Perfil del usuario
  const profileBits: string[] = [];
  if (input.age !== null && input.age !== undefined) profileBits.push(`${input.age} años`);
  if (input.weightKg !== null && input.weightKg !== undefined) {
    profileBits.push(`${input.weightKg.toFixed(1)} kg`);
  }
  if (input.restingHrBpm !== null && input.restingHrBpm !== undefined) {
    profileBits.push(`FC reposo ${input.restingHrBpm} bpm`);
  }
  if (input.maxHrBpm !== null && input.maxHrBpm !== undefined) {
    profileBits.push(`FC máx ${input.maxHrBpm} bpm`);
  }

  lines.push(`Corredor: ${input.displayName ?? "el usuario"}`);
  if (profileBits.length > 0) {
    lines.push(`Perfil: ${profileBits.join(" · ")}`);
  }
  lines.push(``);

  lines.push(`## Datos agregados del registro de entrenamiento`);
  lines.push(`- Actividades de running totales: ${input.totalActivities}`);
  lines.push(`- Distancia total acumulada: ${Math.round(input.totalDistanceKm)} km`);
  lines.push(`- Semanas con actividad: ${Math.round(input.weeksActive)}`);
  lines.push(`- Volumen semanal (mediana): ${input.weeklyVolumeMedianKm.toFixed(1)} km/semana`);
  lines.push(`- Consistencia (días únicos con actividad / días totales del rango): ${Math.round(input.consistencyPct * 100)}%`);
  lines.push(`- Cadencia media (en rodajes suaves): ${input.avgCadenceSpm ? Math.round(input.avgCadenceSpm) + " spm" : "sin datos"}`);
  lines.push(`- Desnivel medio: ${input.elevationPerKm.toFixed(0)} m/km`);
  lines.push(`- % de actividades en trail: ${Math.round(input.trailRatio * 100)}%`);
  lines.push(`- % de actividades tipo carrera oficial: ${Math.round(input.raceRatio * 100)}%`);
  lines.push(`- % de actividades tipo series/intervalos (según Strava workoutType): ${Math.round(input.intervalRatio * 100)}%`);
  lines.push(`- % de actividades tipo rodaje suave/recuperación: ${Math.round(input.easyRatio * 100)}%`);
  lines.push(`- Tirada más larga registrada: ${input.longestRunKm.toFixed(1)} km`);
  lines.push(`- Variabilidad de ritmo entre actividades: ${(input.paceVariability * 100).toFixed(0)}% (0% = ritmo muy constante siempre, 100% = muy variable)`);
  if (input.estimated10KTimeSec) {
    lines.push(`- Mejor tiempo aproximado en 10K (actividad de 9-11km): ${formatTime(input.estimated10KTimeSec)} (${formatPaceMinPerKm(input.estimated10KTimeSec / 10)})`);
  }
  lines.push(`- ¿Corredor nuevo (menos de 3 meses de historial)?: ${input.isNewbie ? "sí" : "no"}`);

  lines.push(``);
  lines.push(`## Perfil de corredor ya calculado (heurísticas del sistema, cada una con su score 0-100)`);
  if (input.runnerTypeTags.length === 0) {
    lines.push(`(sin tags — historial insuficiente)`);
  } else {
    for (const t of input.runnerTypeTags) {
      lines.push(`- ${t.tag} (score ${t.score}): ${t.reason}`);
    }
  }

  lines.push(``);
  lines.push(`## Marcas personales actuales`);
  if (input.personalRecords.length === 0) {
    lines.push(`(sin marcas personales registradas todavía)`);
  } else {
    for (const pr of input.personalRecords) {
      lines.push(`- ${pr.distanceLabel}: ${formatTime(pr.timeSeconds)}${pr.achievedAt ? ` (${pr.achievedAt.slice(0, 10)})` : ""}`);
    }
  }

  lines.push(``);
  lines.push(`Con estos datos, escribe el análisis del entrenador.`);

  return lines.join("\n");
}

const SYSTEM_PROMPT = `Eres un entrenador de running con 20 años de experiencia entrenando a corredores populares (no élite) en España. Has visto miles de registros de Strava y Garmin. Conoces a cada corredor de tu club por su nombre y hablas con ellos el sábado después del rodaje largo, no desde un pódcast de coaching.

Cómo hablas:
- Tuteo siempre. Frases cortas. Un párrafo = una idea. Si puedes decir algo en 8 palabras, no uses 20.
- Cero frases hechas. Nada de "no hay excusas", "el límite lo pones tú", "tú puedes", "matemática pura", "es la firma de un corredor", "seguidilla de minutos por sacar", "sin tocar las piernas", "te obliga a cumplir", "fecha objetivo". Si dudas de si una frase suena a coach de Instagram, no la pongas.
- Cero clichés de póster motivacional. Nada de "no es un tema de talento, es un tema de caudal", "es la base sobre la que se construye todo lo demás", "es raro".
- Hablas con datos reales del historial, pero los interpretas: "17 km/semana de mediana es poco para tu 5K" es mejor que "el volumen semanal es bajo".
- Cero imperativos morales. No "deberías apuntarte a una carrera". Mejor: "si te apetece, búscate un 10K popular para dentro de dos meses; te sirve de fecha para encadenar las semanas". El corredor decide.
- Cero lecciones de biología. No "más mitocondrias, más capilarización". No eres profesor de COU. Si vas a explicar el POR QUÉ de algo, usa la experiencia: "llevo 20 años viendo que el que pasa de 17 a 25 km/semana en 8 semanas baja de 45 en 10K sin tocar series" (una frase, no un párrafo).
- NO inventes datos que no te he dado. Si falta información (sin series detectables, sin perfil de Strava, sin FC), dilo o sáltatelo. NO rellenes con suposiciones.
- NO inventes series. Si el campo "intervalRatio" es 0, NO digas que el corredor no hace series — la ausencia puede ser porque Strava no las marcó o porque sincroniza desde Garmin. Si quieres mencionarlo, di "no tengo datos fiables sobre si haces series" y valora si le convendría meterlas (ver bloque "Sobre las series" abajo).
- No consejo médico. Si ves algo que sugiere riesgo de lesión, coméntalo como observación y sugiere ver a un profesional si aplica.
- Si el corredor tiene muy pocos datos (menos de 10 actividades o menos de 3 meses), dilo abiertamente al principio.

Sobre las series (intervalos): no tenemos datos fiables. NO asumas que hace o que no hace. En su lugar:
- Si el corredor tiene base aeróbica asentada (volumen consistente, PRs decentes) y no vemos series, sugiere como oportunidad de mejora — no como crítica. Ejemplo del tono: "un día de series a la semana tipo 6×400 a tu ritmo de 5K con 90s de trote te renta más que otro rodaje más". Una frase, no un párrafo.
- Si es newbie (<3 meses), no hables de series todavía.
- Si ya hace carreras/tempo, no insistas en series.

Estructura del análisis (encabezados markdown ##):

## Cómo te veo
Una idea memorable de diagnóstico, en 2 frases. Empieza por el DATO más llamativo del registro, no por la biografía del corredor. Si el dato es 5K en 22:59 con 17 km/semana, eso es un motor buscando más kilómetros — empieza por ahí. NO abras con "Manu, 27 años, año y medio entrenando, ...". La biografía va en el cuerpo, no en el lead. NO listes tres datos seguidos como si fuera un informe: interpreta UN dato, di qué significa, y pasa al siguiente punto en otra frase.

## Lo que está saliendo bien
2-3 puntos anclados en datos reales. Cita el número si ayuda. Empieza siempre por el HÁBITO (que el corredor se mantiene) ANTES que por el rendimiento (que es la métrica). Un entrenador de club reconoce que el corredor se levanta a correr ANTES de felicitarle por la marca.

## Lo que yo cambiaría
2-3 puntos concretos y accionables. Prioriza por impacto, no por urgencia. Cada punto es UN párrafo de 2-3 frases máximo: 1) el problema concreto (con dato), 2) el qué hacer (acción específica), 3) el POR QUÉ basado en tu experiencia. NO estructures como bullets sueltos: cada cambio es un mini-párrafo argumentado.

## Próximas 4-8 semanas
Una sugerencia concreta de objetivo, en un párrafo de 3-4 frases. Di el PLAN (subir volumen X, meter 1 día de series, buscar carrera Y) y la DIRECCIÓN del resultado esperable, sin prometer tiempos exactos. Termina con una frase que reconozca que el plan es del corredor, no tuyo: "si haces solo esas tres cosas...". No des planes día a día. No predigas tiempos con precisión ("baja de 1:50"): di "con esa base, en 4-6 semanas bajas de 1:50 sin hacer locuras".

Tono global: entrenador de club veterano, NO coach de LinkedIn. Si dudas, escribe como si le hablaras al corredor en la puerta del vestuario después de un rodaje, no como si fueras a publicar el texto. Longitud: 350-450 palabras. Ni un informe de 1000 palabras ni dos frases.`;

export async function generateCoachAnalysis(input: CoachAnalysisInput): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY no configurado. Añádelo en Convex (npx convex env set) y en Vercel.",
    );
  }

  const baseUrl = (process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const isMiniMax = /minimax/i.test(baseUrl);

  const userPrompt = buildUserPrompt(input);

  const payload: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.6,
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
    throw new Error(`Error de red llamando al LLM: ${e?.message ?? e}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM no devolvió contenido");

  return stripThinkBlocks(content);
}

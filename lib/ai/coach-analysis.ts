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

import { logAiUsage } from "./log-usage";

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
  if (input.age !== null && input.age !== undefined) profileBits.push(`Edad: ${input.age} años`);
  if (input.weightKg !== null && input.weightKg !== undefined) {
    profileBits.push(`Peso: ${input.weightKg.toFixed(1)} kg`);
  }
  if (input.restingHrBpm !== null && input.restingHrBpm !== undefined) {
    profileBits.push(`FC en reposo: ${input.restingHrBpm} bpm`);
  }
  if (input.maxHrBpm !== null && input.maxHrBpm !== undefined) {
    profileBits.push(`FC máxima: ${input.maxHrBpm} bpm`);
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

  // Series detectadas (nueva sección)
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

const SYSTEM_PROMPT = `Eres un entrenador de running con 20 años de experiencia entrenando a corredores populares (no élite) en España. Has visto miles de registros de Strava y Garmin. No eres un chatbot de fitness genérico: hablas como un entrenador de club, con criterio propio, que conoce a su corredor y le dice la verdad con cariño, no solo lo que quiere oír.

Te voy a dar un resumen de datos objetivos del entrenamiento de un corredor (perfil básico, volumen, consistencia, cadencia, tipos de sesión, series detectadas por ritmo, PRs). Con eso, escribe un análisis en español, en tuteo, dirigido directamente al corredor.

Estructura el análisis en estas secciones, con encabezados markdown (##):

## Cómo te veo
2-3 frases de diagnóstico general: qué tipo de corredor es hoy, con una idea concreta y memorable (no genérica tipo "eres un corredor consistente"). Si los datos muestran algo llamativo (mucho volumen, poca variedad, cadencia muy baja/alta, series duras con recuperación mal planeada, tirada larga rara, FC en reposo elevada, peso alto para su nivel, etc.), dilo aquí primero.

## Lo que estás haciendo bien
2-3 puntos concretos, anclados en datos reales que te he dado (no inventes cifras). Sé específico: cita un número si ayuda a que se lo crea. Si hay series bien planteadas, Reconócelo (muchos populares no las hacen, y merece la pena).

## Lo que yo cambiaría
2-3 puntos de mejora concretos y accionables, priorizados por impacto. No seas genérico ("corre más variado") — di el POR QUÉ con los datos que tienes.

Si hay FC en reposo: 50-60 es excelente base aeróbica, 60-70 normal, >70 puede indicar fatiga acumulada o sobreentrenamiento. Si está >70 y el corredor no lo sabe, menciónalo con tacto.

Sobre las series (intervalos): no tenemos datos fiables de si el usuario hace series o no (muchos sincronizan desde Garmin, que no rellena el campo "workoutType" en Strava). Por tanto, NO asumas que hace o que no hace. En lugar de eso, valora el contexto:
- Si el corredor ya tiene una base aeróbica decente (volumen semanal consistente, algún PR reciente, cadencia en rango) y NO vemos series en los datos, sugiere que probablemente le beneficiaría meter 1 sesión de series a la semana — no como crítica ("no haces series"), sino como oportunidad de mejora ("ahora que tienes X km/semana asentados, un día de series cortas tipo 6×400 a ritmo de 5K con recuperación trotando podría bajarte otros 30-60s en 5K"). 
- Si el corredor es newbie (<3 meses de historial), NO hables de series todavía — primero consolidar volumen.
- Si el corredor hace carreras oficiales (raceRatio > 0) o tira a umbral/tempo, no insistas en series — ya está trabajando la intensidad.

## Tu próximo objetivo
Una sugerencia concreta de en qué centrarte las próximas 4-8 semanas, coherente con el resto del análisis. No inventes un plan de entrenamiento detallado (eso no es tu trabajo aquí) — da la dirección, no el plan día a día.

Reglas:
- Nunca inventes datos que no te he dado. Si falta información para decir algo (ej. sin datos de frecuencia cardíaca, sin perfil), dilo o simplemente no lo menciones — no rellenes con suposiciones.
- No repitas los números tal cual como si fuera un informe — interprétalos, dales sentido humano.
- No uses lenguaje de marketing ni frases hechas de coach motivacional ("tú puedes", "no hay excusas", "el límite lo pones tú"). Eres un entrenador real, no un póster.
- No des consejo médico. Si detectas algo que suena a riesgo de lesión (volumen muy alto de golpe, cero rodajes suaves, FC en reposo muy elevada, etc.) dilo como observación de entrenador, no como diagnóstico médico, y sugiere ver a un profesional si aplica.
- Si el corredor tiene muy pocos datos (menos de 10 actividades o menos de 3 meses), dilo abiertamente al principio y ajusta el análisis a lo que sí se puede decir con esos datos — no finjas certeza que no tienes.
- NO inventes series. NO digas "no haces series" ni "haces series". Mejor: si quieres mencionarlo, usa "no tengo datos fiables sobre si haces series" y valora si le convendría meterlas (ver bloque "Sobre las series" arriba).
- Longitud total: 350-550 palabras. Ni un informe de 1000 palabras ni dos frases.`;

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

  // Marca de inicio para loguear duración y tokens de la llamada al LLM.
  const llmStart = Date.now();

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
    logAiUsage({
      functionLabel: "coach_analysis",
      model,
      provider: baseUrl,
      promptTokens: 0,
      completionTokens: 0,
      success: false,
      errorMessage: e?.name === "AbortError"
        ? `Timeout (50s) llamando a ${baseUrl}`
        : `Error de red: ${e?.message ?? e}`,
      durationMs: Date.now() - llmStart,
    });
    if (e?.name === "AbortError") {
      throw new Error(`Timeout (50s) llamando a ${baseUrl} con ${model}`);
    }
    throw new Error(`Error de red llamando al LLM: ${e?.message ?? e}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const errText = await res.text();
    logAiUsage({
      functionLabel: "coach_analysis",
      model,
      provider: baseUrl,
      promptTokens: 0,
      completionTokens: 0,
      success: false,
      errorMessage: `LLM error ${res.status}: ${errText.slice(0, 200)}`,
      durationMs: Date.now() - llmStart,
    });
    throw new Error(`LLM error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    logAiUsage({
      functionLabel: "coach_analysis",
      model,
      provider: baseUrl,
      promptTokens: data?.usage?.prompt_tokens ?? 0,
      completionTokens: data?.usage?.completion_tokens ?? 0,
      success: false,
      errorMessage: "LLM no devolvió contenido",
      durationMs: Date.now() - llmStart,
    });
    throw new Error("LLM no devolvió contenido");
  }

  logAiUsage({
    functionLabel: "coach_analysis",
    model,
    provider: baseUrl,
    promptTokens: data?.usage?.prompt_tokens ?? 0,
    completionTokens: data?.usage?.completion_tokens ?? 0,
    success: true,
    durationMs: Date.now() - llmStart,
  });
  return stripThinkBlocks(content);
}

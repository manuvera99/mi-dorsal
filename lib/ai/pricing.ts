// =============================================================================
// lib/ai/pricing.ts
// =============================================================================
// Precios por modelo para estimar el coste de cada llamada a un LLM.
//
// UNIDAD: USD por millón de tokens (MTok). Es el formato en que los
// proveedores publican sus tarifas (OpenAI, Anthropic, etc.). Para sacar el
// coste en EUR de una llamada:
//
//   costUsd = (promptTokens * inputUsdPerMTok + completionTokens * outputUsdPerMTok) / 1_000_000
//   costEur = costUsd * USD_TO_EUR
//
// ¿Por qué hardcoded y no configurable? Decisión de producto (8 sep 2026):
// es simple, no requiere otro CRUD en admin, y la tabla solo se actualiza
// cuando cambian las tarifas (raro). Si en el futuro usamos muchos modelos
// con precios que cambian a menudo, mover a tabla en Convex.
//
// FX EUR/USD: 0.92 EUR por USD (sep 2026, aproximado). Si el euro se hunde
// o dispara, ajustar aquí.
//
// CÓMO ACTUALIZAR:
//   1. Cambiar el precio en el modelo correspondiente.
//   2. (Opcional) Actualizar el campo `lastChecked` del modelo para saber
//      cuándo se revisó por última vez.
//   3. No requiere redeploy para que las llamadas FUTURAS reflejen el nuevo
//      precio: este archivo se reimporta cada vez. Las llamadas PASADAS ya
//      tienen su costEur guardado en aiUsageLog y NO se recalculan.
// =============================================================================

/** EUR por USD. Aproximado sep 2026. Actualizar si el tipo de cambio se
 *  mueve más de un 5%. */
export const USD_TO_EUR = 0.92;

export interface ModelPricing {
  /** Nombre del modelo (debe coincidir con el valor de OPENAI_MODEL). */
  model: string;
  /** Coste de input en USD por millón de tokens. */
  inputUsdPerMTok: number;
  /** Coste de output en USD por millón de tokens. */
  outputUsdPerMTok: number;
  /** Cuándo se revisó el precio por última vez (ISO date). Útil para saber
   *  si está obsoleto. */
  lastChecked: string;
  /** Comentario libre: fuente, notas, etc. */
  note?: string;
}

/** Tabla maestra. El primer match por `model` gana. */
export const MODEL_PRICING: ModelPricing[] = [
  // -------- OpenAI --------
  {
    model: "gpt-4o-mini",
    inputUsdPerMTok: 0.15,
    outputUsdPerMTok: 0.6,
    lastChecked: "2026-09-08",
    note: "OpenAI gpt-4o-mini — modelo por defecto. Fuente: openai.com/pricing.",
  },
  {
    model: "gpt-4o",
    inputUsdPerMTok: 2.5,
    outputUsdPerMTok: 10.0,
    lastChecked: "2026-09-08",
    note: "OpenAI gpt-4o. Fuente: openai.com/pricing.",
  },
  {
    model: "gpt-4-turbo",
    inputUsdPerMTok: 10.0,
    outputUsdPerMTok: 30.0,
    lastChecked: "2026-09-08",
    note: "OpenAI gpt-4-turbo. Fuente: openai.com/pricing.",
  },
  {
    model: "gpt-3.5-turbo",
    inputUsdPerMTok: 0.5,
    outputUsdPerMTok: 1.5,
    lastChecked: "2026-09-08",
    note: "OpenAI gpt-3.5-turbo. Fuente: openai.com/pricing.",
  },
  {
    model: "o1-mini",
    inputUsdPerMTok: 3.0,
    outputUsdPerMTok: 12.0,
    lastChecked: "2026-09-08",
    note: "OpenAI o1-mini. Fuente: openai.com/pricing.",
  },
  {
    model: "o1",
    inputUsdPerMTok: 15.0,
    outputUsdPerMTok: 60.0,
    lastChecked: "2026-09-08",
    note: "OpenAI o1. Fuente: openai.com/pricing.",
  },

  // -------- Anthropic --------
  {
    model: "claude-3-5-sonnet-20241022",
    inputUsdPerMTok: 3.0,
    outputUsdPerMTok: 15.0,
    lastChecked: "2026-09-08",
    note: "Anthropic Claude 3.5 Sonnet. Fuente: anthropic.com/pricing.",
  },
  {
    model: "claude-3-5-haiku-20241022",
    inputUsdPerMTok: 0.8,
    outputUsdPerMTok: 4.0,
    lastChecked: "2026-09-08",
    note: "Anthropic Claude 3.5 Haiku. Fuente: anthropic.com/pricing.",
  },
  {
    model: "claude-3-opus-20240229",
    inputUsdPerMTok: 15.0,
    outputUsdPerMTok: 75.0,
    lastChecked: "2026-09-08",
    note: "Anthropic Claude 3 Opus. Fuente: anthropic.com/pricing.",
  },

  // -------- MiniMax --------
  // MiniMax M3 vía Maverick es gratis (tier free), pero como pueden cambiar
  // las condiciones lo modelamos a coste 0 explícitamente. Si en el futuro
  // pasan a tier de pago, ajustar aquí.
  {
    model: "MiniMax-M3",
    inputUsdPerMTok: 0,
    outputUsdPerMTok: 0,
    lastChecked: "2026-09-08",
    note: "MiniMax M3 vía Maverick (gratis). Actualizar si pasan a tier de pago.",
  },

  // -------- Google --------
  {
    model: "gemini-1.5-pro",
    inputUsdPerMTok: 1.25,
    outputUsdPerMTok: 5.0,
    lastChecked: "2026-09-08",
    note: "Google Gemini 1.5 Pro (hasta 128k context). Fuente: ai.google.dev/pricing.",
  },
  {
    model: "gemini-1.5-flash",
    inputUsdPerMTok: 0.075,
    outputUsdPerMTok: 0.3,
    lastChecked: "2026-09-08",
    note: "Google Gemini 1.5 Flash. Fuente: ai.google.dev/pricing.",
  },
];

/** Fallback cuando el modelo no está en MODEL_PRICING. Usamos los precios
 *  de gpt-4o-mini como aproximación conservadora — así al menos tenemos
 *  una cifra, y la pantalla admin puede avisar de que el modelo no está
 *  catalogado. */
export const FALLBACK_PRICING: ModelPricing = {
  model: "__unknown__",
  inputUsdPerMTok: 0.15,
  outputUsdPerMTok: 0.6,
  lastChecked: "2026-09-08",
  note: "Fallback (gpt-4o-mini). El modelo real no está en MODEL_PRICING.",
};

/** Devuelve los precios de un modelo. Si no está en la tabla, devuelve el
 *  fallback y marca `isUnknown=true` para que el caller pueda avisar. */
export function getPricing(model: string): { pricing: ModelPricing; isUnknown: boolean } {
  const found = MODEL_PRICING.find(
    (p) => p.model === model || model.startsWith(p.model),
  );
  if (found) return { pricing: found, isUnknown: false };
  return { pricing: { ...FALLBACK_PRICING, model }, isUnknown: true };
}

/** Calcula el coste en EUR para una llamada dados los tokens y el modelo. */
export function computeCostEur(
  model: string,
  promptTokens: number,
  completionTokens: number,
): { costEur: number; pricing: ModelPricing; isUnknown: boolean } {
  const { pricing, isUnknown } = getPricing(model);
  const costUsd =
    (promptTokens * pricing.inputUsdPerMTok +
      completionTokens * pricing.outputUsdPerMTok) /
    1_000_000;
  const costEur = costUsd * USD_TO_EUR;
  return { costEur, pricing, isUnknown };
}

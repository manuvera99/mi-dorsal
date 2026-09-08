// =============================================================================
// lib/ai/log-usage.ts
// =============================================================================
// Helper para registrar cada llamada a un LLM en la tabla `aiUsageLog` de
// Convex. Se invoca DESPUÉS de cada llamada en lib/ai/*.ts, con los datos
// de tokens, modelo, duración y éxito/error.
//
// FIRE-AND-FORGET: no bloquea la respuesta al usuario. Si el log falla (red,
// Convex caído, etc.) se loguea con console.error pero NO se relanza la
// excepción. El objetivo es que la monitorización de gasto NUNCA rompa la
// feature principal.
//
// CÓMO SE USA:
//
//   import { logAiUsage } from "./log-usage";
//
//   const start = Date.now();
//   let res: Response;
//   try {
//     res = await fetch(...);
//   } catch (e) {
//     logAiUsage({
//       functionLabel: "extract_race",
//       model,
//       provider: baseUrl,
//       promptTokens: 0,
//       completionTokens: 0,
//       success: false,
//       errorMessage: String(e?.message ?? e).slice(0, 500),
//       durationMs: Date.now() - start,
//     });
//     throw e;
//   }
//
//   const data = await res.json();
//   logAiUsage({
//     functionLabel: "extract_race",
//     model,
//     provider: baseUrl,
//     promptTokens: data.usage?.prompt_tokens ?? 0,
//     completionTokens: data.usage?.completion_tokens ?? 0,
//     success: res.ok,
//     errorMessage: res.ok ? undefined : `HTTP ${res.status}`,
//     durationMs: Date.now() - start,
//   });
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { computeCostEur } from "./pricing";

/** Etiquetas de función. Mantener sincronizadas con el comentario de la
 *  tabla aiUsageLog en convex/schema.ts. */
export type AiFunctionLabel =
  | "extract_race"
  | "extract_race_deep"
  | "analyze_source"
  | "coach_analysis";

export interface LogAiUsageInput {
  functionLabel: AiFunctionLabel | string;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  success: boolean;
  errorMessage?: string;
  durationMs?: number;
}

/** YYYY-MM-DD en UTC. Lo necesitamos para indexar rápido por día en la
 *  query del panel admin. */
function toDateUtc(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Cache de cliente Convex para no instanciar uno por cada log. Es seguro
 *  porque la URL no cambia en runtime. */
let convexClient: ConvexHttpClient | null = null;
function getClient(): ConvexHttpClient | null {
  if (convexClient) return convexClient;
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  convexClient = new ConvexHttpClient(url);
  return convexClient;
}

/**
 * Registra una llamada a un LLM en aiUsageLog. Fire-and-forget: cualquier
 * error se loguea con console.error pero NO se relanza.
 */
export function logAiUsage(input: LogAiUsageInput): void {
  // Calcular coste en el momento del log. Aunque el modelo sea desconocido,
  // pricing.ts devuelve un fallback para tener al menos una cifra.
  const { costEur } = computeCostEur(
    input.model,
    input.promptTokens,
    input.completionTokens,
  );
  const totalTokens = input.promptTokens + input.completionTokens;
  const timestamp = Date.now();

  const client = getClient();
  if (!client) {
    // Si no hay Convex configurado (build-time import, tests, etc.),
    // dejamos un warning pero no rompemos nada.
    console.warn(
      "[logAiUsage] NEXT_PUBLIC_CONVEX_URL no configurado, log descartado.",
      { functionLabel: input.functionLabel, model: input.model, costEur },
    );
    return;
  }

  // Fire-and-forget: NO await. Si falla, console.error y seguimos.
  // Usamos .then/.catch para no atar el caller.
  client
    .mutation("aiUsage:log" as any, {
      timestamp,
      functionLabel: input.functionLabel,
      model: input.model,
      provider: input.provider,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens,
      costEur,
      success: input.success,
      errorMessage: input.errorMessage?.slice(0, 500),
      durationMs: input.durationMs,
      dateUtc: toDateUtc(timestamp),
    })
    .catch((e: any) => {
      console.error(
        "[logAiUsage] Error registrando uso de IA:",
        e?.message ?? e,
        { functionLabel: input.functionLabel, model: input.model },
      );
    });
}

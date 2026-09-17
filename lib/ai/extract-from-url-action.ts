"use server";

// =============================================================================
// lib/ai/extract-from-url-action.ts
// =============================================================================
// Server action reutilizable: extrae info de una carrera desde una URL pública
// usando un LLM OpenAI-compatible (gpt-4o-mini por defecto).
//
// Usado desde:
//   - /admin/races/from-url  (flujo admin)
//   - wizard público "Crear carrera con IA" (suggest-race-dialog)
//
// Ambos flujos comparten exactamente la misma lógica de extracción + limpieza
// de URL. Si cambia el modelo o el prompt, cambia aquí para todos.
//
// Coste: ~$0.001 por extracción a gpt-4o-mini (depende del largo de la web).
// =============================================================================

import { extractRaceFromUrl, type ExtractedRace } from "./extract-race";
import { cleanUrl, diagnoseUrl } from "./clean-url";

export type ExtractResult =
  | { data: ExtractedRace; url: string }
  | { error: string };

export async function extractFromUrl(url: string): Promise<ExtractResult> {
  // Diagnóstico: chars raros
  const diag = diagnoseUrl(url ?? "");
  if (diag.removed.length > 0) {
    console.log(
      `[extractFromUrl] URL tenía ${diag.removed.length} chars raros, limpiados. Original: ${JSON.stringify(url)}`
    );
  }
  url = cleanUrl(url ?? "");
  if (!url || !/^https?:\/\//.test(url)) {
    return { error: "URL inválida. Debe empezar con http:// o https://" };
  }
  try {
    const data = await extractRaceFromUrl(url);
    if (!data) return { error: "No se pudo extraer info de la URL" };
    return { data, url };
  } catch (e: any) {
    console.error(`[extractFromUrl] Error con URL ${url}:`, e?.message ?? e);
    return { error: e?.message || "Error desconocido" };
  }
}

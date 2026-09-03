"use server";

import { deepExtractRace, type ExtractedRaceDeep } from "@/lib/ai/extract-race-deep";
import { cleanUrl, diagnoseUrl } from "@/lib/ai/clean-url";

export type DeepExtractResult =
  | { data: ExtractedRaceDeep; url: string }
  | { error: string };

export async function deepExtractAction(url: string): Promise<DeepExtractResult> {
  // Diagnóstico: chars raros
  const diag = diagnoseUrl(url ?? "");
  if (diag.removed.length > 0) {
    console.log(
      `[deepExtractAction] URL tenía ${diag.removed.length} chars raros, limpiados. Original: ${JSON.stringify(url)}`
    );
  }
  url = cleanUrl(url ?? "");
  if (!url || !/^https?:\/\//.test(url)) {
    return { error: "URL inválida. Debe empezar con http:// o https://" };
  }
  try {
    const data = await deepExtractRace(url);
    if (!data) return { error: "No se pudo extraer información de la URL" };
    return { data, url };
  } catch (e: any) {
    console.error(`[deepExtractAction] Error con URL ${url}:`, e?.message ?? e);
    return { error: e?.message || "Error desconocido" };
  }
}

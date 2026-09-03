"use server";

import { extractRaceFromUrl, type ExtractedRace } from "@/lib/ai/extract-race";
import { cleanUrl, diagnoseUrl } from "@/lib/ai/clean-url";

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

"use server";

import { deepExtractRace, type ExtractedRaceDeep } from "@/lib/ai/extract-race-deep";

export type DeepExtractResult =
  | { data: ExtractedRaceDeep; url: string }
  | { error: string };

export async function deepExtractAction(url: string): Promise<DeepExtractResult> {
  // Limpiar URL: quitar BOM y caracteres invisibles
  url = (url ?? "").replace(/[\uFEFF\u200B-\u200D\u2060]/g, "").trim();
  if (!url || !/^https?:\/\//.test(url)) {
    return { error: "URL inválida. Debe empezar con http:// o https://" };
  }
  try {
    const data = await deepExtractRace(url);
    if (!data) return { error: "No se pudo extraer información de la URL" };
    return { data, url };
  } catch (e: any) {
    return { error: e?.message || "Error desconocido" };
  }
}

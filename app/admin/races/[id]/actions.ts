"use server";

import { deepExtractRace, type ExtractedRaceDeep } from "@/lib/ai/extract-race-deep";
import { cleanUrl } from "@/lib/ai/clean-url";

export type DeepExtractResult =
  | { data: ExtractedRaceDeep; url: string }
  | { error: string };

export async function deepExtractAction(url: string): Promise<DeepExtractResult> {
  // Limpiar URL: quitar BOM, zero-width, non-ASCII, etc.
  url = cleanUrl(url ?? "");
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

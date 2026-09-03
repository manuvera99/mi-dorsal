"use server";

import { extractRaceFromUrl, type ExtractedRace } from "@/lib/ai/extract-race";

export type ExtractResult =
  | { data: ExtractedRace; url: string }
  | { error: string };

export async function extractFromUrl(url: string): Promise<ExtractResult> {
  if (!url || !/^https?:\/\//.test(url)) {
    return { error: "URL inválida. Debe empezar con http:// o https://" };
  }
  try {
    const data = await extractRaceFromUrl(url);
    if (!data) return { error: "No se pudo extraer info de la URL" };
    return { data, url };
  } catch (e: any) {
    return { error: e?.message || "Error desconocido" };
  }
}

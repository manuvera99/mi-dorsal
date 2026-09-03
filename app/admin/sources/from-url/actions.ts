"use server";

import { analyzeDataSource, type ExtractedSource } from "@/lib/ai/analyze-source";

export type AnalyzeResult =
  | { data: ExtractedSource; url: string }
  | { error: string };

export async function analyzeFromUrl(url: string): Promise<AnalyzeResult> {
  if (!url || !/^https?:\/\//.test(url)) {
    return { error: "URL inválida. Debe empezar con http:// o https://" };
  }
  try {
    const data = await analyzeDataSource(url);
    if (!data) return { error: "No se pudo analizar la URL" };
    return { data, url };
  } catch (e: any) {
    return { error: e?.message || "Error desconocido" };
  }
}

"use server";

import { analyzeDataSource, type ExtractedSource } from "@/lib/ai/analyze-source";
import { cleanUrl, diagnoseUrl } from "@/lib/ai/clean-url";

export type AnalyzeResult =
  | { data: ExtractedSource; url: string }
  | { error: string };

export async function analyzeFromUrl(url: string): Promise<AnalyzeResult> {
  // Diagnóstico: ver qué caracteres raros trae la URL (para debug futuro)
  const diag = diagnoseUrl(url ?? "");
  if (diag.removed.length > 0) {
    console.log(
      `[analyzeFromUrl] URL tenía ${diag.removed.length} chars raros, limpiados. Original: ${JSON.stringify(url)}`
    );
  }

  // Limpiar URL: quitar BOM, zero-width, non-ASCII, etc.
  url = cleanUrl(url ?? "");
  if (!url || !/^https?:\/\//.test(url)) {
    return { error: "URL inválida. Debe empezar por http:// o https://" };
  }
  try {
    const data = await analyzeDataSource(url);
    if (!data) return { error: "No se pudo analizar la URL" };
    return { data, url };
  } catch (e: any) {
    // Loguear también el error con contexto para debug
    console.error(`[analyzeFromUrl] Error con URL ${url}:`, e?.message ?? e);
    return { error: e?.message || "Error desconocido" };
  }
}


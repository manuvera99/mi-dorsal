"use server";

import { extractRaceFromUrl } from "@/lib/ai/extract-race";
import { revalidatePath } from "next/cache";

export async function extractFromUrl(url: string) {
  if (!url || !/^https?:\/\//.test(url)) {
    return { error: "URL inválida. Debe empezar con http:// o https://" };
  }
  try {
    const data = await extractRaceFromUrl(url);
    if (!data) return { error: "No se pudo extraer info de la URL" };
    return { data, url };
  } catch (e: any) {
    return { error: e.message || "Error desconocido" };
  }
}

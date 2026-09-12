"use server";

import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

import { deepExtractRace, buildExtractionPatch, countAppliedFields, type ExtractedRaceDeep } from "@/lib/ai/extract-race-deep";
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

export type DeepExtractAndApplyResult =
  | { ok: true; fieldsApplied: number; confidence: string | null; url: string }
  | { error: string };

export async function deepExtractAndApplyAction(
  raceId: string,
  url?: string
): Promise<DeepExtractAndApplyResult> {
  const { userId } = await auth();
  if (!userId) return { error: "No autenticado" };
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return { error: "NEXT_PUBLIC_CONVEX_URL no configurado" };
  const client = new ConvexHttpClient(convexUrl);
  const profile = await client.query(api.users.getProfileByClerkId, { clerkUserId: userId });
  if (!profile || profile.role !== "admin") {
    return { error: "Solo admins pueden ejecutar esta acción" };
  }
  let targetUrl = url;
  if (!targetUrl) {
    const race = await client.query(api.races.get, { id: raceId as any });
    if (!race) return { error: "Carrera no encontrada" };
    targetUrl = race.officialUrl;
  }
  if (!targetUrl) {
    return { error: "No hay URL. Pasa una URL o configura officialUrl en la carrera" };
  }
  const cleaned = cleanUrl(targetUrl);
  if (!/^https?:\/\//.test(cleaned)) {
    return { error: "URL inválida tras limpieza" };
  }
  let data: ExtractedRaceDeep | null;
  try {
    data = await deepExtractRace(cleaned);
  } catch (e: any) {
    return { error: "IA falló: " + (e?.message ?? e) };
  }
  if (!data) return { error: "IA no devolvió datos" };
  const patch = buildExtractionPatch(data, cleaned);
  try {
    await client.mutation(api.races.adminUpdate, { id: raceId as any, patch });
  } catch (e: any) {
    return { error: "Aplicar falló: " + (e?.message ?? e) };
  }
  return {
    ok: true,
    fieldsApplied: countAppliedFields(patch),
    confidence: data.confidence ?? null,
    url: cleaned,
  };
}

export type ScanRaceResultsResult =
  | {
      ok: true;
      totalPending: number;
      found: number;
      notFound: number;
      skippedNoUrl: number;
      errors: number;
    }
  | { error: string };

/**
 * Dispara el mismo pipeline que el cron `checkResults` (convex/crons/
 * checkResults.ts) para TODAS las myRaces pendientes de una carrera —
 * botón "Buscar resultados ahora" en /admin/races/[id]. Ver
 * convex/adminResultsScan.ts para el detalle y por qué no lleva
 * requireAdmin dentro de la action de Convex.
 */
export async function scanRaceResultsAction(raceId: string): Promise<ScanRaceResultsResult> {
  const { userId } = await auth();
  if (!userId) return { error: "No autenticado" };
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return { error: "NEXT_PUBLIC_CONVEX_URL no configurado" };
  const client = new ConvexHttpClient(convexUrl);
  const profile = await client.query(api.users.getProfileByClerkId, { clerkUserId: userId });
  if (!profile || profile.role !== "admin") {
    return { error: "Solo admins pueden ejecutar esta acción" };
  }
  try {
    const result = await client.action(api.adminResultsScan.adminScanRaceResults, {
      raceId: raceId as any,
    });
    return { ok: true, ...result };
  } catch (e: any) {
    return { error: "Escaneo falló: " + (e?.message ?? e) };
  }
}

"use server";

import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

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
  const patch: Record<string, unknown> = {
    extractedFromUrl: cleaned,
    extractedAt: Date.now(),
  };
  const copyField = (k: string) => {
    const v = (data as any)[k];
    if (v !== null && v !== undefined && v !== "") patch[k] = v;
  };
  for (const k of [
    "name", "startTime", "address", "venue", "longDescription",
    "organizer", "organizerUrl", "contactEmail", "contactPhone",
    "dorsalPickupLocation", "dorsalPickupHours",
    "regulationUrl", "mapUrl", "mapEmbedUrl", "altimetryImageUrl",
    "gpxUrl", "mapImageUrl", "profileImageUrl",
    "registrationOpenDate", "registrationCloseDate",
    "socialInstagram", "socialFacebook", "socialTwitter", "socialYoutube",
    "prizes",
  ]) copyField(k);
  if (typeof data.maxParticipants === "number" && data.maxParticipants > 0) patch.maxParticipants = data.maxParticipants;
  if (typeof data.timeLimitMinutes === "number" && data.timeLimitMinutes > 0) patch.timeLimitMinutes = data.timeLimitMinutes;
  if (typeof data.soldOut === "boolean") patch.soldOut = data.soldOut;
  if (typeof data.trophies === "boolean") patch.trophies = data.trophies;
  if (data.courseType) patch.courseType = data.courseType;
  if (data.raceFormats?.length) patch.raceFormats = data.raceFormats;
  if (data.aidStations?.length) patch.aidStations = data.aidStations;
  if (data.priceTiers?.length) patch.priceTiers = data.priceTiers;
  if (data.cutoffs?.length) patch.cutoffs = data.cutoffs;
  if (data.categories?.length) patch.categories = data.categories;
  if (data.galleryUrls?.length) patch.galleryUrls = data.galleryUrls;
  if (data.altimetryData?.length) patch.altimetryData = data.altimetryData;
  if (data.services && Object.keys(data.services).length > 0) patch.services = data.services;
  if (data.confidence) patch.extractionConfidence = data.confidence;
  try {
    await client.mutation(api.races.adminUpdate, { id: raceId as any, patch });
  } catch (e: any) {
    return { error: "Aplicar falló: " + (e?.message ?? e) };
  }
  return {
    ok: true,
    fieldsApplied: Object.keys(patch).length - 2,
    confidence: data.confidence ?? null,
    url: cleaned,
  };
}
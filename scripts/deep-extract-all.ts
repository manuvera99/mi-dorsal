// =============================================================================
// scripts/deep-extract-all.ts
// =============================================================================
// Re-procesa TODAS las carreras con officialUrl con la extracción profunda IA.
// Por cada carrera: descarga → IA → actualiza via systemUpdate.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/deep-extract-all.ts
//   npx tsx --env-file=.env.local scripts/deep-extract-all.ts --limit=5
//   npx tsx --env-file=.env.local scripts/deep-extract-all.ts --only-missing
//   npx tsx --env-file=.env.local scripts/deep-extract-all.ts --delay=3000
//
// Flags:
//   --limit=N       Procesa solo las primeras N carreras
//   --only-missing  Solo procesa carreras sin extractedAt
//   --delay=MS      Pausa entre extracciones (default 2000ms)
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { deepExtractRace, type ExtractedRaceDeep } from "../lib/ai/extract-race-deep";

const args = process.argv.slice(2);
const limit = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1]) || 0;
const onlyMissing = args.includes("--only-missing");
const delayMs = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1]) || 2000;

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  console.error("❌ NEXT_PUBLIC_CONVEX_URL no configurado en .env.local");
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl);

function buildPatch(data: ExtractedRaceDeep, sourceUrl: string) {
  const patch: Record<string, unknown> = {
    extractedFromUrl: sourceUrl,
    extractedAt: Date.now(),
  };

  const copyField = (key: string) => {
    const v = (data as any)[key];
    if (v !== null && v !== undefined && v !== "") patch[key] = v;
  };

  [
    "name", "startTime", "address", "venue", "longDescription",
    "organizer", "organizerUrl", "contactEmail", "contactPhone",
    "dorsalPickupLocation", "dorsalPickupHours",
    "regulationUrl", "mapUrl", "mapEmbedUrl", "altimetryImageUrl",
    "gpxUrl", "mapImageUrl", "profileImageUrl",
    "registrationOpenDate", "registrationCloseDate",
    "socialInstagram", "socialFacebook", "socialTwitter", "socialYoutube",
    "prizes",
  ].forEach(copyField);

  if (typeof data.maxParticipants === "number" && data.maxParticipants > 0) {
    patch.maxParticipants = data.maxParticipants;
  }
  if (typeof data.timeLimitMinutes === "number" && data.timeLimitMinutes > 0) {
    patch.timeLimitMinutes = data.timeLimitMinutes;
  }
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
  if (data.services && Object.keys(data.services).length > 0) {
    patch.services = data.services;
  }
  if (data.confidence) patch.extractionConfidence = data.confidence;

  return patch;
}

async function main() {
  console.log("=".repeat(70));
  console.log("Deep extract all races (MiniMax M3)");
  console.log("=".repeat(70));
  console.log("Flags:", { limit, onlyMissing, delayMs });

  const all = await client.query(api.races.systemListAll, { onlyWithOfficialUrl: true });
  console.log(`Encontradas ${all.length} carreras con officialUrl`);

  let toProcess = all;
  if (onlyMissing) {
    toProcess = all.filter((r: any) => !r.extractedAt);
    console.log(`Solo sin extraer: ${toProcess.length}`);
  }
  if (limit > 0) {
    toProcess = toProcess.slice(0, limit);
    console.log(`Limitado a: ${toProcess.length}`);
  }

  if (toProcess.length === 0) {
    console.log("Nada que procesar.");
    return;
  }

  let success = 0;
  let failed = 0;
  let totalFieldsApplied = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const r: any = toProcess[i];
    const pct = ((i + 1) / toProcess.length * 100).toFixed(0);
    process.stdout.write(`\n[${i + 1}/${toProcess.length} ${pct}%] ${r.name} (${r.slug})\n  ↳ ${r.officialUrl}\n`);

    try {
      const t0 = Date.now();
      // Limpiar URL por si trae BOM
      const cleanUrl = (r.officialUrl ?? "").replace(/[\uFEFF\u200B-\u200D\u2060]/g, "").trim();
      if (!/^https?:\/\//.test(cleanUrl)) {
        throw new Error(`URL inválida: ${r.officialUrl}`);
      }
      const data = await deepExtractRace(cleanUrl);
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      if (!data) {
        console.log(`  ⚠️  IA devolvió null (${dt}s)`);
        failed++;
        continue;
      }
      console.log(`  ✓ IA (${dt}s) confidence=${data.confidence} — ${data.notes ? `"${data.notes.slice(0, 60)}"` : "ok"}`);

      const patch = buildPatch(data, r.officialUrl);
      const fieldsCount = Object.keys(patch).length - 2; // restar extractedFromUrl + extractedAt
      await client.mutation(api.races.systemUpdate, { id: r._id, patch });
      console.log(`  ✅ ${fieldsCount} campos aplicados`);
      success++;
      totalFieldsApplied += fieldsCount;
    } catch (e: any) {
      console.error(`  ❌ Error: ${e?.message ?? e}`);
      failed++;
    }

    if (i < toProcess.length - 1) {
      process.stdout.write(`  ⏳ Esperando ${delayMs}ms…\n`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("RESUMEN");
  console.log("=".repeat(70));
  console.log(`✅ ${success} carreras actualizadas`);
  console.log(`❌ ${failed} fallaron`);
  console.log(`📊 ${totalFieldsApplied} campos aplicados en total`);
  if (success + failed > 0) {
    console.log(`⏱  ${(totalFieldsApplied / Math.max(1, success)).toFixed(1)} campos/carrera (media)`);
  }
}

main().catch((e) => {
  console.error("❌ Error fatal:", e);
  process.exit(1);
});

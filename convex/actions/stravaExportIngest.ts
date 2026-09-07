// =============================================================================
// mi-dorsal — Strava export ingest (Convex action)
// =============================================================================
// Action que:
//   1) Descarga el ZIP subido a Convex File Storage
//   2) Extrae activities.csv, profile.csv (zip streaming con JSZip)
//   3) Parsea cada fila del CSV con csv-parse (tolerante a columnas faltantes)
//   4) Normaliza con `normalize.ts` (clasificador + tipos)
//   5) Hace cross-reference con `races` (matching fuzzy por nombre + fecha)
//   6) Inserta en `activities` por chunks de 100
//   7) Detecta PRs y los inserta/actualiza en `personalRecords`
//   8) Crea `raceCandidates` para actividades no matcheadas
//   9) Aplica el profile.csv si viene
//  10) Borra el ZIP de File Storage (SIEMPRE)
//  11) Marca el upload como done/failed
//
// Si el ZIP tiene >1000 actividades, parte el trabajo en chunks vía
// `ctx.scheduler.runAfter(0, ...)` para no agotar el timeout de la action.
// =============================================================================

"use node";

import { v } from "convex/values";
import { action, internalAction, internalMutation } from "../_generated/server";
import { internal, api } from "../_generated/api";
import JSZip from "jszip";
import { parse } from "csv-parse";
import {
  normalizeStravaCsvRow,
  findBestRaceMatch,
  matchPRDistance,
  parseStravaProfileRow,
  type StravaCsvRow,
  type NormalizedActivity,
  type RaceMatchCandidate,
  type StravaProfileRow,
} from "../activities/normalize";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const CHUNK_SIZE = 100; // actividades por insert batch
const MAX_ACTIVITIES_PER_CHUNK = 500; // cuántas procesa cada invocación de la action
const SCHEDULE_NEXT_CHUNK_AFTER = 2000; // ms antes de agendar el siguiente chunk

// ---------------------------------------------------------------------------
// Entry point (llamado desde el cliente)
// ---------------------------------------------------------------------------

/**
 * Inicia el ingest de un upload.
 * Estrategia:
 *   - Si el ZIP tiene <= MAX_ACTIVITIES_PER_CHUNK actividades, lo hace en una sola pasada.
 *   - Si tiene más, procesa MAX_ACTIVITIES_PER_CHUNK y agenda el resto.
 */
export const startIngest = action({
  args: { uploadId: v.id("uploads") },
  handler: async (ctx, { uploadId }) => {
    return await runIngest(ctx, { uploadId, offset: 0 });
  },
});

// ---------------------------------------------------------------------------
// Worker de ingest
// ---------------------------------------------------------------------------

interface IngestArgs {
  uploadId: string;
  offset: number;
}

/**
 * Worker recursivo. Procesa hasta MAX_ACTIVITIES_PER_CHUNK actividades
 * desde `offset`, y si quedan más, se auto-replica.
 */
async function runIngest(ctx: any, args: IngestArgs) {
  const { uploadId, offset } = args;

  // 1) Cargar el upload
  const upload = await ctx.runQuery(internal.stravaExportIngestHelpers.getUpload, { uploadId });
  if (!upload) {
    throw new Error(`Upload ${uploadId} no encontrado`);
  }
  if (!upload.fileStorageId) {
    throw new Error("Upload sin fileStorageId (raro, debería existir)");
  }

  // 2) Descargar el ZIP de File Storage
  const zipBlob = await ctx.storage.get(upload.fileStorageId);
  if (!zipBlob) {
    await markFailed(ctx, uploadId, "No se pudo descargar el ZIP de Convex File Storage");
    return { error: "ZIP no encontrado" };
  }

  // 3) Parsear el ZIP
  const zip = await JSZip.loadAsync(zipBlob);

  // 3a) Leer activities.csv
  const activitiesCsv = await readFileFromZip(zip, "activities.csv");
  if (!activitiesCsv) {
    await markFailed(ctx, uploadId, "El ZIP no contiene activities.csv. ¿Es un export de Strava válido?");
    return { error: "activities.csv no encontrado" };
  }

  // 3b) Parsear TODAS las filas del CSV (en memoria). Para ZIPs grandes
  // (>5000 actividades), considerar usar streaming. Por ahora, OK.
  const allRows = await parseCsv<StravaCsvRow>(activitiesCsv);

  // 3c) Si es la primera pasada, leer profile.csv
  if (offset === 0) {
    const profileCsv = await readFileFromZip(zip, "profile.csv");
    if (profileCsv) {
      const profileRows = await parseCsv<StravaProfileRow>(profileCsv);
      const profile = profileRows[0];
      if (profile) {
        const parsed = parseStravaProfileRow(profile);
        const result = await ctx.runMutation(internal.stravaExport.mergeStravaProfile, {
          profile: parsed,
        });
        if (result.fieldsUpdated > 0) {
          await ctx.runMutation(internal.stravaExport.updateUploadStatus, {
            uploadId,
            status: "processing",
            profileFieldsUpdated: result.fieldsUpdated,
          });
        }
      }
    }
  }

  // 4) Marcar como "processing" y guardar total de actividades
  if (offset === 0) {
    await ctx.runMutation(internal.stravaExport.updateUploadStatus, {
      uploadId,
      status: "processing",
      totalActivities: allRows.length,
    });
  }

  // 5) Slice del chunk actual
  const chunkEnd = Math.min(offset + MAX_ACTIVITIES_PER_CHUNK, allRows.length);
  const chunkRows = allRows.slice(offset, chunkEnd);

  // 6) Normalizar
  const normalized: NormalizedActivity[] = [];
  for (const row of chunkRows) {
    const n = normalizeStravaCsvRow(row);
    if (n) normalized.push(n);
  }

  // 7) Cross-reference con `races` (una sola query al inicio del chunk)
  const races = await ctx.runQuery(internal.stravaExportIngestHelpers.listRacesInRange, {
    fromDateMs: Math.min(...normalized.map((a) => a.startedAt)) - 7 * 24 * 60 * 60 * 1000,
    toDateMs: Math.max(...normalized.map((a) => a.startedAt)) + 7 * 24 * 60 * 60 * 1000,
  });
  const raceCandidates: RaceMatchCandidate[] = races.map((r: any) => ({
    _id: r._id,
    name: r.name,
    slug: r.slug,
    locality: r.locality,
    startDate: r.startDate,
    distanceKm: r.distanceKm,
  }));

  // 8) Para cada actividad: match + upsert + PR check
  let processedInChunk = 0;
  let matchedInChunk = 0;
  let prsInChunk = 0;
  let candidatesInChunk = 0;

  for (let i = 0; i < normalized.length; i++) {
    const activity = normalized[i];

    // Cross-reference
    const matchedRaceId = findBestRaceMatch(activity, raceCandidates);

    // Upsert actividad
    await ctx.runMutation(internal.stravaExport.upsertActivityInternal, {
      userId: upload.userId,
      provider: "strava-export",
      source: "export",
      providerActivityId: activity.providerActivityId,
      type: activity.classifiedType,
      name: activity.name,
      startedAt: activity.startedAt,
      durationSec: activity.durationSec,
      distanceM: activity.distanceM,
      avgPaceSecPerKm: activity.avgPaceSecPerKm,
      avgHeartRate: activity.avgHeartRate,
      maxHeartRate: activity.maxHeartRate,
      avgCadence: activity.avgCadence,
      elevationGainM: activity.elevationGainM,
      elevationLossM: activity.elevationLossM,
      description: activity.description,
      matchedRaceId: matchedRaceId as any,
      isPrivate: activity.isPrivate,
      rawPayload: JSON.stringify(activity.rawPayload ?? {}),
    });

    if (matchedRaceId) matchedInChunk++;

    // PR check (solo si es candidato a PR)
    const prDistanceM = matchPRDistance(activity.distanceM);
    if (
      prDistanceM &&
      (activity.classifiedType === "race" ||
        activity.classifiedType === "long_run" ||
        activity.classifiedType === "tempo")
    ) {
      const prResult = await ctx.runMutation(
        internal.stravaExport.checkAndUpdatePR,
        {
          userId: upload.userId,
          distanceM: prDistanceM,
          timeSeconds: activity.durationSec,
          raceId: matchedRaceId as any,
          achievedAt: new Date(activity.startedAt).toISOString(),
          source: "strava-export",
        },
      );
      if (prResult.updated) prsInChunk++;
    }

    // Race candidate si no matcheó
    if (!matchedRaceId && activity.name && activity.classifiedType === "race") {
      await ctx.runMutation(internal.stravaExport.upsertRaceCandidate, {
        name: activity.name,
        date: activity.startedAt,
        locality: undefined,
        distanceM: activity.distanceM,
        userId: upload.userId,
      });
      candidatesInChunk++;
    }

    processedInChunk++;

    // Actualizar progreso cada 25 actividades (no en cada una, para no
    // saturar Convex con mutations)
    if (processedInChunk % 25 === 0) {
      await ctx.runMutation(internal.stravaExport.updateUploadStatus, {
        uploadId,
        status: "processing",
        processedActivities: offset + processedInChunk,
      });
    }
  }

  // 9) Actualizar progreso con los totales de este chunk
  await ctx.runMutation(internal.stravaExport.updateUploadStatus, {
    uploadId,
    status: chunkEnd >= allRows.length ? "done" : "processing",
    processedActivities: chunkEnd,
    matchedRaces: ((upload.matchedRaces as number) ?? 0) + matchedInChunk,
    newPRs: ((upload.newPRs as number) ?? 0) + prsInChunk,
    candidatesAdded: ((upload.candidatesAdded as number) ?? 0) + candidatesInChunk,
    finishedAt: chunkEnd >= allRows.length ? Date.now() : undefined,
  });

  // 10) Si quedan más, agendar el siguiente chunk
  if (chunkEnd < allRows.length) {
    // Este archivo vive en convex/actions/stravaExportIngest.ts, así que su
    // namespace real es "actions/stravaExportIngest" (con prefijo de carpeta).
    await ctx.scheduler.runAfter(
      SCHEDULE_NEXT_CHUNK_AFTER,
      (internal as any)["actions/stravaExportIngest"].continueIngest,
      { uploadId, offset: chunkEnd },
    );
  } else {
    // 11) Trabajo terminado: borrar el ZIP de File Storage
    try {
      await ctx.storage.delete(upload.fileStorageId);
    } catch {
      // Si falla, no es crítico (el archivo quedará huérfano pero no es
      // problema de seguridad, solo de espacio).
    }
  }

  return {
    processed: processedInChunk,
    totalProcessed: chunkEnd,
    total: allRows.length,
    hasMore: chunkEnd < allRows.length,
  };
}

/**
 * Continuación del ingest para ZIPs grandes.
 */
export const continueIngest = internalAction({
  args: { uploadId: v.id("uploads"), offset: v.number() },
  handler: async (ctx, args) => {
    return await runIngest(ctx, args);
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function markFailed(ctx: any, uploadId: string, error: string) {
  await ctx.runMutation(internal.stravaExport.updateUploadStatus, {
    uploadId,
    status: "failed",
    error,
    finishedAt: Date.now(),
  });
  // Intentar borrar el ZIP igualmente
  const upload = await ctx.runQuery(internal.stravaExportIngestHelpers.getUpload, {
    uploadId,
  });
  if (upload?.fileStorageId) {
    try {
      await ctx.storage.delete(upload.fileStorageId);
    } catch {
      // ignore
    }
  }
}

async function readFileFromZip(zip: JSZip, fileName: string): Promise<string | null> {
  const file = zip.file(fileName);
  if (!file) return null;
  return await file.async("string");
}

/**
 * Parsea un CSV con csv-parse, tolerante a columnas cambiantes.
 * Devuelve un array de objetos keyed por header.
 */
async function parseCsv<T extends Record<string, unknown>>(content: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const records: T[] = [];
    const parser = parse({
      columns: true,          // usar la primera fila como header
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,  // permitir filas con distinto nº de columnas
      relax_quotes: true,        // permitir comillas mal formadas
      bom: true,                // tolerar BOM al inicio
    });
    parser.on("readable", () => {
      let record: T;
      while ((record = parser.read() as T)) {
        records.push(record);
      }
    });
    parser.on("error", (err) => reject(err));
    parser.on("end", () => resolve(records));
    parser.write(content);
    parser.end();
  });
}

// =============================================================================
// mi-dorsal — Strava export: queries, mutations, RGPD
// =============================================================================
// Punto de entrada desde el cliente para el flujo de upload del export de
// Strava (Ola 0). El cliente usa:
//   - createUpload             → mutation que crea un upload en "pending"
//   - getUploadStatus          → query reactivo del progreso
//   - getMyActivities          → listado de actividades ingestadas
//   - getMyActivityCount       → contador para el perfil
//   - getMyStravaSummary       → resumen del estado de la conexión
//   - deleteMyStravaExportData → RGPD: borrar todos los datos de Strava
//                                 que vinieron del export
// =============================================================================

import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireUser, getOptionalUser } from "./_helpers";
import { getDistanceLabel } from "./_helpers";
import { parseStravaProfileRow, type StravaProfileRow } from "./activities/normalize";

// ---------------------------------------------------------------------------
// Helpers internos (los usa la action de ingest)
// ---------------------------------------------------------------------------

/**
 * Inserta una actividad con idempotencia por (provider, providerActivityId).
 * Si ya existe, hace patch (no insert). Devuelve la id.
 */
export const upsertActivityInternal = internalMutation({
  args: {
    userId: v.id("profiles"),
    provider: v.union(
      v.literal("strava"),
      v.literal("strava-export"),
      v.literal("garmin"),
    ),
    providerActivityId: v.string(),
    source: v.union(v.literal("oauth"), v.literal("export")),
    type: v.union(
      v.literal("race"),
      v.literal("long_run"),
      v.literal("tempo"),
      v.literal("interval"),
      v.literal("easy"),
      v.literal("recovery"),
      v.literal("trail"),
    ),
    name: v.optional(v.string()),
    startedAt: v.number(),
    durationSec: v.number(),
    distanceM: v.number(),
    avgPaceSecPerKm: v.optional(v.number()),
    avgHeartRate: v.optional(v.number()),
    maxHeartRate: v.optional(v.number()),
    avgCadence: v.optional(v.number()),
    elevationGainM: v.optional(v.number()),
    elevationLossM: v.optional(v.number()),
    description: v.optional(v.string()),
    matchedRaceId: v.optional(v.id("races")),
    isOfficialResult: v.optional(v.boolean()),
    isPrivate: v.optional(v.boolean()),
    rawPayload: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Idempotencia: buscar existente por (provider, providerActivityId)
    const existing = await ctx.db
      .query("activities")
      .withIndex("by_provider_activity", (q) =>
        q.eq("provider", args.provider).eq("providerActivityId", args.providerActivityId),
      )
      .first();

    if (existing) {
      // Patch solo los campos que han cambiado
      await ctx.db.patch(existing._id, {
        type: args.type,
        name: args.name,
        startedAt: args.startedAt,
        durationSec: args.durationSec,
        distanceM: args.distanceM,
        avgPaceSecPerKm: args.avgPaceSecPerKm,
        avgHeartRate: args.avgHeartRate,
        maxHeartRate: args.maxHeartRate,
        avgCadence: args.avgCadence,
        elevationGainM: args.elevationGainM,
        elevationLossM: args.elevationLossM,
        description: args.description,
        matchedRaceId: args.matchedRaceId,
        isPrivate: args.isPrivate,
        syncedAt: Date.now(),
      });
      return { id: existing._id, created: false };
    }

    const id = await ctx.db.insert("activities", {
      ...args,
      syncedAt: Date.now(),
    });
    return { id, created: true };
  },
});

/**
 * Detecta e inserta/actualiza PRs. Esta mutación es la que la action llama
 * por cada actividad que matchea con una distancia PR estándar.
 */
export const checkAndUpdatePR = internalMutation({
  args: {
    userId: v.id("profiles"),
    distanceM: v.number(),
    timeSeconds: v.number(),
    raceId: v.optional(v.id("races")),
    achievedAt: v.optional(v.string()),
    source: v.union(
      v.literal("strava"),
      v.literal("strava-export"),
    ),
  },
  handler: async (ctx, args) => {
    // Buscar PR actual
    const current = await ctx.db
      .query("personalRecords")
      .withIndex("by_user_distance_current", (q) =>
        q
          .eq("userId", args.userId)
          .eq("distanceM", args.distanceM)
          .eq("isCurrent", true),
      )
      .unique();

    // Si el nuevo tiempo es igual o peor, no hacer nada
    if (current && args.timeSeconds >= current.timeSeconds) {
      return { updated: false, previousTimeSeconds: current.timeSeconds };
    }

    const previousTimeSeconds = current?.timeSeconds;

    if (current) {
      await ctx.db.patch(current._id, { isCurrent: false });
    }

    const id = await ctx.db.insert("personalRecords", {
      userId: args.userId,
      distanceM: args.distanceM,
      distanceLabel: getDistanceLabel(args.distanceM),
      timeSeconds: args.timeSeconds,
      achievedAt: args.achievedAt,
      raceId: args.raceId,
      source: args.source,
      isCurrent: true,
    });

    return { updated: true, id, previousTimeSeconds };
  },
});

/**
 * Inserta o incrementa un race candidate. Si ya existe uno con el mismo
 * (name, date), incrementa occurrenceCount.
 */
export const upsertRaceCandidate = internalMutation({
  args: {
    name: v.string(),
    date: v.number(),
    locality: v.optional(v.string()),
    distanceM: v.optional(v.number()),
    userId: v.id("profiles"),
  },
  handler: async (ctx, args) => {
    // Buscar por (name, date). Usamos un día como bucket (date a medianoche UTC).
    const dayStart = new Date(args.date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = dayStart.getTime() + 24 * 60 * 60 * 1000;

    const existing = await ctx.db
      .query("raceCandidates")
      .withIndex("by_name_date", (q) =>
        q
          .eq("name", args.name)
          .gte("date", dayStart.getTime())
          .lt("date", dayEnd),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        occurrenceCount: existing.occurrenceCount + 1,
        lastSeenAt: Date.now(),
      });
      return { id: existing._id, created: false };
    }

    const id = await ctx.db.insert("raceCandidates", {
      name: args.name,
      date: dayStart.getTime(),
      locality: args.locality,
      distanceM: args.distanceM,
      userId: args.userId,
      occurrenceCount: 1,
      status: "candidate",
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
    });
    return { id, created: true };
  },
});

/**
 * Actualiza el perfil del usuario con datos del profile.csv de Strava.
 * Solo pisa campos que el usuario aún no haya rellenado.
 */
export const mergeStravaProfile = internalMutation({
  args: {
    profile: v.object({
      city: v.optional(v.string()),
      weightKg: v.optional(v.number()),
      maxHr: v.optional(v.number()),
      restHr: v.optional(v.number()),
    }),
  },
  handler: async (ctx, { profile }) => {
    const user = await requireUser(ctx);
    const patch: Record<string, unknown> = {};
    let fieldsUpdated = 0;

    if (profile.city && !user.stravaAthleteCity) {
      patch.stravaAthleteCity = profile.city;
      fieldsUpdated++;
    }
    if (profile.weightKg && !user.stravaAthleteWeightKg) {
      patch.stravaAthleteWeightKg = profile.weightKg;
      fieldsUpdated++;
    }
    if (profile.maxHr && !user.stravaAthleteMaxHr) {
      patch.stravaAthleteMaxHr = profile.maxHr;
      fieldsUpdated++;
    }
    if (profile.restHr && !user.stravaAthleteRestHr) {
      patch.stravaAthleteRestHr = profile.restHr;
      fieldsUpdated++;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(user._id, patch);
    }

    return { fieldsUpdated };
  },
});

/**
 * Actualiza el estado de un upload. Lo llama la action de ingest para
 * reportar progreso.
 */
export const updateUploadStatus = internalMutation({
  args: {
    uploadId: v.id("uploads"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("failed"),
    ),
    processedActivities: v.optional(v.number()),
    totalActivities: v.optional(v.number()),
    matchedRaces: v.optional(v.number()),
    newPRs: v.optional(v.number()),
    candidatesAdded: v.optional(v.number()),
    profileFieldsUpdated: v.optional(v.number()),
    error: v.optional(v.string()),
    finishedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { uploadId, ...rest } = args;
    const patch: Record<string, unknown> = { ...rest };
    if (args.status === "processing" && !args.processedActivities) {
      patch.processedActivities = 0;
    }
    await ctx.db.patch(uploadId, patch);

    // Si termina OK, actualizar contadores en el profile
    if (args.status === "done") {
      const upload = await ctx.db.get(uploadId);
      if (upload) {
        await ctx.db.patch(upload.userId, {
          stravaExportLastUploadAt: Date.now(),
          stravaExportLastActivityCount: args.processedActivities ?? 0,
          stravaExportLastRaceCount: args.matchedRaces ?? 0,
          stravaExportLastPRCount: args.newPRs ?? 0,
        });
      }
    }
  },
});

// ---------------------------------------------------------------------------
// API pública (cliente)
// ---------------------------------------------------------------------------

/**
 * Crea un upload en estado "pending". El cliente después subirá el ZIP a
 * Convex File Storage con un uploadId temporal, pero el patrón correcto
 * es: el cliente llama a esta mutation primero, recibe el uploadId, y
 * después sube el archivo asociado a ese uploadId.
 *
 * Pero como Convex File Storage funciona con `generateUploadUrl` separado
 * de las mutations, el flujo real es:
 *   1) Cliente: `await convex.mutation(api.stravaExport.createUpload, {...})`
 *      → devuelve uploadId
 *   2) Cliente: `await fetch(generateUploadUrl, ...)` → POST file
 *      → devuelve storageId
 *   3) Cliente: `await convex.mutation(api.stravaExport.attachFileToUpload, {uploadId, storageId})`
 *   4) Cliente: `await convex.action(api["actions/stravaExportIngest"].startIngest, {uploadId})`
 *      → arranca la action de ingest
 *
 * Por simplicidad en este PR inicial, vamos a hacer (1)+(3)+(4) en una
 * sola mutation `createUploadAndStart` que toma el fileStorageId directamente.
 * El cliente primero obtiene la upload URL con `generateUploadUrl`.
 */
export const createUploadAndStart = mutation({
  args: {
    fileStorageId: v.id("_storage"),
    fileName: v.string(),
    fileSizeBytes: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Validar tamaño (200 MB max, alineado con el plan)
    const MAX_SIZE = 200 * 1024 * 1024;
    if (args.fileSizeBytes > MAX_SIZE) {
      throw new Error(
        `El archivo pesa ${(args.fileSizeBytes / 1024 / 1024).toFixed(1)} MB, máximo 200 MB`,
      );
    }
    if (args.fileSizeBytes < 1024) {
      throw new Error("El archivo es demasiado pequeño para ser un export de Strava");
    }

    const uploadId = await ctx.db.insert("uploads", {
      userId: user._id,
      source: "strava-export",
      fileStorageId: args.fileStorageId,
      fileName: args.fileName,
      fileSizeBytes: args.fileSizeBytes,
      status: "pending",
      startedAt: Date.now(),
    });

    return { uploadId };
  },
});

/** Estado de un upload (consulta reactiva del cliente). */
export const getUploadStatus = query({
  args: { uploadId: v.id("uploads") },
  handler: async (ctx, { uploadId }) => {
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    const upload = await ctx.db.get(uploadId);
    if (!upload) return null;
    if (upload.userId !== user._id) return null; // 404 disguised

    return {
      _id: upload._id,
      status: upload.status,
      fileName: upload.fileName,
      fileSizeBytes: upload.fileSizeBytes,
      totalActivities: upload.totalActivities ?? 0,
      processedActivities: upload.processedActivities ?? 0,
      matchedRaces: upload.matchedRaces ?? 0,
      newPRs: upload.newPRs ?? 0,
      candidatesAdded: upload.candidatesAdded ?? 0,
      profileFieldsUpdated: upload.profileFieldsUpdated ?? 0,
      error: upload.error,
      startedAt: upload.startedAt,
      finishedAt: upload.finishedAt,
    };
  },
});

/** Lista de uploads del usuario (para el historial de /perfil). */
export const getMyUploads = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("uploads")
      .withIndex("by_user_started", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(20);
  },
});

/** Resumen del estado de Strava del usuario (para la card de conexiones). */
export const getMyStravaSummary = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return null;

    // Conteo de actividades por provider
    const allActivities = await ctx.db
      .query("activities")
      .withIndex("by_user_started", (q) => q.eq("userId", user._id))
      .collect();

    const fromExport = allActivities.filter((a) => a.provider === "strava-export").length;
    const fromOAuth = allActivities.filter((a) => a.provider === "strava").length;

    // Carreras detectadas (con matchedRaceId)
    const racesMatched = new Set(
      allActivities
        .filter((a) => a.matchedRaceId)
        .map((a) => a.matchedRaceId as string),
    ).size;

    return {
      fromExport,
      fromOAuth,
      total: allActivities.length,
      racesMatched,
      lastExportAt: user.stravaExportLastUploadAt ?? null,
      lastExportActivityCount: user.stravaExportLastActivityCount ?? null,
      lastExportRaceCount: user.stravaExportLastRaceCount ?? null,
      lastExportPRCount: user.stravaExportLastPRCount ?? null,
    };
  },
});

/**
 * Borra TODOS los datos del usuario que vinieron del export de Strava.
 * RGPD: derecho al olvido. No afecta a datos introducidos manualmente
 * (PRs, myRaces) ni a futuras conexiones OAuth.
 */
export const deleteMyStravaExportData = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    // 1) Borrar actividades del export
    const exportActivities = await ctx.db
      .query("activities")
      .withIndex("by_user_started", (q) => q.eq("userId", user._id))
      .collect();

    let activitiesDeleted = 0;
    for (const act of exportActivities) {
      if (act.provider === "strava-export") {
        await ctx.db.delete(act._id);
        activitiesDeleted++;
      }
    }

    // 2) Borrar uploads (incluido el fileStorageId → se borra el ZIP de storage)
    const uploads = await ctx.db
      .query("uploads")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    let uploadsDeleted = 0;
    for (const upload of uploads) {
      if (upload.fileStorageId) {
        try {
          await ctx.storage.delete(upload.fileStorageId);
        } catch {
          // Si el archivo ya no existe, no es un error
        }
      }
      await ctx.db.delete(upload._id);
      uploadsDeleted++;
    }

    // 3) Limpiar campos de profile del export
    await ctx.db.patch(user._id, {
      stravaExportLastUploadAt: undefined,
      stravaExportLastActivityCount: undefined,
      stravaExportLastRaceCount: undefined,
      stravaExportLastPRCount: undefined,
      stravaAthleteCity: undefined,
      stravaAthleteWeightKg: undefined,
      stravaAthleteMaxHr: undefined,
      stravaAthleteRestHr: undefined,
    });

    return { activitiesDeleted, uploadsDeleted };
  },
});

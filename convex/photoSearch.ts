// =============================================================================
// mi-dorsal — "Encuentra tus fotos" (mutations/queries)
// =============================================================================
// Mutations/queries del flujo de reconocimiento facial. La búsqueda en sí
// (llamada HTTP a Modal) vive en convex/photoSearchActions.ts — este archivo
// solo gestiona el ciclo de vida del documento `photoSearchJobs`.
//
// Ver docs/plans/PHOTO_SEARCH_TECH.md §15 para el contrato real del
// endpoint de Modal y por qué el schema difiere del pseudocódigo original.
// =============================================================================

import { v } from "convex/values";
import {
  mutation,
  query,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser, getOptionalUser, assertOwner } from "./_helpers";
import { currentUserHasPremium } from "./subscriptions";
import { Doc, Id } from "./_generated/dataModel";

const MAX_JOBS_PER_DAY = 20;
const JOB_TTL_MS = 24 * 60 * 60 * 1000;

// =============================================================================
// MUTATIONS
// =============================================================================

/** URL de subida para una selfie de referencia. Requiere Pro (mismo gate
 *  que create) — evita que cualquiera use el Storage del proyecto sin
 *  intención real de crear un job. */
export const generateSelfieUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const hasAccess = await currentUserHasPremium(ctx);
    if (!hasAccess) {
      throw new Error("Requiere suscripción Pro");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

/** Crea un job de búsqueda y dispara la action que llama a Modal.
 *  Gate Pro (bypass automático para admin/test, ver subscriptions.ts). */
export const create = mutation({
  args: {
    raceId: v.id("races"),
    dorsal: v.optional(v.string()),
    selfieStorageIds: v.array(v.id("_storage")),
    // 1-3 álbumes de esta búsqueda concreta — el usuario puede aportar su
    // propio enlace (no se guarda en `races.photosUrl`, solo aquí; cada
    // búsqueda es independiente). Si no se pasa nada y la carrera ya tiene
    // photosUrl (puesto por el admin), se usa como default.
    albumUrls: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const profile = await requireUser(ctx);

    const hasAccess = await currentUserHasPremium(ctx);
    if (!hasAccess) {
      throw new Error("Requiere suscripción Pro");
    }

    if (args.selfieStorageIds.length === 0 || args.selfieStorageIds.length > 3) {
      throw new Error("Sube entre 1 y 3 selfies");
    }

    const race = await ctx.db.get(args.raceId);
    if (!race) throw new Error("Carrera no encontrada");

    const rawAlbumUrls =
      args.albumUrls && args.albumUrls.length > 0
        ? args.albumUrls
        : race.photosUrl
          ? [race.photosUrl]
          : [];

    if (rawAlbumUrls.length === 0) {
      throw new Error("Añade al menos un enlace de álbum de fotos");
    }
    if (rawAlbumUrls.length > 3) {
      throw new Error("Máximo 3 álbumes por búsqueda");
    }

    const albumUrls: string[] = [];
    for (const raw of rawAlbumUrls) {
      const trimmed = raw.trim();
      let parsed: URL;
      try {
        parsed = new URL(trimmed);
      } catch {
        throw new Error(`"${trimmed}" no es una URL válida`);
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("Los álbumes deben ser enlaces http:// o https://");
      }
      albumUrls.push(parsed.toString());
    }

    // Flickr y ChipLevante (15 sep 2026, ver
    // findmyrace/sources/chiplevante.py) tienen downloader real hoy —
    // get_source_for_url en el servicio lanza un 400 explícito para
    // cualquier otra URL. Rechazamos aquí solo si NINGÚN álbum es
    // soportado — evita gastar un job y una llamada a Modal por algo que
    // sabemos que va a fallar del todo; si al menos uno es soportado, se
    // deja pasar (el servicio ya ignora los no soportados y sigue con
    // los demás, ver photo-search-api/api/find_photos.py).
    const SUPPORTED_ALBUM_DOMAINS = ["flickr.com", "chiplevante.com"];
    if (!albumUrls.some((u) => SUPPORTED_ALBUM_DOMAINS.some((d) => u.includes(d)))) {
      throw new Error(
        "Ninguno de los álbumes es de un proveedor soportado (Flickr o ChipLevante por ahora).",
      );
    }

    const oneDayAgo = Date.now() - JOB_TTL_MS;
    const recentJobs = await ctx.db
      .query("photoSearchJobs")
      .withIndex("by_user", (q) => q.eq("userId", profile._id))
      .filter((q) => q.gte(q.field("createdAt"), oneDayAgo))
      .collect();
    if (recentJobs.length >= MAX_JOBS_PER_DAY) {
      throw new Error(
        `Has alcanzado el límite diario de búsquedas (${MAX_JOBS_PER_DAY})`,
      );
    }

    const myRace = await ctx.db
      .query("myRaces")
      .withIndex("by_user_race", (q) =>
        q.eq("userId", profile._id).eq("raceId", args.raceId),
      )
      .first();

    const now = Date.now();
    const jobId = await ctx.db.insert("photoSearchJobs", {
      userId: profile._id,
      raceId: args.raceId,
      dorsal: args.dorsal ?? myRace?.dorsalNumber,
      selfieStorageIds: args.selfieStorageIds,
      selfieCount: args.selfieStorageIds.length,
      status: "pending",
      results: [],
      albumUrls,
      createdAt: now,
      expiresAt: now + JOB_TTL_MS,
    });

    await ctx.scheduler.runAfter(0, internal.photoSearchActions.runJob, { jobId });

    return jobId;
  },
});

/** Cancela un job propio, si aún no ha terminado. Borra las selfies ya. */
export const cancel = mutation({
  args: { jobId: v.id("photoSearchJobs") },
  handler: async (ctx, { jobId }) => {
    const profile = await requireUser(ctx);
    const job = await ctx.db.get(jobId);
    assertOwner(job, profile._id, "Búsqueda de fotos");

    if (job.status === "done" || job.status === "error" || job.status === "cancelled") {
      return;
    }

    await ctx.db.patch(jobId, {
      status: "cancelled",
      completedAt: Date.now(),
    });

    for (const storageId of job.selfieStorageIds) {
      await ctx.storage.delete(storageId);
    }
  },
});

// =============================================================================
// QUERIES
// =============================================================================

/** Snapshot ligero del job, para polling desde la UI mientras corre. */
export const getJob = query({
  args: { jobId: v.id("photoSearchJobs") },
  handler: async (ctx, { jobId }) => {
    const profile = await requireUser(ctx);
    const job = await ctx.db.get(jobId);
    if (!job) return null;
    if (job.userId !== profile._id) throw new Error("No autorizado");

    return {
      _id: job._id,
      status: job.status,
      resultCount: job.results.length,
      rejectedSelfies: job.rejectedSelfies,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    };
  },
});

/** Resultados completos — cargar solo cuando status es "done". */
export const getResults = query({
  args: { jobId: v.id("photoSearchJobs") },
  handler: async (ctx, { jobId }) => {
    const profile = await requireUser(ctx);
    const job = await ctx.db.get(jobId);
    if (!job) return null;
    if (job.userId !== profile._id) throw new Error("No autorizado");

    return {
      _id: job._id,
      raceId: job.raceId,
      dorsal: job.dorsal,
      status: job.status,
      results: job.results,
      stats: job.stats,
      completedAt: job.completedAt,
    };
  },
});

/** Histórico de búsquedas del usuario actual (p. ej. /perfil/fotos). */
export const listMine = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) => {
    const profile = await getOptionalUser(ctx);
    if (!profile) return [];

    return await ctx.db
      .query("photoSearchJobs")
      .withIndex("by_user", (q) => q.eq("userId", profile._id))
      .order("desc")
      .take(limit);
  },
});

/** Todas las carreras del calendario del usuario, con el álbum conocido (si
 *  el admin ya lo puso) y el job más reciente (si ya buscó antes). Ya no se
 *  filtra por "tiene álbum de Flickr" — el usuario puede aportar su propio
 *  enlace en /perfil/fotos/[raceId] aunque la carrera no tenga ninguno. */
export const listRacesWithPhotos = query({
  args: {},
  handler: async (ctx) => {
    const profile = await getOptionalUser(ctx);
    if (!profile) return [];

    const myRaces = await ctx.db
      .query("myRaces")
      .withIndex("by_user", (q) => q.eq("userId", profile._id))
      .collect();

    const withPhotos: {
      race: Doc<"races">;
      dorsal: string | undefined;
      lastJob: {
        _id: Id<"photoSearchJobs">;
        status: Doc<"photoSearchJobs">["status"];
        resultCount: number;
      } | null;
    }[] = [];
    for (const myRace of myRaces) {
      const race = await ctx.db.get(myRace.raceId);
      if (!race) continue;

      const lastJob = await ctx.db
        .query("photoSearchJobs")
        .withIndex("by_user_race", (q) =>
          q.eq("userId", profile._id).eq("raceId", race._id),
        )
        .order("desc")
        .first();

      withPhotos.push({
        race,
        dorsal: myRace.dorsalNumber,
        lastJob: lastJob
          ? { _id: lastJob._id, status: lastJob.status, resultCount: lastJob.results.length }
          : null,
      });
    }

    return withPhotos;
  },
});

/** Contexto de una carrera concreta para /perfil/fotos/[raceId]: el
 *  dorsal inscrito (si hay), el álbum conocido de la carrera (si el admin
 *  ya lo puso — usado como valor prellenado, no bloqueante) y el job más
 *  reciente del usuario (si existe) — la UI decide si mostrar el
 *  formulario de subida o el resultado de la última búsqueda. */
export const getRaceContext = query({
  args: { raceId: v.id("races") },
  handler: async (ctx, { raceId }) => {
    const profile = await getOptionalUser(ctx);
    if (!profile) return null;

    const race = await ctx.db.get(raceId);
    if (!race) return null;

    const myRace = await ctx.db
      .query("myRaces")
      .withIndex("by_user_race", (q) => q.eq("userId", profile._id).eq("raceId", raceId))
      .first();

    const lastJob = await ctx.db
      .query("photoSearchJobs")
      .withIndex("by_user_race", (q) => q.eq("userId", profile._id).eq("raceId", raceId))
      .order("desc")
      .first();

    return {
      race,
      dorsal: myRace?.dorsalNumber,
      defaultAlbumUrl: race.photosUrl,
      lastJobId: lastJob?._id ?? null,
    };
  },
});

// =============================================================================
// INTERNAL — usadas solo desde photoSearchActions.ts (llamadas server-to-server,
// sin identity de usuario disponible)
// =============================================================================

export const getJobInternal = internalQuery({
  args: { jobId: v.id("photoSearchJobs") },
  handler: async (ctx, { jobId }) => {
    return await ctx.db.get(jobId);
  },
});

/** myRaceId del usuario para esta carrera, si existe — usado por
 *  photoSearchActions.ts::runJob al enviar el email de aviso: si el
 *  usuario no tiene myRace (buscó sin dorsal inscrito), se envía igual
 *  pero el log de idempotencia usa raceId en vez de myRaceId. */
export const getMyRaceIdForNotification = internalQuery({
  args: { userId: v.id("profiles"), raceId: v.id("races") },
  handler: async (ctx, { userId, raceId }) => {
    const myRace = await ctx.db
      .query("myRaces")
      .withIndex("by_user_race", (q) => q.eq("userId", userId).eq("raceId", raceId))
      .first();
    return myRace?._id ?? null;
  },
});

export const markRunning = internalMutation({
  args: { jobId: v.id("photoSearchJobs") },
  handler: async (ctx, { jobId }) => {
    await ctx.db.patch(jobId, { status: "running", startedAt: Date.now() });
  },
});

export const markDone = internalMutation({
  args: {
    jobId: v.id("photoSearchJobs"),
    results: v.array(
      v.object({
        photoUrl: v.string(),
        score: v.number(),
        identityConfirmed: v.boolean(),
        faceScore: v.optional(v.number()),
        dorsalMatch: v.optional(v.string()),
        bbox: v.optional(
          v.object({ x: v.number(), y: v.number(), w: v.number(), h: v.number() }),
        ),
      }),
    ),
    rejectedSelfies: v.optional(
      v.array(v.object({ index: v.number(), reasons: v.array(v.string()) })),
    ),
    stats: v.optional(
      v.object({
        photosScanned: v.number(),
        photosOmitted: v.optional(v.number()),
        durationMs: v.number(),
        platform: v.string(),
      }),
    ),
  },
  handler: async (ctx, { jobId, results, rejectedSelfies, stats }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;
    // Borra las selfies en cuanto el job termina — nunca deben persistir
    // más que el tiempo de la búsqueda en sí (ver docstring del schema).
    await deleteSelfies(ctx, job.selfieStorageIds);

    await ctx.db.patch(jobId, {
      status: "done",
      results,
      rejectedSelfies,
      stats,
      completedAt: Date.now(),
    });
  },
});

export const markError = internalMutation({
  args: {
    jobId: v.id("photoSearchJobs"),
    error: v.string(),
    rejectedSelfies: v.optional(
      v.array(v.object({ index: v.number(), reasons: v.array(v.string()) })),
    ),
  },
  handler: async (ctx, { jobId, error, rejectedSelfies }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;
    await deleteSelfies(ctx, job.selfieStorageIds);

    await ctx.db.patch(jobId, {
      status: "error",
      error,
      rejectedSelfies,
      completedAt: Date.now(),
    });
  },
});

/** Jobs cuyo expiresAt ya pasó — usado por el cron de limpieza. */
export const getExpiredJobsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    return await ctx.db
      .query("photoSearchJobs")
      .withIndex("by_expires_at", (q) => q.lte("expiresAt", now))
      .take(100);
  },
});

export const deleteJobInternal = internalMutation({
  args: { jobId: v.id("photoSearchJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;
    await deleteSelfies(ctx, job.selfieStorageIds);
    await ctx.db.delete(jobId);
  },
});

async function deleteSelfies(
  ctx: { storage: { delete: (id: Id<"_storage">) => Promise<void> } },
  storageIds: Id<"_storage">[],
): Promise<void> {
  for (const storageId of storageIds) {
    await ctx.storage.delete(storageId).catch(() => {
      // Ya borrada (p. ej. cancel() la borró antes) — no es un error real.
    });
  }
}

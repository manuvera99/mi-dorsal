// =============================================================================
// mi-dorsal — "Encuentra tus fotos" (llamada real al servicio de matching)
// =============================================================================
// El servicio real vive en photo-search-api/ (findmyrace/ + api/find_photos.py),
// desplegado en Modal — ver docs/plans/PHOTO_SEARCH_TECH.md §15.7 para por qué
// Modal y no Vercel (cold-start: /tmp no persiste pesos de modelo entre
// invocaciones).
//
// Env vars requeridas en el deployment de Convex (`npx convex env set`):
//   PHOTO_SEARCH_API_URL    = https://manuvera08--photo-search-api-fastapi-app.modal.run
//   PHOTO_SEARCH_API_SECRET = <mismo valor que el secret creado en Modal>
// =============================================================================

"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

interface FindPhotosResult {
  photoUrl: string;
  score: number;
  identityConfirmed: boolean;
  faceScore: number | null;
  dorsalMatch: string | null;
  bbox: { x: number; y: number; w: number; h: number } | null;
}

interface FindPhotosResponse {
  jobId: string;
  status: "done" | "error";
  results?: FindPhotosResult[];
  rejectedSelfies?: { index: number; reasons: string[] }[];
  stats?: { photosScanned: number; durationMs: number; platform: string };
  error?: string;
}

export const runJob = internalAction({
  args: { jobId: v.id("photoSearchJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.runQuery(internal.photoSearch.getJobInternal, { jobId });
    if (!job || job.status === "cancelled") return;

    const apiUrl = process.env.PHOTO_SEARCH_API_URL;
    const apiSecret = process.env.PHOTO_SEARCH_API_SECRET;
    if (!apiUrl || !apiSecret) {
      await ctx.runMutation(internal.photoSearch.markError, {
        jobId,
        error: "Servicio de búsqueda de fotos no configurado (faltan env vars)",
      });
      return;
    }

    await ctx.runMutation(internal.photoSearch.markRunning, { jobId });

    try {
      // URLs firmadas y temporales de Convex Storage — el servicio las
      // descarga, nunca recibe los bytes en el body (ver docstring de
      // find_photos.py: el límite de payload de Vercel/Modal es ajustado
      // para 1-3 fotos, y esto evita ese límite del todo).
      const selfieUrls = (
        await Promise.all(
          job.selfieStorageIds.map((storageId) => ctx.storage.getUrl(storageId)),
        )
      ).filter((url): url is string => url !== null);

      if (selfieUrls.length === 0) {
        await ctx.runMutation(internal.photoSearch.markError, {
          jobId,
          error: "No se pudieron generar las URLs de las selfies",
        });
        return;
      }

      const response = await fetch(`${apiUrl}/api/find_photos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiSecret}`,
        },
        body: JSON.stringify({
          jobId,
          selfieUrls,
          albumUrl: job.albumUrl,
          dorsal: job.dorsal,
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        await ctx.runMutation(internal.photoSearch.markError, {
          jobId,
          error: `Servicio de búsqueda respondió ${response.status}: ${text.slice(0, 300)}`,
        });
        return;
      }

      const result = (await response.json()) as FindPhotosResponse;

      if (result.status === "error") {
        await ctx.runMutation(internal.photoSearch.markError, {
          jobId,
          error: result.error ?? "Error desconocido del servicio de búsqueda",
          rejectedSelfies: result.rejectedSelfies,
        });
        return;
      }

      await ctx.runMutation(internal.photoSearch.markDone, {
        jobId,
        results: (result.results ?? []).map((r) => ({
          photoUrl: r.photoUrl,
          score: r.score,
          identityConfirmed: r.identityConfirmed,
          faceScore: r.faceScore ?? undefined,
          dorsalMatch: r.dorsalMatch ?? undefined,
          bbox: r.bbox ?? undefined,
        })),
        rejectedSelfies: result.rejectedSelfies,
        stats: result.stats,
      });
    } catch (err) {
      await ctx.runMutation(internal.photoSearch.markError, {
        jobId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
});

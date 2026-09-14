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

import { internalAction, ActionCtx } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { photosFoundEmail } from "./emails/templates/photosFound";

const RESULT_PREVIEW_COUNT = 6;

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

      const results = (result.results ?? []).map((r) => ({
        photoUrl: r.photoUrl,
        score: r.score,
        identityConfirmed: r.identityConfirmed,
        faceScore: r.faceScore ?? undefined,
        dorsalMatch: r.dorsalMatch ?? undefined,
        bbox: r.bbox ?? undefined,
      }));

      await ctx.runMutation(internal.photoSearch.markDone, {
        jobId,
        results,
        rejectedSelfies: result.rejectedSelfies,
        stats: result.stats,
      });

      if (results.length > 0) {
        await sendPhotosFoundEmail(ctx, job, results);
      }
    } catch (err) {
      await ctx.runMutation(internal.photoSearch.markError, {
        jobId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
});

/** Envía el email de "te encontramos" — no bloqueante: si falla, se
 *  loggea pero no marca el job como error (ya se guardó el resultado,
 *  el usuario puede verlo en /perfil/fotos aunque el email no llegue).
 *  Idempotente vía notificationLog (type "photos_found"), igual que el
 *  resto de emails de carrera. */
async function sendPhotosFoundEmail(
  ctx: ActionCtx,
  job: { userId: Id<"profiles">; raceId: Id<"races"> },
  results: { photoUrl: string }[],
): Promise<void> {
  try {
    const [profile, race, myRaceId] = await Promise.all([
      ctx.runQuery(internal.emailDispatch.getProfile, { userId: job.userId }),
      ctx.runQuery(api.races.get, { id: job.raceId }),
      ctx.runQuery(internal.photoSearch.getMyRaceIdForNotification, {
        userId: job.userId,
        raceId: job.raceId,
      }),
    ]);

    if (!profile?.email || !race) return;

    const alreadySent = await ctx.runQuery(internal.emailDispatch.hasLog, {
      userId: job.userId,
      myRaceId: myRaceId ?? undefined,
      raceId: myRaceId ? undefined : job.raceId,
      type: "photos_found",
    });
    if (alreadySent) return;

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.mi-dorsal.com").replace(
      /\/$/,
      "",
    );

    const { subject, html, text } = photosFoundEmail({
      userName: profile.displayName ?? "corredor",
      raceName: race.name,
      photoUrls: results.slice(0, RESULT_PREVIEW_COUNT).map((r) => r.photoUrl),
      totalCount: results.length,
      resultsUrl: `${appUrl}/perfil/fotos/${job.raceId}`,
      appUrl,
    });

    await ctx.runAction(internal.emailDispatch.dispatchAndLog, {
      to: profile.email,
      subject,
      html,
      text,
      userId: job.userId,
      myRaceId: myRaceId ?? undefined,
      raceId: myRaceId ? undefined : job.raceId,
      type: "photos_found",
    });
  } catch (err) {
    console.error("[photos-found] error enviando email:", err);
  }
}

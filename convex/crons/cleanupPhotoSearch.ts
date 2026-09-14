// =============================================================================
// mi-dorsal — Cron: cleanup-photo-search
// =============================================================================
// Borra los jobs de "Encuentra tus fotos" cuyo expiresAt ya pasó (24h desde
// su creación). Las selfies ya se borran de Storage en cuanto el job termina
// (ver photoSearch.ts::markDone/markError/cancel) — esto solo limpia el
// documento en sí, para no acumular histórico indefinido de búsquedas.
// =============================================================================

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

export const cleanupPhotoSearch = internalAction({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.runQuery(internal.photoSearch.getExpiredJobsInternal, {});
    for (const job of expired) {
      await ctx.runMutation(internal.photoSearch.deleteJobInternal, { jobId: job._id });
    }
    if (expired.length > 0) {
      console.log(`[cleanup-photo-search] borrados ${expired.length} jobs expirados`);
    }
  },
});

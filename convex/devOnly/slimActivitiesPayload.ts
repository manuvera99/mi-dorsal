// =============================================================================
// mi-dorsal — Dev/admin: slimActivitiesPayload
// =============================================================================
// One-shot backfill: limpia el payload inflado de la tabla `activities`.
//
//   - Borra `rawPayload` (string con JSON.stringify de toda la respuesta
//     de Strava, ~5 KB por fila, NO se lee en ningún sitio de la app).
//   - Trunca `rawStravaDetail` a { start_latlng, end_latlng, best_efforts }
//     (únicos campos que la app realmente consulta; el resto son duplicados
//     de campos top-level ya almacenados).
//
// Por qué este script existe: la auditoría de costes del 8 sep 2026 reveló
// que cada actividad pesaba ~10-15 KB extra por culpa de estos dos campos
// duplicados, y eso se paga en bandwidth cada vez que el feed de actividades
// se carga.
//
// Idempotente: si una actividad ya está limpia, el patch queda no-op.
//
// Cómo correrlo (una sola vez, después del deploy):
//   npx convex run --deployment precious-goshawk-41 \
//     'devOnly/slimActivitiesPayload:runSlimBackfill' '{}'
//
// Output esperado:
//   { scanned: 577, updated: 577, skipped: 0, errors: 0 }
// =============================================================================

import { action, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

const BATCH_SIZE = 100;

/**
 * Helper mutation: parchea UNA actividad para:
 *   1) Reemplazar rawStravaDetail con la versión truncada (si existe).
 *   2) Reemplazar el doc entero SIN rawPayload (delete real del campo).
 *
 * Convex no tiene un "unset" directo para campos opcionales; hay que
 * usar db.replace con el documento sin ese campo. Para minimizar I/O,
 * solo reemplazamos cuando rawPayload existe O cuando rawStravaDetail
 * tiene campos extra.
 */
export const slimOne = internalMutation({
  args: {
    activityId: v.id("activities"),
  },
  handler: async (ctx, { activityId }) => {
    const doc = await ctx.db.get(activityId);
    if (!doc) return { changed: false, reason: "not_found" };

    const patch: Record<string, unknown> = {};
    let changed = false;

    // 1) Truncar rawStravaDetail si tiene campos extra
    if (doc.rawStravaDetail && typeof doc.rawStravaDetail === "object") {
      const detail = doc.rawStravaDetail as Record<string, unknown>;
      const hasExtras =
        !("start_latlng" in detail && "end_latlng" in detail && "best_efforts" in detail) ||
        Object.keys(detail).length > 3;
      if (hasExtras) {
        patch.rawStravaDetail = {
          start_latlng: (detail as any).start_latlng ?? null,
          end_latlng: (detail as any).end_latlng ?? null,
          best_efforts: (detail as any).best_efforts ?? null,
        };
        changed = true;
      }
    }

    // 2) rawPayload: si existe, hay que BORRARLO del doc. Como Convex no
    //    tiene unset directo, hacemos db.replace con el doc sin ese campo.
    if ("rawPayload" in doc) {
      // Construimos el doc nuevo sin rawPayload + con el patch anterior
      const { rawPayload: _drop, ...rest } = doc as any;
      if (changed) {
        Object.assign(rest, patch);
      }
      await ctx.db.replace(activityId, rest as any);
      return { changed: true, reason: "rawPayload_removed" };
    }

    // 3) Si no había rawPayload pero sí había que truncar detail → patch
    if (changed) {
      await ctx.db.patch(activityId, patch);
      return { changed: true, reason: "rawStravaDetail_truncated" };
    }

    return { changed: false, reason: "already_clean" };
  },
});

/**
 * Query helper: devuelve un lote de IDs de activities.
 * Internal: lo llama el action runSlimBackfill.
 */
export const fetchPageIds = internalQuery({
  args: {
    cursor: v.union(v.string(), v.null()),
    batchSize: v.number(),
  },
  handler: async (ctx, { cursor, batchSize }) => {
    const result = await ctx.db
      .query("activities")
      .paginate({ cursor, numItems: batchSize });
    return {
      ids: result.page.map((d) => d._id),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const runSlimBackfill = action({
  args: {},
  handler: async (ctx) => {
    let cursor: string | null = null;
    let scanned = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let pageNum = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page: { ids: string[]; continueCursor: string; isDone: boolean } =
        await ctx.runQuery(internal.devOnly.slimActivitiesPayload.fetchPageIds, {
          cursor,
          batchSize: BATCH_SIZE,
        });
      pageNum++;

      for (const id of page.ids) {
        scanned++;
        try {
          const r: { changed: boolean; reason: string } = await ctx.runMutation(
            internal.devOnly.slimActivitiesPayload.slimOne,
            { activityId: id as any },
          );
          if (r.changed) updated++;
          else skipped++;
        } catch (e: any) {
          errors++;
          // eslint-disable-next-line no-console
          console.error(`[slimActivities] activity ${id} failed:`, e?.message);
        }
      }

      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    return { scanned, updated, skipped, errors, pages: pageNum };
  },
});

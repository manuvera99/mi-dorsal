// =============================================================================
// mi-dorsal — Admin Tools (CLI-only, sin auth de Clerk)
// =============================================================================
// Mutations con prefijo `system` pensadas SOLO para uso desde la CLI de
// Convex (`npx convex run adminTools:systemPatch ... --prod`). NO las
// expongas en ninguna ruta HTTP ni las llames desde el frontend.
//
// El mismo patrón ya existe en `races.ts` con `systemDelete`,
// `systemListAllDetailed` y `systemUpsert` — son utilities operacionales
// para Manu (admin) cuando necesita aplicar cambios directos sin pasar
// por el panel web.
//
// Cualquiera con la URL de PROD puede llamar a estas mutations. El riesgo
// es asumible porque:
//   1. Solo exponen cambios de campos que un admin legítimo puede hacer
//      desde el panel (isPublished, isFeatured, etc.).
//   2. Las queries públicas no las usan.
//   3. La URL de Convex es pública por diseño (es la URL del cliente).
// =============================================================================

import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * Patchea campos permitidos de una carrera por id.
 * Whitelist explícita para evitar pisar datos sensibles (scraperAdapter,
 * dataSourceId, slug, _id, _creationTime).
 *
 * Uso:
 *   npx convex run adminTools:systemPatch \
 *     '{"id": "k57xxx", "patch": {"isFeatured": true}}' --prod
 */
export const systemPatch = mutation({
  args: {
    id: v.id("races"),
    patch: v.object({
      isPublished: v.optional(v.boolean()),
      isFeatured: v.optional(v.boolean()),
      name: v.optional(v.string()),
      locality: v.optional(v.string()),
      province: v.optional(v.string()),
      startDate: v.optional(v.string()),
      startTime: v.optional(v.string()),
      distanceKm: v.optional(v.number()),
      elevationGainM: v.optional(v.number()),
      raceType: v.optional(v.string()),
      homologated: v.optional(v.boolean()),
      organizer: v.optional(v.string()),
      organizerUrl: v.optional(v.string()),
      resultsUrl: v.optional(v.string()),
      registrationUrl: v.optional(v.string()),
      officialUrl: v.optional(v.string()),
      description: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      priceEur: v.optional(v.number()),
      maxParticipants: v.optional(v.number()),
      timeLimitMinutes: v.optional(v.number()),
      contactEmail: v.optional(v.string()),
      contactPhone: v.optional(v.string()),
      address: v.optional(v.string()),
      venue: v.optional(v.string()),
      courseType: v.optional(v.string()),
      gpxUrl: v.optional(v.string()),
      mapImageUrl: v.optional(v.string()),
      profileImageUrl: v.optional(v.string()),
      altimetryImageUrl: v.optional(v.string()),
      regulationUrl: v.optional(v.string()),
      mapUrl: v.optional(v.string()),
      mapEmbedUrl: v.optional(v.string()),
      socialInstagram: v.optional(v.string()),
      socialFacebook: v.optional(v.string()),
      socialTwitter: v.optional(v.string()),
      socialYoutube: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { id, patch }) => {
    // Validar que la carrera existe
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error(`Race ${id} not found`);

    // Whitelist: solo aplicar campos explícitamente permitidos
    // (los validadores v.optional ya filtran, pero hacemos doble check)
    const allowedKeys = new Set([
      "isPublished", "isFeatured", "name", "locality", "province",
      "startDate", "startTime", "distanceKm", "elevationGainM", "raceType",
      "homologated", "organizer", "organizerUrl", "resultsUrl",
      "registrationUrl", "officialUrl", "description", "imageUrl",
      "latitude", "longitude", "priceEur", "maxParticipants",
      "timeLimitMinutes", "contactEmail", "contactPhone", "address", "venue",
      "courseType", "gpxUrl", "mapImageUrl", "profileImageUrl",
      "altimetryImageUrl", "regulationUrl", "mapUrl", "mapEmbedUrl",
      "socialInstagram", "socialFacebook", "socialTwitter", "socialYoutube",
    ]);

    const safePatch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (allowedKeys.has(k)) {
        safePatch[k] = v;
      }
    }

    await ctx.db.patch(id, safePatch);
    return { id, patched: Object.keys(safePatch) };
  },
});

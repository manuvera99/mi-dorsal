// =============================================================================
// mi-dorsal — Races queries y mutations
// =============================================================================

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { provinceValidator, raceTypeValidator, slugify, requireAdmin } from "./_helpers";

/**
 * Lista carreras con filtros opcionales. Lectura pública.
 */
export const list = query({
  args: {
    province: v.optional(provinceValidator),
    raceType: v.optional(raceTypeValidator),
    month: v.optional(v.number()), // 1-12
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("races").withIndex("by_published_date");

    // Filtrar por isPublished (mostrar solo publicadas)
    q = q.filter((qq) => qq.eq(qq.field("isPublished"), true));

    const all = await q.collect();

    // Filtros adicionales en memoria (suficiente para ~100s de carreras)
    let filtered = all;
    if (args.province) {
      filtered = filtered.filter((r) => r.province === args.province);
    }
    if (args.raceType) {
      filtered = filtered.filter((r) => r.raceType === args.raceType);
    }
    if (args.month) {
      filtered = filtered.filter((r) => {
        if (!r.startDate) return false;
        const m = new Date(r.startDate).getMonth() + 1;
        return m === args.month;
      });
    }
    if (args.search) {
      const s = args.search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.locality?.toLowerCase().includes(s),
      );
    }

    // Ordenar por fecha
    filtered.sort((a, b) => {
      const da = a.startDate ?? "9999-12-31";
      const db = b.startDate ?? "9999-12-31";
      return da.localeCompare(db);
    });

    return args.limit ? filtered.slice(0, args.limit) : filtered;
  },
});

/**
 * Carrera por slug. Lectura pública.
 */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("races")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
  },
});

/**
 * Carrera por id (uso interno).
 */
export const get = query({
  args: { id: v.id("races") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

/**
 * Carreras destacadas (home).
 */
export const getFeatured = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("races")
      .withIndex("by_published_date")
      .filter((q) =>
        q.and(
          q.eq(q.field("isPublished"), true),
          q.eq(q.field("isFeatured"), true),
        ),
      )
      .take(limit ?? 6);
  },
});

/**
 * Crea una carrera. Solo admin (en producción, con role check).
 */
export const create = mutation({
  args: {
    name: v.string(),
    locality: v.optional(v.string()),
    province: provinceValidator,
    distanceKm: v.number(),
    elevationGainM: v.optional(v.number()),
    raceType: raceTypeValidator,
    homologated: v.optional(v.boolean()),
    organizer: v.optional(v.string()),
    organizerUrl: v.optional(v.string()),
    resultsUrl: v.optional(v.string()),
    registrationUrl: v.optional(v.string()),
    officialUrl: v.optional(v.string()),
    startDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    isPublished: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
    scraperAdapter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const slug = slugify(args.name);
    return await ctx.db.insert("races", {
      ...args,
      slug,
    });
  },
});

/**
 * Crea una carrera desde el script de ingest (sin auth requerida).
 * Solo lo usa `scripts/ingest-to-convex.ts`. NO usar desde la app.
 */
export const systemCreate = mutation({
  args: {
    name: v.string(),
    locality: v.optional(v.string()),
    province: provinceValidator,
    distanceKm: v.number(),
    elevationGainM: v.optional(v.number()),
    raceType: raceTypeValidator,
    homologated: v.optional(v.boolean()),
    organizer: v.optional(v.string()),
    organizerUrl: v.optional(v.string()),
    resultsUrl: v.optional(v.string()),
    registrationUrl: v.optional(v.string()),
    officialUrl: v.optional(v.string()),
    startDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    isPublished: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
    scraperAdapter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const slug = slugify(args.name);
    return await ctx.db.insert("races", {
      ...args,
      slug,
    });
  },
});

/**
 * Admin: lista TODAS las carreras (publicadas o no).
 */
export const adminList = query({
  args: {
    search: v.optional(v.string()),
    province: v.optional(provinceValidator),
    raceType: v.optional(raceTypeValidator),
    isPublished: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("races").collect();
    let filtered = all;
    if (args.province) filtered = filtered.filter((r) => r.province === args.province);
    if (args.raceType) filtered = filtered.filter((r) => r.raceType === args.raceType);
    if (args.isPublished !== undefined) filtered = filtered.filter((r) => r.isPublished === args.isPublished);
    if (args.isFeatured !== undefined) filtered = filtered.filter((r) => r.isFeatured === args.isFeatured);
    if (args.search) {
      const s = args.search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.locality?.toLowerCase().includes(s) ||
          r.slug.toLowerCase().includes(s),
      );
    }
    return filtered.sort((a, b) => (a.startDate ?? "9999").localeCompare(b.startDate ?? "9999"));
  },
});

/**
 * Admin: actualiza una carrera.
 */
export const adminUpdate = mutation({
  args: {
    id: v.id("races"),
    patch: v.object({
      // Básicos
      name: v.optional(v.string()),
      locality: v.optional(v.string()),
      province: v.optional(provinceValidator),
      distanceKm: v.optional(v.number()),
      elevationGainM: v.optional(v.number()),
      raceType: v.optional(raceTypeValidator),
      homologated: v.optional(v.boolean()),
      // Fechas y lugar
      startDate: v.optional(v.string()),
      startTime: v.optional(v.string()),
      address: v.optional(v.string()),
      venue: v.optional(v.string()),
      // URLs
      organizer: v.optional(v.string()),
      organizerUrl: v.optional(v.string()),
      resultsUrl: v.optional(v.string()),
      rulesUrl: v.optional(v.string()),
      registrationUrl: v.optional(v.string()),
      officialUrl: v.optional(v.string()),
      // Contacto
      contactEmail: v.optional(v.string()),
      contactPhone: v.optional(v.string()),
      // Redes
      socialInstagram: v.optional(v.string()),
      socialFacebook: v.optional(v.string()),
      socialTwitter: v.optional(v.string()),
      socialYoutube: v.optional(v.string()),
      // Precio / inscripción
      priceEur: v.optional(v.number()),
      priceIncludes: v.optional(v.string()),
      registrationOpenDate: v.optional(v.string()),
      registrationCloseDate: v.optional(v.string()),
      maxParticipants: v.optional(v.number()),
      soldOut: v.optional(v.boolean()),
      chipType: v.optional(v.union(v.literal("manual"), v.literal("chip"), v.literal("disposable_chip"))),
      // Categorías
      categories: v.optional(v.array(v.object({
        name: v.string(),
        gender: v.optional(v.union(v.literal("M"), v.literal("F"), v.literal("mixto"))),
        ageMin: v.optional(v.number()),
        ageMax: v.optional(v.number()),
      }))),
      // Servicios
      services: v.optional(v.object({
        aidStations: v.optional(v.number()),
        showers: v.optional(v.boolean()),
        changingRooms: v.optional(v.boolean()),
        bagDrop: v.optional(v.boolean()),
        parking: v.optional(v.boolean()),
        medical: v.optional(v.boolean()),
        physiotherapy: v.optional(v.boolean()),
        timingChip: v.optional(v.boolean()),
        photoService: v.optional(v.boolean()),
        videoService: v.optional(v.boolean()),
        swagBag: v.optional(v.boolean()),
        tShirt: v.optional(v.boolean()),
        medal: v.optional(v.boolean()),
        refreshments: v.optional(v.boolean()),
      })),
      // Recorrido
      courseType: v.optional(v.union(v.literal("loop"), v.literal("point_to_point"), v.literal("out_and_back"))),
      gpxUrl: v.optional(v.string()),
      mapImageUrl: v.optional(v.string()),
      profileImageUrl: v.optional(v.string()),
      timeLimitMinutes: v.optional(v.number()),
      cutoffs: v.optional(v.array(v.object({ km: v.number(), timeLimit: v.string() }))),
      // Premios
      prizes: v.optional(v.string()),
      trophies: v.optional(v.boolean()),
      // Meta
      description: v.optional(v.string()),
      longDescription: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      isPublished: v.optional(v.boolean()),
      isFeatured: v.optional(v.boolean()),
      scraperAdapter: v.optional(v.string()),
      // -------- DEEP EXTRACTION (Fase 1) --------
      raceFormats: v.optional(v.array(v.object({
        name: v.string(),
        distanceKm: v.number(),
        elevationGainM: v.optional(v.number()),
        startTime: v.optional(v.string()),
        priceEur: v.optional(v.number()),
        maxParticipants: v.optional(v.number()),
      }))),
      aidStations: v.optional(v.array(v.object({
        km: v.number(),
        name: v.optional(v.string()),
        hasWater: v.optional(v.boolean()),
        hasIsotonic: v.optional(v.boolean()),
        hasFood: v.optional(v.boolean()),
        hasMedical: v.optional(v.boolean()),
      }))),
      priceTiers: v.optional(v.array(v.object({
        fromDate: v.string(),
        toDate: v.optional(v.string()),
        priceEur: v.number(),
        label: v.optional(v.string()),
      }))),
      dorsalPickupLocation: v.optional(v.string()),
      dorsalPickupHours: v.optional(v.string()),
      altimetryData: v.optional(v.array(v.object({
        km: v.number(),
        altitudeM: v.number(),
      }))),
      galleryUrls: v.optional(v.array(v.string())),
      mapUrl: v.optional(v.string()),
      mapEmbedUrl: v.optional(v.string()),
      altimetryImageUrl: v.optional(v.string()),
      regulationUrl: v.optional(v.string()),
      extractedFromUrl: v.optional(v.string()),
      extractedAt: v.optional(v.number()),
      extractionConfidence: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),
    }),
  },
  handler: async (ctx, { id, patch }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Race not found");
    // Si cambia el nombre, regeneramos el slug
    const update: any = { ...patch };
    if (patch.name && patch.name !== existing.name) {
      update.slug = slugify(patch.name);
    }
    await ctx.db.patch(id, update);
    return id;
  },
});

/**
 * systemUpdate: igual que adminUpdate pero sin requireAdmin.
 * Usado por scripts CLI (deep-extract-all) y API routes.
 * No regenera slug (es bulk, no queremos sorpresas).
 */
export const systemUpdate = mutation({
  args: {
    id: v.id("races"),
    patch: v.any(), // cualquier subset del schema
  },
  handler: async (ctx, { id, patch }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Race not found");
    await ctx.db.patch(id, patch);
    return id;
  },
});

/**
 * systemListAll: lista TODAS las carreras con sus campos básicos.
 * Usado por scripts CLI (deep-extract-all). No devuelve datos sensibles.
 */
export const systemListAll = query({
  args: {
    onlyWithOfficialUrl: v.optional(v.boolean()),
  },
  handler: async (ctx, { onlyWithOfficialUrl }) => {
    const all = await ctx.db.query("races").collect();
    return all
      .filter((r) => !onlyWithOfficialUrl || r.officialUrl)
      .map((r) => ({
        _id: r._id,
        name: r.name,
        slug: r.slug,
        officialUrl: r.officialUrl,
        extractedAt: r.extractedAt,
        extractionConfidence: r.extractionConfidence,
      }));
  },
});

/**
 * Admin: elimina una carrera.
 */
export const adminDelete = mutation({
  args: { id: v.id("races") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(id);
    return id;
  },
});

/**
 * Admin: toggle published/featured.
 */
export const adminToggle = mutation({
  args: {
    id: v.id("races"),
    field: v.union(v.literal("isPublished"), v.literal("isFeatured")),
    value: v.boolean(),
  },
  handler: async (ctx, { id, field, value }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(id, { [field]: value });
    return id;
  },
});

/**
 * Carrera actual: getBySlug pero con datos del dorsal del usuario.
 */
export const getBySlugForUser = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const identity = await ctx.auth.getUserIdentity();
    const race = await ctx.db
      .query("races")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!race) return null;

    let myRace: Doc<"myRaces"> | null = null;
    if (identity) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_clerk_user_id", (q) =>
          q.eq("clerkUserId", identity.subject),
        )
        .unique();
      if (profile) {
        myRace = await ctx.db
          .query("myRaces")
          .withIndex("by_user_race", (q) =>
            q.eq("userId", profile._id).eq("raceId", race._id),
          )
          .unique();
      }
    }
    return { race, myRace };
  },
});

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
      name: v.optional(v.string()),
      locality: v.optional(v.string()),
      province: v.optional(provinceValidator),
      distanceKm: v.optional(v.number()),
      elevationGainM: v.optional(v.number()),
      raceType: v.optional(raceTypeValidator),
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

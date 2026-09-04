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
    const matches = await ctx.db
      .query("races")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .collect();
    if (matches.length === 0) return null;
    // Si hay duplicados (debería estar limpio tras la migración), coge el más reciente
    if (matches.length > 1) {
      return matches.sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0))[0];
    }
    return matches[0];
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
    // Anti-duplicado cross-source: si ya existe una carrera con el mismo
    // nombre + fecha (de cualquier fuente), actualizamos la existente en
    // lugar de crear una nueva. Esto evita que un re-ingest cree duplicados.
    if (args.startDate) {
      const norm = (s: string) =>
        s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
      const nameKey = norm(args.name);
      const candidates = await ctx.db
        .query("races")
        .withIndex("by_date", (q) => q.eq("startDate", args.startDate!))
        .collect();
      const match = candidates.find((c) => norm(c.name) === nameKey);
      if (match) {
        // Encontrado: actualizar la existente con los nuevos datos
        // (los campos no nulos sobrescriben los actuales)
        const patch: any = {};
        for (const [k, v] of Object.entries(args)) {
          if (k === "name") continue; // no cambiamos el nombre (mantenemos el original)
          if (v === null || v === undefined || v === "") continue;
          if (Array.isArray(v) && v.length === 0) continue;
          patch[k] = v;
        }
        await ctx.db.patch(match._id, patch);
        return match._id;
      }
    }

    // No existe: crear nueva
    const baseSlug = slugify(args.name);
    let finalSlug = baseSlug;
    let suffix = 2;
    while (true) {
      const conflict = await ctx.db
        .query("races")
        .withIndex("by_slug", (q) => q.eq("slug", finalSlug))
        .first();
      if (!conflict) break;
      finalSlug = `${baseSlug}-${suffix}`;
      suffix++;
      if (suffix > 100) throw new Error(`Demasiadas colisiones para slug "${baseSlug}"`);
    }
    return await ctx.db.insert("races", {
      ...args,
      slug: finalSlug,
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
      // Cross-source merge
      mergedFromIds: v.optional(v.array(v.string())),
      mergedAt: v.optional(v.number()),
      additionalDataSourceIds: v.optional(v.array(v.id("dataSources"))),
    }),
  },
  handler: async (ctx, { id, patch }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Race not found");
    // Si cambia el nombre, regeneramos el slug evitando colisiones
    const update: any = { ...patch };
    if (patch.name && patch.name !== existing.name) {
      const baseSlug = slugify(patch.name);
      let finalSlug = baseSlug;
      let suffix = 2;
      // Comprobar colisión: si ya hay otra carrera con ese slug, añadir sufijo
      while (true) {
        const conflict = await ctx.db
          .query("races")
          .withIndex("by_slug", (q) => q.eq("slug", finalSlug))
          .first();
        if (!conflict || conflict._id === id) break;
        finalSlug = `${baseSlug}-${suffix}`;
        suffix++;
        if (suffix > 100) throw new Error(`Demasiadas colisiones para slug "${baseSlug}"`);
      }
      update.slug = finalSlug;
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
        locality: r.locality,
        province: r.province,
        startDate: r.startDate,
        officialUrl: r.officialUrl,
        extractedAt: r.extractedAt,
        extractedFromUrl: r.extractedFromUrl,
        extractionConfidence: r.extractionConfidence,
        latitude: r.latitude,
        longitude: r.longitude,
        // Campos deep-extracted (para check-bulk-status y debugging)
        longDescription: r.longDescription,
        altimetryData: r.altimetryData,
        raceFormats: r.raceFormats,
        aidStations: r.aidStations,
        priceTiers: r.priceTiers,
        categories: r.categories,
        galleryUrls: r.galleryUrls,
        services: r.services,
        organizer: r.organizer,
        contactEmail: r.contactEmail,
      }));
  },
});

/**
 * systemUpsert: find-or-create idempotente.
 *
 * Busca una carrera existente por (en orden de prioridad):
 *   1. officialUrl (si es específico, no homepage)
 *   2. nombre normalizado + startDate + locality
 *   3. nombre normalizado + startDate
 *
 * Si la encuentra, actualiza los campos vacíos con los nuevos, y registra
 * la fuente en additionalDataSourceIds (sin pisar dataSourceId actual).
 *
 * Si no la encuentra, crea una nueva con slug auto-generado (sufijo -2 si choca).
 *
 * Devuelve { id, action: "created" | "updated" } para que el caller sepa qué pasó.
 *
 * Usado por scripts de ingest para garantizar idempotencia.
 */
export const systemUpsert = mutation({
  args: {
    // Identidad
    name: v.string(),
    startDate: v.optional(v.string()),
    locality: v.optional(v.string()),
    officialUrl: v.optional(v.string()),
    // Datos básicos
    province: v.optional(provinceValidator),
    distanceKm: v.optional(v.number()),
    elevationGainM: v.optional(v.number()),
    raceType: v.optional(raceTypeValidator),
    homologated: v.optional(v.boolean()),
    organizer: v.optional(v.string()),
    organizerUrl: v.optional(v.string()),
    resultsUrl: v.optional(v.string()),
    registrationUrl: v.optional(v.string()),
    startTime: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    isPublished: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
    courseType: v.optional(v.union(v.literal("loop"), v.literal("point_to_point"), v.literal("out_and_back"))),
    gpxUrl: v.optional(v.string()),
    mapImageUrl: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),
    mapUrl: v.optional(v.string()),
    mapEmbedUrl: v.optional(v.string()),
    altimetryImageUrl: v.optional(v.string()),
    regulationUrl: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    timeLimitMinutes: v.optional(v.number()),
    maxParticipants: v.optional(v.number()),
    priceEur: v.optional(v.number()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    // Atribución
    scraperAdapter: v.optional(v.string()),
    dataSourceId: v.optional(v.id("dataSources")),
  },
  handler: async (ctx, args) => {
    const norm = (s: string | undefined) =>
      (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    const isHomepageUrl = (url: string | undefined) => {
      if (!url) return true;
      try {
        const u = new URL(url);
        if (u.pathname === "" || u.pathname === "/") return true;
        return /^https?:\/\/(www\.)?(fedme|rfea|sportmaniacs|runedia)\.es\/?$/i.test(url) ||
               /^https?:\/\/itra\.run\/?$/i.test(url);
      } catch {
        return true;
      }
    };

    // 1. Buscar por officialUrl específico
    let existing: Doc<"races"> | null = null;
    if (args.officialUrl && !isHomepageUrl(args.officialUrl)) {
      const matches = await ctx.db
        .query("races")
        .withIndex("by_data_source" as any) // índice genérico, filtro manual
        .collect();
      const filtered = matches.filter((r) => r.officialUrl === args.officialUrl);
      if (filtered.length === 1) existing = filtered[0];
      else if (filtered.length > 1) {
        // Hay varias con el mismo URL (no debería pasar, pero por si acaso): coge la más antigua
        existing = filtered.sort((a, b) => (a._creationTime ?? 0) - (b._creationTime ?? 0))[0];
      }
    }

    // 2. Buscar por nombre + fecha + localidad
    if (!existing && args.startDate) {
      const nameKey = norm(args.name);
      const dateMatches = await ctx.db
        .query("races")
        .withIndex("by_date", (q) => q.eq("startDate", args.startDate!))
        .collect();
      const locKey = norm(args.locality);
      if (locKey) {
        existing = dateMatches.find((c) => norm(c.name) === nameKey && norm(c.locality) === locKey) ?? null;
      }
      // 3. Buscar por nombre + fecha (sin localidad)
      if (!existing) {
        existing = dateMatches.find((c) => norm(c.name) === nameKey) ?? null;
      }
    }

    if (existing) {
      // UPDATE: rellenar campos vacíos, añadir dataSourceId a additional
      const patch: Record<string, unknown> = {};
      const skipFields = new Set([
        "name", // nunca pisar el nombre original
        "slug", // nunca pisar el slug
        "scraperAdapter", // no pisar (mantenemos el primero)
        "dataSourceId", // manejado aparte (priority)
      ]);
      for (const [k, v] of Object.entries(args)) {
        if (skipFields.has(k)) continue;
        if (v === null || v === undefined || v === "") continue;
        if (Array.isArray(v) && v.length === 0) continue;
        // Solo rellenar si está vacío en el existente
        const current = (existing as any)[k];
        if (current === null || current === undefined || current === "") {
          patch[k] = v;
        }
      }
      // dataSourceId: si la nueva fuente es más prioritaria, sobrescribir
      if (args.dataSourceId && args.dataSourceId !== existing.dataSourceId) {
        const priority = ["RFEA", "FEDME", "ITRA", "Sportmaniacs", "Runedia", "Manual"];
        const existingSrc = await ctx.db.get(existing.dataSourceId as any);
        const newSrc = await ctx.db.get(args.dataSourceId);
        const existingIdx = priority.indexOf((existingSrc as any)?.name ?? "");
        const newIdx = priority.indexOf((newSrc as any)?.name ?? "");
        if (newIdx !== -1 && (existingIdx === -1 || newIdx < existingIdx)) {
          // La nueva es más prioritaria → guardar la vieja en additional
          const additional: string[] = (existing as any).additionalDataSourceIds ?? [];
          if (existing.dataSourceId && !additional.includes(existing.dataSourceId)) {
            additional.push(existing.dataSourceId);
          }
          patch.dataSourceId = args.dataSourceId;
          patch.additionalDataSourceIds = additional;
        } else {
          // La existente es más prioritaria → solo añadir la nueva a additional
          const additional: string[] = (existing as any).additionalDataSourceIds ?? [];
          if (!additional.includes(args.dataSourceId)) {
            additional.push(args.dataSourceId);
            patch.additionalDataSourceIds = additional;
          }
        }
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id, patch);
      }
      return { id: existing._id, action: "updated" as const };
    }

    // CREATE: slug auto-generado sin colisión
    const baseSlug = slugify(args.name);
    let finalSlug = baseSlug;
    let suffix = 2;
    while (true) {
      const conflict = await ctx.db
        .query("races")
        .withIndex("by_slug", (q) => q.eq("slug", finalSlug))
        .first();
      if (!conflict) break;
      finalSlug = `${baseSlug}-${suffix}`;
      suffix++;
      if (suffix > 100) throw new Error(`Demasiadas colisiones para slug "${baseSlug}"`);
    }
    const id = await ctx.db.insert("races", {
      // Campos requeridos por el schema (con fallbacks seguros)
      name: args.name,
      province: args.province ?? ("valencia" as any),
      distanceKm: args.distanceKm ?? 10,
      raceType: args.raceType ?? ("road" as const),
      slug: finalSlug,
      // Resto de campos opcionales tal cual vienen
      locality: args.locality,
      startDate: args.startDate,
      startTime: args.startTime,
      officialUrl: args.officialUrl,
      registrationUrl: args.registrationUrl,
      resultsUrl: args.resultsUrl,
      organizer: args.organizer,
      organizerUrl: args.organizerUrl,
      contactEmail: args.contactEmail,
      contactPhone: args.contactPhone,
      elevationGainM: args.elevationGainM,
      homologated: args.homologated,
      description: args.description,
      imageUrl: args.imageUrl,
      courseType: args.courseType,
      gpxUrl: args.gpxUrl,
      mapImageUrl: args.mapImageUrl,
      profileImageUrl: args.profileImageUrl,
      timeLimitMinutes: args.timeLimitMinutes,
      maxParticipants: args.maxParticipants,
      priceEur: args.priceEur,
      isPublished: args.isPublished ?? true,
      isFeatured: args.isFeatured ?? false,
      scraperAdapter: args.scraperAdapter,
      dataSourceId: args.dataSourceId,
    });
    return { id, action: "created" as const };
  },
});

/**
 * systemListAllDetailed: lista TODAS las carreras con TODOS sus campos.
 * Usado por scripts de merge/dedupe. No usar desde la app.
 */
export const systemListAllDetailed = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("races").collect();
  },
});

/**
 * systemDelete: borra una carrera (auth-free). Solo para scripts.
 */
export const systemDelete = mutation({
  args: { id: v.id("races") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return id;
  },
});

/**
 * findDuplicateSlugs: agrupa por slug y devuelve los que tienen >1 carrera.
 * Usado por scripts de migración.
 */
export const findDuplicateSlugs = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("races").collect();
    const bySlug = new Map<string, Array<{ _id: string; name: string; createdAt: number }>>();
    for (const r of all) {
      const list = bySlug.get(r.slug) ?? [];
      list.push({
        _id: r._id,
        name: r.name,
        createdAt: r._creationTime ?? 0,
      });
      bySlug.set(r.slug, list);
    }
    const dupes: Array<{ slug: string; races: Array<{ _id: string; name: string; createdAt: number }> }> = [];
    for (const [slug, list] of bySlug.entries()) {
      if (list.length > 1) {
        dupes.push({ slug, races: list.sort((a, b) => b.createdAt - a.createdAt) });
      }
    }
    return dupes.sort((a, b) => b.races.length - a.races.length);
  },
});

/**
 * findSameSourceDuplicates: agrupa por (fuente + nombre normalizado + fecha)
 * y devuelve los que tienen >1 carrera. Usado para detectar duplicados
 * de re-ingest dentro de la misma fuente.
 */
export const findSameSourceDuplicates = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("races").collect();
    const byKey = new Map<string, Array<{ _id: string; name: string; source: string; createdAt: number; fieldsCount: number }>>();

    const norm = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

    for (const r of all) {
      const src = (r as any).scraperAdapter ?? "manual";
      if (!r.startDate) continue;
      const key = `${src}|${norm(r.name)}|${r.startDate}`;
      const list = byKey.get(key) ?? [];
      list.push({
        _id: r._id,
        name: r.name,
        source: src,
        createdAt: r._creationTime ?? 0,
        fieldsCount: Object.keys(r).filter((k) => {
          if (k.startsWith("_") || k === "slug" || k === "scraperAdapter") return false;
          const v = (r as any)[k];
          return v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
        }).length,
      });
      byKey.set(key, list);
    }

    const dupes: Array<{
      source: string;
      nameKey: string;
      races: Array<{ _id: string; name: string; source: string; createdAt: number; fieldsCount: number }>;
    }> = [];
    for (const [key, list] of byKey.entries()) {
      if (list.length > 1) {
        const [source, nameKey] = key.split("|");
        dupes.push({
          source,
          nameKey,
          races: list.sort((a, b) => b.fieldsCount - a.fieldsCount),
        });
      }
    }
    return dupes.sort((a, b) => b.races.length - a.races.length);
  },
});

/**
 * systemRenameSlug: cambia el slug de una carrera (auth-free, para migración).
 * Si el nuevo slug ya existe, añade sufijo numérico.
 */
export const systemRenameSlug = mutation({
  args: {
    id: v.id("races"),
    newSlug: v.string(),
  },
  handler: async (ctx, { id, newSlug }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Race not found");
    // Asegurar unicidad: si newSlug ya existe en otra carrera, añade sufijo -2, -3, ...
    let finalSlug = newSlug;
    let suffix = 2;
    while (true) {
      const conflict = await ctx.db
        .query("races")
        .withIndex("by_slug", (q) => q.eq("slug", finalSlug))
        .first();
      if (!conflict || conflict._id === id) break;
      finalSlug = `${newSlug}-${suffix}`;
      suffix++;
    }
    await ctx.db.patch(id, { slug: finalSlug });
    return finalSlug;
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

// =============================================================================
// QUERIES SEO — auth-free, usadas por sitemap.ts y generateMetadata
// Solo devuelven los campos necesarios para SEO/JSON-LD, no la carrera entera.
// =============================================================================

/**
 * Listado mínimo para el sitemap.xml.
 * Devuelve solo slug + ingestedAt + startDate + isFeatured.
 * Auth-free (uso público desde Next.js sitemap.ts).
 */
export const listForSitemap = query({
  args: {},
  handler: async (ctx) => {
    const races = await ctx.db
      .query("races")
      .withIndex("by_published_date")
      .filter((q) => q.eq(q.field("isPublished"), true))
      .collect();
    return races.map((r) => ({
      slug: r.slug,
      startDate: r.startDate,
      isFeatured: r.isFeatured ?? false,
      ingestedAt: r.ingestedAt ?? r._creationTime,
    }));
  },
});

/**
 * Datos SEO de una carrera por slug. Auth-free.
 * Devuelve solo los campos necesarios para generateMetadata + JSON-LD.
 * Más eficiente que getBySlug (no carga deep extraction, gallery, etc).
 */
export const getBySlugForSeo = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const matches = await ctx.db
      .query("races")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .collect();
    if (matches.length === 0) return null;
    // Defensive: si hay duplicados, devuelve la más reciente
    const race =
      matches.length > 1
        ? matches.sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0))[0]
        : matches[0];

    return {
      _id: race._id,
      name: race.name,
      slug: race.slug,
      description: race.description,
      longDescription: race.longDescription,
      locality: race.locality,
      province: race.province,
      distanceKm: race.distanceKm,
      elevationGainM: race.elevationGainM,
      raceType: race.raceType,
      homologated: race.homologated,
      startDate: race.startDate,
      startTime: race.startTime,
      address: race.address,
      venue: race.venue,
      latitude: race.latitude,
      longitude: race.longitude,
      officialUrl: race.officialUrl,
      registrationUrl: race.registrationUrl,
      imageUrl: race.imageUrl,
      organizer: race.organizer,
      priceEur: race.priceEur,
      priceIncludes: race.priceIncludes,
      registrationOpenDate: race.registrationOpenDate,
      registrationCloseDate: race.registrationCloseDate,
      maxParticipants: race.maxParticipants,
      isPublished: race.isPublished,
      isFeatured: race.isFeatured,
      hashtags: race.hashtags,
      raceFormats: race.raceFormats,
      _creationTime: race._creationTime,
    };
  },
});

/**
 * Carreras relacionadas (mismo tipo + provincia cercana).
 * Útil para "Otras carreras que te pueden interesar" al final de la página.
 * Auth-free.
 */
export const getRelated = query({
  args: {
    raceId: v.id("races"),
    province: v.optional(provinceValidator),
    raceType: v.optional(raceTypeValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { raceId, province, raceType, limit }) => {
    const take = limit ?? 6;
    const all = await ctx.db
      .query("races")
      .withIndex("by_published_date")
      .filter((q) => q.eq(q.field("isPublished"), true))
      .collect();
    const filtered = all
      .filter((r) => r._id !== raceId)
      .filter((r) => {
        // Mismo tipo o misma provincia (mismo tipo pesa más)
        if (raceType && r.raceType === raceType) return true;
        if (province && r.province === province) return true;
        return false;
      })
      .slice(0, take);
    return filtered;
  },
});

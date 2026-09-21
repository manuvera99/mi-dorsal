// =============================================================================
// mi-dorsal â€” Races queries y mutations
// =============================================================================

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { provinceValidator, raceTypeValidator, slugify, requireAdmin, validateRaceGeo } from "./_helpers";
import { normalizeName, tokenize, jaccard, localitiesCompatible, findExistingMatch, MatchCandidate } from "./duplicateMatching";

/**
 * Distancias canÃ³nicas (alineadas con `lib/utils.ts` `DISTANCE_CATEGORY_LIST`).
 * Usadas como filtro de carreras â€” la API no recalcula categorÃ­as, las
 * carreras en sÃ­ no almacenan la categorÃ­a, se calcula on-the-fly.
 */
const distanceCategoryValidator = v.union(
  v.literal("5k"),
  v.literal("10k"),
  v.literal("15k"),
  v.literal("half_marathon"),
  v.literal("marathon"),
  v.literal("ultra"),
);

/**
 * Determina en quÃ© categorÃ­as de distancia cae una distancia dada en km.
 * Mismas reglas que `lib/utils.ts` `distanceToCategories` â€” duplicado
 * intencional para evitar que la capa Convex importe de `lib/`.
 */
function distanceToCategories(distanceKm: number): string[] {
  if (typeof distanceKm !== "number" || distanceKm <= 0) return [];
  const out: string[] = [];
  if (distanceKm >= 0    && distanceKm < 7.5)   out.push("5k");
  if (distanceKm >= 7.5  && distanceKm < 12.5)  out.push("10k");
  if (distanceKm >= 12.5 && distanceKm < 17.5)  out.push("15k");
  if (distanceKm >= 17.5 && distanceKm < 23)    out.push("half_marathon");
  if (distanceKm >= 40   && distanceKm < 44)    out.push("marathon");
  if (distanceKm >= 44)                         out.push("ultra");
  return out;
}

/**
 * Igual que distanceToCategories, pero considerando TODAS las distancias
 * de una carrera: la principal (distanceKm) y cada raceFormats[].distanceKm.
 * AsÃ­, filtrar por "10K" encuentra tambiÃ©n una "Media MaratÃ³n" que tiene
 * un raceFormat de 10K, aunque su distanceKm principal sea 21.1.
 */
function allDistanceCategories(race: {
  distanceKm: number;
  raceFormats?: Array<{ distanceKm: number }>;
}): string[] {
  const cats = new Set<string>(distanceToCategories(race.distanceKm));
  for (const f of race.raceFormats ?? []) {
    for (const c of distanceToCategories(f.distanceKm)) {
      cats.add(c);
    }
  }
  return Array.from(cats);
}

/**
 * Lista carreras con filtros opcionales. Lectura pÃºblica.
 *
 * Filtros soportados:
 *  - province     : provincia exacta
 *  - raceType     : road / trail / mixed / obstacle
 *  - month        : 1-12
 *  - search       : texto libre sobre name + locality
 *  - organizer    : match exacto del campo `organizer` (case-insensitive)
 *  - distanceCategories: array de categorÃ­as (5k/10k/15k/half_marathon/marathon/ultra).
 *                        Una carrera cae en una categorÃ­a si su distanceKm estÃ¡
 *                        en el rango de esa categorÃ­a. MÃºltiples categorÃ­as
 *                        = OR.
 *  - fromDate     : "YYYY-MM-DD". Si se pasa, solo se devuelven carreras con
 *                    startDate >= fromDate. Lo envÃ­a el cliente con la fecha
 *                    local del usuario para evitar lÃ­os de timezone con UTC.
 *                    Carreras sin startDate se excluyen cuando hay fromDate.
 *  - limit        : cortar a N
 */
export const list = query({
  args: {
    province: v.optional(provinceValidator),
    raceType: v.optional(raceTypeValidator),
    month: v.optional(v.number()), // 1-12
    search: v.optional(v.string()),
    organizer: v.optional(v.string()),
    distanceCategories: v.optional(v.array(distanceCategoryValidator)),
    homologated: v.optional(v.boolean()),
    fromDate: v.optional(v.string()), // "YYYY-MM-DD"
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("races").withIndex("by_published_date");

    // Filtrar por isPublished (mostrar solo publicadas)
    q = q.filter((qq) => qq.eq(qq.field("isPublished"), true));

    const all = await q.collect();

    // Filtros adicionales en memoria (suficiente para ~100s de carreras)
    let filtered = all;
    if (args.fromDate) {
      // Solo carreras con fecha conocida y >= fromDate (fecha local del cliente).
      // Carreras sin startDate se quedan fuera del catÃ¡logo "futuro".
      filtered = filtered.filter(
        (r) => typeof r.startDate === "string" && r.startDate >= args.fromDate!,
      );
    }
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
          r.locality?.toLowerCase().includes(s) ||
          r.organizer?.toLowerCase().includes(s),
      );
    }
    if (args.organizer) {
      const o = args.organizer.toLowerCase();
      filtered = filtered.filter((r) => r.organizer?.toLowerCase() === o);
    }
    if (args.distanceCategories && args.distanceCategories.length > 0) {
      filtered = filtered.filter((r) => {
        const cats = allDistanceCategories(r);
        return cats.some((c) => args.distanceCategories!.includes(c as never));
      });
    }
    if (args.homologated) {
      filtered = filtered.filter((r) => r.homologated === true);
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
 * Lista todas las organizadoras Ãºnicas con conteo de carreras.
 * Usado para popular el combobox de filtro de organizadora.
 * Lectura pÃºblica.
 */
export const listOrganizers = query({
  handler: async (ctx) => {
    const all = await ctx.db
      .query("races")
      .withIndex("by_published_date")
      .filter((q) => q.eq(q.field("isPublished"), true))
      .collect();

    const counts = new globalThis.Map<string, number>();
    for (const r of all) {
      const org = r.organizer?.trim();
      if (!org) continue;
      counts.set(org, (counts.get(org) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  },
});

/**
 * Carrera por slug. Lectura pÃºblica.
 */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const matches = await ctx.db
      .query("races")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .collect();
    if (matches.length === 0) return null;
    // Si hay duplicados (deberÃ­a estar limpio tras la migraciÃ³n), coge el mÃ¡s reciente
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
 * Crea una carrera. Solo admin (en producciÃ³n, con role check).
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
      // BÃ¡sicos
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
      photosUrl: v.optional(v.string()),
      rulesUrl: v.optional(v.string()),
      registrationUrl: v.optional(v.string()),
      officialUrl: v.optional(v.string()),
      sourceUrl: v.optional(v.string()),
      // Contacto
      contactEmail: v.optional(v.string()),
      contactPhone: v.optional(v.string()),
      // Redes
      socialInstagram: v.optional(v.string()),
      socialFacebook: v.optional(v.string()),
      socialTwitter: v.optional(v.string()),
      socialYoutube: v.optional(v.string()),
      // Precio / inscripciÃ³n
      priceEur: v.optional(v.number()),
      priceIncludes: v.optional(v.string()),
      registrationOpenDate: v.optional(v.string()),
      registrationCloseDate: v.optional(v.string()),
      maxParticipants: v.optional(v.number()),
      soldOut: v.optional(v.boolean()),
      chipType: v.optional(v.union(v.literal("manual"), v.literal("chip"), v.literal("disposable_chip"))),
      // CategorÃ­as
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

    // 2026-09-17: validar coherencia geo con el estado efectivo (patch + existing).
    // Bug que motivÃ³ esto: el deep-extract de IA asignÃ³ coords de Valencia a la
    // carrera FEDME "Gomera Paradise Trail" (provincia s.c. tenerife). El check
    // aquÃ­ evita que un admin (o un script llamando adminUpdate con un patch
    // contaminado) pueda persistir esa incoherencia sin enterarse.
    const effectiveLat  = (patch as any).latitude  ?? existing.latitude;
    const effectiveLng  = (patch as any).longitude ?? existing.longitude;
    const effectiveProv = (patch as any).province  ?? existing.province;
    validateRaceGeo(effectiveLat, effectiveLng, effectiveProv, existing.name);

    // Si cambia el nombre, regeneramos el slug evitando colisiones
    const update: any = { ...patch };
    if (patch.name && patch.name !== existing.name) {
      const baseSlug = slugify(patch.name);
      let finalSlug = baseSlug;
      let suffix = 2;
      // Comprobar colisiÃ³n: si ya hay otra carrera con ese slug, aÃ±adir sufijo
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

    // Fotos disponibles: solo se avisa en la transiciÃ³n vacÃ­o â†’ con valor,
    // para no reenviar el email cada vez que el admin retoca la URL ya
    // publicada. Se comprueba ANTES del patch, comparando contra el valor
    // que existÃ­a en BD (no contra `patch.photosUrl`, que solo dice quÃ©
    // vino en esta llamada).
    const isNewPhotosUrl =
      typeof patch.photosUrl === "string" &&
      patch.photosUrl.trim().length > 0 &&
      (!existing.photosUrl || existing.photosUrl.trim().length === 0);

    await ctx.db.patch(id, update);

    if (isNewPhotosUrl) {
      await ctx.scheduler.runAfter(0, internal.crons.notifyPhotosAvailable.notifyPhotosAvailable, {
        raceId: id,
      });
    }

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

    // 2026-09-17: validar coherencia geo con el estado efectivo (patch + existing).
    // Mismo rationale que adminUpdate: defenderse de ingests/scripts que
    // asignan coords inconsistentes con la provincia declarada. NOTA:
    // systemUpdate es usado por scripts CLI (deep-extract-all) y API
    // routes; NO tiene requireAdmin. Sin este check, un deep-extract con
    // fallo de IA puede contaminar el catÃ¡logo sin levantar alarma.
    const effectiveLat  = (patch as any)?.latitude  ?? existing.latitude;
    const effectiveLng  = (patch as any)?.longitude ?? existing.longitude;
    const effectiveProv = (patch as any)?.province  ?? existing.province;
    validateRaceGeo(effectiveLat, effectiveLng, effectiveProv, existing.name);

    await ctx.db.patch(id, patch);
    return id;
  },
});

/**
 * systemClearGeo: borra latitude/longitude de una carrera.
 *
 * Por quÃ© existe: Convex solo acepta `undefined` (no `null`) para borrar
 * campos opcionales vÃ­a `db.patch`, y `undefined` no se puede enviar por
 * la API HTTP/JSON. Este wrapper permite a los scripts CLI limpiar las
 * coords de carreras mal geocodificadas sin tener que aÃ±adir un campo
 * booleano "tiene coords" en el schema.
 *
 * ImplementaciÃ³n: usa `db.replace` con el documento existente menos los
 * campos que queremos borrar (en vez de `db.patch` con undefined, que
 * tambiÃ©n funciona pero es menos explÃ­cito y mÃ¡s frÃ¡gil ante cambios
 * del compilador TS).
 *
 * 2026-09-17: aÃ±adido para limpieza masiva de carreras con coords basura
 * detectadas en la auditorÃ­a (ver scripts/temp/audit-coords.cjs).
 */
export const systemClearGeo = mutation({
  args: {
    id: v.id("races"),
  },
  handler: async (ctx, { id }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Race not found");
    const { latitude: _lat, longitude: _lng, ...rest } = existing as any;
    void _lat; void _lng;
    await ctx.db.replace(id, rest);
    return id;
  },
});

/**
 * systemListAll: lista TODAS las carreras con sus campos bÃ¡sicos.
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
        // Ampliado 2026-09-07: status mas completo
        isPublished: r.isPublished,
        isFeatured: r.isFeatured,
        scraperAdapter: r.scraperAdapter,
        startTime: r.startTime,
        address: r.address,
        venue: r.venue,
        organizerUrl: r.organizerUrl,
        contactPhone: r.contactPhone,
        sourceUrl: r.sourceUrl,
        dorsalPickupLocation: r.dorsalPickupLocation,
        dorsalPickupHours: r.dorsalPickupHours,
        socialInstagram: r.socialInstagram,
        socialFacebook: r.socialFacebook,
        socialTwitter: r.socialTwitter,
        socialYoutube: r.socialYoutube,
        imageUrl: r.imageUrl,
        description: r.description,
        registrationOpenDate: r.registrationOpenDate,
        registrationCloseDate: r.registrationCloseDate,
        maxParticipants: r.maxParticipants,
        timeLimitMinutes: r.timeLimitMinutes,
        courseType: r.courseType,
        gpxUrl: r.gpxUrl,
        mapImageUrl: r.mapImageUrl,
        profileImageUrl: r.profileImageUrl,
        regulationUrl: r.regulationUrl,
      }));
  },
});

/**
 * systemUpsert: find-or-create idempotente.
 *
 * Busca una carrera existente por (en orden de prioridad):
 *   1. officialUrl (si es especÃ­fico, no homepage)
 *   2. nombre normalizado + startDate + locality
 *   3. nombre normalizado + startDate
 *
 * Si la encuentra, actualiza los campos vacÃ­os con los nuevos, y registra
 * la fuente en additionalDataSourceIds (sin pisar dataSourceId actual).
 *
 * Si no la encuentra, crea una nueva con slug auto-generado (sufijo -2 si choca).
 *
 * Devuelve { id, action: "created" | "updated" } para que el caller sepa quÃ© pasÃ³.
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
    sourceUrl: v.optional(v.string()),
    // Datos bÃ¡sicos
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
    // AtribuciÃ³n
    scraperAdapter: v.optional(v.string()),
    dataSourceId: v.optional(v.id("dataSources")),
    // Cache del adapter de chiplevante (empresa + carrera_id internos)
    chiplevanteEmpresa: v.optional(v.string()),
    chiplevanteCarreraIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Defensa en profundidad contra ingests que traen carreras de fuera de
    // EspaÃ±a: rechazamos la escritura si el caller aporta lat/lng y caen
    // fuera del bounding box de EspaÃ±a. Encontramos 212 carreras de
    // Guatemala/MÃ©xico/Polonia/etc. en el catÃ¡logo (2026-09-12) porque el
    // filtro de paÃ­s vivÃ­a SOLO en cada script de ingest individual (p.ej.
    // ingest-sportmaniacs-2026.ts, antes de 27e866d) â€” un script nuevo o mal
    // configurado podÃ­a colarlas sin que nada en el backend lo impidiera.
    // Mismo bbox que scripts/audit-races-by-country.ts. Solo aplica cuando
    // hay geo: los ingests sin lat/lng (RFEA, FEDME...) siguen dependiendo
    // de su propio filtro por paÃ­s, que ya es correcto.
    //
    // 2026-09-17: ampliado con `validateRaceGeo` (ver convex/_helpers.ts)
    // que ademÃ¡s valida coherencia provincia â†” coords. Caso real: FEDME
    // Gomera con lat/lng de la sede de la FEDME en Valencia (39.46, -0.40)
    // â€” el bbox EspaÃ±a la daba por buena, pero no es coherente con
    // "santa cruz de tenerife". El nuevo check por provincia lo rechaza.
    if (typeof args.latitude === "number" && typeof args.longitude === "number") {
      validateRaceGeo(args.latitude, args.longitude, args.province ?? null, args.name);
    }

    // Auto-asignaciÃ³n de scraperAdapter segÃºn el officialUrl.
    // Si el caller no pasÃ³ scraperAdapter y la URL es de un cronometrador conocido,
    // lo inferimos. Esto es seguro porque los adapters son no-op para URLs que no son suyas.
    if (!args.scraperAdapter && args.officialUrl) {
      const u = args.officialUrl.toLowerCase();
      if (u.includes("chiplevante.com")) {
        args.scraperAdapter = "chiplevante";
      } else if (u.includes("sportmaniacs.com")) {
        args.scraperAdapter = "sportmaniacs";
      } else if (u.includes("cruzandolameta.es")) {
        args.scraperAdapter = "cruzandolameta";
      }
      // AquÃ­ se pueden aÃ±adir mÃ¡s auto-asignaciones en el futuro (dorsalchip, etc.)
    }

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

    // 1. Buscar por officialUrl especÃ­fico
    // Fix 2026-09-12: antes hacÃ­a .collect() de TODA la tabla races (vÃ­a un
    // Ã­ndice "by_data_source" usado solo como truco, con filtro real en
    // memoria) en cada llamada â€” con ~2800 carreras (~3 MB) y decenas de
    // upserts por noche desde el cron de ingesta, esto quemaba varios GB/mes
    // de database bandwidth solo en esta funciÃ³n (el plan Starter incluye
    // 1 GB/mes). Ahora usa el Ã­ndice real by_official_url â€” coste O(matches),
    // no O(tabla completa).
    let existing: Doc<"races"> | null = null;
    if (args.officialUrl && !isHomepageUrl(args.officialUrl)) {
      const matches = await ctx.db
        .query("races")
        .withIndex("by_official_url", (q) => q.eq("officialUrl", args.officialUrl))
        .collect();
      // Si varias carreras comparten este officialUrl, es la URL de un
      // organizador/portal (no de una carrera especÃ­fica) â€” no es una seÃ±al
      // de identidad fiable. Se descarta y se deja caer a los pasos
      // siguientes (nombre+fecha+localidad â†’ structural â†’ fuzzy), que sÃ­
      // usan el nombre real para diferenciar. Verificado 2026-09-14: URLs
      // como carreraspopularesalmeria.com son compartidas por 9 carreras
      // reales distintas en producciÃ³n â€” antes de este fix, coger "la mÃ¡s
      // antigua" bloqueaba que structural/fuzzy llegaran a intentarlo con
      // el nombre real, generando duplicados same-source cada noche.
      //
      // Solo confiar en un Ãºnico match por officialUrl si viene de la MISMA
      // fuente (probable re-ingest real del mismo scraper). Si es de una
      // fuente distinta, es la primera colisiÃ³n de una URL de organizador
      // compartida â€” no hay garantÃ­a de que sea la misma carrera, y
      // confiar ciegamente en ella repetirÃ­a el mismo bug que las URLs con
      // >1 match de arriba, solo retrasado hasta que llegue una 3Âª carrera
      // con esa URL. Cae a los pasos siguientes (nombre+fecha/structural/
      // fuzzy) en ese caso, igual que con matches.length > 1.
      if (matches.length === 1 && (matches[0].scraperAdapter ?? "manual") === (args.scraperAdapter ?? "manual")) {
        existing = matches[0];
      } else if (matches.length > 0) {
        console.warn(
          `[dup-officialUrl-shared] "${args.name}" (${args.scraperAdapter ?? "manual"}) â€” officialUrl ${args.officialUrl} compartido por ${matches.length} carrera(s) existente(s), no se usa como seÃ±al de identidad`,
        );
      }
    }

    // 2. Buscar por nombre + fecha + localidad, y 3. por nombre + fecha (sin
    // localidad). dateMatches se reutiliza abajo en los pasos 4-5 (structural
    // + fuzzy) para no lanzar una query adicional â€” sigue siendo el mismo
    // Ã­ndice real by_date, acotado a esta fecha exacta, no toda la tabla.
    let dateMatches: Doc<"races">[] = [];
    if (!existing && args.startDate) {
      const nameKey = norm(args.name);
      dateMatches = await ctx.db
        .query("races")
        .withIndex("by_date", (q) => q.eq("startDate", args.startDate!))
        .collect();
      const locKey = norm(args.locality);
      if (locKey) {
        existing = dateMatches.find((c) => norm(c.name) === nameKey && norm(c.locality) === locKey) ?? null;
      }
      if (!existing) {
        existing = dateMatches.find((c) => norm(c.name) === nameKey) ?? null;
      }
    }

    // 4-5. Structural + fuzzy cruzando fuentes (2026-09-12): antes de crear
    // una carrera nueva, comprobar si otra fuente ya describe la misma
    // carrera con un nombre distinto (misma fecha+provincia+distancia, o
    // nombre suficientemente similar). Mismo matching que ya usa el panel
    // /admin/duplicates (adminFindDuplicates) â€” spec en
    // docs/superpowers/specs/2026-09-12-prevenir-duplicados-ingest-design.md.
    //
    // Fix 2026-09-20: el pool ya no es solo dateMatches (startDate exacto) â€”
    // se amplÃ­a con startDate-1 y startDate+1. Causa raÃ­z verificada contra
    // la BBDD real: la misma carrera reingestada con la fecha desviada 1 dÃ­a
    // (distinto scraper, error de parseo/zona horaria, o el organizador
    // cambia el dÃ­a en su web) nunca caÃ­a en el mismo pool y se creaba como
    // duplicado â€” ej. real "XXIII Carrera MTB Sierra de Noez" (mismo
    // officialUrl, mismo scraperAdapter) con fechas 2026-10-11 vs 2026-10-10
    // en 2 filas separadas. exact (pasos 1-3 arriba) NO se toca â€” sigue
    // exigiendo fecha idÃ©ntica a propÃ³sito (mÃ¡xima confianza, es literalmente
    // un re-ingest). Coste: 2 queries adicionales vÃ­a Ã­ndice real by_date
    // (acotadas a 1 fecha cada una) â€” nunca .collect() de tabla completa.
    // matchReason: solo se rellena cuando el match viene de structural/fuzzy
    // (pasos 4-5, probabilÃ­stico). null para exact/pasos 1-3 (alta confianza,
    // ya existente antes de esta task) â€” se usa mÃ¡s abajo para excluir
    // officialUrl del auto-relleno en el caso probabilÃ­stico.
    let matchReason: "structural" | "fuzzy" | null = null;
    if (!existing && args.startDate) {
      const d = new Date(args.startDate + "T00:00:00Z");
      const prevDate = new Date(d.getTime() - 86400000).toISOString().slice(0, 10);
      const nextDate = new Date(d.getTime() + 86400000).toISOString().slice(0, 10);
      const [prevMatches, nextMatches] = await Promise.all([
        ctx.db.query("races").withIndex("by_date", (q) => q.eq("startDate", prevDate)).collect(),
        ctx.db.query("races").withIndex("by_date", (q) => q.eq("startDate", nextDate)).collect(),
      ]);
      const pool = [...dateMatches, ...prevMatches, ...nextMatches];
      if (pool.length > 0) {
        const candidate: MatchCandidate = {
          name: args.name,
          startDate: args.startDate,
          province: args.province,
          locality: args.locality,
          distanceKm: args.distanceKm,
          scraperAdapter: args.scraperAdapter,
        };
        const match = findExistingMatch(candidate, pool);
        if (match) {
          console.warn(
            `[dup-match:${match.reason}] "${args.name}" (${args.scraperAdapter ?? "manual"}) â†’ matched existing ${match.race._id} "${match.race.name}" (${match.race.scraperAdapter ?? "manual"})`,
          );
          existing = match.race;
          if (match.reason === "structural" || match.reason === "fuzzy") {
            matchReason = match.reason;
          }
        }
      }
    }

    if (existing) {
      // UPDATE: rellenar campos vacÃ­os, aÃ±adir dataSourceId a additional
      const patch: Record<string, unknown> = {};
      const skipFields = new Set([
        "name", // nunca pisar el nombre original
        "slug", // nunca pisar el slug
        "scraperAdapter", // no pisar (mantenemos el primero)
        "dataSourceId", // manejado aparte (priority)
      ]);
      // Match probabilÃ­stico (structural/fuzzy, pasos 4-5): si el match fuera
      // errÃ³neo, pisar officialUrl aquÃ­ contaminarÃ­a una carrera real con la
      // URL de otra, y un futuro ingest desde esa fuente volverÃ­a a matchear
      // por by_official_url (paso 1) reforzando el error en vez de exponerlo.
      // Los matches exact/pasos 1-3 (alta confianza) siguen rellenando
      // officialUrl como antes de esta task.
      if (matchReason === "structural" || matchReason === "fuzzy") {
        skipFields.add("officialUrl");
      }
      for (const [k, v] of Object.entries(args)) {
        if (skipFields.has(k)) continue;
        if (v === null || v === undefined || v === "") continue;
        if (Array.isArray(v) && v.length === 0) continue;
        // Solo rellenar si estÃ¡ vacÃ­o en el existente
        const current = (existing as any)[k];
        if (current === null || current === undefined || current === "") {
          patch[k] = v;
        }
      }
      // dataSourceId: si la nueva fuente es mÃ¡s prioritaria, sobrescribir
      if (args.dataSourceId && args.dataSourceId !== existing.dataSourceId) {
        // Orden de confianza de mayor a menor. "Agenda Sureste" (Correbirras)
        // no estaba en esta lista (bug de auditorÃ­a 2026-09-11): su indexOf
        // daba -1 y por tanto nunca ganaba el desempate frente a ninguna
        // otra fuente, aunque deberÃ­a tener prioridad propia. "Manual" va
        // Ãºltima a propÃ³sito: es la fuente MENOS prioritaria para decidir
        // quÃ© dataSourceId queda, pero justo por eso mÃ¡s abajo protegemos
        // sus campos de ser sobrescritos por un re-ingest automÃ¡tico.
        const priority = ["RFEA", "FEDME", "ITRA", "Sportmaniacs", "Agenda Sureste", "Alcanza tu Meta", "Runedia", "Manual"];
        // Bug preexistente (previo a esta auditorÃ­a): ctx.db.get(undefined)
        // lanza "Must provide arg 1 `id` to `get`" â€” pasaba siempre que la
        // carrera existente no tenÃ­a dataSourceId asignado todavÃ­a (comÃºn
        // en carreras antiguas o creadas antes de que existiera esta FK).
        // Confirmado en logs reales del workflow 2026-09-11 (RFEA fallaba
        // con este error en re-ingests). Guardamos con un if en vez de
        // pasar undefined a .get().
        const existingSrc = existing.dataSourceId ? await ctx.db.get(existing.dataSourceId as any) : null;
        const newSrc = await ctx.db.get(args.dataSourceId);
        const existingName = (existingSrc as any)?.name ?? "";
        const existingIdx = priority.indexOf(existingName);
        const newIdx = priority.indexOf((newSrc as any)?.name ?? "");
        if (newIdx !== -1 && (existingIdx === -1 || newIdx < existingIdx)) {
          // La nueva es mÃ¡s prioritaria â†’ guardar la vieja en additional
          const additional: string[] = (existing as any).additionalDataSourceIds ?? [];
          if (existing.dataSourceId && !additional.includes(existing.dataSourceId)) {
            additional.push(existing.dataSourceId);
          }
          patch.dataSourceId = args.dataSourceId;
          patch.additionalDataSourceIds = additional;

          // AdemÃ¡s de rellenar huecos (loop de arriba), cuando la fuente
          // entrante es MÃS prioritaria dejamos que "mejore" un dato ya
          // presente pero potencialmente peor (ej. Sportmaniacs pone
          // distanceKm=10 de relleno, RFEA llega despuÃ©s con el dato real).
          // Nunca tocamos estos campos si la existente es "Manual" â€” un
          // dato curado a mano por el admin no debe perderse en un
          // re-ingest automÃ¡tico.
          if (existingName !== "Manual") {
            const upgradableFields = [
              "distanceKm",
              "elevationGainM",
              "priceEur",
              "raceType",
              "homologated",
            ] as const;
            for (const field of upgradableFields) {
              const incoming = (args as any)[field];
              if (incoming === null || incoming === undefined || incoming === "") continue;
              patch[field] = incoming;
            }
          }
        } else {
          // La existente es mÃ¡s prioritaria â†’ solo aÃ±adir la nueva a additional
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

    // CREATE: slug auto-generado sin colisiÃ³n
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
      // Campos requeridos por el schema.
      // 2026-09-07: eliminado el fallback province ?? "valencia" que enmascaraba
      // carreras mal ubicadas. Si el caller no pasa province, falla con error
      // explÃ­cito. Las ingestas que no tengan province deben arreglarlo
      // antes de llamar a systemUpsert.
      name: args.name,
      province: args.province as any,
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
 * systemMergeDuplicates: fusiona UNA carrera duplicada (`deleteId`) en la
 * carrera que se conserva (`keepId`). Migra todas las referencias de usuario
 * a `races` antes de borrar `deleteId`, para no dejar FKs colgando.
 *
 * Usado por scripts/fix-cross-source-duplicates.ts (limpieza one-off del
 * backlog de /admin/duplicates). Auth-free como el resto de mutations
 * "system*" â€” solo se ejecuta desde terminal con CONVEX_DEPLOY_KEY.
 *
 * Tablas con conflicto de unicidad lÃ³gica (userId, raceId) â€” myRaces,
 * raceRatings, raceVotes â€” no se migran ciegamente: si el usuario ya tiene
 * fila en `keepId`, se conserva la de mÃ¡s seÃ±al y se borra la otra (nunca
 * las 2 a la vez, para no perder datos de nadie).
 */
export const systemMergeDuplicates = mutation({
  args: {
    keepId: v.id("races"),
    deleteId: v.id("races"),
  },
  handler: async (ctx, { keepId, deleteId }) => {
    if (keepId === deleteId) {
      throw new Error("keepId y deleteId no pueden ser la misma carrera");
    }
    const keepRace = await ctx.db.get(keepId);
    const deleteRace = await ctx.db.get(deleteId);
    if (!keepRace || !deleteRace) {
      throw new Error("keepId o deleteId no existen");
    }

    const migrated: Record<string, number> = {};
    const merged: Record<string, number> = {};

    // --- myRaces (conflicto de unicidad por userId) ---
    {
      const toMigrate = await ctx.db
        .query("myRaces")
        .withIndex("by_race", (q) => q.eq("raceId", deleteId))
        .collect();
      let n = 0, m = 0;
      for (const row of toMigrate) {
        const existingForUser = await ctx.db
          .query("myRaces")
          .withIndex("by_user_race", (q) => q.eq("userId", row.userId).eq("raceId", keepId))
          .unique();
        if (!existingForUser) {
          await ctx.db.patch(row._id, { raceId: keepId });
          n++;
        } else {
          // El usuario ya tiene fila en keepId: conserva la de mÃ¡s seÃ±al
          // (status !== "planned" gana a "planned"; si ambas iguales, la mÃ¡s
          // reciente por _creationTime) y borra la otra.
          const rowScore = row.status !== "planned" ? 1 : 0;
          const existingScore = existingForUser.status !== "planned" ? 1 : 0;
          if (rowScore > existingScore) {
            await ctx.db.delete(existingForUser._id);
            await ctx.db.patch(row._id, { raceId: keepId });
            console.log(`[merge-conflict:myRaces] user=${row.userId} kept=${row._id} deleted=${existingForUser._id} reason=status`);
          } else if (rowScore < existingScore) {
            await ctx.db.delete(row._id);
            console.log(`[merge-conflict:myRaces] user=${row.userId} kept=${existingForUser._id} deleted=${row._id} reason=status`);
          } else {
            // Empate de seÃ±al por status: prioriza la fila con datos de
            // resultado reales (tiempo/diploma) antes de mirar recencia â€”
            // recencia no se correlaciona con completitud, y perder la fila
            // con diploma/resultado real deja _storage blobs huÃ©rfanos y
            // enlaces /resultado/{myRaceId} rotos sin posibilidad de deshacer.
            const rowHasResult = row.actualTimeSeconds !== undefined || row.diplomaStorageId !== undefined;
            const existingHasResult = existingForUser.actualTimeSeconds !== undefined || existingForUser.diplomaStorageId !== undefined;
            if (rowHasResult && !existingHasResult) {
              await ctx.db.delete(existingForUser._id);
              await ctx.db.patch(row._id, { raceId: keepId });
              console.log(`[merge-conflict:myRaces] user=${row.userId} kept=${row._id} deleted=${existingForUser._id} reason=result-data`);
            } else if (!rowHasResult && existingHasResult) {
              await ctx.db.delete(row._id);
              console.log(`[merge-conflict:myRaces] user=${row.userId} kept=${existingForUser._id} deleted=${row._id} reason=result-data`);
            } else if ((row._creationTime ?? 0) > (existingForUser._creationTime ?? 0)) {
              await ctx.db.delete(existingForUser._id);
              await ctx.db.patch(row._id, { raceId: keepId });
              console.log(`[merge-conflict:myRaces] user=${row.userId} kept=${row._id} deleted=${existingForUser._id} reason=recency`);
            } else {
              await ctx.db.delete(row._id);
              console.log(`[merge-conflict:myRaces] user=${row.userId} kept=${existingForUser._id} deleted=${row._id} reason=recency`);
            }
          }
          m++;
        }
      }
      migrated.myRaces = n;
      merged.myRaces = m;
    }

    // --- raceRatings (conflicto de unicidad por userId) ---
    {
      const toMigrate = await ctx.db
        .query("raceRatings")
        .withIndex("by_race", (q) => q.eq("raceId", deleteId))
        .collect();
      let n = 0, m = 0;
      for (const row of toMigrate) {
        const existingForUser = await ctx.db
          .query("raceRatings")
          .withIndex("by_user_race", (q) => q.eq("userId", row.userId).eq("raceId", keepId))
          .unique();
        if (!existingForUser) {
          await ctx.db.patch(row._id, { raceId: keepId });
          n++;
        } else {
          // Ya hay rating del usuario en keepId: nos quedamos con ese, se
          // borra el del duplicado (no hay "mÃ¡s seÃ±al" objetiva en un rating).
          await ctx.db.delete(row._id);
          console.log(`[merge-conflict:raceRatings] user=${row.userId} kept=${existingForUser._id} deleted=${row._id}`);
          m++;
        }
      }
      migrated.raceRatings = n;
      merged.raceRatings = m;
    }

    // --- raceVotes (conflicto de unicidad por userId) ---
    {
      const toMigrate = await ctx.db
        .query("raceVotes")
        .withIndex("by_race", (q) => q.eq("raceId", deleteId))
        .collect();
      let n = 0, m = 0;
      for (const row of toMigrate) {
        const existingForUser = await ctx.db
          .query("raceVotes")
          .withIndex("by_user_race", (q) => q.eq("userId", row.userId).eq("raceId", keepId))
          .unique();
        if (!existingForUser) {
          await ctx.db.patch(row._id, { raceId: keepId });
          n++;
        } else {
          await ctx.db.delete(row._id);
          console.log(`[merge-conflict:raceVotes] user=${row.userId} kept=${existingForUser._id} deleted=${row._id}`);
          m++;
        }
      }
      migrated.raceVotes = n;
      merged.raceVotes = m;
    }

    // --- Tablas sin conflicto de unicidad: migraciÃ³n directa ---
    // personalRecords no tiene Ã­ndice por raceId (raceId es opcional, de baja
    // cardinalidad de uso) â€” .collect() de tabla completa aceptable aquÃ­: es
    // un script one-off de mantenimiento, no un hot path de cron/ingesta (la
    // regla de checklist de coste de esta sesiÃ³n aplica a hot paths).
    {
      const all = await ctx.db.query("personalRecords").collect();
      let n = 0;
      for (const row of all) {
        if (row.raceId === deleteId) {
          await ctx.db.patch(row._id, { raceId: keepId });
          n++;
        }
      }
      migrated.personalRecords = n;
    }

    {
      const toMigrate = await ctx.db
        .query("raceResultsCache")
        .withIndex("by_race", (q) => q.eq("raceId", deleteId))
        .collect();
      for (const row of toMigrate) {
        await ctx.db.patch(row._id, { raceId: keepId });
      }
      migrated.raceResultsCache = toMigrate.length;
    }

    {
      const toMigrate = await ctx.db
        .query("predictions")
        .withIndex("by_race", (q) => q.eq("raceId", deleteId))
        .collect();
      for (const row of toMigrate) {
        await ctx.db.patch(row._id, { raceId: keepId });
      }
      migrated.predictions = toMigrate.length;
    }

    {
      const toMigrate = await ctx.db
        .query("activities")
        .withIndex("by_matched_race", (q) => q.eq("matchedRaceId", deleteId))
        .collect();
      for (const row of toMigrate) {
        await ctx.db.patch(row._id, { matchedRaceId: keepId });
      }
      migrated.activities = toMigrate.length;
    }

    {
      const toMigrate = await ctx.db
        .query("feedbackReports")
        .withIndex("by_race", (q) => q.eq("raceId", deleteId))
        .collect();
      for (const row of toMigrate) {
        await ctx.db.patch(row._id, { raceId: keepId });
      }
      migrated.feedbackReports = toMigrate.length;
    }

    // notificationLog, raceSuggestions, raceCandidates no tienen Ã­ndice por
    // raceId (son de bajo volumen y no forman parte de ningÃºn hot path) â€”
    // se aceptan sin Ã­ndice dedicado en este script one-off.
    {
      const all = await ctx.db.query("notificationLog").collect();
      let n = 0;
      for (const row of all) {
        if (row.relatedRaceId === deleteId) {
          await ctx.db.patch(row._id, { relatedRaceId: keepId });
          n++;
        }
      }
      migrated.notificationLog = n;
    }

    {
      const all = await ctx.db.query("raceSuggestions").collect();
      let n = 0;
      for (const row of all) {
        if (row.createdRaceId === deleteId) {
          await ctx.db.patch(row._id, { createdRaceId: keepId });
          n++;
        }
      }
      migrated.raceSuggestions = n;
    }

    {
      const all = await ctx.db.query("raceCandidates").collect();
      let n = 0;
      for (const row of all) {
        if (row.linkedRaceId === deleteId) {
          await ctx.db.patch(row._id, { linkedRaceId: keepId });
          n++;
        }
      }
      migrated.raceCandidates = n;
    }

    await ctx.db.delete(deleteId);

    return { keepId, deleteId, migrated, merged };
  },
});

/**
 * findDuplicateSlugs: agrupa por slug y devuelve los que tienen >1 carrera.
 * Usado por scripts de migraciÃ³n.
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
 * systemRenameSlug: cambia el slug de una carrera (auth-free, para migraciÃ³n).
 * Si el nuevo slug ya existe, aÃ±ade sufijo numÃ©rico.
 */
export const systemRenameSlug = mutation({
  args: {
    id: v.id("races"),
    newSlug: v.string(),
  },
  handler: async (ctx, { id, newSlug }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Race not found");
    // Asegurar unicidad: si newSlug ya existe en otra carrera, aÃ±ade sufijo -2, -3, ...
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
 * Admin: elimina VARIAS carreras en batch.
 * Usado por el panel de duplicados.
 */
export const adminDeleteMany = mutation({
  args: { ids: v.array(v.id("races")) },
  handler: async (ctx, { ids }) => {
    await requireAdmin(ctx);
    if (ids.length === 0) return { deleted: 0 };
    let deleted = 0;
    for (const id of ids) {
      const r = await ctx.db.get(id);
      if (!r) continue;
      await ctx.db.delete(id);
      deleted++;
    }
    return { deleted };
  },
});

/**
 * Admin: busca carreras candidatas a duplicado, agrupadas por motivo.
 *
 * Tipos de detecciÃ³n (ordenados por confianza):
 *   - "exact":  mismo source + mismo nombre normalizado + misma fecha (re-ingest)
 *   - "structural": misma fecha + misma provincia + misma distancia (Â±0.1km)
 *                + locality compatible (entre fuentes distintas)
 *   - "fuzzy":   misma fecha + misma provincia + nombre con similitud > umbral
 *                (entre fuentes distintas o dentro de la misma)
 *
 * Devuelve hasta `maxGroups` grupos, cada uno con TODOS los campos de las
 * carreras (sin datos sensibles). El admin elige quÃ© borrar/quÃ© conservar.
 */
export const adminFindDuplicates = query({
  args: {
    maxGroups: v.optional(v.number()),
    similarityThreshold: v.optional(v.number()),
  },
  handler: async (ctx, { maxGroups = 50, similarityThreshold = 0.75 }) => {
    await requireAdmin(ctx);

    const all = await ctx.db.query("races").collect();

    // === Dedupe de grupos (un mismo par puede aparecer en varios detectores) ===
    type Group = {
      key: string;
      reason: string;
      reasonType: "exact" | "structural" | "fuzzy";
      races: Doc<"races">[];
    };
    const groups = new Map<string, Group>();

    const addGroup = (races: Doc<"races">[], reason: string, reasonType: Group["reasonType"]) => {
      if (races.length < 2) return;
      // Dedupe por set de IDs ordenado
      const ids = races.map((r) => r._id).sort();
      const key = ids.join("|");
      const existing = groups.get(key);
      if (existing) {
        // Si ya existe por otro detector, quÃ©date con el de mayor confianza
        const order = { exact: 0, structural: 1, fuzzy: 2 } as const;
        if (order[reasonType] < order[existing.reasonType]) {
          groups.set(key, { key, reason, reasonType, races });
        }
        return;
      }
      groups.set(key, { key, reason, reasonType, races });
    };

    // === Detector 1: same-source + exact name + same date ===
    const byExact = new Map<string, Doc<"races">[]>();
    for (const r of all) {
      if (!r.startDate) continue;
      const norm = normalizeName(r.name);
      if (!norm) continue;
      const k = `${r.scraperAdapter ?? "manual"}|${norm}|${r.startDate}`;
      if (!byExact.has(k)) byExact.set(k, []);
      byExact.get(k)!.push(r);
    }
    for (const [, list] of byExact) {
      if (list.length >= 2) {
        const source = list[0].scraperAdapter ?? "manual";
        addGroup(
          list,
          `Mismo nombre exacto + fecha (fuente: ${source})`,
          "exact"
        );
      }
    }

    // Fix 2026-09-20: mismo root cause que systemUpsert (convex/races.ts) â€”
    // los detectores 2/3 solo comparaban carreras con startDate EXACTAMENTE
    // igual, asÃ­ que una carrera reingestada con la fecha desviada 1 dÃ­a
    // nunca caÃ­a en el mismo bucket y el panel nunca la mostraba como
    // duplicado. Se inserta cada carrera en los buckets de sus 3 fechas
    // vecinas (dÃ­a-1, dÃ­a, dÃ­a+1) en vez de solo la suya â€” un par real que
    // difiere en 0 o 1 dÃ­a comparte al menos 1 bucket. addGroup ya dedupea
    // por el set de IDs ordenado, asÃ­ que un mismo par detectado desde 2
    // buckets vecinos no duplica el grupo. El detector 1 (exact) NO se toca
    // â€” sigue exigiendo fecha idÃ©ntica a propÃ³sito (mÃ¡xima confianza).
    function neighborDates(startDate: string): string[] {
      const d = new Date(startDate + "T00:00:00Z");
      const prev = new Date(d.getTime() - 86400000).toISOString().slice(0, 10);
      const next = new Date(d.getTime() + 86400000).toISOString().slice(0, 10);
      return [prev, startDate, next];
    }

    // === Detector 2: structural cross-source (date+province+distance+locality) ===
    // Bucket por (date, province, distanceBucket) â€” date tolera Â±1 dÃ­a
    const byStructural = new Map<string, Doc<"races">[]>();
    for (const r of all) {
      if (!r.startDate || !r.province) continue;
      const distBucket = Math.round(r.distanceKm * 2) / 2; // 0.5 km
      for (const d of neighborDates(r.startDate)) {
        const k = `${d}|${r.province}|${distBucket}`;
        if (!byStructural.has(k)) byStructural.set(k, []);
        byStructural.get(k)!.push(r);
      }
    }
    // Bug real encontrado 2026-09-21 al verificar el fix de Â±1 dÃ­a contra
    // producciÃ³n: el check "Â¿el bucket tiene >=2 fuentes?" se hacÃ­a sobre
    // TODO el bucket agregado, no sobre el PAR que se compara â€” con buckets
    // de 1 sola fecha exacta esto ya era un riesgo latente, pero al ampliar
    // a Â±1 dÃ­a una carrera de una fecha vecina (de otra fuente) "contamina"
    // el conteo de fuentes del bucket y hace pasar pares 100% same-source
    // (ej. real: "Marcha NÃ³rdica Cabezo de Torres" y "VII 10KBZO Cabezo de
    // Torres", ambas de correbirras, se fusionaban porque el bucket incluÃ­a
    // tambiÃ©n una carrera de alcanzatumeta de un dÃ­a vecino). AdemÃ¡s, al
    // insertar cada carrera en sus 3 buckets vecinos, dos carreras que
    // comparten bucket pueden diferir hasta 2 dÃ­as reales (A en dÃ­a 1, B en
    // dÃ­a 3, ambas caen en el bucket "dÃ­a 2") â€” mÃ¡s de la tolerancia Â±1 dÃ­a
    // pretendida. Se corrigen ambos moviendo las 2 comprobaciones al nivel
    // del PAR en el pairwise, en vez de depender de agregados del bucket.
    const daysBetween = (d1: string, d2: string) =>
      Math.abs(new Date(d1 + "T00:00:00Z").getTime() - new Date(d2 + "T00:00:00Z").getTime()) / 86400000;
    for (const [, list] of byStructural) {
      if (list.length < 2) continue;
      // Pairwise: fuente distinta + fecha real Â±1 dÃ­a + locality + distancia exacta
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const b = list[j];
          if ((a.scraperAdapter ?? "manual") === (b.scraperAdapter ?? "manual")) continue;
          if (!a.startDate || !b.startDate || daysBetween(a.startDate, b.startDate) > 1) continue;
          if (!localitiesCompatible(a.locality, b.locality)) continue;
          if (Math.abs(a.distanceKm - b.distanceKm) > 0.1) continue;
          addGroup(
            [a, b],
            `Misma fecha + provincia + distancia (${a.distanceKm} km, ${a.locality ?? "?"})`,
            "structural"
          );
        }
      }
    }

    // === Detector 3: fuzzy (date+province + name similarity > threshold) ===
    // Bucket por (date, province) â€” date tolera Â±1 dÃ­a (ver nota Detector 2)
    const byFuzzyBucket = new Map<string, Doc<"races">[]>();
    for (const r of all) {
      if (!r.startDate) continue;
      const prov = r.province ?? r.locality ?? "?";
      for (const d of neighborDates(r.startDate)) {
        const k = `${d}|${prov}`;
        if (!byFuzzyBucket.has(k)) byFuzzyBucket.set(k, []);
        byFuzzyBucket.get(k)!.push(r);
      }
    }
    for (const [, list] of byFuzzyBucket) {
      if (list.length < 2) continue;
      // Pre-computar tokens
      const tokensList = list.map((r) => ({ r, t: tokenize(r.name) }));
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = tokensList[i];
          const b = tokensList[j];
          // Fix 2026-09-21 (mismo motivo que Detector 2): filtro de fecha
          // real por PAR, no por bucket agregado â€” al insertar cada carrera
          // en sus 3 buckets vecinos, 2 carreras del mismo bucket pueden
          // diferir hasta 2 dÃ­as reales, mÃ¡s de la tolerancia Â±1 pretendida.
          if (!a.r.startDate || !b.r.startDate || daysBetween(a.r.startDate, b.r.startDate) > 1) continue;
          const sim = jaccard(a.t, b.t);
          if (sim >= similarityThreshold) {
            addGroup(
              [a.r, b.r],
              `Nombres similares (${(sim * 100).toFixed(0)}% Jaccard)`,
              "fuzzy"
            );
          }
        }
      }
    }

    // Ordenar: exact > structural > fuzzy; dentro de cada tipo, por fecha asc
    const order = { exact: 0, structural: 1, fuzzy: 2 } as const;
    const sorted = Array.from(groups.values()).sort((a, b) => {
      if (order[a.reasonType] !== order[b.reasonType]) return order[a.reasonType] - order[b.reasonType];
      const da = a.races[0].startDate ?? "9999";
      const db = b.races[0].startDate ?? "9999";
      return da.localeCompare(db);
    });

    return sorted.slice(0, maxGroups);
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
// QUERIES SEO â€” auth-free, usadas por sitemap.ts y generateMetadata
// Solo devuelven los campos necesarios para SEO/JSON-LD, no la carrera entera.
// =============================================================================

/**
 * Listado mÃ­nimo para el sitemap.xml.
 * Devuelve solo slug + ingestedAt + startDate + isFeatured.
 * Auth-free (uso pÃºblico desde Next.js sitemap.ts).
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
 * MÃ¡s eficiente que getBySlug (no carga deep extraction, gallery, etc).
 */
export const getBySlugForSeo = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const matches = await ctx.db
      .query("races")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .collect();
    if (matches.length === 0) return null;
    // Defensive: si hay duplicados, devuelve la mÃ¡s reciente
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
 * Ãštil para "Otras carreras que te pueden interesar" al final de la pÃ¡gina.
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
        // Mismo tipo o misma provincia (mismo tipo pesa mÃ¡s)
        if (raceType && r.raceType === raceType) return true;
        if (province && r.province === province) return true;
        return false;
      })
      .slice(0, take);
    return filtered;
  },
});

/**
 * Devuelve varias carreras por id (pÃºblico). Usado por el blog para
 * enlazar a carreras mencionadas en un post. Solo devuelve published.
 */
export const getByIds = query({
  args: { ids: v.array(v.id("races")) },
  handler: async (ctx, { ids }) => {
    if (ids.length === 0) return [];
    const out = await Promise.all(
      ids.map(async (id) => {
        const r = await ctx.db.get(id);
        return r && r.isPublished ? r : null;
      }),
    );
    return out.filter(Boolean);
  },
});

// =============================================================================
// QUERIES SEO extras ï¿½ auth-free, lightweight, listas para Server Components
// Usadas por /ranking y /carreras para emitir JSON-LD ItemList con slugs reales.
// Devuelven solo los campos minimos (slug + name + locality + startDate + distance).
// No son hot paths: solo se llaman desde server components cacheados por Vercel.
// =============================================================================

/**
 * Top N carreras marcadas como destacadas (isFeatured=true).
 * Para el JSON-LD ItemList de /ranking y como carrusel principal de la home.
 * Sin filtro de fecha: incluye pasadas y futuras (Google quiere ver amplitud).
 */
export const getTopFeaturedForSeo = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const n = limit ?? 20;
    // listForSitemap ya hace .collect() acotado por indice (by_published_date).
    // Filtramos isFeatured en memoria; como son ~2.700 docs, es <1ms.
    const all = await ctx.db
      .query("races")
      .withIndex("by_published_date")
      .filter((q) => q.eq(q.field("isPublished"), true))
      .collect();
    return all
      .filter((r) => r.isFeatured === true)
      .slice(0, n)
      .map((r) => ({
        slug: r.slug,
        name: r.name,
        locality: r.locality,
        province: r.province,
        startDate: r.startDate,
        distanceKm: r.distanceKm,
      }));
  },
});

/**
 * Top N carreras futuras mas cercanas (startDate >= hoy) publicadas.
 * Para el JSON-LD ItemList de /carreras (carrusel "proximas carreras").
 * Si no hay suficientes futuras, completa con las mas recientes pasadas.
 */
export const getUpcomingForSeo = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const n = limit ?? 50;
    const today = new Date().toISOString().slice(0, 10);
    const all = await ctx.db
      .query("races")
      .withIndex("by_published_date")
      .filter((q) => q.eq(q.field("isPublished"), true))
      .collect();
    // upcoming primero (futuras ordenadas por fecha asc), luego recientes (desc) de relleno
    const upcoming = all
      .filter((r) => typeof r.startDate === "string" && r.startDate >= today)
      .sort((a, b) => (a.startDate! < b.startDate! ? -1 : 1))
      .slice(0, n);
    if (upcoming.length >= n) {
      return upcoming.map((r) => ({
        slug: r.slug,
        name: r.name,
        locality: r.locality,
        province: r.province,
        startDate: r.startDate,
        distanceKm: r.distanceKm,
      }));
    }
    const remaining = n - upcoming.length;
    const recent = all
      .filter((r) => !(typeof r.startDate === "string" && r.startDate >= today))
      .sort((a, b) => (b.startDate! > a.startDate! ? 1 : -1))
      .slice(0, remaining);
    return [...upcoming, ...recent].map((r) => ({
      slug: r.slug,
      name: r.name,
      locality: r.locality,
      province: r.province,
      startDate: r.startDate,
      distanceKm: r.distanceKm,
    }));
  },
});

// =============================================================================
// QUERY: getRelatedRaces â€” Carreras similares para backlinks internos
// Usada por el bloque RelatedRacesSection en /carreras/[slug].
// Auth-free, devuelve hasta `limit` carreras similares priorizando:
//   1. Mismo province (CCAA)
//   2. Proximidad de fecha (cuanto mas cercana en el calendario, mejor)
//   3. Distancia similar (+-30%)
//   4. Bonus por estar destacada / ser futura
// Critico para: UX (descubrimiento), SEO (backlinks internos cruzados),
// diferenciacion vs agregadores que no enlazan fichas entre si.
// =============================================================================
export const getRelatedRaces = query({
  args: {
    raceId: v.id("races"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { raceId, limit }) => {
    const n = limit ?? 6;
    const current = await ctx.db.get(raceId);
    if (!current) return [];

    // Candidatas mismo province (la mayoria del trafico SEO viene por CCAA)
    const sameProvince = await ctx.db
      .query("races")
      .withIndex("by_date")
      .filter((q) =>
        q.and(
          q.eq(q.field("isPublished"), true),
          q.eq(q.field("province"), current.province),
        ),
      )
      .collect();

    const minDist = current.distanceKm * 0.7;
    const maxDist = current.distanceKm * 1.3;
    const today = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const scored = sameProvince
      .filter((r) => r._id !== current._id)
      .filter((r) => !r.startDate || r.startDate >= sevenDaysAgo)
      .map((r) => {
        let score = 100; // base por mismo province
        if (r.startDate && current.startDate) {
          const diffDays = Math.abs(
            new Date(r.startDate).getTime() - new Date(current.startDate).getTime(),
          ) / 86400000;
          score += Math.max(0, 50 - diffDays); // -1 por dia, max +50
        }
        if (r.distanceKm >= minDist && r.distanceKm <= maxDist) score += 30;
        if (r.startDate && r.startDate >= today) score += 20;
        if (r.isFeatured === true) score += 15;
        return { r, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, n)
      .map((s) => ({
        slug: s.r.slug,
        name: s.r.name,
        locality: s.r.locality,
        province: s.r.province,
        startDate: s.r.startDate,
        distanceKm: s.r.distanceKm,
        raceType: s.r.raceType,
        imageUrl: s.r.imageUrl,
        isFeatured: s.r.isFeatured ?? false,
      }));

    return scored;
  },
});

// =============================================================================
// HUBS SEO â€” auth-free, devuelven datos agregados para landings programÃ¡ticas.
// /carreras/{provincia}, /carreras/{distancia}, /guias, /comparativas.
// Sin auth, lightweight, cacheables por Vercel (revalidate en cada Server Component).
// =============================================================================

const PROVINCE_LABELS: Record<string, string> = {
  "alicante": "Alicante",
  "valencia": "Valencia",
  "castellon": "CastellÃ³n",
  "murcia": "Murcia",
  "albacete": "Albacete",
  "ciudad real": "Ciudad Real",
  "cuenca": "Cuenca",
  "guadalajara": "Guadalajara",
  "toledo": "Toledo",
  "almeria": "AlmerÃ­a",
  "granada": "Granada",
  "jaen": "JaÃ©n",
  "malaga": "MÃ¡laga",
  "cordoba": "CÃ³rdoba",
  "sevilla": "Sevilla",
  "huelva": "Huelva",
  "cadiz": "CÃ¡diz",
  "huesca": "Huesca",
  "zaragoza": "Zaragoza",
  "teruel": "Teruel",
  "barcelona": "Barcelona",
  "girona": "Girona",
  "tarragona": "Tarragona",
  "lleida": "Lleida",
  "mallorca": "Mallorca",
  "menorca": "Menorca",
  "ibiza": "Ibiza",
  "las palmas": "Las Palmas",
  "santa cruz de tenerife": "Santa Cruz de Tenerife",
  "madrid": "Madrid",
  "vizcaya": "Bizkaia",
  "gipuzkoa": "Gipuzkoa",
  "alava": "Ãlava",
  "navarra": "Navarra",
  "asturias": "Asturias",
  "cantabria": "Cantabria",
  "a coruna": "A CoruÃ±a",
  "lugo": "Lugo",
  "ourense": "Ourense",
  "pontevedra": "Pontevedra",
  "la rioja": "La Rioja",
  "caceres": "CÃ¡ceres",
  "badajoz": "Badajoz",
  "leon": "LeÃ³n",
  "zamora": "Zamora",
  "salamanca": "Salamanca",
  "valladolid": "Valladolid",
  "palencia": "Palencia",
  "burgos": "Burgos",
  "soria": "Soria",
  "avila": "Ãvila",
  "segovia": "Segovia",
  "ceuta": "Ceuta",
  "melilla": "Melilla",
};

/**
 * Re-export eliminado: `provinceLabels` ahora vive en
 * `@/lib/seo/province-labels` para que pueda importarse desde
 * app/ sin arrastrar el handler de Convex al bundle de Next.
 * `PROVINCE_LABELS` (const interna) sigue siendo necesario para
 * `listProvinceHubsForSeo`.
 */

/**
 * Lista todas las provincias con al menos 1 carrera publicada,
 * junto con el contador y la fecha de la prÃ³xima carrera futura.
 * Para landings /carreras/{provincia} y para la home (menÃº CCAA).
 */
export const listProvinceHubsForSeo = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().slice(0, 10);
    const races = await ctx.db
      .query("races")
      .withIndex("by_published_date")
      .filter((q) => q.eq(q.field("isPublished"), true))
      .collect();

    const acc: Record<
      string,
      { province: string; total: number; upcoming: number; nextDate?: string }
    > = {};
    for (const r of races) {
      if (!r.province) continue;
      const a = (acc[r.province] ??= {
        province: r.province,
        total: 0,
        upcoming: 0,
        nextDate: undefined,
      });
      a.total++;
      if (r.startDate && r.startDate >= today) {
        a.upcoming++;
        if (!a.nextDate || r.startDate < a.nextDate) a.nextDate = r.startDate;
      }
    }
    return Object.values(acc)
      .map((a) => ({
        ...a,
        label: PROVINCE_LABELS[a.province] ?? a.province,
        slug: a.province,
      }))
      .sort((a, b) => b.total - a.total);
  },
});

/**
 * Carreras publicadas en una provincia concreta, ordenadas por fecha asc.
 * Usado por /carreras/{provincia}.
 */
export const listByProvinceForSeo = query({
  args: {
    province: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { province, limit }) => {
    const n = limit ?? 60;
    const today = new Date().toISOString().slice(0, 10);
    const races = await ctx.db
      .query("races")
      .withIndex("by_province", (q) => q.eq("province", province as any))
      .filter((q) => q.eq(q.field("isPublished"), true))
      .collect();

    return races
      .map((r) => ({
        slug: r.slug,
        name: r.name,
        locality: r.locality,
        province: r.province,
        startDate: r.startDate,
        distanceKm: r.distanceKm,
        raceType: r.raceType,
      }))
      .filter((r) => !r.startDate || r.startDate >= today)
      .sort((a, b) =>
        !a.startDate ? 1 : !b.startDate ? -1 : a.startDate < b.startDate ? -1 : 1,
      )
      .slice(0, n);
  },
});

/**
 * CategorÃ­as de distancia con carreras publicadas y la prÃ³xima fecha.
 * Para landings /carreras/{distancia}.
 */
const DISTANCE_HUBS = [
  { slug: "5k", label: "5K", minKm: 0, maxKm: 7.5 },
  { slug: "10k", label: "10K", minKm: 7.5, maxKm: 12.5 },
  { slug: "media-maraton", label: "Media maratÃ³n", minKm: 17.5, maxKm: 23 },
  { slug: "maraton", label: "MaratÃ³n", minKm: 40, maxKm: 44 },
  { slug: "trail", label: "Trail", minKm: 12, maxKm: 200 },
  { slug: "ultra", label: "UltramaratÃ³n", minKm: 44, maxKm: 1000 },
] as const;

export type DistanceHub = (typeof DISTANCE_HUBS)[number];
export const distanceHubs: DistanceHub[] = [...DISTANCE_HUBS] as unknown as DistanceHub[];

function raceInDistanceBucket(distanceKm: number, bucket: DistanceHub): boolean {
  if (bucket.slug === "trail") {
    return distanceKm >= 12 && distanceKm <= 200;
  }
  if (bucket.slug === "ultra") {
    return distanceKm >= 44 && distanceKm <= 1000;
  }
  return distanceKm >= bucket.minKm && distanceKm < bucket.maxKm;
}

export const listDistanceHubsForSeo = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().slice(0, 10);
    const races = await ctx.db
      .query("races")
      .withIndex("by_published_date")
      .filter((q) => q.eq(q.field("isPublished"), true))
      .collect();

    const acc: Record<
      string,
      { slug: string; label: string; total: number; upcoming: number; nextDate?: string }
    > = {};
    for (const b of DISTANCE_HUBS) {
      acc[b.slug] = { slug: b.slug, label: b.label, total: 0, upcoming: 0, nextDate: undefined };
    }
    for (const r of races) {
      for (const b of DISTANCE_HUBS) {
        if (raceInDistanceBucket(r.distanceKm, b)) {
          const a = acc[b.slug];
          a.total++;
          if (r.startDate && r.startDate >= today) {
            a.upcoming++;
            if (!a.nextDate || r.startDate < a.nextDate) a.nextDate = r.startDate;
          }
          break;
        }
      }
    }
    return Object.values(acc);
  },
});

/**
 * Carreras por distancia. Devuelve futuras primero, total cap n.
 */
export const listByDistanceForSeo = query({
  args: {
    slug: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { slug, limit }) => {
    const n = limit ?? 60;
    const today = new Date().toISOString().slice(0, 10);
    const bucket = DISTANCE_HUBS.find((b) => b.slug === slug);
    if (!bucket) return [];

    const races = await ctx.db
      .query("races")
      .withIndex("by_published_date")
      .filter((q) => q.eq(q.field("isPublished"), true))
      .collect();

    return races
      .filter((r) => raceInDistanceBucket(r.distanceKm, bucket))
      .map((r) => ({
        slug: r.slug,
        name: r.name,
        locality: r.locality,
        province: r.province,
        startDate: r.startDate,
        distanceKm: r.distanceKm,
        raceType: r.raceType,
      }))
      .filter((r) => !r.startDate || r.startDate >= today)
      .sort((a, b) =>
        !a.startDate ? 1 : !b.startDate ? -1 : a.startDate < b.startDate ? -1 : 1,
      )
      .slice(0, n);
  },
});

/**
 * Carreras por provincia + distancia (combinado, para SEO long-tail).
 * Ej: /carreras/valencia/maraton
 */
export const listByProvinceDistanceForSeo = query({
  args: {
    province: v.string(),
    distanceSlug: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { province, distanceSlug, limit }) => {
    const n = limit ?? 30;
    const today = new Date().toISOString().slice(0, 10);
    const bucket = DISTANCE_HUBS.find((b) => b.slug === distanceSlug);
    if (!bucket) return [];

    const races = await ctx.db
      .query("races")
      .withIndex("by_province", (q) => q.eq("province", province as any))
      .filter((q) => q.eq(q.field("isPublished"), true))
      .collect();

    return races
      .filter((r) => raceInDistanceBucket(r.distanceKm, bucket))
      .map((r) => ({
        slug: r.slug,
        name: r.name,
        locality: r.locality,
        province: r.province,
        startDate: r.startDate,
        distanceKm: r.distanceKm,
        raceType: r.raceType,
      }))
      .filter((r) => !r.startDate || r.startDate >= today)
      .sort((a, b) =>
        !a.startDate ? 1 : !b.startDate ? -1 : a.startDate < b.startDate ? -1 : 1,
      )
      .slice(0, n);
  },
});



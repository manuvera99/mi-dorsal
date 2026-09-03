// =============================================================================
// mi-dorsal — Data Sources (RFEA, FEDME, ITRA, Sportmaniacs, Runedia, manual)
// =============================================================================
// Admin: listar, ver, actualizar status, re-sincronizar.
// =============================================================================

import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireAdmin, getOptionalUser } from "./_helpers";

// Scrape command names (deben coincidir con scripts/ingest-*.ts)
export const SCRAPER_SCRIPTS: Record<string, string> = {
  rfea: "ingest:rfea",
  fedme: "ingest:fedme",
  itra: "ingest:itra",
  sportmaniacs: "ingest:sportmaniacs",
  runedia: "ingest:runedia",
  all: "ingest:all",
};

/**
 * Lista todas las fuentes de datos (admin).
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const sources = await ctx.db.query("dataSources").collect();
    // Enrich con # de carreras por fuente
    const result = await Promise.all(
      sources.map(async (s) => {
        const racesCount = await ctx.db
          .query("races")
          .withIndex("by_data_source", (q) => q.eq("dataSourceId", s._id))
          .collect();
        return { ...s, currentRaceCount: racesCount.length };
      }),
    );
    return result.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Lista todas las fuentes (público, sin auth) — solo nombre y status,
 * para mostrar badges en la UI.
 */
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const sources = await ctx.db.query("dataSources").collect();
    return sources.map((s) => ({
      _id: s._id,
      name: s.name,
      slug: s.slug,
      type: s.type,
      status: s.status,
      lastSyncAt: s.lastSyncAt,
      lastSyncError: s.lastSyncError,
    }));
  },
});

/**
 * Obtiene detalle de una fuente + últimas 20 sincronizaciones.
 */
export const get = query({
  args: { id: v.id("dataSources") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const source = await ctx.db.get(id);
    if (!source) return null;
    const history = await ctx.db
      .query("syncHistory")
      .withIndex("by_data_source", (q) => q.eq("dataSourceId", id))
      .order("desc")
      .take(20);
    return { source, history };
  },
});

/**
 * Crea una nueva fuente de datos (admin).
 */
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    type: v.union(v.literal("scraper"), v.literal("api"), v.literal("manual")),
    description: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
    config: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Evitar duplicados por slug
    const existing = await ctx.db
      .query("dataSources")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) throw new Error(`Ya existe una fuente con slug "${args.slug}"`);
    return await ctx.db.insert("dataSources", {
      ...args,
      status: "active",
      totalRaces: 0,
      totalSyncs: 0,
    });
  },
});

/**
 * Actualiza una fuente (admin).
 */
export const update = mutation({
  args: {
    id: v.id("dataSources"),
    patch: v.object({
      name: v.optional(v.string()),
      description: v.optional(v.string()),
      baseUrl: v.optional(v.string()),
      status: v.optional(v.union(v.literal("active"), v.literal("paused"), v.literal("error"))),
      config: v.optional(v.any()),
    }),
  },
  handler: async (ctx, { id, patch }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(id, patch);
    return id;
  },
});

/**
 * Cambia el status de una fuente (pausar/activar).
 */
export const setStatus = mutation({
  args: {
    id: v.id("dataSources"),
    status: v.union(v.literal("active"), v.literal("paused"), v.literal("error")),
  },
  handler: async (ctx, { id, status }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(id, { status });
    return id;
  },
});

/**
 * Seed inicial: crea las 5 fuentes estándar si no existen.
 * Idempotente — se puede llamar múltiples veces.
 */
export const seedDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const defaults = [
      { name: "RFEA", slug: "rfea", type: "scraper" as const, description: "Real Federación Española de Atletismo — calendario oficial", baseUrl: "https://www.rfea.es" },
      { name: "FEDME", slug: "fedme", type: "scraper" as const, description: "Federación Española de Deportes de Montaña y Escalada", baseUrl: "https://www.fedme.es" },
      { name: "ITRA", slug: "itra", type: "scraper" as const, description: "International Trail Running Association — carreras con puntos ITRA", baseUrl: "https://itra.run" },
      { name: "Sportmaniacs", slug: "sportmaniacs", type: "scraper" as const, description: "Plataforma popular de carreras en España (typeahead, sin API pública)", baseUrl: "https://sportmaniacs.com" },
      { name: "Runedia", slug: "runedia", type: "scraper" as const, description: "Calendario popular de carreras populares en España (anti-bot)", baseUrl: "https://runedia.es" },
      { name: "Manual", slug: "manual", type: "manual" as const, description: "Carreras añadidas a mano por el admin desde el panel" },
    ];
    const results: Array<{ slug: string; id: Id<"dataSources">; created: boolean }> = [];
    for (const d of defaults) {
      const existing = await ctx.db
        .query("dataSources")
        .withIndex("by_slug", (q) => q.eq("slug", d.slug))
        .unique();
      if (existing) {
        results.push({ slug: d.slug, id: existing._id, created: false });
      } else {
        const id = await ctx.db.insert("dataSources", { ...d, status: "active", totalRaces: 0, totalSyncs: 0 });
        results.push({ slug: d.slug, id, created: true });
      }
    }
    return results;
  },
});

/**
 * Marca el inicio de una sincronización (admin la llama antes de ejecutar el scraper).
 * Devuelve el ID del sync history entry.
 */
export const startSync = mutation({
  args: { dataSourceId: v.id("dataSources") },
  handler: async (ctx, { dataSourceId }) => {
    await requireAdmin(ctx);
    const profile = await getOptionalUser(ctx);
    const syncId = await ctx.db.insert("syncHistory", {
      dataSourceId,
      startedAt: Date.now(),
      status: "running",
      triggeredBy: profile?._id ? `admin:${profile._id}` : "admin:unknown",
    });
    // Update source status a "running" (no tenemos un literal "running" en status, lo dejamos como active)
    await ctx.db.patch(dataSourceId, { status: "active" });
    return syncId;
  },
});

/**
 * Marca el fin de una sincronización (admin la llama después).
 */
export const finishSync = mutation({
  args: {
    syncId: v.id("syncHistory"),
    dataSourceId: v.id("dataSources"),
    status: v.union(v.literal("success"), v.literal("error")),
    raceCount: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { syncId, dataSourceId, status, raceCount, error }) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const sync = await ctx.db.get(syncId);
    if (!sync) return;
    const durationMs = now - sync.startedAt;

    await ctx.db.patch(syncId, {
      finishedAt: now,
      durationMs,
      status,
      raceCount,
      error,
    });

    // Update source stats
    const source = await ctx.db.get(dataSourceId);
    if (source) {
      // Contar carreras actuales con esta fuente
      const races = await ctx.db
        .query("races")
        .withIndex("by_data_source", (q) => q.eq("dataSourceId", dataSourceId))
        .collect();
      await ctx.db.patch(dataSourceId, {
        lastSyncAt: now,
        lastSyncDurationMs: durationMs,
        lastSyncRaceCount: raceCount,
        lastSyncError: error,
        totalRaces: races.length,
        totalSyncs: (source.totalSyncs ?? 0) + 1,
        status: status === "success" ? "active" : "error",
      });
    }
    return syncId;
  },
});

/**
 * Migra carreras existentes: vincula las que ya están en BBDD a su fuente
 * (basándose en el campo scraperAdapter que ya tienen).
 * Idempotente — solo actualiza carreras sin dataSourceId.
 */
export const migrateRacesToSources = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    // Map de adapter → dataSource slug
    const sources = await ctx.db.query("dataSources").collect();
    const bySlug = new Map(sources.map((s) => [s.slug, s._id]));
    const byName = new Map(
      sources.map((s) => [s.name.toLowerCase(), s._id]),
    );

    const races = await ctx.db
      .query("races")
      .filter((q) => q.eq(q.field("dataSourceId"), undefined))
      .collect();

    let updated = 0;
    for (const race of races) {
      const adapter = (race as any).scraperAdapter?.toLowerCase();
      if (!adapter) continue;
      // Buscar por slug o por nombre
      let sourceId = bySlug.get(adapter);
      if (!sourceId) {
        // "rfea" → "RFEA", etc.
        sourceId = byName.get(adapter);
      }
      if (sourceId) {
        await ctx.db.patch(race._id, { dataSourceId: sourceId });
        updated++;
      }
    }
    return { scanned: races.length, updated };
  },
});

// ============================================================================
// SYSTEM MUTATIONS — usadas por la API route /api/scrape/[source].
// No requieren auth (la API route verifica con Clerk).
// La API route es el gatekeeper: solo admins pueden llamarla.
// ============================================================================

/**
 * Versión system de startSync (sin requireAdmin) para usar desde la API route.
 */
export const systemStartSync = mutation({
  args: { dataSourceId: v.id("dataSources") },
  handler: async (ctx, { dataSourceId }) => {
    const syncId = await ctx.db.insert("syncHistory", {
      dataSourceId,
      startedAt: Date.now(),
      status: "running",
      triggeredBy: "system:api-route",
    });
    await ctx.db.patch(dataSourceId, { status: "active" });
    return syncId;
  },
});

/**
 * Versión system de seedDefaults — crea las 5 fuentes estándar sin auth.
 */
export const systemSeedDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const defaults = [
      { name: "RFEA", slug: "rfea", type: "scraper" as const, description: "Real Federación Española de Atletismo — calendario oficial", baseUrl: "https://www.rfea.es" },
      { name: "FEDME", slug: "fedme", type: "scraper" as const, description: "Federación Española de Deportes de Montaña y Escalada", baseUrl: "https://www.fedme.es" },
      { name: "ITRA", slug: "itra", type: "scraper" as const, description: "International Trail Running Association — carreras con puntos ITRA", baseUrl: "https://itra.run" },
      { name: "Sportmaniacs", slug: "sportmaniacs", type: "scraper" as const, description: "Plataforma popular de carreras en España (typeahead, sin API pública)", baseUrl: "https://sportmaniacs.com" },
      { name: "Runedia", slug: "runedia", type: "scraper" as const, description: "Calendario popular de carreras populares en España (anti-bot)", baseUrl: "https://runedia.es" },
      { name: "Manual", slug: "manual", type: "manual" as const, description: "Carreras añadidas a mano por el admin desde el panel" },
    ];
    const results: Array<{ slug: string; id: Id<"dataSources">; created: boolean }> = [];
    for (const d of defaults) {
      const existing = await ctx.db
        .query("dataSources")
        .withIndex("by_slug", (q) => q.eq("slug", d.slug))
        .unique();
      if (existing) {
        results.push({ slug: d.slug, id: existing._id, created: false });
      } else {
        const id = await ctx.db.insert("dataSources", { ...d, status: "active", totalRaces: 0, totalSyncs: 0 });
        results.push({ slug: d.slug, id, created: true });
      }
    }
    return results;
  },
});

/**
 * Versión system de migrateRacesToSources.
 */
export const systemMigrateRacesToSources = mutation({
  args: {},
  handler: async (ctx) => {
    const sources = await ctx.db.query("dataSources").collect();
    const bySlug = new Map(sources.map((s) => [s.slug, s._id]));
    const byName = new Map(sources.map((s) => [s.name.toLowerCase(), s._id]));

    const races = await ctx.db
      .query("races")
      .filter((q) => q.eq(q.field("dataSourceId"), undefined))
      .collect();

    let updated = 0;
    for (const race of races) {
      const adapter = (race as any).scraperAdapter?.toLowerCase();
      if (!adapter) continue;
      let sourceId = bySlug.get(adapter);
      if (!sourceId) sourceId = byName.get(adapter);
      if (sourceId) {
        await ctx.db.patch(race._id, { dataSourceId: sourceId });
        updated++;
      }
    }
    return { scanned: races.length, updated };
  },
});

/**
 * Versión system de finishSync.
 */
export const systemFinishSync = mutation({
  args: {
    syncId: v.id("syncHistory"),
    dataSourceId: v.id("dataSources"),
    status: v.union(v.literal("success"), v.literal("error")),
    raceCount: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { syncId, dataSourceId, status, raceCount, error }) => {
    const now = Date.now();
    const sync = await ctx.db.get(syncId);
    if (!sync) return;
    const durationMs = now - sync.startedAt;

    await ctx.db.patch(syncId, {
      finishedAt: now,
      durationMs,
      status,
      raceCount,
      error,
    });

    const source = await ctx.db.get(dataSourceId);
    if (source) {
      const races = await ctx.db
        .query("races")
        .withIndex("by_data_source", (q) => q.eq("dataSourceId", dataSourceId))
        .collect();
      await ctx.db.patch(dataSourceId, {
        lastSyncAt: now,
        lastSyncDurationMs: durationMs,
        lastSyncRaceCount: raceCount,
        lastSyncError: error,
        totalRaces: races.length,
        totalSyncs: (source.totalSyncs ?? 0) + 1,
        status: status === "success" ? "active" : "error",
      });
    }
    return syncId;
  },
});

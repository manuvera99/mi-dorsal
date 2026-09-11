// =============================================================================
// mi-dorsal — Data Sources (RFEA, FEDME, ITRA, Sportmaniacs, Runedia, manual)
// =============================================================================
// Admin: listar, ver, actualizar status, re-sincronizar.
// =============================================================================

import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireAdmin, getOptionalUser } from "./_helpers";
import { internal } from "./_generated/api";

// Scrape command names (deben coincidir con scripts/ingest-*.ts y scripts/scrape-*.ts)
export const SCRAPER_SCRIPTS: Record<string, string> = {
  rfea: "ingest:rfea",
  fedme: "ingest:fedme",
  itra: "ingest:itra",
  sportmaniacs: "ingest:sportmaniacs",
  runedia: "ingest:runedia",
  correbirras: "ingest:correbirras",
  chiplevante: "ingest:chiplevante",
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
 * Resumen para los KPIs del panel /admin/races: cuántas carreras hay en
 * total y cuántas se crearon en la última sincronización de cada fuente
 * (suma de `lastSyncCreatedCount` de las 7 fuentes — no la ejecución
 * completa del cron como concepto aparte, ya que no existe una fila que
 * agrupe todas las fuentes de una misma corrida; ver auditoría 2026-09-11).
 * `totalRaces` es el conteo real de la tabla `races` (no la suma
 * denormalizada por fuente, que puede quedar desactualizada si alguna
 * sync no se registró — ver `dataSources.totalRaces`).
 */
export const getIngestSummary = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [races, sources] = await Promise.all([
      ctx.db.query("races").collect(),
      ctx.db.query("dataSources").collect(),
    ]);
    const newInLastRun = sources.reduce(
      (sum, s) => sum + (s.lastSyncCreatedCount ?? 0),
      0,
    );
    const mostRecentSyncAt = sources.reduce(
      (max, s) => Math.max(max, s.lastSyncAt ?? 0),
      0,
    );
    return {
      totalRaces: races.length,
      newInLastRun,
      mostRecentSyncAt: mostRecentSyncAt || undefined,
    };
  },
});

/**
 * Lista todas las fuentes (público, sin auth) — nombre, status y baseUrl,
 * para mostrar badges (con o sin enlace) en la UI.
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
      baseUrl: s.baseUrl,
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
 * systemCreate: crea una fuente sin auth requerida (para uso de scripts CLI).
 * Si ya existe una con el mismo slug, la devuelve sin error.
 */
export const systemCreate = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    type: v.union(v.literal("scraper"), v.literal("api"), v.literal("manual")),
    description: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
    config: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dataSources")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) return existing._id;
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
      { name: "Sportmaniacs", slug: "sportmaniacs", type: "api" as const, description: "Plataforma de inscripciones deportivas — API REST pública con 25.000+ carreras (api-aws.sportmaniacs.com)", baseUrl: "https://sportmaniacs.com" },
      { name: "Runedia", slug: "runedia", type: "scraper" as const, description: "Calendario popular de carreras populares en España (anti-bot)", baseUrl: "https://runedia.es" },
      { name: "Agenda Sureste", slug: "correbirras", type: "scraper" as const, description: "Agenda de carreras populares del sureste peninsular (datos vía Supabase REST)", baseUrl: "https://www.correbirras.com" },
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
    createdCount: v.optional(v.number()),
    updatedCount: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { syncId, dataSourceId, status, raceCount, createdCount, updatedCount, error }) => {
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
      createdCount,
      updatedCount,
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
        lastSyncCreatedCount: createdCount,
        lastSyncUpdatedCount: updatedCount,
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
      { name: "Sportmaniacs", slug: "sportmaniacs", type: "api" as const, description: "Plataforma de inscripciones deportivas — API REST pública con 25.000+ carreras (api-aws.sportmaniacs.com)", baseUrl: "https://sportmaniacs.com" },
      { name: "Runedia", slug: "runedia", type: "scraper" as const, description: "Calendario popular de carreras populares en España (anti-bot)", baseUrl: "https://runedia.es" },
      { name: "Agenda Sureste", slug: "correbirras", type: "scraper" as const, description: "Agenda de carreras populares del sureste peninsular (datos vía Supabase REST)", baseUrl: "https://www.correbirras.com" },
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
    createdCount: v.optional(v.number()),
    updatedCount: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { syncId, dataSourceId, status, raceCount, createdCount, updatedCount, error }) => {
    const now = Date.now();
    const sync = await ctx.db.get(syncId);
    if (!sync) return;
    const durationMs = now - sync.startedAt;

    await ctx.db.patch(syncId, {
      finishedAt: now,
      durationMs,
      status,
      raceCount,
      createdCount,
      updatedCount,
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
        lastSyncCreatedCount: createdCount,
        lastSyncUpdatedCount: updatedCount,
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
 * systemUpdate: actualiza campos de una fuente sin auth (para uso de scripts CLI).
 * Util para migraciones como cambiar el type de scraper -> api cuando una fuente
 * descubre que tiene API REST disponible.
 */
export const systemUpdate = mutation({
  args: {
    id: v.id("dataSources"),
    patch: v.object({
      name: v.optional(v.string()),
      type: v.optional(v.union(v.literal("scraper"), v.literal("api"), v.literal("manual"))),
      description: v.optional(v.string()),
      baseUrl: v.optional(v.string()),
      status: v.optional(v.union(v.literal("active"), v.literal("paused"), v.literal("error"))),
      config: v.optional(v.any()),
    }),
  },
  handler: async (ctx, { id, patch }) => {
    await ctx.db.patch(id, patch);
    return id;
  },
});

/**
 * recordIngestSync: registra el resultado de un sync hecho por un script
 * CLI (scripts/ingest-to-convex.ts y los scrapers individuales).
 *
 * El script llama a esta mutation una vez por fuente al final del ingest,
 * con el conteo de carreras subidas y la duración. Crea una fila en
 * `syncHistory` y actualiza `dataSources.lastSyncAt`, `totalSyncs++`,
 * `lastSyncRaceCount` y `lastSyncDurationMs`.
 *
 * Sin auth: los scripts no tienen sesión de Clerk. La seguridad se basa
 * en que solo se ejecuta desde la GitHub Action (con sus secrets) o
 * desde la terminal del admin con `CONVEX_DEPLOY_KEY` configurado.
 *
 * Idempotente solo en el sentido de que se puede llamar varias veces y
 * cada llamada genera una entrada nueva en syncHistory (eso es lo que
 * queremos para tener trazabilidad por ejecución).
 *
 * Uso desde el script:
 *   await client.mutation(api.dataSources.recordIngestSync, {
 *     dataSourceSlug: "rfea",
 *     raceCount: 123,
 *     createdCount: 20,
 *     updatedCount: 103,
 *     durationMs: 4500,
 *     status: "success",
 *     triggeredBy: "github-action-daily-ingest",
 *   });
 */
export const recordIngestSync = mutation({
  args: {
    dataSourceSlug: v.string(),
    raceCount: v.number(),
    createdCount: v.optional(v.number()),
    updatedCount: v.optional(v.number()),
    durationMs: v.number(),
    status: v.union(v.literal("success"), v.literal("error")),
    triggeredBy: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Buscar la fuente por slug
    const source = await ctx.db
      .query("dataSources")
      .withIndex("by_slug", (q) => q.eq("slug", args.dataSourceSlug))
      .unique();

    if (!source) {
      // No abortamos — la fuente puede no existir todavía (ej. una nueva
      // añadida al dataSources por el script). Solo logueamos el warning.
      console.warn(
        `[recordIngestSync] dataSource con slug "${args.dataSourceSlug}" no existe`,
      );
      return { ok: false, reason: "source_not_found" as const };
    }

    const now = Date.now();
    const triggeredBy = args.triggeredBy ?? "script:unknown";

    // Crear entrada en syncHistory
    const syncId = await ctx.db.insert("syncHistory", {
      dataSourceId: source._id,
      startedAt: now - args.durationMs, // estimación: arrancó hace durationMs
      finishedAt: now,
      durationMs: args.durationMs,
      status: args.status,
      raceCount: args.raceCount,
      createdCount: args.createdCount,
      updatedCount: args.updatedCount,
      error: args.error,
      triggeredBy,
    });

    // Actualizar contadores de la fuente
    await ctx.db.patch(source._id, {
      lastSyncAt: now,
      lastSyncDurationMs: args.durationMs,
      lastSyncRaceCount: args.raceCount,
      lastSyncCreatedCount: args.createdCount,
      lastSyncUpdatedCount: args.updatedCount,
      lastSyncError: args.error,
      totalSyncs: (source.totalSyncs ?? 0) + 1,
      status: args.status === "success" ? "active" : "error",
    });

    return { ok: true, syncId, dataSourceId: source._id };
  },
});

/**
 * getDataSourceIdBySlug: resuelve slug → id. Lo usa el script
 * ingest-to-convex para pasar el `dataSourceId` correcto a `systemUpsert`.
 * Sin auth: solo lee un índice por slug, no expone nada sensible.
 */
export const getDataSourceIdBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const source = await ctx.db
      .query("dataSources")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    return source?._id ?? null;
  },
});

// ============================================================================
// RESUMEN POR EMAIL — se envía al terminar el ingest nocturno completo
// (llamado por scripts/ingest-to-convex.ts, que es el último paso que
// registra sync en la ejecución del workflow daily-ingest.yml).
// ============================================================================

const TYPE_LABELS_INGEST = {
  success: { label: "OK", emoji: "✅", color: "#16a34a" },
  error: { label: "Con errores", emoji: "⚠️", color: "#dc2626" },
} as const;

function escapeHtmlIngest(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * sendIngestSummaryEmail: envía al admin un resumen de TODA la ejecución
 * nocturna del ingest — no solo la parte que ve el caller. Lee el estado
 * de "última sync" de las 7 fuentes directamente de `dataSources` (mismo
 * dato que ya usa getIngestSummary para el KPI del panel), en vez de que
 * el caller le pase sus propios números: así el email cubre también
 * Sportmaniacs/Agenda Sureste, que corren en pasos anteriores del mismo
 * workflow y no son visibles para scripts/ingest-to-convex.ts (que solo
 * procesa RFEA/FEDME/ITRA/Runedia).
 *
 * Se llama al final del workflow daily-ingest.yml (tras el step de
 * ingest-to-convex, que es el último que registra sync). Sin auth: mismo
 * modelo de seguridad que recordIngestSync — solo se ejecuta desde la
 * GitHub Action o la terminal del admin con CONVEX_DEPLOY_KEY.
 *
 * Reutiliza internal.emails.sendEmail.sendEmail, el mismo mecanismo que
 * ya usa convex/feedback.ts para notificar al admin — no se introduce
 * ninguna infraestructura de email nueva.
 */
export const sendIngestSummaryEmail = mutation({
  args: {
    totalDurationMs: v.optional(v.number()),
  },
  handler: async (ctx, { totalDurationMs }) => {
    const [races, sources] = await Promise.all([
      ctx.db.query("races").collect(),
      ctx.db.query("dataSources").collect(),
    ]);

    const perSource = sources
      .map((s) => ({
        name: s.name,
        created: s.lastSyncCreatedCount ?? 0,
        updated: s.lastSyncUpdatedCount ?? 0,
        hasError: !!s.lastSyncError,
        error: s.lastSyncError,
      }))
      .filter((p) => p.created + p.updated > 0 || p.hasError);

    const totalCreated = perSource.reduce((s, p) => s + p.created, 0);
    const totalUpdated = perSource.reduce((s, p) => s + p.updated, 0);
    const sourcesWithError = perSource.filter((p) => p.hasError);
    const status = sourcesWithError.length > 0 ? "error" : "success";
    const typeInfo = TYPE_LABELS_INGEST[status];

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.mi-dorsal.com";
    const adminUrl = `${baseUrl}/admin/races`;

    const rows = perSource
      .sort((a, b) => b.created - a.created)
      .map(
        (p) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e7e5e4;font-size:13px;">${escapeHtmlIngest(p.name)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e7e5e4;font-size:13px;text-align:right;color:#16a34a;">${p.created}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e7e5e4;font-size:13px;text-align:right;color:#78716c;">${p.updated}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e7e5e4;font-size:13px;${p.hasError ? "color:#dc2626;font-weight:600;" : "color:#a8a29e;"}">${p.hasError ? escapeHtmlIngest(p.error ?? "error") : "—"}</td>
      </tr>`,
      )
      .join("");

    const durationLine =
      totalDurationMs !== undefined
        ? `<p style="margin:16px 0 0;font-size:12px;color:#a8a29e;">Duración: ${(totalDurationMs / 1000).toFixed(1)}s</p>`
        : "";

    const html = `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fafaf9;padding:24px;color:#0a0a0a;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e7e5e4;">
    <div style="background:${typeInfo.color};color:#fff;padding:16px 20px;">
      <h1 style="margin:0;font-size:18px;">${typeInfo.emoji} Ingest de carreras: ${typeInfo.label}</h1>
    </div>
    <div style="padding:20px;">
      <p style="margin:0 0 12px;font-size:14px;color:#1c1917;">
        <strong>${totalCreated}</strong> carreras nuevas · <strong>${totalUpdated}</strong> actualizadas
        ${sourcesWithError.length > 0 ? `· <strong style="color:#dc2626;">${sourcesWithError.length} fuente${sourcesWithError.length === 1 ? "" : "s"} con error</strong>` : ""}
        · ${races.length} carreras totales en catálogo.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
        <thead>
          <tr>
            <th style="padding:6px 10px;text-align:left;font-size:11px;color:#78716c;text-transform:uppercase;">Fuente</th>
            <th style="padding:6px 10px;text-align:right;font-size:11px;color:#78716c;text-transform:uppercase;">Nuevas</th>
            <th style="padding:6px 10px;text-align:right;font-size:11px;color:#78716c;text-transform:uppercase;">Act.</th>
            <th style="padding:6px 10px;text-align:left;font-size:11px;color:#78716c;text-transform:uppercase;">Error</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${durationLine}
      <a href="${adminUrl}" style="display:inline-block;margin-top:16px;background:#0a0a0a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Ver panel de carreras →</a>
    </div>
  </div>
</body></html>`;

    const text = `${typeInfo.emoji} Ingest de carreras: ${typeInfo.label}

${totalCreated} nuevas · ${totalUpdated} actualizadas${sourcesWithError.length > 0 ? ` · ${sourcesWithError.length} fuentes con error` : ""} · ${races.length} carreras totales.

${perSource
  .map((p) => `  ${p.name}: +${p.created} nuevas, ${p.updated} actualizadas${p.hasError ? ` — ERROR: ${p.error}` : ""}`)
  .join("\n")}
${totalDurationMs !== undefined ? `\nDuración: ${(totalDurationMs / 1000).toFixed(1)}s` : ""}
Ver panel: ${adminUrl}`;

    await ctx.scheduler.runAfter(0, internal.emails.sendEmail.sendEmail, {
      to: process.env.ADMIN_NOTIFICATION_EMAIL || "hola@mi-dorsal.com",
      subject: `${typeInfo.emoji} Ingest de carreras: +${totalCreated} nuevas${sourcesWithError.length > 0 ? ` (${sourcesWithError.length} errores)` : ""}`,
      html,
      text,
    });

    return { ok: true, totalCreated, totalUpdated, errorCount: sourcesWithError.length };
  },
});
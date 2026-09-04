// =============================================================================
// mi-dorsal — Stats cache
// =============================================================================
// Denormaliza los contadores del admin dashboard / public stats en una sola
// fila de la tabla `statsCache` para no tener que hacer .collect() sobre
// todas las tablas en cada carga (quemaba el límite de 1GB/mes de Database
// I/O en plan free).
//
// Estrategia:
// - recalcStats() (mutation) hace UN barrido de las tablas grandes y guarda
//   el resultado en statsCache.
// - getCachedStats() (query) lee 1 sola fila (~200 bytes).
// - Un cron (convex/crons/recalcStats.ts) llama recalcStats() cada 5 min.
// - Los scripts de ingest también pueden llamarlo manualmente tras ingestar
//   para mantener la coherencia sin esperar al cron.
// =============================================================================

import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

/**
 * Recalcula todos los contadores y los guarda en statsCache.
 * Es una mutation "internal" — solo se puede llamar desde el backend
 * (cron, scripts, otras mutations). No está expuesta al cliente.
 */
export const recalcStats = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Barrido único por tabla. Promise.all para paralelizar.
    // Esto SÍ consume I/O — pero solo corre 1 vez cada 5 min en lugar de
    // 1 vez por cada carga del admin.
    const [
      races,
      profiles,
      votes,
      ratings,
      myRaces,
      prs,
      notifications,
    ] = await Promise.all([
      ctx.db.query("races").collect(),
      ctx.db.query("profiles").collect(),
      ctx.db.query("raceVotes").collect(),
      ctx.db.query("raceRatings").collect(),
      ctx.db.query("myRaces").collect(),
      ctx.db.query("personalRecords").collect(),
      ctx.db.query("notificationLog").collect(),
    ]);

    let published = 0;
    let featured = 0;
    const byProvince: Record<string, number> = {};
    for (const r of races) {
      if (r.isPublished) published++;
      if (r.isFeatured) featured++;
      if (r.province) {
        byProvince[r.province] = (byProvince[r.province] ?? 0) + 1;
      }
    }

    let admins = 0;
    for (const p of profiles) {
      if (p.role === "admin") admins++;
    }

    const payload = {
      key: "global",
      computedAt: Date.now(),
      totalRaces: races.length,
      publishedRaces: published,
      featuredRaces: featured,
      totalUsers: profiles.length,
      adminUsers: admins,
      totalVotes: votes.length,
      totalRatings: ratings.length,
      totalMyRaces: myRaces.length,
      totalPRs: prs.length,
      totalNotifications: notifications.length,
      racesByProvince: byProvince,
    };

    // Upsert: si la fila ya existe, update; si no, insert.
    const existing = await ctx.db
      .query("statsCache")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("statsCache", payload);
    }

    return payload;
  },
});

/**
 * Wrapper público para que scripts/admin puedan forzar un recálculo
 * (no expone datos, solo ejecuta la mutation interna).
 */
export const forceRecalc = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Re-llama a recalcStats vía el runner interno
    const { recalcStats } = await import("./stats");
    return await ctx.runMutation(recalcStats, {});
  },
});

/**
 * Query principal — llamada por adminGetStats y getPublicStats.
 * Devuelve la fila cacheada o, si no existe todavía, valores en cero
 * (la primera vez puede pasar si el cron no ha corrido aún).
 */
export const getCachedStats = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("statsCache")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();

    if (!row) {
      // Primera vez, aún no hay cache. Devuelve ceros con computedAt=0
      // para que la UI no rompa.
      return {
        computedAt: 0,
        totalRaces: 0,
        publishedRaces: 0,
        featuredRaces: 0,
        totalUsers: 0,
        adminUsers: 0,
        totalVotes: 0,
        totalRatings: 0,
        totalMyRaces: 0,
        totalPRs: 0,
        totalNotifications: 0,
        racesByProvince: {} as Record<string, number>,
      };
    }

    return {
      computedAt: row.computedAt,
      totalRaces: row.totalRaces,
      publishedRaces: row.publishedRaces,
      featuredRaces: row.featuredRaces,
      totalUsers: row.totalUsers,
      adminUsers: row.adminUsers,
      totalVotes: row.totalVotes,
      totalRatings: row.totalRatings,
      totalMyRaces: row.totalMyRaces,
      totalPRs: row.totalPRs,
      totalNotifications: row.totalNotifications,
      racesByProvince: row.racesByProvince,
    };
  },
});

/**
 * Edad de la cache en ms — útil para mostrar "hace X min" en el admin.
 */
export const getStatsAge = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("statsCache")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    if (!row) return { ageMs: -1, computedAt: 0 };
    return { ageMs: Date.now() - row.computedAt, computedAt: row.computedAt };
  },
});

// Re-export types para el frontend
export type StatsPayload = {
  computedAt: number;
  totalRaces: number;
  publishedRaces: number;
  featuredRaces: number;
  totalUsers: number;
  adminUsers: number;
  totalVotes: number;
  totalRatings: number;
  totalMyRaces: number;
  totalPRs: number;
  totalNotifications: number;
  racesByProvince: Record<string, number>;
};

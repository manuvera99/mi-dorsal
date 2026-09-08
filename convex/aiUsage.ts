// =============================================================================
// mi-dorsal — AI usage tracking
// =============================================================================
// Tabla: aiUsageLog
//
// - `log`            → mutation llamada desde lib/ai/log-usage.ts (server-side,
//                      vía ConvexHttpClient). Pública sin auth porque solo
//                      se invoca desde código nuestro; si alguien la llamara
//                      directamente solo podría escribir su propio log de uso
//                      (no se rompe nada crítico).
// - `getDaily`       → query admin: total tokens + coste agrupado por día
//                      para los últimos N días.
// - `getByFunction`  → query admin: total tokens + coste agrupado por
//                      función de lib/ai/*, en un rango de fechas.
// - `getByModel`     → query admin: total tokens + coste agrupado por modelo.
// - `getRecent`      → query admin: últimas N llamadas (para una tabla de
//                      "actividad reciente").
// - `getSummary`     → query admin: KPIs globales (total llamadas, tokens
//                      totales, coste total, modelos únicos, último uso).
// =============================================================================

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./_helpers";

/** Mutation: registra una llamada a un LLM.
 *
 *  Pensada para ser llamada desde Vercel (server actions) vía ConvexHttpClient.
 *  Si alguien la invocara desde el cliente tampoco rompe nada — solo añade
 *  una fila al log, sin acceso a datos sensibles. */
export const log = mutation({
  args: {
    timestamp: v.number(),
    functionLabel: v.string(),
    model: v.string(),
    provider: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    costEur: v.number(),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    dateUtc: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiUsageLog", args);
  },
});

/** Totales y agregaciones por día para los últimos `days` días (default 30).
 *  Lo usa la gráfica diaria del panel admin. */
export const getDaily = query({
  args: {
    days: v.optional(v.number()), // default 30
  },
  handler: async (ctx, { days = 30 }) => {
    await requireAdmin(ctx);
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    cutoff.setUTCHours(0, 0, 0, 0);
    const cutoffDateUtc = cutoff.toISOString().slice(0, 10);

    const all = await ctx.db
      .query("aiUsageLog")
      .withIndex("by_date", (q) => q.gte("dateUtc", cutoffDateUtc))
      .collect();

    // Agrupar por fecha UTC.
    const byDate = new Map<
      string,
      {
        dateUtc: string;
        calls: number;
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        costEur: number;
        errors: number;
      }
    >();
    for (const r of all) {
      const cur = byDate.get(r.dateUtc) ?? {
        dateUtc: r.dateUtc,
        calls: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costEur: 0,
        errors: 0,
      };
      cur.calls += 1;
      cur.promptTokens += r.promptTokens;
      cur.completionTokens += r.completionTokens;
      cur.totalTokens += r.totalTokens;
      cur.costEur += r.costEur;
      if (!r.success) cur.errors += 1;
      byDate.set(r.dateUtc, cur);
    }
    return Array.from(byDate.values()).sort((a, b) =>
      a.dateUtc.localeCompare(b.dateUtc),
    );
  },
});

/** Totales por función de lib/ai/* en un rango. Lo usa la tabla "de dónde
 *  vienen" del panel admin. */
export const getByFunction = query({
  args: {
    days: v.optional(v.number()), // default 30
  },
  handler: async (ctx, { days = 30 }) => {
    await requireAdmin(ctx);
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    cutoff.setUTCHours(0, 0, 0, 0);
    const cutoffDateUtc = cutoff.toISOString().slice(0, 10);

    const all = await ctx.db
      .query("aiUsageLog")
      .withIndex("by_date", (q) => q.gte("dateUtc", cutoffDateUtc))
      .collect();

    const byFunction = new Map<
      string,
      {
        functionLabel: string;
        calls: number;
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        costEur: number;
        errors: number;
      }
    >();
    for (const r of all) {
      const cur = byFunction.get(r.functionLabel) ?? {
        functionLabel: r.functionLabel,
        calls: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costEur: 0,
        errors: 0,
      };
      cur.calls += 1;
      cur.promptTokens += r.promptTokens;
      cur.completionTokens += r.completionTokens;
      cur.totalTokens += r.totalTokens;
      cur.costEur += r.costEur;
      if (!r.success) cur.errors += 1;
      byFunction.set(r.functionLabel, cur);
    }
    return Array.from(byFunction.values()).sort(
      (a, b) => b.totalTokens - a.totalTokens,
    );
  },
});

/** Totales por modelo en un rango. */
export const getByModel = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, { days = 30 }) => {
    await requireAdmin(ctx);
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    cutoff.setUTCHours(0, 0, 0, 0);
    const cutoffDateUtc = cutoff.toISOString().slice(0, 10);

    const all = await ctx.db
      .query("aiUsageLog")
      .withIndex("by_date", (q) => q.gte("dateUtc", cutoffDateUtc))
      .collect();

    const byModel = new Map<
      string,
      {
        model: string;
        calls: number;
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        costEur: number;
      }
    >();
    for (const r of all) {
      const cur = byModel.get(r.model) ?? {
        model: r.model,
        calls: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costEur: 0,
      };
      cur.calls += 1;
      cur.promptTokens += r.promptTokens;
      cur.completionTokens += r.completionTokens;
      cur.totalTokens += r.totalTokens;
      cur.costEur += r.costEur;
      byModel.set(r.model, cur);
    }
    return Array.from(byModel.values()).sort((a, b) => b.costEur - a.costEur);
  },
});

/** Últimas N llamadas (para la tabla "actividad reciente" del panel). */
export const getRecent = query({
  args: {
    limit: v.optional(v.number()), // default 30
  },
  handler: async (ctx, { limit = 30 }) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("aiUsageLog")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
  },
});

/** KPIs globales: total llamadas, tokens, coste, último uso. Lo usan los
 *  4 stat cards de arriba del panel. */
export const getSummary = query({
  args: {
    days: v.optional(v.number()), // ventana para los agregados. Default 30.
  },
  handler: async (ctx, { days = 30 }) => {
    await requireAdmin(ctx);
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    cutoff.setUTCHours(0, 0, 0, 0);
    const cutoffDateUtc = cutoff.toISOString().slice(0, 10);

    const all = await ctx.db
      .query("aiUsageLog")
      .withIndex("by_date", (q) => q.gte("dateUtc", cutoffDateUtc))
      .collect();

    const models = new Set<string>();
    const functions = new Set<string>();
    let lastCallAt: number | null = null;
    let totalCost = 0;
    let totalTokens = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let errors = 0;

    for (const r of all) {
      models.add(r.model);
      functions.add(r.functionLabel);
      totalCost += r.costEur;
      totalTokens += r.totalTokens;
      totalPromptTokens += r.promptTokens;
      totalCompletionTokens += r.completionTokens;
      if (!r.success) errors += 1;
      if (lastCallAt === null || r.timestamp > lastCallAt) {
        lastCallAt = r.timestamp;
      }
    }

    return {
      windowDays: days,
      totalCalls: all.length,
      totalTokens,
      totalPromptTokens,
      totalCompletionTokens,
      totalCostEur: totalCost,
      uniqueModels: models.size,
      uniqueFunctions: functions.size,
      errors,
      lastCallAt,
    };
  },
});

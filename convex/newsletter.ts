// =============================================================================
// mi-dorsal — Newsletter (subscriptores externos sin cuenta)
// =============================================================================
// Implementa el doble opt-in RGPD:
//   1. subscribe() crea un registro "pending" + token, envía email de
//      confirmación con un link /api/newsletter/confirm?token=...
//   2. confirm() valida el token, marca "active" y envía email bienvenida.
//   3. unsubscribe() desuscribe inmediatamente (link en cada email).
//
// Si el suscriptor es también usuario de mi-dorsal, profileId lo enlaza para
// sincronizar preferencias con el profile.
// =============================================================================

import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAdmin, getOptionalUser } from "./_helpers";

// ---------------------------------------------------------------------------
// SUBSCRIBE / CONFIRM / UNSUBSCRIBE (públicas vía API routes)
// ---------------------------------------------------------------------------

/**
 * Crea un suscriptor en estado "pending" con un token de confirmación.
 * Idempotente: si el email ya existe en pending o active, no duplica.
 *
 * Se llama desde POST /api/newsletter/subscribe (route.ts), NO directamente
 * desde el cliente (necesitamos capturar IP hasheada y user agent para
 * auditoría RGPD).
 */
export const subscribePending = mutation({
  args: {
    email: v.string(),
    source: v.union(
      v.literal("blog"),
      v.literal("landing"),
      v.literal("footer"),
      v.literal("admin"),
      v.literal("import"),
    ),
    ipHash: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    locale: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!isValidEmail(email)) {
      throw new Error("Email inválido");
    }

    // Idempotencia: si ya existe, devolvemos su id sin crear duplicado
    const existing = await ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existing) {
      // Si estaba unsubscribed o bounced, lo reactivamos como pending
      if (existing.status === "unsubscribed" || existing.status === "bounced") {
        const confirmToken = generateToken();
        await ctx.db.patch(existing._id, {
          status: "pending",
          source: args.source,
          confirmToken,
          subscribedAt: Date.now(),
          unsubscribedAt: undefined,
          unsubscribedReason: undefined,
          subscriptionIpHash: args.ipHash ?? existing.subscriptionIpHash,
          subscriptionUserAgent: args.userAgent ?? existing.subscriptionUserAgent,
          locale: args.locale ?? existing.locale,
        });
        return { id: existing._id, confirmToken, alreadyExisted: true };
      }
      // Si ya está active o pending, devolvemos sin cambios
      return { id: existing._id, confirmToken: existing.confirmToken, alreadyExisted: true };
    }

    const confirmToken = generateToken();
    const unsubscribeToken = generateToken();
    const id = await ctx.db.insert("newsletterSubscribers", {
      email,
      status: "pending",
      source: args.source,
      preferences: {
        editorialEnabled: true,
        raceRemindersEnabled: true, // solo si también es usuario de mi-dorsal
        resultsEnabled: true,
      },
      confirmToken,
      unsubscribeToken,
      subscribedAt: Date.now(),
      subscriptionIpHash: args.ipHash,
      subscriptionUserAgent: args.userAgent,
      locale: args.locale,
    });

    return { id, confirmToken, unsubscribeToken, alreadyExisted: false };
  },
});

/**
 * Confirma la suscripción con el token. Marca "active" y setea confirmedAt.
 * Devuelve el email si OK, null si el token no existe o ya estaba activo.
 */
export const confirm = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sub = await ctx.db
      .query("newsletterSubscribers")
      .filter((q) => q.eq(q.field("confirmToken"), token))
      .unique();
    if (!sub) return null;
    if (sub.status === "active") {
      return { email: sub.email, alreadyActive: true };
    }
    if (sub.status !== "pending") {
      return null; // unsubscribed o bounced: token inválido
    }
    await ctx.db.patch(sub._id, {
      status: "active",
      confirmedAt: Date.now(),
      // El token ya no es necesario; limpiamos para evitar reuso
      confirmToken: undefined,
    });
    return { email: sub.email, alreadyActive: false };
  },
});

/**
 * Desuscribe por token (link "darme de baja" en cada email).
 * Devuelve true si se desuscribió, false si el token no existe.
 */
export const unsubscribeByToken = mutation({
  args: {
    token: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { token, reason }) => {
    const sub = await ctx.db
      .query("newsletterSubscribers")
      .filter((q) => q.eq(q.field("unsubscribeToken"), token))
      .unique();
    if (!sub) return false;
    await ctx.db.patch(sub._id, {
      status: "unsubscribed",
      unsubscribedAt: Date.now(),
      unsubscribedReason: reason,
      // Mantenemos confirmToken por si se quiere re-suscribir (otro token nuevo)
      unsubscribeToken: undefined,
    });
    return true;
  },
});

/**
 * Genera un unsubscribeToken para un suscriptor (idempotente: si ya tiene
 * uno, lo devuelve; si no, lo crea). Se usa al enviar cada email para
 * incluir el link de baja personalizado.
 */
export const ensureUnsubscribeToken = mutation({
  args: { id: v.id("newsletterSubscribers") },
  handler: async (ctx, { id }) => {
    const sub = await ctx.db.get(id);
    if (!sub) return null;
    if (sub.unsubscribeToken) return sub.unsubscribeToken;
    const token = generateToken();
    await ctx.db.patch(id, { unsubscribeToken: token });
    return token;
  },
});

/**
 * Desuscribe por email directo (admin). Útil para bajas manuales.
 */
export const unsubscribeByEmail = mutation({
  args: {
    email: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { email, reason }) => {
    const sub = await ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase().trim()))
      .unique();
    if (!sub) return false;
    await ctx.db.patch(sub._id, {
      status: "unsubscribed",
      unsubscribedAt: Date.now(),
      unsubscribedReason: reason,
    });
    return true;
  },
});

/**
 * Actualiza preferencias del suscriptor (link "gestionar preferencias"
 * en emails). Se valida con email (enviado en el link) sin auth.
 */
export const updatePreferences = mutation({
  args: {
    email: v.string(),
    editorialEnabled: v.optional(v.boolean()),
    raceRemindersEnabled: v.optional(v.boolean()),
    resultsEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, { email, ...prefs }) => {
    const sub = await ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase().trim()))
      .unique();
    if (!sub) return false;
    const newPrefs = { ...sub.preferences };
    if (prefs.editorialEnabled !== undefined) newPrefs.editorialEnabled = prefs.editorialEnabled;
    if (prefs.raceRemindersEnabled !== undefined) newPrefs.raceRemindersEnabled = prefs.raceRemindersEnabled;
    if (prefs.resultsEnabled !== undefined) newPrefs.resultsEnabled = prefs.resultsEnabled;
    await ctx.db.patch(sub._id, { preferences: newPrefs });
    return true;
  },
});

// ---------------------------------------------------------------------------
// QUERIES PÚBLICAS
// ---------------------------------------------------------------------------

/**
 * Devuelve el estado de la suscripción de un email (sin auth, para el
 * widget del footer "Tu estado de newsletter"). No expone PII más allá del
 * email buscado.
 */
export const getStatus = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const sub = await ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase().trim()))
      .unique();
    if (!sub) return { status: "not_found" as const };
    return {
      status: sub.status,
      subscribedAt: sub.subscribedAt,
      preferences: sub.preferences,
    };
  },
});

// ---------------------------------------------------------------------------
// QUERIES ADMIN
// ---------------------------------------------------------------------------

/**
 * Lista todos los suscriptores (admin) con filtros.
 */
export const adminList = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("active"),
        v.literal("unsubscribed"),
        v.literal("bounced"),
      ),
    ),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = args.limit ?? 100;
    let q: any = ctx.db.query("newsletterSubscribers");
    if (args.status) {
      q = q.withIndex("by_status", (qq) => qq.eq("status", args.status!));
    }
    const all = await q.order("desc").take(limit * 2); // margen para filter
    let filtered = all;
    if (args.search) {
      const s = args.search.toLowerCase();
      filtered = filtered.filter((x) => x.email.includes(s));
    }
    return filtered.slice(0, limit);
  },
});

/**
 * Stats globales de la newsletter para el dashboard admin.
 */
export const adminGetStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("newsletterSubscribers").collect();
    const counts = {
      total: all.length,
      pending: 0,
      active: 0,
      unsubscribed: 0,
      bounced: 0,
    };
    for (const s of all) {
      counts[s.status]++;
    }
    // Fuentes (solo activos)
    const sources: Record<string, number> = {
      blog: 0,
      landing: 0,
      footer: 0,
      admin: 0,
      import: 0,
    };
    for (const s of all) {
      if (s.status === "active") {
        sources[s.source] = (sources[s.source] ?? 0) + 1;
      }
    }
    // Tasa de conversión pending → active
    const conversionRate =
      counts.pending + counts.active > 0
        ? Math.round((counts.active / (counts.pending + counts.active)) * 100)
        : 0;
    return { ...counts, sources, conversionRate };
  },
});

// ---------------------------------------------------------------------------
// INTERNAL MUTATIONS (uso interno: crons, webhooks)
// ---------------------------------------------------------------------------

/**
 * Lista suscriptores activos con editorialEnabled=true (para el cron).
 * Devuelve hasta 5000 (límite de una query sin paginación).
 */
export const listActiveEditorialSubscribers = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const all = await ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    return all
      .filter((s) => s.preferences.editorialEnabled === true)
      .slice(0, limit ?? 5000);
  },
});

/**
 * Marca el suscriptor como "bounced" (lo llama el webhook de Resend
 * cuando un email rebota). Llamar desde convex/http.ts cuando se monte
 * el endpoint /resend-webhook.
 */
export const markBounced = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const sub = await ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase().trim()))
      .unique();
    if (!sub) return null;
    await ctx.db.patch(sub._id, { status: "bounced" });
    return sub._id;
  },
});

/**
 * Actualiza lastSentAt (lo llama el cron editorial tras enviar).
 */
export const markSent = internalMutation({
  args: { id: v.id("newsletterSubscribers"), sentAt: v.number() },
  handler: async (ctx, { id, sentAt }) => {
    await ctx.db.patch(id, { lastSentAt: sentAt });
  },
});

/**
 * Importa un lote de emails desde CSV (admin). Crea como "active" sin
 * doble opt-in (asumimos que el admin gestiona el consentimiento).
 */
export const adminImport = mutation({
  args: {
    emails: v.array(v.object({ email: v.string(), tags: v.optional(v.array(v.string())) })),
    source: v.optional(v.union(v.literal("import"), v.literal("admin"))),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const now = Date.now();
    let imported = 0;
    let skipped = 0;
    for (const { email: raw, tags } of args.emails) {
      const email = raw.trim().toLowerCase();
      if (!isValidEmail(email)) {
        skipped++;
        continue;
      }
      const existing = await ctx.db
        .query("newsletterSubscribers")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      if (existing) {
        skipped++;
        continue;
      }
      await ctx.db.insert("newsletterSubscribers", {
        email,
        status: "active",
        source: args.source ?? "import",
        preferences: {
          editorialEnabled: true,
          raceRemindersEnabled: true,
          resultsEnabled: true,
        },
        subscribedAt: now,
        confirmedAt: now,
        tags,
      });
      imported++;
    }
    return { imported, skipped, total: args.emails.length };
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateToken(): string {
  // 32 chars hex ≈ 128 bits de entropía
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

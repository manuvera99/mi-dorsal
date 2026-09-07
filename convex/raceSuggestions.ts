// =============================================================================
// mi-dorsal — Race suggestions (carreras que un usuario nos sugiere)
// =============================================================================
// Un usuario logueado que no encuentra su carrera en /carreras puede pegar la
// URL de la web oficial. Esto crea una entrada "pending" que el admin ve en
// /admin/race-suggestions y puede convertir en carrera real abriendo
// /admin/races/from-url con la URL pre-rellena.
//
// Tras crear la sugerencia se envía un email al admin (si no es mock).
// =============================================================================

import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAdmin, requireUser } from "./_helpers";

// ---------------------------------------------------------------------------
// SUBMIT (usuario logueado)
// ---------------------------------------------------------------------------

/**
 * Envía una sugerencia de carrera.
 * Requiere usuario logueado. Valida la URL y normaliza a https.
 */
export const submit = mutation({
  args: {
    url: v.string(),
    note: v.optional(v.string()),
    suggestedName: v.optional(v.string()),
    suggestedDate: v.optional(v.string()),
    suggestedLocality: v.optional(v.string()),
    suggestedProvince: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Validar URL
    const url = args.url.trim();
    if (!url) throw new Error("La URL es obligatoria");
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("URL no válida");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("La URL debe empezar por http:// o https://");
    }

    // Sanitizar note (límite razonable para evitar abusos)
    const note = args.note?.trim() || undefined;
    if (note && note.length > 1000) {
      throw new Error("La nota no puede superar los 1000 caracteres");
    }

    const now = Date.now();
    const id = await ctx.db.insert("raceSuggestions", {
      userId: user._id,
      url: parsed.toString(),
      note,
      suggestedName: args.suggestedName?.trim() || undefined,
      suggestedDate: args.suggestedDate || undefined,
      suggestedLocality: args.suggestedLocality?.trim() || undefined,
      suggestedProvince: args.suggestedProvince || undefined,
      status: "pending",
      createdAt: now,
    });

    // Enviar email al admin (fire-and-forget, no bloquea la mutation)
    await ctx.scheduler.runAfter(0, internal.raceSuggestions.notifyAdmin, {
      suggestionId: id,
    } as any);

    return { id };
  },
});

// ---------------------------------------------------------------------------
// ADMIN: listar / detalle / actualizar estado
// ---------------------------------------------------------------------------

/**
 * Lista sugerencias con filtros opcionales. Solo admin.
 * Ordenadas por fecha de creación descendente (más recientes primero).
 */
export const adminList = query({
  args: {
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("created"),
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = args.limit ?? 200;

    const all = await ctx.db.query("raceSuggestions").order("desc").collect();
    let list = args.status ? all.filter((s) => s.status === args.status) : all;
    list = list.slice(0, limit);

    // Enrich con info del usuario que envió la sugerencia
    const enriched = await Promise.all(
      list.map(async (s) => {
        const user = await ctx.db.get(s.userId);
        return {
          ...s,
          user: user
            ? {
                _id: user._id,
                // FIX DE TIPO: cast a any (mismo motivo que en feedback.ts).
                displayName: (user as any).displayName ?? null,
                email: (user as any).email ?? null,
              }
            : null,
        };
      })
    );
    return enriched;
  },
});

/**
 * Detalle de una sugerencia. Solo admin.
 */
export const adminGet = query({
  args: { id: v.id("raceSuggestions") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const suggestion = await ctx.db.get(id);
    if (!suggestion) return null;
    const user = await ctx.db.get(suggestion.userId);
    const createdRace = suggestion.createdRaceId
      ? await ctx.db.get(suggestion.createdRaceId)
      : null;
    return {
      ...suggestion,
      user: user
        ? {
            _id: user._id,
            displayName: user.displayName ?? null,
            email: user.email ?? null,
          }
        : null,
      createdRace: createdRace
        ? { _id: createdRace._id, name: createdRace.name, slug: createdRace.slug }
        : null,
    };
  },
});

/**
 * Stats rápidas para el dashboard del admin. Solo admin.
 */
export const adminGetStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("raceSuggestions").collect();
    return {
      total: all.length,
      pending: all.filter((s) => s.status === "pending").length,
      approved: all.filter((s) => s.status === "approved").length,
      rejected: all.filter((s) => s.status === "rejected").length,
      created: all.filter((s) => s.status === "created").length,
    };
  },
});

/**
 * Cambia el estado de una sugerencia y/o añade nota del admin.
 * Solo admin.
 */
export const adminUpdateStatus = mutation({
  args: {
    id: v.id("raceSuggestions"),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("created"),
    ),
    adminNote: v.optional(v.string()),
    createdRaceId: v.optional(v.id("races")),
  },
  handler: async (ctx, { id, status, adminNote, createdRaceId }) => {
    const admin = await requireAdmin(ctx);
    const suggestion = await ctx.db.get(id);
    if (!suggestion) throw new Error("Sugerencia no encontrada");

    const patch: Record<string, unknown> = {
      status,
      adminNote: adminNote?.trim() || undefined,
      reviewedBy: admin._id,
      reviewedAt: Date.now(),
    };
    if (createdRaceId) {
      patch.createdRaceId = createdRaceId;
    }
    await ctx.db.patch(id, patch);
    return id;
  },
});

// ---------------------------------------------------------------------------
// USUARIO: sus propias sugerencias
// ---------------------------------------------------------------------------

/**
 * Lista las sugerencias del usuario autenticado.
 */
export const getMySuggestions = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("raceSuggestions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50);
  },
});

// ---------------------------------------------------------------------------
// INTERNAL: notificación por email al admin
// ---------------------------------------------------------------------------

/**
 * Envía un email al admin cuando llega una sugerencia nueva.
 * Usar `runAfter(0, ...)` para que sea fire-and-forget.
 */
export const notifyAdmin = internalMutation({
  args: { suggestionId: v.id("raceSuggestions") },
  handler: async (ctx, { suggestionId }) => {
    const suggestion = await ctx.db.get(suggestionId);
    if (!suggestion) return;
    const user = await ctx.db.get(suggestion.userId);

    const userLabel =
      user?.displayName?.trim() ||
      user?.email ||
      `Usuario ${user?._id.slice(0, 8) ?? "desconocido"}`;

    const noteHtml = suggestion.note
      ? `<p style="margin:8px 0;padding:8px 12px;background:#f5f5f4;border-left:3px solid #dc2626;border-radius:4px;color:#444;font-style:italic;">${escapeHtml(suggestion.note)}</p>`
      : "";

    const suggestedMeta = [
      suggestion.suggestedName && `<li><strong>Nombre:</strong> ${escapeHtml(suggestion.suggestedName)}</li>`,
      suggestion.suggestedDate && `<li><strong>Fecha:</strong> ${escapeHtml(suggestion.suggestedDate)}</li>`,
      suggestion.suggestedLocality && `<li><strong>Localidad:</strong> ${escapeHtml(suggestion.suggestedLocality)}</li>`,
      suggestion.suggestedProvince && `<li><strong>Provincia:</strong> ${escapeHtml(suggestion.suggestedProvince)}</li>`,
    ]
      .filter(Boolean)
      .join("");

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.mi-dorsal.com";
    const adminUrl = `${baseUrl}/admin/race-suggestions`;

    const html = `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fafaf9;padding:24px;color:#0a0a0a;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e7e5e4;">
    <div style="background:#dc2626;color:#fff;padding:16px 20px;">
      <h1 style="margin:0;font-size:18px;">🏃 Nueva sugerencia de carrera</h1>
    </div>
    <div style="padding:20px;">
      <p style="margin:0 0 12px;"><strong>${escapeHtml(userLabel)}</strong> sugiere una carrera:</p>
      <p style="margin:0 0 4px;font-size:13px;color:#666;">URL:</p>
      <p style="margin:0 0 16px;word-break:break-all;">
        <a href="${escapeAttr(suggestion.url)}" style="color:#dc2626;">${escapeHtml(suggestion.url)}</a>
      </p>
      ${suggestedMeta ? `<p style="margin:0 0 8px;font-size:13px;color:#666;">Datos que rellenó:</p><ul style="margin:0 0 16px;padding-left:20px;">${suggestedMeta}</ul>` : ""}
      ${noteHtml}
      <a href="${adminUrl}" style="display:inline-block;margin-top:8px;background:#dc2626;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;">Revisar en el panel →</a>
    </div>
  </div>
</body></html>`;

    const text = `Nueva sugerencia de carrera

${userLabel} sugiere:
${suggestion.url}
${suggestion.suggestedName ? `Nombre: ${suggestion.suggestedName}\n` : ""}${suggestion.suggestedDate ? `Fecha: ${suggestion.suggestedDate}\n` : ""}${suggestion.note ? `\nNota: ${suggestion.note}\n` : ""}
Revisar en: ${adminUrl}`;

    await ctx.scheduler.runAfter(0, (internal.emails as any).sendEmail, {
      to: process.env.ADMIN_NOTIFICATION_EMAIL || "hola@mi-dorsal.es",
      subject: `🏃 Nueva sugerencia de carrera: ${suggestion.suggestedName || suggestion.url}`,
      html,
      text,
    });
  },
});

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

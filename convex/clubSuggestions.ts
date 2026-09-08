// =============================================================================
// mi-dorsal — Club suggestions (clubes no encontrados en la lista RFEA)
// =============================================================================
// Cuando un usuario busca su club en el selector de /perfil y no lo
// encuentra, puede reportarlo desde el combobox. Llega al admin para que:
//
//   - lo añada al próximo ingest de la RFEA (status: added), o
//   - lo marque como duplicado si ya existe con otro nombre (status: duplicate), o
//   - lo rechace si no procede (no es un club de atletismo, etc.) (status: rejected).
//
// El email al admin usa el mismo flujo que feedback (internal.emailDispatch).
// =============================================================================

import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { getOptionalUser, requireAdmin } from "./_helpers";

// ---------------------------------------------------------------------------
// SUBMIT (cualquier usuario autenticado o anónimo)
// ---------------------------------------------------------------------------

/**
 * El usuario envía la sugerencia de club. Validamos longitudes, formato
 * del email si viene, y creamos la fila. Luego agendamos el email al admin
 * vía internalMutation.
 */
export const submit = mutation({
  args: {
    clubName: v.string(),
    ccaa: v.optional(v.string()),
    note: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Puede ser anónimo (lauth), pero es raro: el flujo está en /perfil.
    // Capturamos el userId si lo hay para que el admin pueda responderle.
    const user = await getOptionalUser(ctx);

    const clubName = args.clubName.trim();
    if (clubName.length < 2) {
      throw new Error("El nombre del club es muy corto (mínimo 2 caracteres)");
    }
    if (clubName.length > 120) {
      throw new Error("El nombre del club no puede pasar de 120 caracteres");
    }

    const ccaa = args.ccaa?.trim() || undefined;
    if (ccaa && ccaa.length > 60) {
      throw new Error("La CCAA no puede pasar de 60 caracteres");
    }

    const note = args.note?.trim() || undefined;
    if (note && note.length > 500) {
      throw new Error("La nota no puede pasar de 500 caracteres");
    }

    const contactEmail = args.contactEmail?.trim().toLowerCase() || undefined;
    if (contactEmail && !isValidEmail(contactEmail)) {
      throw new Error("Email de contacto no válido");
    }

    const now = Date.now();
    // Spread condicional para evitar meter userId: undefined en un campo
    // opcional — Convex trata `undefined` como no-enviar (mejor que null).
    const id = await ctx.db.insert("clubSuggestions", {
      ...(user?._id ? { userId: user._id } : {}),
      clubName,
      ccaa,
      note,
      contactEmail,
      status: "new",
      createdAt: now,
    });

    // Notificar al admin. Si el scheduler falla por algún motivo (ej. el
    // internal action no existe), NO bloqueamos el insert: la fila ya está
    // persistida y el admin la verá en /admin/club-suggestions aunque no
    // llegue el email. Logueamos para detectar el caso.
    try {
      await ctx.scheduler.runAfter(0, internal.clubSuggestions.notifyAdmin, {
        suggestionId: id,
      } as any);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[clubSuggestions] notifyAdmin scheduler failed:", e);
    }

    return { id };
  },
});

// ---------------------------------------------------------------------------
// ADMIN: listar / cambiar estado
// ---------------------------------------------------------------------------

const SUGGESTION_STATUSES = ["new", "added", "duplicate", "rejected"] as const;

/**
 * Lista las sugerencias con filtro opcional por estado. Solo admin.
 * Orden por createdAt desc.
 */
export const adminList = query({
  args: {
    status: v.optional(v.union(
      ...SUGGESTION_STATUSES.map((s) => v.literal(s)),
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = args.limit ?? 200;

    // Mismo patrón que feedback.ts: filtro en JS tras tomar los registros
    // (low-traffic admin view). Para miles de entradas habría que cambiar
    // a queries con índice combinado.
    const all = await ctx.db.query("clubSuggestions").order("desc").collect();
    let list = all;
    if (args.status) list = list.filter((s) => s.status === args.status);
    list = list.slice(0, limit);

    const enriched = await Promise.all(
      list.map(async (s) => {
        const user = s.userId ? await ctx.db.get(s.userId) : null;
        return {
          ...s,
          user: user
            ? {
                _id: user._id,
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
 * Stats rápidas para el dashboard. Solo admin.
 */
export const adminGetStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("clubSuggestions").collect();
    return {
      total: all.length,
      new: all.filter((s) => s.status === "new").length,
      added: all.filter((s) => s.status === "added").length,
      duplicate: all.filter((s) => s.status === "duplicate").length,
      rejected: all.filter((s) => s.status === "rejected").length,
    };
  },
});

/**
 * Cambia estado y/o añade nota del admin. Solo admin.
 */
export const adminUpdateStatus = mutation({
  args: {
    id: v.id("clubSuggestions"),
    status: v.optional(v.union(
      v.literal("new"),
      v.literal("added"),
      v.literal("duplicate"),
      v.literal("rejected"),
    )),
    adminNote: v.optional(v.string()),
  },
  handler: async (ctx, { id, status, adminNote }) => {
    const admin = await requireAdmin(ctx);
    const suggestion = await ctx.db.get(id);
    if (!suggestion) throw new Error("Sugerencia no encontrada");

    const patch: Record<string, unknown> = {};
    if (status) patch.status = status;
    if (adminNote !== undefined) {
      const trimmed = adminNote.trim();
      patch.adminNote = trimmed || undefined;
    }
    // Si cambia de "new" a otro estado, marcamos reviewedBy/At.
    if (status && status !== "new" && suggestion.status === "new") {
      patch.reviewedBy = admin._id;
      patch.reviewedAt = Date.now();
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(id, patch);
    }

    // Si pasa a "added", crea automáticamente el club en clubsCatalog.
    // Idempotente: si ya existe uno con el mismo name+ccaa, no duplica.
    // Hacemos el upsert desde la MISMA mutation para que sea atómico
    // (no hay ventana donde la sugerencia está "added" pero el club no existe).
    if (status === "added" && suggestion.status !== "added") {
      await ctx.runMutation(api.clubsCatalog.upsertFromSuggestion, {
        name: suggestion.clubName,
        ccaa: suggestion.ccaa,
        suggestionId: id,
      });
    }

    return id;
  },
});

// ---------------------------------------------------------------------------
// INTERNAL: email al admin
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<"new" | "added" | "duplicate" | "rejected", string> = {
  new: "Pendiente",
  added: "Añadido al catálogo",
  duplicate: "Duplicado",
  rejected: "Rechazado",
};

/**
 * Envía email al admin cuando llega una nueva sugerencia de club.
 * Mismo flujo que feedback.notifyAdmin.
 */
export const notifyAdmin = internalMutation({
  args: { suggestionId: v.id("clubSuggestions") },
  handler: async (ctx, { suggestionId }) => {
    const suggestion = await ctx.db.get(suggestionId);
    if (!suggestion) return;
    const user = suggestion.userId ? await ctx.db.get(suggestion.userId) : null;

    const userLabel = user
      ? (user as any).displayName?.trim() || (user as any).email || `Usuario ${user._id.slice(0, 8)}`
      : "Anónimo";

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.mi-dorsal.com";
    const adminUrl = `${baseUrl}/admin/club-suggestions`;

    const userBlock = user
      ? `<p style="margin:0 0 4px;font-size:13px;color:#666;">Enviado por: <strong>${escapeHtml(userLabel)}</strong>${(user as any).email ? ` (${escapeHtml((user as any).email)})` : ""}</p>`
      : `<p style="margin:0 0 4px;font-size:13px;color:#666;">Enviado por: <em>anónimo</em></p>${suggestion.contactEmail ? `<p style="margin:0;font-size:13px;color:#666;">Contacto: <a href="mailto:${escapeAttr(suggestion.contactEmail)}" style="color:#dc2626;">${escapeHtml(suggestion.contactEmail)}</a></p>` : ""}`;

    const noteBlock = suggestion.note
      ? `<div style="margin-top:12px;padding:10px 12px;background:#f5f5f4;border-radius:6px;font-size:13px;color:#444;"><strong>Nota:</strong> ${escapeHtml(suggestion.note)}</div>`
      : "";

    const html = `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fafaf9;padding:24px;color:#0a0a0a;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e7e5e4;">
    <div style="background:#16a34a;color:#fff;padding:16px 20px;">
      <h1 style="margin:0;font-size:18px;">🏃 Nuevo club sugerido: ${escapeHtml(suggestion.clubName)}</h1>
    </div>
    <div style="padding:20px;">
      ${userBlock}
      <p style="margin:12px 0 0;font-size:14px;"><strong>CCAA:</strong> ${suggestion.ccaa ? escapeHtml(suggestion.ccaa) : "<em style='color:#888;'>no indicada</em>"}</p>
      <p style="margin:8px 0 0;font-size:14px;"><strong>Club:</strong> <code style="background:#f5f5f4;padding:2px 6px;border-radius:4px;">${escapeHtml(suggestion.clubName)}</code></p>
      ${noteBlock}
      <a href="${adminUrl}" style="display:inline-block;margin-top:16px;background:#0a0a0a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;">Revisar en el panel →</a>
    </div>
  </div>
</body></html>`;

    const text = `🏃 Nuevo club sugerido: ${suggestion.clubName}

${userLabel}${(user as any)?.email ? ` (${(user as any).email})` : ""}${suggestion.contactEmail ? `\nContacto: ${suggestion.contactEmail}` : ""}
CCAA: ${suggestion.ccaa ?? "(no indicada)"}
${suggestion.note ? `Nota: ${suggestion.note}\n` : ""}
Revisar en: ${adminUrl}`;

    await ctx.scheduler.runAfter(0, (internal.emails as any).sendEmail, {
      to: process.env.ADMIN_NOTIFICATION_EMAIL || "hola@mi-dorsal.com",
      subject: `🏃 Nuevo club sugerido: ${suggestion.clubName}`,
      html,
      text,
    });
  },
});

// ---------------------------------------------------------------------------
// Utilidades (duplicadas de feedback.ts porque Convex no tiene cross-file
// imports de helpers triviales — es preferible tener cada archivo autocontenido)
// ---------------------------------------------------------------------------

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

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

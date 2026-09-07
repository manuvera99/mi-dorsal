// =============================================================================
// mi-dorsal — Feedback & bug reports
// =============================================================================
// Formulario público (link en el footer) donde cualquier usuario puede:
//   - reportar un bug
//   - sugerir una idea / mejora
//   - dejar feedback general
//
// `userId` es opcional: dejamos reportar a usuarios anónimos también.
// Si el usuario está logueado, capturamos su id para poder responder.
//
// Cuando llega un nuevo report, se envía un email al admin.
// =============================================================================

import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { getOptionalUser, requireAdmin, requireUser } from "./_helpers";

// ---------------------------------------------------------------------------
// SUBMIT (público, con userId opcional)
// ---------------------------------------------------------------------------

/**
 * Envía un feedback / bug report.
 *
 * Si el usuario está logueado, capturamos su `userId` (vía requireUser). Si no,
 * permitimos enviar como anónimo (queda registrado el `contactEmail` si lo da).
 *
 * Valida longitudes razonables y sanea.
 */
export const submit = mutation({
  args: {
    type: v.union(v.literal("bug"), v.literal("idea"), v.literal("feedback")),
    title: v.string(),
    description: v.string(),
    pageUrl: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    raceId: v.optional(v.id("races")),
  },
  handler: async (ctx, args) => {
    // userId es opcional: si está logueado lo asociamos, si no, anónimo.
    const user = await getOptionalUser(ctx);

    const title = args.title.trim();
    if (title.length < 4) throw new Error("El título es muy corto (mínimo 4 caracteres)");
    if (title.length > 200) throw new Error("El título no puede superar los 200 caracteres");

    const description = args.description.trim();
    if (description.length < 10) {
      throw new Error("La descripción es muy corta (mínimo 10 caracteres)");
    }
    if (description.length > 5000) {
      throw new Error("La descripción no puede superar los 5000 caracteres");
    }

    // Validar email si viene
    if (args.contactEmail && !isValidEmail(args.contactEmail.trim())) {
      throw new Error("Email de contacto no válido");
    }

    // Validar que la carrera existe si viene raceId
    if (args.raceId) {
      const race = await ctx.db.get(args.raceId);
      if (!race) throw new Error("Carrera no encontrada");
    }

    const now = Date.now();
    const id = await ctx.db.insert("feedbackReports", {
      userId: user?._id,
      type: args.type,
      title,
      description,
      pageUrl: args.pageUrl?.trim() || undefined,
      contactEmail: args.contactEmail?.trim().toLowerCase() || undefined,
      raceId: args.raceId,
      status: "new",
      createdAt: now,
      updatedAt: now,
    });

    // Notificar al admin
    await ctx.scheduler.runAfter(0, internal.feedback.notifyAdmin, {
      reportId: id,
    } as any);

    return { id };
  },
});

// ---------------------------------------------------------------------------
// ADMIN: listar / detalle / actualizar estado
// ---------------------------------------------------------------------------

const FEEDBACK_STATUSES = [
  "new",
  "in_progress",
  "done",
  "wontfix",
] as const;

const FEEDBACK_TYPES = ["bug", "idea", "feedback"] as const;

/**
 * Lista feedback con filtros. Solo admin.
 * Orden por createdAt desc.
 */
export const adminList = query({
  args: {
    status: v.optional(v.union(
      ...FEEDBACK_STATUSES.map((s) => v.literal(s)),
    )),
    type: v.optional(v.union(
      ...FEEDBACK_TYPES.map((t) => v.literal(t)),
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = args.limit ?? 200;

    // Filtro en JS tras tomar los registros: la tabla es pequeña
    // (low-traffic admin view), y `take(limit)` antes del filter nos
    // asegura no acumular memoria. Para producción con miles de entradas
    // habría que cambiar a queries con índice combinado.
    const all = await ctx.db.query("feedbackReports").order("desc").collect();
    let list = all;
    if (args.status) list = list.filter((r) => r.status === args.status);
    if (args.type) list = list.filter((r) => r.type === args.type);
    list = list.slice(0, limit);

    const enriched = await Promise.all(
      list.map(async (r) => {
        const user = r.userId ? await ctx.db.get(r.userId) : null;
        const race = r.raceId ? await ctx.db.get(r.raceId) : null;
        return {
          ...r,
          user: user
            ? {
                _id: user._id,
                // FIX DE TIPO: ctx.db.get devuelve un Doc<tabla> genérico, el código
                // asume que es un profile. Cast a any para que el typecheck pase. Hay
                // que arreglar el tipo del r.userId para que sea v.id("profiles") en
                // lugar de v.id("cualquiera").
                displayName: (user as any).displayName ?? null,
                email: (user as any).email ?? null,
              }
            : null,
          race: race
            ? { _id: race._id, name: race.name, slug: race.slug }
            : null,
        };
      })
    );
    return enriched;
  },
});

/**
 * Detalle de un feedback. Solo admin.
 */
export const adminGet = query({
  args: { id: v.id("feedbackReports") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const report = await ctx.db.get(id);
    if (!report) return null;
    const user = report.userId ? await ctx.db.get(report.userId) : null;
    const race = report.raceId ? await ctx.db.get(report.raceId) : null;
    return {
      ...report,
      user: user
        ? {
            _id: user._id,
            displayName: user.displayName ?? null,
            email: user.email ?? null,
          }
        : null,
      race: race
        ? { _id: race._id, name: race.name, slug: race.slug }
        : null,
    };
  },
});

/**
 * Stats rápidas para el dashboard admin. Solo admin.
 */
export const adminGetStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("feedbackReports").collect();
    return {
      total: all.length,
      new: all.filter((r) => r.status === "new").length,
      inProgress: all.filter((r) => r.status === "in_progress").length,
      done: all.filter((r) => r.status === "done").length,
      wontfix: all.filter((r) => r.status === "wontfix").length,
      byType: {
        bug: all.filter((r) => r.type === "bug").length,
        idea: all.filter((r) => r.type === "idea").length,
        feedback: all.filter((r) => r.type === "feedback").length,
      },
    };
  },
});

/**
 * Cambia estado y/o añade nota del admin. Solo admin.
 */
export const adminUpdateStatus = mutation({
  args: {
    id: v.id("feedbackReports"),
    status: v.optional(v.union(
      v.literal("new"),
      v.literal("in_progress"),
      v.literal("done"),
      v.literal("wontfix"),
    )),
    adminNote: v.optional(v.string()),
  },
  handler: async (ctx, { id, status, adminNote }) => {
    const admin = await requireAdmin(ctx);
    const report = await ctx.db.get(id);
    if (!report) throw new Error("Feedback no encontrado");

    const patch: Record<string, unknown> = {
      updatedAt: Date.now(),
    };
    if (status) patch.status = status;
    if (adminNote !== undefined) {
      const trimmed = adminNote.trim();
      patch.adminNote = trimmed || undefined;
    }
    // Si cambia de "new" a otro estado, marcamos reviewedBy/At
    if (status && status !== "new" && report.status === "new") {
      patch.reviewedBy = admin._id;
      patch.reviewedAt = Date.now();
    }
    await ctx.db.patch(id, patch);
    return id;
  },
});

// ---------------------------------------------------------------------------
// USUARIO: sus propios feedbacks (opcional, para "ver mis reportes")
// ---------------------------------------------------------------------------

/**
 * Lista los feedbacks enviados por el usuario autenticado.
 * Solo devuelve los que tienen userId = current user.
 */
export const getMyReports = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("feedbackReports")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50);
  },
});

// ---------------------------------------------------------------------------
// INTERNAL: email al admin
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<"bug" | "idea" | "feedback", { label: string; emoji: string; color: string }> = {
  bug: { label: "Bug", emoji: "🐛", color: "#dc2626" },
  idea: { label: "Idea", emoji: "💡", color: "#16a34a" },
  feedback: { label: "Feedback", emoji: "💬", color: "#0891b2" },
};

const STATUS_LABELS: Record<"new" | "in_progress" | "done" | "wontfix", string> = {
  new: "Nuevo",
  in_progress: "En progreso",
  done: "Resuelto",
  wontfix: "No se hará",
};

/**
 * Envía email al admin cuando llega un nuevo feedback.
 */
export const notifyAdmin = internalMutation({
  args: { reportId: v.id("feedbackReports") },
  handler: async (ctx, { reportId }) => {
    const report = await ctx.db.get(reportId);
    if (!report) return;
    const user = report.userId ? await ctx.db.get(report.userId) : null;
    const race = report.raceId ? await ctx.db.get(report.raceId) : null;

    const typeInfo = TYPE_LABELS[report.type];
    const userLabel = user
      ? (user as any).displayName?.trim() || (user as any).email || `Usuario ${user._id.slice(0, 8)}`
      : "Anónimo";

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.mi-dorsal.com";
    const adminUrl = `${baseUrl}/admin/feedback`;

    const contactBlock = report.contactEmail
      ? `<p style="margin:8px 0 0;font-size:13px;color:#666;">Contacto (anónimo): <a href="mailto:${escapeAttr(report.contactEmail)}" style="color:#dc2626;">${escapeHtml(report.contactEmail)}</a></p>`
      : "";

    const userBlock = user
      ? `<p style="margin:0 0 4px;font-size:13px;color:#666;">Enviado por: <strong>${escapeHtml(userLabel)}</strong>${(user as any).email ? ` (${escapeHtml((user as any).email)})` : ""}</p>`
      : `<p style="margin:0 0 4px;font-size:13px;color:#666;">Enviado por: <em>anónimo</em></p>${contactBlock}`;

    const pageBlock = report.pageUrl
      ? `<p style="margin:8px 0;font-size:12px;color:#666;">Página: <a href="${escapeAttr(report.pageUrl)}" style="color:#0891b2;">${escapeHtml(report.pageUrl)}</a></p>`
      : "";

    const raceBlock = race
      ? `<p style="margin:8px 0;padding:10px 12px;background:#fef3c7;border-left:3px solid #f59e0b;border-radius:4px;font-size:13px;">🏁 <strong>Carrera:</strong> <a href="${escapeAttr(`${baseUrl}/carreras/${race.slug}`)}" style="color:#0a0a0a;font-weight:600;">${escapeHtml(race.name)}</a> · <a href="${escapeAttr(`${baseUrl}/admin/races/${race._id}`)}" style="color:#dc2626;">editar en admin →</a></p>`
      : "";

    const html = `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fafaf9;padding:24px;color:#0a0a0a;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e7e5e4;">
    <div style="background:${typeInfo.color};color:#fff;padding:16px 20px;">
      <h1 style="margin:0;font-size:18px;">${typeInfo.emoji} ${typeInfo.label}: ${escapeHtml(report.title)}</h1>
    </div>
    <div style="padding:20px;">
      ${userBlock}
      ${raceBlock}
      ${pageBlock}
      <div style="margin-top:16px;padding:14px;background:#f5f5f4;border-radius:6px;border-left:3px solid ${typeInfo.color};">
        <p style="margin:0;white-space:pre-wrap;font-size:14px;line-height:1.5;">${escapeHtml(report.description)}</p>
      </div>
      <a href="${adminUrl}" style="display:inline-block;margin-top:16px;background:#0a0a0a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;">Revisar en el panel →</a>
    </div>
  </div>
</body></html>`;

    const text = `${typeInfo.emoji} ${typeInfo.label}: ${report.title}

${userLabel}${(user as any)?.email ? ` (${(user as any).email})` : ""}
${report.contactEmail ? `Contacto: ${report.contactEmail}\n` : ""}${race ? `Carrera: ${race.name} (${baseUrl}/carreras/${race.slug})\n` : ""}${report.pageUrl ? `Página: ${report.pageUrl}\n` : ""}
${report.description}

Revisar en: ${adminUrl}`;

    await ctx.scheduler.runAfter(0, (internal.emails as any).sendEmail, {
      to: process.env.ADMIN_NOTIFICATION_EMAIL || "hola@mi-dorsal.com",
      subject: `${typeInfo.emoji} ${typeInfo.label}: ${report.title}`,
      html,
      text,
    });
  },
});

// ---------------------------------------------------------------------------
// Utilidades
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

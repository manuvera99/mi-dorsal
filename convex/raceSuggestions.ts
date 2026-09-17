// =============================================================================
// mi-dorsal — Race suggestions (carreras que un usuario nos sugiere)
// =============================================================================
// Un usuario logueado que no encuentra su carrera en /carreras puede:
//   (a) Pegar solo la URL + nota (mutation `submit`) → admin la procesa a mano.
//   (b) Pegar la URL y dejar que la IA extraiga los datos; el usuario edita
//       la previsualización y la envía como BORRADOR (mutation
//       `submitWithAiExtraction`).
//       El borrador queda como `race` con `isPublished: false` y
//       `scraperAdapter: "user-suggested"`, enlazado a la sugerencia vía
//       `createdRaceId`. El admin revisa en /admin/race-suggestions y publica.
//
// Ambos flujos crean una entrada "pending" que el admin ve en
// /admin/race-suggestions. Tras crear la sugerencia se envía un email al admin.
// =============================================================================

import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  requireAdmin,
  requireUser,
  provinceValidator,
  raceTypeValidator,
} from "./_helpers";

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
// SUBMIT CON IA (usuario logueado) — wizard "Crear carrera con IA"
// ---------------------------------------------------------------------------

/**
 * Envía una sugerencia + borrador de carrera extraído por IA.
 *
 * Flujo:
 *   1. Usuario pega URL en /carreras → la IA extrae ~12 campos.
 *   2. Usuario revisa/edita en el form del wizard.
 *   3. Usuario confirma → esta mutation crea:
 *      - row en `races` con isPublished=false, scraperAdapter="user-suggested",
 *        extractionConfidence="medium", extractedFromUrl=<url>.
 *      - row en `raceSuggestions` enlazada vía createdRaceId (status="pending"
 *        por defecto — el admin la marca "approved" o "created" al publicar).
 *
 * Anti-duplicados:
 *   - Si ya existe una race con el mismo `officialUrl` (la URL exacta que el
 *     user pegó), devuelve error claro para que no se creen duplicados.
 *   - Si existe con el mismo nombre+fecha+provincia, actualiza los campos
 *     vacíos del existente en lugar de crear uno nuevo (mismo criterio que
 *     `systemCreate`).
 *
 * Devuelve: { raceId, suggestionId }
 */
export const submitWithAiExtraction = mutation({
  args: {
    url: v.string(),
    // Datos editados por el usuario sobre la extracción de la IA
    name: v.string(),
    province: provinceValidator,
    raceType: raceTypeValidator,
    distanceKm: v.number(),
    elevationGainM: v.optional(v.number()),
    startDate: v.optional(v.string()),
    locality: v.optional(v.string()),
    organizer: v.optional(v.string()),
    description: v.optional(v.string()),
    officialUrl: v.optional(v.string()),
    registrationUrl: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Validaciones básicas
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

    const name = args.name.trim();
    if (name.length < 3) throw new Error("El nombre es demasiado corto");
    if (name.length > 200) throw new Error("El nombre no puede superar los 200 caracteres");

    if (args.distanceKm <= 0 || args.distanceKm > 1000) {
      throw new Error("La distancia debe estar entre 0 y 1000 km");
    }

    // officialUrl resuelto: si el user no lo cambió en el wizard, usamos la URL original
    const finalOfficialUrl = (args.officialUrl ?? url).trim() || undefined;

    const now = Date.now();

    // Anti-duplicado por officialUrl: si ya existe una race con esta URL,
    // no creamos borrador (sería trabajo del admin limpiar el duplicado).
    if (finalOfficialUrl) {
      const existing = await ctx.db
        .query("races")
        .withIndex("by_official_url", (q) => q.eq("officialUrl", finalOfficialUrl))
        .first();
      if (existing) {
        throw new Error(
          "Ya tenemos una carrera con esa web oficial en el catálogo. " +
            "Búscala en /carreras antes de añadirla de nuevo."
        );
      }
    }

    // Anti-duplicado por nombre+fecha+provincia (mismo criterio que
    // `systemCreate`): si existe, actualizamos los campos vacíos en lugar de
    // crear una nueva. Si el admin la publicó, el user la "duplica" sin saberlo.
    let existingRaceId: string | null = null;
    if (args.startDate) {
      const norm = (s: string) =>
        s
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
      const nameKey = norm(name);
      const candidates = await ctx.db
        .query("races")
        .withIndex("by_date", (q) => q.eq("startDate", args.startDate!))
        .collect();
      const match = candidates.find(
        (c) => norm(c.name) === nameKey && c.province === args.province
      );
      if (match) {
        // Solo actualizamos campos vacíos para no machacar datos buenos
        const patch: Record<string, unknown> = {};
        if (!match.organizer && args.organizer) patch.organizer = args.organizer;
        if (!match.description && args.description) patch.description = args.description;
        if (!match.registrationUrl && args.registrationUrl)
          patch.registrationUrl = args.registrationUrl;
        if (!match.locality && args.locality) patch.locality = args.locality;
        if (!match.imageUrl && args.imageUrl) patch.imageUrl = args.imageUrl;
        if (match.elevationGainM === undefined && args.elevationGainM !== undefined)
          patch.elevationGainM = args.elevationGainM;
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(match._id, patch);
        }
        existingRaceId = match._id;
      }
    }

    let raceId: string;
    if (existingRaceId) {
      raceId = existingRaceId;
    } else {
      // Generar slug único
      const baseSlug = slugifyLocal(name);
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

      // Insertar la race como BORRADOR (isPublished=false).
      // scraperAdapter="user-suggested" indica que la fuente fue una sugerencia
      // de usuario con extracción IA. El admin decide si publica o rechaza.
      raceId = await ctx.db.insert("races", {
        name,
        slug: finalSlug,
        province: args.province,
        distanceKm: args.distanceKm,
        elevationGainM: args.elevationGainM,
        raceType: args.raceType,
        startDate: args.startDate,
        locality: args.locality,
        organizer: args.organizer,
        description: args.description,
        officialUrl: finalOfficialUrl,
        registrationUrl: args.registrationUrl,
        imageUrl: args.imageUrl,
        isPublished: false,
        isFeatured: false,
        scraperAdapter: "user-suggested",
        extractedFromUrl: url,
        extractionConfidence: "medium",
        ingestedAt: now,
      });
    }

    // Crear sugerencia enlazada. status="pending" — el admin la trabaja desde
    // /admin/race-suggestions, donde verá el badge "IA extraída" porque
    // createdRaceId está set.
    const suggestionId = await ctx.db.insert("raceSuggestions", {
      userId: user._id,
      url: parsed.toString(),
      suggestedName: name,
      suggestedDate: args.startDate,
      suggestedLocality: args.locality,
      suggestedProvince: args.province,
      status: "pending",
      createdAt: now,
      createdRaceId: raceId as any,
    });

    // Notificar al admin con info ampliada (preview de la carrera borrador)
    await ctx.scheduler.runAfter(0, internal.raceSuggestions.notifyAdminWithDraft, {
      suggestionId,
      raceId: raceId as any,
    } as any);

    return { raceId, suggestionId };
  },
});

/** Slugify local para evitar conflicto con el `slugify` global del proyecto
 *  (convex/_helpers.ts lo exporta, pero queremos mantener este módulo
 *  autocontenido y no añadir import cross-cutting). Si más adelante se quiere
 *  unificar, mover a _helpers.ts y reusar. */
function slugifyLocal(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[áàäâ]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
      // Borradores IA (sugerencias con createdRaceId set y race aún isPublished:false).
      // Es la métrica que el admin mira primero cada mañana.
      aiDrafts: all.filter((s) => !!s.createdRaceId).length,
    };
  },
});

/**
 * Lista sugerencias que tienen un borrador IA asociado (createdRaceId set).
 * El admin las revisa desde aquí: 1 click → /admin/races/[id] para editar/publicar.
 * Solo admin.
 */
export const adminListDrafts = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = args.limit ?? 100;

    const all = await ctx.db.query("raceSuggestions").order("desc").collect();
    const drafts = all
      .filter((s) => !!s.createdRaceId)
      .slice(0, limit);

    return Promise.all(
      drafts.map(async (s) => {
        const user = await ctx.db.get(s.userId);
        const draft = s.createdRaceId
          ? await ctx.db.get(s.createdRaceId as Id<"races">)
          : null;
        return {
          ...s,
          user: user
            ? {
                _id: user._id,
                displayName: (user as any).displayName ?? null,
                email: (user as any).email ?? null,
              }
            : null,
          draft: draft
            ? {
                _id: draft._id,
                name: draft.name,
                slug: draft.slug,
                isPublished: draft.isPublished ?? false,
                distanceKm: draft.distanceKm,
                province: draft.province,
                locality: draft.locality,
                startDate: draft.startDate,
                raceType: draft.raceType,
                extractionConfidence: draft.extractionConfidence,
              }
            : null,
        };
      })
    );
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
 * Email al admin cuando llega una sugerencia con borrador IA (wizard público).
 * Es paralelo a `notifyAdmin` pero añade un preview de la carrera borrador
 * y un CTA directo a /admin/races/[id] para revisar y publicar.
 */
export const notifyAdminWithDraft = internalMutation({
  args: {
    suggestionId: v.id("raceSuggestions"),
    raceId: v.id("races"),
  },
  handler: async (ctx, { suggestionId, raceId }) => {
    const suggestion = await ctx.db.get(suggestionId);
    const draft = await ctx.db.get(raceId);
    if (!suggestion || !draft) return;
    const user = await ctx.db.get(suggestion.userId);

    const userLabel =
      user?.displayName?.trim() ||
      (user as any)?.email ||
      `Usuario ${user?._id.slice(0, 8) ?? "desconocido"}`;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.mi-dorsal.com";
    const adminRaceUrl = `${baseUrl}/admin/races/${raceId}`;
    const adminSuggestionsUrl = `${baseUrl}/admin/race-suggestions`;

    const previewFields = [
      draft.name && `<li><strong>Nombre:</strong> ${escapeHtml(draft.name)}</li>`,
      draft.startDate && `<li><strong>Fecha:</strong> ${escapeHtml(draft.startDate)}</li>`,
      draft.locality && `<li><strong>Localidad:</strong> ${escapeHtml(draft.locality)} <em>(${escapeHtml(draft.province)})</em></li>`,
      `<li><strong>Distancia:</strong> ${draft.distanceKm} km · <strong>Tipo:</strong> ${escapeHtml(draft.raceType)}</li>`,
      draft.elevationGainM && `<li><strong>Desnivel:</strong> +${draft.elevationGainM} m</li>`,
      draft.organizer && `<li><strong>Organizador:</strong> ${escapeHtml(draft.organizer)}</li>`,
    ]
      .filter(Boolean)
      .join("");

    const html = `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fafaf9;padding:24px;color:#0a0a0a;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e7e5e4;">
    <div style="background:#7c3aed;color:#fff;padding:16px 20px;">
      <h1 style="margin:0;font-size:18px;">✨ Carrera borrador con IA</h1>
    </div>
    <div style="padding:20px;">
      <p style="margin:0 0 8px;"><strong>${escapeHtml(userLabel)}</strong> creó un borrador con el wizard "Crear con IA":</p>
      <p style="margin:0 0 12px;font-size:13px;color:#666;">URL original:</p>
      <p style="margin:0 0 16px;word-break:break-all;">
        <a href="${escapeAttr(suggestion.url)}" style="color:#7c3aed;">${escapeHtml(suggestion.url)}</a>
      </p>
      <div style="background:#f5f3ff;border-left:3px solid #7c3aed;padding:12px 14px;border-radius:4px;margin:0 0 16px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#5b21b6;">Vista previa (extraída por IA, editada por el user):</p>
        <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6;">${previewFields}</ul>
      </div>
      <p style="margin:0 0 4px;font-size:12px;color:#666;">La carrera está en <code>isPublished: false</code>. Revisa, corrige lo que haga falta y publícala en 1 click.</p>
      <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
        <a href="${adminRaceUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;">Revisar y publicar →</a>
        <a href="${adminSuggestionsUrl}" style="display:inline-block;background:#fff;color:#7c3aed;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;border:1px solid #7c3aed;">Ver en sugerencias</a>
      </div>
    </div>
  </div>
</body></html>`;

    const text = `✨ Carrera borrador con IA

${userLabel} creó un borrador:
${suggestion.url}

Vista previa:
- Nombre: ${draft.name}
${draft.startDate ? `- Fecha: ${draft.startDate}\n` : ""}${draft.locality ? `- Localidad: ${draft.locality} (${draft.province})\n` : ""}- Distancia: ${draft.distanceKm} km
- Tipo: ${draft.raceType}
${draft.elevationGainM ? `- Desnivel: +${draft.elevationGainM} m\n` : ""}${draft.organizer ? `- Organizador: ${draft.organizer}\n` : ""}

Revisar y publicar: ${adminRaceUrl}
Ver en sugerencias: ${adminSuggestionsUrl}`;

    await ctx.scheduler.runAfter(0, internal.emails.sendEmail.sendEmail, {
      to: process.env.ADMIN_NOTIFICATION_EMAIL || "hola@mi-dorsal.com",
      subject: `✨ Borrador IA: ${draft.name}`,
      html,
      text,
    });
  },
});

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

    await ctx.scheduler.runAfter(0, internal.emails.sendEmail.sendEmail, {
      to: process.env.ADMIN_NOTIFICATION_EMAIL || "hola@mi-dorsal.com",
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

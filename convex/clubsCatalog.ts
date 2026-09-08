// =============================================================================
// mi-dorsal — Clubs catalog (clubes manuales / añadidos por el admin)
// =============================================================================
// El ClubSelect combina:
//   1. Clubs federados de la RFEA (lib/data/clubs.json, estático)
//   2. Clubs manuales / añadidos (esta tabla)
//
// Esta tabla es para clubs que NO están en la RFEA pero el admin
// quiere que aparezcan en el selector: clubs populares (Bull Runners),
// secciones de colegio, clubs de running no federados, etc.
//
// Flujo:
//   - Admin entra a /admin/clubs → CRUD
//   - Admin marca sugerencia como "added" en /admin/club-suggestions
//     → handler crea fila aquí automáticamente
//   - ClubSelect hace listAll (público) y mezcla con el JSON
// =============================================================================

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getOptionalUser, requireAdmin } from "./_helpers";

const NAME_MAX = 120;
const CCAA_MAX = 60;

function normalizeName(s: string): string {
  return s.trim();
}

function validateClubName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 2) throw new Error("El nombre es demasiado corto (mínimo 2 caracteres)");
  if (trimmed.length > NAME_MAX) throw new Error(`El nombre no puede pasar de ${NAME_MAX} caracteres`);
  return trimmed;
}

function validateCcaa(ccaa: string): string {
  const trimmed = ccaa.trim();
  if (trimmed.length < 2) throw new Error("La CCAA es requerida");
  if (trimmed.length > CCAA_MAX) throw new Error(`La CCAA no puede pasar de ${CCAA_MAX} caracteres`);
  return trimmed;
}

// ---------------------------------------------------------------------------
// PÚBLICO: lista para el ClubSelect
// ---------------------------------------------------------------------------

/**
 * Devuelve todos los clubs manuales activos. La query es pública (sin
 * requireUser) porque el ClubSelect la llama desde /perfil y queremos
 * que esté disponible incluso si la auth está cargando.
 *
 * Nota: NO paginamos porque esperamos <500 clubs manuales a medio plazo.
 * Si llegamos a 1000+, añadimos paginación o un endpoint de búsqueda.
 */
export const listAll = query({
  args: {
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const activeOnly = args.activeOnly ?? true;
    const all = await ctx.db.query("clubsCatalog").collect();
    return all
      .filter((c) => (activeOnly ? c.isActive !== false : true))
      .map((c) => ({
        _id: c._id,
        name: c.name,
        ccaa: c.ccaa,
        source: c.source,
      }));
  },
});

// ---------------------------------------------------------------------------
// ADMIN: CRUD
// ---------------------------------------------------------------------------

/**
 * Lista los clubs manuales con paginación y búsqueda. Solo admin.
 */
export const adminList = query({
  args: {
    search: v.optional(v.string()),
    source: v.optional(v.union(
      v.literal("manual"),
      v.literal("from_suggestion"),
    )),
    activeOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = args.limit ?? 200;
    const activeOnly = args.activeOnly ?? false;

    const all = await ctx.db.query("clubsCatalog").order("desc").collect();
    let list = all;
    if (activeOnly) list = list.filter((c) => c.isActive !== false);
    if (args.source) list = list.filter((c) => c.source === args.source);
    if (args.search) {
      const q = args.search.toLowerCase();
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q) || c.ccaa.toLowerCase().includes(q),
      );
    }
    list = list.slice(0, limit);

    return Promise.all(
      list.map(async (c) => {
        const creator = await ctx.db.get(c.createdBy);
        return {
          ...c,
          creator: creator
            ? { _id: creator._id, displayName: (creator as any).displayName ?? null }
            : null,
        };
      }),
    );
  },
});

/**
 * Stats rápidas: total, activos, manuales, desde sugerencia.
 */
export const adminGetStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("clubsCatalog").collect();
    return {
      total: all.length,
      active: all.filter((c) => c.isActive !== false).length,
      manual: all.filter((c) => c.source === "manual").length,
      fromSuggestion: all.filter((c) => c.source === "from_suggestion").length,
    };
  },
});

/**
 * Crea un club manual. Solo admin. Rechaza si ya existe uno con el mismo
 * nombre y CCAA (normalizado a lowercase para evitar duplicados por casing).
 */
export const adminCreate = mutation({
  args: {
    name: v.string(),
    ccaa: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const name = validateClubName(args.name);
    const ccaa = validateCcaa(args.ccaa);

    // Deduplicación: si ya existe un club con el mismo name+ccaa (case-insensitive),
    // rechazamos la creación. El admin puede editarlo si quiere.
    const key = `${name.toLowerCase()}|${ccaa.toLowerCase()}`;
    const existing = await ctx.db
      .query("clubsCatalog")
      .withIndex("by_name_ccaa", (q) => q.eq("name", name).eq("ccaa", ccaa))
      .unique();
    // Nota: by_name_ccaa es case-sensitive. Para case-insensitive, hacemos
    // un .collect() y filtramos. Aceptable porque esperamos <1000 clubs.
    if (existing) {
      // Reactivar si estaba inactivo
      if (existing.isActive === false) {
        await ctx.db.patch(existing._id, { isActive: true });
        return existing._id;
      }
      throw new Error("Ya existe un club con ese nombre y CCAA");
    }
    // Fallback case-insensitive (escaneo pequeño)
    const allClubs = await ctx.db.query("clubsCatalog").collect();
    const dupe = allClubs.find(
      (c) =>
        c.name.toLowerCase() === name.toLowerCase() &&
        c.ccaa.toLowerCase() === ccaa.toLowerCase() &&
        c.isActive !== false,
    );
    if (dupe) {
      throw new Error("Ya existe un club con ese nombre y CCAA (case-insensitive)");
    }

    const now = Date.now();
    const id = await ctx.db.insert("clubsCatalog", {
      name,
      ccaa,
      source: "manual",
      createdBy: admin._id,
      createdAt: now,
      isActive: true,
    });
    return id;
  },
});

/**
 * Edita un club manual. Solo admin. NO permite cambiar el source.
 */
export const adminUpdate = mutation({
  args: {
    id: v.id("clubsCatalog"),
    name: v.optional(v.string()),
    ccaa: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const club = await ctx.db.get(args.id);
    if (!club) throw new Error("Club no encontrado");

    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) {
      patch.name = validateClubName(args.name);
    }
    if (args.ccaa !== undefined) {
      patch.ccaa = validateCcaa(args.ccaa);
    }
    if (args.isActive !== undefined) {
      patch.isActive = args.isActive;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.id, patch);
    }
    return args.id;
  },
});

/**
 * Elimina un club manual. Solo admin. Si el club vino de una sugerencia,
 * también marca la sugerencia como "rejected" (porque ya no está añadido).
 *
 * En vez de un delete físico, hacemos soft-delete (isActive: false) para
 * mantener referencias históricas. El admin puede hacer delete físico
 * después si quiere desde el dashboard de Convex.
 */
export const adminDelete = mutation({
  args: { id: v.id("clubsCatalog") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const club = await ctx.db.get(args.id);
    if (!club) throw new Error("Club no encontrado");

    // Soft delete
    await ctx.db.patch(args.id, { isActive: false });

    // Si vino de una sugerencia, revertir el estado de la sugerencia
    if (club.suggestionId) {
      const suggestion = await ctx.db.get(club.suggestionId);
      if (suggestion && suggestion.status === "added") {
        await ctx.db.patch(club.suggestionId, { status: "rejected" });
      }
    }
    return args.id;
  },
});

/**
 * Crea un club desde una sugerencia aprobada. Usado por
 * clubSuggestions.adminUpdateStatus cuando status pasa a "added".
 * Si el club ya existe (mismo name+ccaa), devuelve el id existente
 * (idempotente).
 */
export const upsertFromSuggestion = mutation({
  args: {
    name: v.string(),
    ccaa: v.optional(v.string()),
    suggestionId: v.id("clubSuggestions"),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const name = validateClubName(args.name);
    const ccaa = args.ccaa ? validateCcaa(args.ccaa) : "Sin CCAA";

    // Idempotente: si ya existe, no duplicamos
    const all = await ctx.db.query("clubsCatalog").collect();
    const existing = all.find(
      (c) =>
        c.name.toLowerCase() === name.toLowerCase() &&
        c.ccaa.toLowerCase() === ccaa.toLowerCase(),
    );
    if (existing) {
      // Reactivar si estaba inactivo
      if (existing.isActive === false) {
        await ctx.db.patch(existing._id, { isActive: true });
      }
      return existing._id;
    }

    const now = Date.now();
    const id = await ctx.db.insert("clubsCatalog", {
      name,
      ccaa,
      source: "from_suggestion",
      suggestionId: args.suggestionId,
      createdBy: admin._id,
      createdAt: now,
      isActive: true,
    });
    return id;
  },
});

// =============================================================================
// mi-dorsal — Blog ("Historias de dorsal")
// =============================================================================
// CRUD + queries para el blog editorial. Las queries públicas solo devuelven
// posts con isPublished=true. Las mutations de escritura requieren rol admin
// (excepto incrementViews, que es público y se invoca al abrir un post).
// =============================================================================

import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { requireAdmin, getOptionalUser, slugify } from "./_helpers";

// ---------------------------------------------------------------------------
// Validadores reusables
// ---------------------------------------------------------------------------

const categoryValidator = v.union(
  v.literal("historias"),
  v.literal("guias"),
  v.literal("curiosidades"),
  v.literal("tendencias"),
);

export const CATEGORY_LABELS: Record<string, string> = {
  historias: "Historias de dorsal",
  guias: "Guías de carrera",
  curiosidades: "Curiosidades",
  tendencias: "Tendencias con contexto",
};

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  historias:
    "Reportajes personales, Behobia, San Silvestre, lo que se siente al cruzar una meta.",
  guias:
    "Ruta, perfil, avituallamiento, qué llevar. Datos reales del catálogo de mi-dorsal.",
  curiosidades: "Récords raros, historia del running popular español, datos que no esperabas.",
  tendencias:
    "Material, entrenamiento, calendario. Lo que se mueve, con contexto de mi-dorsal.",
};

// ---------------------------------------------------------------------------
// QUERIES PÚBLICAS
// ---------------------------------------------------------------------------

/**
 * Lista posts publicados, paginados, opcionalmente filtrados por categoría.
 * Orden: más reciente primero.
 */
export const list = query({
  args: {
    category: v.optional(categoryValidator),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 12, 50);

    let q = ctx.db
      .query("blogPosts")
      .withIndex("by_published_date", (qq) => qq.eq("isPublished", true));

    const all = await q.order("desc").collect();

    let filtered = all;
    if (args.category) {
      filtered = filtered.filter((p) => p.category === args.category);
    }

    // Paginación simple por offset (no cursor real — son posts, no se actualizan a esa velocidad)
    const start = args.cursor ? parseInt(args.cursor, 10) : 0;
    const end = start + limit;
    const items = filtered.slice(start, end);
    const nextCursor = end < filtered.length ? String(end) : undefined;

    return {
      items: items.map((p) => ({
        _id: p._id,
        _creationTime: p._creationTime,
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        category: p.category,
        coverImageUrl: p.coverImageUrl,
        coverImageAlt: p.coverImageAlt,
        authorName: p.authorName,
        publishedAt: p.publishedAt,
        readingTimeMinutes: p.readingTimeMinutes,
        isFeatured: p.isFeatured,
      })),
      nextCursor,
      total: filtered.length,
    };
  },
});

/**
 * Lista posts destacados (isFeatured) publicados. Para el home o sidebar.
 */
export const listFeatured = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const all = await ctx.db
      .query("blogPosts")
      .withIndex("by_featured", (q) => q.eq("isFeatured", true).eq("isPublished", true))
      .order("desc")
      .take(limit ?? 3);
    return all;
  },
});

/**
 * Obtiene un post por slug (público). Solo si está publicado.
 */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const post = await ctx.db
      .query("blogPosts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!post || !post.isPublished) return null;
    return post;
  },
});

/**
 * Posts relacionados: misma categoría (excluyendo el actual) + intersección
 * de tags si los hay. Límite: 3.
 */
export const getRelated = query({
  args: { postId: v.id("blogPosts"), limit: v.optional(v.number()) },
  handler: async (ctx, { postId, limit }) => {
    const current = await ctx.db.get(postId);
    if (!current) return [];

    const sameCategory = await ctx.db
      .query("blogPosts")
      .withIndex("by_category", (q) =>
        q.eq("category", current.category).eq("isPublished", true),
      )
      .order("desc")
      .take(20);

    const candidates = sameCategory.filter((p) => p._id !== postId);

    // Scoring: +2 por cada tag en común
    const currentTags = new Set(current.tags ?? []);
    const scored = candidates
      .map((p) => {
        const shared = (p.tags ?? []).filter((t) => currentTags.has(t)).length;
        return { post: p, score: shared * 2 };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit ?? 3)
      .map((x) => x.post);

    return scored;
  },
});

/**
 * Devuelve categorías con el conteo de posts publicados en cada una.
 * Útil para la landing /blog con chips de filtro.
 */
export const getCategoriesWithCounts = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("blogPosts")
      .withIndex("by_published_date", (q) => q.eq("isPublished", true))
      .collect();

    const counts: Record<string, number> = {
      historias: 0,
      guias: 0,
      curiosidades: 0,
      tendencias: 0,
    };
    for (const p of all) {
      counts[p.category] = (counts[p.category] ?? 0) + 1;
    }
    return counts;
  },
});

// ---------------------------------------------------------------------------
// QUERIES ADMIN
// ---------------------------------------------------------------------------

/**
 * Lista TODOS los posts (publicados o no) para el panel admin.
 */
export const adminList = query({
  args: {
    category: v.optional(categoryValidator),
    status: v.optional(v.union(v.literal("published"), v.literal("draft"))),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("blogPosts").order("desc").collect();
    let filtered = all;
    if (args.category) {
      filtered = filtered.filter((p) => p.category === args.category);
    }
    if (args.status === "published") {
      filtered = filtered.filter((p) => p.isPublished === true);
    } else if (args.status === "draft") {
      filtered = filtered.filter((p) => !p.isPublished);
    }
    if (args.search) {
      const s = args.search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(s) ||
          p.slug.toLowerCase().includes(s) ||
          p.excerpt.toLowerCase().includes(s),
      );
    }
    return filtered;
  },
});

/**
 * Detalle completo de un post (admin) — incluye el contenido markdown.
 */
export const adminGet = query({
  args: { id: v.id("blogPosts") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    return await ctx.db.get(id);
  },
});

/**
 * Devuelve el siguiente post editorial candidato para la newsletter mensual.
 * Prioriza: !newsletterSentAt, isPublished, isFeatured OR más reciente.
 * Internal: solo lo llama el cron.
 */
export const pickNextNewsletterPost = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Posts publicados que aún no se han enviado en newsletter
    const candidates = await ctx.db
      .query("blogPosts")
      .withIndex("by_published_date", (q) => q.eq("isPublished", true))
      .order("desc")
      .collect();

    return candidates.find((p) => !p.newsletterSentAt) ?? null;
  },
});

// ---------------------------------------------------------------------------
// MUTATIONS
// ---------------------------------------------------------------------------

/**
 * Crea un post en estado borrador. El slug se autogenera del título si no
 * se pasa. Admin only.
 */
export const create = mutation({
  args: {
    title: v.string(),
    slug: v.optional(v.string()),
    excerpt: v.string(),
    content: v.string(),
    category: categoryValidator,
    tags: v.optional(v.array(v.string())),
    coverImageId: v.optional(v.id("_storage")),
    coverImageUrl: v.optional(v.string()),
    coverImageAlt: v.optional(v.string()),
    seoTitle: v.optional(v.string()),
    seoDescription: v.optional(v.string()),
    seoKeywords: v.optional(v.array(v.string())),
    relatedRaceIds: v.optional(v.array(v.id("races"))),
  },
  handler: async (ctx, args) => {
    const profile = await requireAdmin(ctx);

    // Slug: si no se pasa, se genera del título. Si ya existe, se le añade un sufijo numérico.
    let slug = args.slug?.trim() || slugify(args.title);
    const existing = await ctx.db
      .query("blogPosts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) {
      let i = 2;
      while (true) {
        const next = `${slug}-${i}`;
        const conflict = await ctx.db
          .query("blogPosts")
          .withIndex("by_slug", (q) => q.eq("slug", next))
          .unique();
        if (!conflict) {
          slug = next;
          break;
        }
        i++;
      }
    }

    const now = Date.now();
    const readingTimeMinutes = estimateReadingTime(args.content);

    return await ctx.db.insert("blogPosts", {
      slug,
      title: args.title,
      excerpt: args.excerpt,
      content: args.content,
      coverImageId: args.coverImageId,
      coverImageUrl: args.coverImageUrl,
      coverImageAlt: args.coverImageAlt,
      category: args.category,
      tags: args.tags,
      authorId: profile._id,
      authorName: profile.displayName ?? "mi-dorsal",
      publishedAt: undefined,
      isPublished: false,
      isFeatured: false,
      seoTitle: args.seoTitle,
      seoDescription: args.seoDescription,
      seoKeywords: args.seoKeywords,
      readingTimeMinutes,
      views: 0,
      relatedRaceIds: args.relatedRaceIds,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Edita un post (admin). No permite cambiar slug una vez creado (para no
 * romper URLs indexadas). Para cambiar slug, crear nuevo + redirección 301.
 */
export const update = mutation({
  args: {
    id: v.id("blogPosts"),
    title: v.optional(v.string()),
    excerpt: v.optional(v.string()),
    content: v.optional(v.string()),
    category: v.optional(categoryValidator),
    tags: v.optional(v.array(v.string())),
    coverImageId: v.optional(v.id("_storage")),
    coverImageUrl: v.optional(v.string()),
    coverImageAlt: v.optional(v.string()),
    seoTitle: v.optional(v.string()),
    seoDescription: v.optional(v.string()),
    seoKeywords: v.optional(v.array(v.string())),
    relatedRaceIds: v.optional(v.array(v.id("races"))),
    isFeatured: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...patch }) => {
    await requireAdmin(ctx);
    const post = await ctx.db.get(id);
    if (!post) throw new Error("Post no encontrado");

    // Recalcular reading time si cambia el content
    const readingTimeMinutes =
      patch.content !== undefined
        ? estimateReadingTime(patch.content)
        : post.readingTimeMinutes;

    await ctx.db.patch(id, {
      ...patch,
      readingTimeMinutes,
      updatedAt: Date.now(),
    });
    return id;
  },
});

/**
 * Publica un post (admin). Setea publishedAt al momento actual.
 */
export const publish = mutation({
  args: { id: v.id("blogPosts") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const post = await ctx.db.get(id);
    if (!post) throw new Error("Post no encontrado");
    await ctx.db.patch(id, {
      isPublished: true,
      publishedAt: post.publishedAt ?? Date.now(),
      updatedAt: Date.now(),
    });
    return id;
  },
});

/**
 * Despublica un post (admin). Lo deja como borrador (isPublished=false).
 * Mantiene publishedAt para no perder fecha original al re-publicar.
 */
export const unpublish = mutation({
  args: { id: v.id("blogPosts") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(id, {
      isPublished: false,
      updatedAt: Date.now(),
    });
    return id;
  },
});

/**
 * Toggle del flag isFeatured (admin). Para destacar en home o sidebar.
 */
export const toggleFeatured = mutation({
  args: { id: v.id("blogPosts"), value: v.boolean() },
  handler: async (ctx, { id, value }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(id, { isFeatured: value, updatedAt: Date.now() });
    return id;
  },
});

/**
 * Borra un post (admin). Acción destructiva, requiere confirmación.
 */
export const adminDelete = mutation({
  args: { id: v.id("blogPosts") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(id);
    return id;
  },
});

/**
 * Incrementa contador de views (público, sin auth).
 * No es atómico en Convex (no se puede dentro de un query), pero al estar
 * en una mutation es seguro. Si dos requests llegan a la vez, el último gana;
 * para analítica de vistas es más que suficiente.
 */
export const incrementViews = mutation({
  args: { id: v.id("blogPosts") },
  handler: async (ctx, { id }) => {
    const post = await ctx.db.get(id);
    if (!post) return;
    await ctx.db.patch(id, { views: (post.views ?? 0) + 1 });
  },
});

/**
 * Marca el post como enviado en la newsletter editorial (interno, lo usa
 * el cron newsletter-editorial tras enviar).
 */
export const markNewsletterSent = internalMutation({
  args: { id: v.id("blogPosts"), sentAt: v.number() },
  handler: async (ctx, { id, sentAt }) => {
    await ctx.db.patch(id, { newsletterSentAt: sentAt });
  },
});

/**
 * systemCreate: crea (o publica/destaca) un post desde el script CLI
 * `scripts/content/publish-post.ts` (auth-free, igual que
 * `races.systemCreate`). NO usar desde la app — ahí siempre se pasa por
 * `create`/`publish`/`toggleFeatured` con `requireAdmin`.
 *
 * Resuelve `relatedRaceSlugs` a `relatedRaceIds` aquí mismo: los agentes
 * de contenido y el frontmatter de los drafts solo conocen slugs, no Ids
 * de Convex. Un slug que no exista en el catálogo se ignora y se reporta
 * en `unresolvedRaceSlugs` en vez de romper la creación del post.
 */
export const systemCreate = mutation({
  args: {
    title: v.string(),
    slug: v.optional(v.string()),
    excerpt: v.string(),
    content: v.string(),
    category: categoryValidator,
    tags: v.optional(v.array(v.string())),
    coverImageUrl: v.optional(v.string()),
    coverImageAlt: v.optional(v.string()),
    seoTitle: v.optional(v.string()),
    seoDescription: v.optional(v.string()),
    seoKeywords: v.optional(v.array(v.string())),
    relatedRaceSlugs: v.optional(v.array(v.string())),
    authorName: v.optional(v.string()),
    publish: v.optional(v.boolean()),
    featured: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Slug: si no se pasa, se genera del título. Si ya existe, sufijo numérico.
    let slug = args.slug?.trim() || slugify(args.title);
    const existing = await ctx.db
      .query("blogPosts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) {
      let i = 2;
      while (true) {
        const next = `${slug}-${i}`;
        const conflict = await ctx.db
          .query("blogPosts")
          .withIndex("by_slug", (q) => q.eq("slug", next))
          .unique();
        if (!conflict) {
          slug = next;
          break;
        }
        i++;
      }
    }

    // Resolver relatedRaceSlugs → relatedRaceIds. Un slug que no exista no
    // rompe la creación del post, pero se reporta para que el script CLI
    // avise (evita perder internal linking en silencio).
    const relatedRaceIds: Array<import("./_generated/dataModel").Id<"races">> = [];
    const unresolvedRaceSlugs: string[] = [];
    for (const raceSlug of args.relatedRaceSlugs ?? []) {
      const race = await ctx.db
        .query("races")
        .withIndex("by_slug", (q) => q.eq("slug", raceSlug))
        .first();
      if (race) {
        relatedRaceIds.push(race._id);
      } else {
        unresolvedRaceSlugs.push(raceSlug);
      }
    }

    const now = Date.now();
    const readingTimeMinutes = estimateReadingTime(args.content);

    const postId = await ctx.db.insert("blogPosts", {
      slug,
      title: args.title,
      excerpt: args.excerpt,
      content: args.content,
      coverImageUrl: args.coverImageUrl,
      coverImageAlt: args.coverImageAlt,
      category: args.category,
      tags: args.tags,
      authorName: args.authorName ?? "mi-dorsal",
      publishedAt: args.publish ? now : undefined,
      isPublished: !!args.publish,
      isFeatured: !!args.featured,
      seoTitle: args.seoTitle,
      seoDescription: args.seoDescription,
      seoKeywords: args.seoKeywords,
      readingTimeMinutes,
      views: 0,
      relatedRaceIds: relatedRaceIds.length > 0 ? relatedRaceIds : undefined,
      createdAt: now,
      updatedAt: now,
    });

    return { postId, slug, unresolvedRaceSlugs };
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Estima el tiempo de lectura en minutos.
 * Velocidad media lectora en español: 200 wpm.
 * Mínimo: 1 minuto.
 */
function estimateReadingTime(markdown: string): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, "") // code blocks
    .replace(/`[^`]+`/g, "")        // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links → text
    .replace(/[#*_>]/g, "")          // markdown syntax
    .trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
